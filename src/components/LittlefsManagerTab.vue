<template>
  <div class="filesystem-manager" @dragover.prevent="handleDragOver" @dragleave.prevent="handleDragLeave" @drop.prevent="handleDrop">
    <v-alert v-if="error" type="error" variant="tonal" density="comfortable" border="start" class="mb-3">
      {{ error }}
    </v-alert>
    <v-alert v-else-if="readOnly" type="warning" variant="tonal" density="comfortable" border="start" class="mb-3">
      {{ readOnlyMessage }}
    </v-alert>

    <v-card variant="tonal" prepend-icon="mdi-folder-wrench">
      <template #title>
        <span class="font-weight-black">{{ partitionHeading }}</span>
      </template>
      <v-card-text class="d-flex flex-column gap-4">
        <v-select :items="partitions" item-title="label" item-value="id" density="comfortable" :label="$t('filesystem.partitionName')"
          :model-value="selectedPartitionId" :disabled="loading || busy || saving || !partitions.length"
          @update:model-value="value => emit('select-partition', value)" />
        <div class="filesystem-manager__controls">
          <v-btn color="primary" variant="tonal" :disabled="!hasPartition || loading || busy || saving"
            @click="emit('refresh')">
            <v-icon start>mdi-refresh</v-icon>
            {{ $t('filesystem.read') }}
          </v-btn>
          <v-btn color="secondary" variant="outlined" :disabled="!hasPartition || loading || busy || saving"
            @click="emit('backup')">
            <v-icon start>mdi-content-save</v-icon>
            {{ $t('filesystem.backup') }}
          </v-btn>
          <v-btn color="secondary" variant="text" :disabled="!hasPartition || loading || busy || saving"
            @click="triggerRestore">
            <v-icon start>mdi-upload</v-icon>
            {{ $t('filesystem.restoreImage') }}
          </v-btn>
          <v-btn color="error" variant="text"
            :disabled="readOnly || !hasClient || loading || busy || saving || !backupDone" @click="emit('format')">
            <v-icon start>mdi-delete-sweep</v-icon>
            {{ $t('filesystem.format') }}
          </v-btn>
          <v-spacer />
          <v-btn color="primary" variant="elevated"
            :disabled="readOnly || !dirty || !backupDone || saving || loading || busy || !hasClient"
            @click="emit('save')">
            <v-icon start>mdi-content-save-outline</v-icon>
            {{ $t('filesystem.saveToFlash') }}
          </v-btn>
        </div>
        <v-alert v-if="!backupDone" type="warning" variant="tonal" density="comfortable" border="start" class="mt-2">
          {{ $t('filesystem.backupRequired') }}
        </v-alert>
        <p class="text-caption text-medium-emphasis mb-0">
          {{ $t('filesystem.stagedNotice') }}
        </p>
      </v-card-text>
    </v-card>

    <v-alert v-if="showLoadCancelledBanner" type="warning" variant="tonal" density="comfortable" border="start"
      class="filesystem-load-cancelled">
      {{ loadCancelledMessage }}
    </v-alert>

    <v-card v-else :variant="dragActive ? 'outlined' : 'tonal'">
      <v-card-title class="d-flex align-center justify-space-between">
        <span>{{ $t('filesystem.files') }}</span>
        <v-chip v-if="dirty" color="warning" size="large" variant="tonal">
          {{ $t('filesystem.unsavedChanges') }}
        </v-chip>
      </v-card-title>
      <v-card-text>
        <div v-if="usage?.capacityBytes" class="filesystem-usage">
          <div class="d-flex justify-space-between align-center">
            <span>Used {{ usagePercent }}% ({{ formatSize(usage.usedBytes) }} / {{ formatSize(usage.capacityBytes) }})</span>
            <v-chip v-if="diskVersion" size="small" variant="outlined" color="info" class="ml-2">
              <v-icon start size="small">mdi-information-outline</v-icon>
              LittleFS v{{ diskVersionLabel }}
            </v-chip>
          </div>
          <v-progress-linear :model-value="usagePercent" height="15" rounded color="primary" />
          <div class="text-caption text-medium-emphasis">
            {{ $t('filesystem.freeLabel', { free: formatSize(usage.freeBytes) }) }}
          </div>
        </div>

        <div class="filesystem-pathbar">
          <div class="filesystem-pathbar__breadcrumbs">
            <v-btn icon variant="text" size="small" :disabled="atRoot || loading || busy" @click="emit('navigate-up')">
              <v-icon>mdi-arrow-up</v-icon>
            </v-btn>
            <div class="filesystem-breadcrumbs">
              <v-chip v-for="(crumb, idx) in breadcrumbs" :key="crumb.path" size="small" variant="text"
                :color="idx === breadcrumbs.length - 1 ? 'primary' : undefined"
                :disabled="loading || busy" @click="emit('navigate', crumb.path)">
                {{ crumb.label || '/' }}
              </v-chip>
            </div>
          </div>
          <v-spacer />
          <v-btn color="secondary" variant="tonal" size="small"
            :disabled="readOnly || !hasClient || loading || busy || saving" @click="promptNewFolder">
            <v-icon start>mdi-folder-plus</v-icon>
            New Folder
          </v-btn>
        </div>

        <div>
          <v-row>
            <v-col>
              <div>
                <v-file-input v-model="uploadFile" density="comfortable" accept="*/*" :label="$t('filesystem.selectFile')"
                  prepend-icon="mdi-file-upload" class="upload-picker"
                  :disabled="readOnly || !hasClient || loading || busy || saving" />
              </div>
            </v-col>
            <v-col>
              <div>
                <v-btn color="primary" variant="tonal"
                  :disabled="readOnly || !uploadFile || !hasClient || loading || busy || saving || uploadBlocked"
                  @click="submitUpload">
                  <v-icon start>mdi-upload</v-icon>
                  {{ $t('filesystem.upload') }}
                </v-btn>
              </div>
            </v-col>
            <v-col>
              <div @dragover.prevent="handleDragOver" @dragleave.prevent="handleDragLeave" @drop.prevent="handleDrop">
                <div class="filesystem-dropzone__hint">
                  <v-icon size="32">mdi-cloud-upload-outline</v-icon>
                  <div class="filesystem-dropzone__hint-text">
                    <strong>{{ $t('filesystem.dropAdd') }}</strong>
                  </div>
                </div>
              </div>
            </v-col>
          </v-row>
        </div>

        <v-divider :thickness="2" class="mt-3"></v-divider>
        <div v-if="files.length" class="filesystem-table__toolbar mt-4">
          <v-text-field v-model="fileSearch" :label="$t('filesystem.filterFiles')" variant="outlined" density="comfortable" clearable
            hide-details prepend-inner-icon="mdi-magnify"
            class="filesystem-table__filter filesystem-table__filter--search" />
          <v-select v-model="fileTypeFilter" :items="fileFilterOptions" item-title="label" item-value="value"
            :label="$t('filesystem.fileType')" density="comfortable" hide-details variant="outlined"
            class="filesystem-table__filter filesystem-table__filter--type" />
          <v-spacer />
          <v-chip v-if="files.length" color="primary" size="small" variant="outlined">
            {{ fileCountLabel }}
          </v-chip>
        </div>
        <v-data-table :headers="headers" :items="filteredFiles" :items-per-page-options="filesPerPageOptions"
          v-model:items-per-page="filesPerPage" v-model:page="filesPage" density="compact" class="filesystem-table mt-4">
          <template #item.name="{ item }">
            <div class="filesystem-table__label">
              <v-icon size="16" class="me-2">
                {{ item.type === 'dir' ? 'mdi-folder' : 'mdi-file' }}
              </v-icon>
              <span class="text-truncate"
                :class="{ 'filesystem-link': item.type === 'dir', 'text-primary': item.type === 'dir' }"
                @click="item.type === 'dir' && emit('navigate', item.path)">
                {{ item.name }}
              </span>
            </div>
          </template>
          <template #item.size="{ item }">
            <span v-if="item.type === 'file'">{{ formatSize(item.size) }}</span>
            <span v-else>—</span>
          </template>
          <template #item.actions="{ item }">
            <div class="filesystem-table__actions">
              <v-btn v-if="item.type === 'file'" icon variant="text" size="small"
                :title="`${previewLabel(item.name)} ${item.name}`" :aria-label="`${previewLabel(item.name)} ${item.name}`"
                :disabled="!isViewable(item.name)" @click="emit('view-file', item.path)">
                <v-icon size="18">{{ previewIcon(item.name) }}</v-icon>
              </v-btn>
              <v-btn v-if="item.type === 'file'" icon variant="text" size="small"
                :aria-label="`Download ${item.name}`" @click="emit('download-file', item.path)">
                <v-icon size="18">mdi-download</v-icon>
              </v-btn>
              <v-btn icon variant="text" size="small"
                :aria-label="`Delete ${item.name}`" @click="emit('delete-file', item.path)">
                <v-icon size="18">mdi-delete</v-icon>
              </v-btn>
            </div>
          </template>
          <template #bottom="{ pageCount }">
            <div class="d-flex align-center justify-space-between pa-3">
              <div class="text-caption text-medium-emphasis">
                <template v-if="filteredFiles.length">
                  {{ filteredFiles.length === files.length ? fileCountLabel : fileCountFilteredLabel }}
                </template>
                <template v-else>
                  <v-alert type="warning" variant="tonal" border="start"> {{ $t('filesystem.noMatch') }}</v-alert>
                </template>
              </div>
              <div class="d-flex align-center gap-2">
                <v-select v-model="filesPerPage" :items="filesPerPageOptions" density="compact" hide-details
                  style="max-width: 140px" />
                <span class="text-caption text-medium-emphasis">{{ $t('filesystem.itemsPerPage') }}</span>
              </div>
            </div>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <input ref="restoreInput" type="file" class="d-none" @change="handleRestoreFile" />

    <v-dialog v-model="newFolderDialog" max-width="420">
      <v-card>
        <v-card-title class="text-h6">
          <v-icon start>mdi-folder-plus</v-icon>
          {{ $t('filesystem.newFolder') }}
        </v-card-title>
        <v-card-text>
          <v-text-field v-model="newFolderName" :label="$t('filesystem.newFolderName')" autofocus clearable />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="newFolderDialog = false">{{ $t('filesystem.cancel') }}</v-btn>
          <v-btn color="primary" variant="tonal" :disabled="!newFolderName?.trim()" @click="confirmNewFolder">
            {{ $t('filesystem.create') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps({
  partitions: Array,
  selectedPartitionId: [Number, String, null],
  files: Array,
  currentPath: {
    type: String,
    default: '/',
  },
  status: String,
  loading: Boolean,
  busy: Boolean,
  saving: Boolean,
  readOnly: Boolean,
  readOnlyReason: String,
  dirty: Boolean,
  backupDone: Boolean,
  error: String,
  hasPartition: Boolean,
  hasClient: Boolean,
  usage: Object,
  diskVersion: {
    type: Number,
    default: 0,
  },
  formatDiskVersion: Function,
  uploadBlocked: Boolean,
  uploadBlockedReason: String,
  isFileViewable: {
    type: Function,
    default: () => false,
  },
  getFilePreviewInfo: Function,
  fsLabel: {
    type: String,
    default: 'LittleFS',
  },
  partitionTitle: String,
  loadCancelled: Boolean,
  loadCancelledMessage: String,
  readOnlyMessage: String,
  emptyStateMessage: String,
});

const emit = defineEmits([
  'select-partition',
  'refresh',
  'backup',
  'restore',
  'download-file',
  'view-file',
  'validate-upload',
  'upload-file',
  'delete-file',
  'format',
  'save',
  'navigate',
  'navigate-up',
  'new-folder',
  'reset-upload-block',
]);

const uploadFile = ref(null);
const restoreInput = ref(null);
const fileSearch = ref('');
const filesPerPage = ref(25);
const filesPage = ref(1);
const fileTypeFilter = ref('all');
const dragActive = ref(false);
const dropQueue = ref([]);

const headers = computed(() => (
  [
    { title: t('filesystem.columns.name'), key: 'name', sortable: true, align: 'start' as const },
    { title: t('filesystem.columns.size'), key: 'size', sortable: true, align: 'start' as const },
    { title: t('filesystem.columns.actions'), key: 'actions', sortable: false, align: 'end' as const },
  ] as const
));
const filesPerPageOptions = computed(() => Object.freeze([10, 25, 50, { value: -1, title: t('filesystem.all') }]));
const FILE_CATEGORY_LABELS = computed(() => ({
  all: t('filesystem.allTypes'),
  text: t('filesystem.text'),
  image: t('filesystem.image'),
  audio: t('filesystem.audio'),
  other: t('filesystem.other'),
}));

const fileFilterOptions = computed(() => [
  { label: `${FILE_CATEGORY_LABELS.value.all} (${props.files.length})`, value: 'all' },
]);

const partitionHeading = computed(() => props.partitionTitle || t('filesystem.partitionHeading', { fs: props.fsLabel }));
const hasPartition = computed(() => props.hasPartition);
const hasClient = computed(() => props.hasClient);
const atRoot = computed(() => props.currentPath === '/' || props.currentPath === '');

const breadcrumbs = computed(() => {
  const segments = props.currentPath.split('/').filter(Boolean);
  const crumbs = [{ label: '/', path: '/' }];
  let acc = '';
  segments.forEach(seg => {
    acc += `/${seg}`;
    crumbs.push({ label: seg, path: acc || '/' });
  });
  return crumbs;
});

const usagePercent = computed(() => {
  if (!props.usage || !props.usage.capacityBytes) return 0;
  if (props.usage.capacityBytes <= 0) return 0;
  const val = (props.usage.usedBytes / props.usage.capacityBytes) * 100;
  if (!Number.isFinite(val) || val < 0) return 0;
  return Math.min(100, Math.max(0, Number(val.toFixed(1))));
});

const selectedPartition = computed(() =>
  props.partitions?.find(partition => partition.id === props.selectedPartitionId) ?? null,
);

const showLoadCancelledBanner = computed(() => props.loadCancelled === true);

const filteredFiles = computed(() => {
  const term = fileSearch.value.trim().toLowerCase();
  return (props.files || []).filter(file => {
    if (term && !file.name.toLowerCase().includes(term)) return false;
    return true;
  });
});

const fileCountLabel = computed(() => {
  const total = props.files.length;
  if (!total) return t('filesystem.noFiles');
  return t('filesystem.fileCount', { count: total });
});
const fileCountFilteredLabel = computed(() => t('filesystem.fileCountFiltered', { filtered: filteredFiles.value.length, total: props.files.length }));

watch([fileSearch, () => props.files.length], () => {
  filesPage.value = 1;
});

const error = computed(() => props.error || null);
const readOnly = computed(() => props.readOnly);
const readOnlyMessage = computed(() => {
  const detail = props.readOnlyReason || t('filesystem.readOnlyDefault');
  return t('filesystem.readOnly', { fs: props.fsLabel, detail });
});
const newFolderDialog = ref(false);
const newFolderName = ref('');

function toPreviewInfo(value) {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    return { mode: value };
  }
  if (value === true) {
    return { mode: 'text' };
  }
  if (typeof value === 'object' && value.mode) {
    return value;
  }
  return null;
}

function getPreviewInfo(name) {
  if (!name) {
    return null;
  }
  if (typeof props.getFilePreviewInfo === 'function') {
    const info = toPreviewInfo(props.getFilePreviewInfo(name));
    if (info) {
      return info;
    }
  }
  if (typeof props.isFileViewable === 'function') {
    return toPreviewInfo(props.isFileViewable(name));
  }
  return null;
}

function isViewable(name) {
  return Boolean(getPreviewInfo(name));
}

function previewIcon(name) {
  const info = getPreviewInfo(name);
  if (info?.mode === 'audio') {
    return 'mdi-headphones';
  }
  return 'mdi-eye';
}

function previewLabel(name) {
  const info = getPreviewInfo(name);
  if (info?.mode === 'audio') {
    return t('filesystem.listen');
  }
  return t('filesystem.view');
}

function formatSize(bytes) {
  if (!Number.isFinite(bytes)) return '';
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let val = bytes;
  let idx = 0;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx += 1;
  }
  const formatted = val % 1 === 0 ? val.toFixed(0) : val.toFixed(1);
  return `${formatted} ${units[idx]}`;
}

const diskVersion = computed(() => props.diskVersion);
const diskVersionLabel = computed(() => {
  if (!diskVersion.value) return '';
  const formatter = props.formatDiskVersion;
  if (typeof formatter !== 'function') return String(diskVersion.value);
  return formatter(diskVersion.value);
});

function triggerRestore() {
  const input = restoreInput.value;
  if (input) {
    input.value = '';
    input.click();
  }
}

function handleRestoreFile(event) {
  const [file] = event.target.files || [];
  if (!file) return;
  emit('restore', file);
}

function handleDragOver() {
  if (props.readOnly || !props.hasClient || props.loading || props.busy || props.saving) return;
  dragActive.value = true;
}

function handleDragLeave() {
  dragActive.value = false;
}

function handleDrop(event) {
  if (props.readOnly || !props.hasClient || props.loading || props.busy || props.saving) return;
  dragActive.value = false;
  const items = Array.from(event.dataTransfer?.items ?? []);
  const files = Array.from(event.dataTransfer?.files ?? []);
  if (!items.length && !files.length) return;
  processDroppedItems(items, files);
}

async function processDroppedItems(items, fallbackFiles = []) {
  emit('reset-upload-block');
  const entryMap = new Map(); // path -> payload
  const filesForSizeCheck = [];
  let sawDirectory = false;

  async function readAllEntries(reader) {
    const out = [];
    async function readChunk() {
      const entries = await new Promise((resolve, reject) => {
        reader.readEntries(resolve, reject);
      });
      if (entries.length) {
        out.push(...entries);
        await readChunk();
      }
    }
    await readChunk();
    return out;
  }

  async function traverseEntry(entry, pathPrefix = '') {
    if (!entry) return;
    if (entry.isFile) {
      const file = await new Promise(resolve => entry.file(resolve));
      const relPath = pathPrefix ? `${pathPrefix}/${file.name}` : file.name;
      entryMap.set(relPath, { file, path: relPath });
      filesForSizeCheck.push({ size: file.size, path: relPath });
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const entries = await readAllEntries(reader);
      const prefix = pathPrefix ? `${pathPrefix}/${entry.name}` : entry.name;
      // always record the directory itself so the parent can create/skip it
      if (!entryMap.has(prefix)) {
        entryMap.set(prefix, { file: null, path: prefix, isDir: true });
      }
      for (const child of entries) {
        await traverseEntry(child, prefix);
      }
      sawDirectory = true;
    }
  }

  for (const item of items) {
    const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
    if (entry) {
      await traverseEntry(entry);
    } else {
      const file = item.getAsFile();
      if (file) {
        entryMap.set(file.name, { file, path: file.name });
        filesForSizeCheck.push({ size: file.size, path: file.name });
      }
    }
  }

  // Always merge plain FileList to catch items not exposed via webkit entries
  if (!sawDirectory && fallbackFiles.length) {
    entryMap.clear();
    filesForSizeCheck.length = 0;
    for (const file of fallbackFiles) {
      entryMap.set(file.name, { file, path: file.name });
      filesForSizeCheck.push({ size: file.size, path: file.name });
    }
  } else if (!sawDirectory) {
    for (const file of fallbackFiles) {
      if (!entryMap.has(file.name)) {
        entryMap.set(file.name, { file, path: file.name });
        filesForSizeCheck.push({ size: file.size, path: file.name });
      }
    }
  }

  console.info(
    '[ESPConnect-LittleFS] drop items:',
    Array.from(entryMap.values()).map(e => `${e.isDir ? 'dir' : 'file'} ${e.path}`),
    'totalFiles:',
    filesForSizeCheck.length,
    'rawItems:',
    items.length,
    'fallbackFiles:',
    fallbackFiles.length,
  );

  for (const entry of entryMap.values()) {
    emit('upload-file', { ...entry });
  }
}

function submitUpload() {
  if (!uploadFile.value) return;
  emit('reset-upload-block');
  emit('upload-file', { file: uploadFile.value, path: uploadFile.value.name });
  uploadFile.value = null;
}

function promptNewFolder() {
  newFolderName.value = '';
  newFolderDialog.value = true;
}

function confirmNewFolder() {
  const name = newFolderName.value?.trim();
  if (!name) {
    newFolderDialog.value = false;
    return;
  }
  emit('new-folder', name);
  newFolderDialog.value = false;
}
</script>

<style scoped>
.filesystem-manager {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.filesystem-manager__controls {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.filesystem-load-cancelled {
  margin-bottom: 0;
}

.filesystem-usage {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.filesystem-pathbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.filesystem-pathbar__breadcrumbs {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.filesystem-breadcrumbs {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.filesystem-table__toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.filesystem-table__filter {
  min-width: 240px;
  max-width: 320px;
}

.filesystem-table__filter--type {
  min-width: 200px;
}

.filesystem-table__actions {
  display: inline-flex;
  gap: 6px;
}

.filesystem-table__label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 320px;
}

.filesystem-link {
  cursor: pointer;
  text-decoration: underline;
}

.filesystem-dropzone__hint {
  display: flex;
  align-items: center;
  gap: 8px;
  color: color-mix(in srgb, var(--v-theme-on-surface) 82%, transparent);
}

.filesystem-dropzone__hint-text {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}
</style>

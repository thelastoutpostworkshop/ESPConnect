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
        <v-select :items="partitions" item-title="label" item-value="id" density="comfortable" label="Partition name"
          :model-value="selectedPartitionId" :disabled="loading || busy || saving || !partitions.length"
          @update:model-value="value => emit('select-partition', value)" />
        <div class="filesystem-manager__controls">
          <v-btn color="primary" variant="tonal" :disabled="!hasPartition || loading || busy || saving"
            @click="emit('refresh')">
            <v-icon start>mdi-refresh</v-icon>
            Read
          </v-btn>
          <v-btn color="secondary" variant="outlined" :disabled="!hasPartition || loading || busy || saving"
            @click="emit('backup')">
            <v-icon start>mdi-content-save</v-icon>
            Backup
          </v-btn>
          <v-btn color="secondary" variant="text" :disabled="!hasPartition || loading || busy || saving"
            @click="triggerRestore">
            <v-icon start>mdi-upload</v-icon>
            Restore Image
          </v-btn>
          <v-btn color="error" variant="text"
            :disabled="readOnly || !hasClient || loading || busy || saving || !backupDone" @click="emit('format')">
            <v-icon start>mdi-delete-sweep</v-icon>
            Format
          </v-btn>
          <v-spacer />
          <v-btn color="primary" variant="elevated"
            :disabled="readOnly || !dirty || !backupDone || saving || loading || busy || !hasClient"
            @click="emit('save')">
            <v-icon start>mdi-content-save-outline</v-icon>
            Save to Flash
          </v-btn>
        </div>
        <v-alert v-if="!backupDone" type="warning" variant="tonal" density="comfortable" border="start" class="mt-2">
          Download a backup image first (use the "Backup" button once per session). "Save to Flash"
          becomes available after any successful backup made during this connection.
        </v-alert>
        <p class="text-caption text-medium-emphasis mb-0">
          Changes are staged locally until you click "Save to Flash". A recent backup ensures you can
          recover if something goes wrong.
        </p>
      </v-card-text>
    </v-card>

    <v-alert v-if="showLoadCancelledBanner" type="warning" variant="tonal" density="comfortable" border="start"
      class="filesystem-load-cancelled">
      {{ loadCancelledMessage }}
    </v-alert>

    <v-card v-else :variant="dragActive ? 'outlined' : 'tonal'">
      <v-card-title class="d-flex align-center justify-space-between">
        <span>Files</span>
        <v-chip v-if="dirty" color="warning" size="large" variant="tonal">
          Unsaved changes
        </v-chip>
      </v-card-title>
      <v-card-text>
        <div v-if="usage?.capacityBytes" class="filesystem-usage">
          <div class="">
            <span>Used {{ usagePercent }}% ({{ formatSize(usage.usedBytes) }} / {{ formatSize(usage.capacityBytes) }})</span>
            <span></span>
          </div>
          <v-progress-linear :model-value="usagePercent" height="15" rounded color="primary" />
          <div class="text-caption text-medium-emphasis">
            Free {{ formatSize(usage.freeBytes) }}
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
                <v-file-input v-model="uploadFile" density="comfortable" accept="*/*" label="Select file"
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
                  Upload
                </v-btn>
              </div>
            </v-col>
            <v-col>
              <div @dragover.prevent="handleDragOver" @dragleave.prevent="handleDragLeave" @drop.prevent="handleDrop">
                <div class="filesystem-dropzone__hint">
                  <v-icon size="32">mdi-cloud-upload-outline</v-icon>
                  <div class="filesystem-dropzone__hint-text">
                    <strong>Drop files to add</strong>
                  </div>
                </div>
              </div>
            </v-col>
          </v-row>
        </div>

        <v-divider :thickness="2" class="mt-3"></v-divider>
        <div v-if="files.length" class="filesystem-table__toolbar mt-4">
          <v-text-field v-model="fileSearch" label="Filter files" variant="outlined" density="comfortable" clearable
            hide-details prepend-inner-icon="mdi-magnify"
            class="filesystem-table__filter filesystem-table__filter--search" />
          <v-select v-model="fileTypeFilter" :items="fileFilterOptions" item-title="label" item-value="value"
            label="File type" density="comfortable" hide-details variant="outlined"
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
                :aria-label="`View ${item.name}`" :disabled="!isFileViewable(item.name)" @click="emit('view-file', item.path)">
                <v-icon size="18">mdi-eye</v-icon>
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
                  {{ filteredFiles.length === files.length ? fileCountLabel : `${filteredFiles.length} of ${files.length} files` }}
                </template>
                <template v-else>
                  <v-alert type="warning" variant="tonal" border="start"> No files match the current filter</v-alert>
                </template>
              </div>
              <div class="d-flex align-center gap-2">
                <v-select v-model="filesPerPage" :items="filesPerPageOptions" density="compact" hide-details
                  style="max-width: 140px" />
                <span class="text-caption text-medium-emphasis">Items per page:</span>
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
          New Folder
        </v-card-title>
        <v-card-text>
          <v-text-field v-model="newFolderName" label="Folder name" autofocus clearable />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="newFolderDialog = false">Cancel</v-btn>
          <v-btn color="primary" variant="tonal" :disabled="!newFolderName?.trim()" @click="confirmNewFolder">
            Create
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';

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

const headers = [
  { title: 'Name', key: 'name', sortable: true, align: 'start' },
  { title: 'Size', key: 'size', sortable: true, align: 'start' },
  { title: 'Actions', key: 'actions', sortable: false, align: 'end' },
];
const filesPerPageOptions = Object.freeze([10, 25, 50, { value: -1, title: 'All' }]);
const FILE_CATEGORY_LABELS = {
  all: 'All types',
  text: 'Text',
  image: 'Images',
  audio: 'Audio',
  other: 'Other',
};

const fileFilterOptions = computed(() => [
  { label: `${FILE_CATEGORY_LABELS.all} (${props.files.length})`, value: 'all' },
]);

const partitionHeading = computed(() => props.partitionTitle || `${props.fsLabel} Partition`);
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
  if (!total) return 'No files';
  const pluralize = count => (count === 1 ? 'file' : 'files');
  return `${total} ${pluralize(total)}`;
});

watch([fileSearch, () => props.files.length], () => {
  filesPage.value = 1;
});

const error = computed(() => props.error || null);
const readOnly = computed(() => props.readOnly);
const readOnlyMessage = computed(() => props.readOnlyReason || 'This filesystem is read-only.');
const newFolderDialog = ref(false);
const newFolderName = ref('');

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
      if (!entries.length) {
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

<template>
  <div class="filesystem-manager" @dragover.prevent="handleDragOver" @dragleave.prevent="handleDragLeave"
    @drop.prevent="handleDrop">
    <v-alert v-if="error" type="error" variant="tonal" density="comfortable" border="start" class="mb-3">
      {{ error }}
    </v-alert>
    <v-alert v-else-if="readOnly" type="warning" variant="tonal" density="comfortable" border="start" class="mb-3">
      {{ readOnlyMessage }}
    </v-alert>

    <v-card variant="tonal" prepend-icon="mdi-folder-wrench">
      <template v-slot:title>
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
          <div class="">
            <span>{{ $t('filesystem.usedLabel', { percent: usagePercent, used: formatSize(usage.usedBytes), capacity: formatSize(usage.capacityBytes) }) }}</span>
            <span></span>
          </div>
          <v-progress-linear :model-value="usagePercent" height="15" rounded color="primary" />
          <div class="text-caption text-medium-emphasis">
            {{ $t('filesystem.freeLabel', { free: formatSize(usage.freeBytes) }) }}
          </div>
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
                    <strong>{{ $t('filesystem.dropAddSimple') }}</strong>
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
          <v-chip size="large" variant="tonal" color="primary">
            {{ filteredCountLabel }}
          </v-chip>
        </div>
        <v-data-table :headers="fileTableHeaders" :items="filteredFiles" item-key="name"
          v-model:items-per-page="filesPerPage" v-model:page="filesPage" :items-per-page-options="filesPerPageOptions"
          density="compact" class="filesystem-table mt-4">
          <template #item.name="{ item }">
            <code>{{ unwrapItem(item).name }}</code>
          </template>
          <template #item.size="{ item }">
            {{ formatSize(unwrapItem(item).size) }}
          </template>
          <template #item.actions="{ item }">
            <div class="d-flex ga-2 justify-end">
              <v-icon size="small" variant="text" color="info" v-if="enablePreview && isViewable(unwrapItem(item).name)"
                :disabled="loading || busy || saving || readOnly" :icon="previewIcon(unwrapItem(item).name)"
                :title="previewLabel(unwrapItem(item).name)" :aria-label="previewLabel(unwrapItem(item).name)"
                @click="emit('view-file', unwrapItem(item).name)" />
              <v-icon size="small" variant="text" color="primary" v-if="enableDownload"
                :disabled="loading || busy || saving || readOnly" icon="mdi-download"
                :title="$t('filesystem.download', { name: unwrapItem(item).name })" :aria-label="$t('filesystem.download', { name: unwrapItem(item).name })"
                @click="emit('download-file', unwrapItem(item).name)" />
              <v-icon size="small" variant="text" color="error" :disabled="readOnly || loading || busy || saving"
                icon="mdi-delete" :title="$t('filesystem.delete', { name: unwrapItem(item).name })"
                :aria-label="$t('filesystem.delete', { name: unwrapItem(item).name })" @click="emit('delete-file', unwrapItem(item).name)" />
            </div>
          </template>
          <template #no-data>
            <div v-if="files.length">
              <v-alert type="warning" variant="tonal" border="start"> {{ $t('filesystem.noMatch') }}</v-alert>
            </div>
            <div v-else>
              <v-alert type="info" variant="tonal" border="start"> {{ emptyMessage }}</v-alert>
            </div>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <input ref="restoreInput" type="file" class="d-none" @change="handleRestoreFile" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps({
  partitions: {
    type: Array,
    default: () => [],
  },
  selectedPartitionId: {
    type: [Number, String, null],
    default: null,
  },
  files: {
    type: Array,
    default: () => [],
  },
  status: {
    type: String,
    default: '',
  },
  loading: Boolean,
  busy: Boolean,
  saving: Boolean,
  readOnly: Boolean,
  readOnlyReason: {
    type: String,
    default: '',
  },
  dirty: Boolean,
  backupDone: Boolean,
  error: {
    type: String,
    default: null,
  },
  hasPartition: Boolean,
  hasClient: Boolean,
  usage: {
    type: Object,
    default: () => ({
      capacityBytes: 0,
      usedBytes: 0,
      freeBytes: 0,
    }),
  },
  uploadBlocked: Boolean,
  uploadBlockedReason: {
    type: String,
    default: '',
  },
  isFileViewable: {
    type: Function,
    default: () => false,
  },
  getFilePreviewInfo: {
    type: Function,
    default: null,
  },
  fsLabel: {
    type: String,
    default: 'SPIFFS',
  },
  partitionTitle: {
    type: String,
    default: '',
  },
  emptyStateMessage: {
    type: String,
    default: '',
  },
  enablePreview: {
    type: Boolean,
    default: true,
  },
  enableDownload: {
    type: Boolean,
    default: true,
  },
  loadCancelled: {
    type: Boolean,
    default: false,
  },
});

const fileTableHeaders = computed(() => (
  [
    { title: t('filesystem.columns.name'), key: 'name', sortable: true, align: 'start' as const },
    { title: t('filesystem.columns.size'), key: 'size', sortable: true, align: 'start' as const },
    { title: t('filesystem.columns.actions'), key: 'actions', sortable: false, align: 'end' as const },
  ] as const
));
const filesPerPageOptions = computed(() => Object.freeze([10, 25, 50, { value: -1, title: t('filesystem.all') }]));
const FALLBACK_TEXT_EXT = ['txt', 'log', 'json', 'csv', 'ini', 'cfg', 'conf', 'htm', 'html', 'md', 'xml'];
const FALLBACK_IMAGE_EXT = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'];
const FALLBACK_AUDIO_EXT = ['mp3', 'wav', 'ogg', 'oga', 'opus', 'm4a', 'aac', 'flac', 'weba', 'webm'];
const FILE_CATEGORY_LABELS = computed(() => ({
  all: t('filesystem.allTypes'),
  text: t('filesystem.text'),
  image: t('filesystem.image'),
  audio: t('filesystem.audio'),
  other: t('filesystem.other'),
}));

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
]);

const uploadFile = ref(null);
const dropQueue = ref([]);
const restoreInput = ref(null);
const fileSearch = ref('');
const filesPerPage = ref(25);
const filesPage = ref(1);
const fileTypeFilter = ref('all');
const fsLabel = computed(() => (props.fsLabel && props.fsLabel.trim()) || 'SPIFFS');
const selectedPartition = computed(() =>
  props.partitions.find(partition => partition.id === props.selectedPartitionId) ?? null,
);
const partitionHeading = computed(() => {
  const sizeLabel = selectedPartition.value?.sizeText?.trim();
  const base = props.partitionTitle?.trim() || t('filesystem.partitionHeading', { fs: fsLabel.value });
  return sizeLabel ? `${base} · ${sizeLabel}` : base;
});
const emptyMessage = computed(
  () => props.emptyStateMessage?.trim() || t('filesystem.noFilesDetected', { fs: fsLabel.value }),
);
const showLoadCancelledBanner = computed(() => props.loadCancelled && !props.loading);
const loadCancelledMessage = computed(
  () => t('filesystem.loadCancelled', { fs: fsLabel.value }),
);
const readOnlyMessage = computed(() => {
  const detail = props.readOnlyReason?.trim();
  const fallback = t('filesystem.readOnlyDefault');
  return t('filesystem.readOnly', { fs: fsLabel.value, detail: detail || fallback });
});
const usagePercent = computed(() => {
  if (!props.usage || !props.usage.capacityBytes) {
    return 0;
  }
  const ratio = props.usage.usedBytes / props.usage.capacityBytes;
  if (!Number.isFinite(ratio) || ratio < 0) {
    return 0;
  }
  return Math.min(100, Math.round(ratio * 100));
});
const dragActive = ref(false);
const autoUploadPending = ref(false);
const fileFilterOptions = computed(() => {
  const counts = props.files.reduce((acc, file) => {
    const category = getFileCategory(file?.name);
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {});
  const options = [
    {
      value: 'all',
      label: `${FILE_CATEGORY_LABELS.value.all} (${props.files.length})`,
    },
  ];
  for (const [key, label] of Object.entries(FILE_CATEGORY_LABELS.value)) {
    if (key === 'all') continue;
    if (counts[key]) {
      options.push({
        value: key,
        label: `${label} (${counts[key]})`,
      });
    }
  }
  return options;
});

const filteredFiles = computed(() => {
  const query = (fileSearch.value || '').trim().toLowerCase();
  const typeFilter = fileTypeFilter.value;
  return props.files.filter(file => {
    const name = file?.name || '';
    if (typeFilter !== 'all' && getFileCategory(name) !== typeFilter) {
      return false;
    }
    if (!query) {
      return true;
    }
    return name.toLowerCase().includes(query);
  });
});
const filteredCountLabel = computed(() => {
  const total = props.files.length;
  const filtered = filteredFiles.value.length;
  if (!total) {
    return t('filesystem.noFiles');
  }
  if (filtered === total) {
    return t('filesystem.fileCount', { count: total });
  }
  return t('filesystem.fileCountFiltered', { filtered, total });
});
const canUpload = computed(
  () =>
    !props.readOnly &&
    props.hasClient &&
    !props.loading &&
    !props.busy &&
    !props.saving,
);

watch(uploadFile, file => {
  emit('validate-upload', file || null);
});

watch(
  () => [uploadFile.value, props.uploadBlocked, autoUploadPending.value],
  ([file, blocked, auto]) => {
    if (file && !blocked && auto) {
      submitUpload(true);
    }
  },
  { flush: 'post' },
);

watch(
  () => props.uploadBlocked,
  blocked => {
    if (blocked) {
      if (autoUploadPending.value) {
        uploadFile.value = null;
      }
      autoUploadPending.value = false;
    } else {
      scheduleNextDropUpload();
    }
  },
);

watch(
  () => canUpload.value,
  value => {
    if (value) {
      scheduleNextDropUpload();
    }
  },
);

watch([fileSearch, fileTypeFilter, () => props.files.length], () => {
  filesPage.value = 1;
});

watch(fileFilterOptions, options => {
  const values = options.map(option => option.value);
  if (!values.includes(fileTypeFilter.value)) {
    fileTypeFilter.value = 'all';
  }
});

function submitUpload(auto = false) {
  if (!uploadFile.value || props.uploadBlocked) return;
  if (auto) {
    autoUploadPending.value = false;
  }
  emit('upload-file', { file: uploadFile.value });
  uploadFile.value = null;
  autoUploadPending.value = false;
  scheduleNextDropUpload();
}

function triggerRestore() {
  restoreInput.value?.click();
}

function handleRestoreFile(event) {
  const [file] = event.target.files || [];
  if (file) {
    emit('restore', file);
  }
  event.target.value = '';
}

function handleDragOver(event) {
  if (!canUpload.value) {
    event.dataTransfer.dropEffect = 'none';
    dragActive.value = false;
    return;
  }
  event.dataTransfer.dropEffect = 'copy';
  dragActive.value = true;
}

function handleDragLeave(event) {
  if (event.currentTarget && event.relatedTarget && event.currentTarget.contains(event.relatedTarget)) {
    return;
  }
  dragActive.value = false;
}

function handleDrop(event) {
  dragActive.value = false;
  if (!canUpload.value) return;
  const files = Array.from(event.dataTransfer?.files ?? []).filter(file => file instanceof File);
  if (!files.length) return;
  dropQueue.value.push(...files);
  scheduleNextDropUpload();
}

function scheduleNextDropUpload() {
  if (uploadFile.value || props.uploadBlocked || !canUpload.value) {
    return;
  }
  const next = dropQueue.value.shift();
  if (!next) {
    return;
  }
  uploadFile.value = next;
  autoUploadPending.value = true;
}

function formatSize(size) {
  if (!Number.isFinite(size)) return '-';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function unwrapItem(item) {
  if (!item || typeof item !== 'object') {
    return {};
  }
  if ('raw' in item && item.raw && typeof item.raw === 'object') {
    return item.raw;
  }
  return item;
}

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

function normalizeExtension(name = '') {
  if (typeof name !== 'string') {
    return '';
  }
  const idx = name.lastIndexOf('.');
  if (idx === -1) {
    return '';
  }
  return name.slice(idx + 1).toLowerCase();
}

function getFileCategory(name = '') {
  const info = getPreviewInfo(name);
  if (info?.mode === 'text') return 'text';
  if (info?.mode === 'image') return 'image';
  if (info?.mode === 'audio') return 'audio';
  const ext = normalizeExtension(name);
  if (FALLBACK_TEXT_EXT.includes(ext)) return 'text';
  if (FALLBACK_IMAGE_EXT.includes(ext)) return 'image';
  if (FALLBACK_AUDIO_EXT.includes(ext)) return 'audio';
  return 'other';
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
</script>


<style scoped>
.filesystem-manager {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.filesystem-manager__controls {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.upload-row {
  display: grid;
  gap: 12px;
}

.upload-row--split {
  align-items: stretch;
}

.upload-picker {
  display: grid;
  gap: 12px;
}

@media (min-width: 960px) {
  .upload-row {
    grid-template-columns: 1fr auto;
    align-items: end;
  }

  .upload-row--split {
    grid-template-columns: 1fr 1fr;
  }

  .upload-row__cta {
    align-self: center;
  }
}

.filesystem-usage {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.filesystem-usage__labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  color: rgb(var(--v-theme-on-surface));
  opacity: 0.7;
}

.filesystem-table code {
  font-size: 0.85rem;
}

.filesystem-table__toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.filesystem-table__filter {
  flex: 1;
  max-width: 360px;
}

.filesystem-table__filter--type {
  flex: 0 0 auto;
  min-width: 180px;
  max-width: 220px;
}

.filesystem-table__actions {
  display: flex;
  gap: 4px;
}

.filesystem-table__empty {
  padding: 32px 0;
  text-align: center;
  color: color-mix(in srgb, var(--v-theme-on-surface) 70%, transparent);
}

.filesystem-load-cancelled {
  width: 100%;
}

.filesystem-dropzone {
  position: relative;
  border: 2px dashed transparent;
  border-radius: 12px;
  transition: border-color 0.2s ease, background-color 0.2s ease;
  align-items: center;
  justify-content: center;
}

.filesystem-dropzone__overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  color: color-mix(in srgb, var(--v-theme-primary) 80%, #ffffff 20%);
  pointer-events: none;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.filesystem-dropzone__hint {
  display: flex;
  align-items: center;
  gap: 12px;
  color: color-mix(in srgb, var(--v-theme-on-surface) 80%, transparent);
}

.filesystem-dropzone__hint-text {
  display: flex;
  flex-direction: column;
  font-size: 0.9rem;
  text-transform: none;
}
</style>

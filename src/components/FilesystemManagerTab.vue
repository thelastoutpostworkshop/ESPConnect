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
          Changes are staged locally until you click “Save to Flash”. A recent backup ensures you can
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
            <span>Used {{ usagePercent }}% ({{ formatSize(usage.usedBytes) }} / {{ formatSize(usage.capacityBytes)
            }})</span>
            <span></span>
          </div>
          <v-progress-linear :model-value="usagePercent" height="15" rounded color="primary" />
          <div class="text-caption text-medium-emphasis">
            Free {{ formatSize(usage.freeBytes) }}
          </div>
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
                :title="`Download ${unwrapItem(item).name}`" :aria-label="`Download ${unwrapItem(item).name}`"
                @click="emit('download-file', unwrapItem(item).name)" />
              <v-icon size="small" variant="text" color="error" :disabled="readOnly || loading || busy || saving"
                icon="mdi-delete" :title="`Delete ${unwrapItem(item).name}`"
                :aria-label="`Delete ${unwrapItem(item).name}`" @click="emit('delete-file', unwrapItem(item).name)" />
            </div>
          </template>
          <template #no-data>
            <div v-if="files.length">
              <v-alert type="warning" variant="tonal" border="start"> No files match the current filter</v-alert>
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
import type { DataTableHeader } from 'vuetify';
import type {
  FilePreviewInfo,
  FilePreviewInfoResolver,
  FilePreviewMode,
  FilesystemEntry,
  FilesystemPartitionOption,
  FilesystemUploadPayload,
  FilesystemUsage,
  PartitionId,
} from '../types/filesystem';

type FileCategory = 'all' | 'text' | 'image' | 'audio' | 'other';
type FileFilterOption = { value: FileCategory; label: string };
type DataTableSlotItem<T> = { raw?: T };
type FilesystemTableEntry = FilesystemEntry & { name: string; size: number };

const props = withDefaults(
  defineProps<{
    partitions?: FilesystemPartitionOption[];
    selectedPartitionId?: PartitionId | null;
    files?: FilesystemEntry[];
    status?: string;
    loading?: boolean;
    busy?: boolean;
    saving?: boolean;
    readOnly?: boolean;
    readOnlyReason?: string;
    dirty?: boolean;
    backupDone?: boolean;
    error?: string | null;
    hasPartition?: boolean;
    hasClient?: boolean;
    usage?: FilesystemUsage;
    uploadBlocked?: boolean;
    uploadBlockedReason?: string;
    isFileViewable?: FilePreviewInfoResolver;
    getFilePreviewInfo?: FilePreviewInfoResolver | null;
    fsLabel?: string;
    partitionTitle?: string;
    emptyStateMessage?: string;
    enablePreview?: boolean;
    enableDownload?: boolean;
    loadCancelled?: boolean;
  }>(),
  {
    partitions: () => [],
    selectedPartitionId: null,
    files: () => [],
    status: '',
    loading: false,
    busy: false,
    saving: false,
    readOnly: false,
    readOnlyReason: '',
    dirty: false,
    backupDone: false,
    error: null,
    hasPartition: false,
    hasClient: false,
    usage: () => ({
      capacityBytes: 0,
      usedBytes: 0,
      freeBytes: 0,
    }),
    uploadBlocked: false,
    uploadBlockedReason: '',
    isFileViewable: () => false,
    getFilePreviewInfo: null,
    fsLabel: 'SPIFFS',
    partitionTitle: '',
    emptyStateMessage: '',
    enablePreview: true,
    enableDownload: true,
    loadCancelled: false,
  },
);

const fileTableHeaders = Object.freeze<DataTableHeader[]>([
  { title: 'Name', key: 'name', sortable: true, align: 'start' },
  { title: 'Size', key: 'size', sortable: true, align: 'start' },
  { title: 'Actions', key: 'actions', sortable: false, align: 'end' },
]);
const filesPerPageOptions = Object.freeze<Array<number | { value: number; title: string }>>([
  10,
  25,
  50,
  { value: -1, title: 'All' },
]);
const FALLBACK_TEXT_EXT = ['txt', 'log', 'json', 'csv', 'ini', 'cfg', 'conf', 'htm', 'html', 'md', 'xml'];
const FALLBACK_IMAGE_EXT = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'];
const FALLBACK_AUDIO_EXT = ['mp3', 'wav', 'ogg', 'oga', 'opus', 'm4a', 'aac', 'flac', 'weba', 'webm'];
const FILE_CATEGORY_LABELS: Record<FileCategory, string> = {
  all: 'All types',
  text: 'Text',
  image: 'Images',
  audio: 'Audio',
  other: 'Other',
};
const FILE_FILTER_CATEGORIES: Array<Exclude<FileCategory, 'all'>> = ['text', 'image', 'audio', 'other'];

const emit = defineEmits<{
  (e: 'select-partition', value: PartitionId | null): void;
  (e: 'refresh'): void;
  (e: 'backup'): void;
  (e: 'restore', file: File): void;
  (e: 'download-file', name: string): void;
  (e: 'view-file', name: string): void;
  (e: 'validate-upload', file: File | null): void;
  (e: 'upload-file', payload: FilesystemUploadPayload): void;
  (e: 'delete-file', name: string): void;
  (e: 'format'): void;
  (e: 'save'): void;
}>();

const uploadFile = ref<File | null>(null);
const dropQueue = ref<File[]>([]);
const restoreInput = ref<HTMLInputElement | null>(null);
const fileSearch = ref('');
const filesPerPage = ref(25);
const filesPage = ref(1);
const fileTypeFilter = ref<FileCategory>('all');
const fsLabel = computed(() => (props.fsLabel && props.fsLabel.trim()) || 'SPIFFS');
const selectedPartition = computed<FilesystemPartitionOption | null>(() =>
  props.partitions.find(partition => partition.id === props.selectedPartitionId) ?? null,
);
const partitionHeading = computed(() => {
  const sizeLabel = selectedPartition.value?.sizeText?.trim();
  const base = props.partitionTitle?.trim() || `${fsLabel.value} Partition`;
  return sizeLabel ? `${base} · ${sizeLabel}` : base;
});
const emptyMessage = computed(
  () => props.emptyStateMessage?.trim() || `No files detected. Upload or restore a ${fsLabel.value} image to begin.`,
);
const showLoadCancelledBanner = computed(() => props.loadCancelled && !props.loading);
const loadCancelledMessage = computed(
  () => `${fsLabel.value} load cancelled. Use "Read" to fetch the partition again.`,
);
const readOnlyMessage = computed(() => {
  const detail = props.readOnlyReason?.trim();
  return `${fsLabel.value} is in read-only mode. ${detail || 'Changes cannot be saved.'}`;
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
const fileFilterOptions = computed<FileFilterOption[]>(() => {
  const counts: Partial<Record<Exclude<FileCategory, 'all'>, number>> = {};
  for (const file of props.files) {
    const category = getFileCategory(file?.name);
    counts[category] = (counts[category] ?? 0) + 1;
  }

  const options: FileFilterOption[] = [
    {
      value: 'all',
      label: `${FILE_CATEGORY_LABELS.all} (${props.files.length})`,
    },
  ];

  for (const category of FILE_FILTER_CATEGORIES) {
    const count = counts[category] ?? 0;
    if (count) {
      options.push({
        value: category,
        label: `${FILE_CATEGORY_LABELS[category]} (${count})`,
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
  const pluralize = (count: number) => (count === 1 ? 'file' : 'files');
  if (!total) {
    return 'No files';
  }
  if (filtered === total) {
    return `${total} ${pluralize(total)}`;
  }
  return `${filtered} of ${total} files`;
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
  emit('validate-upload', file ?? null);
});

watch(
  () => [uploadFile.value, props.uploadBlocked, autoUploadPending.value] as const,
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
  const file = uploadFile.value;
  if (!file || props.uploadBlocked) return;
  if (auto) {
    autoUploadPending.value = false;
  }
  emit('upload-file', { file });
  uploadFile.value = null;
  autoUploadPending.value = false;
  scheduleNextDropUpload();
}

function triggerRestore() {
  restoreInput.value?.click();
}

function handleRestoreFile(event: Event) {
  const input = event.target instanceof HTMLInputElement ? event.target : null;
  const file = input?.files?.[0] ?? null;
  if (file) {
    emit('restore', file);
  }
  if (input) {
    input.value = '';
  }
}

function handleDragOver(event: DragEvent) {
  const transfer = event.dataTransfer;
  if (!canUpload.value) {
    if (transfer) {
      transfer.dropEffect = 'none';
    }
    dragActive.value = false;
    return;
  }
  if (transfer) {
    transfer.dropEffect = 'copy';
  }
  dragActive.value = true;
}

function handleDragLeave(event: DragEvent) {
  const current = event.currentTarget;
  const related = event.relatedTarget;
  if (current instanceof Node && related instanceof Node && current.contains(related)) {
    return;
  }
  dragActive.value = false;
}

function handleDrop(event: DragEvent) {
  dragActive.value = false;
  if (!canUpload.value) return;
  const files = Array.from(event.dataTransfer?.files ?? []).filter((file): file is File => file instanceof File);
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

function formatSize(size: unknown): string {
  const value = typeof size === 'number' ? size : Number(size);
  if (!Number.isFinite(value)) return '-';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

function unwrapItem(item: unknown): FilesystemTableEntry {
  let entry: FilesystemEntry = {};
  if (item && typeof item === 'object') {
    const raw = (item as DataTableSlotItem<FilesystemEntry>).raw;
    if (raw && typeof raw === 'object') {
      entry = raw;
    } else {
      entry = item as FilesystemEntry;
    }
  }
  const name = typeof entry.name === 'string' ? entry.name : '';
  const sizeValue = typeof entry.size === 'number' ? entry.size : Number(entry.size);
  const size = Number.isFinite(sizeValue) ? sizeValue : 0;
  return { ...entry, name, size };
}

function isPreviewMode(value: unknown): value is FilePreviewMode {
  return value === 'text' || value === 'image' || value === 'audio';
}

function toPreviewInfo(value: unknown): FilePreviewInfo | null {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    return isPreviewMode(value) ? { mode: value } : null;
  }
  if (value === true) {
    return { mode: 'text' };
  }
  if (typeof value === 'object' && value !== null && 'mode' in value) {
    const mode = (value as { mode?: unknown }).mode;
    if (!isPreviewMode(mode)) {
      return null;
    }
    const mime = (value as { mime?: unknown }).mime;
    const ext = (value as { ext?: unknown }).ext;
    return {
      mode,
      mime: typeof mime === 'string' ? mime : undefined,
      ext: typeof ext === 'string' ? ext : undefined,
    };
  }
  return null;
}

function getPreviewInfo(name?: string): FilePreviewInfo | null {
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

function getFileCategory(name = ''): Exclude<FileCategory, 'all'> {
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

function isViewable(name?: string): boolean {
  return Boolean(getPreviewInfo(name));
}

function previewIcon(name?: string): string {
  const info = getPreviewInfo(name);
  if (info?.mode === 'audio') {
    return 'mdi-headphones';
  }
  return 'mdi-eye';
}

function previewLabel(name?: string): string {
  const info = getPreviewInfo(name);
  if (info?.mode === 'audio') {
    return 'Listen';
  }
  return 'View';
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

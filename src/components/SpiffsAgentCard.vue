<template>
  <v-card class="spiffs-agent-card" variant="tonal">
    <v-card-title class="card-title">
      <div class="title-left">
        <v-icon class="me-2" size="22">mdi-folder-cog</v-icon>
        <span>SPIFFS Agent</span>
        <v-chip
          v-if="connected"
          class="ms-3"
          :color="running ? 'success' : 'warning'"
          size="small"
          variant="elevated"
        >
          {{ running ? 'Running' : 'Idle' }}
        </v-chip>
      </div>
      <div class="title-actions">
        <v-btn
          color="primary"
          variant="flat"
          density="comfortable"
          prepend-icon="mdi-upload"
          :loading="uploading"
          :disabled="!connected || !stubAvailable || uploading || busy"
          @click="emit('upload-agent')"
        >
          {{ running ? 'Re-upload Agent' : 'Upload Agent' }}
        </v-btn>
        <v-btn
          variant="text"
          color="primary"
          density="comfortable"
          prepend-icon="mdi-refresh"
          :disabled="!running || busy"
          @click="emit('list-files')"
        >
          Refresh
        </v-btn>
        <v-menu v-if="running">
          <template #activator="{ props: menuProps }">
            <v-btn
              v-bind="menuProps"
              variant="text"
              density="comfortable"
              color="primary"
              prepend-icon="mdi-dots-vertical"
              :disabled="busy"
            >
              More
            </v-btn>
          </template>
          <v-list density="compact">
            <v-list-item
              prepend-icon="mdi-database-settings"
              :disabled="busy"
              @click="emit('format')"
            >
              Format SPIFFS
            </v-list-item>
            <v-list-item
              prepend-icon="mdi-power-cycle"
              :disabled="busy"
              @click="emit('reset-agent')"
            >
              Reset Device
            </v-list-item>
          </v-list>
        </v-menu>
      </div>
    </v-card-title>

    <v-card-subtitle class="card-subtitle">
      Interact with the SPIFFS file system on the connected device once the agent stub is running.
    </v-card-subtitle>

    <v-divider />

    <v-card-text>
      <v-alert
        v-if="!connected"
        type="info"
        variant="tonal"
        class="mb-4"
        icon="mdi-usb-off"
      >
        Connect to a device to manage SPIFFS.
      </v-alert>
      <v-alert
        v-else-if="!stubAvailable"
        type="warning"
        variant="tonal"
        class="mb-4"
        icon="mdi-alert-outline"
      >
        No SPIFFS agent stub is available for this chip. Connect an ESP32, ESP32-S2, or ESP8266 to use the file manager.
      </v-alert>

      <v-expand-transition>
        <div v-if="connected && stubAvailable">
          <div class="status-row mb-4" v-if="status || error">
            <v-alert
              v-if="status"
              type="success"
              density="comfortable"
              variant="tonal"
              class="mb-2"
            >
              {{ status }}
            </v-alert>
            <v-alert
              v-if="error"
              type="error"
              density="comfortable"
              variant="tonal"
            >
              {{ error }}
            </v-alert>
          </div>

          <div class="mb-4">
            <v-file-input
              label="Upload file to SPIFFS"
              prepend-icon="mdi-file-upload"
              density="comfortable"
              hide-details
              show-size
              clearable
              :disabled="!running || busy"
              @update:model-value="onFileSelected"
            />
          </div>

          <v-card class="file-table" variant="flat">
            <v-table density="comfortable">
              <thead>
                <tr>
                  <th class="text-start">File</th>
                  <th class="text-start">Size</th>
                  <th class="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="file in files" :key="file.name">
                  <td>
                    <div class="file-name">{{ file.name }}</div>
                  </td>
                  <td>{{ formatSize(file.size) }}</td>
                  <td class="text-end">
                    <v-btn
                      icon
                      variant="text"
                      color="primary"
                      :title="`Preview ${file.name}`"
                      :disabled="busy"
                      @click="emit('read-file', file)"
                    >
                      <v-icon size="20">mdi-eye</v-icon>
                    </v-btn>
                    <v-btn
                      icon
                      variant="text"
                      color="error"
                      :title="`Delete ${file.name}`"
                      :disabled="busy"
                      @click="emit('delete-file', file)"
                    >
                      <v-icon size="20">mdi-delete</v-icon>
                    </v-btn>
                  </td>
                </tr>
                <tr v-if="!files.length">
                  <td colspan="3" class="text-medium-emphasis text-center py-6">
                    {{ running ? 'No files found on the SPIFFS volume.' : 'Start the agent to view files.' }}
                  </td>
                </tr>
              </tbody>
            </v-table>
          </v-card>
        </div>
      </v-expand-transition>
    </v-card-text>
  </v-card>

  <v-dialog v-model="previewOpen" width="640">
    <v-card>
      <v-card-title class="d-flex align-center justify-space-between">
        <div class="d-flex align-center">
          <v-icon class="me-2">mdi-file-eye</v-icon>
          {{ preview?.name }}
        </div>
        <v-btn
          icon
          variant="text"
          color="default"
          @click="handleClosePreview"
        >
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>
      <v-divider />
      <v-card-text>
        <div class="preview-meta mb-3">
          <div><strong>Size:</strong> {{ formatSize(preview?.size || 0) }}</div>
          <div v-if="preview?.isBinary" class="text-medium-emphasis">
            Preview truncated to first {{ preview?.text?.length ?? 0 }} characters (binary content detected).
          </div>
        </div>
        <v-sheet class="preview-sheet" color="surface-variant">
          <pre>{{ preview?.text }}</pre>
        </v-sheet>
      </v-card-text>
      <v-card-actions class="justify-end">
        <v-btn
          v-if="preview?.downloadUrl"
          color="primary"
          prepend-icon="mdi-download"
          :href="preview.downloadUrl"
          :download="preview?.name"
          variant="flat"
        >
          Download
        </v-btn>
        <v-btn variant="text" color="primary" @click="handleClosePreview">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  connected: {
    type: Boolean,
    default: false,
  },
  stubAvailable: {
    type: Boolean,
    default: false,
  },
  running: {
    type: Boolean,
    default: false,
  },
  busy: {
    type: Boolean,
    default: false,
  },
  uploading: {
    type: Boolean,
    default: false,
  },
  status: {
    type: String,
    default: '',
  },
  error: {
    type: String,
    default: '',
  },
  files: {
    type: Array,
    default: () => [],
  },
  preview: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits([
  'upload-agent',
  'list-files',
  'read-file',
  'delete-file',
  'upload-file',
  'format',
  'reset-agent',
  'close-preview',
]);

const previewOpen = computed({
  get: () => Boolean(props.preview),
  set: value => {
    if (!value) {
      emit('close-preview');
    }
  },
});

function onFileSelected(value) {
  const file = Array.isArray(value) ? value[0] : value;
  if (file) {
    emit('upload-file', file);
  }
}

function formatSize(size) {
  if (!Number.isFinite(size) || size < 0) {
    return '—';
  }
  if (size === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  const value = size / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function handleClosePreview() {
  emit('close-preview');
}
</script>

<style scoped>
.spiffs-agent-card {
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--v-theme-primary) 18%, transparent);
}

.card-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.title-left {
  display: flex;
  align-items: center;
  font-weight: 600;
  font-size: 1rem;
}

.title-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.card-subtitle {
  font-size: 0.9rem;
  color: color-mix(in srgb, var(--v-theme-on-surface) 70%, transparent);
}

.file-table {
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--v-theme-on-surface) 12%, transparent);
  overflow: hidden;
}

.file-name {
  font-weight: 500;
  word-break: break-word;
}

.preview-sheet {
  border-radius: 12px;
  padding: 16px;
  max-height: 320px;
  overflow-y: auto;
  font-family: 'Roboto Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  background-color: color-mix(in srgb, var(--v-theme-surface) 85%, transparent);
}

.preview-sheet pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>

<template>
  <v-alert
    type="warning"
    variant="tonal"
    border="start"
    class="mb-4 advanced-warning"
    density="comfortable"
  >
    Firmware tools are intended for advanced users. Writing or erasing flash can permanently remove data or render the device unbootable. Double-check settings before proceeding.
  </v-alert>

  <v-card class="tools-card mb-6" variant="tonal">
    <v-card-title class="tools-card__title">
      <v-icon size="18" class="me-2">mdi-lightning-bolt</v-icon>
      Flash Firmware
    </v-card-title>
    <v-card-text class="tools-card__body">
      <v-row class="mb-2" dense>
        <v-col cols="12" md="8">
          <v-file-input
            label="Firmware binary (.bin)"
            prepend-icon="mdi-file-upload"
            accept=".bin"
            density="comfortable"
            :disabled="busy || maintenanceBusy"
            @update:model-value="value => emit('firmware-input', value)"
          />
        </v-col>
        <v-col cols="12" md="4">
          <v-text-field
            :model-value="flashOffset"
            label="Flash offset"
            placeholder="0x0"
            density="comfortable"
            :disabled="busy || maintenanceBusy"
            @update:model-value="value => emit('update:flashOffset', value)"
          />
        </v-col>
        <v-col cols="12" md="4">
          <v-select
            :model-value="selectedPreset"
            :items="offsetPresets"
            label="Recommended offsets"
            item-title="label"
            item-value="value"
            clearable
            density="comfortable"
            :disabled="busy || maintenanceBusy"
            @update:model-value="value => handlePresetChange(value)"
          />
        </v-col>
      </v-row>

      <v-checkbox
        :model-value="eraseFlash"
        label="Erase entire flash before writing"
        density="comfortable"
        hide-details
        :disabled="busy || maintenanceBusy"
        @update:model-value="value => emit('update:eraseFlash', value)"
      />

      <v-btn
        color="primary"
        size="large"
        block
        class="mt-2"
        :disabled="!canFlash || busy || maintenanceBusy"
        @click="emit('flash')"
      >
        <v-icon start>mdi-lightning-bolt</v-icon>
        Flash Firmware
      </v-btn>
    </v-card-text>
  </v-card>

  <v-card class="tools-card mt-6" variant="tonal">
    <v-card-title class="tools-card__title">
      <v-icon size="18" class="me-2">mdi-archive-arrow-down</v-icon>
      Flash Backup &amp; Erase
    </v-card-title>
    <v-card-text class="tools-card__body">
      <v-row dense>
        <v-col cols="12" md="6">
          <v-text-field
            :model-value="flashReadOffset"
            label="Start offset"
            placeholder="0x0"
            density="comfortable"
            :disabled="busy || maintenanceBusy"
            @update:model-value="value => emit('update:flashReadOffset', value)"
          />
        </v-col>
        <v-col cols="12" md="6">
          <v-text-field
            :model-value="flashReadLength"
            label="Length (bytes)"
            placeholder="0x100000"
            density="comfortable"
            :disabled="busy || maintenanceBusy"
            @update:model-value="value => emit('update:flashReadLength', value)"
          />
        </v-col>
      </v-row>
      <div class="tools-card__actions">
        <v-btn
          color="primary"
          variant="tonal"
          :disabled="busy || maintenanceBusy"
          @click="emit('download-flash')"
        >
          <v-icon start>mdi-download-box</v-icon>
          Download Flash Region
        </v-btn>
        <v-btn
          color="error"
          variant="outlined"
          :disabled="busy || maintenanceBusy"
          @click="emit('erase-flash', { mode: 'full' })"
        >
          <v-icon start>mdi-delete-sweep</v-icon>
          Erase Entire Flash
        </v-btn>
      </div>
      <v-divider v-if="partitionOptions.length" class="my-4" />
      <div v-if="partitionOptions.length" class="partition-tools">
        <v-select
          :model-value="selectedPartition"
          :items="partitionOptions"
          item-title="label"
          item-value="value"
          label="Partition"
          density="comfortable"
          clearable
          :disabled="busy || maintenanceBusy"
          @update:model-value="value => emit('update:selectedPartition', value)"
        />
        <div class="tools-card__actions partition-tools__actions">
          <v-btn
            color="primary"
            variant="tonal"
            :disabled="busy || maintenanceBusy || selectedPartition === null"
            @click="emit('download-partition')"
          >
            <v-icon start>mdi-download-multiple</v-icon>
            Download Selected Partition
          </v-btn>
          <v-btn
            color="primary"
            variant="text"
            :disabled="busy || maintenanceBusy"
            @click="emit('download-all-partitions')"
          >
            <v-icon start>mdi-select-group</v-icon>
            Download All Partitions
          </v-btn>
          <v-btn
            color="secondary"
            variant="text"
            :disabled="busy || maintenanceBusy"
            @click="emit('download-used-flash')"
          >
            <v-icon start>mdi-content-save</v-icon>
            Download Used Flash
          </v-btn>
        </div>
      </div>
  <v-alert
    v-if="flashReadStatus"
    :type="flashReadStatusType"
    variant="tonal"
    density="comfortable"
    border="start"
    class="mt-3"
  >
    {{ flashReadStatus }}
  </v-alert>
    </v-card-text>
  </v-card>

  <v-card class="tools-card mt-6" variant="tonal">
    <v-card-title class="tools-card__title">
      <v-icon size="18" class="me-2">mdi-chip</v-icon>
      Register Access
    </v-card-title>
    <v-card-text class="tools-card__body">
      <v-autocomplete
        v-if="registerOptions.length"
        class="register-quick-select"
        :items="registerOptions"
        item-title="label"
        item-value="address"
        density="comfortable"
        variant="outlined"
        hide-details
        label="Quick-select register"
        :model-value="selectedRegisterAddress"
        :return-object="false"
        clearable
        @update:model-value="handleRegisterSelect"
      >
        <template #item="{ props, item }">
          <v-list-item v-bind="props">
            <v-list-item-title>{{ item.raw.label }}</v-list-item-title>
            <v-list-item-subtitle>{{ item.raw.address }}</v-list-item-subtitle>
          </v-list-item>
        </template>
        <template #selection="{ item }">
          <span>{{ item.raw.label }}</span>
        </template>
      </v-autocomplete>
      <v-alert
        v-if="selectedRegisterInfo"
        type="info"
        variant="tonal"
        border="start"
        density="comfortable"
        class="register-info"
      >
        <div class="register-info__title">{{ selectedRegisterInfo.label }}</div>
        <div class="register-info__address">{{ selectedRegisterInfo.address }}</div>
        <div class="register-info__description">{{ selectedRegisterInfo.description }}</div>
        <div class="register-info__link" v-if="selectedRegisterInfo.link">
          <a :href="selectedRegisterInfo.link" target="_blank" rel="noopener"
            >View register reference</a
          >
        </div>
      </v-alert>
      <v-alert
        v-else-if="registerReference"
        type="info"
        variant="tonal"
        border="start"
        density="comfortable"
        class="register-info"
      >
        <div class="register-info__title">{{ registerReference.title }}</div>
        <div class="register-info__link">
          <a :href="registerReference.url" target="_blank" rel="noopener">Open technical reference</a>
        </div>
      </v-alert>
      <v-row dense>
        <v-col cols="12" md="6">
          <v-text-field
            :model-value="registerAddress"
            label="Register address"
            placeholder="0x60000000"
            density="comfortable"
            :disabled="busy || maintenanceBusy"
            @update:model-value="value => emit('update:registerAddress', value)"
          />
        </v-col>
        <v-col cols="12" md="6">
          <v-text-field
            :model-value="registerValue"
            label="Value"
            placeholder="0x0"
            density="comfortable"
            :disabled="busy || maintenanceBusy"
            @update:model-value="value => emit('update:registerValue', value)"
          />
        </v-col>
      </v-row>
      <div class="tools-card__actions">
        <v-btn
          color="primary"
          variant="tonal"
          :disabled="busy || maintenanceBusy"
          @click="emit('read-register')"
        >
          <v-icon start>mdi-eye</v-icon>
          Read Register
        </v-btn>
        <v-btn
          color="primary"
          variant="text"
          :disabled="busy || maintenanceBusy"
          @click="emit('write-register')"
        >
          <v-icon start>mdi-pencil</v-icon>
          Write Register
        </v-btn>
      </div>
      <v-alert
        v-if="registerStatus"
        :type="registerStatusType"
        variant="tonal"
        density="comfortable"
        border="start"
        class="mt-3"
      >
        {{ registerStatus }}
      </v-alert>
      <v-alert
        v-else-if="registerReadResult"
        type="info"
        variant="tonal"
        density="comfortable"
        border="start"
        class="mt-3"
      >
        Last read value: <code>{{ registerReadResult }}</code>
      </v-alert>
    </v-card-text>
  </v-card>
  <v-card class="tools-card mt-6" variant="tonal">
    <v-card-title class="tools-card__title">
      <v-icon size="18" class="me-2">mdi-shield-check-outline</v-icon>
      Flash Integrity
    </v-card-title>
    <v-card-text class="tools-card__body">
      <v-select
        v-if="partitionOptions.length"
        class="integrity-select"
        :items="partitionOptions"
        item-title="label"
        item-value="value"
        variant="outlined"
        density="comfortable"
        clearable
        label="Partition"
        :model-value="integrityPartition"
        :disabled="busy || maintenanceBusy"
        @update:model-value="handleIntegrityPartitionSelect"
      />
      <p v-if="partitionOptions.length" class="integrity-helper">
        Selecting a partition will auto-fill the offset and length fields below.
      </p>
      <v-row dense class="flash-progress-row">
        <v-col cols="12" md="6">
          <v-text-field
            :model-value="md5Offset"
            label="Start offset"
            placeholder="0x0"
            density="comfortable"
            :disabled="busy || maintenanceBusy"
            @update:model-value="value => emit('update:md5Offset', value)"
          />
        </v-col>
        <v-col cols="12" md="6">
          <v-text-field
            :model-value="md5Length"
            label="Length (bytes)"
            placeholder="0x100000"
            density="comfortable"
            :disabled="busy || maintenanceBusy"
            @update:model-value="value => emit('update:md5Length', value)"
          />
        </v-col>
      </v-row>
      <div class="tools-card__actions">
        <v-btn
          color="primary"
          variant="tonal"
          :disabled="busy || maintenanceBusy"
          @click="emit('compute-md5')"
        >
          <v-icon start>mdi-fingerprint</v-icon>
          Compute MD5
        </v-btn>
      </div>
      <v-alert
        v-if="md5Status"
        :type="md5StatusType"
        variant="tonal"
        density="comfortable"
        border="start"
        class="mt-3"
      >
        {{ md5Status }}
      </v-alert>
      <v-alert
        v-else-if="md5Result"
        type="success"
        variant="tonal"
        density="comfortable"
        border="start"
        class="mt-3"
      >
        MD5 checksum: <code>{{ md5Result }}</code>
      </v-alert>
    </v-card-text>
  </v-card>
  <v-card class="tools-card mt-6" variant="tonal">
    <v-card-title class="tools-card__title">
      <v-icon size="18" class="me-2">mdi-folder-wrench</v-icon>
      SPIFFS Agent (ESP32-S3)
    </v-card-title>
    <v-card-text class="tools-card__body">
      <div class="spiffs-agent__status">{{ spiffsAgentSummary }}</div>
      <div class="tools-card__actions">
        <v-btn
          color="primary"
          variant="tonal"
          :loading="spiffsAgentLoading"
          :disabled="busy || maintenanceBusy || spiffsAgentLoading"
          @click="emit('load-spiffs-agent')"
        >
          <v-icon start>mdi-download</v-icon>
          Load Stub
        </v-btn>
      </div>
      <v-alert
        v-if="spiffsAgentLoaded && !spiffsAgentLoading"
        type="info"
        variant="tonal"
        border="start"
        density="comfortable"
        class="mt-3"
      >
        Stub binary is cached in the browser. Future integration can now upload it to the device.
      </v-alert>
    </v-card-text>
  </v-card>
  <v-dialog
    :model-value="flashProgressDialog.visible"
    persistent
    max-width="420"
    class="progress-dialog"
  >
    <v-card class="progress-dialog__card">
      <v-card-title class="progress-dialog__title">
        <v-icon start color="primary">mdi-lightning-bolt</v-icon>
        Flash in progress
      </v-card-title>
      <v-card-text class="progress-dialog__body">
        <div class="progress-dialog__label">
          {{ flashProgressDialog.label || 'Preparing flash...' }}
        </div>
        <v-progress-linear
          :model-value="flashProgressDialog.value"
          height="24"
          color="primary"
          rounded
          striped
        />
      </v-card-text>
      <v-card-actions class="progress-dialog__actions">
        <v-spacer />
        <v-btn
          color="secondary"
          variant="tonal"
          :disabled="!flashInProgress"
          @click="emit('cancel-flash')"
        >
          <v-icon start>mdi-stop</v-icon>
          Stop
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
  <v-dialog
    :model-value="downloadProgress.visible"
    persistent
    max-width="420"
    class="progress-dialog"
  >
    <v-card class="progress-dialog__card">
      <v-card-title class="progress-dialog__title">
        <v-icon start color="primary">mdi-download</v-icon>
        Flash download in progress
      </v-card-title>
      <v-card-text class="progress-dialog__body">
        <div class="progress-dialog__label">
          {{ downloadProgress.label || 'Preparing download...' }}
        </div>
        <v-progress-linear
          :model-value="downloadProgress.value"
          height="24"
          color="primary"
          rounded
          striped
        />
      </v-card-text>
      <v-card-actions class="progress-dialog__actions">
        <v-spacer />
        <v-btn
          color="secondary"
          variant="tonal"
          @click="emit('cancel-download')"
        >
          <v-icon start>mdi-stop</v-icon>
          Stop
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue';

const props = defineProps({
  flashOffset: {
    type: String,
    required: true,
  },
  selectedPreset: {
    type: [String, Number],
    default: null,
  },
  offsetPresets: {
    type: Array,
    default: () => [],
  },
  eraseFlash: {
    type: Boolean,
    required: true,
  },
  busy: {
    type: Boolean,
    required: true,
  },
  canFlash: {
    type: Boolean,
    required: true,
  },
  flashInProgress: {
    type: Boolean,
    required: true,
  },
  flashProgress: {
    type: Number,
    required: true,
  },
  flashProgressDialog: {
    type: Object,
    default: () => ({ visible: false, value: 0, label: '' }),
  },
  maintenanceBusy: {
    type: Boolean,
    default: false,
  },
  registerAddress: {
    type: String,
    default: '',
  },
  registerValue: {
    type: String,
    default: '',
  },
  registerOptions: {
    type: Array,
    default: () => [],
  },
  registerReference: {
    type: Object,
    default: null,
  },
  registerReadResult: {
    type: String,
    default: null,
  },
  registerStatus: {
    type: String,
    default: null,
  },
  registerStatusType: {
    type: String,
    default: 'info',
  },
  md5Offset: {
    type: String,
    default: '0x0',
  },
  md5Length: {
    type: String,
    default: '',
  },
  md5Result: {
    type: String,
    default: null,
  },
  md5Status: {
    type: String,
    default: null,
  },
  md5StatusType: {
    type: String,
    default: 'info',
  },
  flashReadOffset: {
    type: String,
    default: '0x0',
  },
  flashReadLength: {
    type: String,
    default: '',
  },
  flashReadStatus: {
    type: String,
    default: null,
  },
  flashReadStatusType: {
    type: String,
    default: 'info',
  },
  partitionOptions: {
    type: Array,
    default: () => [],
  },
  selectedPartition: {
    type: [String, Number],
    default: null,
  },
  integrityPartition: {
    type: [String, Number],
    default: null,
  },
  spiffsAgentStatus: {
    type: Object,
    default: () => ({ loading: false, loaded: false, size: 0, error: null }),
  },
  downloadProgress: {
    type: Object,
    default: () => ({ visible: false, value: 0, label: '' }),
  },
});

const emit = defineEmits([
  'update:flashOffset',
  'update:selectedPreset',
  'update:eraseFlash',
  'firmware-input',
  'flash',
  'apply-preset',
  'update:registerAddress',
  'update:registerValue',
  'read-register',
  'write-register',
  'update:md5Offset',
  'update:md5Length',
  'compute-md5',
  'update:flashReadOffset',
  'update:flashReadLength',
  'update:selectedPartition',
  'download-flash',
  'download-partition',
  'download-all-partitions',
  'download-used-flash',
  'cancel-flash',
  'erase-flash',
  'cancel-download',
  'select-register',
  'update:integrityPartition',
  'load-spiffs-agent',
]);

function handlePresetChange(value) {
  emit('update:selectedPreset', value);
  emit('apply-preset', value);
}

const selectedRegisterAddress = ref(null);
const selectedRegisterInfo = ref(null);
const integrityPartition = computed(() => props.integrityPartition ?? null);
const spiffsAgentLoading = computed(() => Boolean(props.spiffsAgentStatus?.loading));
const spiffsAgentLoaded = computed(() => Boolean(props.spiffsAgentStatus?.loaded));
const spiffsAgentSummary = computed(() => {
  const status = props.spiffsAgentStatus || {};
  if (status.loading) return 'Loading stub…';
  if (status.error) return `Error: ${status.error}`;
  if (status.loaded) {
    const size = status.size ? status.size.toLocaleString() : 'unknown';
    return `Loaded (${size} bytes). Ready for upload.`;
  }
  return 'Stub not loaded yet.';
});

function handleIntegrityPartitionSelect(value) {
  emit('update:integrityPartition', value);
}

function normalizeRegisterAddress(value) {
  if (!value) return null;
  if (typeof value !== 'string') {
    value = String(value);
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  const numeric = trimmed.startsWith('0x') ? Number.parseInt(trimmed, 16) : Number.parseInt(trimmed, 10);
  if (!Number.isFinite(numeric)) return null;
  return '0x' + numeric.toString(16).toUpperCase();
}

function syncSelectedRegister() {
  const normalized = normalizeRegisterAddress(props.registerAddress);
  const match =
    normalized &&
    props.registerOptions.find(option => normalizeRegisterAddress(option.address) === normalized);
  selectedRegisterAddress.value = match ? match.address : null;
  selectedRegisterInfo.value = match || null;
}

watch(
  () => [props.registerAddress, props.registerOptions],
  () => {
    syncSelectedRegister();
  },
  { immediate: true }
);

function handleRegisterSelect(value) {
  if (!value) {
    selectedRegisterAddress.value = null;
    selectedRegisterInfo.value = null;
    emit('select-register', null);
    return;
  }
  const normalized = normalizeRegisterAddress(value);
  const match =
    normalized &&
    props.registerOptions.find(option => normalizeRegisterAddress(option.address) === normalized);
  selectedRegisterAddress.value = match ? match.address : value;
  selectedRegisterInfo.value = match || null;
  emit('select-register', value);
}
</script>

<style scoped>
.tools-card {
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--v-theme-primary) 16%, transparent);
  background: color-mix(in srgb, var(--v-theme-surface) 94%, transparent);
}

.tools-card__title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 0.95rem;
}

.tools-card__body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tools-card__actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.download-progress {
  flex: 1 1 100%;
  min-width: 260px;
}

.partition-tools {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.partition-tools__actions {
  justify-content: flex-start;
}

.progress-dialog__card {
  padding: 20px;
}

.progress-dialog__title {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
}

.progress-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.progress-dialog__label {
  font-size: 0.95rem;
}

.progress-dialog__actions {
  justify-content: flex-end;
}

.register-quick-select {
  max-width: 420px;
}

.register-info {
  font-size: 0.9rem;
  line-height: 1.3;
}

.register-info__title {
  font-weight: 600;
  margin-bottom: 4px;
}

.register-info__address {
  font-family: 'Fira Code', 'Courier New', monospace;
  font-size: 0.85rem;
  margin-bottom: 4px;
}

.register-info__description {
  margin-bottom: 4px;
}

.register-info__link a {
  color: inherit;
  text-decoration: underline;
}

.advanced-warning {
  font-size: 0.9rem;
  line-height: 1.4;
}

.integrity-select {
  max-width: 420px;
}

.integrity-helper {
  font-size: 0.85rem;
  color: color-mix(in srgb, var(--v-theme-on-surface) 70%, transparent);
  margin-top: -4px;
}

.spiffs-agent__status {
  font-size: 0.9rem;
  color: color-mix(in srgb, var(--v-theme-on-surface) 80%, transparent);
}
</style>

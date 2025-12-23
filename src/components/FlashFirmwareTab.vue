<template>
  <v-alert type="warning" variant="tonal" border="start" class="mb-4 advanced-warning" density="comfortable">
    Firmware tools are intended for advanced users. Writing or erasing flash can permanently remove data or render the
    microcontroller unbootable. Double-check settings before proceeding.
  </v-alert>
  <v-card class="tools-card mb-6" variant="tonal" prepend-icon="mdi-archive-arrow-down">
    <template v-slot:title>
      <span class="font-weight-black"> Flash Backup &amp; Erase
      </span>
    </template>
    <v-card-text class="tools-card__body">

      <div v-if="partitionOptions.length" class="partition-tools">
        <v-select :model-value="selectedPartition" :items="partitionOptions" item-title="label" item-value="value"
          label="Partition" density="comfortable" clearable :disabled="busy || maintenanceBusy"
          @update:model-value="value => emit('update:selectedPartition', value)">
          <template #item="{ props, item }">
            <v-list-item v-bind="props" class="partition-select__item">
              <template #prepend>
                <span class="partition-select__swatch" :style="{ backgroundColor: resolvePartitionColor(item?.raw) }" />
              </template>
              <v-list-item-title>{{ item.raw.label }}</v-list-item-title>
            </v-list-item>
          </template>
          <template #selection="{ item }">
            <span v-if="item" class="partition-select__selection">
              <span class="partition-select__swatch" :style="{ backgroundColor: resolvePartitionColor(item.raw) }" />
              <span>{{ item.raw.label }}</span>
            </span>
          </template>
        </v-select>
        <div class="tools-card__actions partition-tools__actions">
          <v-btn color="primary" variant="tonal" :disabled="busy || maintenanceBusy || selectedPartition === null"
            @click="emit('download-partition')">
            <v-icon start>mdi-download-multiple</v-icon>
            Download Selected Partition
          </v-btn>
          <v-btn color="primary" variant="text" :disabled="busy || maintenanceBusy"
            @click="emit('download-all-partitions')">
            <v-icon start>mdi-select-group</v-icon>
            Download All Partitions
          </v-btn>
          <v-btn color="secondary" variant="text" :disabled="busy || maintenanceBusy"
            @click="emit('download-used-flash')">
            <v-icon start>mdi-content-save</v-icon>
            Download Flash Backup
          </v-btn>
        </div>
      </div>
      <v-divider v-if="partitionOptions.length" class="my-4" />
      <v-row dense>
        <v-col cols="12" md="6">
          <v-text-field :model-value="flashReadOffset" label="Start offset" placeholder="0x0" density="comfortable"
            :disabled="busy || maintenanceBusy" @update:model-value="value => emit('update:flashReadOffset', value)" />
        </v-col>
        <v-col cols="12" md="6">
          <v-text-field :model-value="flashReadLength" label="Length (bytes)" placeholder="0x100000"
            density="comfortable" :disabled="busy || maintenanceBusy"
            @update:model-value="value => emit('update:flashReadLength', value)" />
        </v-col>
      </v-row>
      <div class="tools-card__actions">
        <v-btn color="primary" variant="tonal" :disabled="busy || maintenanceBusy" @click="emit('download-flash')">
          <v-icon start>mdi-download-box</v-icon>
          Download Flash Region
        </v-btn>
        <v-btn color="error" variant="outlined" :disabled="busy || maintenanceBusy"
          @click="emit('erase-flash', { mode: 'full' })">
          <v-icon start>mdi-delete-sweep</v-icon>
          Erase Entire Flash
        </v-btn>
      </div>
      <v-alert v-if="flashReadStatus" :type="flashReadStatusType" variant="tonal" density="comfortable" border="start"
        class="mt-3">
        {{ flashReadStatus }}
      </v-alert>
    </v-card-text>
  </v-card>
  <v-card class="tools-card" variant="tonal" prepend-icon="mdi-lightning-bolt">
    <template v-slot:title>
      <span class="font-weight-black"> Flash Firmware</span>
    </template>
    <v-card-text class="tools-card__body">
      <v-row class="mb-2" dense>
        <v-col cols="12" md="8">
          <v-file-input label="Firmware binary (.bin)" prepend-icon="mdi-file-upload" accept=".bin"
            density="comfortable" :disabled="busy || maintenanceBusy"
            @update:model-value="value => emit('firmware-input', value)" />
        </v-col>
        <v-col cols="12" md="4">
          <v-text-field :model-value="flashOffset" label="Flash offset" placeholder="0x0" density="comfortable"
            :disabled="busy || maintenanceBusy" @update:model-value="value => emit('update:flashOffset', value)" />
        </v-col>
        <v-col cols="12" md="4">
          <v-select :model-value="selectedPreset" :items="offsetPresets" label="Recommended offsets" item-title="label"
            item-value="value" clearable density="comfortable" :disabled="busy || maintenanceBusy"
            @update:model-value="value => handlePresetChange(value)">
            <template #item="{ props, item }">
              <v-list-item v-bind="props" class="partition-select__item">
                <template #prepend>
                  <span class="partition-select__swatch"
                    :style="{ backgroundColor: resolvePartitionColor(item?.raw) }" />
                </template>
                <v-list-item-title>{{ item.raw.label }}</v-list-item-title>
              </v-list-item>
            </template>
            <template #selection="{ item }">
              <span v-if="item" class="partition-select__selection">
                <span class="partition-select__swatch" :style="{ backgroundColor: resolvePartitionColor(item.raw) }" />
                <span>{{ item.raw.label }}</span>
              </span>
            </template>
          </v-select>
        </v-col>
      </v-row>

      <v-checkbox :model-value="eraseFlash" label="Erase entire flash before writing" density="comfortable" hide-details
        :disabled="busy || maintenanceBusy" @update:model-value="value => emit('update:eraseFlash', value === true)" />

      <p class="flash-tools__hint text-medium-emphasis">
        Flashing runs at 921,600&nbsp;bps by default. Drop the baud if the device struggles to sync.
        The serial monitor automatically switches to 115,200&nbsp;bps for stability.
      </p>

      <v-btn color="primary" size="large" block class="mt-2" :disabled="!canFlash || busy || maintenanceBusy"
        @click="emit('flash')">
        <v-icon start>mdi-lightning-bolt</v-icon>
        Flash Firmware
      </v-btn>
    </v-card-text>
  </v-card>



  <v-card class="tools-card mt-6" variant="tonal" prepend-icon="mdi-chip">
    <template v-slot:title>
      <span class="font-weight-black"> Register Access</span>
    </template>
    <v-card-text class="tools-card__body">
      <v-autocomplete v-if="registerOptions.length" class="register-quick-select" :items="registerOptions"
        item-title="label" item-value="address" density="comfortable" variant="outlined" hide-details
        label="Quick-select register" :model-value="selectedRegisterAddress" :return-object="false" clearable
        @update:model-value="handleRegisterSelect">
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
      <v-alert v-if="selectedRegisterInfo" type="info" variant="tonal" border="start" density="comfortable"
        class="register-info">
        <div class="register-info__title">{{ selectedRegisterInfo.label }}</div>
        <div class="register-info__address">{{ selectedRegisterInfo.address }}</div>
        <div class="register-info__description">{{ selectedRegisterInfo.description }}</div>
        <div class="register-info__link" v-if="selectedRegisterInfo.link">
          <a :href="selectedRegisterInfo.link" target="_blank" rel="noopener">View register reference</a>
        </div>
      </v-alert>
      <v-alert v-else-if="registerReference" type="info" variant="tonal" border="start" density="comfortable"
        class="register-info">
        <div class="register-info__title">{{ registerReference.title }}</div>
        <div class="register-info__link">
          <a :href="registerReference.url" target="_blank" rel="noopener">Open technical reference</a>
        </div>
      </v-alert>
      <v-row dense>
        <v-col cols="12" md="6">
          <v-text-field :model-value="registerAddress" label="Register address" placeholder="0x60000000"
            density="comfortable" :disabled="busy || maintenanceBusy"
            @update:model-value="value => emit('update:registerAddress', value)" />
        </v-col>
        <v-col cols="12" md="6">
          <v-text-field :model-value="registerValue" label="Value" placeholder="0x0" density="comfortable"
            :disabled="busy || maintenanceBusy" @update:model-value="value => emit('update:registerValue', value)" />
        </v-col>
      </v-row>
      <div class="tools-card__actions">
        <v-btn color="primary" variant="tonal" :disabled="busy || maintenanceBusy" @click="emit('read-register')">
          <v-icon start>mdi-eye</v-icon>
          Read Register
        </v-btn>
        <v-btn color="primary" variant="text" :disabled="busy || maintenanceBusy" @click="emit('write-register')">
          <v-icon start>mdi-pencil</v-icon>
          Write Register
        </v-btn>
      </div>
      <v-alert v-if="registerStatus" :type="registerStatusType" variant="tonal" density="comfortable" border="start"
        class="mt-3">
        {{ registerStatus }}
      </v-alert>
      <v-alert v-else-if="registerReadResult" type="info" variant="tonal" density="comfortable" border="start"
        class="mt-3">
        Last read value: <code>{{ registerReadResult }}</code>
      </v-alert>
    </v-card-text>
  </v-card>
  <v-card class="tools-card mt-6" variant="tonal" prepend-icon="mdi-shield-check-outline">
    <template v-slot:title>
      <span class="font-weight-black"> Flash Integrity</span>
    </template>
    <v-card-text class="tools-card__body">
      <v-select v-if="partitionOptions.length" class="integrity-select" :items="partitionOptions" item-title="label"
        item-value="value" variant="outlined" density="comfortable" clearable label="Partition"
        :model-value="integrityPartition" :disabled="busy || maintenanceBusy"
        @update:model-value="handleIntegrityPartitionSelect">
        <template #item="{ props, item }">
          <v-list-item v-bind="props" class="partition-select__item">
            <template #prepend>
              <span class="partition-select__swatch" :style="{ backgroundColor: resolvePartitionColor(item?.raw) }" />
            </template>
            <v-list-item-title>{{ item.raw.label }}</v-list-item-title>
          </v-list-item>
        </template>
        <template #selection="{ item }">
          <span v-if="item" class="partition-select__selection">
            <span class="partition-select__swatch" :style="{ backgroundColor: resolvePartitionColor(item.raw) }" />
            <span>{{ item.raw.label }}</span>
          </span>
        </template>
      </v-select>
      <p v-if="partitionOptions.length" class="integrity-helper">
        Selecting a partition will auto-fill the offset and length fields below.
      </p>
      <v-row dense class="flash-progress-row">
        <v-col cols="12" md="6">
          <v-text-field :model-value="md5Offset" label="Start offset" placeholder="0x0" density="comfortable"
            :disabled="busy || maintenanceBusy" @update:model-value="value => emit('update:md5Offset', value)" />
        </v-col>
        <v-col cols="12" md="6">
          <v-text-field :model-value="md5Length" label="Length (bytes)" placeholder="0x100000" density="comfortable"
            :disabled="busy || maintenanceBusy" @update:model-value="value => emit('update:md5Length', value)" />
        </v-col>
      </v-row>
      <div class="tools-card__actions">
        <v-btn color="primary" variant="tonal" :disabled="busy || maintenanceBusy" @click="emit('compute-md5')">
          <v-icon start>mdi-fingerprint</v-icon>
          Compute MD5
        </v-btn>
      </div>
      <v-alert v-if="md5Status" :type="md5StatusType" variant="tonal" density="comfortable" border="start" class="mt-3">
        {{ md5Status }}
      </v-alert>
      <v-alert v-else-if="md5Result" type="success" variant="tonal" density="comfortable" border="start" class="mt-3">
        MD5 checksum: <code>{{ md5Result }}</code>
      </v-alert>
    </v-card-text>
  </v-card>
  <v-dialog :model-value="flashProgressDialog.visible" persistent max-width="420" class="progress-dialog">
    <v-card class="progress-dialog__card">
      <v-card-title class="progress-dialog__title">
        <v-icon start color="primary">mdi-lightning-bolt</v-icon>
        Flash in progress
      </v-card-title>
      <v-card-text class="progress-dialog__body">
        <div class="progress-dialog__label">
          {{ flashProgressDialog.label || 'Preparing flash...' }}
        </div>
        <v-progress-linear :model-value="flashProgressDialog.value" height="24" color="primary" rounded striped />
      </v-card-text>
      <v-card-actions class="progress-dialog__actions">
        <v-spacer />
        <v-btn color="secondary" variant="tonal" :disabled="!flashInProgress" @click="emit('cancel-flash')">
          <v-icon start>mdi-stop</v-icon>
          Stop
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
  <v-dialog :model-value="downloadProgress.visible" persistent max-width="500" class="progress-dialog">
    <v-card class="progress-dialog__card">
      <v-card-title class="progress-dialog__title">
        <v-icon start color="primary">mdi-download</v-icon>
        Flash download in progress
      </v-card-title>
      <v-card-text class="progress-dialog__body">
        <div class="progress-dialog__label">
          {{ downloadProgress.label || 'Preparing download...' }}
        </div>
        <v-progress-linear :model-value="downloadProgress.value" height="24" color="primary" rounded striped />
      </v-card-text>
      <v-card-actions class="progress-dialog__actions">
        <v-spacer />
        <v-btn color="secondary" variant="tonal" @click="emit('cancel-download')">
          <v-icon start>mdi-stop</v-icon>
          Stop
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type {
  AlertType,
  EraseFlashPayload,
  FlashOffsetPreset,
  FlashPartitionOption,
  FirmwareInputValue,
  PartitionOptionValue,
  ProgressDialogState,
  RegisterOption,
  RegisterReference,
} from '../types/flash-firmware';

const props = withDefaults(
  defineProps<{
    flashOffset: string;
    selectedPreset?: string | number | null;
    offsetPresets?: FlashOffsetPreset[];
    eraseFlash: boolean;
    busy: boolean;
    canFlash: boolean;
    flashInProgress: boolean;
    flashProgress: number;
    flashProgressDialog?: ProgressDialogState;
    maintenanceBusy?: boolean;
    registerAddress?: string;
    registerValue?: string;
    registerOptions?: RegisterOption[];
    registerReference?: RegisterReference | null;
    registerReadResult?: string | null;
    registerStatus?: string | null;
    registerStatusType?: AlertType;
    md5Offset?: string;
    md5Length?: string;
    md5Result?: string | null;
    md5Status?: string | null;
    md5StatusType?: AlertType;
    flashReadOffset?: string;
    flashReadLength?: string;
    flashReadStatus?: string | null;
    flashReadStatusType?: AlertType;
    partitionOptions?: FlashPartitionOption[];
    selectedPartition?: PartitionOptionValue | null;
    integrityPartition?: PartitionOptionValue | null;
    downloadProgress?: ProgressDialogState;
  }>(),
  {
    selectedPreset: null,
    offsetPresets: () => [],
    maintenanceBusy: false,
    registerAddress: '',
    registerValue: '',
    registerOptions: () => [],
    registerReference: null,
    registerReadResult: null,
    registerStatus: null,
    registerStatusType: 'info',
    md5Offset: '0x0',
    md5Length: '',
    md5Result: null,
    md5Status: null,
    md5StatusType: 'info',
    flashReadOffset: '0x0',
    flashReadLength: '',
    flashReadStatus: null,
    flashReadStatusType: 'info',
    partitionOptions: () => [],
    selectedPartition: null,
    integrityPartition: null,
    flashProgressDialog: () => ({ visible: false, value: 0, label: '' }),
    downloadProgress: () => ({ visible: false, value: 0, label: '' }),
  },
);

const emit = defineEmits<{
  (e: 'update:flashOffset', value: string): void;
  (e: 'update:selectedPreset', value: string | number | null): void;
  (e: 'update:eraseFlash', value: boolean): void;
  (e: 'firmware-input', value: FirmwareInputValue): void;
  (e: 'flash'): void;
  (e: 'apply-preset', value: string | number | null): void;
  (e: 'update:registerAddress', value: string): void;
  (e: 'update:registerValue', value: string): void;
  (e: 'read-register'): void;
  (e: 'write-register'): void;
  (e: 'update:md5Offset', value: string): void;
  (e: 'update:md5Length', value: string): void;
  (e: 'compute-md5'): void;
  (e: 'update:flashReadOffset', value: string): void;
  (e: 'update:flashReadLength', value: string): void;
  (e: 'update:selectedPartition', value: PartitionOptionValue | null): void;
  (e: 'download-flash'): void;
  (e: 'download-partition'): void;
  (e: 'download-all-partitions'): void;
  (e: 'download-used-flash'): void;
  (e: 'cancel-flash'): void;
  (e: 'erase-flash', payload: EraseFlashPayload): void;
  (e: 'cancel-download'): void;
  (e: 'select-register', value: string | null): void;
  (e: 'update:integrityPartition', value: PartitionOptionValue | null): void;
}>();

function handlePresetChange(value: string | number | null) {
  emit('update:selectedPreset', value);
  emit('apply-preset', value);
}

const selectedRegisterAddress = ref<string | null>(null);
const selectedRegisterInfo = ref<RegisterOption | null>(null);
const integrityPartition = computed<PartitionOptionValue | null>(() => props.integrityPartition ?? null);

function handleIntegrityPartitionSelect(value: PartitionOptionValue | null) {
  emit('update:integrityPartition', value);
}

const PARTITION_COLOR_FALLBACK = 'var(--v-theme-primary)';

function resolvePartitionColor(option: unknown): string {
  if (option && typeof option === 'object' && 'color' in option) {
    const color = (option as { color?: unknown }).color;
    if (typeof color === 'string' && color) {
      return color;
    }
  }
  return PARTITION_COLOR_FALLBACK;
}

function normalizeRegisterAddress(value: unknown): string | null {
  if (value == null) return null;
  const text = typeof value === 'string' ? value : String(value);
  const trimmed = text.trim();
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
  () => [props.registerAddress, props.registerOptions] as const,
  () => {
    syncSelectedRegister();
  },
  { immediate: true },
);

function handleRegisterSelect(value: string | null) {
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

.flash-tools__hint {
  font-size: 0.78rem;
  margin-top: -4px;
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

.partition-select__item {
  gap: 10px;
}

.partition-select__selection {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.partition-select__swatch {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  display: inline-block;
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
</style>

<template>
  <div class="partition-offset-row">
    <v-text-field
      :model-value="partitionTableOffset"
      :label="t('partitions.tableOffset')"
      :hint="t('partitions.tableOffsetHint')"
      persistent-hint
      placeholder="0x8000"
      density="comfortable"
      variant="outlined"
      class="partition-offset-input"
      :disabled="busy"
      @update:model-value="value => emit('update:partitionTableOffset', value)"
    />
    <v-btn
      color="primary"
      variant="outlined"
      density="comfortable"
      :disabled="!connected || busy"
      @click="emit('refreshPartitions')"
    >
      <v-icon start>mdi-refresh</v-icon>
      {{ t('partitions.refreshButton') }}
    </v-btn>
  </div>
  <div v-if="!partitionSegments.length" class="partitions-empty">
    <v-card :class="[
      'partitions-empty__card',
      { 'partitions-empty__card--disconnected': !connected },
    ]" variant="tonal">
      <v-card-text class="partitions-empty__body">
        <v-avatar class="partitions-empty__avatar" size="70">
          <v-icon size="34">mdi-table-refresh</v-icon>
        </v-avatar>
        <div class="partitions-empty__text">
          <div class="partitions-empty__title">{{ t('partitions.empty.title') }}</div>
          <div class="partitions-empty__subtitle">
            {{ emptySubtitle }}
          </div>
        </div>
      </v-card-text>
    </v-card>
  </div>
  <div v-else class="partition-view">
    <v-card variant="tonal" prepend-icon="mdi-table">
      <template v-slot:title>
        <div class="partition-title">
          <span class="font-weight-black">{{ partitionCardTitle }}</span>
          <span class="partition-used">{{ t('partitions.usageSummary', { size: totalUsedDisplay }) }}</span>
        </div>
      </template>
      <v-alert v-if="showUnusedAlert" type="warning" variant="tonal" class="unused-alert">
        <div>
          {{ t('partitions.alerts.unusedFlash.detected', {
            amount: unusedReadable,
            bytes: unusedBytesDisplay,
          }) }}
        </div>
        <div>
          {{ t('partitions.alerts.unusedFlash.learn') }}
          <a href="https://youtu.be/EuHxodrye6E" target="_blank" rel="noopener noreferrer">
            {{ t('partitions.alerts.resources.tutorial') }}
          </a>
          {{ t('partitions.alerts.unusedFlash.or') }}
          <a
            :href="partitionBuilderUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ t('partitions.alerts.resources.builder') }}
          </a>.
        </div>
      </v-alert>
      <v-alert v-else type="info" variant="tonal" class="unused-alert">
        {{ t('partitions.alerts.customizePrompt') }}
        <a href="https://youtu.be/EuHxodrye6E" target="_blank" rel="noopener noreferrer">
          {{ t('partitions.alerts.resources.tutorial') }}
        </a>
        {{ t('partitions.alerts.customizeOr') }}
        <a
          :href="partitionBuilderUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ t('partitions.alerts.resources.builder') }}
        </a>.
      </v-alert>
      <div class="partition-map">
        <VTooltip v-for="segment in partitionSegments" :key="segment.key" location="top" :open-delay="120"
          transition="fade-transition">
          <template #activator="{ props }">
            <div v-bind="props" :class="[
              'partition-segment',
              {
                'partition-segment--unused': segment.isUnused,
                'partition-segment--reserved': segment.isReserved,
              },
            ]" :style="{
              width: segment.width,
              flexBasis: segment.width,
              backgroundColor: segment.color,
              backgroundImage: segment.backgroundImage || undefined,
            }">
              <span v-if="segment.showLabel" class="partition-label">
                {{ segment.label || t('partitions.unnamed') }}
              </span>
              <span v-if="segment.showMeta" class="partition-meta">
                {{ segment.sizeText }} - {{ segment.offsetHex }}
              </span>
            </div>
          </template>
          <template #default>
            <div class="partition-tooltip">
              <div class="partition-tooltip__title">{{ segment.label || t('partitions.unnamed') }}</div>
              <div v-for="line in segment.tooltipLines" :key="line" class="partition-tooltip__line">
                {{ line }}
              </div>
            </div>
          </template>
        </VTooltip>
      </div>
      <v-table density="comfortable" class="mt-4">
        <thead>
          <tr>
          <th>{{ t('partitions.table.label') }}</th>
          <th>{{ t('partitions.table.type') }}</th>
          <th>{{ t('partitions.table.subtype') }}</th>
          <th>{{ t('partitions.table.offset') }}</th>
          <th>{{ t('partitions.table.size') }}</th>
          </tr>
        </thead>
        <tbody>
            <tr v-for="entry in formattedPartitions" :key="entry.offset" class="partition-table-row">
              <td>
                <div class="partition-table-label">
                  <span class="partition-color-pip" :style="{
                    backgroundColor: entry.color,
                    backgroundImage: entry.backgroundImage || undefined,
                  }"></span>
                <span>{{ entry.label || t('partitions.unnamed') }}</span>
                </div>
              </td>
              <td>{{ entry.typeLabel }}</td>
              <td>{{ entry.subtypeLabel }}</td>
              <td>{{ entry.offsetHex }}</td>
              <td>{{ entry.sizeText }}</td>
          </tr>
        </tbody>
      </v-table>
    </v-card>

  </div>


</template>

<script setup lang="ts">
import { computed, onMounted, toRefs } from 'vue';
import { useI18n } from 'vue-i18n';
import type { FormattedPartitionRow, PartitionSegment, UnusedFlashSummary } from '../types/partitions';
import {
  buildPartitionCsv,
  encodeCsvAsBase64,
  formatBytes,
  isReservedPartition,
} from '../utils/partitionCsv';

const props = withDefaults(
  defineProps<{
    partitionSegments?: PartitionSegment[];
    formattedPartitions?: FormattedPartitionRow[];
    unusedSummary?: UnusedFlashSummary | null;
    flashSizeLabel?: string | null;
    connected?: boolean;
    partitionTableOffset?: string;
    busy?: boolean;
  }>(),
  {
    partitionSegments: () => [],
    formattedPartitions: () => [],
    unusedSummary: null,
    flashSizeLabel: '',
    connected: false,
    partitionTableOffset: '0x8000',
    busy: false,
  },
);

const emit = defineEmits<{
  (e: 'update:partitionTableOffset', value: string): void;
  (e: 'refreshPartitions'): void;
}>();

const { partitionSegments, formattedPartitions, unusedSummary, flashSizeLabel, connected } = toRefs(props);
const { t } = useI18n();

const PARTITION_BUILDER_URL =
  'https://thelastoutpostworkshop.github.io/ESP32PartitionBuilder/';

const showUnusedAlert = computed(() => Boolean(unusedSummary.value));
const unusedReadable = computed(() => unusedSummary.value?.readable ?? '');
const unusedBytesDisplay = computed(() =>
  unusedSummary.value?.bytes != null ? unusedSummary.value.bytes.toLocaleString() : '',
);
const partitionCardTitle = computed(() => {
  const label = flashSizeLabel.value?.trim();
  return label ? t('partitions.cardTitleWithSize', { size: label }) : t('partitions.cardTitle');
});
const partitionCsvRows = computed(() =>
  formattedPartitions.value.filter(
    row => row.size > 0 && !row.isUnused && !isReservedPartition(row),
  ),
);
const totalUsedBytes = computed(() => partitionCsvRows.value.reduce((total, row) => total + row.size, 0));
const totalUsedDisplay = computed(() => formatBytes(totalUsedBytes.value) || `${totalUsedBytes.value} bytes`);
const totalFlashBytes = computed(() => {
  return partitionSegments.value.reduce((max, segment) => {
    const end = segment.offset + segment.size;
    return Math.max(max, end);
  }, 0);
});

const flashSizeMB = computed(() => {
  const bytes = totalFlashBytes.value;
  if (!bytes) {
    return 1;
  }
  const mb = bytes / (1024 * 1024);
  return Math.max(1, Math.round(mb));
});

const partitionBuilderUrl = computed(() => {
  const rows = partitionCsvRows.value;
  if (!rows.length) {
    return PARTITION_BUILDER_URL;
  }
  const csv = buildPartitionCsv(rows);
  console.debug('partition CSV:\n' + csv);
  const encoded = encodeCsvAsBase64(csv);
  return `${PARTITION_BUILDER_URL}?flash=${flashSizeMB.value}&partitions=base64:${encoded}`;
});
const emptySubtitle = computed(() =>
  connected.value ? t('partitions.empty.subtitleConnected') : t('partitions.empty.subtitle'),
);

onMounted(() => {
  logPartitionCsv(partitionCsvRows.value);
});

function logPartitionCsv(rows: FormattedPartitionRow[]) {
  if (!rows.length) {
    console.info('partition CSV: (no partition rows)');
    return;
  }
  console.info('partition CSV:\n' + buildPartitionCsv(rows));
}

</script>

<style scoped>
.partition-offset-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding-top: 12px;
  margin-bottom: 16px;
}

.partition-offset-input {
  max-width: 320px;
}

.partition-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.partition-title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.partition-used {
  font-size: 0.85rem;
  color: color-mix(in srgb, var(--v-theme-on-surface) 56%, transparent);
}

.partitions-empty {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 260px;
}

.partitions-empty__card {
  border-radius: 18px;
  padding: 28px 32px;
  border: 1px dashed color-mix(in srgb, var(--v-theme-primary) 20%, transparent);
  background: color-mix(in srgb, var(--v-theme-surface) 94%, transparent);
  text-align: center;
  max-width: 420px;
}

.partitions-empty__card--disconnected {
  border-style: solid;
  border-color: color-mix(in srgb, var(--v-theme-error) 40%, transparent);
  background: color-mix(in srgb, var(--v-theme-error) 14%, var(--v-theme-surface) 92%);
}

.partitions-empty__body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
}

.partitions-empty__avatar {
  background: color-mix(in srgb, var(--v-theme-primary) 18%, transparent);
  color: color-mix(in srgb, var(--v-theme-primary) 80%, var(--v-theme-on-surface) 30%);
}

.partitions-empty__card--disconnected .partitions-empty__avatar {
  background: color-mix(in srgb, var(--v-theme-error) 26%, transparent);
  color: color-mix(in srgb, var(--v-theme-error) 85%, var(--v-theme-on-surface) 10%);
}

.partitions-empty__title {
  font-size: 1.02rem;
  font-weight: 600;
  color: color-mix(in srgb, var(--v-theme-on-surface) 92%, transparent);
}

.partitions-empty__subtitle {
  font-size: 0.92rem;
  color: color-mix(in srgb, var(--v-theme-on-surface) 65%, transparent);
}

.partition-map {
  display: flex;
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--v-theme-on-surface) 12%, transparent);
  background: color-mix(in srgb, var(--v-theme-surface) 90%, transparent);
  flex-wrap: nowrap;
  min-height: 140px;
}

.partition-segment {
  position: relative;
  padding: 10px 12px;
  min-width: 10px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.95);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
  min-width: 0;
  box-sizing: border-box;
  border-left: 1px solid rgba(255, 255, 255, 0.4);
  flex: 0 0 auto;
}

.partition-segment:first-child {
  border-left: none;
}

.partition-segment--unused {
  color: rgba(255, 255, 255, 0.88);
  background-repeat: repeat;
  background-size: 28px 28px;
}

.partition-segment--unused .partition-meta {
  opacity: 0.8;
}

.partition-segment--reserved {
  color: rgba(255, 255, 255, 0.92);
}

.partition-segment--reserved .partition-meta {
  opacity: 0.85;
}

.partition-tooltip {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 180px;
}

.partition-tooltip__title {
  font-weight: 600;
  font-size: 0.85rem;
}

.partition-tooltip__line {
  font-size: 0.78rem;
  opacity: 0.85;
}

.partition-table-row td {
  vertical-align: middle;
}

.partition-table-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.partition-color-pip {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.4);
  background-size: 18px 18px;
  background-repeat: repeat;
}

.partition-label {
  font-weight: 600;
  font-size: 0.9rem;
  text-align: center;
  display: block;
  width: 100%;
}

.partition-meta {
  font-size: 0.75rem;
  opacity: 0.85;
}

.partition-map:empty::before {
  content: 'No partitions detected.';
  padding: 16px;
  color: color-mix(in srgb, var(--v-theme-on-surface) 60%, transparent);
}

.unused-alert {
  margin-bottom: 8px;
}

.unused-alert a {
  color: inherit;
  text-decoration: underline;
}
</style>

<template>
  <div v-if="!partitionSegments.length" class="partitions-empty">
    <v-card class="partitions-empty__card partitions-empty__card--disconnected" variant="tonal">
      <v-card-text class="partitions-empty__body">
        <v-avatar class="partitions-empty__avatar" size="70">
          <v-icon size="34">mdi-table-refresh</v-icon>
        </v-avatar>
        <div class="partitions-empty__text">
          <div class="partitions-empty__title">No partition data yet</div>
          <div class="partitions-empty__subtitle">
            Connect to an ESP32 to load its partition table.
          </div>
        </div>
      </v-card-text>
    </v-card>
  </div>
  <div v-else class="partition-view">
    <v-alert
      v-if="showUnusedAlert"
      type="warning"
      variant="tonal"
      class="unused-alert"
    >
      <div>
        Unused flash detected - about {{ unusedReadable }} ({{ unusedBytesDisplay }} bytes) is reclaimable.
      </div>
      <div>
        See the
        <a
          href="https://youtu.be/EuHxodrye6E"
          target="_blank"
          rel="noopener noreferrer"
        >
          partition tutorial
        </a>
        or try the
        <a
          href="https://thelastoutpostworkshop.github.io/microcontroller_devkit/esp32partitionbuilder/"
          target="_blank"
          rel="noopener noreferrer"
        >
          ESP32 partition builder
        </a>.
      </div>
    </v-alert>

    <div class="partition-map">
      <VTooltip
        v-for="segment in partitionSegments"
        :key="segment.key"
        location="top"
        :open-delay="120"
        transition="fade-transition"
      >
        <template #activator="{ props }">
          <div
            v-bind="props"
            :class="[
              'partition-segment',
              {
                'partition-segment--unused': segment.isUnused,
                'partition-segment--reserved': segment.isReserved,
              },
            ]"
            :style="{
              width: segment.width,
              flexBasis: segment.width,
              backgroundColor: segment.color,
              backgroundImage: segment.backgroundImage || undefined,
            }"
          >
            <span v-if="segment.showLabel" class="partition-label">
              {{ segment.label || 'Unnamed' }}
            </span>
            <span v-if="segment.showMeta" class="partition-meta">
              {{ segment.sizeText }} - {{ segment.offsetHex }}
            </span>
          </div>
        </template>
        <template #default>
          <div class="partition-tooltip">
            <div class="partition-tooltip__title">{{ segment.label || 'Unnamed' }}</div>
            <div
              v-for="line in segment.tooltipLines"
              :key="line"
              class="partition-tooltip__line"
            >
              {{ line }}
            </div>
          </div>
        </template>
      </VTooltip>
    </div>

    <v-table density="comfortable" class="mt-4">
      <thead>
        <tr>
          <th>Label</th>
          <th>Type</th>
          <th>Subtype</th>
          <th>Offset</th>
          <th>Size</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="entry in formattedPartitions"
          :key="entry.offset"
          class="partition-table-row"
        >
          <td>
            <div class="partition-table-label">
              <span
                class="partition-color-pip"
                :style="{
                  backgroundColor: entry.color,
                  backgroundImage: entry.backgroundImage || undefined,
                }"
              ></span>
              <span>{{ entry.label || 'Unnamed' }}</span>
            </div>
          </td>
          <td>{{ entry.typeLabel }}</td>
          <td>{{ entry.subtypeLabel }}</td>
          <td>{{ entry.offsetHex }}</td>
          <td>{{ entry.sizeText }}</td>
        </tr>
      </tbody>
    </v-table>
  </div>
</template>

<script setup>
import { computed, toRefs } from 'vue';

const props = defineProps({
  partitionSegments: {
    type: Array,
    default: () => [],
  },
  formattedPartitions: {
    type: Array,
    default: () => [],
  },
  unusedSummary: {
    type: Object,
    default: null,
  },
});

const { partitionSegments, formattedPartitions, unusedSummary } = toRefs(props);

const showUnusedAlert = computed(() => Boolean(unusedSummary.value));
const unusedReadable = computed(() => unusedSummary.value?.readable ?? '');
const unusedBytesDisplay = computed(() =>
  unusedSummary.value?.bytes != null ? unusedSummary.value.bytes.toLocaleString() : ''
);
</script>

<style scoped>
.partition-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
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


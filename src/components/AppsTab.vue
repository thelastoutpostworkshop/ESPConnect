<template>
  <div class="apps-tab">
    <v-alert
      v-if="activeSummary"
      type="info"
      variant="tonal"
      density="comfortable"
      border="start"
      class="mb-4"
    >
      {{ activeSummary }}
    </v-alert>

    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      density="comfortable"
      border="start"
      class="mb-4"
    >
      {{ error }}
    </v-alert>

    <div v-if="loading" class="apps-tab__loading">
      <v-progress-circular indeterminate color="primary" size="28" />
      <span class="ms-3 text-body-2">{{ t('apps.alerts.readingMetadata') }}</span>
    </div>

    <template v-else>
      <v-alert
        v-if="!error && !apps.length"
        type="info"
        variant="tonal"
        density="comfortable"
        border="start"
      >
        {{ t('apps.alerts.noApplications') }}
      </v-alert>

      <div v-else class="apps-tab__list">
        <v-card v-for="app in apps" :key="app.key" class="apps-tab__card" variant="tonal">
          <v-card-title class="apps-tab__title">
            <div class="apps-tab__heading">
              <span class="text-subtitle-1">{{ app.label }}</span>
              <span class="text-caption text-medium-emphasis ms-3">{{ app.slotLabel }}</span>
            </div>
            <div class="apps-tab__chips">
              <v-chip v-if="app.isActive" color="success" size="small" variant="elevated">
                {{ t('apps.chips.active') }}
              </v-chip>
              <v-chip v-if="!app.valid" color="warning" size="small" variant="outlined">
                {{ t('apps.chips.invalid') }}
              </v-chip>
            </div>
          </v-card-title>
          <v-card-subtitle class="apps-tab__subtitle">
            {{ t('apps.subtitle', { offset: app.offsetHex, size: app.sizeText }) }}
          </v-card-subtitle>
          <v-card-text>
            <template v-if="app.valid">
              <div class="apps-tab__details">
                <div class="apps-tab__detail">
                  <span class="apps-tab__label">{{ t('apps.details.project') }}</span>
                  <span class="apps-tab__value">{{ app.projectName || t('apps.unknown') }}</span>
                </div>
                <div class="apps-tab__detail">
                  <span class="apps-tab__label">{{ t('apps.details.version') }}</span>
                  <span class="apps-tab__value">{{ app.version || t('apps.unknown') }}</span>
                </div>
                <div class="apps-tab__detail">
                  <span class="apps-tab__label">{{ t('apps.details.built') }}</span>
                  <span class="apps-tab__value">
                    {{ app.built || [app.buildDate, app.buildTime].filter(Boolean).join(' ') || t('apps.unknown') }}
                  </span>
                </div>
                <div class="apps-tab__detail">
                  <span class="apps-tab__label">{{ t('apps.details.core') }}</span>
                  <span class="apps-tab__value">{{ app.idfVersion || t('apps.unknown') }}</span>
                </div>
                <div class="apps-tab__detail">
                  <span class="apps-tab__label">{{ t('apps.details.entry') }}</span>
                  <span class="apps-tab__value">{{ app.entryAddressHex || t('apps.unknown') }}</span>
                </div>
                <div class="apps-tab__detail">
                  <span class="apps-tab__label">{{ t('apps.details.segments') }}</span>
                  <span class="apps-tab__value">
                    {{ app.segmentCount != null ? app.segmentCount : t('apps.unknown') }}
                  </span>
                </div>
              </div>
              <div v-if="!app.descriptorFound" class="text-caption text-medium-emphasis mt-2">
                {{ t('apps.descriptorMissing') }}
              </div>
            </template>
            <template v-else>
              <v-alert type="warning" variant="tonal" density="comfortable" border="start">
                {{ app.error || t('apps.invalidImage') }}
              </v-alert>
            </template>
          </v-card-text>
        </v-card>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { AppPartitionMetadata } from '../types/app-partitions';

withDefaults(
  defineProps<{
    apps?: AppPartitionMetadata[];
    activeSlotId?: string | null;
    activeSummary?: string;
    loading?: boolean;
    error?: string | null;
  }>(),
  {
    apps: () => [],
    activeSlotId: null,
    activeSummary: '',
    loading: false,
    error: null,
  },
);

const { t } = useI18n();
</script>

<style scoped>
.apps-tab__loading {
  display: flex;
  align-items: center;
  padding: 12px 4px;
}

.apps-tab__list {
  display: grid;
  gap: 16px;
}

.apps-tab__card {
  width: 100%;
}

.apps-tab__title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.apps-tab__chips {
  display: flex;
  gap: 8px;
}

.apps-tab__details {
  display: grid;
  gap: 8px;
}

@media (min-width: 960px) {
  .apps-tab__details {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.apps-tab__detail {
  display: flex;
  flex-direction: column;
  padding: 4px 0;
}

.apps-tab__label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: rgba(0, 0, 0, 0.54);
}

.apps-tab__value {
  font-size: 0.95rem;
}

:deep(.v-theme--dark) .apps-tab__label {
  color: rgba(255, 255, 255, 0.64);
}

:deep(.v-theme--dark) .apps-tab__value {
  color: rgba(255, 255, 255, 0.92);
}

.apps-tab__subtitle {
  padding-bottom: 0;
}
</style>

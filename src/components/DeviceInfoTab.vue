<template>
  <v-expand-transition>
    <div v-if="chipDetails" class="device-info-wrapper">
      <v-card class="device-card" elevation="0" variant="flat">
        <v-card-text class="device-card__body">
          <div class="device-header">
            <v-avatar class="device-avatar" size="64">
              <v-icon size="36">mdi-chip</v-icon>
            </v-avatar>
            <div class="device-header__text">
              <div class="device-title">{{ chipDetails.description || chipDetails.name }}</div>
              <div class="device-subtitle">{{ chipDetails.name }}</div>
              <div v-if="chipDetails.mac" class="device-meta">
                <v-icon size="16" class="me-1">mdi-identifier</v-icon>
                {{ chipDetails.mac }}
              </div>
            </div>
          </div>

          <v-row class="device-metrics" dense>
            <v-col cols="12" sm="4">
              <div class="metric-card">
                <v-icon class="metric-icon" size="22">mdi-memory</v-icon>
                <div class="metric-label">Flash Size</div>
                <div class="metric-value">{{ chipDetails.flashSize || 'Unknown' }}</div>
                <div v-if="chipDetails.crystal" class="metric-caption">
                  Crystal {{ chipDetails.crystal }}
                </div>
              </div>
            </v-col>
            <v-col cols="12" sm="4">
              <div class="metric-card">
                <v-icon class="metric-icon" size="22">mdi-tune-variant</v-icon>
                <div class="metric-label">Feature Set</div>
                <div class="metric-value">
                  {{ chipDetails.features?.length ? `${chipDetails.features.length} enabled` : 'Not reported' }}
                </div>
                <div class="metric-caption">See the feature list below</div>
              </div>
            </v-col>
            <v-col cols="12" sm="4">
              <div class="metric-card">
                <v-icon class="metric-icon" size="22">mdi-information-slab-circle</v-icon>
                <div class="metric-label">Status</div>
                <div class="metric-value">Ready</div>
                <div class="metric-caption">Device details retrieved</div>
              </div>
            </v-col>
          </v-row>

          <div class="features-block">
            <div class="section-title">
              <v-icon size="18" class="me-2">mdi-star-circle-outline</v-icon>
              Feature Set
            </div>
            <v-chip-group column class="feature-chip-group">
              <v-chip
                v-for="feature in chipDetails.features"
                :key="feature"
                class="feature-chip"
                color="primary"
                variant="tonal"
                size="small"
              >
                <v-icon size="16" start class="feature-chip__icon">mdi-check-circle-outline</v-icon>
                {{ feature }}
              </v-chip>
              <v-chip
                v-if="!chipDetails.features?.length"
                class="feature-chip feature-chip--empty"
                size="small"
                variant="outlined"
              >
                Not reported
              </v-chip>
            </v-chip-group>
          </div>

          <div v-if="chipDetails.facts?.length" class="extra-details">
            <div class="section-title mb-3">
              <v-icon size="18" class="me-2">mdi-list-box-outline</v-icon>
              Extra Details
            </div>
            <v-table density="comfortable" class="extra-details-table">
              <tbody>
                <tr v-for="fact in chipDetails.facts" :key="fact.label">
                  <td class="extra-details-label">
                    <div class="d-flex align-center gap-2">
                      <v-icon v-if="fact.icon" size="16">{{ fact.icon }}</v-icon>
                      <span>{{ fact.label }}</span>
                    </div>
                  </td>
                  <td class="extra-details-value">{{ fact.value }}</td>
                </tr>
              </tbody>
            </v-table>
          </div>
        </v-card-text>
      </v-card>
    </div>
  </v-expand-transition>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  chipDetails: {
    type: Object,
    default: null,
  },
});
</script>

<style scoped>
.device-info-wrapper {
  position: relative;
}

.device-card {
  border-radius: 20px;
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--v-theme-primary) 18%, transparent) 0%,
    color-mix(in srgb, var(--v-theme-surface) 95%, transparent) 100%
  );
  border: 1px solid color-mix(in srgb, var(--v-theme-primary) 16%, transparent);
  overflow: hidden;
}

.device-card__body {
  padding: clamp(20px, 4vw, 36px);
}

.device-header {
  display: flex;
  align-items: center;
  gap: 18px;
  margin-bottom: 28px;
}

.device-avatar {
  background: color-mix(in srgb, var(--v-theme-primary) 28%, transparent);
  color: color-mix(in srgb, white 92%, transparent);
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.18);
}

.device-header__text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.device-title {
  font-size: clamp(1.2rem, 2.8vw, 1.6rem);
  font-weight: 600;
  color: color-mix(in srgb, var(--v-theme-on-surface) 96%, transparent);
}

.device-subtitle {
  font-size: 0.95rem;
  color: color-mix(in srgb, var(--v-theme-on-surface) 70%, transparent);
}

.device-meta {
  display: inline-flex;
  align-items: center;
  margin-top: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--v-theme-primary) 12%, transparent);
  color: color-mix(in srgb, var(--v-theme-on-surface) 80%, transparent);
  font-size: 0.8rem;
  letter-spacing: 0.01em;
}

.device-metrics {
  margin-bottom: 24px;
}

.metric-card {
  border-radius: 16px;
  padding: 16px;
  background: color-mix(in srgb, var(--v-theme-surface) 88%, transparent);
  border: 1px solid color-mix(in srgb, var(--v-theme-on-surface) 12%, transparent);
  min-height: 140px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.metric-icon {
  color: color-mix(in srgb, var(--v-theme-primary) 80%, transparent);
}

.metric-label {
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: color-mix(in srgb, var(--v-theme-on-surface) 60%, transparent);
}

.metric-value {
  font-size: 1.1rem;
  font-weight: 600;
  color: color-mix(in srgb, var(--v-theme-on-surface) 94%, transparent);
}

.metric-caption {
  font-size: 0.78rem;
  color: color-mix(in srgb, var(--v-theme-on-surface) 55%, transparent);
}

.features-block {
  margin-bottom: 28px;
}

.section-title {
  display: inline-flex;
  align-items: center;
  font-size: 0.95rem;
  font-weight: 600;
  color: color-mix(in srgb, var(--v-theme-on-surface) 80%, transparent);
  margin-bottom: 12px;
}

.feature-chip-group {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.feature-chip {
  border-radius: 999px;
  background: color-mix(in srgb, var(--v-theme-primary) 12%, var(--v-theme-surface) 88%) !important;
  color: color-mix(in srgb, var(--v-theme-primary) 65%, var(--v-theme-on-surface) 45%) !important;
  font-weight: 500;
  border: 1px solid color-mix(in srgb, var(--v-theme-primary) 18%, transparent) !important;
}

.feature-chip--empty {
  background: color-mix(in srgb, var(--v-theme-surface) 96%, transparent) !important;
  color: color-mix(in srgb, var(--v-theme-on-surface) 70%, transparent) !important;
  border-style: dashed !important;
}

.feature-chip :deep(.v-chip__content) {
  gap: 6px;
}

.feature-chip__icon {
  color: color-mix(in srgb, var(--v-theme-primary) 75%, var(--v-theme-on-surface) 35%);
}

.extra-details {
  border-radius: 18px;
  padding: 20px;
  background: color-mix(in srgb, var(--v-theme-surface) 92%, transparent);
  border: 1px solid color-mix(in srgb, var(--v-theme-on-surface) 10%, transparent);
}

.extra-details-table {
  border-radius: 12px;
  overflow: hidden;
  position: relative;
}

.device-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(
    circle at 12% 18%,
    color-mix(in srgb, var(--v-theme-primary) 28%, transparent) 0%,
    transparent 55%
  );
  opacity: 0.6;
  pointer-events: none;
}

.device-card__body {
  padding: clamp(16px, 3vw, 26px);
  position: relative;
}

.device-header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: clamp(16px, 3vw, 22px);
}

.device-avatar {
  background: color-mix(in srgb, var(--v-theme-primary) 28%, transparent);
  color: color-mix(in srgb, var(--v-theme-primary) 85%, var(--v-theme-on-surface) 50%);
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.14);
}

.device-info-empty {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 320px;
}

.device-empty-card {
  border-radius: 18px;
  padding: 32px 36px;
  border: 1px dashed color-mix(in srgb, var(--v-theme-primary) 20%, transparent);
  background: color-mix(in srgb, var(--v-theme-surface) 94%, transparent);
  text-align: center;
  max-width: 420px;
}

.extra-details-table :deep(td) {
  padding: 12px 14px;
  border-bottom: 1px solid color-mix(in srgb, var(--v-theme-on-surface) 12%, transparent);
}

.device-empty-card__body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
}

.extra-details-label {
  color: color-mix(in srgb, var(--v-theme-on-surface) 65%, transparent);
  font-size: 0.85rem;
  letter-spacing: 0.01em;
  color: color-mix(in srgb, var(--v-theme-on-surface) 84%, transparent);
}

.device-chip-subline-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.device-chip-subline-item :deep(.v-icon) {
  color: inherit;
  opacity: 0.95;
}

.device-summary-card {
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--v-theme-primary) 14%, transparent);
  background: linear-gradient(
      150deg,
      color-mix(in srgb, var(--v-theme-surface) 96%, transparent) 0%,
      color-mix(in srgb, var(--v-theme-primary) 10%, transparent) 65%
    ),
    linear-gradient(150deg, rgba(255, 255, 255, 0.04), transparent);
  margin-bottom: clamp(16px, 3vw, 28px);
}

.device-summary-card__content {
  padding: clamp(16px, 3vw, 24px);
}

.device-summary {
  display: flex;
  flex-wrap: wrap;
  gap: clamp(14px, 2.5vw, 22px);
  align-items: stretch;
  justify-content: space-between;
}

.summary-block {
  flex: 1 1 260px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: color-mix(in srgb, var(--v-theme-on-surface) 92%, transparent);
}

.summary-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  text-transform: uppercase;
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  font-weight: 600;
  opacity: 0.78;
}

.summary-value {
  font-size: clamp(1.05rem, 2vw, 1.35rem);
  font-weight: 680;
}

.summary-meta {
  font-size: 0.86rem;
  opacity: 0.82;
}

.summary-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 2px;
}

.summary-list__item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.82rem;
  color: color-mix(in srgb, var(--v-theme-on-surface) 80%, transparent);
}

.summary-divider {
  flex: 0 0 1px;
  align-self: stretch;
  background: color-mix(in srgb, var(--v-theme-on-surface) 18%, transparent);
  opacity: 0.6;
}

.summary-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.summary-chip {
  background: color-mix(in srgb, var(--v-theme-secondary) 18%, transparent) !important;
  color: color-mix(in srgb, var(--v-theme-on-secondary) 90%, transparent) !important;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: capitalize;
}

.summary-chip--more {
  background: transparent !important;
  color: color-mix(in srgb, var(--v-theme-on-secondary) 75%, transparent) !important;
  border-color: color-mix(in srgb, var(--v-theme-on-secondary) 35%, transparent) !important;
}

.summary-empty {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.82rem;
  color: color-mix(in srgb, var(--v-theme-on-surface) 68%, transparent);
}

@media (max-width: 959px) {
  .device-summary {
    flex-direction: column;
  }

  .summary-divider {
    display: none;
  }
}

.detail-groups {
  margin-top: 28px;
}

.detail-group-row {
  margin-bottom: -12px;
}

.detail-card {
  border-radius: 20px;
  border: 1px solid color-mix(in srgb, var(--v-theme-primary) 12%, transparent);
  background: linear-gradient(
      150deg,
      color-mix(in srgb, var(--v-theme-surface) 99%, transparent) 0%,
      color-mix(in srgb, var(--v-theme-primary) 12%, transparent) 55%,
      color-mix(in srgb, var(--v-theme-secondary) 10%, transparent) 100%
    ),
    linear-gradient(150deg, rgba(255, 255, 255, 0.04), transparent);
  box-shadow: 0 18px 34px rgba(15, 23, 42, 0.12);
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.detail-card__title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1rem;
  font-weight: 650;
  color: color-mix(in srgb, var(--v-theme-on-surface) 94%, transparent);
  padding: 20px 24px 14px;
  letter-spacing: 0.015em;
}

.detail-card__divider {
  margin: 0 22px;
  opacity: 0.35;
}

.detail-card__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px 24px 24px;
}

.detail-card__item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px 18px;
  padding: 12px 14px;
  border-radius: 14px;
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--v-theme-primary) 16%, transparent) 0%,
    color-mix(in srgb, var(--v-theme-surface) 96%, transparent) 65%
  );
  backdrop-filter: blur(14px);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
}

.detail-card__item-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: color-mix(in srgb, var(--v-theme-on-surface) 80%, transparent);
  font-size: 0.87rem;
  letter-spacing: 0.01em;
}

.detail-card__item-label :deep(.v-icon) {
  color: inherit;
  opacity: 0.9;
}

.detail-card__item-value {
  font-weight: 650;
  font-size: 0.92rem;
  color: color-mix(in srgb, var(--v-theme-on-surface) 98%, transparent);
  text-align: right;
  color: color-mix(in srgb, var(--v-theme-on-surface) 92%, transparent);
  word-break: break-word;
}

@media (max-width: 959px) {
  .detail-group-row {
    margin-bottom: 0;
  }
}

@media (max-width: 599px) {
  .detail-card__item {
    grid-template-columns: 1fr;
    align-items: flex-start;
  }

  .detail-card__item-value {
    text-align: left;
  }
}
</style>

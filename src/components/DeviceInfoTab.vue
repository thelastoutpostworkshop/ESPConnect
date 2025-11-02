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
defineProps({
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
}

.extra-details-table :deep(table) {
  width: 100%;
  border-collapse: collapse;
}

.extra-details-table :deep(td) {
  padding: 12px 14px;
  border-bottom: 1px solid color-mix(in srgb, var(--v-theme-on-surface) 12%, transparent);
}

.extra-details-table :deep(tbody tr:last-child td) {
  border-bottom: none;
}

.extra-details-label {
  color: color-mix(in srgb, var(--v-theme-on-surface) 65%, transparent);
  font-size: 0.85rem;
  letter-spacing: 0.01em;
}

.extra-details-value {
  font-weight: 600;
  font-size: 0.9rem;
  text-align: right;
  color: color-mix(in srgb, var(--v-theme-on-surface) 92%, transparent);
  word-break: break-word;
}

@media (min-width: 960px) {
  .extra-details-value {
    text-align: left;
  }
}
</style>

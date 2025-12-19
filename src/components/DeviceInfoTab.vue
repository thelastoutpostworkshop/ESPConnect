<template>
  <Transition name="device-info-reveal" mode="out-in" appear>
    <div v-if="details" :key="detailsKey" class="device-info-wrapper device-info-wrapper--connected">
      <v-card class="device-card" elevation="0">
        <v-card-text class="device-card__body">
          <div class="device-header">
            <div class="device-header__text">
              <div class="device-chip-name">{{ details.description || details.name }}</div>
              <div v-if="hasDistinctDescription" class="device-chip-alias">
                {{ details.name }}
              </div>
              <div v-if="revisionLabel || details.mac" class="device-chip-subline">
                <span v-if="revisionLabel" class="device-chip-subline-item">
                  <v-icon size="20">mdi-update</v-icon>
                  {{ revisionLabel }}
                </span>
                <span v-if="details.mac" class="device-chip-subline-item">
                  <v-icon size="20">mdi-wifi</v-icon>
                  {{ details.mac }}
                </span>
              </div>
            </div>
          </div>
          <v-card class="device-summary-card" elevation="0" variant="flat" color="primary">
            <v-card-text class="device-summary-card__content">
              <div class="device-summary">
                <div class="summary-block">
                  <div class="summary-label">
                    <v-icon size="40" class="me-2">mdi-memory</v-icon>
                    {{ $t('deviceInfo.flashClock') }}
                  </div>
                  <div class="summary-value">{{ details.flashSize || $t('deviceInfo.unknown') }}</div>
                  <div v-if="details.crystal" class="summary-meta">
                    {{ $t('deviceInfo.crystal') }} {{ details.crystal }}
                  </div>
                  <div v-if="primaryFacts.length" class="summary-list">
                    <div v-for="fact in primaryFacts" :key="fact.label" class="summary-list__item">
                      <v-icon size="16" class="me-1">{{ fact.icon || 'mdi-information-outline' }}</v-icon>
                      <span>{{ fact.label }} : {{ fact.value }}</span>
                    </div>
                  </div>
                </div>
                <div class="summary-divider" role="presentation" />
                <div class="summary-block">
                  <div class="summary-label">
                    <v-icon size="40" class="me-2">mdi-lightning-bolt-outline</v-icon>
                    {{ $t('deviceInfo.featureSet') }}
                  </div>
                  <div class="summary-value ml-2">
                    {{ hasFeatures ? $t('deviceInfo.capabilitiesCount', { count: details.features.length }) : $t('deviceInfo.noFeatures') }}
                  </div>

                  <div class="summary-chips">
                    <template v-if="hasFeatures">
                      <v-chip v-for="feature in featurePreview" :key="feature" class="summary-chip" size="large"
                        variant="flat">
                        <v-icon start>mdi-check-circle</v-icon>
                        {{ feature }}
                      </v-chip>
                      <v-chip v-if="details.features.length > featurePreview.length"
                        class="summary-chip summary-chip--more" size="small" variant="outlined">
                        {{ $t('deviceInfo.moreCount', { count: details.features.length - featurePreview.length }) }}
                      </v-chip>
                    </template>
                    <div v-else class="summary-empty">
                      <v-icon size="16">mdi-eye-off-outline</v-icon>
                      <span>{{ $t('deviceInfo.noOptional') }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </v-card-text>
          </v-card>

          <div v-if="details.factGroups?.length" class="detail-groups">
            <v-row dense class="detail-group-row">
              <v-col v-for="group in details.factGroups" :key="group.title" cols="12" md="6" class="">
                <v-card elevation="0" variant="tonal" class="detail-card">
                  <v-card-title>
                  <v-icon class="me-2">{{ group.icon }}</v-icon>
                  {{ group.title }}
                </v-card-title>
                <v-divider class="detail-card__divider" />
                <v-card-text>
                  <div v-for="fact in group.items" :key="fact.label" class="detail-card__item">
                    <div class="detail-card__item-label">
                      <v-icon v-if="fact.icon" class="me-2">{{ fact.icon }}</v-icon>
                      <span>{{ tFactLabel(fact.label) }}</span>
                    </div>
                    <div class="detail-card__item-value">
                      <template v-if="fact.label === 'PWM/LEDC'">
                        <VTooltip
                          location="top"
                          :text="$t('deviceInfo.pwmLedcInfo')"
                        >
                          <template #activator="{ props }">
                            <span class="detail-card__value-with-icon" v-bind="props">
                              <span>{{ fact.value }}</span>
                              <v-icon size="16" class="detail-card__tooltip-icon">mdi-information-outline</v-icon>
                            </span>
                          </template>
                        </VTooltip>
                      </template>
                      <template v-else-if="isUrl(fact.value)">
                        <a :href="fact.value" target="_blank" rel="noopener" class="detail-card__link">
                          <v-icon size="16" class="detail-card__link-icon">mdi-open-in-new</v-icon>
                        </a>
                      </template>
                      <template v-else>
                        {{ fact.value }}
                      </template>
                    </div>
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
            </v-row>
          </div>
        </v-card-text>
      </v-card>
    </div>
    <div v-else key="device-info-empty" class="device-info-empty">
      <DisconnectedState :title="$t('disconnected.noDevice')" :subtitle="$t('disconnected.deviceInfo')" />
    </div>
  </Transition>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import DisconnectedState from './DisconnectedState.vue';
import {PRIMARY_FACTS} from  '../constants/deviceFacts';

const { t } = useI18n();

function tFactLabel(label) {
  const map = {
    'Chip Variant': t('facts.chipVariant'),
    'Revision': t('facts.revision'),
    'Max CPU Frequency': t('facts.maxCpuFreq'),
    'CPU Cores': t('facts.cpuCores'),
  };
  return map[label] || label;
}

const props = defineProps({
  chipDetails: {
    type: Object,
    default: null,
  },
});

const urlPattern = /^https?:\/\//i;
const isUrl = value => typeof value === 'string' && urlPattern.test(value);

const details = computed(() => {
  const candidate = props.chipDetails;
  if (candidate && typeof candidate === 'object' && 'value' in candidate && !Array.isArray(candidate)) {
    return candidate.value ?? null;
  }
  return candidate ?? null;
});

const revisionLabel = computed(() => {
  const facts = details.value?.facts;
  if (!Array.isArray(facts)) return null;
  return facts.find(fact => fact.label === 'Revision')?.value ?? null;
});

const detailsKey = computed(() => {
  if (!details.value) return 'disconnected';
  const signatureParts = [details.value.mac, revisionLabel.value, details.value.name].filter(Boolean);
  return signatureParts.join('|');
});

const hasDistinctDescription = computed(() => {
  if (!details.value) return false;
  const { name, description } = details.value;
  return Boolean(description) && description !== name;
});

const primaryFacts = computed(() => {
  const facts = Array.isArray(details.value?.facts) ? details.value.facts : [];
  if (!facts.length) return [];
  const preferredOrder = PRIMARY_FACTS;
  const selected = [];
  const seen = new Set();

  for (const label of preferredOrder) {
    const match = facts.find(fact => fact.label === label && fact.value);
    if (match && !seen.has(match.label)) {
      selected.push(match);
      seen.add(match.label);
    }
    if (selected.length >= 3) break;
  }

  if (selected.length < 3) {
    for (const fact of facts) {
      if (fact?.value && !seen.has(fact.label)) {
        selected.push(fact);
        seen.add(fact.label);
        if (selected.length >= 3) break;
      }
    }
  }

  return selected;
});

const hasFeatures = computed(
  () => Array.isArray(details.value?.features) && details.value.features.length > 0
);

const featurePreview = computed(() => {
  if (!hasFeatures.value) return [];
  const limit = 6;
  return details.value.features.slice(0, limit);
});

</script>

<style scoped>
.device-info-wrapper {
  position: relative;
}

.device-info-reveal-enter-active,
.device-info-reveal-leave-active {
  transition:
    opacity 0.32s ease,
    transform 0.5s cubic-bezier(0.22, 1, 0.36, 1),
    filter 0.32s ease;
}

.device-info-reveal-enter-from,
.device-info-reveal-leave-to {
  opacity: 0;
  transform: translateY(18px) scale(0.985);
  filter: blur(3px);
}

.device-info-wrapper--connected .device-card {
  animation: device-card-rise 0.64s cubic-bezier(0.2, 0.8, 0.25, 1) 0.04s both;
  transform-origin: center 12%;
}

.device-info-wrapper--connected .device-summary-card,
.device-info-wrapper--connected .detail-card__item {
  animation: device-info-fade-in 0.54s cubic-bezier(0.16, 1, 0.3, 1) 0.14s both;
}

.device-info-wrapper--connected .detail-card__item:nth-child(2n) {
  animation-delay: 0.18s;
}

@keyframes device-card-rise {
  from {
    transform: translateY(14px) scale(0.985);
    box-shadow:
      0 22px 32px rgba(8, 23, 47, 0.18),
      inset 0 1px 0 rgba(255, 255, 255, 0.18);
  }

  to {
    transform: translateY(0) scale(1);
    box-shadow:
      0 12px 22px rgba(8, 23, 47, 0.14),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }
}

@keyframes device-info-fade-in {
  from {
    opacity: 0;
    transform: translateY(12px);
    filter: blur(2px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
    filter: blur(0);
  }
}

.device-card {
  border-radius: 20px;
  background: linear-gradient(135deg,
      color-mix(in srgb, var(--v-theme-primary) 22%, transparent) 0%,
      color-mix(in srgb, var(--v-theme-surface) 96%, transparent) 55%,
      color-mix(in srgb, var(--v-theme-secondary) 14%, transparent) 100%);
  border: 1px solid color-mix(in srgb, var(--v-theme-primary) 16%, transparent);
  overflow: hidden;
  position: relative;
}

.device-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 12% 18%,
      color-mix(in srgb, var(--v-theme-primary) 28%, transparent) 0%,
      transparent 55%);
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

.device-header__text {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.device-chip-name {
  font-size: clamp(1.6rem, 3.2vw, 2.1rem);
  font-weight: 670;
  letter-spacing: 0.01em;
  color: color-mix(in srgb, var(--v-theme-on-surface) 98%, transparent);
}

.device-chip-alias {
  font-size: clamp(0.9rem, 2vw, 1.05rem);
  color: color-mix(in srgb, var(--v-theme-on-surface) 62%, transparent);
}

.device-chip-subline {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
  margin-top: 6px;
  font-size: clamp(0.95rem, 2.1vw, 1.15rem);
  font-weight: 600;
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
  background: linear-gradient(150deg,
      color-mix(in srgb, var(--v-theme-surface) 96%, transparent) 0%,
      color-mix(in srgb, var(--v-theme-primary) 10%, transparent) 65%),
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
  font-size: 1.5rem;
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
  background: linear-gradient(150deg,
      color-mix(in srgb, var(--v-theme-surface) 99%, transparent) 0%,
      color-mix(in srgb, var(--v-theme-primary) 12%, transparent) 55%,
      color-mix(in srgb, var(--v-theme-secondary) 10%, transparent) 100%),
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
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  align-items: flex-start;
  gap: 10px 14px;
  padding: 12px 14px;
  border-radius: 14px;
  background: linear-gradient(135deg,
      color-mix(in srgb, var(--v-theme-primary) 16%, transparent) 0%,
      color-mix(in srgb, var(--v-theme-surface) 96%, transparent) 65%);
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
  line-height: 1.3;
  flex-wrap: wrap;
  word-break: break-word;
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
  word-break: break-word;
  white-space: normal;
  line-height: 1.3;
}

.detail-card__link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  justify-content: flex-end;
  color: inherit;
  text-decoration: none;
  word-break: break-all;
}

.detail-card__link:hover {
  text-decoration: underline;
}

.detail-card__link-icon {
  opacity: 0.75;
}

.detail-card__value-with-icon {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
  max-width: 100%;
  text-align: right;
}

.detail-card__tooltip-icon {
  opacity: 0.7;
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

@media (max-width: 720px) {
  .detail-card__item {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {

  .device-info-reveal-enter-active,
  .device-info-reveal-leave-active {
    transition: none;
  }

  .device-info-wrapper--connected .device-card,
  .device-info-wrapper--connected .device-summary-card,
  .device-info-wrapper--connected .detail-card__item {
    animation: none;
  }
}
</style>

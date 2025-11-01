<template>
  <div class="monitor-shell">
    <v-card class="monitor-card" variant="tonal">
      <v-card-title class="monitor-card__title">
        <div class="monitor-card__heading">
          <span class="monitor-card__badge" :class="{ 'monitor-card__badge--live': monitorActive }" />
          <div class="monitor-card__label">
            <v-icon class="me-2" size="20">mdi-monitor</v-icon>
            Serial Monitor
          </div>
          <v-chip
            class="monitor-card__status"
            :color="monitorActive ? 'success' : 'grey-darken-1'"
            size="small"
            density="comfortable"
            label
          >
            <v-icon size="16" start>mdi-circle-medium</v-icon>
            {{ monitorActive ? 'Live' : 'Stopped' }}
          </v-chip>
        </div>
        <div class="monitor-card__actions">
          <v-btn
            color="primary"
            variant="tonal"
            size="small"
            prepend-icon="mdi-play-circle"
            :disabled="monitorActive || !canStart"
            @click="emit('start-monitor')"
          >
            Start
          </v-btn>
          <v-btn
            color="primary"
            variant="text"
            size="small"
            prepend-icon="mdi-stop-circle"
            :disabled="!monitorActive"
            @click="emit('stop-monitor')"
          >
            Stop
          </v-btn>
          <v-btn
            color="secondary"
            variant="text"
            size="small"
            prepend-icon="mdi-eraser"
            :disabled="!hasMonitorOutput"
            @click="emit('clear-monitor')"
          >
            Clear
          </v-btn>
          <v-btn
            color="error"
            variant="tonal"
            size="small"
            prepend-icon="mdi-power-cycle"
            :disabled="!canCommand"
            @click="emit('reset-board')"
          >
            Reset
          </v-btn>
        </div>
      </v-card-title>
      <v-divider />
      <v-card-text ref="terminalEl" class="monitor-terminal">
        <pre class="monitor-terminal__output">
{{ displayText }}
        </pre>
      </v-card-text>
    </v-card>

    <v-alert
      v-if="monitorError"
      type="warning"
      variant="tonal"
      class="monitor-alert"
      icon="mdi-alert-circle-outline"
    >
      {{ monitorError }}
    </v-alert>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue';

const props = defineProps({
  monitorText: {
    type: String,
    default: '',
  },
  monitorActive: {
    type: Boolean,
    default: false,
  },
  monitorError: {
    type: String,
    default: null,
  },
  canStart: {
    type: Boolean,
    default: false,
  },
  canCommand: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['start-monitor', 'stop-monitor', 'clear-monitor', 'reset-board']);

const terminalEl = ref(null);
const displayText = computed(
  () => props.monitorText || 'Monitor output will appear here once started.'
);
const hasMonitorOutput = computed(() => Boolean(props.monitorText && props.monitorText.length));

watch(
  () => props.monitorText,
  async () => {
    await nextTick();
    const target =
      terminalEl.value && '$el' in terminalEl.value ? terminalEl.value.$el : terminalEl.value;
    const el = target instanceof HTMLElement ? target : null;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }
);

watch(
  () => props.monitorActive,
  async active => {
    if (!active) return;
    await nextTick();
    const target =
      terminalEl.value && '$el' in terminalEl.value ? terminalEl.value.$el : terminalEl.value;
    const el = target instanceof HTMLElement ? target : null;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }
);

onMounted(() => {
  const target =
    terminalEl.value && '$el' in terminalEl.value ? terminalEl.value.$el : terminalEl.value;
  const el = target instanceof HTMLElement ? target : null;
  if (el) {
    el.scrollTop = el.scrollHeight;
  }
});
</script>

<style scoped>
.monitor-shell {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.monitor-card {
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--v-theme-primary) 18%, transparent);
  background: color-mix(in srgb, var(--v-theme-surface) 92%, transparent);
  overflow: hidden;
}

.monitor-card__title {
  display: flex;
  align-items: center;
  gap: 16px;
  justify-content: space-between;
}

.monitor-card__heading {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.monitor-card__badge {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--v-theme-on-surface) 45%, transparent);
  box-shadow: 0 0 0 2px rgba(15, 23, 42, 0.12);
}

.monitor-card__badge--live {
  background: color-mix(in srgb, var(--v-theme-success) 85%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--v-theme-success) 35%, transparent);
}

.monitor-card__label {
  display: inline-flex;
  align-items: center;
  font-size: 0.95rem;
  font-weight: 600;
}

.monitor-card__status {
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.2);
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

.monitor-card__actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.monitor-terminal {
  background: rgba(15, 23, 42, 0.85);
  border-radius: 12px;
  padding: 14px;
  max-height: 420px;
  overflow-y: auto;
  border: 1px solid rgba(148, 163, 184, 0.2);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
}

.monitor-terminal::-webkit-scrollbar {
  width: 8px;
}

.monitor-terminal::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.35);
  border-radius: 999px;
}

.monitor-terminal__output {
  margin: 0;
  font-family: 'Roboto Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 0.9rem;
  line-height: 1.48;
  white-space: pre-wrap;
  color: rgba(226, 232, 240, 0.9);
  min-height: 260px;
}

.monitor-alert {
  margin-top: 4px;
}

@media (max-width: 959px) {
  .monitor-card__title {
    flex-direction: column;
    align-items: flex-start;
  }

  .monitor-card__actions {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>

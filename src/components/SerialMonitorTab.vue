<template>
  <div class="console-tab">
    <div class="console-toolbar">
      <v-btn
        color="primary"
        variant="outlined"
        density="comfortable"
        :disabled="monitorActive || !canStart"
        @click="emit('start-monitor')"
      >
        <v-icon start>mdi-play-circle</v-icon>
        Start Monitor
      </v-btn>
      <v-btn
        color="primary"
        variant="outlined"
        density="comfortable"
        :disabled="!monitorActive"
        @click="emit('stop-monitor')"
      >
        <v-icon start>mdi-stop-circle</v-icon>
        Stop Monitor
      </v-btn>
      <v-btn
        color="surface"
        variant="outlined"
        density="comfortable"
        :disabled="!monitorText"
        @click="emit('clear-monitor')"
      >
        <v-icon start>mdi-eraser</v-icon>
        Clear
      </v-btn>
      <v-btn
        color="error"
        variant="outlined"
        density="comfortable"
        :disabled="!canCommand"
        @click="emit('reset-board')"
      >
        <v-icon start>mdi-power-cycle</v-icon>
        Reset Board
      </v-btn>
      <v-spacer />
      <v-chip
        class="console-status"
        :color="monitorActive ? 'success' : 'grey-darken-1'"
        variant="elevated"
        density="comfortable"
      >
        <v-icon start>{{ monitorActive ? 'mdi-monitor-eye' : 'mdi-monitor-off' }}</v-icon>
        {{ monitorActive ? 'Live' : 'Stopped' }}
      </v-chip>
    </div>

    <v-card class="console-output-card" elevation="4">
      <v-card-text class="console-output-wrapper">
        <pre ref="outputEl" class="console-output">
{{ monitorText || 'Monitor output will appear here once started.' }}
        </pre>
      </v-card-text>
    </v-card>

    <v-alert
      v-if="monitorError"
      type="warning"
      variant="tonal"
      class="mt-4"
      icon="mdi-alert-circle-outline"
    >
      {{ monitorError }}
    </v-alert>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';

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

const outputEl = ref(null);

watch(
  () => props.monitorText,
  () => {
    if (outputEl.value) {
      outputEl.value.scrollTop = outputEl.value.scrollHeight;
    }
  }
);
</script>

<style scoped>
.console-tab {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.console-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.console-output-card {
  border-radius: 16px;
  background: color-mix(in srgb, var(--v-theme-surface) 94%, transparent);
  border: 1px solid color-mix(in srgb, var(--v-theme-primary) 12%, transparent);
}

.console-output-wrapper {
  padding: 0;
}

.console-output {
  margin: 0;
  padding: 18px 20px;
  min-height: 260px;
  max-height: 540px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: 'Fira Code', 'JetBrains Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
  font-size: 0.92rem;
  line-height: 1.45;
  color: color-mix(in srgb, var(--v-theme-on-surface) 92%, transparent);
}

.console-status {
  min-width: 120px;
  justify-content: center;
}
</style>

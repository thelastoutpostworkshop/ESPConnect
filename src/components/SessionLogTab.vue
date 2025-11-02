<template>
  <v-card class="session-log-card" variant="tonal">
    <v-card-title class="session-log-title">
      <div class="title-text">
        <v-icon class="me-2" size="20">mdi-monitor</v-icon>
        Session Log
      </div>
      <v-btn
        variant="text"
        color="primary"
        size="small"
        prepend-icon="mdi-trash-can-outline"
        :disabled="!logText"
        @click="emit('clear-log')"
      >
        Clear
      </v-btn>
    </v-card-title>
    <v-divider></v-divider>
    <v-card-text class="log-surface">
      <pre class="log-output">{{ logText || 'Logs will appear here once actions begin.' }}</pre>
    </v-card-text>
  </v-card>
</template>

<script setup>
defineProps({
  logText: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['clear-log']);
</script>

<style scoped>
.session-log-card {
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--v-theme-primary) 18%, transparent);
  background: color-mix(in srgb, var(--v-theme-surface) 92%, transparent);
}

.session-log-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
  gap: 16px;
}

.title-text {
  display: inline-flex;
  align-items: center;
  font-size: 0.95rem;
}

.log-surface {
  background: rgba(15, 23, 42, 0.75);
  border-radius: 12px;
  padding: 14px;
  max-height: 360px;
  overflow-y: auto;
}

.log-output {
  margin: 0;
  font-family: 'Roboto Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 0.9rem;
  line-height: 1.45;
  white-space: pre-wrap;
  color: rgba(226, 232, 240, 0.9);
}
</style>

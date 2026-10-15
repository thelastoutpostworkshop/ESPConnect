<template>
  <v-app>
    <v-main>
      <v-container class="diagnostic-container py-8">
        <v-card rounded="lg" variant="outlined">
          <v-card-title class="text-wrap">{{ t('flashReadSuite.title') }}</v-card-title>
          <v-card-subtitle class="text-wrap pb-4">{{ t('flashReadSuite.subtitle') }}</v-card-subtitle>
          <v-card-text>
            <v-alert type="info" variant="tonal" class="mb-4">{{ t('flashReadSuite.isolation') }}</v-alert>
            <p class="mb-2">{{ t('flashReadSuite.readOnly') }}</p>
            <p class="mb-2">{{ t('flashReadSuite.plan') }}</p>
            <p class="mb-2">{{ t('flashReadSuite.budget', budgetText) }}</p>
            <p class="mb-4">{{ t('flashReadSuite.privacy') }}</p>
            <v-alert v-if="!webSerialAvailable" type="warning" variant="tonal" class="mb-4">{{ t('flashReadSuite.serialUnavailable') }}</v-alert>
            <v-alert v-if="checkpointFailed" type="warning" variant="tonal" class="mb-4" data-testid="diagnostic-checkpoint-warning">{{ t('flashReadSuite.checkpointFailed') }}</v-alert>
            <v-alert v-if="state.phase === 'recovery'" type="warning" variant="tonal" class="mb-4" data-testid="diagnostic-recovery">
              <p>{{ t('flashReadSuite.recovery') }}</p>
              <v-checkbox v-model="recoveryConfirmed" :label="t('flashReadSuite.recoveryConfirm')" :disabled="busy" hide-details data-testid="diagnostic-recovery-confirm" />
            </v-alert>
            <div class="d-flex flex-wrap ga-3 mb-4">
              <v-btn color="primary" :disabled="busy || !webSerialAvailable || !nextTrial || (state.phase === 'recovery' && !recoveryConfirmed)" @click="startRun" data-testid="diagnostic-start">
                {{ t(hasActivity ? 'flashReadSuite.resume' : 'flashReadSuite.start') }}
              </v-btn>
              <v-btn variant="outlined" :disabled="!busy || cancelling" @click="cancelRun" data-testid="diagnostic-cancel">{{ t('flashReadSuite.cancel') }}</v-btn>
              <v-btn variant="outlined" :disabled="busy || !nextTrial" @click="skipTrial" data-testid="diagnostic-skip">{{ t('flashReadSuite.skip') }}</v-btn>
              <v-btn variant="tonal" :disabled="!reportUrl || !hasActivity" :href="reportUrl || undefined" :download="reportFilename" data-testid="diagnostic-save">{{ t('flashReadSuite.saveReport') }}</v-btn>
              <v-btn variant="text" :disabled="busy || !hasActivity" @click="resetSuite" data-testid="diagnostic-reset">{{ t('flashReadSuite.reset') }}</v-btn>
            </div>
            <p role="status" class="mb-2" data-testid="diagnostic-status">{{ t(`flashReadSuite.status.${displayPhase}`) }}</p>
            <p class="mb-2" data-testid="diagnostic-progress">{{ t('flashReadSuite.progress', counts) }}</p>
            <p v-if="nextTrial" class="mb-4">{{ t('flashReadSuite.next', { trial: trialLabel(nextTrial) }) }}</p>
            <p v-if="cancelling" class="mb-4">{{ t('flashReadSuite.cancelWait') }}</p>
            <p v-if="restored" class="mb-4" data-testid="diagnostic-restored">{{ t('flashReadSuite.restored') }}</p>
            <v-table density="compact" class="mb-4 diagnostic-table" data-testid="diagnostic-cases">
              <thead><tr>
                <th>{{ t('flashReadSuite.columns.trial') }}</th>
                <th>{{ t('flashReadSuite.columns.range') }}</th>
                <th>{{ t('flashReadSuite.columns.settings') }}</th>
                <th>{{ t('flashReadSuite.columns.status') }}</th>
              </tr></thead>
              <tbody><tr v-for="trial in state.trials" :key="trial.id" :data-testid="`diagnostic-trial-${trial.id}`">
                <td>{{ trialLabel(trial) }}</td>
                <td>{{ t('flashReadSuite.range', { address: `0x${trial.config.address.toString(16)}`, size: trial.config.size }) }}</td>
                <td>{{ t('flashReadSuite.settings', { packet: trial.config.packetSize, delay: trial.config.ackDelayMs }) }}</td>
                <td>{{ t(`flashReadSuite.trialStatus.${trial.status}`) }}</td>
              </tr></tbody>
            </v-table>
            <h2 class="text-h6 mb-2">{{ t('flashReadSuite.sessionLog') }}</h2>
            <p class="text-body-2 mb-3">{{ t('flashReadSuite.localReport') }}</p>
            <pre v-if="state.events.length" class="diagnostic-log" data-testid="diagnostic-log">{{ logText }}</pre>
            <p v-else class="text-medium-emphasis">{{ t('flashReadSuite.emptyLog') }}</p>
          </v-card-text>
        </v-card>
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { version } from '../package.json';
import { clearFlashReadLocalEvidence, getFlashReadLocalAnalysis, runFlashReadTrial } from './services/chunkReadDiagnostic';
import {
  FLASH_READ_CHECKPOINT_KEY, FlashReadSuiteRunner, estimateSuiteBudget, makeFlashReadSuiteReport,
  mergeFirstLocalAnalysis, newFlashReadSuite, restoreFlashReadSuite, saveFlashReadSuite, type FlashReadSuiteState, type SuiteTrial,
} from './services/flashReadSuite';

const { t } = useI18n();
const environment = () => ({ appVersion: version, userAgent: navigator.userAgent,
  platform: navigator.platform, initialVisibility: document.visibilityState });
function readCheckpoint() {
  try { return restoreFlashReadSuite(sessionStorage.getItem(FLASH_READ_CHECKPOINT_KEY)); } catch { return null; }
}
const checkpoint = readCheckpoint();
const state = ref<FlashReadSuiteState>(checkpoint ?? newFlashReadSuite(environment()));
const restored = ref(Boolean(checkpoint));
const checkpointFailed = ref(false);
const recoveryConfirmed = ref(false);
const busy = ref(false);
const choosing = ref(false);
const chooserCancelled = ref(false);
const reportUrl = ref('');
let disposed = false;
let runner = new FlashReadSuiteRunner(state.value, changed);
const webSerialAvailable = typeof navigator.serial?.requestPort === 'function';
const nextTrial = computed(() => state.value.trials.find(trial => trial.status === 'pending'));
const hasActivity = computed(() => state.value.events.length > 0 || state.value.trials.some(trial => trial.status !== 'pending'));
const cancelling = computed(() => chooserCancelled.value || state.value.phase === 'cancelling');
const displayPhase = computed(() => cancelling.value ? 'cancelling' : choosing.value ? 'choosing' : state.value.phase);
const budgetText = computed(() => {
  const budget = estimateSuiteBudget(state.value.trials);
  return { count: budget.trials, kib: Math.round(budget.bytes / 1024), wire: budget.wireSeconds.toFixed(1),
    escaped: budget.escapedWireSeconds.toFixed(1), minutes: Math.ceil(budget.estimatedSeconds / 60) };
});
const counts = computed(() => ({ total: state.value.trials.length,
  passed: state.value.trials.filter(trial => trial.status === 'passed').length,
  failed: state.value.trials.filter(trial => ['failed', 'cancelled', 'interrupted'].includes(trial.status)).length,
  skipped: state.value.trials.filter(trial => trial.status === 'skipped').length,
  pending: state.value.trials.filter(trial => ['pending', 'running'].includes(trial.status)).length }));
const reportFilename = computed(() => `espconnect-flash-read-suite-${state.value.startedAt.replace(/[:.]/g, '-')}.json`);
const logText = computed(() => state.value.events.map(event => `[${event.at}] ${event.message}`).join('\n'));
function trialLabel(trial: SuiteTrial) {
  const key = trial.id.replace(/-\d$/, '');
  return t(`flashReadSuite.cases.${key}`, { repeat: trial.repeat });
}
function revokeReport() {
  if (reportUrl.value) URL.revokeObjectURL(reportUrl.value);
  reportUrl.value = '';
}
function refreshReport() {
  if (disposed) return;
  revokeReport();
  try {
    const report = makeFlashReadSuiteReport(state.value, state.value.localAnalysis ?? getFlashReadLocalAnalysis());
    reportUrl.value = URL.createObjectURL(new Blob([`${JSON.stringify(report, null, 2)}\n`], { type: 'application/json' }));
  } catch { /* Keep the suite usable if the browser cannot prepare a download. */ }
}
function changed(next: FlashReadSuiteState) {
  if (disposed) return;
  // Preserve payload-free comparison findings even after their in-memory bytes are gone.
  next.localAnalysis = mergeFirstLocalAnalysis(next.localAnalysis ?? state.value.localAnalysis, getFlashReadLocalAnalysis());
  state.value = next;
  try { checkpointFailed.value = !saveFlashReadSuite(sessionStorage, next); } catch { checkpointFailed.value = true; }
  refreshReport();
}
function cancelRun() {
  if (!busy.value || cancelling.value) return;
  if (choosing.value) {
    chooserCancelled.value = true;
    runner.note('Port chooser cancellation requested. Dismiss the chooser; a late selection will not open a session.');
  } else runner.cancel();
}
async function startRun() {
  if (busy.value || disposed || !webSerialAvailable || !nextTrial.value ||
      (state.value.phase === 'recovery' && !recoveryConfirmed.value)) return;
  busy.value = true;
  choosing.value = true;
  chooserCancelled.value = false;
  const recovered = recoveryConfirmed.value;
  try {
    // requestPort stays within the explicit click's user activation.
    const port = await navigator.serial.requestPort();
    if (chooserCancelled.value || disposed) {
      if (!disposed) runner.note('Port selection returned after cancellation; no session was opened.');
      return;
    }
    choosing.value = false;
    runner.setPortInfo(port.getInfo());
    recoveryConfirmed.value = false;
    await runner.start((config, options) => runFlashReadTrial(port, config, {
      ...options, visibility: () => document.visibilityState,
      // Startup logger output can contain device identifiers and is excluded.
      log: () => undefined,
    }), recovered);
  } catch {
    if (!disposed) runner.note('Port selection did not start a trial. Choose the diagnostic device to continue.');
  } finally {
    if (disposed) clearFlashReadLocalEvidence();
    if (!disposed) {
      choosing.value = false;
      chooserCancelled.value = false;
      busy.value = false;
      refreshReport();
    }
  }
}
function skipTrial() { if (!busy.value) runner.skipNext(); }
function resetSuite() {
  if (busy.value) return;
  clearFlashReadLocalEvidence();
  revokeReport();
  try { sessionStorage.removeItem(FLASH_READ_CHECKPOINT_KEY); } catch { /* No saved checkpoint. */ }
  state.value = newFlashReadSuite(environment());
  runner = new FlashReadSuiteRunner(state.value, changed);
  restored.value = false;
  recoveryConfirmed.value = false;
  checkpointFailed.value = false;
}
function captureVisibility() {
  if (busy.value) runner.note(`Page visibility changed: ${document.visibilityState}.`);
}
onMounted(() => {
  if (checkpoint) changed(state.value);
  document.addEventListener('visibilitychange', captureVisibility);
  window.addEventListener('pagehide', cancelRun);
});
onBeforeUnmount(() => {
  disposed = true;
  runner.cancel();
  document.removeEventListener('visibilitychange', captureVisibility);
  window.removeEventListener('pagehide', cancelRun);
  clearFlashReadLocalEvidence();
  revokeReport();
});
</script>

<style scoped>
.diagnostic-container { max-width: 1120px; }
.diagnostic-table { overflow-x: auto; }
.diagnostic-log {
  max-height: 35vh;
  overflow: auto;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  padding: 1rem;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.18);
  border-radius: 8px;
  font-size: 0.8rem;
}
</style>

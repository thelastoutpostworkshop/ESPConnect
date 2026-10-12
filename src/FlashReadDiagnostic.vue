<template>
  <v-app>
    <v-main>
      <v-container class="diagnostic-container py-8">
        <v-card rounded="lg" variant="outlined">
          <v-card-title class="text-wrap">{{ t('flashReadDiagnostic.title') }}</v-card-title>
          <v-card-subtitle class="text-wrap pb-4">{{ t('flashReadDiagnostic.subtitle') }}</v-card-subtitle>
          <v-card-text>
            <v-alert type="info" variant="tonal" class="mb-4">
              {{ t('flashReadDiagnostic.isolation') }}
            </v-alert>
            <p class="mb-2">{{ t('flashReadDiagnostic.configuration', configuration) }}</p>
            <p class="mb-2">{{ t('flashReadDiagnostic.readOnly') }}</p>
            <p class="mb-2">{{ t('flashReadDiagnostic.stopOnInvalid') }}</p>
            <p class="mb-4">{{ t('flashReadDiagnostic.hardwareDisclaimer') }}</p>
            <v-alert v-if="!webSerialAvailable" type="warning" variant="tonal" class="mb-4">
              {{ t('flashReadDiagnostic.serialUnavailable') }}
            </v-alert>
            <v-select
              v-model="scenario"
              :items="scenarios"
              :label="t('flashReadDiagnostic.scenario')"
              :disabled="busy"
              hide-details
              class="mb-4"
              data-testid="diagnostic-scenario"
            />
            <div class="d-flex flex-wrap ga-3 mb-4">
              <v-btn
                color="primary"
                :disabled="busy || !webSerialAvailable"
                @click="startRun"
                data-testid="diagnostic-start"
              >
                {{ t('flashReadDiagnostic.start') }}
              </v-btn>
              <v-btn
                variant="outlined"
                :disabled="!busy || cancellationRequested"
                @click="cancelRun"
                data-testid="diagnostic-cancel"
              >
                {{ t('flashReadDiagnostic.cancel') }}
              </v-btn>
              <v-btn
                variant="tonal"
                :disabled="busy || !reportUrl"
                :href="reportUrl || undefined"
                :download="reportFilename"
                data-testid="diagnostic-save"
              >
                {{ t('flashReadDiagnostic.saveReport') }}
              </v-btn>
            </div>
            <p role="status" class="mb-4" data-testid="diagnostic-status">
              {{ t(`flashReadDiagnostic.status.${phase}`) }}
            </p>
            <p v-if="phase === 'cancelling'" class="mb-4">
              {{ t('flashReadDiagnostic.cancelWait') }}
            </p>
            <h2 class="text-h6 mb-2">{{ t('flashReadDiagnostic.sessionLog') }}</h2>
            <p class="text-body-2 mb-3">{{ t('flashReadDiagnostic.localReport') }}</p>
            <pre v-if="logLines.length" class="diagnostic-log" data-testid="diagnostic-log">{{ logLines.join('\n') }}</pre>
            <p v-else class="text-medium-emphasis">{{ t('flashReadDiagnostic.emptyLog') }}</p>
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
import { runChunkReadDiagnostic } from './services/chunkReadDiagnostic';

type Scenario = 'A' | 'B' | 'C';
type Phase = 'idle' | 'choosing' | 'running' | 'cancelling' | 'cancelled' | 'complete' | 'failed';

const { t } = useI18n();
const configuration = { baud: 115200, stub: '1.2.2', packet: 1024, window: 1, buffer: 65536 };
const scenario = ref<Scenario>('A');
const scenarios = computed(() => (['A', 'B', 'C'] as const).map((value) => ({
  value,
  title: t(`flashReadDiagnostic.scenarios.${value}`),
})));
const webSerialAvailable = typeof navigator !== 'undefined' && typeof navigator.serial?.requestPort === 'function';
const busy = ref(false);
const cancellationRequested = ref(false);
const phase = ref<Phase>('idle');
const logLines = ref<string[]>([]);
const reportUrl = ref('');
const reportFilename = ref('espconnect-chunk-read-diagnostic.txt');
let controller: AbortController | null = null;
let disposed = false;

// These are diagnostic records, not translated interface text.
function appendLog(line: string) {
  if (!disposed) logLines.value.push(`[${new Date().toISOString()}] ${line}`);
}

function revokeReport() {
  if (reportUrl.value) URL.revokeObjectURL(reportUrl.value);
  reportUrl.value = '';
}

function captureVisibility() {
  if (busy.value) appendLog(`Page visibility: ${document.visibilityState}`);
}

function cancelRun() {
  if (!busy.value || cancellationRequested.value) return;
  cancellationRequested.value = true;
  phase.value = 'cancelling';
  appendLog('Cancellation requested; waiting for the port chooser or owned session cleanup to settle.');
  controller?.abort();
}

async function startRun() {
  // Also guard here: a second click must not create another chooser or session.
  if (busy.value || disposed || !webSerialAvailable) return;
  busy.value = true;
  cancellationRequested.value = false;
  phase.value = 'choosing';
  revokeReport();
  logLines.value = [];
  const selectedScenario = scenario.value;
  const startedAt = new Date().toISOString();
  const runController = new AbortController();
  controller = runController;
  reportFilename.value = `espconnect-preview6-scenario-${selectedScenario}-${startedAt.replace(/[:.]/g, '-')}.txt`;
  appendLog('ESPConnect issue #180 preview6 isolated chunk-reader diagnostic.');
  appendLog(`Application version: ${version}; scenario: ${selectedScenario}; started: ${startedAt}`);
  appendLog(`Browser: ${navigator.userAgent}`);
  appendLog(`Page visibility: ${document.visibilityState}`);
  appendLog('Configuration: ESP32-S3 official stub 1.2.2; baud=115200; packet=1024; window=1; buffer=65536.');
  appendLog('Read-only flash diagnostic; stop on first invalid frame; no automatic retries; no raw flash export.');
  appendLog('This report alone is not proof of a hardware fix.');
  try {
    // Keep requestPort in this click handler, before any awaited work.
    const port = await navigator.serial.requestPort();
    // The chooser cannot be aborted. A late selection must never open a session.
    if (runController.signal.aborted || disposed) {
      appendLog('Port selection returned after cancellation; no session was opened.');
      if (!disposed) phase.value = 'cancelled';
      return;
    }
    const info = port.getInfo();
    appendLog(`Port metadata: USB vendor=${info.usbVendorId ?? 'unknown'}; product=${info.usbProductId ?? 'unknown'}.`);
    phase.value = 'running';
    const result = await runChunkReadDiagnostic(port, selectedScenario, {
      signal: runController.signal,
      log: appendLog,
      visibility: () => document.visibilityState,
    });
    if (disposed) return;
    for (const read of result.reads) {
      appendLog(`Read summary: address=0x${read.address.toString(16)}; size=${read.size}; MD5=${read.md5}.`);
    }
    phase.value = runController.signal.aborted ? 'cancelled' : 'complete';
    appendLog(runController.signal.aborted ? 'Run cancelled; owned session cleanup settled.' : 'Run complete; owned session cleanup settled.');
  } catch (error) {
    if (disposed) return;
    const chooserDismissed = phase.value === 'choosing' && error instanceof DOMException && error.name === 'NotFoundError';
    const cancelled = runController.signal.aborted || chooserDismissed;
    phase.value = cancelled ? 'cancelled' : 'failed';
    appendLog(`${cancelled ? 'Run cancelled' : 'Run failed'}: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    if (controller === runController) controller = null;
    if (!disposed) {
      appendLog(`Run settled: ${phase.value}.`);
      try {
        reportUrl.value = URL.createObjectURL(new Blob([`${logLines.value.join('\n')}\n`], { type: 'text/plain;charset=utf-8' }));
      } catch (error) {
        appendLog(`Could not prepare local report download: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        // The service owns teardown. Never enable another start before it settles.
        busy.value = false;
      }
    }
  }
}

onMounted(() => {
  document.addEventListener('visibilitychange', captureVisibility);
  window.addEventListener('pagehide', cancelRun);
});
onBeforeUnmount(() => {
  disposed = true;
  controller?.abort();
  document.removeEventListener('visibilitychange', captureVisibility);
  window.removeEventListener('pagehide', cancelRun);
  revokeReport();
});
</script>

<style scoped>
.diagnostic-container {
  max-width: 1040px;
}

.diagnostic-log {
  max-height: 55vh;
  overflow: auto;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  padding: 1rem;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.18);
  border-radius: 8px;
  font-size: 0.8rem;
}
</style>

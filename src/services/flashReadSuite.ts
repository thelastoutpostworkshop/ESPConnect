import type { FlashReadTrialConfig, FlashReadTrialEvidence } from './chunkReadDiagnostic';
import { projectLocalAnalysis, projectSuiteMetadata, projectTrialMetadata } from './flashReadSuiteMetadata';

export const FLASH_READ_SUITE_ID = 'issue-180-flash-read-suite-v2';
export const FLASH_READ_CHECKPOINT_KEY = 'espconnect-flash-read-suite-v2';
export type SuiteTrialStatus = 'pending' | 'running' | 'passed' | 'failed' | 'cancelled' | 'interrupted' | 'skipped';
export type SuitePhase = 'ready' | 'running' | 'cancelling' | 'recovery' | 'complete';
export type SuiteTrial = {
  id: string;
  comparison: 'length' | 'position' | 'packet' | 'ack';
  repeat: number;
  config: FlashReadTrialConfig;
  status: SuiteTrialStatus;
  startedAt?: string;
  endedAt?: string;
  skipReason?: 'user-requested' | 'flash-range-unsupported';
  evidence?: FlashReadTrialEvidence;
};
export type SuiteEnvironment = {
  appVersion: string;
  userAgent: string;
  platform: string;
  initialVisibility: string;
  usbVendorId?: number;
  usbProductId?: number;
};
export type FlashReadSuiteState = {
  schema: typeof FLASH_READ_SUITE_ID;
  startedAt: string;
  updatedAt: string;
  phase: SuitePhase;
  environment: SuiteEnvironment;
  trials: SuiteTrial[];
  firstFailureId?: string;
  recoveryCount: number;
  events: { at: string; message: string }[];
  droppedEvents: number;
  localAnalysis?: unknown;
};
export type TrialRunner = (config: FlashReadTrialConfig, options: {
  signal: AbortSignal;
  onEvidence: (evidence: FlashReadTrialEvidence) => void;
}) => Promise<FlashReadTrialEvidence>;
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** The three target-position repeats also supply the baseline 3 KiB length case. */
export function createFlashReadSuitePlan(): SuiteTrial[] {
  const trials: SuiteTrial[] = [];
  const add = (id: string, comparison: SuiteTrial['comparison'], address: number, size: number,
    packetSize: 256 | 512 | 1024 = 1024, ackDelayMs: 0 | 5 = 0, repeat = 1) => {
    trials.push({ id, comparison, repeat, config: { address, size, packetSize, ackDelayMs }, status: 'pending' });
  };
  // Acquire a checksum-verified reference for the exact target before longer streams.
  for (let repeat = 1; repeat <= 3; repeat++) {
    add(`target-alone-${repeat}`, 'position', 0x810800, 1024, 1024, 0, repeat);
    add(`target-second-${repeat}`, 'position', 0x810400, 2048, 1024, 0, repeat);
    add(`target-third-${repeat}`, 'position', 0x810000, 3072, 1024, 0, repeat);
  }
  add('length-1k', 'length', 0x810000, 1024);
  add('length-8k', 'length', 0x810000, 8192);
  add('length-64k', 'length', 0x810000, 65536);
  add('packet-256', 'packet', 0x810000, 8192, 256);
  add('packet-512', 'packet', 0x810000, 8192, 512);
  add('ack-delay-5ms', 'ack', 0x810000, 3072, 1024, 5);
  return trials;
}

export function estimateSuiteBudget(trials: readonly SuiteTrial[]) {
  const pending = trials.filter(trial => trial.status === 'pending');
  const bytes = pending.reduce((sum, trial) => sum + trial.config.size, 0);
  const packets = pending.reduce((sum, trial) => sum + Math.ceil(trial.config.size / trial.config.packetSize), 0);
  // 8N1 at 115200 baud, delimiters, cumulative four-byte ACKs, and final MD5.
  // The upper wire estimate allows every data byte to require SLIP escaping.
  const wireSeconds = (bytes + packets * 8 + pending.length * 18) * 10 / 115200;
  const escapedWireSeconds = (bytes * 2 + packets * 12 + pending.length * 34) * 10 / 115200;
  const ackSeconds = pending.reduce((sum, trial) => sum +
    Math.ceil(trial.config.size / trial.config.packetSize) * trial.config.ackDelayMs / 1000, 0);
  const startupEstimateSeconds = pending.length * 10;
  return { trials: pending.length, bytes, packets, wireSeconds, escapedWireSeconds, ackSeconds,
    startupEstimateSeconds, estimatedSeconds: escapedWireSeconds + ackSeconds + startupEstimateSeconds };
}

export function newFlashReadSuite(environment: SuiteEnvironment): FlashReadSuiteState {
  const now = new Date().toISOString();
  return { schema: FLASH_READ_SUITE_ID, startedAt: now, updatedAt: now, phase: 'ready',
    environment: copy(environment), trials: createFlashReadSuitePlan(), recoveryCount: 0,
    events: [], droppedEvents: 0 };
}

/** Restore only this exact plan. A reload never resumes an open serial stream. */
export function restoreFlashReadSuite(serialized: string | null): FlashReadSuiteState | null {
  if (!serialized || serialized.length > 4_000_000) return null;
  try {
    const state = projectSuiteMetadata(JSON.parse(serialized)) as FlashReadSuiteState;
    const plan = createFlashReadSuitePlan();
    if (state.schema !== FLASH_READ_SUITE_ID || !Array.isArray(state.trials) || state.trials.length !== plan.length ||
        typeof state.startedAt !== 'string' || !state.environment || !Array.isArray(state.events) ||
        !['ready', 'running', 'cancelling', 'recovery', 'complete'].includes(state.phase) ||
        !Number.isInteger(state.recoveryCount) || !Number.isInteger(state.droppedEvents) ||
        !['appVersion', 'userAgent', 'platform', 'initialVisibility'].every(key =>
          typeof state.environment[key as keyof SuiteEnvironment] === 'string') ||
        state.events.some(event => typeof event.at !== 'string' || typeof event.message !== 'string')) return null;
    for (let index = 0; index < plan.length; index++) {
      const actual = state.trials[index]!;
      const expected = plan[index]!;
      if (actual.id !== expected.id || JSON.stringify(actual.config) !== JSON.stringify(expected.config) ||
          actual.comparison !== expected.comparison || actual.repeat !== expected.repeat ||
          !['pending', 'running', 'passed', 'failed', 'cancelled', 'interrupted', 'skipped'].includes(actual.status)) return null;
      if (actual.status === 'passed' && (!actual.evidence || actual.evidence.status !== 'passed' ||
          actual.evidence.config.address !== expected.config.address || actual.evidence.config.size !== expected.config.size ||
          actual.evidence.config.packetSize !== expected.config.packetSize || actual.evidence.config.ackDelayMs !== expected.config.ackDelayMs ||
          actual.evidence.romSyncVerified !== true || actual.evidence.read?.received !== expected.config.size ||
          actual.evidence.read?.packets !== Math.ceil(expected.config.size / expected.config.packetSize) ||
          actual.evidence.cleanup?.closed !== true || actual.evidence.cleanup.errors?.length !== 0 ||
          actual.evidence.read?.stage !== 'verified' || !/^[a-f\d]{32}$/i.test(actual.evidence.read.md5 ?? ''))) return null;
      if (actual.status === 'running') {
        actual.status = 'interrupted';
        state.firstFailureId ??= actual.id;
      }
    }
    if (state.phase === 'running' || state.phase === 'cancelling' ||
        (state.trials.some(trial => trial.status === 'pending') &&
          state.trials.some(trial => ['failed', 'cancelled', 'interrupted'].includes(trial.status)))) {
      state.phase = 'recovery';
    }
    if (state.phase === 'complete' && state.trials.some(trial => trial.status === 'pending')) state.phase = 'ready';
    return state;
  } catch { return null; }
}

export function saveFlashReadSuite(storage: Storage, state: FlashReadSuiteState): boolean {
  try {
    const serialized = JSON.stringify(projectSuiteMetadata(state));
    if (serialized.length > 4_000_000) throw new Error('Checkpoint metadata limit reached.');
    storage.setItem(FLASH_READ_CHECKPOINT_KEY, serialized);
    return true;
  } catch {
    // Do not leave a stale checkpoint that appears to have saved newer results.
    try { storage.removeItem(FLASH_READ_CHECKPOINT_KEY); } catch { /* Storage can be disabled. */ }
    return false;
  }
}

/** Enrich the same captured failure with a later reference, preserving earlier
 * findings when a reload starts a new local capture lifetime. */
export function mergeFirstLocalAnalysis(previous: unknown, current: unknown): unknown {
  if (!previous) return projectLocalAnalysis(current);
  if (!current) return projectLocalAnalysis(previous);
  const prior = projectLocalAnalysis(previous) as { context?: { trialStartedAt?: string } };
  const next = projectLocalAnalysis(current) as { context?: { trialStartedAt?: string } };
  return prior.context?.trialStartedAt && prior.context.trialStartedAt === next.context?.trialStartedAt ? next : prior;
}

/** Owns one suite invocation; a failed or cancelled trial always needs a human resume. */
export class FlashReadSuiteRunner {
  private active = false;
  private controller: AbortController | null = null;
  constructor(public state: FlashReadSuiteState, private readonly changed: (state: FlashReadSuiteState) => void = () => {}) {}
  get busy() { return this.active; }
  private publish() {
    this.state.updatedAt = new Date().toISOString();
    this.changed(copy(this.state));
  }
  private event(message: string) {
    if (this.state.events.length < 128) this.state.events.push({ at: new Date().toISOString(), message });
    else this.state.droppedEvents++;
  }
  note(message: string) {
    this.event(message);
    this.publish();
  }
  setPortInfo(info: SerialPortInfo) {
    this.state.environment.usbVendorId = info.usbVendorId;
    this.state.environment.usbProductId = info.usbProductId;
    this.event(`Port selected: USB vendor=${info.usbVendorId ?? 'unknown'}, product=${info.usbProductId ?? 'unknown'}; no serial identifier recorded.`);
    this.publish();
  }
  cancel() {
    if (!this.active || this.controller?.signal.aborted) return;
    this.state.phase = 'cancelling';
    this.event('Cancellation requested; awaiting owned session teardown.');
    this.controller?.abort();
    this.publish();
  }
  skipNext() {
    if (this.active) return false;
    const next = this.state.trials.find(trial => trial.status === 'pending');
    if (!next) return false;
    next.status = 'skipped';
    next.skipReason = 'user-requested';
    next.endedAt = new Date().toISOString();
    this.event(`Skipped ${next.id}; this is not a successful read.`);
    if (this.state.phase !== 'recovery' && !this.state.trials.some(trial => trial.status === 'pending')) this.state.phase = 'complete';
    this.publish();
    return true;
  }
  async start(runTrial: TrialRunner, recoveryConfirmed = false): Promise<boolean> {
    if (this.active || (this.state.phase === 'recovery' && !recoveryConfirmed)) return false;
    if (!this.state.trials.some(trial => trial.status === 'pending')) return false;
    this.active = true;
    this.controller = new AbortController();
    const signal = this.controller.signal;
    if (this.state.phase === 'recovery') {
      this.state.recoveryCount++;
      this.event('User confirmed physical reconnect / BOOT recovery; opening a new ROM/stub session.');
    }
    this.state.phase = 'running';
    this.publish();
    try {
      for (const trial of this.state.trials) {
        if (trial.status !== 'pending') continue;
        if (signal.aborted) break;
        trial.status = 'running';
        trial.startedAt = new Date().toISOString();
        this.event(`Starting ${trial.id}; fresh session, address=0x${trial.config.address.toString(16)}, size=${trial.config.size}, packet=${trial.config.packetSize}, ACK delay=${trial.config.ackDelayMs}ms.`);
        this.publish();
        try {
          const evidence = await runTrial(trial.config, {
            signal,
            onEvidence: evidence => { trial.evidence = projectTrialMetadata(evidence) as FlashReadTrialEvidence; this.publish(); },
          });
          trial.evidence = projectTrialMetadata(evidence) as FlashReadTrialEvidence;
          trial.status = signal.aborted ? 'cancelled' : evidence.status;
          if (!evidence.cleanup.closed || evidence.cleanup.errors.length) trial.status = signal.aborted ? 'cancelled' : 'failed';
          if (!signal.aborted && evidence.failure === 'range-out-of-bounds' && evidence.flashSizeBytes &&
              evidence.cleanup.closed && !evidence.cleanup.errors.length) {
            trial.status = 'skipped';
            trial.skipReason = 'flash-range-unsupported';
            for (const pending of this.state.trials) {
              if (pending.status === 'pending' && pending.config.address + pending.config.size > evidence.flashSizeBytes) {
                pending.status = 'skipped';
                pending.skipReason = 'flash-range-unsupported';
                pending.endedAt = new Date().toISOString();
              }
            }
            this.event(`Detected flash capacity=${evidence.flashSizeBytes} bytes; unsupported ranges skipped without reading.`);
          }
        } catch {
          // Unknown exceptions are not copied to disk: upstream error messages can contain secrets.
          trial.status = signal.aborted ? 'cancelled' : 'failed';
          this.event('Trial runner stopped before returning complete evidence. Review the partial report.');
        }
        trial.endedAt = new Date().toISOString();
        if (trial.status !== 'passed' && trial.status !== 'skipped') {
          this.state.firstFailureId ??= trial.id;
          this.state.phase = 'recovery';
          this.event(`Stopped after ${trial.id}: ${trial.status}. No further trial may start until explicit recovery.`);
          this.publish();
          return true;
        }
        if (trial.status === 'passed') this.event(`Completed ${trial.id}: passed with checksum verification and closed session.`);
        this.publish();
      }
      this.state.phase = signal.aborted ? 'recovery' : 'complete';
      this.publish();
      return true;
    } finally {
      this.active = false;
      this.controller = null;
      this.publish();
    }
  }
}

export function makeFlashReadSuiteReport(state: FlashReadSuiteState, localAnalysis: unknown) {
  const counts = Object.fromEntries((['pending', 'running', 'passed', 'failed', 'cancelled', 'interrupted', 'skipped'] as const)
    .map(status => [status, state.trials.filter(trial => trial.status === status).length]));
  return {
    ...projectSuiteMetadata(state) as FlashReadSuiteState,
    summary: { counts, complete: !counts.pending && !counts.running, allPassed: counts.passed === state.trials.length },
    budget: estimateSuiteBudget(state.trials),
    interpretation: [
      'Flash reads only; no flash writes or erases. Firmware bytes and device secrets are excluded.',
      'Each independent trial establishes ROM/stub state and closes the port. Human reconnect / BOOT recovery can still be required.',
      'Skipped, cancelled, interrupted, and failed cases are not successful reads. Early valid packet lengths do not prove a final checksum.',
      'Browser receive chunk boundaries are not USB packet boundaries. A frame length deficit does not establish contiguous deletion or its origin.',
      'ACK delay changes inter-packet spacing, not intra-packet pacing. No macOS-exclusive cause is established.',
      'In-memory frame/reference comparisons are unavailable after reload; stored metadata and the first failure are retained.',
      'Wire time assumes 115200 baud 8N1 and is a budget estimate; each fresh startup is provisionally budgeted at 10 seconds. Recovery time is unbounded.',
    ],
    localAnalysis: projectLocalAnalysis(localAnalysis ?? state.localAnalysis),
  };
}

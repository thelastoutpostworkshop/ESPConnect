import { describe, expect, it, vi } from 'vitest';
import type { FlashReadTrialConfig, FlashReadTrialEvidence } from './chunkReadDiagnostic';
import {
  FLASH_READ_CHECKPOINT_KEY, FlashReadSuiteRunner, createFlashReadSuitePlan, estimateSuiteBudget,
  makeFlashReadSuiteReport, mergeFirstLocalAnalysis, newFlashReadSuite, restoreFlashReadSuite, saveFlashReadSuite,
} from './flashReadSuite';

const environment = { appVersion: 'preview6', userAgent: 'test-browser', platform: 'test-platform', initialVisibility: 'visible' };
function evidence(config: FlashReadTrialConfig, status: FlashReadTrialEvidence['status'] = 'passed'): FlashReadTrialEvidence {
  return { config, status, startedAt: '2026-10-15T00:00:00Z', stage: 'settled', elapsedMs: 1000, romSyncVerified: true,
    read: { stage: status === 'passed' ? 'verified' : 'data', received: status === 'passed' ? config.size : 0,
      packets: Math.ceil(config.size / config.packetSize), elapsedMs: 10, md5: status === 'passed' ? '0123456789abcdef0123456789abcdef' : undefined,
      acknowledgments: [] }, cleanup: { closed: true, errors: [] } };
}
const fresh = () => newFlashReadSuite(environment);

it('enriches the same captured failure but preserves its findings after a reload and later failure', () => {
  const first = { context: { trialStartedAt: 'first', address: 0x810800, expectedLength: 1024 }, referenceComparison: { status: 'unavailable' } };
  const enriched = { ...first, referenceComparison: { status: 'compared', lengthDeficit: 39 } };
  expect(mergeFirstLocalAnalysis(first, enriched)).toEqual(enriched);
  const later = { ...enriched, context: { ...enriched.context, trialStartedAt: 'second' } };
  expect(mergeFirstLocalAnalysis(enriched, later)).toEqual(enriched);
  expect(mergeFirstLocalAnalysis(enriched, undefined)).toEqual(enriched);
});

describe('controlled diagnostic suite plan', () => {
  it('covers position repeats, length, packet and ACK comparisons without a window sweep', () => {
    const plan = createFlashReadSuitePlan();
    expect(plan).toHaveLength(15);
    expect(plan[0]?.config).toEqual({ address: 0x810800, size: 1024, packetSize: 1024, ackDelayMs: 0 });
    for (const label of ['alone', 'second', 'third']) expect(plan.filter(trial => trial.id.startsWith(`target-${label}`))).toHaveLength(3);
    expect(plan.filter(trial => trial.config.address === 0x810000).map(trial => trial.config.size)).toEqual(expect.arrayContaining([1024, 3072, 8192, 65536]));
    expect(plan.filter(trial => trial.config.size === 8192).map(trial => trial.config.packetSize)).toEqual([1024, 256, 512]);
    expect(plan.filter(trial => trial.config.ackDelayMs === 5)).toHaveLength(1);
    const budget = estimateSuiteBudget(plan);
    expect(budget.bytes).toBe(110 * 1024);
    expect(budget.wireSeconds).toBeGreaterThan(9.7);
    expect(budget.estimatedSeconds).toBeLessThan(180);
    plan[0]!.status = 'skipped';
    expect(estimateSuiteBudget(plan).trials).toBe(14);
  });
});

describe('suite session ownership and recovery', () => {
  it('runs the compact plan sequentially, using one fresh-session invocation per trial', async () => {
    const runner = new FlashReadSuiteRunner(fresh());
    const run = vi.fn(async (config: FlashReadTrialConfig) => evidence(config));
    await runner.start(run);
    expect(run).toHaveBeenCalledTimes(15);
    expect(runner.state.trials.every(trial => trial.status === 'passed')).toBe(true);
    expect(runner.state.phase).toBe('complete');
    expect(makeFlashReadSuiteReport(runner.state, undefined).summary.allPassed).toBe(true);
  });

  it('preserves the first failure and requires explicit recovery before the next pending trial', async () => {
    const runner = new FlashReadSuiteRunner(fresh());
    const fail = vi.fn(async (config: FlashReadTrialConfig) => evidence(config, 'failed'));
    await runner.start(fail);
    expect(fail).toHaveBeenCalledTimes(1);
    expect(runner.state.phase).toBe('recovery');
    const first = runner.state.trials[0]!.evidence;
    expect(await runner.start(fail)).toBe(false);
    await runner.start(fail, true);
    expect(fail).toHaveBeenCalledTimes(2);
    expect(runner.state.firstFailureId).toBe('target-alone-1');
    expect(runner.state.trials[0]!.evidence).toEqual(first);
    expect(runner.state.trials[1]!.status).toBe('failed');
    expect(runner.state.recoveryCount).toBe(1);
  });

  it('keeps cancellation locked until session cleanup returns and never auto-continues', async () => {
    const runner = new FlashReadSuiteRunner(fresh());
    let finish!: () => void;
    let observedSignal!: AbortSignal;
    const operation = runner.start((config, options) => {
      observedSignal = options.signal;
      return new Promise(resolve => { finish = () => resolve(evidence(config, 'cancelled')); });
    });
    expect(runner.busy).toBe(true);
    runner.cancel();
    expect(observedSignal.aborted).toBe(true);
    expect(runner.state.phase).toBe('cancelling');
    expect(await runner.start(async config => evidence(config), true)).toBe(false);
    expect(runner.skipNext()).toBe(false);
    finish();
    await operation;
    expect(runner.busy).toBe(false);
    expect(runner.state.phase).toBe('recovery');
    expect(runner.state.trials[0]!.status).toBe('cancelled');
    expect(runner.state.trials[1]!.status).toBe('pending');
  });

  it('rejects repeated start while an invocation is active', async () => {
    const runner = new FlashReadSuiteRunner(fresh());
    let finish!: () => void;
    const run = vi.fn((config: FlashReadTrialConfig) => new Promise<FlashReadTrialEvidence>(resolve => {
      finish = () => resolve(evidence(config, 'failed'));
    }));
    const first = runner.start(run);
    const second = runner.start(run);
    expect(await second).toBe(false);
    expect(run).toHaveBeenCalledTimes(1);
    finish();
    await first;
  });

  it('pauses after failed cleanup or thrown recovery and keeps partial evidence', async () => {
    const runner = new FlashReadSuiteRunner(fresh());
    await runner.start(async (config, options) => {
      const partial = evidence(config, 'failed');
      partial.stage = 'rom';
      options.onEvidence(partial);
      throw new Error('An upstream error containing a secret must not be exported');
    });
    expect(runner.state.trials[0]!.evidence?.stage).toBe('rom');
    expect(JSON.stringify(makeFlashReadSuiteReport(runner.state, undefined))).not.toContain('containing a secret');
    await runner.start(async config => ({ ...evidence(config), cleanup: { closed: false, errors: ['port-close-failed'] } }), true);
    expect(runner.state.trials[1]!.status).toBe('failed');
    expect(runner.state.trials[2]!.status).toBe('pending');
    expect(runner.state.phase).toBe('recovery');
  });

  it('records explicit skipped cases separately from success', async () => {
    const runner = new FlashReadSuiteRunner(fresh());
    expect(runner.skipNext()).toBe(true);
    await runner.start(async config => evidence(config));
    const report = makeFlashReadSuiteReport(runner.state, undefined);
    expect(report.summary.counts.skipped).toBe(1);
    expect(report.summary.counts.passed).toBe(14);
    expect(report.summary.allPassed).toBe(false);
    expect(runner.state.trials[0]!.skipReason).toBe('user-requested');
  });

  it('skips unsupported ranges on small flash without reporting successful reads', async () => {
    const runner = new FlashReadSuiteRunner(fresh());
    const run = vi.fn(async (config: FlashReadTrialConfig) => ({ ...evidence(config, 'failed'),
      failure: 'range-out-of-bounds', flashSizeBytes: 8 * 1024 * 1024 }));
    await runner.start(run);
    expect(run).toHaveBeenCalledTimes(1);
    expect(runner.state.trials.every(trial => trial.status === 'skipped')).toBe(true);
    expect(runner.state.phase).toBe('complete');
    expect(makeFlashReadSuiteReport(runner.state, undefined).summary.allPassed).toBe(false);
  });
});

describe('checkpoints and payload-free partial reports', () => {
  it('converts an interrupted running checkpoint to recovery without resuming its stream', () => {
    const state = fresh();
    state.phase = 'running';
    state.trials[0]!.status = 'running';
    const restored = restoreFlashReadSuite(JSON.stringify(state))!;
    expect(restored.phase).toBe('recovery');
    expect(restored.trials[0]!.status).toBe('interrupted');
    expect(restored.firstFailureId).toBe('target-alone-1');
    expect(makeFlashReadSuiteReport(restored, undefined).summary.counts.interrupted).toBe(1);
  });

  it.each(['ready', 'complete'] as const)('does not trust a %s phase to bypass recovery after failure', phase => {
    const state = fresh();
    state.phase = phase;
    state.trials[0]!.status = 'cancelled';
    expect(restoreFlashReadSuite(JSON.stringify(state))!.phase).toBe('recovery');
  });

  it('removes unknown payload and identifying fields at every persistence/report boundary', async () => {
    const state = fresh();
    const runner = new FlashReadSuiteRunner(state);
    await runner.start(async config => ({ ...evidence(config, 'failed'),
      rawBytes: [193, 42], serialNumber: 'device-secret',
      read: { ...evidence(config, 'failed').read!, rawBytes: [71, 93] } } as FlashReadTrialEvidence));
    const injected = { ...runner.state, firmware: 'firmware-payload', serialNumber: 'device-secret',
      environment: { ...environment, serialNumber: 'device-secret' },
      localAnalysis: { rawBytes: [42], capture: { rawLength: 987, rawBytes: [42] }, referenceComparison: { status: 'unavailable', bytes: [1, 2] } } };
    const restored = restoreFlashReadSuite(JSON.stringify(injected))!;
    const output = JSON.stringify(makeFlashReadSuiteReport(restored, injected.localAnalysis));
    expect(output).toContain('987');
    expect(output).not.toMatch(/rawBytes|serialNumber|device-secret|firmware-payload/);
    expect((JSON.parse(output).localAnalysis.referenceComparison as object)).not.toHaveProperty('bytes');
    const storage = { getItem: vi.fn(), removeItem: vi.fn(), setItem: vi.fn() };
    expect(saveFlashReadSuite(storage, injected)).toBe(true);
    expect(storage.setItem.mock.calls[0]![0]).toBe(FLASH_READ_CHECKPOINT_KEY);
    expect(storage.setItem.mock.calls[0]![1]).not.toMatch(/rawBytes|serialNumber|device-secret|firmware-payload/);
  });

  it('keeps saved comparison metadata after reload and marks partial success accurately', () => {
    const state = fresh();
    state.trials[0]!.status = 'failed';
    state.localAnalysis = { capture: { rawLength: 987, decodedLength: 985 }, referenceComparison: { status: 'unavailable', reason: 'no-exact-checksum-verified-reference' } };
    const restored = restoreFlashReadSuite(JSON.stringify(state))!;
    const report = makeFlashReadSuiteReport(restored, undefined);
    expect(report.localAnalysis).toEqual(state.localAnalysis);
    expect(report.summary.complete).toBe(false);
    expect(report.summary.allPassed).toBe(false);
    expect(report.summary.counts.failed).toBe(1);
    expect(report.summary.counts.pending).toBe(14);
  });

  it('rejects a changed matrix, corrupt status, or unsupported checkpoint', () => {
    const state = fresh();
    state.trials[0]!.config.address = 0;
    expect(restoreFlashReadSuite(JSON.stringify(state))).toBeNull();
    expect(restoreFlashReadSuite('{')).toBeNull();
    expect(restoreFlashReadSuite(JSON.stringify({ ...fresh(), schema: 'old' }))).toBeNull();
    expect(restoreFlashReadSuite(JSON.stringify({ ...fresh(), phase: 'something' }))).toBeNull();
  });

  it('survives disabled/full storage and removes stale checkpoints', () => {
    const storage = { getItem: vi.fn(), setItem: vi.fn(() => { throw new Error('quota'); }), removeItem: vi.fn() };
    expect(saveFlashReadSuite(storage, fresh())).toBe(false);
    expect(storage.removeItem).toHaveBeenCalledWith(FLASH_READ_CHECKPOINT_KEY);
  });

  it('does not claim a checkpoint too large to restore was saved', () => {
    const state = fresh();
    state.trials[0]!.evidence = { ...evidence(state.trials[0]!.config, 'failed'),
      transport: { enabled: true, frames: [], loss: { traceEntries: 0, chunkEntries: 0, frameEntries: 0 },
        chunks: Array.from({ length: 2048 }, (_, sequence) => ({ sequence, length: 1, receivedAtMs: sequence, gapMs: 1, visibility: 'x'.repeat(2048) })) } };
    const storage = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() };
    expect(saveFlashReadSuite(storage, state)).toBe(false);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).toHaveBeenCalledWith(FLASH_READ_CHECKPOINT_KEY);
  });

  it('rejects passed checkpoint claims without full checksum and fresh ROM evidence', () => {
    const state = fresh();
    state.trials[0]!.status = 'passed';
    state.trials[0]!.evidence = evidence(state.trials[0]!.config);
    expect(restoreFlashReadSuite(JSON.stringify(state))).not.toBeNull();
    state.trials[0]!.evidence!.romSyncVerified = false;
    expect(restoreFlashReadSuite(JSON.stringify(state))).toBeNull();
    state.trials[0]!.evidence!.romSyncVerified = true;
    state.trials[0]!.evidence!.read!.received--;
    expect(restoreFlashReadSuite(JSON.stringify(state))).toBeNull();
  });

  it('bounds session decisions while explicitly reporting lost entries', () => {
    const runner = new FlashReadSuiteRunner(fresh());
    for (let i = 0; i < 140; i++) runner.note(`Visibility event ${i}`);
    expect(runner.state.events).toHaveLength(128);
    expect(runner.state.droppedEvents).toBe(12);
  });
});

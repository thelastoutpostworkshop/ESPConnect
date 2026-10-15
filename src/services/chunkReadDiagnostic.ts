import { ESPLoader } from 'tasmota-webserial-esptool';
import {
  CHIP_FAMILY_ESP32S3, ESP_READ_FLASH, ESP_SYNC, DEFAULT_TIMEOUT,
  type Logger,
} from 'tasmota-webserial-esptool/dist/const.js';
import { pack } from 'tasmota-webserial-esptool/dist/struct.js';
import { slipEncode } from 'tasmota-webserial-esptool/dist/util.js';
import { ChunkSerialTransport } from './chunkSerialTransport';
import { diagnosticMd5 } from './diagnosticMd5';
import { analyzeDiagnosticFrame } from './diagnosticFrameAnalysis';
import type { LocalDiagnosticFrameCapture } from './chunkSerialTransport';

export type DiagnosticScenario = 'A' | 'B' | 'C';
export type DiagnosticReadResult = { address: number; size: number; md5: string };
export type ChunkReadDiagnosticOptions = {
  signal?: AbortSignal;
  log: (line: string) => void;
  visibility?: () => string;
  settings?: Pick<FlashReadTrialConfig, 'packetSize' | 'ackDelayMs'>;
  onReadEvidence?: (evidence: FlashReadReadEvidence) => void;
  // Internal, local-memory-only hooks; these bytes never enter a report.
  onVerifiedData?: (data: Uint8Array, md5: string) => void;
  onFailedFrame?: (capture: LocalDiagnosticFrameCapture | undefined, address: number, expectedLength: number) => void;
};
export type FlashReadTrialConfig = {
  address: number;
  size: number;
  packetSize: 256 | 512 | 1024;
  ackDelayMs: 0 | 5;
};
export type FlashReadReadEvidence = {
  stage: 'command-response' | 'data' | 'ack' | 'md5' | 'verified';
  received: number;
  packets: number;
  elapsedMs: number;
  md5?: string;
  failure?: string;
  invalidPacket?: { address: number; expectedLength: number; actualLength: number; packet: number };
  failureSnapshot?: ReturnType<ChunkSerialTransport['getSnapshot']>;
  acknowledgments: Array<{ value: number; packetReceivedAtMs: number; writeStartedAtMs?: number; writeCompletedAtMs?: number; actualDelayMs?: number }>;
};
export type FlashReadTrialEvidence = {
  status: 'passed' | 'failed' | 'cancelled';
  config: FlashReadTrialConfig;
  startedAt: string;
  elapsedMs: number;
  stage: 'preflight' | 'open' | 'rom' | 'stub' | 'read' | 'cleanup' | 'settled';
  read?: FlashReadReadEvidence;
  transport?: ReturnType<ChunkSerialTransport['getEvidence']>;
  failure?: string;
  romSyncVerified?: boolean;
  flashSizeBytes?: number;
  settings?: { baudRate: number; bufferSize: number; maxInFlight: number; idleTimeoutMs: number; stubVersion: string; stubSourceCommit: string; libraryVersion: string };
  cleanup: { closed: boolean; errors: string[] };
};
type LocalFailure = { capture: LocalDiagnosticFrameCapture; address: number; expectedLength: number; port: SerialPort; trialStartedAt: string };
let firstLocalFailure: LocalFailure | undefined;
let localReference: { bytes: Uint8Array; md5: string; address: number; verified: true; port: SerialPort } | undefined;

/** Payload-free analysis, including an unavailable-reference verdict when needed. */
export function getFlashReadLocalAnalysis() {
  if (!firstLocalFailure) return undefined;
  return {
    ...analyzeDiagnosticFrame(firstLocalFailure.capture, localReference?.port === firstLocalFailure.port ? localReference : undefined, {
      address: firstLocalFailure.address, expectedLength: firstLocalFailure.expectedLength,
    }),
    context: { trialStartedAt: firstLocalFailure.trialStartedAt, address: firstLocalFailure.address, expectedLength: firstLocalFailure.expectedLength },
  };
}

export function clearFlashReadLocalEvidence(): void {
  localReference?.bytes.fill(0);
  firstLocalFailure?.capture.rawBytes.fill(0);
  firstLocalFailure?.capture.decodedBytes.fill(0);
  localReference = undefined;
  firstLocalFailure = undefined;
}
export const CHUNK_DIAGNOSTIC_LABEL = 'issue-180-chunk-reader-v1';
export const CHUNK_DIAGNOSTIC_SETTINGS = Object.freeze({
  baudRate: 115200, bufferSize: 65536, packetSize: 1024, maxInFlight: 1, idleTimeout: 3000,
});
export const CHUNK_DIAGNOSTIC_CASES: Record<DiagnosticScenario, ReadonlyArray<{ address: number; size: number }>> = {
  A: [{ address: 0x8000, size: 1024 }],
  B: [{ address: 0x8000, size: 32 }, { address: 0x8000, size: 1024 }],
  C: [{ address: 0x810000, size: 65536 }],
};
const activePorts = new WeakSet<SerialPort>();
const hex = (bytes: Uint8Array) => [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
function checkAbort(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Diagnostic cancelled.', 'AbortError');
}
function delay(ms: number, signal?: AbortSignal): Promise<void> {
  checkAbort(signal);
  return new Promise((resolve, reject) => {
    const cancel = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
      reject(new DOMException('Diagnostic cancelled.', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', cancel);
      resolve();
    }, ms);
    signal?.addEventListener('abort', cancel, { once: true });
  });
}

// ROM commands and stub upload retain their existing implementation. Both the
// upstream reader loop AND readPacket are bypassed, from the first serial read.
// The returned EspStubLoader is a distinct instance and must be hooked as well.
function hookStartupLoader(loader: ESPLoader, transport: ChunkSerialTransport, signal?: AbortSignal) {
  loader.readLoop = async () => { checkAbort(signal); }; // transport already owns the only reader
  loader.readPacket = timeout => transport.readPacket(timeout ?? DEFAULT_TIMEOUT);
  loader.writeToStream = data => { checkAbort(signal); return transport.write(data); };
  loader.sleep = ms => delay(ms ?? 100, signal);
  loader.flushSerialBuffers = async () => {
    await delay(100, signal);
    transport.discardBootInput('startup-flush');
  };
  loader.drainInputBuffer = async (time = 200) => {
    await delay(time, signal);
    transport.discardBootInput('startup-drain');
  };
  const sendCommand = loader.sendCommand.bind(loader);
  loader.sendCommand = async (opcode, buffer, checksum) => {
    checkAbort(signal);
    if (opcode === ESP_SYNC) transport.discardBootInput('rom-sync');
    await sendCommand(opcode, buffer, checksum);
  };
}

/** No retries, arbitrary drains, decoded-file handling, or flash writes. */
export async function readFlashChunkStrict(
  transport: ChunkSerialTransport,
  address: number,
  size: number,
  options: ChunkReadDiagnosticOptions,
): Promise<DiagnosticReadResult> {
  const { signal, log } = options;
  if (!Number.isInteger(address) || address < 0 || !Number.isInteger(size) || size <= 0 ||
      size > 65536 || address + size > 0x100000000) {
    throw new Error('Invalid diagnostic read range.');
  }
  checkAbort(signal);
  transport.assertIdle();
  const { maxInFlight, idleTimeout } = CHUNK_DIAGNOSTIC_SETTINGS;
  const packetSize = options.settings?.packetSize ?? CHUNK_DIAGNOSTIC_SETTINGS.packetSize;
  const ackDelayMs = options.settings?.ackDelayMs ?? 0;
  if (![256, 512, 1024].includes(packetSize) || ![0, 5].includes(ackDelayMs)) throw new Error('Invalid diagnostic read settings.');
  const receiveStart = transport.getSnapshot();
  const ingress = () => {
    const now = transport.getSnapshot();
    return `rxBytes=${now.rxBytes - receiveStart.rxBytes}, rxChunks=${now.rxChunks - receiveStart.rxChunks}, ` +
      `frames=${now.frames - receiveStart.frames}, queuedFrames=${now.queuedFrames}, queuedBytes=${now.queuedBytes}, ` +
      `partialBytes=${now.partialBytes}, inFrame=${Number(now.inFrame)}, escaped=${Number(now.escaped)}`;
  };
  const started = performance.now();
  const data = new Uint8Array(size);
  let received = 0;
  let packets = 0;
  let stage: FlashReadReadEvidence['stage'] = 'command-response';
  const acknowledgments: FlashReadReadEvidence['acknowledgments'] = [];
  let invalidPacket: FlashReadReadEvidence['invalidPacket'];
  const evidence = (failure?: string, md5?: string): FlashReadReadEvidence => ({
    stage, received, packets, elapsedMs: performance.now() - started, md5, failure,
    invalidPacket, acknowledgments: acknowledgments.map(ack => ({ ...ack })),
  });
  log(`Read start: address=0x${address.toString(16)}, size=${size}, packetSize=${packetSize}, maxInFlight=${maxInFlight}, ingressBaselineBytes=${receiveStart.rxBytes}, ingressBaselineChunks=${receiveStart.rxChunks}.`);
  try {
    const payload = pack('<IIII', address, size, packetSize, maxInFlight);
    await transport.write(slipEncode([...pack('<BBHI', 0, ESP_READ_FLASH, payload.length, 0), ...payload]));
    // Do not skip stale digest/data frames as the legacy getResponse loop does.
    const response = await transport.readPacket(DEFAULT_TIMEOUT);
    if (response.length !== 10 || response[0] !== 1 || response[1] !== ESP_READ_FLASH ||
        response[2] !== 2 || response[3] !== 0 || response.slice(4).some(byte => byte !== 0)) {
      throw new Error(`Invalid READ_FLASH command response (length=${response.length}).`);
    }
    stage = 'data';
    while (received < size) {
      checkAbort(signal);
      const packet = await transport.readPacket(idleTimeout);
      const packetReceivedAtMs = performance.now() - started;
      const expected = Math.min(packetSize, size - received);
      if (packet.length !== expected) {
        invalidPacket = { address: address + received, expectedLength: expected, actualLength: packet.length, packet: packets + 1 };
        throw new Error(`Invalid data packet: expected=${expected}, actual=${packet.length}, packet=${packets + 1}.`);
      }
      data.set(packet, received);
      received += packet.length;
      packets++;
      // Acknowledge only a valid complete packet, using cumulative little-endian bytes.
      stage = 'ack';
      if (ackDelayMs) await delay(ackDelayMs, signal);
      checkAbort(signal);
      const ack: FlashReadReadEvidence['acknowledgments'][number] = { value: received, packetReceivedAtMs };
      acknowledgments.push(ack);
      await transport.write(slipEncode(pack('<I', received)), {
        started: () => {
          ack.writeStartedAtMs = performance.now() - started;
          ack.actualDelayMs = ack.writeStartedAtMs - packetReceivedAtMs;
        },
        completed: () => { ack.writeCompletedAtMs = performance.now() - started; },
      });
      stage = 'data';
    }
    stage = 'md5';
    const digest = await transport.readPacket(idleTimeout);
    if (digest.length !== 16) throw new Error(`Invalid MD5 frame: expected=16, actual=${digest.length}.`);
    const expectedDigest = diagnosticMd5(data);
    if (digest.some((byte, index) => byte !== expectedDigest[index])) throw new Error('MD5 mismatch for the requested flash bytes.');
    // Never begin B's second read with a pending frame or partial SLIP state.
    transport.assertIdle();
    const md5 = hex(expectedDigest);
    stage = 'verified';
    options.onVerifiedData?.(data, md5);
    options.onReadEvidence?.(evidence(undefined, md5));
    log(`Read verified: address=0x${address.toString(16)}, received=${received}/${size}, packets=${packets}, md5=${md5}, elapsedMs=${(performance.now() - started).toFixed(1)}, ${ingress()}.`);
    return { address, size, md5 };
  } catch (error) {
    const failure = signal?.aborted ? 'cancelled' :
      invalidPacket ? 'invalid-data-length' :
      stage === 'md5' ? 'digest-failed' :
      stage === 'command-response' ? 'command-response-failed' : 'transport-failed';
    options.onReadEvidence?.({ ...evidence(failure), failureSnapshot: transport.getSnapshot() });
    // Capture before abort/close can replace decoder state. Prefix packets have
    // length validation only; an aborted transfer has no verified final MD5.
    const capture = transport.captureFirstFailureFrame();
    if (stage === 'data' || invalidPacket) {
      options.onFailedFrame?.(capture, address + received, Math.min(packetSize, size - received));
    }
    // Metadata only: never put packet bytes or flash content in diagnostic output.
    log(`First failure: stage=${stage}, address=0x${address.toString(16)}, received=${received}/${size}, packets=${packets}, elapsedMs=${(performance.now() - started).toFixed(1)}, ${ingress()}. No retry.`);
    throw error;
  } finally {
    data.fill(0); // Raw flash data is only retained while verifying this read.
  }
}

/**
 * One independent trial: close the port, require a ROM-valued SYNC, upload a
 * fresh stub to RAM, then perform exactly one read. Failure never reuses state.
 * Startup logger output is intentionally discarded: it can include device IDs.
 */
export async function runFlashReadTrial(
  port: SerialPort,
  config: FlashReadTrialConfig,
  options: ChunkReadDiagnosticOptions & { onEvidence?: (evidence: FlashReadTrialEvidence) => void },
): Promise<FlashReadTrialEvidence> {
  if (!Number.isInteger(config.address) || config.address < 0 || !Number.isInteger(config.size) ||
      config.size < 1 || config.size > 65536 || config.address + config.size > 0x100000000 ||
      ![256, 512, 1024].includes(config.packetSize) || ![0, 5].includes(config.ackDelayMs)) {
    throw new Error('Invalid diagnostic trial configuration.');
  }
  const started = performance.now();
  const evidence: FlashReadTrialEvidence = {
    status: 'failed', config: { ...config }, startedAt: new Date().toISOString(), elapsedMs: 0,
    stage: 'preflight', cleanup: { closed: false, errors: [] }, romSyncVerified: false,
    settings: { baudRate: 115200, bufferSize: 65536, maxInFlight: 1, idleTimeoutMs: 3000,
      stubVersion: '1.2.2', stubSourceCommit: '23959b780454adf885916d42f2274ec648e96a94', libraryVersion: '7.3.10' },
  };
  let opened = false;
  let owned = false;
  let transport: ChunkSerialTransport | undefined;
  let readStarted = false;
  const notify = () => {
    evidence.elapsedMs = performance.now() - started;
    // Only trusted metadata enters this callback. Never forward a loader logger.
    options.onEvidence?.(structuredClone(evidence));
  };
  try {
    checkAbort(options.signal);
    if (activePorts.has(port) || port.readable || port.writable) {
      evidence.failure = 'port-already-open';
      return evidence;
    }
    activePorts.add(port);
    owned = true;
    evidence.stage = 'open';
    notify();
    await port.open({ baudRate: 115200, bufferSize: 65536 });
    opened = true;
    checkAbort(options.signal);
    transport = new ChunkSerialTransport(port, { signal: options.signal, visibility: options.visibility, captureFrames: true });
    transport.start();
    const logger: Logger = { log: () => undefined, error: () => undefined, debug: () => undefined };
    const loader = new ESPLoader(port, logger);
    hookStartupLoader(loader, transport, options.signal);
    const getResponse = loader.getResponse.bind(loader);
    loader.getResponse = async (opcode, timeout) => {
      const result = await getResponse(opcode, timeout);
      if (opcode === ESP_SYNC) {
        // Stub 1.2.2 answers SYNC with zero. A surviving stub is not a clean ROM.
        if (result[0] !== 0x20120707 || result[1].length < 2 || result[1][0] !== 0 || result[1][1] !== 0) {
          throw new Error('Fresh ROM SYNC was not verified.');
        }
        evidence.romSyncVerified = true;
      }
      return result;
    };
    const detectChip = loader.detectChip.bind(loader);
    loader.detectChip = async () => {
      await detectChip();
      if (loader.chipFamily !== CHIP_FAMILY_ESP32S3) throw new Error('This diagnostic requires an ESP32-S3.');
    };
    evidence.stage = 'rom';
    await loader.initialize();
    checkAbort(options.signal);
    if (!evidence.romSyncVerified || loader.chipFamily !== CHIP_FAMILY_ESP32S3) {
      evidence.failure = 'fresh-s3-rom-not-verified';
      throw new Error('Fresh S3 ROM was not verified.');
    }
    evidence.stage = 'stub';
    // runStub checks the new OHAI after the RAM upload. No flash commands here.
    const stub = await loader.runStub(true);
    if (!stub.IS_STUB) throw new Error('ESP32-S3 stub did not start.');
    hookStartupLoader(stub, transport, options.signal);
    await stub.detectFlashSize();
    checkAbort(options.signal);
    const capacity = /^(\d+)MB$/.exec(stub.flashSize ?? '');
    if (!capacity) {
      evidence.failure = 'flash-capacity-unknown';
      throw new Error('Flash capacity could not be verified.');
    }
    evidence.flashSizeBytes = Number(capacity[1]) * 1024 * 1024;
    if (config.address + config.size > evidence.flashSizeBytes) {
      evidence.failure = 'range-out-of-bounds';
      return evidence;
    }
    transport.assertIdle();
    transport.setStrictMode();
    evidence.stage = 'read';
    readStarted = true;
    await readFlashChunkStrict(transport, config.address, config.size, {
      ...options, settings: config,
      onReadEvidence: read => { evidence.read = read; },
      onVerifiedData: (bytes, md5) => {
        // Retain only this exact 1 KiB reference, and only after final MD5 passed.
        if (!localReference && config.address === 0x810800 && config.size === 1024) {
          localReference = { bytes: bytes.slice(), md5, address: config.address, verified: true, port };
        }
      },
      onFailedFrame: (capture, address, expectedLength) => {
        if (!firstLocalFailure && capture) firstLocalFailure = { capture, address, expectedLength, port, trialStartedAt: evidence.startedAt };
      },
      log: () => undefined,
    });
    evidence.status = 'passed';
  } catch (error) {
    evidence.status = options.signal?.aborted ? 'cancelled' : 'failed';
    evidence.failure ??= evidence.read?.failure ?? `${evidence.stage}-failed`;
    if (readStarted && transport && !options.signal?.aborted) {
      try { await transport.abortRead(); }
      catch { /* Best effort only. Closing and ROM verification are mandatory. */ }
    }
  } finally {
    evidence.stage = 'cleanup';
    if (transport) {
      try { await transport.close(); }
      catch { evidence.cleanup.errors.push('transport-close-failed'); }
      evidence.transport = transport.getEvidence();
    }
    if (opened) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          port.close(),
          new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('close-timeout')), 3000); }),
        ]);
        evidence.cleanup.closed = !port.readable && !port.writable && evidence.cleanup.errors.length === 0;
        if (!evidence.cleanup.closed) evidence.cleanup.errors.push('port-remains-open');
      } catch { evidence.cleanup.errors.push('port-close-failed'); }
      finally { clearTimeout(timer); }
    } else if (owned) {
      evidence.cleanup.closed = !port.readable && !port.writable;
    }
    if (evidence.cleanup.errors.length) {
      evidence.status = options.signal?.aborted ? 'cancelled' : 'failed';
      evidence.failure ??= 'cleanup-failed';
    }
    if (options.signal?.aborted) {
      evidence.status = 'cancelled';
      evidence.failure ??= 'cancelled';
    }
    if (owned) activePorts.delete(port);
    evidence.stage = 'settled';
    notify();
  }
  return evidence;
}

export async function runChunkReadDiagnostic(
  port: SerialPort,
  scenario: DiagnosticScenario,
  options: ChunkReadDiagnosticOptions,
): Promise<{ scenario: DiagnosticScenario; reads: DiagnosticReadResult[] }> {
  if (!Object.hasOwn(CHUNK_DIAGNOSTIC_CASES, scenario)) throw new Error('Unknown diagnostic scenario.');
  checkAbort(options.signal);
  if (activePorts.has(port) || port.readable || port.writable) throw new Error('Port already open. Disconnect other sessions before starting.');
  activePorts.add(port);
  let opened = false;
  let transport: ChunkSerialTransport | undefined;
  let flashStarted = false;
  let failure: unknown;
  const reads: DiagnosticReadResult[] = [];
  // Buffer all diagnostics during transfer; no synchronous per-chunk UI work.
  const messages: string[] = [];
  const log = (message: string) => {
    if (messages.length < 512) messages.push(`${new Date().toISOString()} ${message}`);
  };
  const logger: Logger = { log, error: log, debug: () => undefined };
  log(`Build=${CHUNK_DIAGNOSTIC_LABEL}; scenario=${scenario}; new ESP32-S3 stub=1.2.2; baud=115200; bufferSize=65536; packetSize=1024; maxInFlight=1; dataIdleTimeout=3000ms.`);
  log('Independent chunk receive loop and SLIP decoder; one persistent serialized writer; no normal-app probes; local metadata only.');
  try {
    await port.open({ baudRate: 115200, bufferSize: 65536 });
    opened = true;
    checkAbort(options.signal);
    transport = new ChunkSerialTransport(port, { signal: options.signal, visibility: options.visibility });
    transport.start();
    const loader = new ESPLoader(port, logger);
    hookStartupLoader(loader, transport, options.signal);
    const detectChip = loader.detectChip.bind(loader);
    loader.detectChip = async () => {
      await detectChip();
      if (loader.chipFamily !== CHIP_FAMILY_ESP32S3) throw new Error('This diagnostic requires an ESP32-S3.');
    };
    await loader.initialize();
    checkAbort(options.signal);
    const stub = await loader.runStub(true);
    if (!stub.IS_STUB) throw new Error('ESP32-S3 stub did not start.');
    hookStartupLoader(stub, transport, options.signal);
    await stub.detectFlashSize();
    checkAbort(options.signal);
    transport.assertIdle();
    transport.setStrictMode();
    log('Fresh S3 stub ready. Starting isolated reads; all flash data lengths and MD5 frames will be checked.');
    flashStarted = true;
    for (const read of CHUNK_DIAGNOSTIC_CASES[scenario]) {
      reads.push(await readFlashChunkStrict(transport, read.address, read.size, { ...options, log }));
    }
    log(`Scenario ${scenario} passed: ${reads.length} verified read(s).`);
  } catch (error) {
    failure = error;
    log(`Scenario ${scenario} stopped: ${error instanceof Error ? error.message : 'unknown error'}.`);
    if (flashStarted && transport && !options.signal?.aborted) {
      try {
        // New stub ignores an empty frame. Abort emits an untrusted prefix digest;
        // close the session instead of draining it or resuming normal app commands.
        await transport.abortRead();
        log('Sent one-byte abort; session will close. A fresh connection is required.');
      } catch {
        log('Abort could not be sent; closing the session. A fresh connection is required.');
      }
    }
  } finally {
    if (transport) {
      try { await transport.close(); }
      catch (error) { failure ??= error; log('Transport cleanup failed. Reconnect the USB device before retrying.'); }
    }
    if (opened) {
      let closeTimer: ReturnType<typeof setTimeout> | undefined;
      try {
        // If a driver never settles close, fail explicitly rather than holding the
        // UI forever. The port remains unusable until close settles or USB resets.
        await Promise.race([
          port.close(),
          new Promise<never>((_, reject) => {
            closeTimer = setTimeout(() => reject(new Error('Serial port close timed out; reconnect the USB device.')), 3000);
          }),
        ]);
        log('Port closed; no reader or writer is retained.');
      }
      catch (error) { failure ??= error; log('Port close failed. Reconnect the USB device before retrying.'); }
      finally { clearTimeout(closeTimer); }
    }
    activePorts.delete(port);
    for (const line of messages) options.log(line);
    for (const line of transport?.getTrace() ?? []) options.log(line);
  }
  if (failure !== undefined) throw failure;
  return { scenario, reads };
}

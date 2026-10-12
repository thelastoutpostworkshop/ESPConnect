import { ESPLoader } from 'tasmota-webserial-esptool';
import {
  CHIP_FAMILY_ESP32S3, ESP_READ_FLASH, ESP_SYNC, DEFAULT_TIMEOUT,
  type Logger,
} from 'tasmota-webserial-esptool/dist/const.js';
import { pack } from 'tasmota-webserial-esptool/dist/struct.js';
import { slipEncode } from 'tasmota-webserial-esptool/dist/util.js';
import { ChunkSerialTransport } from './chunkSerialTransport';
import { diagnosticMd5 } from './diagnosticMd5';

export type DiagnosticScenario = 'A' | 'B' | 'C';
export type DiagnosticReadResult = { address: number; size: number; md5: string };
export type ChunkReadDiagnosticOptions = {
  signal?: AbortSignal;
  log: (line: string) => void;
  visibility?: () => string;
};
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
  const { packetSize, maxInFlight, idleTimeout } = CHUNK_DIAGNOSTIC_SETTINGS;
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
  let stage = 'command-response';
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
      const expected = Math.min(packetSize, size - received);
      if (packet.length !== expected) {
        throw new Error(`Invalid data packet: expected=${expected}, actual=${packet.length}, packet=${packets + 1}.`);
      }
      data.set(packet, received);
      received += packet.length;
      packets++;
      // Acknowledge only a valid complete packet, using cumulative little-endian bytes.
      await transport.write(slipEncode(pack('<I', received)));
    }
    stage = 'md5';
    const digest = await transport.readPacket(idleTimeout);
    if (digest.length !== 16) throw new Error(`Invalid MD5 frame: expected=16, actual=${digest.length}.`);
    const expectedDigest = diagnosticMd5(data);
    if (digest.some((byte, index) => byte !== expectedDigest[index])) throw new Error('MD5 mismatch for the requested flash bytes.');
    // Never begin B's second read with a pending frame or partial SLIP state.
    transport.assertIdle();
    const md5 = hex(expectedDigest);
    log(`Read verified: address=0x${address.toString(16)}, received=${received}/${size}, packets=${packets}, md5=${md5}, elapsedMs=${(performance.now() - started).toFixed(1)}, ${ingress()}.`);
    return { address, size, md5 };
  } catch (error) {
    // Metadata only: never put packet bytes or flash content in diagnostic output.
    log(`First failure: stage=${stage}, address=0x${address.toString(16)}, received=${received}/${size}, packets=${packets}, elapsedMs=${(performance.now() - started).toFixed(1)}, ${ingress()}. No retry.`);
    throw error;
  } finally {
    data.fill(0); // Raw flash data is only retained while verifying this read.
  }
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

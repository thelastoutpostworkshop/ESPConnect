import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as opcodes from 'tasmota-webserial-esptool/dist/const.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ESPLoader } from 'tasmota-webserial-esptool';
import { CHIP_FAMILY_ESP32S3, ESP_READ_FLASH } from 'tasmota-webserial-esptool/dist/const.js';
import { pack, unpack } from 'tasmota-webserial-esptool/dist/struct.js';
import { slipEncode } from 'tasmota-webserial-esptool/dist/util.js';
import { ChunkSerialTransport } from '../src/services/chunkSerialTransport';
import { CHUNK_DIAGNOSTIC_CASES, clearFlashReadLocalEvidence, getFlashReadLocalAnalysis, readFlashChunkStrict, runChunkReadDiagnostic, runFlashReadTrial } from '../src/services/chunkReadDiagnostic';

const md5 = (data: Uint8Array) => [...createHash('md5').update(data).digest()];
const reply = () => [1, ESP_READ_FLASH, 2, 0, 0, 0, 0, 0, 0, 0];
const decode = (frame: Uint8Array) => {
  const bytes: number[] = [];
  for (let i = 1; i < frame.length - 1; i++) {
    if (frame[i] === 0xdb) bytes.push(frame[++i] === 0xdc ? 0xc0 : 0xdb);
    else bytes.push(frame[i]!);
  }
  return bytes;
};
function serial() {
  let controller: ReadableStreamDefaultController<Uint8Array>;
  let receive: (data: number[]) => void = () => undefined;
  const writes: number[][] = [];
  const close = vi.fn(async () => {
    expect(port.readable?.locked).toBe(false);
    expect(port.writable?.locked).toBe(false);
    port.readable = null;
    port.writable = null;
  });
  const port = {
    readable: null as ReadableStream<Uint8Array> | null,
    writable: null as WritableStream<Uint8Array> | null,
    getInfo: () => ({ usbVendorId: 0x303a, usbProductId: 0x1001 }),
    open: vi.fn(async () => {
      port.readable = new ReadableStream({ start: value => { controller = value; } });
      port.writable = new WritableStream({ write: frame => {
        const packet = decode(frame);
        writes.push(packet);
        receive(packet);
      } });
    }),
    close,
    setSignals: vi.fn(async () => undefined),
  };
  return {
    port: port as unknown as SerialPort,
    writes,
    close,
    onWrite: (handler: (data: number[]) => void) => { receive = handler; },
    enqueue: (data: number[]) => controller.enqueue(Uint8Array.from(data)),
    frame: (data: number[]) => controller.enqueue(Uint8Array.from(slipEncode(data))),
  };
}

async function strictTransport(fixture: ReturnType<typeof serial>, signal?: AbortSignal) {
  await fixture.port.open({ baudRate: 115200, bufferSize: 65536 });
  const transport = new ChunkSerialTransport(fixture.port, { signal });
  transport.start();
  transport.setStrictMode();
  return transport;
}

function flashModel(fixture: ReturnType<typeof serial>, options: {
  shortPacket?: number; badDigest?: boolean; omitDigest?: boolean; badResponse?: number[];
  packetSize?: number; syncValue?: number;
  shortAtPacket?: number;
} = {}) {
  const commands: number[][] = [];
  const acks: number[] = [];
  let data = new Uint8Array();
  let sent = 0;
  let awaitedAck = 0;
  let digestSent = true;
  let sequence = 0;
  const next = () => {
    const packet = data.subarray(sent, Math.min(sent + (options.packetSize ?? 1024), data.length));
    sent += packet.length;
    awaitedAck = sent;
    const shorten = !options.shortAtPacket || Math.ceil(sent / (options.packetSize ?? 1024)) === options.shortAtPacket;
    fixture.frame([...packet.subarray(0, shorten ? options.shortPacket ?? packet.length : packet.length)]);
  };
  fixture.onWrite(packet => {
    if (packet.length === 1) return; // Read abort, never an ACK.
    if (packet.length >= 8 && packet[1] === opcodes.ESP_SYNC) {
      fixture.frame([...pack('<BBHI', 1, opcodes.ESP_SYNC, 4, options.syncValue ?? 0x20120707), 0, 0, 0, 0]);
      return;
    }
    if (packet.length >= 8 && packet[1] === ESP_READ_FLASH) {
      expect(digestSent).toBe(true);
      const args = unpack('<IIII', packet.slice(8));
      expect(args.slice(2)).toEqual([options.packetSize ?? 1024, 1]);
      commands.push(args);
      data = Uint8Array.from({ length: args[1] }, (_, i) => (i * 13 + sequence) & 255);
      sent = 0;
      sequence++;
      digestSent = false;
      fixture.frame(options.badResponse ?? reply());
      if (!options.badResponse) next();
      return;
    }
    expect(packet).toHaveLength(4);
    const [ack] = unpack('<I', packet);
    expect(ack).toBe(awaitedAck);
    acks.push(ack);
    if (sent < data.length) next();
    else if (!options.omitDigest) {
      const digest = md5(data);
      if (options.badDigest) digest[0] ^= 1;
      fixture.frame(digest);
      digestSent = true;
    }
  });
  return { commands, acks };
}

afterEach(() => {
  clearFlashReadLocalEvidence();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('strict independent READ_FLASH protocol', () => {
  it.each([32, 1024, 1025, 65536])('validates exact %i bytes, final packet and MD5 before returning', async size => {
    const fixture = serial();
    const transport = await strictTransport(fixture);
    const model = flashModel(fixture);
    try {
      const result = await readFlashChunkStrict(transport, 0x8000, size, { log: vi.fn() });
      expect(result).toEqual({ address: 0x8000, size, md5: createHash('md5').update(Uint8Array.from({ length: size }, (_, i) => (i * 13) & 255)).digest('hex') });
      expect(model.acks).toHaveLength(Math.ceil(size / 1024));
      expect(model.acks.at(-1)).toBe(size);
      transport.assertIdle();
    } finally { await transport.close(); await fixture.port.close(); }
  });

  it('consumes and verifies B’s first digest before issuing the second command', async () => {
    const fixture = serial();
    const transport = await strictTransport(fixture);
    const model = flashModel(fixture);
    try {
      for (const read of CHUNK_DIAGNOSTIC_CASES.B) await readFlashChunkStrict(transport, read.address, read.size, { log: vi.fn() });
      expect(model.commands).toEqual([[0x8000, 32, 1024, 1], [0x8000, 1024, 1024, 1]]);
      expect(model.acks).toEqual([32, 1024]);
      transport.assertIdle();
    } finally { await transport.close(); await fixture.port.close(); }
  });

  it('stops at a 979-byte packet without sending its short cumulative ACK', async () => {
    const fixture = serial();
    const transport = await strictTransport(fixture);
    const model = flashModel(fixture, { shortPacket: 979 });
    try {
      await expect(readFlashChunkStrict(transport, 0x810000, 65536, { log: vi.fn() })).rejects.toThrow('expected=1024, actual=979');
      expect(model.acks).toEqual([]);
      expect(model.commands).toHaveLength(1);
    } finally { await transport.close(); await fixture.port.close(); }
  });

  it('rejects an oversized packet before acknowledging any data', async () => {
    const fixture = serial();
    const transport = await strictTransport(fixture);
    fixture.onWrite(() => {
      fixture.frame(reply()); fixture.frame(Array(1025).fill(0x55));
    });
    try {
      await expect(readFlashChunkStrict(transport, 0x8000, 1024, { log: vi.fn() })).rejects.toThrow('actual=1025');
      expect(fixture.writes).toHaveLength(1);
    } finally { await transport.close(); await fixture.port.close(); }
  });

  it.each([
    [1, ESP_READ_FLASH, 3, 0, 0, 0, 0, 0, 0, 0],
    [1, ESP_READ_FLASH, 2, 0, 0, 0, 0, 0, 1, 0],
    [1, ESP_READ_FLASH + 1, 2, 0, 0, 0, 0, 0, 0, 0],
    Array(16).fill(0x55),
  ])('rejects an invalid command response without treating it as data: %j', async (...response) => {
    const fixture = serial();
    const transport = await strictTransport(fixture);
    const model = flashModel(fixture, { badResponse: response });
    try {
      await expect(readFlashChunkStrict(transport, 0x8000, 1024, { log: vi.fn() })).rejects.toThrow('command response');
      expect(model.acks).toEqual([]);
    } finally { await transport.close(); await fixture.port.close(); }
  });

  it('rejects a bad MD5 and does not report a verified result', async () => {
    const fixture = serial();
    const transport = await strictTransport(fixture);
    const log = vi.fn();
    flashModel(fixture, { badDigest: true });
    try {
      await expect(readFlashChunkStrict(transport, 0x8000, 32, { log })).rejects.toThrow('MD5 mismatch');
      expect(log.mock.calls.flat().some(line => line.includes('Read verified'))).toBe(false);
    } finally { await transport.close(); await fixture.port.close(); }
  });

  it('times out on missing MD5 after the final ACK and releases ownership on close', async () => {
    vi.useFakeTimers();
    const fixture = serial();
    const transport = await strictTransport(fixture);
    const model = flashModel(fixture, { omitDigest: true });
    const result = expect(readFlashChunkStrict(transport, 0x8000, 32, { log: vi.fn() })).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(3100);
    await result;
    expect(model.acks).toEqual([32]);
    await transport.close();
    await fixture.port.close();
  });

  it('rejects unexpected queued traffic after the verified digest', async () => {
    const fixture = serial();
    const transport = await strictTransport(fixture);
    fixture.onWrite(packet => {
      if (packet.length > 4) { fixture.frame(reply()); fixture.frame(Array(32).fill(0x55)); }
      else fixture.enqueue([...slipEncode(md5(new Uint8Array(32).fill(0x55))), ...slipEncode([9])]);
    });
    try {
      await expect(readFlashChunkStrict(transport, 0x8000, 32, { log: vi.fn() })).rejects.toThrow();
    } finally { await transport.close(); await fixture.port.close(); }
  });
});

describe('fresh diagnostic session ownership', () => {
  function mockStartup() {
    vi.spyOn(ESPLoader.prototype, 'initialize').mockImplementation(async function () {
      this.chipFamily = CHIP_FAMILY_ESP32S3;
      await this.readLoop();
    });
    vi.spyOn(ESPLoader.prototype, 'runStub').mockImplementation(async function () {
      const stub = new ESPLoader(this.port, this.logger, this);
      stub.IS_STUB = true;
      return stub;
    });
    vi.spyOn(ESPLoader.prototype, 'detectFlashSize').mockResolvedValue(undefined);
  }

  it.each(['A', 'B', 'C'] as const)('opens one fresh session for case %s and closes both locks before the port', async scenario => {
    mockStartup();
    const fixture = serial();
    const model = flashModel(fixture);
    const log = vi.fn();
    const result = await runChunkReadDiagnostic(fixture.port, scenario, { log });
    expect(result.reads).toHaveLength(CHUNK_DIAGNOSTIC_CASES[scenario].length);
    expect(fixture.port.open).toHaveBeenCalledOnce();
    expect(fixture.port.open).toHaveBeenCalledWith({ baudRate: 115200, bufferSize: 65536 });
    expect(fixture.close).toHaveBeenCalledOnce();
    expect(model.commands).toHaveLength(result.reads.length);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Port closed'));
  });

  it('stops case B after first MD5 failure, aborts once and closes without retry', async () => {
    mockStartup();
    const fixture = serial();
    const model = flashModel(fixture, { badDigest: true });
    await expect(runChunkReadDiagnostic(fixture.port, 'B', { log: vi.fn() })).rejects.toThrow('MD5 mismatch');
    expect(model.commands).toHaveLength(1);
    expect(fixture.writes.at(-1)).toEqual([0]);
    expect(fixture.close).toHaveBeenCalledOnce();
  });

  it('does not open an already-cancelled run or close another owner’s port', async () => {
    const fixture = serial();
    const controller = new AbortController(); controller.abort();
    await expect(runChunkReadDiagnostic(fixture.port, 'A', { log: vi.fn(), signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(fixture.port.open).not.toHaveBeenCalled();
    await fixture.port.open({ baudRate: 115200 });
    await expect(runChunkReadDiagnostic(fixture.port, 'A', { log: vi.fn() })).rejects.toThrow('already open');
    expect(fixture.close).not.toHaveBeenCalled();
    await fixture.port.close();
  });

  it('records the 629-byte ingress cutoff and partial frame before abort/cleanup', async () => {
    vi.useFakeTimers();
    mockStartup();
    const fixture = serial();
    fixture.onWrite(packet => {
      if (packet[1] === ESP_READ_FLASH) {
        fixture.frame(reply());
        fixture.enqueue([0xc0, ...Array(616).fill(0x55)]);
      }
    });
    const log = vi.fn();
    const result = expect(runChunkReadDiagnostic(fixture.port, 'A', { log })).rejects.toThrow('Timed out');
    await vi.advanceTimersByTimeAsync(3100);
    await result;
    expect(fixture.writes).toHaveLength(2); // Read command, then one abort, no data ACK.
    expect(fixture.writes.at(-1)).toEqual([0]);
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/First failure:.*rxBytes=629, rxChunks=2.*partialBytes=616, inFrame=1, escaped=0/));
    expect(log).toHaveBeenCalledWith(expect.stringContaining('chunk bytes=617'));
    expect(fixture.close).toHaveBeenCalledOnce();
  });

  it('cancels a partial escape, releases ownership, and permits a fresh later session', async () => {
    mockStartup();
    const fixture = serial();
    const controller = new AbortController();
    fixture.onWrite(packet => {
      if (packet[1] === ESP_READ_FLASH) {
        fixture.frame(reply()); fixture.enqueue([0xc0, 0x55, 0xdb]);
        queueMicrotask(() => controller.abort());
      }
    });
    await expect(runChunkReadDiagnostic(fixture.port, 'A', { log: vi.fn(), signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(fixture.close).toHaveBeenCalledOnce();
    expect(fixture.writes).toHaveLength(1);
    const model = flashModel(fixture);
    await expect(runChunkReadDiagnostic(fixture.port, 'A', { log: vi.fn() })).resolves.toMatchObject({ scenario: 'A' });
    expect(model.commands).toHaveLength(1);
    expect(fixture.close).toHaveBeenCalledTimes(2);
  });

  it('reports a hung port close without claiming cleanup success', async () => {
    vi.useFakeTimers();
    mockStartup();
    const fixture = serial();
    flashModel(fixture);
    fixture.close.mockImplementation(() => new Promise<void>(() => undefined));
    const log = vi.fn();
    const result = expect(runChunkReadDiagnostic(fixture.port, 'A', { log })).rejects.toThrow('close timed out');
    await vi.advanceTimersByTimeAsync(3100);
    await result;
    expect(fixture.port.readable?.locked).toBe(false);
    expect(fixture.port.writable?.locked).toBe(false);
    expect(log.mock.calls.flat().some(line => line.includes('Port closed;'))).toBe(false);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Port close failed'));
  });

  it('closes the port if startup fails before any flash read', async () => {
    vi.spyOn(ESPLoader.prototype, 'initialize').mockRejectedValue(new Error('ROM startup failed'));
    const fixture = serial();
    await expect(runChunkReadDiagnostic(fixture.port, 'A', { log: vi.fn() })).rejects.toThrow('ROM startup failed');
    expect(fixture.writes).toEqual([]);
    expect(fixture.close).toHaveBeenCalledOnce();
  });
});


describe('guided suite independent trials', () => {
  const config = { address: 0x810800, size: 1024, packetSize: 1024 as const, ackDelayMs: 0 as const };
  function startup(capacity = '16MB') {
    const initialize = vi.spyOn(ESPLoader.prototype, 'initialize').mockImplementation(async function () {
      this.chipFamily = CHIP_FAMILY_ESP32S3;
      await this.sendCommand(opcodes.ESP_SYNC, []);
      await this.getResponse(opcodes.ESP_SYNC);
    });
    const upload = vi.spyOn(ESPLoader.prototype, 'runStub').mockImplementation(async function () {
      const stub = new ESPLoader(this.port, this.logger, this);
      stub.IS_STUB = true;
      return stub;
    });
    vi.spyOn(ESPLoader.prototype, 'detectFlashSize').mockImplementation(async function () { this.flashSize = capacity; });
    return { initialize, upload };
  }

  it.each([256, 512, 1024] as const)('negotiates packet size %i and requires final MD5 in a new session', async packetSize => {
    const { initialize, upload } = startup();
    const fixture = serial();
    const model = flashModel(fixture, { packetSize });
    const result = await runFlashReadTrial(fixture.port, { ...config, packetSize }, { log: vi.fn() });
    expect(result).toMatchObject({ status: 'passed', romSyncVerified: true, cleanup: { closed: true, errors: [] }, read: { stage: 'verified', received: 1024 } });
    expect(result.read?.acknowledgments.map(ack => ack.value)).toEqual(Array.from({ length: 1024 / packetSize }, (_, i) => (i + 1) * packetSize));
    expect(model.commands).toEqual([[config.address, 1024, packetSize, 1]]);
    expect(initialize).toHaveBeenCalledOnce();
    expect(upload).toHaveBeenCalledOnce();
    expect(fixture.close).toHaveBeenCalledOnce();
  });

  it('records actual delayed ACK times and cancels before a pending ACK without acknowledging it', async () => {
    vi.useFakeTimers();
    startup();
    const fixture = serial();
    const model = flashModel(fixture);
    const controller = new AbortController();
    const run = runFlashReadTrial(fixture.port, { ...config, ackDelayMs: 5 }, { signal: controller.signal, log: vi.fn() });
    await vi.advanceTimersByTimeAsync(1);
    expect(model.acks).toEqual([]);
    await vi.advanceTimersByTimeAsync(6);
    const result = await run;
    expect(result.status).toBe('passed');
    expect(result.read?.acknowledgments[0]?.actualDelayMs).toBeGreaterThanOrEqual(5);
    const second = new AbortController();
    const cancelled = runFlashReadTrial(fixture.port, { ...config, ackDelayMs: 5 }, { signal: second.signal, log: vi.fn() });
    await vi.advanceTimersByTimeAsync(1);
    second.abort();
    const stopped = await cancelled;
    expect(stopped.status).toBe('cancelled');
    expect(model.acks).toEqual([1024]);
    expect(stopped.cleanup.closed).toBe(true);
  });

  it('rejects a surviving stub SYNC before uploading or reading flash', async () => {
    const { upload } = startup();
    const fixture = serial();
    const model = flashModel(fixture, { syncValue: 0 });
    const result = await runFlashReadTrial(fixture.port, config, { log: vi.fn() });
    expect(result).toMatchObject({ status: 'failed', romSyncVerified: false, failure: 'rom-failed', cleanup: { closed: true } });
    expect(upload).not.toHaveBeenCalled();
    expect(model.commands).toEqual([]);
  });

  it('re-establishes ROM and uploads again after invalid data, never retries that stream', async () => {
    const { initialize, upload } = startup();
    const fixture = serial();
    const bad = flashModel(fixture, { shortPacket: 985 });
    const failed = await runFlashReadTrial(fixture.port, config, { log: vi.fn() });
    expect(failed).toMatchObject({ status: 'failed', failure: 'invalid-data-length', read: { received: 0, packets: 0, invalidPacket: { actualLength: 985 } } });
    expect(bad.acks).toEqual([]);
    expect(bad.commands).toHaveLength(1);
    const good = flashModel(fixture);
    expect((await runFlashReadTrial(fixture.port, config, { log: vi.fn() })).status).toBe('passed');
    expect(initialize).toHaveBeenCalledTimes(2);
    expect(upload).toHaveBeenCalledTimes(2);
    expect(good.commands).toHaveLength(1);
    const analysis = JSON.stringify(getFlashReadLocalAnalysis());
    expect(analysis).toContain('39');
    expect(analysis).not.toContain('rawBytes');
    expect(analysis).not.toContain('decodedBytes');
  });

  it('does not report success after a failed close, and refuses a still-open port', async () => {
    startup();
    const fixture = serial();
    flashModel(fixture);
    fixture.close.mockRejectedValue(new Error('host secret must not be exported'));
    const result = await runFlashReadTrial(fixture.port, config, { log: vi.fn() });
    expect(result).toMatchObject({ status: 'failed', failure: 'cleanup-failed', cleanup: { closed: false, errors: ['port-close-failed'] } });
    const retry = await runFlashReadTrial(fixture.port, config, { log: vi.fn() });
    expect(retry.failure).toBe('port-already-open');
    expect(fixture.port.open).toHaveBeenCalledOnce();
    expect(JSON.stringify(result)).not.toContain('host secret');
  });

  it('checks flash capacity and never sends an out-of-range read', async () => {
    startup('8MB');
    const fixture = serial();
    const model = flashModel(fixture);
    const result = await runFlashReadTrial(fixture.port, config, { log: vi.fn() });
    expect(result).toMatchObject({ status: 'failed', failure: 'range-out-of-bounds', flashSizeBytes: 8 * 1024 * 1024, cleanup: { closed: true } });
    expect(model.commands).toEqual([]);
  });

  it('compares a short third frame with an exact verified reference without claiming prefix MD5', async () => {
    startup();
    const fixture = serial();
    flashModel(fixture);
    expect((await runFlashReadTrial(fixture.port, config, { log: vi.fn() })).status).toBe('passed');
    const bad = flashModel(fixture, { shortPacket: 985, shortAtPacket: 3 });
    const result = await runFlashReadTrial(fixture.port, { ...config, address: 0x810000, size: 3072 }, { log: vi.fn() });
    expect(result.read).toMatchObject({ received: 2048, packets: 2, invalidPacket: { address: 0x810800, expectedLength: 1024, actualLength: 985, packet: 3 } });
    expect(result.read?.md5).toBeUndefined();
    expect(bad.acks).toEqual([1024, 2048]);
    expect(getFlashReadLocalAnalysis()?.referenceComparison).toMatchObject({ status: 'compared', lengthDeficit: 39 });
    expect(result.read?.failureSnapshot?.queuedFrames).toBe(0);
  });

  it('never reports a completed ACK when the actual writer rejects it', async () => {
    startup();
    const fixture = serial();
    fixture.onWrite(packet => {
      if (packet[1] === opcodes.ESP_SYNC && packet.length >= 8) fixture.frame([...pack('<BBHI', 1, opcodes.ESP_SYNC, 4, 0x20120707), 0, 0, 0, 0]);
      else if (packet[1] === ESP_READ_FLASH && packet.length >= 8) { fixture.frame(reply()); fixture.frame(Array(1024).fill(0x55)); }
      else if (packet.length === 4) throw new Error('private driver details');
    });
    const result = await runFlashReadTrial(fixture.port, config, { log: vi.fn() });
    expect(result.status).toBe('failed');
    const ack = result.read?.acknowledgments[0];
    expect(ack?.writeStartedAtMs).toEqual(expect.any(Number));
    expect(ack?.writeCompletedAtMs).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain('private driver');
  });

  it('waits for a pending open on cancellation, then closes without ROM or flash commands', async () => {
    const { initialize } = startup();
    const fixture = serial();
    const controller = new AbortController();
    const originalOpen = vi.mocked(fixture.port.open).getMockImplementation()!;
    let finishOpen!: () => Promise<void>;
    vi.mocked(fixture.port.open).mockImplementation(options => new Promise(resolve => {
      finishOpen = async () => { await originalOpen(options); resolve(); };
    }));
    const run = runFlashReadTrial(fixture.port, config, { log: vi.fn(), signal: controller.signal });
    controller.abort();
    expect(fixture.close).not.toHaveBeenCalled();
    await finishOpen();
    expect(await run).toMatchObject({ status: 'cancelled', cleanup: { closed: true } });
    expect(initialize).not.toHaveBeenCalled();
    expect(fixture.writes).toEqual([]);
  });

  it('reports cancellation during cleanup even when the read checksum already passed', async () => {
    startup();
    const fixture = serial();
    const controller = new AbortController();
    flashModel(fixture);
    const originalClose = fixture.close.getMockImplementation()!;
    fixture.close.mockImplementation(async () => { controller.abort(); await originalClose(); });
    const result = await runFlashReadTrial(fixture.port, config, { log: vi.fn(), signal: controller.signal });
    expect(result).toMatchObject({ status: 'cancelled', failure: 'cancelled', read: { stage: 'verified', received: 1024 }, cleanup: { closed: true } });
  });

  it('retains partial metadata when cancelled and prevents overlapping starts', async () => {
    startup();
    const fixture = serial();
    const controller = new AbortController();
    flashModel(fixture, { omitDigest: true });
    const run = runFlashReadTrial(fixture.port, config, { log: vi.fn(), signal: controller.signal });
    while (!fixture.writes.some(packet => packet.length === 4)) await new Promise(resolve => setTimeout(resolve, 0));
    expect((await runFlashReadTrial(fixture.port, config, { log: vi.fn() })).failure).toBe('port-already-open');
    controller.abort();
    const result = await run;
    expect(result).toMatchObject({ status: 'cancelled', cleanup: { closed: true }, read: { stage: 'md5', received: 1024, packets: 1 } });
    expect(result.read?.md5).toBeUndefined();
  });
});

describe('real ROM/startup bridge with independent chunk I/O', () => {
  it('handles boot noise, sync replies, actual stub upload, child hooks and B without legacy readers', async () => {
    const fixture = serial();
    const transcript = JSON.parse(readFileSync(new URL('./fixtures/esptool-transcripts/handshake-stub-s3.json', import.meta.url), 'utf8'));
    // Fixed 115200 requires no CHANGE_BAUDRATE, and the isolated page does not
    // request optional app security metadata after flash-ID detection.
    const steps = transcript.steps.slice(0, -2);
    const originalOpen = vi.mocked(fixture.port.open).getMockImplementation()!;
    vi.spyOn(fixture.port, 'open').mockImplementation(async options => {
      await originalOpen(options);
      fixture.enqueue([...new TextEncoder().encode('ESP-ROM startup\r\n'), 0xc0, 0x55, 0xdb]);
    });
    const legacyLoop = vi.spyOn(ESPLoader.prototype, 'readLoop');
    const legacyPacket = vi.spyOn(ESPLoader.prototype, 'readPacket');
    const readCommands: number[][] = [];
    let data = new Uint8Array();
    let awaitingDigestAck = false;
    fixture.onWrite(packet => {
      if (steps.length) {
        const step = steps.shift()!;
        expect(step.type).toBe('response');
        const opcode = typeof step.opcode === 'number' ? step.opcode : (opcodes as Record<string, unknown>)[step.opcode] as number;
        expect(packet[1]).toBe(opcode);
        const payload = [...Buffer.from((step.data ?? '') + (step.status ?? ''), 'hex')];
        const response = [...pack('<BBHI', 1, opcode, payload.length, Number(step.value ?? 0)), ...payload];
        const wire = slipEncode(response);
        if (opcode === opcodes.ESP_SYNC) {
          // Real ROM can produce eight responses; only one is consumed by _sync.
          for (let i = 0; i < 7; i++) wire.push(...slipEncode(response));
        }
        while (steps[0]?.type === 'raw') wire.push(...slipEncode([...Buffer.from(steps.shift().data, 'hex')]));
        fixture.enqueue(wire);
        return;
      }
      if (packet.length > 4) {
        expect(awaitingDigestAck).toBe(false);
        expect(packet[1]).toBe(ESP_READ_FLASH);
        const args = unpack('<IIII', packet.slice(8));
        readCommands.push(args);
        data = Uint8Array.from({ length: args[1] }, (_, i) => i & 255);
        awaitingDigestAck = true;
        // The command response and first payload are in a single native chunk.
        fixture.enqueue([...slipEncode(reply()), ...slipEncode([...data])]);
      } else {
        expect(unpack('<I', packet)).toEqual([data.length]);
        fixture.frame(md5(data));
        awaitingDigestAck = false;
      }
    });
    const log = vi.fn();
    const result = await runChunkReadDiagnostic(fixture.port, 'B', { log });
    expect(result.reads.map(read => read.size)).toEqual([32, 1024]);
    expect(steps).toEqual([]);
    expect(readCommands).toEqual([[0x8000, 32, 1024, 1], [0x8000, 1024, 1024, 1]]);
    expect(legacyLoop).not.toHaveBeenCalled();
    expect(legacyPacket).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('official ESP32-S3 esp-flasher-stub v1.2.2'));
    expect(fixture.close).toHaveBeenCalledOnce();
  });
});

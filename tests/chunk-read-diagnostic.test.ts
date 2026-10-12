import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as opcodes from 'tasmota-webserial-esptool/dist/const.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ESPLoader } from 'tasmota-webserial-esptool';
import { CHIP_FAMILY_ESP32S3, ESP_READ_FLASH } from 'tasmota-webserial-esptool/dist/const.js';
import { pack, unpack } from 'tasmota-webserial-esptool/dist/struct.js';
import { slipEncode } from 'tasmota-webserial-esptool/dist/util.js';
import { ChunkSerialTransport } from '../src/services/chunkSerialTransport';
import { CHUNK_DIAGNOSTIC_CASES, readFlashChunkStrict, runChunkReadDiagnostic } from '../src/services/chunkReadDiagnostic';

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
} = {}) {
  const commands: number[][] = [];
  const acks: number[] = [];
  let data = new Uint8Array();
  let sent = 0;
  let awaitedAck = 0;
  let digestSent = true;
  let sequence = 0;
  const next = () => {
    const packet = data.subarray(sent, Math.min(sent + 1024, data.length));
    sent += packet.length;
    awaitedAck = sent;
    fixture.frame([...packet.subarray(0, options.shortPacket ?? packet.length)]);
  };
  fixture.onWrite(packet => {
    if (packet.length === 1) return; // Read abort, never an ACK.
    if (packet.length >= 8 && packet[1] === ESP_READ_FLASH) {
      expect(digestSent).toBe(true);
      const args = unpack('<IIII', packet.slice(8));
      expect(args.slice(2)).toEqual([1024, 1]);
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

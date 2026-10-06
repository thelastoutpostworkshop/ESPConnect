import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ESPLoader } from 'tasmota-webserial-esptool';
import {
  CHIP_FAMILY_ESP32S2, CHIP_FAMILY_ESP32S3, ESP_READ_FLASH, USB_RAM_BLOCK,
} from 'tasmota-webserial-esptool/dist/const.js';
import { getStubCode } from 'tasmota-webserial-esptool/dist/stubs/index.js';
import { pack, unpack } from 'tasmota-webserial-esptool/dist/struct.js';
import { slipEncode } from 'tasmota-webserial-esptool/dist/util.js';
import { installFlashReadDiagnostics } from '../src/services/flashReadDiagnostics';

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const digest = (bytes: number[]) => Array.from(createHash('md5').update(new Uint8Array(bytes)).digest());

function setup(chipFamily = CHIP_FAMILY_ESP32S3) {
  vi.useFakeTimers();
  const logger = { log: vi.fn(), debug: vi.fn(), error: vi.fn() };
  const port = {
    getInfo: () => ({ usbVendorId: 0x303a, usbProductId: 0x1001 }),
    readable: {}, writable: {}, open: vi.fn(), close: vi.fn(),
  };
  const parent = new ESPLoader(port as unknown as SerialPort, logger);
  parent.chipFamily = chipFamily;
  parent.__inputBuffer = [];
  const loader = new ESPLoader(port as unknown as SerialPort, logger, parent);
  loader.IS_STUB = true;
  const enqueue = (bytes: number[]) => parent.__inputBuffer!.push(...bytes);
  const respond = () => enqueue(slipEncode([1, ESP_READ_FLASH, 2, 0, 0, 0, 0, 0, 0, 0]));
  const writes = vi.spyOn(loader, 'writeToStream').mockResolvedValue(undefined);
  installFlashReadDiagnostics(loader);
  return { loader, parent, logger, enqueue, respond, writes };
}

// Wire-level model of v1.2.2 READ_FLASH: one packet outstanding; a completed
// non-4-byte frame aborts; zero-byte SLIP gaps are ignored. This is not hardware.
function simulateStub(
  fixture: ReturnType<typeof setup>,
  failures = 0,
  shortFirstPacket = false,
) {
  const { loader, enqueue, respond, writes } = fixture;
  let active = false;
  let attempt = 0;
  let sent = 0;
  let size = 0;
  let packetSize = 0;
  let stalled = false;
  const aborts: number[][] = [];
  const acknowledgments: number[] = [];
  const bytes = (length: number) => Array(length).fill(0x55);
  const sendData = () => {
    const length = Math.min(packetSize, size - sent);
    sent += length;
    const receivedLength = shortFirstPacket && attempt === 1 ? length - 45 : length;
    enqueue(slipEncode(bytes(receivedLength)));
  };
  const commands = vi.spyOn(loader, 'sendCommand').mockImplementation(async (opcode, data) => {
    expect(opcode).toBe(ESP_READ_FLASH);
    // A new command must never be sent while the simulated stub still waits for an ACK.
    expect(active).toBe(false);
    const [, requestedSize, requestedPacket, maxInFlight] = unpack('<IIII', data);
    expect(requestedPacket).toBe(1024);
    expect(maxInFlight).toBe(1);
    size = requestedSize;
    packetSize = requestedPacket;
    sent = 0;
    active = true;
    stalled = ++attempt <= failures;
    respond();
    if (!stalled) sendData();
  });
  writes.mockImplementation(async frame => {
    expect(frame[0]).toBe(0xc0);
    expect(frame.at(-1)).toBe(0xc0);
    const payload: number[] = [];
    for (let index = 1; index < frame.length - 1; index++) {
      if (frame[index] === 0xdb) {
        const escaped = frame[++index];
        expect([0xdc, 0xdd]).toContain(escaped);
        payload.push(escaped === 0xdc ? 0xc0 : 0xdb);
      } else payload.push(frame[index]!);
    }
    if (payload.length === 0) return; // New stub ignores C0 C0.
    if (payload.length !== 4) {
      expect(active).toBe(true);
      aborts.push(frame);
      active = false;
      enqueue(slipEncode(digest(bytes(sent))));
      return;
    }
    const [acked] = unpack('<I', payload);
    acknowledgments.push(acked);
    if (stalled) return;
    if (sent < size) sendData();
    else if (acked >= size) {
      active = false;
      enqueue(slipEncode(digest(bytes(size))));
    }
  });
  return { commands, aborts, acknowledgments, isActive: () => active };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('official ESP32-S3 stub v1.2.2 experiment', () => {
  it('uses the official release asset and exact decoded text/data', async () => {
    const asset = readFileSync(new URL('../node_modules/tasmota-webserial-esptool/dist/stubs/esp32s3.json', import.meta.url));
    // patch-package appends a final newline; the upstream asset has none.
    const upstreamBytes = asset.at(-1) === 0x0a ? asset.subarray(0, -1) : asset;
    expect(sha256(upstreamBytes)).toBe('8816e0611701e8f7396a9fee9d1d33bc2021751bf24bda54560fb87c62de3f0b');
    const stub = (await getStubCode(CHIP_FAMILY_ESP32S3, 0))!;
    expect(stub.entry).toBe(0x40379524);
    expect(stub.text_start).toBe(0x40378000);
    expect(stub.data_start).toBe(0x3fcb2dc0);
    expect(stub.text).toHaveLength(7832);
    expect(stub.data).toHaveLength(264);
    expect(sha256(new Uint8Array(stub.text))).toBe('c37a7d12d52633fd629fbed13f3a7418216af368d8e80f17853ce6de29741374');
    expect(sha256(new Uint8Array(stub.data))).toBe('75be8e20e5c91b2b92cd02be9abe2462436648780e4878ea173598c5ed14df93');
  });

  it('uploads both exact segments and starts at the new entry point', async () => {
    const { parent, logger } = setup();
    const stub = (await getStubCode(CHIP_FAMILY_ESP32S3))!;
    const begin = vi.spyOn(parent, 'memBegin').mockResolvedValue([0, []]);
    const block = vi.spyOn(parent, 'memBlock').mockResolvedValue([0, []]);
    const finish = vi.spyOn(parent, 'memFinish').mockResolvedValue([0, []]);
    vi.spyOn(parent, 'readPacket').mockResolvedValue(Array.from('OHAI').map(c => c.charCodeAt(0)));
    const running = await parent.runStub(true);
    expect(running.IS_STUB).toBe(true);
    expect(running.chipFamily).toBe(CHIP_FAMILY_ESP32S3);
    expect(begin.mock.calls).toEqual([
      [stub.text.length, Math.ceil(stub.text.length / USB_RAM_BLOCK), USB_RAM_BLOCK, stub.text_start],
      [stub.data.length, Math.ceil(stub.data.length / USB_RAM_BLOCK), USB_RAM_BLOCK, stub.data_start],
    ]);
    expect(block.mock.calls.flatMap(([data]) => data)).toEqual([...stub.text, ...stub.data]);
    expect(finish).toHaveBeenCalledWith(0x40379524);
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('official ESP32-S3 esp-flasher-stub v1.2.2'));
    // Exercise real parent-delegated reconnect and runStub selection; only USB I/O is mocked.
    vi.spyOn(parent, 'hardReset').mockResolvedValue(undefined);
    vi.spyOn(parent, 'readLoop').mockResolvedValue(undefined);
    vi.spyOn(parent, 'flushSerialBuffers').mockResolvedValue(undefined);
    vi.spyOn(parent, 'sync').mockResolvedValue(true);
    await running.reconnect();
    expect(finish.mock.calls).toEqual([[0x40379524], [0x40379524]]);
    expect(begin.mock.calls.slice(2)).toEqual(begin.mock.calls.slice(0, 2));
    expect(running.chipFamily).toBe(CHIP_FAMILY_ESP32S3);
  });

  it('aborts a stalled new-stub read with a one-byte frame before retrying', async () => {
    const fixture = setup();
    const model = simulateStub(fixture, 1);
    const assertion = expect(fixture.loader.readFlash(0x810000, 1024)).resolves.toEqual(new Uint8Array(1024).fill(0x55));
    await vi.advanceTimersByTimeAsync(100);
    expect(model.isActive()).toBe(true);
    await fixture.loader.writeToStream([0xc0, 0xc0]);
    expect(model.isActive()).toBe(true);
    expect(model.aborts).toEqual([]);
    await vi.advanceTimersByTimeAsync(3900);
    await assertion;
    expect(model.commands).toHaveBeenCalledTimes(2);
    expect(model.aborts).toEqual([[0xc0, 0x00, 0xc0]]);
    expect(model.acknowledgments).toEqual([1024]);
    expect(model.isActive()).toBe(false);
  });

  it('retains the legacy abort frame on other chips', async () => {
    const { loader, enqueue, respond, writes } = setup(CHIP_FAMILY_ESP32S2);
    let attempts = 0;
    vi.spyOn(loader, 'sendCommand').mockImplementation(async () => {
      respond();
      enqueue(++attempts === 1 ? [0x42] : slipEncode(Array(32).fill(0x55)));
    });
    const assertion = expect(loader.readFlash(0x8000, 32)).resolves.toHaveLength(32);
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
    expect(writes.mock.calls[0]).toEqual([[0xc0, 0xc0]]);
    expect(writes).not.toHaveBeenCalledWith([0xc0, 0x00, 0xc0]);
  });

  it('keeps packet, window, chunk and progress behavior across consecutive reads', async () => {
    const fixture = setup();
    const model = simulateStub(fixture);
    for (const size of [32, 1024, 65536 + 32]) {
      const progress = vi.fn();
      const assertion = expect(fixture.loader.readFlash(0x810000, size, progress)).resolves.toEqual(new Uint8Array(size).fill(0x55));
      await vi.advanceTimersByTimeAsync(500);
      await assertion;
      expect(progress).toHaveBeenLastCalledWith(new Uint8Array(size > 65536 ? 32 : size), size, size);
    }
    expect(model.commands.mock.calls.map(([, bytes]) => unpack('<IIII', bytes))).toEqual([
      [0x810000, 32, 1024, 1], [0x810000, 1024, 1024, 1],
      [0x810000, 65536, 1024, 1], [0x820000, 32, 1024, 1],
    ]);
    expect(model.aborts).toEqual([]);
    // Deliberately retain baseline MD5 behavior for this binary comparison.
    expect(fixture.parent.__inputBuffer).toEqual(slipEncode(digest(Array(32).fill(0x55))));
  });

  it('recovers from the known 979/1024-byte short-ACK stall with the new abort', async () => {
    const fixture = setup();
    const model = simulateStub(fixture, 0, true);
    const assertion = expect(fixture.loader.readFlash(0x810000, 1024)).resolves.toEqual(new Uint8Array(1024).fill(0x55));
    await vi.advanceTimersByTimeAsync(4000);
    await assertion;
    expect(fixture.logger.log).toHaveBeenCalledWith(expect.stringContaining('expected=1024, actual=979'));
    // This documents the existing ACK flaw; this experiment does not fix it.
    expect(model.acknowledgments).toEqual([979, 1024]);
    expect(model.aborts).toEqual([[0xc0, 0x00, 0xc0]]);
    expect(model.commands).toHaveBeenCalledTimes(2);
  });

  it('retains the one-byte abort through deep recovery and then succeeds', async () => {
    const fixture = setup();
    const model = simulateStub(fixture, 6);
    const reconnect = vi.spyOn(fixture.loader, 'reconnect').mockResolvedValue(undefined);
    const assertion = expect(fixture.loader.readFlash(0x810000, 1024)).resolves.toHaveLength(1024);
    await vi.advanceTimersByTimeAsync(21000);
    await assertion;
    expect(reconnect).toHaveBeenCalledOnce();
    expect(model.commands).toHaveBeenCalledTimes(7);
    expect(model.aborts).toEqual(Array.from({ length: 6 }, () => [0xc0, 0x00, 0xc0]));
    expect(model.isActive()).toBe(false);
  });

  it('rejects after bounded retries and deep recovery when data never arrives', async () => {
    const fixture = setup();
    const model = simulateStub(fixture, Infinity);
    const reconnect = vi.spyOn(fixture.loader, 'reconnect').mockResolvedValue(undefined);
    const assertion = expect(fixture.loader.readFlash(0x810000, 1024)).rejects.toThrow('after 5 retries and deep recovery attempt');
    await vi.advanceTimersByTimeAsync(41000);
    await assertion;
    expect(reconnect).toHaveBeenCalledOnce();
    expect(model.commands).toHaveBeenCalledTimes(12);
    expect(model.aborts).toHaveLength(12);
    expect(model.isActive()).toBe(false);
  });
});

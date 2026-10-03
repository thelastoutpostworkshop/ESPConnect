import { afterEach, describe, expect, it, vi } from 'vitest';
import { ESPLoader } from 'tasmota-webserial-esptool';
import { ESP_READ_FLASH, SlipReadError } from 'tasmota-webserial-esptool/dist/const.js';
import { slipEncode } from 'tasmota-webserial-esptool/dist/util.js';
import { unpack } from 'tasmota-webserial-esptool/dist/struct.js';
import { installFlashReadDiagnostics } from '../src/services/flashReadDiagnostics';

function setup() {
  vi.useFakeTimers();
  const logger = { log: vi.fn(), debug: vi.fn(), error: vi.fn() };
  const port = { getInfo: () => ({ usbVendorId: 0x303a, usbProductId: 0x1001 }) };
  const parent = new ESPLoader(port as SerialPort, logger);
  parent.__inputBuffer = [];
  const loader = new ESPLoader(port as SerialPort, logger, parent);
  loader.IS_STUB = true;
  const enqueue = (bytes: number[]) => parent.__inputBuffer!.push(...bytes);
  const respond = () => enqueue(slipEncode([1, ESP_READ_FLASH, 2, 0, 0, 0, 0, 0, 0, 0]));
  const writes = vi.spyOn(loader, 'writeToStream').mockResolvedValue(undefined);
  return { loader, parent, logger, enqueue, respond, writes };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('issue #180 flash-read diagnostic build', () => {
  it('accepts delayed fragmented data and preserves ACKs, progress and the unread digest', async () => {
    const { loader, parent, logger, enqueue, respond, writes } = setup();
    const data = [0xc0, 0xdb, ...Array(30).fill(0x55)];
    const frame = slipEncode(data);
    vi.spyOn(loader, 'sendCommand').mockImplementation(async () => {
      respond();
      // Split inside an escaped byte, with both gaps longer than the old timeout.
      setTimeout(() => enqueue(frame.slice(0, 2)), 150);
      setTimeout(() => enqueue(frame.slice(2)), 350);
    });
    const digest = slipEncode(Array(16).fill(0xaa));
    writes.mockImplementation(async () => { enqueue(digest); });
    const progress = vi.fn();
    installFlashReadDiagnostics(loader);
    const read = loader.readFlash(0x8000, 32, progress);
    const assertion = expect(read).resolves.toEqual(new Uint8Array(data));
    await vi.advanceTimersByTimeAsync(600);
    await assertion;
    expect(writes.mock.calls).toEqual([[slipEncode([32, 0, 0, 0])]]);
    expect(progress).toHaveBeenCalledWith(new Uint8Array(32), 32, 32);
    expect(parent.__inputBuffer).toEqual(digest);
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Build=issue-180-timeout-3s'));
    expect(logger.log.mock.calls.some(([line]) => line.includes('Packet failure'))).toBe(false);
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('returned=32, buffered=18'));

    // Flash diagnostics must not change unrelated packet deadlines.
    const ordinaryRead = loader.readPacket(10);
    const ordinaryAssertion = expect(ordinaryRead).resolves.toEqual(Array(16).fill(0xaa));
    await vi.advanceTimersByTimeAsync(10);
    await ordinaryAssertion;
    const timeout = expect(loader.readPacket(10)).rejects.toBeInstanceOf(SlipReadError);
    await vi.advanceTimersByTimeAsync(20);
    await timeout;
  });

  it('keeps consecutive 32-byte and 1024-byte reads separate', async () => {
    const { loader, logger, enqueue, respond, writes } = setup();
    vi.spyOn(loader, 'sendCommand').mockImplementation(async (_opcode, buffer) => {
      const [, size] = unpack('<IIII', buffer);
      respond();
      setTimeout(() => enqueue(slipEncode(Array(size).fill(0x55))), 150);
    });
    // Keep the upstream digest behavior so this tests the same wire sequence.
    writes.mockImplementation(async () => { enqueue(slipEncode(Array(16).fill(0xaa))); });
    installFlashReadDiagnostics(loader);
    for (const size of [32, 1024]) {
      const assertion = expect(loader.readFlash(0x8000, size)).resolves.toEqual(new Uint8Array(size).fill(0x55));
      await vi.advanceTimersByTimeAsync(300);
      await assertion;
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining(`size=${size}, stage=command-response, attempt=1, received=0/${size}`));
    }
    expect(writes.mock.calls).toEqual([
      [slipEncode([32, 0, 0, 0])],
      [slipEncode([0, 4, 0, 0])],
    ]);
  });

  it.each([
    { bytes: [0x42], error: 'Invalid head of packet (0x42)' },
    { bytes: [0xc0, 0xdb, 0xee], error: 'Invalid SLIP escape (0xdb, 0xEE)' },
  ])('logs $error with partial progress before retrying', async ({ bytes, error }) => {
    const { loader, logger, enqueue, respond } = setup();
    const packet = Array(4096).fill(0x55);
    let attempt = 0;
    vi.spyOn(loader, 'sendCommand').mockImplementation(async () => {
      respond();
      enqueue(slipEncode(packet));
      enqueue(++attempt === 1 ? bytes : slipEncode(packet));
    });
    installFlashReadDiagnostics(loader);
    const read = loader.readFlash(0x810000, 8192);
    const assertion = expect(read).resolves.toEqual(new Uint8Array(8192).fill(0x55));
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('stage=data-packet, attempt=1, received=4096/8192, packets=1'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining(`error=SlipReadError: ${error}`));
    expect(attempt).toBe(2);
  });

  it('reports a data content timeout and succeeds on the next attempt', async () => {
    const { loader, logger, enqueue, respond } = setup();
    let attempt = 0;
    vi.spyOn(loader, 'sendCommand').mockImplementation(async () => {
      respond();
      enqueue(++attempt === 1 ? [0xc0, 0x55] : slipEncode(Array(32).fill(0x55)));
    });
    installFlashReadDiagnostics(loader);
    const assertion = expect(loader.readFlash(0x8000, 32)).resolves.toHaveLength(32);
    await vi.advanceTimersByTimeAsync(4000);
    await assertion;
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('stage=data-packet, attempt=1, received=0/32'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Timed out waiting for packet content'));
  });

  it('distinguishes command response failures from data failures', async () => {
    const { loader, logger, enqueue, respond } = setup();
    let attempt = 0;
    vi.spyOn(loader, 'sendCommand').mockImplementation(async () => {
      if (++attempt === 1) enqueue([0x42]);
      else {
        respond();
        enqueue(slipEncode(Array(32).fill(0x55)));
      }
    });
    installFlashReadDiagnostics(loader);
    const assertion = expect(loader.readFlash(0x8000, 32)).resolves.toHaveLength(32);
    await vi.advanceTimersByTimeAsync(200);
    await assertion;
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('stage=command-response, attempt=1, received=0/32'));
  });

  it('retains deep recovery and reads 64 KB with the original packet window', async () => {
    const { loader, logger, enqueue, respond, writes } = setup();
    let attempt = 0;
    vi.spyOn(loader, 'sendCommand').mockImplementation(async (_opcode, buffer) => {
      expect(unpack('<IIII', buffer)).toEqual([0x810000, 65536, 4096, 1024]);
      respond();
      if (++attempt <= 6) enqueue([0x42]);
      else for (let i = 0; i < 16; i++) enqueue(slipEncode(Array(4096).fill(0x55)));
    });
    const reconnect = vi.spyOn(loader, 'reconnect').mockResolvedValue(undefined);
    installFlashReadDiagnostics(loader);
    const assertion = expect(loader.readFlash(0x810000, 65536)).resolves.toEqual(new Uint8Array(65536).fill(0x55));
    await vi.advanceTimersByTimeAsync(3000);
    await assertion;
    expect(reconnect).toHaveBeenCalledOnce();
    expect(writes.mock.calls.filter(([frame]) => frame.length === 2)).toHaveLength(6);
    expect(writes.mock.calls.at(-1)).toEqual([slipEncode([0, 0, 1, 0])]);
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('stage=command-response, attempt=7'));
  });

  it('preserves ACK write errors and installs only once', async () => {
    const { loader, logger, enqueue, respond, writes } = setup();
    vi.spyOn(loader, 'sendCommand').mockImplementation(async () => {
      respond();
      enqueue(slipEncode(Array(32).fill(0x55)));
    });
    const error = new Error('ACK write failed');
    writes.mockRejectedValue(error);
    installFlashReadDiagnostics(loader);
    const wrapper = loader.readFlash;
    installFlashReadDiagnostics(loader);
    expect(loader.readFlash).toBe(wrapper);
    const assertion = expect(loader.readFlash(0x8000, 32)).rejects.toBe(error);
    await vi.advanceTimersByTimeAsync(200);
    await assertion;
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('stage=acknowledgment, attempt=1, received=32/32'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('error=Error: ACK write failed'));
  });
});

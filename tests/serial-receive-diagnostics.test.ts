import { afterEach, describe, expect, it, vi } from 'vitest';
import { ESPLoader } from 'tasmota-webserial-esptool';
import { ESP_READ_FLASH } from 'tasmota-webserial-esptool/dist/const.js';
import { slipEncode } from 'tasmota-webserial-esptool/dist/util.js';
import { installFlashReadDiagnostics } from '../src/services/flashReadDiagnostics';
import {
  createDiagnosticSerialPort,
  DIAGNOSTIC_SERIAL_BUFFER_SIZE,
  serialReceiveSnapshot,
} from '../src/services/serialReceiveDiagnostics';

function setup() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const readable = new ReadableStream<Uint8Array>({ start(value) { controller = value; } });
  const logger = { log: vi.fn(), debug: vi.fn(), error: vi.fn() };
  const raw = Object.assign(new EventTarget(), {
    readable,
    writable: new WritableStream<Uint8Array>(),
    open: vi.fn(async function (this: SerialPort, _options: SerialOptions) {
      expect(this).toBe(raw);
    }),
    close: vi.fn(async () => {}),
    getInfo() { expect(this).toBe(raw); return { usbVendorId: 0x303a }; },
    setSignals: vi.fn(async () => {}),
    getSignals: vi.fn(async () => ({})),
  });
  const port = createDiagnosticSerialPort(raw, logger);
  return { raw, port, logger, controller };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('issue #180 serial receive diagnostics', () => {
  it('uses 64 KB on initial, baud-change and recovery opens without altering other options', async () => {
    const { raw, port, logger } = setup();
    await port.open({ baudRate: 115200, parity: 'even', bufferSize: 255 });
    const loader = new ESPLoader(port, logger);
    vi.spyOn(loader, 'readLoop').mockResolvedValue(undefined);
    vi.spyOn(loader, 'flushSerialBuffers').mockResolvedValue(undefined);
    await loader.reconfigurePort(921600);
    vi.spyOn(loader, 'hardReset').mockResolvedValue(undefined);
    vi.spyOn(loader, 'sync').mockResolvedValue(true);
    vi.spyOn(loader, 'runStub').mockResolvedValue(loader);
    await loader.reconnect();
    expect(raw.open.mock.calls.map(([options]) => options)).toEqual([
      { baudRate: 115200, parity: 'even', bufferSize: DIAGNOSTIC_SERIAL_BUFFER_SIZE },
      { baudRate: 921600, bufferSize: DIAGNOSTIC_SERIAL_BUFFER_SIZE },
      { baudRate: 115200, bufferSize: DIAGNOSTIC_SERIAL_BUFFER_SIZE },
    ]);
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('bufferSize=65536'));
  });

  it('forwards native methods, getters, events and original data without replacing the reader', async () => {
    const { raw, port, controller } = setup();
    expect(port.getInfo()).toEqual({ usbVendorId: 0x303a });
    const listener = vi.fn();
    port.addEventListener('disconnect', listener);
    raw.dispatchEvent(new Event('disconnect'));
    expect(listener).toHaveBeenCalledOnce();
    port.removeEventListener('disconnect', listener);
    expect(port.writable).toBe(raw.writable);
    expect(port.readable).toBe(port.readable);
    const reader = port.readable!.getReader();
    expect(raw.readable.locked).toBe(true);
    expect(port.readable!.locked).toBe(true);
    const bytes = new Uint8Array([0xc0, 0xdb, 0x55]);
    controller.enqueue(bytes);
    expect((await reader.read()).value).toBe(bytes);
    await reader.cancel();
    expect((await reader.read()).done).toBe(true);
    reader.releaseLock();
    expect(raw.readable.locked).toBe(false);
    expect(serialReceiveSnapshot(port)).toEqual({ bytes: 3, chunks: 1, errors: 0, recentChunkSizes: [3] });
    expect(raw.open).not.toHaveBeenCalled();
  });

  it('keeps only eight recent chunk sizes and returns independent snapshots', async () => {
    const { port, controller } = setup();
    const reader = port.readable!.getReader();
    for (let size = 1; size <= 10; size++) {
      controller.enqueue(new Uint8Array(size));
      await reader.read();
    }
    const snapshot = serialReceiveSnapshot(port)!;
    expect(snapshot).toEqual({ bytes: 55, chunks: 10, errors: 0, recentChunkSizes: [3, 4, 5, 6, 7, 8, 9, 10] });
    snapshot.recentChunkSizes.length = 0;
    snapshot.bytes = 0;
    expect(serialReceiveSnapshot(port)?.bytes).toBe(55);
    expect(serialReceiveSnapshot(port)?.recentChunkSizes).toHaveLength(8);
    await reader.cancel();
    reader.releaseLock();
  });

  it('logs errors that the real loader read loop suppresses, then preserves its cleanup', async () => {
    const { raw, port, logger, controller } = setup();
    const loader = new ESPLoader(port, logger);
    loader.__inputBuffer = [];
    loader.connected = true;
    const disconnected = vi.fn();
    loader.addEventListener('disconnect', disconnected);
    const loop = loader.readLoop();
    controller.enqueue(new Uint8Array([0xc0, 0x55]));
    await vi.waitFor(() => expect(loader.__inputBuffer).toEqual([0xc0, 0x55]));
    const error = new DOMException('Receive buffer overflow', 'BufferOverrunError');
    controller.error(error);
    await loop;
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('error=BufferOverrunError: Receive buffer overflow'));
    expect(serialReceiveSnapshot(port)).toMatchObject({ bytes: 2, chunks: 1, errors: 1 });
    expect(loader.connected).toBe(false);
    expect(disconnected).toHaveBeenCalledOnce();
    expect(raw.readable.locked).toBe(false);
    expect(raw.open).not.toHaveBeenCalled();
  });

  it('rethrows the original reader error and propagates port open failures', async () => {
    const { raw, port, logger, controller } = setup();
    const reader = port.readable!.getReader();
    const error = new DOMException('Device disconnected', 'NetworkError');
    controller.error(error);
    await expect(reader.read()).rejects.toBe(error);
    reader.releaseLock();
    raw.open.mockRejectedValueOnce(error);
    await expect(port.open({ baudRate: 115200 })).rejects.toBe(error);
    expect(logger.log.mock.calls.some(([line]) => line.includes('Serial opened:'))).toBe(false);
  });

  it('reports raw receive bytes even when no complete flash packet was decoded', async () => {
    vi.useFakeTimers();
    const { port, logger, controller } = setup();
    const loader = new ESPLoader(port, logger);
    loader.__inputBuffer = [];
    loader.IS_STUB = true;
    const loop = loader.readLoop();
    vi.spyOn(loader, 'writeToStream').mockResolvedValue(undefined);
    let attempt = 0;
    vi.spyOn(loader, 'sendCommand').mockImplementation(async () => {
      const response = slipEncode([1, ESP_READ_FLASH, 2, 0, 0, 0, 0, 0, 0, 0]);
      const data = ++attempt === 1 ? [0xc0, 0x55] : slipEncode(Array(1024).fill(0x55));
      controller.enqueue(new Uint8Array([...response, ...data]));
    });
    installFlashReadDiagnostics(loader);
    const assertion = expect(loader.readFlash(0x8000, 1024)).resolves.toEqual(new Uint8Array(1024).fill(0x55));
    await vi.advanceTimersByTimeAsync(4000);
    await assertion;
    const failure = logger.log.mock.calls.find(([line]) => line.includes('Packet failure'))?.[0];
    expect(failure).toContain('received=0/1024, packets=0');
    expect(failure).toContain('rxBytes=14, rxChunks=1, rxErrors=0, recentRxChunkSizes=[14]');
    expect(failure).toContain('Timed out waiting for packet content');
    const returned = logger.log.mock.calls.find(([line]) => line.includes('Read returned'))?.[0];
    expect(returned).toContain('rxBytes=1052, rxChunks=2, rxErrors=0, recentRxChunkSizes=[14,1038]');
    controller.close();
    await loop;
  });
});

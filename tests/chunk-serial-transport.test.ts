import { afterEach, describe, expect, it, vi } from 'vitest';
import { CHUNK_SERIAL_LIMITS, ChunkSerialTransport } from '../src/services/chunkSerialTransport';

const transports: ChunkSerialTransport[] = [];
const microtasks = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const slip = (payload: number[]) => [0xc0, ...payload.flatMap(byte => byte === 0xc0 ? [0xdb, 0xdc] : byte === 0xdb ? [0xdb, 0xdd] : [byte]), 0xc0];

function fixture(options: {
  signal?: AbortSignal; visibility?: () => string;
  captureFrames?: boolean;
  write?: (bytes: Uint8Array) => Promise<void> | void;
  cancel?: () => Promise<void> | void;
} = {}) {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const cancel = vi.fn(options.cancel ?? (() => {}));
  const readable = new ReadableStream<Uint8Array>({ start(c) { controller = c; }, cancel });
  const sent: Uint8Array[] = [];
  const sinkAbort = vi.fn();
  const writable = new WritableStream<Uint8Array>({
    async write(bytes) { sent.push(bytes); await options.write?.(bytes); },
    abort: sinkAbort,
  });
  const getReader = readable.getReader.bind(readable);
  let activeReads = 0;
  let maximumReads = 0;
  let reader!: ReadableStreamDefaultReader<Uint8Array>;
  const readerAcquired = vi.spyOn(readable, 'getReader').mockImplementation(() => {
    reader = getReader();
    const read = reader.read.bind(reader);
    vi.spyOn(reader, 'read').mockImplementation(() => {
      activeReads++;
      maximumReads = Math.max(maximumReads, activeReads);
      return read().finally(() => { activeReads--; });
    });
    vi.spyOn(reader, 'cancel');
    vi.spyOn(reader, 'releaseLock');
    return reader;
  });
  const getWriter = writable.getWriter.bind(writable);
  let writer!: WritableStreamDefaultWriter<Uint8Array>;
  const writerAcquired = vi.spyOn(writable, 'getWriter').mockImplementation(() => {
    writer = getWriter();
    vi.spyOn(writer, 'abort');
    vi.spyOn(writer, 'releaseLock');
    return writer;
  });
  const port = Object.assign(new EventTarget(), {
    readable, writable, close: vi.fn(async () => {}), open: vi.fn(async () => {}),
    getInfo: () => ({}), getSignals: vi.fn(async () => ({})), setSignals: vi.fn(async () => {}),
  });
  const transport = new ChunkSerialTransport(port, options);
  transports.push(transport);
  return {
    transport, port, readable, writable, controller, cancel, sinkAbort, sent, readerAcquired, writerAcquired,
    get reader() { return reader; }, get writer() { return writer; },
    get activeReads() { return activeReads; }, get maximumReads() { return maximumReads; },
    async enqueue(bytes: number[] | Uint8Array) { controller.enqueue(bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes)); await microtasks(); },
  };
}

afterEach(async () => {
  await Promise.all(transports.splice(0).map(transport => transport.close()));
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('independent chunk Web Serial transport', () => {
  it('takes exactly one reader and writer synchronously and pumps only one read at a time', async () => {
    const f = fixture();
    f.transport.start();
    f.transport.start();
    expect(f.readerAcquired).toHaveBeenCalledOnce();
    expect(f.writerAcquired).toHaveBeenCalledOnce();
    expect(f.readable.locked).toBe(true);
    expect(f.writable.locked).toBe(true);
    expect(f.activeReads).toBe(1);
    expect(() => f.readable.getReader()).toThrow();
    await f.enqueue(slip([1]));
    await f.enqueue(slip([2]));
    expect(f.maximumReads).toBe(1);
    expect(f.activeReads).toBe(1);
    expect(f.port.open).not.toHaveBeenCalled();
    await f.transport.close();
    expect(f.activeReads).toBe(0);
    expect(f.readable.locked).toBe(false);
    expect(f.writable.locked).toBe(false);
    expect(f.port.close).not.toHaveBeenCalled();
  });

  it('refuses locks already owned elsewhere without cancelling their reader', async () => {
    const f = fixture();
    const existing = f.readable.getReader();
    expect(() => f.transport.start()).toThrow(/locked/);
    expect(f.writerAcquired).not.toHaveBeenCalled();
    await f.transport.close();
    expect(f.readable.locked).toBe(true);
    expect(f.cancel).not.toHaveBeenCalled();
    await existing.cancel();
    existing.releaseLock();
  });

  it('does not acquire a reader if the writer is already locked', async () => {
    const f = fixture();
    const writer = f.writable.getWriter();
    expect(() => f.transport.start()).toThrow(/locked/);
    expect(f.readerAcquired).not.toHaveBeenCalled();
    writer.releaseLock();
  });

  it('unwinds an acquired reader when writer acquisition fails', () => {
    const f = fixture();
    f.writerAcquired.mockImplementationOnce(() => { throw new Error('writer unavailable'); });
    expect(() => f.transport.start()).toThrow(/writer unavailable/);
    expect(f.readable.locked).toBe(false);
    expect(f.cancel).not.toHaveBeenCalled();
  });

  it('decodes split escapes and arbitrary chunk boundaries without mutating source chunks', async () => {
    const f = fixture();
    f.transport.start();
    f.transport.setStrictMode();
    const result = f.transport.readPacket(1000);
    const chunks = [[0xc0, 1, 0xdb], [0xdc], [0xdb], [0xdd, 2], [0xc0]].map(value => Uint8Array.from(value));
    const copies = chunks.map(value => value.slice());
    for (const chunk of chunks) await f.enqueue(chunk);
    expect(await result).toEqual([1, 0xc0, 0xdb, 2]);
    expect(chunks).toEqual(copies);
    expect(() => f.transport.assertIdle()).not.toThrow();
    expect(f.maximumReads).toBe(1);
  });

  it('queues a coalesced response, data packet, and digest separately', async () => {
    const f = fixture();
    f.transport.start();
    f.transport.setStrictMode();
    const response = [1, 0xd2, 2, 0, 0, 0, 0, 0, 0, 0];
    const data = Array(1024).fill(0x55);
    const digest = Array.from({ length: 16 }, (_, i) => i);
    const first = f.transport.readPacket(1000);
    await f.enqueue([...slip(response), ...slip(data), ...slip(digest)]);
    expect(await first).toEqual(response);
    expect(() => f.transport.assertIdle()).toThrow(/unconsumed/);
    expect(await f.transport.readPacket(1000)).toEqual(data);
    expect(await f.transport.readPacket(1000)).toEqual(digest);
    expect(() => f.transport.assertIdle()).not.toThrow();
  });

  it('ignores empty frames at startup and between packets', async () => {
    const f = fixture();
    f.transport.start();
    f.transport.setStrictMode();
    await f.enqueue([0xc0, 0xc0, ...slip([1]), 0xc0, 0xc0, ...slip([2]), 0xc0, 0xc0]);
    expect(await f.transport.readPacket(1000)).toEqual([1]);
    expect(await f.transport.readPacket(1000)).toEqual([2]);
    expect(() => f.transport.assertIdle()).not.toThrow();
    expect(f.transport.getTrace()[0]).toContain('emptyFrames=3');
  });

  it('preserves short packet lengths for protocol validation and enforces the 4096-byte bound', async () => {
    const f = fixture();
    f.transport.start();
    f.transport.setStrictMode();
    await f.enqueue(slip([1, 2, 3]));
    expect(await f.transport.readPacket(1000)).toHaveLength(3);
    await f.enqueue(slip(Array(4096).fill(0x55)));
    expect(await f.transport.readPacket(1000)).toHaveLength(4096);
    const pending = expect(f.transport.readPacket(1000)).rejects.toThrow(/4096-byte/);
    await f.enqueue(slip(Array(4097).fill(0x55)));
    await pending;
    expect(f.transport.getSnapshot().partialBytes).toBe(4096);
    expect(() => f.transport.assertIdle()).toThrow(/4096-byte/);
  });

  it.each([
    ['invalid head', [0x55], /Invalid SLIP head/],
    ['invalid escape', [0xc0, 0xdb, 0x44], /Invalid SLIP escape/],
    ['escape followed by delimiter', [0xc0, 0xdb, 0xc0], /Invalid SLIP escape/],
  ] as const)('fails strict decoding on %s without returning an earlier frame in the chunk', async (_name, suffix, error) => {
    const f = fixture();
    f.transport.start();
    f.transport.setStrictMode();
    const assertion = expect(f.transport.readPacket(1000)).rejects.toThrow(error);
    await f.enqueue([...slip([1]), ...suffix]);
    await assertion;
    await expect(f.transport.readPacket(1000)).rejects.toThrow(error);
    expect(f.activeReads).toBe(0);
    expect(f.cancel).toHaveBeenCalledOnce();
  });

  it('counts boot noise and corrupt boot framing, with explicit startup-only discards', async () => {
    const f = fixture();
    f.transport.start();
    await f.enqueue([0x41, 0x42, 0xc0, 0xdb, 0x66, 0x77, 0xc0, ...slip([9]), 0xc0, 3, 0xdb]);
    expect(f.transport.getSnapshot()).toMatchObject({ queuedFrames: 1, partialBytes: 1, inFrame: true, escaped: true });
    expect(() => f.transport.assertIdle()).toThrow(/unconsumed/);
    f.transport.discardBootInput('rom-sync');
    expect(() => f.transport.assertIdle()).not.toThrow();
    expect(f.transport.getTrace().join('\n')).toContain('boot-discard reason=rom-sync frames=1 bytes=2 partial=1 escape=1');
    expect(f.transport.getTrace()[0]).toContain('bootNoiseBytes=3');
    expect(f.transport.getTrace()[0]).toContain('bootFramingErrors=1');
    f.transport.setStrictMode();
    expect(() => f.transport.discardBootInput('startup')).toThrow(/strict mode/);
  });

  it('rejects EOF mid-frame and retains partial metadata for failure reporting', async () => {
    const f = fixture();
    f.transport.start();
    f.transport.setStrictMode();
    const assertion = expect(f.transport.readPacket(1000)).rejects.toThrow(/partial frame/);
    await f.enqueue([0xc0, 1, 2, 0xdb]);
    f.controller.close();
    await assertion;
    expect(f.transport.getSnapshot()).toMatchObject({ rxBytes: 4, rxChunks: 1, partialBytes: 2, escaped: true });
    const beforeClose = f.transport.getSnapshot();
    await f.transport.close();
    expect(f.transport.getSnapshot()).toEqual(beforeClose);
    expect(f.transport.getTrace().join('\n')).toContain('partialBytes=2 inFrame=1 escaped=1');
    expect(f.activeReads).toBe(0);
    expect(f.readable.locked).toBe(false);
  });

  it('propagates underlying read failure without logging its potentially sensitive message', async () => {
    const f = fixture();
    f.transport.start();
    const assertion = expect(f.transport.readPacket(1000)).rejects.toThrow(/Serial read failed/);
    f.controller.error(new Error('flash SECRET-123456'));
    await assertion;
    expect(f.transport.getTrace().join('\n')).not.toContain('SECRET');
    expect(() => f.transport.assertIdle()).toThrow(/Serial read failed/);
    await f.transport.close();
    expect(f.readable.locked).toBe(false);
  });

  it('refuses concurrent packet waiters without disturbing the original waiter', async () => {
    const f = fixture();
    f.transport.start();
    const first = f.transport.readPacket(1000);
    await expect(f.transport.readPacket(1000)).rejects.toThrow(/Concurrent/);
    await f.enqueue(slip([1, 2]));
    expect(await first).toEqual([1, 2]);
  });

  it('resets packet idle timeout on every incoming nonempty raw chunk', async () => {
    vi.useFakeTimers();
    const f = fixture();
    f.transport.start();
    f.transport.setStrictMode();
    const result = f.transport.readPacket(100);
    await vi.advanceTimersByTimeAsync(90);
    await f.enqueue([0xc0, 1]);
    await vi.advanceTimersByTimeAsync(90);
    await f.enqueue([0xdb]);
    await vi.advanceTimersByTimeAsync(90);
    await f.enqueue([0xdc, 0xc0]);
    expect(await result).toEqual([1, 0xc0]);
    expect(f.cancel).not.toHaveBeenCalled();
  });

  it('allows boot timeout retries through the same owned read without orphaning low-level reads', async () => {
    vi.useFakeTimers();
    const f = fixture();
    f.transport.start();
    const timedOut = expect(f.transport.readPacket(100)).rejects.toThrow(/Timed out/);
    await vi.advanceTimersByTimeAsync(100);
    await timedOut;
    expect(f.reader.read).toHaveBeenCalledOnce();
    expect(f.activeReads).toBe(1);
    expect(f.cancel).not.toHaveBeenCalled();
    const retried = f.transport.readPacket(100);
    await f.enqueue(slip([8]));
    expect(await retried).toEqual([8]);
    expect(f.maximumReads).toBe(1);
    await f.transport.close();
    expect(f.activeReads).toBe(0);
    expect(f.readable.locked).toBe(false);
  });

  it('cancels the strict timed-out pump and permits only one protocol abort before close', async () => {
    vi.useFakeTimers();
    const f = fixture();
    f.transport.start();
    f.transport.setStrictMode();
    const timedOut = expect(f.transport.readPacket(100)).rejects.toThrow(/Timed out/);
    await f.enqueue([0xc0, 7]);
    await vi.advanceTimersByTimeAsync(100);
    await timedOut;
    expect(f.activeReads).toBe(0);
    expect(f.cancel).toHaveBeenCalledOnce();
    expect(f.transport.getSnapshot().partialBytes).toBe(1);
    await expect(f.transport.write([1])).rejects.toThrow(/Timed out/);
    await f.transport.abortRead();
    expect(f.sent.map(bytes => [...bytes])).toEqual([[0xc0, 0, 0xc0]]);
    await expect(f.transport.abortRead()).rejects.toThrow(/already attempted/);
    await f.transport.close();
    expect(f.readable.locked).toBe(false);
    expect(f.writable.locked).toBe(false);
    expect(f.maximumReads).toBe(1);
  });

  it('does not extend idle timeout for empty chunks', async () => {
    vi.useFakeTimers();
    const f = fixture();
    f.transport.start();
    f.transport.setStrictMode();
    const timedOut = expect(f.transport.readPacket(100)).rejects.toThrow(/Timed out/);
    await vi.advanceTimersByTimeAsync(90);
    await f.enqueue([]);
    await vi.advanceTimersByTimeAsync(10);
    await timedOut;
  });

  it('cancels during a partial escape, rejects waiters, and releases all locks', async () => {
    const controller = new AbortController();
    const f = fixture({ signal: controller.signal });
    f.transport.start();
    f.transport.setStrictMode();
    const result = expect(f.transport.readPacket(1000)).rejects.toMatchObject({ name: 'AbortError' });
    await f.enqueue([0xc0, 4, 0xdb]);
    controller.abort('do not record SECRET');
    await result;
    await f.transport.close();
    expect(f.reader.cancel).toHaveBeenCalledOnce();
    expect(f.activeReads).toBe(0);
    expect(f.readable.locked).toBe(false);
    expect(f.writable.locked).toBe(false);
    expect(f.transport.getTrace().join('\n')).not.toContain('SECRET');
  });

  it('rejects a pre-aborted start without acquiring any locks', async () => {
    const controller = new AbortController();
    controller.abort();
    const f = fixture({ signal: controller.signal });
    expect(() => f.transport.start()).toThrow(/cancelled/);
    expect(f.readerAcquired).not.toHaveBeenCalled();
    expect(f.writerAcquired).not.toHaveBeenCalled();
    await f.transport.close();
  });

  it('makes repeated close calls share cleanup and reject a pending read', async () => {
    const f = fixture();
    f.transport.start();
    const pending = expect(f.transport.readPacket(1000)).rejects.toThrow(/closed/);
    const closing = f.transport.close();
    expect(f.transport.close()).toBe(closing);
    await closing;
    await pending;
    expect(f.reader.cancel).toHaveBeenCalledOnce();
    expect(f.reader.releaseLock).toHaveBeenCalledOnce();
    expect(f.writer.releaseLock).toHaveBeenCalledOnce();
    expect(f.writer.abort).not.toHaveBeenCalled();
    expect(f.transport.close()).toBe(closing);
    expect(f.port.close).not.toHaveBeenCalled();
  });

  it('reports a failed native lock release instead of claiming cleanup completed', async () => {
    const f = fixture();
    f.transport.start();
    vi.mocked(f.reader.releaseLock).mockImplementationOnce(() => { throw new Error('release failed'); });
    await expect(f.transport.close()).rejects.toThrow(/lock could not be released/);
    expect(f.transport.getTrace().join('\n')).toContain('cleanup-incomplete');
    expect(f.transport.getTrace().some(line => line.endsWith(' closed'))).toBe(false);
    expect(f.readable.locked).toBe(true);
    f.reader.releaseLock();
    // This deliberately failed close remains idempotently rejected.
    transports.splice(transports.indexOf(f.transport), 1);
  });

  it('observes abort-triggered cleanup rejection while leaving it reportable to the caller', async () => {
    const controller = new AbortController();
    const f = fixture({ signal: controller.signal });
    f.transport.start();
    vi.mocked(f.writer.releaseLock).mockImplementationOnce(() => { throw new Error('release failed'); });
    controller.abort();
    // Let internal fire-and-forget cleanup reject before the caller asks for it.
    // Vitest also fails the suite on any unhandled rejection.
    await microtasks();
    await expect(f.transport.close()).rejects.toThrow(/lock could not be released/);
    expect(f.transport.getTrace().join('\n')).toContain('cleanup-incomplete');
    f.writer.releaseLock();
    transports.splice(transports.indexOf(f.transport), 1);
  });

  it('detects a silent failed release from the owned stream lock state', async () => {
    const f = fixture();
    f.transport.start();
    vi.mocked(f.writer.releaseLock).mockImplementationOnce(() => {});
    await expect(f.transport.close()).rejects.toThrow(/lock could not be released/);
    expect(f.transport.getTrace().join('\n')).toContain('stream-still-locked');
    expect(f.writable.locked).toBe(true);
    f.writer.releaseLock();
    transports.splice(transports.indexOf(f.transport), 1);
  });

  it('serializes writes, copies caller input, and releases the writer cleanly', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const f = fixture({ write: async () => { if (f.sent.length === 1) await gate; } });
    f.transport.start();
    const firstBytes = [1, 2];
    const first = f.transport.write(firstBytes);
    const second = f.transport.write([3, 4]);
    firstBytes[0] = 99;
    await microtasks();
    expect(f.sent.map(bytes => [...bytes])).toEqual([[1, 2]]);
    release();
    await Promise.all([first, second]);
    expect(f.sent.map(bytes => [...bytes])).toEqual([[1, 2], [3, 4]]);
    await f.transport.close();
    expect(f.writer.abort).not.toHaveBeenCalled();
    expect(f.writable.locked).toBe(false);
  });

  it('rejects write failures and cleans up without disclosing source error content', async () => {
    const f = fixture({ write: () => { throw new Error('SECRET packet body'); } });
    f.transport.start();
    await expect(f.transport.write([1])).rejects.toThrow(/Serial write failed/);
    expect(f.transport.getTrace().join('\n')).not.toContain('SECRET');
    await f.transport.close();
    expect(f.activeReads).toBe(0);
    expect(f.writable.locked).toBe(false);
  });

  it('bounds stalled writes and a hung native cancellation, then releases owned locks', async () => {
    vi.useFakeTimers();
    let finishWrite!: () => void;
    let finishCancel!: () => void;
    const writeGate = new Promise<void>(resolve => { finishWrite = resolve; });
    const cancelGate = new Promise<void>(resolve => { finishCancel = resolve; });
    const f = fixture({ write: () => writeGate, cancel: () => cancelGate });
    f.transport.start();
    const pending = expect(f.transport.write([1])).rejects.toThrow(/write timed out/);
    await vi.advanceTimersByTimeAsync(CHUNK_SERIAL_LIMITS.writeTimeoutMs);
    await pending;
    const closing = f.transport.close();
    await vi.advanceTimersByTimeAsync(CHUNK_SERIAL_LIMITS.cleanupTimeoutMs);
    await closing;
    expect(f.writer.abort).toHaveBeenCalledOnce();
    expect(f.readable.locked).toBe(false);
    expect(f.writable.locked).toBe(false);
    expect(f.activeReads).toBe(0);
    expect(f.transport.getTrace().join('\n')).toContain('cleanup-timeout');
    // A broken native sink can outlive bounded cleanup. Its completion is still
    // observed, and does not launch any new read/write or unhandled rejection.
    finishWrite();
    finishCancel();
    await microtasks();
  });

  it('interrupts active and queued writes on cancellation', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    let finishWrite!: () => void;
    const gate = new Promise<void>(resolve => { finishWrite = resolve; });
    const f = fixture({ signal: controller.signal, write: () => gate });
    f.transport.start();
    const first = expect(f.transport.write([1])).rejects.toMatchObject({ name: 'AbortError' });
    const second = expect(f.transport.write([2])).rejects.toMatchObject({ name: 'AbortError' });
    await microtasks();
    controller.abort();
    await Promise.all([first, second]);
    finishWrite();
    await f.transport.close();
    expect(f.sent).toHaveLength(1);
    expect(f.readable.locked).toBe(false);
    expect(f.writable.locked).toBe(false);
  });

  it.each([
    ['frame count', Array(CHUNK_SERIAL_LIMITS.maxQueuedPackets + 1).fill(slip([1])).flat()],
    ['byte count', Array(CHUNK_SERIAL_LIMITS.maxQueuedBytes / 4096 + 1).fill(slip(Array(4096).fill(1))).flat()],
  ])('bounds queued packets by %s', async (_name, input) => {
    const f = fixture();
    f.transport.start();
    f.transport.setStrictMode();
    await f.enqueue(input as number[]);
    await expect(f.transport.readPacket(1000)).rejects.toThrow(/queue limit/);
    expect(f.transport.getSnapshot().queuedFrames).toBeLessThanOrEqual(CHUNK_SERIAL_LIMITS.maxQueuedPackets);
    expect(f.transport.getSnapshot().queuedBytes).toBeLessThanOrEqual(CHUNK_SERIAL_LIMITS.maxQueuedBytes);
  });

  it('returns independent metadata snapshots for queued packets and partial escapes', async () => {
    const f = fixture();
    f.transport.start();
    await f.enqueue([...slip([1, 2]), 0xc0, 3, 0xdb]);
    const snapshot = f.transport.getSnapshot();
    expect(snapshot).toEqual({ rxBytes: 7, rxChunks: 1, frames: 1, queuedBytes: 2, queuedFrames: 1, partialBytes: 1, inFrame: true, escaped: true });
    snapshot.queuedBytes = 999;
    expect(f.transport.getSnapshot().queuedBytes).toBe(2);
  });

  it('records bounded timestamp and visibility metadata before decoding, never packet contents', async () => {
    const visibility = vi.fn(() => 'hidden');
    const f = fixture({ visibility });
    f.transport.start();
    const secret = Array.from(new TextEncoder().encode('CONFIDENTIAL-PAYLOAD'));
    await f.enqueue(slip(secret));
    f.transport.discardBootInput('CONFIDENTIAL-REASON');
    visibility.mockReturnValue('CONFIDENTIAL-VISIBILITY');
    for (let i = 0; i < CHUNK_SERIAL_LIMITS.traceEntries + 4; i++) await f.enqueue([0x41]);
    const trace = f.transport.getTrace();
    expect(trace.length).toBe(CHUNK_SERIAL_LIMITS.traceEntries + 1);
    expect(trace[0]).toContain(`rxChunks=${CHUNK_SERIAL_LIMITS.traceEntries + 5}`);
    expect(trace[0]).toMatch(/traceDropped=[1-9]\d*/);
    expect(trace.join('\n')).not.toMatch(/CONFIDENTIAL|0xc0|0xdb/);
    expect(trace.filter(line => line.includes('chunk bytes=')).every(line => /wallMs=\d+ elapsedMs=\d+\.\d{3} visibility=unknown/.test(line))).toBe(true);
    trace.pop();
    expect(f.transport.getTrace()).toHaveLength(CHUNK_SERIAL_LIMITS.traceEntries + 1);
  });

  it('captures raw receipt metadata before the matching frame event, including visibility', async () => {
    const f = fixture({ visibility: () => 'visible' });
    f.transport.start();
    await f.enqueue(slip([7, 8]));
    const trace = f.transport.getTrace();
    const chunkIndex = trace.findIndex(line => line.includes('chunk bytes=4'));
    const frameIndex = trace.findIndex(line => line.includes('frame bytes=2'));
    expect(chunkIndex).toBeGreaterThan(0);
    expect(chunkIndex).toBeLessThan(frameIndex);
    expect(trace[chunkIndex]).toMatch(/wallMs=\d+ elapsedMs=\d+\.\d{3} visibility=visible chunk bytes=4/);
    const times = trace.slice(1).map(line => Number(/elapsedMs=(\d+\.\d+)/.exec(line)![1]));
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('treats lone opening delimiters as partial input for assertIdle', async () => {
    const f = fixture();
    f.transport.start();
    await f.enqueue([0xc0]);
    expect(() => f.transport.assertIdle()).toThrow(/partial frames/);
    await f.enqueue([0xc0]);
    expect(() => f.transport.assertIdle()).not.toThrow();
  });

  it('keeps local frame capture explicitly opt-in and report metadata payload-free', async () => {
    const f = fixture();
    f.transport.start();
    await f.enqueue(slip([...new TextEncoder().encode('PRIVATE-FLASH-DATA')]));
    await f.transport.readPacket(1000);
    expect(f.transport.getLastPacketCapture()).toBeUndefined();
    expect(f.transport.captureFirstFailureFrame()).toBeUndefined();
    expect(f.transport.getEvidence()).toEqual({ enabled: false, chunks: [], frames: [], loss: { traceEntries: 0, chunkEntries: 0, frameEntries: 0 } });
    expect(JSON.stringify(f.transport.getEvidence())).not.toContain('PRIVATE');
  });

  it('associates raw captures with each returned packet when browser chunks coalesce frames', async () => {
    const f = fixture({ captureFrames: true, visibility: () => 'visible' });
    f.transport.start();
    f.transport.setStrictMode();
    const payload = [1, 0xc0, 0xdb, 2];
    const encoded = slip(payload);
    await f.enqueue(encoded.slice(0, 3));
    await f.enqueue(encoded.slice(3, 5));
    await f.enqueue([...encoded.slice(5), ...slip([9, 8]), 0xc0, 6]);
    expect(await f.transport.readPacket(1000)).toEqual(payload);
    const first = f.transport.getLastPacketCapture()!;
    expect([...first.rawBytes]).toEqual(encoded);
    expect([...first.decodedBytes]).toEqual(payload);
    expect(first.chunkLengths).toEqual([3, 2, 3]);
    expect(first.metadata).toMatchObject({ sequence: 1, rawLength: 8, decodedLength: 4,
      complete: true, rawTruncated: false, escapedDelimiters: 1, escapedEscapes: 1, invalidEscapes: 0, chunkSpansDropped: 0 });
    // A following partial frame must not replace the protocol caller's bad packet.
    expect(f.transport.captureFirstFailureFrame()!.metadata.sequence).toBe(1);
    first.rawBytes.fill(99);
    first.decodedBytes.fill(99);
    first.metadata.rawLength = 999;
    first.chunkLengths[0] = 999;
    expect([...f.transport.getLastPacketCapture()!.rawBytes]).toEqual(encoded);
    expect(await f.transport.readPacket(1000)).toEqual([9, 8]);
    expect(f.transport.getLastPacketCapture()!.metadata.sequence).toBe(2);
    expect(f.transport.captureFirstFailureFrame()!.metadata.sequence).toBe(1);
    const evidence = f.transport.getEvidence();
    expect(evidence.chunks.map(chunk => chunk.length)).toEqual([3, 2, 9]);
    expect(evidence.chunks[0]).toMatchObject({ sequence: 1, gapMs: null, visibility: 'visible' });
    expect(evidence.chunks.slice(1).every(chunk => chunk.gapMs! >= 0)).toBe(true);
    expect(evidence.frames.map(frame => frame.decodedLength)).toEqual([4, 2]);
    expect(JSON.stringify(evidence)).not.toMatch(/rawBytes|decodedBytes|chunkLengths/);
    evidence.frames[0]!.decodedLength = 999;
    evidence.chunks[0]!.length = 999;
    expect(f.transport.getEvidence().frames[0]!.decodedLength).toBe(4);
    await f.transport.close();
    expect([...f.transport.captureFirstFailureFrame()!.rawBytes]).toEqual(encoded);
  });

  it('freezes the first terminal partial-frame failure and counts escape errors without exporting bytes', async () => {
    const f = fixture({ captureFrames: true });
    f.transport.start();
    f.transport.setStrictMode();
    await f.enqueue([...slip([7]), 0xc0, 1, 0xdb]);
    expect(await f.transport.readPacket(1000)).toEqual([7]);
    const rejected = expect(f.transport.readPacket(1000)).rejects.toThrow(/Invalid SLIP escape/);
    await f.enqueue([0x44]);
    await rejected;
    const failure = f.transport.captureFirstFailureFrame()!;
    expect([...failure.rawBytes]).toEqual([0xc0, 1, 0xdb, 0x44]);
    expect(failure.chunkLengths).toEqual([3, 1]);
    expect(failure.metadata).toMatchObject({ sequence: 2, rawLength: 4, decodedLength: 1, complete: false, invalidEscapes: 1 });
    const evidence = f.transport.getEvidence();
    expect(evidence.firstFailure).toMatchObject({ event: 'invalid-escape', snapshot: { partialBytes: 1, queuedFrames: 0 } });
    await f.transport.close();
    expect(f.transport.getEvidence().firstFailure).toEqual(evidence.firstFailure);
    expect(f.transport.captureFirstFailureFrame()!.metadata).toEqual(failure.metadata);
    expect(JSON.stringify(evidence)).not.toMatch(/rawBytes|decodedBytes/);
  });

  it('retains cancellation evidence before cleanup without allowing repeated start', async () => {
    const abort = new AbortController();
    const f = fixture({ captureFrames: true, signal: abort.signal });
    f.transport.start();
    f.transport.start();
    await f.enqueue([0xc0, 4, 0xdb]);
    abort.abort();
    await f.transport.close();
    expect(f.transport.captureFirstFailureFrame()!.metadata).toMatchObject({ rawLength: 3, decodedLength: 1, complete: false });
    expect(f.transport.getEvidence().firstFailure?.event).toBe('cancelled');
    expect(() => f.transport.start()).toThrow(/cancelled/);
    expect(f.readerAcquired).toHaveBeenCalledOnce();
  });

  it.each(['timeout', 'eof', 'cancel'] as const)('keeps a no-frame %s separate from the previous successful packet', async mode => {
    vi.useFakeTimers();
    const abort = new AbortController();
    const f = fixture({ captureFrames: true, signal: abort.signal });
    f.transport.start();
    f.transport.setStrictMode();
    await f.enqueue(slip([1, 2, 3]));
    expect(await f.transport.readPacket(100)).toEqual([1, 2, 3]);
    expect(f.transport.getLastPacketCapture()!.metadata.complete).toBe(true);
    const rejected = expect(f.transport.readPacket(100)).rejects.toThrow();
    if (mode === 'timeout') await vi.advanceTimersByTimeAsync(100);
    else if (mode === 'eof') f.controller.close();
    else abort.abort();
    await rejected;
    expect(f.transport.captureFirstFailureFrame()).toBeUndefined();
    await f.transport.close();
    expect(f.transport.captureFirstFailureFrame()).toBeUndefined();
    expect(f.transport.getEvidence().firstFailure?.snapshot).toMatchObject({ partialBytes: 0, inFrame: false });
  });

  it('timestamps actual serialized write dispatch and completion independently of queueing', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const events: string[] = [];
    const f = fixture({ write: async () => { events.push(`sink${f.sent.length}`); if (f.sent.length === 1) await gate; } });
    f.transport.start();
    const first = f.transport.write([1], { started: () => events.push('start1'), completed: () => events.push('complete1') });
    const second = f.transport.write([2], { started: () => events.push('start2'), completed: () => events.push('complete2') });
    expect(events).toEqual([]);
    await microtasks();
    expect(events).toEqual(['start1', 'sink1']);
    release();
    await Promise.all([first, second]);
    expect(events).toEqual(['start1', 'sink1', 'complete1', 'start2', 'sink2', 'complete2']);
  });

  it('never reports completion for a failed or timed-out write and ignores timing callback errors', async () => {
    const f = fixture({ write: () => { throw new Error('private error'); } });
    f.transport.start();
    const completed = vi.fn();
    await expect(f.transport.write([1], { started: () => { throw new Error('private callback'); }, completed }))
      .rejects.toThrow(/Serial write failed/);
    expect(completed).not.toHaveBeenCalled();
    expect(f.transport.getTrace().join('\n')).not.toContain('private');

    vi.useFakeTimers();
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const timed = fixture({ write: () => gate });
    timed.transport.start();
    const timedCompleted = vi.fn();
    const rejected = expect(timed.transport.write([1], { started: () => {}, completed: timedCompleted }))
      .rejects.toThrow(/write timed out/);
    await vi.advanceTimersByTimeAsync(CHUNK_SERIAL_LIMITS.writeTimeoutMs);
    await rejected;
    release();
    await microtasks();
    expect(timedCompleted).not.toHaveBeenCalled();
    await timed.transport.close();
  });

  it('bounds chunk spans and local raw bytes while reporting every lost evidence entry', async () => {
    const f = fixture({ captureFrames: true });
    f.transport.start();
    f.transport.setStrictMode();
    await f.enqueue([0xc0]);
    for (let i = 0; i < CHUNK_SERIAL_LIMITS.capturedFrameChunkSpans + 3; i++) await f.enqueue([1]);
    await f.enqueue([0xc0]);
    await f.transport.readPacket(1000);
    expect(f.transport.getLastPacketCapture()!.chunkLengths).toHaveLength(CHUNK_SERIAL_LIMITS.capturedFrameChunkSpans);
    expect(f.transport.getLastPacketCapture()!.metadata.chunkSpansDropped).toBe(5);
    const rejected = expect(f.transport.readPacket(1000)).rejects.toThrow(/4096-byte/);
    await f.enqueue(slip(Array(4097).fill(0xc0)));
    await rejected;
    const failed = f.transport.captureFirstFailureFrame()!;
    expect(failed.rawBytes).toHaveLength(CHUNK_SERIAL_LIMITS.capturedRawFrameBytes);
    expect(failed.metadata.rawLength).toBe(CHUNK_SERIAL_LIMITS.capturedRawFrameBytes + 1);
    expect(failed.metadata.rawTruncated).toBe(true);
    expect(failed.decodedBytes).toHaveLength(CHUNK_SERIAL_LIMITS.maxPacketBytes);
  });

  it('bounds structured metadata independently and preserves earliest frame evidence with explicit loss counts', async () => {
    const f = fixture({ captureFrames: true });
    f.transport.start();
    for (let i = 0; i < CHUNK_SERIAL_LIMITS.evidenceFrames + 3; i++) {
      await f.enqueue(slip([1]));
      await f.transport.readPacket(1000);
    }
    for (let i = 0; i < CHUNK_SERIAL_LIMITS.evidenceChunks; i++) await f.enqueue([0x41]);
    const evidence = f.transport.getEvidence();
    expect(evidence.frames).toHaveLength(CHUNK_SERIAL_LIMITS.evidenceFrames);
    expect(evidence.frames[0]!.sequence).toBe(1);
    expect(evidence.frames.at(-1)!.sequence).toBe(CHUNK_SERIAL_LIMITS.evidenceFrames);
    expect(evidence.chunks).toHaveLength(CHUNK_SERIAL_LIMITS.evidenceChunks);
    expect(evidence.loss.frameEntries).toBe(3);
    expect(evidence.loss.chunkEntries).toBe(CHUNK_SERIAL_LIMITS.evidenceFrames + 3);
    expect(evidence.loss.traceEntries).toBeGreaterThan(0);
  });
});

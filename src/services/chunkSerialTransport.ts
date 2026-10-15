/** Limits apply to local buffering only; this transport never logs packet content. */
export const CHUNK_SERIAL_LIMITS = {
  maxPacketBytes: 4096,
  maxQueuedPackets: 32,
  maxQueuedBytes: 64 * 1024,
  maxWriteBytes: 64 * 1024,
  maxQueuedWrites: 32,
  traceEntries: 4096,
  evidenceChunks: 2048,
  evidenceFrames: 1024,
  capturedRawFrameBytes: 8194,
  capturedFrameChunkSpans: 256,
  cleanupTimeoutMs: 1000,
  writeTimeoutMs: 5000,
} as const;

type PacketWaiter = {
  resolve: (packet: number[]) => void;
  reject: (error: Error) => void;
  timeoutMs: number;
  timer?: ReturnType<typeof setTimeout>;
};

export type ChunkSerialSnapshot = {
  rxBytes: number;
  rxChunks: number;
  frames: number;
  queuedBytes: number;
  queuedFrames: number;
  partialBytes: number;
  inFrame: boolean;
  escaped: boolean;
};

export type ChunkSerialFrameMetadata = {
  sequence: number;
  startedAtMs: number;
  endedAtMs: number;
  rawLength: number;
  decodedLength: number;
  complete: boolean;
  rawTruncated: boolean;
  chunkSpansDropped: number;
  escapedDelimiters: number;
  escapedEscapes: number;
  invalidEscapes: number;
};

/** Local memory only. Never include this type in a downloadable report. */
export type LocalDiagnosticFrameCapture = {
  metadata: ChunkSerialFrameMetadata;
  rawBytes: Uint8Array;
  decodedBytes: Uint8Array;
  chunkLengths: number[];
};

export type ChunkSerialEvidence = {
  enabled: boolean;
  chunks: Array<{ sequence: number; length: number; receivedAtMs: number; gapMs: number | null; visibility: string }>;
  frames: ChunkSerialFrameMetadata[];
  loss: { traceEntries: number; chunkEntries: number; frameEntries: number };
  firstFailure?: { event: string; elapsedMs: number; snapshot: ChunkSerialSnapshot };
};

type FrameCapture = {
  sequence: number;
  startedAtMs: number;
  rawLength: number;
  rawBytes: number[];
  chunkLengths: number[];
  lastChunk: number;
  chunkSpansDropped: number;
  escapedDelimiters: number;
  escapedEscapes: number;
  invalidEscapes: number;
};

type TransportOptions = { signal?: AbortSignal; visibility?: () => string; captureFrames?: boolean };
export type ChunkSerialWriteTiming = { started: () => void; completed: () => void };

/**
 * Owns exactly one Web Serial reader and writer. A single event-driven pump owns
 * every low-level read, including when there is no packet waiter. Strict packet
 * timeouts and framing errors are terminal and cancel the pump. close() releases
 * the writer after the caller has attempted its protocol abort.
 *
 * SLIP frames have explicit opening and closing delimiters, as emitted by the
 * ESP ROM/stub. Delimiter-only frames are ignored, including at packet boundaries.
 */
export class ChunkSerialTransport {
  private reader?: ReadableStreamDefaultReader<Uint8Array>;
  private readableStream?: ReadableStream<Uint8Array>;
  private writableStream?: WritableStream<Uint8Array>;
  private writer?: WritableStreamDefaultWriter<Uint8Array>;
  private pumpPromise?: Promise<void>;
  private closePromise?: Promise<void>;
  private started = false;
  private closing = false;
  private strict = false;
  private terminalError?: Error;
  private terminalSnapshot?: ChunkSerialSnapshot;
  private waiter?: PacketWaiter;
  private packets: number[][] = [];
  private packetCaptures: Array<LocalDiagnosticFrameCapture | undefined> = [];
  private currentFrameCapture?: FrameCapture;
  private lastPacketCapture?: LocalDiagnosticFrameCapture;
  private firstFailureFrame?: LocalDiagnosticFrameCapture;
  private readonly evidenceChunks: ChunkSerialEvidence['chunks'] = [];
  private readonly evidenceFrames: ChunkSerialFrameMetadata[] = [];
  private evidenceChunksDropped = 0;
  private evidenceFramesDropped = 0;
  private firstFailure?: ChunkSerialEvidence['firstFailure'];
  private captureSequence = 0;
  private chunkReceivedAtMs = 0;
  private previousChunkAtMs?: number;
  private queuedBytes = 0;
  private frame: number[] = [];
  private inFrame = false;
  private escaped = false;
  private bootResync = false;
  private writeTail: Promise<void> = Promise.resolve();
  private queuedWrites = 0;
  private activeWrites = 0;
  private abortAttempted = false;
  private cancelPromise?: Promise<unknown>;
  private interruptWrite?: (error: Error) => void;
  private readonly origin = performance.now();
  private readonly trace: string[] = [];
  private traceDropped = 0;
  private rxBytes = 0;
  private rxChunks = 0;
  private txBytes = 0;
  private txChunks = 0;
  private frames = 0;
  private emptyFrames = 0;
  private bootNoiseBytes = 0;
  private bootFramingErrors = 0;
  private discardedFrames = 0;
  private discardedBytes = 0;
  private readonly onAbort = () => {
    this.fail(new DOMException('Serial operation cancelled', 'AbortError'), 'cancelled');
    void this.close().catch(() => {});
  };

  constructor(private readonly port: SerialPort, private readonly options: TransportOptions = {}) {}

  /** Acquires both locks before starting any asynchronous work. */
  start(): void {
    if (this.terminalError || this.closing) throw this.terminalError ?? new Error('Serial transport closed');
    if (this.started) return;
    if (this.options.signal?.aborted) {
      this.onAbort();
      throw this.terminalError;
    }
    const readable = this.port.readable;
    const writable = this.port.writable;
    if (!readable || !writable) throw new Error('Serial port must have readable and writable streams');
    // Do not acquire a reader (or cancel anyone else's stream) if either lock is busy.
    if (readable.locked || writable.locked) throw new Error('Serial stream is already locked');
    const reader = readable.getReader();
    let writer: WritableStreamDefaultWriter<Uint8Array>;
    try {
      writer = writable.getWriter();
    } catch (error) {
      reader.releaseLock();
      throw error;
    }
    this.reader = reader;
    this.writer = writer;
    this.readableStream = readable;
    this.writableStream = writable;
    this.started = true;
    // closed can reject independently of read/write, including on releaseLock.
    void reader.closed.catch(() => {});
    void writer.closed.catch(() => {});
    this.record('started');
    this.options.signal?.addEventListener('abort', this.onAbort, { once: true });
    this.pumpPromise = this.pump(reader);
    if (this.options.signal?.aborted) this.onAbort();
  }

  readPacket(timeoutMs: number): Promise<number[]> {
    try {
      this.assertRunning();
      if (this.waiter) throw new Error('Concurrent packet readers are not allowed');
      if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 0x7fffffff) {
        throw new Error('Packet idle timeout must be a positive finite timer duration');
      }
    } catch (error) {
      return Promise.reject(error);
    }
    const packet = this.packets.shift();
    if (packet) {
      this.lastPacketCapture = this.packetCaptures.shift();
      this.queuedBytes -= packet.length;
      return Promise.resolve(packet);
    }
    return new Promise<number[]>((resolve, reject) => {
      this.waiter = { resolve, reject, timeoutMs };
      this.armIdleTimeout();
    });
  }

  /** Sends already-encoded bytes; encoding belongs to the protocol caller. */
  write(data: number[], timing?: ChunkSerialWriteTiming): Promise<void> {
    return this.queueWrite(data, false, timing);
  }

  /** One best-effort stub abort is allowed after a terminal receive failure. */
  abortRead(): Promise<void> {
    if (this.abortAttempted) return Promise.reject(new Error('Serial read abort already attempted'));
    this.abortAttempted = true;
    this.record('read-abort');
    return this.queueWrite([0xc0, 0x00, 0xc0], true);
  }

  private queueWrite(data: number[], allowTerminal: boolean, timing?: ChunkSerialWriteTiming): Promise<void> {
    const assertWritable = () => {
      if (!allowTerminal) this.assertRunning();
      else if (!this.started || this.closing || !this.writer) throw new Error('Serial transport is not writable');
    };
    try {
      assertWritable();
      if (this.queuedWrites >= CHUNK_SERIAL_LIMITS.maxQueuedWrites) throw new Error('Serial write queue limit exceeded');
      if (data.length > CHUNK_SERIAL_LIMITS.maxWriteBytes || data.some(byte => !Number.isInteger(byte) || byte < 0 || byte > 255)) {
        throw new Error('Invalid serial write length or byte value');
      }
    } catch (error) {
      return Promise.reject(error);
    }
    // Snapshot the caller's input before this write waits behind another write.
    const bytes = Uint8Array.from(data);
    this.queuedWrites++;
    const job = this.writeTail.then(async () => {
      assertWritable();
      try {
        await this.writeOnce(bytes, timing);
        this.txBytes += bytes.length;
        this.txChunks++;
        this.record(`write bytes=${bytes.length}`);
      } catch (error) {
        if (!this.closing) this.fail(new Error('Serial write failed'), 'write-error');
        throw this.terminalError ?? error;
      }
    });
    const result = job.finally(() => { this.queuedWrites--; });
    this.writeTail = result.catch(() => {});
    return result;
  }

  setStrictMode(): void {
    this.assertRunning();
    if (!this.strict) this.record('strict-mode');
    this.strict = true;
  }

  /** Explicit startup-only discard; never silently resynchronize an active read. */
  discardBootInput(reason: string): void {
    this.assertRunning();
    if (this.strict) throw new Error('Boot input cannot be discarded in strict mode');
    if (this.waiter) throw new Error('Boot input cannot be discarded with a pending packet reader');
    const count = this.packets.length;
    const bytes = this.queuedBytes + this.frame.length;
    this.discardedFrames += count;
    this.discardedBytes += bytes;
    // Do not retain arbitrary caller strings: even a reason could contain data.
    const category = ['startup', 'before-sync', 'after-reset', 'before-stub', 'after-stub', 'rom-sync', 'startup-flush', 'startup-drain'].includes(reason) ? reason : 'other';
    this.record(`boot-discard reason=${category} frames=${count} bytes=${bytes} partial=${Number(this.inFrame || this.escaped)} escape=${Number(this.escaped)}`);
    this.packets = [];
    this.packetCaptures = [];
    this.queuedBytes = 0;
    this.resetFrame();
    this.bootResync = false;
  }

  assertIdle(): void {
    this.assertRunning();
    if (this.packets.length || this.inFrame || this.escaped || this.bootResync) {
      throw new Error('Serial transport has unconsumed complete or partial frames');
    }
    if (this.waiter) throw new Error('Serial transport has a pending packet reader');
  }

  /** Cancels owned I/O and releases locks, but never closes the caller's port. */
  close(): Promise<void> {
    if (this.closePromise) return this.closePromise;
    this.closing = true;
    this.terminalSnapshot ??= this.liveSnapshot();
    this.terminalError ??= new Error('Serial transport closed');
    this.options.signal?.removeEventListener('abort', this.onAbort);
    this.rejectWaiter(this.terminalError);
    this.interruptWrite?.(this.terminalError);
    this.record('closing');
    // Defer cleanup so reentrant stream callbacks see the same close promise.
    this.closePromise = Promise.resolve().then(() => this.releaseOwnedIO());
    return this.closePromise;
  }

  /** Terminal snapshots survive close(), so cleanup cannot erase failure evidence. */
  getSnapshot(): ChunkSerialSnapshot {
    return { ...(this.terminalSnapshot ?? this.liveSnapshot()) };
  }

  private liveSnapshot(): ChunkSerialSnapshot {
    return {
      rxBytes: this.rxBytes, rxChunks: this.rxChunks, frames: this.frames,
      queuedBytes: this.queuedBytes, queuedFrames: this.packets.length,
      partialBytes: this.frame.length, inFrame: this.inFrame, escaped: this.escaped,
    };
  }

  getTrace(): string[] {
    return [
      `totals rxBytes=${this.rxBytes} rxChunks=${this.rxChunks} txBytes=${this.txBytes} txChunks=${this.txChunks} frames=${this.frames} emptyFrames=${this.emptyFrames} bootNoiseBytes=${this.bootNoiseBytes} bootFramingErrors=${this.bootFramingErrors} discardedFrames=${this.discardedFrames} discardedBytes=${this.discardedBytes} queuedFrames=${this.packets.length} queuedBytes=${this.queuedBytes} traceDropped=${this.traceDropped}`,
      ...this.trace,
    ];
  }

  /** Payload-free, bounded metadata. Browser chunks are not USB packet boundaries. */
  getEvidence(): ChunkSerialEvidence {
    return {
      enabled: this.options.captureFrames === true,
      chunks: this.evidenceChunks.map(chunk => ({ ...chunk })),
      frames: this.evidenceFrames.map(frame => ({ ...frame })),
      loss: { traceEntries: this.traceDropped, chunkEntries: this.evidenceChunksDropped, frameEntries: this.evidenceFramesDropped },
      ...(this.firstFailure ? { firstFailure: { ...this.firstFailure, snapshot: { ...this.firstFailure.snapshot } } } : {}),
    };
  }

  /** Returns a defensive local copy of the frame associated with readPacket(). */
  getLastPacketCapture(): LocalDiagnosticFrameCapture | undefined {
    return this.copyCapture(this.lastPacketCapture);
  }

  /** Freeze the first failure before cleanup; later failures cannot replace it. */
  captureFirstFailureFrame(): LocalDiagnosticFrameCapture | undefined {
    if (!this.options.captureFrames) return undefined;
    // A timeout/EOF between packets has no failed frame. Never relabel the
    // previous successfully returned packet as the one that did not arrive.
    if (this.terminalError) return this.copyCapture(this.firstFailureFrame);
    // A protocol caller is validating the packet just returned, even if a later
    // partial frame arrived in the same browser chunk. Terminal decoder failures
    // capture the active partial frame directly in fail() instead.
    this.firstFailureFrame ??= this.copyCapture(this.lastPacketCapture) ?? this.snapshotFrame(false);
    return this.copyCapture(this.firstFailureFrame);
  }

  private copyCapture(capture?: LocalDiagnosticFrameCapture): LocalDiagnosticFrameCapture | undefined {
    return capture ? {
      metadata: { ...capture.metadata }, rawBytes: capture.rawBytes.slice(),
      decodedBytes: capture.decodedBytes.slice(), chunkLengths: [...capture.chunkLengths],
    } : undefined;
  }

  private snapshotFrame(complete: boolean): LocalDiagnosticFrameCapture | undefined {
    const capture = this.currentFrameCapture;
    if (!capture) return undefined;
    return {
      metadata: {
        sequence: capture.sequence, startedAtMs: capture.startedAtMs, endedAtMs: this.elapsedMs(),
        rawLength: capture.rawLength, decodedLength: this.frame.length, complete,
        rawTruncated: capture.rawLength > capture.rawBytes.length,
        chunkSpansDropped: capture.chunkSpansDropped, escapedDelimiters: capture.escapedDelimiters,
        escapedEscapes: capture.escapedEscapes, invalidEscapes: capture.invalidEscapes,
      },
      rawBytes: Uint8Array.from(capture.rawBytes), decodedBytes: Uint8Array.from(this.frame),
      chunkLengths: [...capture.chunkLengths],
    };
  }

  private captureFrameByte(byte: number): void {
    const capture = this.currentFrameCapture;
    if (!capture) return;
    capture.rawLength++;
    if (capture.rawBytes.length < CHUNK_SERIAL_LIMITS.capturedRawFrameBytes) capture.rawBytes.push(byte);
    if (capture.lastChunk === this.rxChunks) {
      if (capture.chunkSpansDropped === 0) capture.chunkLengths[capture.chunkLengths.length - 1]!++;
    } else {
      capture.lastChunk = this.rxChunks;
      if (capture.chunkLengths.length < CHUNK_SERIAL_LIMITS.capturedFrameChunkSpans) capture.chunkLengths.push(1);
      else capture.chunkSpansDropped++;
    }
  }

  private elapsedMs(): number { return Math.max(0, performance.now() - this.origin); }

  private visibility(): string {
    try {
      const value = this.options.visibility?.() ?? (typeof document === 'undefined' ? 'unknown' : document.visibilityState);
      if (value === 'visible' || value === 'hidden' || value === 'prerender') return value;
    } catch { /* A diagnostic callback must not affect I/O. */ }
    return 'unknown';
  }

  private assertRunning(): void {
    if (this.terminalError) throw this.terminalError;
    if (!this.started || this.closing) throw new Error('Serial transport is not running');
  }

  private record(event: string): void {
    const entry = `wallMs=${Date.now()} elapsedMs=${this.elapsedMs().toFixed(3)} visibility=${this.visibility()} ${event}`;
    if (this.trace.length === CHUNK_SERIAL_LIMITS.traceEntries) {
      this.trace.shift();
      this.traceDropped++;
    }
    this.trace.push(entry);
  }

  private async pump(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<void> {
    try {
      while (!this.closing && !this.terminalError) {
        const { value, done } = await reader.read();
        if (this.closing || this.terminalError) break;
        if (done) {
          this.fail(new Error(this.inFrame || this.escaped ? 'Serial stream ended during a partial frame' : 'Serial stream ended'), 'read-eof');
          break;
        }
        const length = value?.length ?? 0;
        this.rxChunks++;
        this.rxBytes += length;
        this.chunkReceivedAtMs = this.elapsedMs();
        if (this.options.captureFrames) {
          if (this.evidenceChunks.length < CHUNK_SERIAL_LIMITS.evidenceChunks) {
            this.evidenceChunks.push({ sequence: this.rxChunks, length, receivedAtMs: this.chunkReceivedAtMs,
              gapMs: this.previousChunkAtMs === undefined ? null : this.chunkReceivedAtMs - this.previousChunkAtMs,
              visibility: this.visibility() });
          } else this.evidenceChunksDropped++;
        }
        this.previousChunkAtMs = this.chunkReceivedAtMs;
        // Capture receipt metadata before touching the decoder or delivering data.
        this.record(`chunk bytes=${length}`);
        if (!length || !value) continue;
        this.armIdleTimeout();
        const noiseBefore = this.bootNoiseBytes;
        for (const byte of value) {
          this.decodeByte(byte);
          if (this.closing || this.terminalError) break;
        }
        if (this.bootNoiseBytes !== noiseBefore) this.record(`boot-noise bytes=${this.bootNoiseBytes - noiseBefore}`);
        // Decode the whole chunk first: a malformed coalesced tail must not race a
        // successful packet result from earlier in that same incoming chunk.
        if (!this.closing && !this.terminalError) this.deliverPacket();
      }
    } catch {
      if (!this.closing) this.fail(new Error('Serial read failed'), 'read-error');
    }
  }

  private decodeByte(byte: number): void {
    if (this.inFrame && !this.bootResync) this.captureFrameByte(byte);
    if (this.bootResync) {
      if (byte === 0xc0) this.bootResync = false;
      else this.bootNoiseBytes++;
      return;
    }
    if (!this.inFrame) {
      if (byte === 0xc0) {
        this.inFrame = true;
        if (this.options.captureFrames) {
          this.currentFrameCapture = { sequence: ++this.captureSequence, startedAtMs: this.chunkReceivedAtMs,
            rawLength: 0, rawBytes: [], chunkLengths: [], lastChunk: -1, chunkSpansDropped: 0,
            escapedDelimiters: 0, escapedEscapes: 0, invalidEscapes: 0 };
          this.captureFrameByte(byte);
        }
      }
      else if (this.strict) this.fail(new Error('Invalid SLIP head outside a frame'), 'invalid-head');
      else this.bootNoiseBytes++;
      return;
    }
    if (this.escaped) {
      this.escaped = false;
      if (byte === 0xdc) { if (this.currentFrameCapture) this.currentFrameCapture.escapedDelimiters++; this.appendByte(0xc0); }
      else if (byte === 0xdd) { if (this.currentFrameCapture) this.currentFrameCapture.escapedEscapes++; this.appendByte(0xdb); }
      else { if (this.currentFrameCapture) this.currentFrameCapture.invalidEscapes++; this.framingError('Invalid SLIP escape', 'invalid-escape', byte !== 0xc0); }
      return;
    }
    if (byte === 0xc0) {
      if (this.frame.length) {
        if (this.packets.length >= CHUNK_SERIAL_LIMITS.maxQueuedPackets || this.queuedBytes + this.frame.length > CHUNK_SERIAL_LIMITS.maxQueuedBytes) {
          this.fail(new Error('Serial packet queue limit exceeded'), 'queue-overflow');
          return;
        }
        this.frames++;
        this.queuedBytes += this.frame.length;
        this.packets.push(this.frame);
        const capture = this.snapshotFrame(true);
        this.packetCaptures.push(capture);
        if (capture) {
          if (this.evidenceFrames.length < CHUNK_SERIAL_LIMITS.evidenceFrames) this.evidenceFrames.push({ ...capture.metadata });
          else this.evidenceFramesDropped++;
        }
        this.record(`frame bytes=${this.frame.length} queuedFrames=${this.packets.length}`);
      } else this.emptyFrames++;
      this.resetFrame();
    } else if (byte === 0xdb) this.escaped = true;
    else this.appendByte(byte);
  }

  private appendByte(byte: number): void {
    if (this.frame.length >= CHUNK_SERIAL_LIMITS.maxPacketBytes) {
      this.framingError('SLIP packet exceeds 4096-byte limit', 'packet-overflow', true);
      return;
    }
    this.frame.push(byte);
  }

  private framingError(message: string, event: string, resync: boolean): void {
    if (this.strict) this.fail(new Error(message), event);
    else {
      this.bootFramingErrors++;
      this.discardedBytes += this.frame.length;
      this.record(`boot-${event} discardedBytes=${this.frame.length}`);
      this.resetFrame();
      this.bootResync = resync;
    }
  }

  private resetFrame(): void {
    this.frame = [];
    this.inFrame = false;
    this.escaped = false;
    this.currentFrameCapture = undefined;
  }

  private deliverPacket(): void {
    if (!this.waiter || !this.packets.length) return;
    const waiter = this.waiter;
    this.waiter = undefined;
    clearTimeout(waiter.timer);
    const packet = this.packets.shift()!;
    this.lastPacketCapture = this.packetCaptures.shift();
    this.queuedBytes -= packet.length;
    waiter.resolve(packet);
  }

  private rejectWaiter(error: Error): void {
    const waiter = this.waiter;
    this.waiter = undefined;
    if (!waiter) return;
    clearTimeout(waiter.timer);
    waiter.reject(error);
  }

  private armIdleTimeout(): void {
    if (!this.waiter) return;
    clearTimeout(this.waiter.timer);
    this.waiter.timer = setTimeout(() => {
      const error = new Error('Timed out waiting for incoming serial bytes');
      if (this.strict) this.fail(error, 'idle-timeout');
      else {
        this.record('boot-idle-timeout');
        this.rejectWaiter(error);
      }
    }, this.waiter.timeoutMs);
  }

  private fail(error: Error, event: string): void {
    if (this.terminalError) return;
    this.terminalSnapshot = this.liveSnapshot();
    this.firstFailure ??= { event, elapsedMs: this.elapsedMs(), snapshot: { ...this.terminalSnapshot } };
    if (this.options.captureFrames) this.firstFailureFrame ??= this.snapshotFrame(false);
    this.terminalError = error;
    this.record(event);
    this.record(`terminal rxBytes=${this.rxBytes} rxChunks=${this.rxChunks} frames=${this.frames} queuedFrames=${this.packets.length} queuedBytes=${this.queuedBytes} partialBytes=${this.frame.length} inFrame=${Number(this.inFrame)} escaped=${Number(this.escaped)}`);
    this.rejectWaiter(error);
    this.cancelReader();
  }

  private writeOnce(bytes: Uint8Array, timing?: ChunkSerialWriteTiming): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.interruptWrite = undefined;
        if (error) reject(error);
        else resolve();
      };
      const timer = setTimeout(() => {
        const error = new Error('Serial write timed out');
        this.fail(error, 'write-timeout');
        finish(this.terminalError ?? error);
      }, CHUNK_SERIAL_LIMITS.writeTimeoutMs);
      this.interruptWrite = error => finish(error);
      this.activeWrites++;
      try {
        try { timing?.started(); } catch { /* Metadata must not affect I/O. */ }
        void this.writer!.write(bytes).then(
          () => {
            this.activeWrites--;
            if (!settled) { try { timing?.completed(); } catch { /* Metadata must not affect I/O. */ } }
            finish();
          },
          () => { this.activeWrites--; finish(new Error('Serial write failed')); },
        );
      } catch {
        this.activeWrites--;
        finish(new Error('Serial write failed'));
      }
    });
  }

  private cancelReader(): void {
    if (!this.reader || this.cancelPromise) return;
    try {
      this.cancelPromise = this.reader.cancel().catch(() => { this.record('reader-cancel-error'); });
    } catch {
      this.record('reader-cancel-error');
      this.cancelPromise = Promise.resolve();
    }
  }

  private async releaseOwnedIO(): Promise<void> {
    const reader = this.reader;
    const writer = this.writer;
    const pending: Promise<unknown>[] = [this.writeTail];
    this.cancelReader();
    if (this.cancelPromise) pending.push(this.cancelPromise);
    if (this.pumpPromise) pending.push(this.pumpPromise);
    if (writer && this.activeWrites > 0) {
      try { pending.push(writer.abort()); }
      catch { this.record('writer-abort-error'); }
    }
    await this.boundedCleanup(Promise.allSettled(pending));
    // Releasing a reader also rejects an outstanding read if a broken underlying
    // source did not settle it on cancellation. Never start a replacement reader.
    let releaseFailed = false;
    try { reader?.releaseLock(); }
    catch { releaseFailed = true; this.record('reader-release-error'); }
    try { writer?.releaseLock(); }
    catch { releaseFailed = true; this.record('writer-release-error'); }
    if (this.readableStream?.locked || this.writableStream?.locked) {
      releaseFailed = true;
      this.record('stream-still-locked');
    }
    if (this.pumpPromise) await this.boundedCleanup(this.pumpPromise);
    if (!releaseFailed) {
      this.reader = undefined;
      this.writer = undefined;
      this.readableStream = undefined;
      this.writableStream = undefined;
    }
    this.packets = [];
    this.packetCaptures = [];
    this.queuedBytes = 0;
    this.resetFrame();
    if (releaseFailed) {
      this.record('cleanup-incomplete');
      throw new Error('Serial reader or writer lock could not be released');
    }
    this.record('closed');
  }

  private async boundedCleanup(work: Promise<unknown>): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        work.catch(() => { this.record('cleanup-error'); }),
        new Promise<void>(resolve => {
          timer = setTimeout(() => { this.record('cleanup-timeout'); resolve(); }, CHUNK_SERIAL_LIMITS.cleanupTimeoutMs);
        }),
      ]);
    } finally { clearTimeout(timer); }
  }
}

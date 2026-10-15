import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { LocalDiagnosticFrameCapture } from '../src/services/chunkSerialTransport';
import { ChunkSerialTransport } from '../src/services/chunkSerialTransport';
import { analyzeDiagnosticFrame } from '../src/services/diagnosticFrameAnalysis';

const md5 = (bytes: Uint8Array) => createHash('md5').update(bytes).digest('hex');
const slip = (payload: Uint8Array) => Uint8Array.from([
  0xc0, ...Array.from(payload).flatMap(byte => byte === 0xc0 ? [0xdb, 0xdc] : byte === 0xdb ? [0xdb, 0xdd] : [byte]), 0xc0,
]);

function capture(
  decodedBytes: Uint8Array,
  rawBytes = slip(decodedBytes),
  overrides: Partial<LocalDiagnosticFrameCapture['metadata']> = {},
): LocalDiagnosticFrameCapture {
  return {
    rawBytes, decodedBytes, chunkLengths: [rawBytes.length],
    metadata: {
      sequence: 3, startedAtMs: 3, endedAtMs: 21.3, rawLength: rawBytes.length,
      decodedLength: decodedBytes.length, complete: true, rawTruncated: false,
      chunkSpansDropped: 0, escapedDelimiters: 0, escapedEscapes: 0, invalidEscapes: 0,
      ...overrides,
    },
  };
}

describe('payload-free offline diagnostic frame analysis', () => {
  it('independently decodes escapes across actual and synthetic fragmentation boundaries', () => {
    const payload = Uint8Array.from([0xc0, 0xdb, 7, 0xc0, 1, 2, 0xdb]);
    const input = capture(payload);
    // Escape markers and substitutions are intentionally in different browser chunks.
    input.chunkLengths = [2, 1, 1, 1, input.rawBytes.length - 5];
    const result = analyzeDiagnosticFrame(input);
    expect(result.capture.actualChunkLengthsAvailable).toBe(true);
    expect(result.capture.capturedRawMd5).toBe(md5(input.rawBytes));
    expect(result.referenceComparison).toEqual({ status: 'unavailable', reason: 'no-exact-checksum-verified-reference' });
    expect(result.replay).toHaveLength(7);
    for (const replay of result.replay) {
      expect(replay).toMatchObject({
        status: 'replayed', complete: true, decodedLength: payload.length,
        decodedMd5: md5(payload), escapedDelimiters: 2, escapedEscapes: 2,
        matchesCapturedDecoded: true, matchesSingleReplay: true, errors: [], trailingRawBytes: 0,
      });
    }
  });

  it('agrees with production decoding for every byte value delivered in fragmented browser chunks', async () => {
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const readable = new ReadableStream<Uint8Array>({ start(c) { controller = c; } });
    const writable = new WritableStream<Uint8Array>({ write() {} });
    const transport = new ChunkSerialTransport({ readable, writable } as SerialPort, { captureFrames: true });
    const payload = Uint8Array.from({ length: 256 }, (_, i) => i);
    const encoded = slip(payload);
    try {
      transport.start();
      transport.setStrictMode();
      const packet = transport.readPacket(1000);
      for (let offset = 0; offset < encoded.length; offset += 7) {
        controller.enqueue(encoded.slice(offset, offset + 7));
      }
      expect(await packet).toEqual(Array.from(payload));
      const actualCapture = transport.getLastPacketCapture()!;
      expect(actualCapture.metadata).toMatchObject({ escapedDelimiters: 1, escapedEscapes: 1, rawTruncated: false });
      const result = analyzeDiagnosticFrame(actualCapture);
      expect(result.capture.actualChunkLengthsAvailable).toBe(true);
      expect(result.replay.every(replay => replay.status === 'replayed' && replay.complete &&
        replay.matchesCapturedDecoded && replay.matchesSingleReplay && replay.errors.length === 0)).toBe(true);
    } finally {
      await transport.close();
    }
  });

  it('reports malformed escapes without including the offending byte or joining later frames', () => {
    const input = capture(Uint8Array.of(11), Uint8Array.of(0xc0, 11, 0xdb, 0x42, 0xc0, 0xc0, 99, 0xc0), {
      complete: false, invalidEscapes: 1,
    });
    const result = analyzeDiagnosticFrame(input);
    for (const replay of result.replay) {
      expect(replay).toMatchObject({
        status: 'replayed', complete: false, decodedLength: 1, trailingRawBytes: 4,
        errors: [{ kind: 'invalid-escape', rawOffset: 3 }], matchesSingleReplay: true,
      });
    }
    expect(result.replay[1]).not.toHaveProperty('bytes');
  });

  it('never concatenates two complete frames', () => {
    const input = capture(Uint8Array.of(1), Uint8Array.of(0xc0, 1, 0xc0, 0xc0, 2, 0xc0));
    const result = analyzeDiagnosticFrame(input);
    expect(result.replay[1]).toMatchObject({ decodedLength: 1, trailingRawBytes: 3 });
  });

  it('marks prefix replays and unavailable chunk splits when capture evidence was truncated', () => {
    const input = capture(Uint8Array.of(1), Uint8Array.of(0xc0, 1, 0xdb), {
      rawLength: 200, decodedLength: 100, rawTruncated: true, complete: false, chunkSpansDropped: 17,
    });
    const result = analyzeDiagnosticFrame(input);
    expect(result.replayScope).toBe('captured-prefix-only');
    expect(result.capture).toMatchObject({ rawCaptureComplete: false, decodedCaptureComplete: false, chunkSpansDropped: 17 });
    expect(result.replay[0]).toMatchObject({ status: 'unavailable' });
    expect(result.replay[1]).toMatchObject({ errors: [{ kind: 'dangling-escape', rawOffset: 3 }] });
  });

  it('bounds local analysis and rejects incomplete reference comparisons', () => {
    const payload = new Uint8Array(50000);
    const input = capture(payload, new Uint8Array(100000));
    const reference = { bytes: Uint8Array.of(0), address: 0x810800, verified: true as const, md5: md5(Uint8Array.of(0)) };
    const result = analyzeDiagnosticFrame(input, reference, { address: 0x810800, expectedLength: 1 });
    expect(result.capture.capturedRawBytes).toBe(8194);
    expect(result.capture.capturedDecodedBytes).toBe(4096);
    expect(result.referenceComparison).toEqual({ status: 'rejected', reason: 'incomplete-capture' });
    expect(JSON.stringify(result).length).toBeLessThan(10000);
  });

  it('reports a length deficit and comparisons without claiming a contiguous deletion', () => {
    const referenceBytes = Uint8Array.from({ length: 1024 }, (_, i) => i % 251);
    const observed = new Uint8Array(985);
    observed.set(referenceBytes.subarray(0, 420));
    observed.set(referenceBytes.subarray(459), 420);
    const reference = { bytes: referenceBytes, md5: md5(referenceBytes), address: 0x810800, verified: true as const };
    const result = analyzeDiagnosticFrame(capture(observed), reference, { address: 0x810800, expectedLength: 1024 });
    expect(result.referenceComparison).toMatchObject({
      status: 'compared', lengthDeficit: 39, commonPrefixLength: 420, commonSuffixLength: 565,
      identical: false, referenceMd5: md5(referenceBytes), observedMd5: md5(observed),
      interpretation: 'Length differences do not establish the location or cause of missing bytes.',
    });
    expect(result.referenceComparison).not.toHaveProperty('deletion');
  });

  it('bounds difference ranges while preserving the number omitted', () => {
    const referenceBytes = new Uint8Array(1024);
    const observed = Uint8Array.from({ length: 1024 }, (_, i) => i % 2);
    const result = analyzeDiagnosticFrame(capture(observed), {
      bytes: referenceBytes, md5: md5(referenceBytes), address: 0x8000, verified: true,
    }, { address: 0x8000, expectedLength: 1024 });
    expect(result.referenceComparison).toMatchObject({
      sameOffsetDifferenceCount: 512, differenceRangesDropped: 480,
    });
    expect(result.referenceComparison && 'sameOffsetDifferenceRanges' in result.referenceComparison &&
      result.referenceComparison.sameOffsetDifferenceRanges).toHaveLength(32);
  });

  it('requires the exact checksum-verified reference range and validates its digest', () => {
    const payload = Uint8Array.of(1, 2, 3);
    const input = capture(payload);
    const reference = { bytes: payload, md5: md5(payload), address: 0x810800, verified: true as const };
    expect(analyzeDiagnosticFrame(input, reference).referenceComparison).toMatchObject({
      status: 'rejected', reason: 'missing-or-invalid-exact-range-context',
    });
    expect(analyzeDiagnosticFrame(input, reference, { address: 0x8000, expectedLength: 3 }).referenceComparison)
      .toMatchObject({ status: 'rejected', reason: 'reference-range-mismatch' });
    expect(analyzeDiagnosticFrame(input, reference, { address: 0x810800, expectedLength: 2 }).referenceComparison)
      .toMatchObject({ status: 'rejected', reason: 'reference-range-mismatch' });
    expect(analyzeDiagnosticFrame(input, { ...reference, md5: '0'.repeat(32) }, {
      address: 0x810800, expectedLength: 3,
    }).referenceComparison).toMatchObject({ status: 'rejected', reason: 'reference-checksum-mismatch' });
    expect(analyzeDiagnosticFrame(input, { ...reference, verified: false } as unknown as typeof reference, {
      address: 0x810800, expectedLength: 3,
    }).referenceComparison).toMatchObject({ status: 'rejected', reason: 'reference-not-checksum-verified' });
  });

  it('exports JSON-safe hashes and offsets without payload arrays, text, or byte views', () => {
    const secret = 'do-not-export-device-payload';
    const payload = new TextEncoder().encode(secret);
    const result = analyzeDiagnosticFrame(capture(payload), {
      bytes: payload, md5: md5(payload), address: 0x810800, verified: true,
    }, { address: 0x810800, expectedLength: payload.length });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain(Array.from(payload).join(','));
    expect(JSON.parse(serialized)).toEqual(result);
    expect(result.referenceComparison).toMatchObject({ status: 'compared', identical: true, commonPrefixLength: payload.length });
    const visit = (value: unknown) => {
      expect(value).not.toBeInstanceOf(Uint8Array);
      if (value && typeof value === 'object') Object.values(value).forEach(visit);
    };
    visit(result);
  });
});

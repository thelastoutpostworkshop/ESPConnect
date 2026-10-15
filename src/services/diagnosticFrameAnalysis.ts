import type { LocalDiagnosticFrameCapture } from './chunkSerialTransport';
import { diagnosticMd5 } from './diagnosticMd5';

// Keep analysis bounded even if a caller supplies something other than a transport capture.
const MAX_RAW_BYTES = 8194;
const MAX_DECODED_BYTES = 4096;
const MAX_CHUNK_SPANS = 256;
const MAX_DIFFERENCE_RANGES = 32;

export type DiagnosticFrameReference = {
  bytes: Uint8Array;
  md5: string;
  address: number;
  verified: true;
};

type DecoderError = {
  kind: 'missing-open-delimiter' | 'missing-close-delimiter' | 'dangling-escape' |
    'invalid-escape' | 'unexpected-leading-byte';
  rawOffset: number;
};

type DecodedFrame = {
  bytes: Uint8Array;
  complete: boolean;
  consumedRawBytes: number;
  trailingRawBytes: number;
  escapedDelimiters: number;
  escapedEscapes: number;
  errors: DecoderError[];
};

function md5Hex(bytes: Uint8Array): string {
  return Array.from(diagnosticMd5(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((byte, i) => byte === b[i]);
}

/** Independent, strict decoder. It stops at the first frame or error; it never joins frames. */
function decode(raw: Uint8Array, chunkLengths: number[]): DecodedFrame {
  const bytes: number[] = [];
  const errors: DecoderError[] = [];
  let opened = false;
  let escaped = false;
  let complete = false;
  let stopped = false;
  let offset = 0;
  let escapedDelimiters = 0;
  let escapedEscapes = 0;
  for (const length of chunkLengths) {
    const end = Math.min(offset + length, raw.length);
    while (offset < end && !stopped) {
      const rawOffset = offset++;
      const byte = raw[rawOffset]!;
      if (!opened) {
        if (byte === 0xc0) opened = true;
        else {
          errors.push({ kind: 'unexpected-leading-byte', rawOffset });
          stopped = true;
        }
      } else if (escaped) {
        escaped = false;
        if (byte === 0xdc) { bytes.push(0xc0); escapedDelimiters++; }
        else if (byte === 0xdd) { bytes.push(0xdb); escapedEscapes++; }
        else {
          errors.push({ kind: 'invalid-escape', rawOffset });
          stopped = true;
        }
      } else if (byte === 0xc0) {
        complete = true;
        stopped = true;
      } else if (byte === 0xdb) escaped = true;
      else bytes.push(byte);
    }
    if (stopped) break;
  }
  if (!stopped) {
    errors.push({
      kind: !opened ? 'missing-open-delimiter' : escaped ? 'dangling-escape' : 'missing-close-delimiter',
      rawOffset: raw.length,
    });
  }
  return {
    bytes: Uint8Array.from(bytes), complete, consumedRawBytes: offset,
    trailingRawBytes: raw.length - offset, escapedDelimiters, escapedEscapes, errors,
  };
}

function splitLengths(length: number, sizes: number[]): number[] {
  const result: number[] = [];
  let remaining = length;
  while (remaining > 0) {
    const size = Math.min(sizes[result.length % sizes.length]!, remaining);
    result.push(size);
    remaining -= size;
  }
  return result;
}

/** Returns only JSON-safe metadata. Raw input and decoded payload remain in local memory. */
export function analyzeDiagnosticFrame(
  capture: LocalDiagnosticFrameCapture,
  reference?: DiagnosticFrameReference,
  context?: { address: number; expectedLength: number },
) {
  const raw = capture.rawBytes.subarray(0, MAX_RAW_BYTES);
  const observed = capture.decodedBytes.subarray(0, MAX_DECODED_BYTES);
  const metadata = capture.metadata;
  const rawCaptureComplete = !metadata.rawTruncated && raw.length === capture.rawBytes.length &&
    raw.length === metadata.rawLength;
  const decodedCaptureComplete = observed.length === capture.decodedBytes.length &&
    observed.length === metadata.decodedLength;
  const actualChunkLengthsAvailable = rawCaptureComplete && metadata.chunkSpansDropped === 0 &&
    capture.chunkLengths.length <= MAX_CHUNK_SPANS &&
    capture.chunkLengths.every(length => Number.isInteger(length) && length > 0 && length <= MAX_RAW_BYTES) &&
    capture.chunkLengths.reduce((sum, length) => sum + length, 0) === raw.length;
  const single = decode(raw, [raw.length]);
  const plans: { split: string; lengths?: number[] }[] = [
    { split: 'actual-chunks', lengths: actualChunkLengthsAvailable ? capture.chunkLengths : undefined },
    { split: 'single', lengths: [raw.length] },
    { split: 'every-1-byte', lengths: splitLengths(raw.length, [1]) },
    { split: 'every-2-bytes', lengths: splitLengths(raw.length, [2]) },
    { split: 'every-7-bytes', lengths: splitLengths(raw.length, [7]) },
    { split: 'every-64-bytes', lengths: splitLengths(raw.length, [64]) },
    { split: 'alternating-1-7-64', lengths: splitLengths(raw.length, [1, 7, 64]) },
  ];
  const replay = plans.map(plan => {
    if (!plan.lengths) {
      return { split: plan.split, status: 'unavailable' as const, reason: 'incomplete-chunk-spans-or-capture' };
    }
    const result = decode(raw, plan.lengths);
    return {
      split: plan.split, status: 'replayed' as const, chunks: plan.lengths.length,
      complete: result.complete, consumedRawBytes: result.consumedRawBytes,
      trailingRawBytes: result.trailingRawBytes, decodedLength: result.bytes.length,
      decodedMd5: md5Hex(result.bytes), escapedDelimiters: result.escapedDelimiters,
      escapedEscapes: result.escapedEscapes, errors: result.errors,
      matchesCapturedDecoded: decodedCaptureComplete && equalBytes(result.bytes, observed),
      matchesSingleReplay: equalBytes(result.bytes, single.bytes) && result.complete === single.complete &&
        JSON.stringify(result.errors) === JSON.stringify(single.errors),
    };
  });

  const comparison = reference ? compareReference(reference, context, observed,
    rawCaptureComplete && decodedCaptureComplete && metadata.complete) : {
    status: 'unavailable' as const, reason: 'no-exact-checksum-verified-reference',
  };
  return {
    capture: {
      sequence: metadata.sequence, rawLength: metadata.rawLength, decodedLength: metadata.decodedLength,
      complete: metadata.complete, rawTruncated: metadata.rawTruncated,
      capturedRawBytes: raw.length, capturedDecodedBytes: observed.length,
      rawCaptureComplete, decodedCaptureComplete, chunkSpansDropped: metadata.chunkSpansDropped,
      actualChunkLengthsAvailable, capturedRawMd5: md5Hex(raw), capturedDecodedMd5: md5Hex(observed),
    },
    replayScope: rawCaptureComplete ? 'entire-captured-frame' as const : 'captured-prefix-only' as const,
    replay,
    referenceComparison: comparison,
  };
}

function compareReference(
  reference: DiagnosticFrameReference,
  context: { address: number; expectedLength: number } | undefined,
  observed: Uint8Array,
  completeCapture: boolean,
) {
  const reject = (reason: string) => ({ status: 'rejected' as const, reason });
  if (reference.verified !== true) return reject('reference-not-checksum-verified');
  if (!context || !Number.isInteger(context.address) || context.address < 0 || context.address > 0xffffffff ||
    !Number.isInteger(context.expectedLength) || context.expectedLength <= 0 || context.expectedLength > MAX_DECODED_BYTES) {
    return reject('missing-or-invalid-exact-range-context');
  }
  if (reference.address !== context.address || reference.bytes.length !== context.expectedLength) {
    return reject('reference-range-mismatch');
  }
  if (!/^[a-f\d]{32}$/i.test(reference.md5) || md5Hex(reference.bytes) !== reference.md5.toLowerCase()) {
    return reject('reference-checksum-mismatch');
  }
  if (!completeCapture) return reject('incomplete-capture');
  const sharedLength = Math.min(observed.length, reference.bytes.length);
  let commonPrefixLength = 0;
  while (commonPrefixLength < sharedLength && observed[commonPrefixLength] === reference.bytes[commonPrefixLength]) {
    commonPrefixLength++;
  }
  let commonSuffixLength = 0;
  while (commonSuffixLength < sharedLength - commonPrefixLength &&
    observed[observed.length - 1 - commonSuffixLength] === reference.bytes[reference.bytes.length - 1 - commonSuffixLength]) {
    commonSuffixLength++;
  }
  const sameOffsetDifferenceRanges: { start: number; endExclusive: number }[] = [];
  let sameOffsetDifferenceCount = 0;
  let totalDifferenceRanges = 0;
  let start: number | undefined;
  for (let i = 0; i <= sharedLength; i++) {
    if (i < sharedLength && observed[i] !== reference.bytes[i]) {
      sameOffsetDifferenceCount++;
      if (start === undefined) start = i;
    } else if (start !== undefined) {
      totalDifferenceRanges++;
      if (sameOffsetDifferenceRanges.length < MAX_DIFFERENCE_RANGES) {
        sameOffsetDifferenceRanges.push({ start, endExclusive: i });
      }
      start = undefined;
    }
  }
  return {
    status: 'compared' as const, address: context.address, referenceLength: reference.bytes.length,
    referenceMd5: md5Hex(reference.bytes), observedLength: observed.length, observedMd5: md5Hex(observed),
    identical: equalBytes(observed, reference.bytes),
    lengthDeficit: Math.max(0, reference.bytes.length - observed.length),
    lengthSurplus: Math.max(0, observed.length - reference.bytes.length),
    commonPrefixLength, commonSuffixLength, sameOffsetComparedLength: sharedLength,
    sameOffsetDifferenceCount, sameOffsetDifferenceRanges,
    differenceRangesDropped: totalDifferenceRanges - sameOffsetDifferenceRanges.length,
    interpretation: 'Length differences do not establish the location or cause of missing bytes.',
  };
}

export type DiagnosticFrameAnalysis = ReturnType<typeof analyzeDiagnosticFrame>;

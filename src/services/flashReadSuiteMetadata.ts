// Explicit projections keep local byte captures and unexpected checkpoint fields
// out of persistence and downloads, including inside otherwise valid evidence.
type Rule = 'string' | 'number' | 'boolean' | { nullable: Rule } | { array: Rule; limit: number } | { [key: string]: Rule };
const array = (rule: Rule, limit: number): Rule => ({ array: rule, limit });
const numbers = (keys: string[]) => Object.fromEntries(keys.map(key => [key, 'number' as const]));
const strings = (keys: string[]) => Object.fromEntries(keys.map(key => [key, 'string' as const]));
const booleans = (keys: string[]) => Object.fromEntries(keys.map(key => [key, 'boolean' as const]));
const config = numbers(['address', 'size', 'packetSize', 'ackDelayMs']);
const snapshot = { ...numbers(['rxBytes', 'rxChunks', 'frames', 'queuedBytes', 'queuedFrames', 'partialBytes']), ...booleans(['inFrame', 'escaped']) };
const frame = { ...numbers(['sequence', 'startedAtMs', 'endedAtMs', 'rawLength', 'decodedLength', 'chunkSpansDropped', 'escapedDelimiters', 'escapedEscapes', 'invalidEscapes']), ...booleans(['complete', 'rawTruncated']) };
const decoderErrors = array({ kind: 'string', rawOffset: 'number' }, 32);
const analysis: Rule = {
  context: { trialStartedAt: 'string', ...numbers(['address', 'expectedLength']) },
  capture: { ...numbers(['sequence', 'rawLength', 'decodedLength', 'capturedRawBytes', 'capturedDecodedBytes', 'chunkSpansDropped']),
    ...booleans(['complete', 'rawTruncated', 'rawCaptureComplete', 'decodedCaptureComplete', 'actualChunkLengthsAvailable']),
    ...strings(['capturedRawMd5', 'capturedDecodedMd5']) },
  replayScope: 'string',
  replay: array({ ...strings(['split', 'status', 'reason', 'decodedMd5']),
    ...numbers(['chunks', 'consumedRawBytes', 'trailingRawBytes', 'decodedLength', 'escapedDelimiters', 'escapedEscapes']),
    ...booleans(['complete', 'matchesCapturedDecoded', 'matchesSingleReplay']), errors: decoderErrors }, 7),
  referenceComparison: { ...strings(['status', 'reason', 'referenceMd5', 'observedMd5', 'interpretation']),
    ...numbers(['address', 'referenceLength', 'observedLength', 'lengthDeficit', 'lengthSurplus', 'commonPrefixLength', 'commonSuffixLength',
      'sameOffsetComparedLength', 'sameOffsetDifferenceCount', 'differenceRangesDropped']), identical: 'boolean',
    sameOffsetDifferenceRanges: array(numbers(['start', 'endExclusive']), 32) },
};
const evidence: Rule = {
  ...strings(['status', 'startedAt', 'stage', 'failure']), ...numbers(['elapsedMs', 'flashSizeBytes']), romSyncVerified: 'boolean', config,
  cleanup: { closed: 'boolean', errors: array('string', 16) },
  settings: { ...numbers(['baudRate', 'bufferSize', 'maxInFlight', 'idleTimeoutMs']), ...strings(['stubVersion', 'stubSourceCommit', 'libraryVersion']) },
  read: { ...strings(['stage', 'md5', 'failure']), ...numbers(['received', 'packets', 'elapsedMs']),
    failureSnapshot: snapshot,
    invalidPacket: numbers(['address', 'expectedLength', 'actualLength', 'packet']),
    acknowledgments: array(numbers(['value', 'packetReceivedAtMs', 'writeStartedAtMs', 'writeCompletedAtMs', 'actualDelayMs']), 256) },
  transport: { enabled: 'boolean',
    chunks: array({ ...numbers(['sequence', 'length', 'receivedAtMs']), gapMs: { nullable: 'number' }, visibility: 'string' }, 2048),
    frames: array(frame, 1024), loss: numbers(['traceEntries', 'chunkEntries', 'frameEntries']),
    firstFailure: { event: 'string', elapsedMs: 'number', snapshot } },
};
const suite: Rule = {
  ...strings(['schema', 'startedAt', 'updatedAt', 'phase', 'firstFailureId']),
  ...numbers(['recoveryCount', 'droppedEvents']),
  environment: { ...strings(['appVersion', 'userAgent', 'platform', 'initialVisibility']), ...numbers(['usbVendorId', 'usbProductId']) },
  events: array({ at: 'string', message: 'string' }, 128),
  trials: array({ ...strings(['id', 'comparison', 'status', 'startedAt', 'endedAt', 'skipReason']), repeat: 'number', config, evidence }, 15),
  localAnalysis: analysis,
};

function project(value: unknown, rule: Rule, depth = 0): unknown {
  if (depth > 12) return undefined;
  if (rule === 'string') return typeof value === 'string' ? value.slice(0, 2048) : undefined;
  if (rule === 'number') return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  if (rule === 'boolean') return typeof value === 'boolean' ? value : undefined;
  if ('nullable' in rule) return value === null ? null : project(value, rule.nullable as Rule, depth + 1);
  if ('array' in rule && 'limit' in rule && typeof rule.limit === 'number') {
    if (!Array.isArray(value)) return undefined;
    return value.slice(0, rule.limit).map(item => project(item, rule.array as Rule, depth + 1)).filter(item => item !== undefined);
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value) || ArrayBuffer.isView(value)) return undefined;
  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [key, childRule] of Object.entries(rule)) {
    if (!Object.hasOwn(source, key)) continue;
    const child = project(source[key], childRule as Rule, depth + 1);
    if (child !== undefined) result[key] = child;
  }
  return result;
}

export function projectSuiteMetadata(value: unknown): unknown { return project(value, suite); }
export function projectTrialMetadata(value: unknown): unknown { return project(value, evidence); }
export function projectLocalAnalysis(value: unknown): unknown { return project(value, analysis); }

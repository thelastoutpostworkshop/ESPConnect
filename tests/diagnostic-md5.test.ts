import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { diagnosticMd5 } from '../src/services/diagnosticMd5';

describe('diagnostic MD5 transfer verification', () => {
  it.each(['', 'a', 'abc', 'message digest', 'abcdefghijklmnopqrstuvwxyz', 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'])('matches RFC-compatible reference for %j', input => {
    const bytes = new TextEncoder().encode(input);
    expect(Buffer.from(diagnosticMd5(bytes))).toEqual(createHash('md5').update(bytes).digest());
  });
  it.each([1, 55, 56, 57, 63, 64, 65, 1024, 65536])('handles binary padding boundary %i without changing input', length => {
    const bytes = Uint8Array.from({ length }, (_, i) => (i * 47) & 255);
    const original = bytes.slice();
    expect(Buffer.from(diagnosticMd5(bytes))).toEqual(createHash('md5').update(bytes).digest());
    expect(bytes).toEqual(original);
  });
  it('respects a typed-array view offset and length', () => {
    const view = Uint8Array.from({ length: 80 }, (_, i) => i).subarray(7, 72);
    expect(Buffer.from(diagnosticMd5(view))).toEqual(createHash('md5').update(view).digest());
  });
});

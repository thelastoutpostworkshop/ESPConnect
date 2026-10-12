// RFC 1321 MD5 for comparing the stub's transfer checksum, not authentication.
// Web Crypto does not expose MD5. Input is bounded to one diagnostic read (64 KB).
const shifts = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
const constants = Uint32Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000));

export function diagnosticMd5(input: Uint8Array): Uint8Array {
  const padded = new Uint8Array(Math.ceil((input.length + 9) / 64) * 64);
  padded.set(input);
  padded[input.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, (input.length * 8) >>> 0, true);
  view.setUint32(padded.length - 4, Math.floor(input.length / 0x20000000), true);
  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;
  for (let offset = 0; offset < padded.length; offset += 64) {
    let a = a0, b = b0, c = c0, d = d0;
    for (let i = 0; i < 64; i++) {
      let f: number, g: number;
      if (i < 16) { f = (b & c) | (~b & d); g = i; }
      else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) % 16; }
      else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) % 16; }
      else { f = c ^ (b | ~d); g = (7 * i) % 16; }
      const sum = (a + f + constants[i]! + view.getUint32(offset + 4 * g, true)) >>> 0;
      const shift = shifts[Math.floor(i / 16) * 4 + i % 4]!;
      const next = (b + ((sum << shift) | (sum >>> (32 - shift)))) >>> 0;
      a = d; d = c; c = b; b = next;
    }
    a0 = (a0 + a) >>> 0; b0 = (b0 + b) >>> 0;
    c0 = (c0 + c) >>> 0; d0 = (d0 + d) >>> 0;
  }
  const result = new Uint8Array(16);
  const output = new DataView(result.buffer);
  [a0, b0, c0, d0].forEach((value, i) => output.setUint32(i * 4, value, true));
  return result;
}

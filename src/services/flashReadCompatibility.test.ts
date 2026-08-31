import { describe, expect, it, vi } from 'vitest';
import {
  createV7CompatibleFlashReader,
  readFlashWithV7Compatibility,
  V7_FLASH_READ_OPTIONS,
  type FlashReader,
} from './flashReadCompatibility';

describe('flash read compatibility', () => {
  it('uses the stable v7 transfer parameters', async () => {
    const readFlash = vi.fn(async () => new Uint8Array([1, 2, 3]));
    const loader = { readFlash } as FlashReader;
    const onPacketReceived = vi.fn();

    await readFlashWithV7Compatibility(loader, 0x8000, 32, onPacketReceived);

    expect(readFlash).toHaveBeenCalledWith(
      0x8000,
      32,
      onPacketReceived,
      V7_FLASH_READ_OPTIONS,
    );
  });

  it('adapts partition reads without exposing upstream options to the caller', async () => {
    const readFlash = vi.fn(async (_offset: number, length: number) => new Uint8Array(length));
    const loader = { readFlash } as FlashReader;

    await createV7CompatibleFlashReader(loader).readFlash(0x8000, 32);

    expect(readFlash).toHaveBeenCalledWith(0x8000, 32, undefined, V7_FLASH_READ_OPTIONS);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { disableCdcBurstPacketReader } from './flashReadCompatibility';

describe('flash read compatibility', () => {
  it('disables v9\'s CDC burst packet parser', () => {
    const loader = { _isCDCDevice: true, readFlash: vi.fn() };

    disableCdcBurstPacketReader(loader);

    expect(loader._isCDCDevice).toBe(false);
  });
});

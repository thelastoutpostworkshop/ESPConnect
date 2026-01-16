import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { OTA_SELECT_ENTRY_SIZE } from '../constants/app';
import { detectActiveOtaSlot } from '../utils/ota';

const FIXTURE_PATH = path.resolve(process.cwd(), 'src/tests/fixtures/otadata_images/otadata_ota_1_active.bin');

describe('otadata fixture detection', () => {
  it('detects ota_1 as the active slot', () => {
    const otadata = new Uint8Array(readFileSync(FIXTURE_PATH));
    const combined = new Uint8Array(OTA_SELECT_ENTRY_SIZE * 2);
    combined.set(otadata.subarray(0, OTA_SELECT_ENTRY_SIZE), 0);
    combined.set(otadata.subarray(0x1000, 0x1000 + OTA_SELECT_ENTRY_SIZE), OTA_SELECT_ENTRY_SIZE);
    const otaEntries = [
      { subtype: 0x10 },
      { subtype: 0x11 },
    ];

    const detected = detectActiveOtaSlot(combined, otaEntries);

    expect(detected.slotId).toBe('ota_1');
    expect(detected.summary.toLowerCase()).toContain('ota_1');
  });
});

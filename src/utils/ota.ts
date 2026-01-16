import { OTA_SELECT_ENTRY_SIZE } from '../constants/app';

type MinimalOtaEntry = {
  subtype?: number;
};

type OtaDetectionResult = {
  slotId: string | null;
  summary: string;
};

function readUint32LE(buffer: Uint8Array, offset: number): number {
  if (!buffer || offset == null || offset < 0 || offset + 4 > buffer.length) {
    return 0;
  }
  return (
    buffer[offset] |
    (buffer[offset + 1] << 8) |
    (buffer[offset + 2] << 16) |
    (buffer[offset + 3] << 24)
  );
}

// Determine the active OTA slot from otadata contents.
export function detectActiveOtaSlot(otadata: Uint8Array, otaEntries: MinimalOtaEntry[]): OtaDetectionResult {
  const otaCount = otaEntries?.length ?? 0;
  if (!otadata || !otadata.length || !otaCount) {
    return { slotId: null, summary: 'Active slot unknown.' };
  }

  const entryCount = Math.min(Math.floor(otadata.length / OTA_SELECT_ENTRY_SIZE), otaCount > 1 ? 2 : 1);
  const entries = [];
  for (let index = 0; index < entryCount; index += 1) {
    const base = index * OTA_SELECT_ENTRY_SIZE;
    const seq = readUint32LE(otadata, base);
    if (!seq || Number.isNaN(seq) || seq === 0xffffffff || seq === 0xfffffffe || seq >= 0x80000000) {
      continue;
    }
    const slotIndex = (seq - 1) % otaCount;
    if (slotIndex < 0 || slotIndex >= otaCount) {
      continue;
    }
    const stateOffset = base + 16;
    const state = stateOffset < otadata.length ? otadata[stateOffset] : null;
    entries.push({
      seq,
      slotIndex,
      state,
    });
  }

  if (!entries.length) {
    return { slotId: null, summary: 'Active slot unknown.' };
  }

  entries.sort((a, b) => b.seq - a.seq);
  const winner = entries[0];
  const slotId = `ota_${winner.slotIndex}`;
  return {
    slotId,
    summary: `Active slot: ${slotId} (sequence ${winner.seq})`,
  };
}

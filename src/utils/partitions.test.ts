import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { detectFilesystemType, readPartitionTable } from './partitions';

const textEncoder = new TextEncoder();
const FIXTURE_ROOT = path.resolve(process.cwd(), 'src/tests/fixtures/fs-images');
const FAT_FIXTURE = new Uint8Array(readFileSync(path.join(FIXTURE_ROOT, 'fat', 'fat.bin')));
const MICROPY_FIXTURE = new Uint8Array(readFileSync(path.join(FIXTURE_ROOT, 'littlefs', 'littlefs-micropython1-25.bin')));
const LITTLEFS_V2_0_FIXTURE = new Uint8Array(readFileSync(path.join(FIXTURE_ROOT, 'littlefs', 'littlefs_v2_0.bin')));
const SPIFFS_FIXTURE = new Uint8Array(readFileSync(path.join(FIXTURE_ROOT, 'spiffs', 'spiffs.bin')));

function makeFixtureLoader(image: Uint8Array) {
  return {
    readFlash: async (offset: number, length: number) => image.subarray(offset, offset + length),
  };
}

function makePartitionEntry({
  type,
  subtype,
  offset,
  size,
  label,
}: {
  type: number;
  subtype: number;
  offset: number;
  size: number;
  label: string;
}) {
  const entry = new Uint8Array(32).fill(0xff);
  const view = new DataView(entry.buffer);
  view.setUint16(0, 0x50aa, true);
  view.setUint8(2, type);
  view.setUint8(3, subtype);
  view.setUint32(4, offset, true);
  view.setUint32(8, size, true);

  const labelBytes = textEncoder.encode(label);
  const labelLen = Math.min(labelBytes.length, 16);
  entry.set(labelBytes.subarray(0, labelLen), 12);
  if (labelLen < 16) {
    entry.fill(0x00, 12 + labelLen, 28);
  }

  return entry;
}

function makeTerminator() {
  const entry = new Uint8Array(32);
  const view = new DataView(entry.buffer);
  view.setUint16(0, 0xffff, true);
  return entry;
}

describe('partition utilities', () => {
  describe('detectFilesystemType', () => {
    it('returns null when the read buffer is too small', async () => {
      const loader = {
        readFlash: async () => new Uint8Array(16),
      };
      expect(await detectFilesystemType(loader, 0x1000, 0x2000)).toBeNull();
    });

    it('detects LittleFS when the magic string is present', async () => {
      const loader = {
        readFlash: async (_offset: number, length: number) => {
          const data = new Uint8Array(length);
          data.set(textEncoder.encode('hello littlefs/ world'));
          return data;
        },
      };
      expect(await detectFilesystemType(loader, 0x1000, 0x2000)).toBe('littlefs');
    });

    it('detects LittleFS when superblock magic is followed by a supported version', async () => {
      const loader = {
        readFlash: async (_offset: number, length: number) => {
          const data = new Uint8Array(length);
          const markerOffset = 128;
          data.set(textEncoder.encode('littlefs'), markerOffset);
          const view = new DataView(data.buffer);
          view.setUint32(markerOffset + 'littlefs'.length, 0x00020000, true);
          return data;
        },
      };
      expect(await detectFilesystemType(loader, 0x1000, 0x2000)).toBe('littlefs');
    });

    it('returns null when readFlash throws', async () => {
      const loader = {
        readFlash: async () => {
          throw new Error('boom');
        },
      };
      expect(await detectFilesystemType(loader, 0x1000, 0x2000)).toBeNull();
    });

    it('detects FAT from a valid boot sector', async () => {
      const loader = makeFixtureLoader(FAT_FIXTURE);
      expect(await detectFilesystemType(loader, 0, FAT_FIXTURE.length)).toBe('fatfs');
    });

    it('detects SPIFFS from fixture pages', async () => {
      const loader = makeFixtureLoader(SPIFFS_FIXTURE);
      expect(await detectFilesystemType(loader, 0, SPIFFS_FIXTURE.length)).toBe('spiffs');
    });

    it('detects LittleFS in MicroPython FAT-labeled fixture', async () => {
      const loader = makeFixtureLoader(MICROPY_FIXTURE);
      expect(await detectFilesystemType(loader, 0, MICROPY_FIXTURE.length)).toBe('littlefs');
    });

    it('detects LittleFS for the v2.0 fixture', async () => {
      const loader = makeFixtureLoader(LITTLEFS_V2_0_FIXTURE);
      expect(await detectFilesystemType(loader, 0, LITTLEFS_V2_0_FIXTURE.length)).toBe('littlefs');
    });
  });

  describe('readPartitionTable', () => {
    function createPartitionTable(entries: Uint8Array[]) {
      const table = new Uint8Array(0x400).fill(0xff);
      let offset = 0;
      for (const entry of entries) {
        table.set(entry, offset);
        offset += 32;
      }
      return table;
    }

    it('parses entries and detects filesystem type for LittleFS partitions', async () => {
      const fsLabel = 'appfs';
      const entry = makePartitionEntry({ type: 0x01, subtype: 0x82, offset: 0x1000, size: 0x2000, label: fsLabel });
      const table = createPartitionTable([entry, makeTerminator()]);

      const littleFsContent = textEncoder.encode('greeting littlefs/ - test');
      const fsMap = new Map<number, Uint8Array>([
        [0x1000, littleFsContent],
      ]);

      const loader = {
        readFlash: async (offset: number, length: number) => {
          if (offset === 0x8000) return table.subarray(0, length);
          const stored = fsMap.get(offset);
          if (!stored) return new Uint8Array(length);
          const buffer = new Uint8Array(length);
          buffer.set(stored.subarray(0, Math.min(stored.length, length)));
          return buffer;
        },
      };

      const entries = await readPartitionTable(loader);
      expect(entries).toEqual([
        {
          label: fsLabel,
          type: 0x01,
          subtype: 0x82,
          offset: 0x1000,
          size: 0x2000,
          detectedFilesystem: 'littlefs',
        },
      ]);
    });

    it('sets detectedFilesystem when probe identifies LittleFS for a 0x83 partition', async () => {
      const fsLabel = 'littlefs';
      const entry = makePartitionEntry({ type: 0x01, subtype: 0x83, offset: 0x1000, size: 0x2000, label: fsLabel });
      const table = createPartitionTable([entry, makeTerminator()]);

      const loader = {
        readFlash: async (offset: number, length: number) => {
          if (offset === 0x8000) return table.subarray(0, length);
          if (offset === 0x1000) return LITTLEFS_V2_0_FIXTURE.subarray(0, length);
          return new Uint8Array(length);
        },
      };

      const entries = await readPartitionTable(loader);
      expect(entries).toEqual([
        {
          label: fsLabel,
          type: 0x01,
          subtype: 0x83,
          offset: 0x1000,
          size: 0x2000,
          detectedFilesystem: 'littlefs',
        },
      ]);
    });

    it('returns an empty array when reading the table fails', async () => {
      const loader = {
        readFlash: async () => {
          throw new Error('fail');
        },
      };
      const entries = await readPartitionTable(loader);
      expect(entries).toEqual([]);
    });
  });
});

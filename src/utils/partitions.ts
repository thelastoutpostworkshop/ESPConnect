type LogFn = (message: string, detail?: unknown, levelTag?: string) => void;

function logInfo(log: LogFn | undefined, message: string) {
  log?.(message, undefined, '[ESPConnect-Debug]');
}

function logWarn(log: LogFn | undefined, message: string, detail?: unknown) {
  log?.(message, detail, '[ESPConnect-Warn]');
}

const PROBE_BYTES = 64 * 1024;
const FAT_SECTOR_SIZE = 512;
const LITTLEFS_VERSIONS = new Set([0x00020000, 0x00020001]);
const LITTLEFS_SUPERBLOCK_TAG_PREFIX = 0xf7ff0ff0;
const LITTLEFS_SUPERBLOCK_MIRROR_DISTANCE = 0x1000;
const SPIFFS_PAGE_SIZES = [256, 512];
const asciiEncoder = new TextEncoder();
const LITTLEFS_MARKER = asciiEncoder.encode('littlefs/');
const LITTLEFS_MAGIC = asciiEncoder.encode('littlefs');

function isPowerOfTwo(value: number) {
  return value > 0 && (value & (value - 1)) === 0;
}

function findSequence(haystack: Uint8Array, needle: Uint8Array, start = 0) {
  if (!needle.length || haystack.length < needle.length) {
    return -1;
  }
  for (let i = start; i <= haystack.length - needle.length; i += 1) {
    let matched = true;
    for (let j = 0; j < needle.length; j += 1) {
      if (haystack[i + j] !== needle[j]) {
        matched = false;
        break;
      }
    }
    if (matched) {
      return i;
    }
  }
  return -1;
}

function hasLittlefsMarker(data: Uint8Array) {
  return findSequence(data, LITTLEFS_MARKER) >= 0;
}

function hasSequenceAt(data: Uint8Array, needle: Uint8Array, offset: number) {
  if (offset < 0 || offset + needle.length > data.length) {
    return false;
  }
  for (let index = 0; index < needle.length; index += 1) {
    if (data[offset + index] !== needle[index]) {
      return false;
    }
  }
  return true;
}

function hasLittlefsTagPrefix(index: number, view: DataView) {
  if (index < 4) {
    return false;
  }
  return view.getUint32(index - 4, true) === LITTLEFS_SUPERBLOCK_TAG_PREFIX;
}

function hasMirroredLittlefsSuperblock(index: number, data: Uint8Array, view: DataView) {
  const candidates = [index - LITTLEFS_SUPERBLOCK_MIRROR_DISTANCE, index + LITTLEFS_SUPERBLOCK_MIRROR_DISTANCE];
  return candidates.some(candidate => hasSequenceAt(data, LITTLEFS_MAGIC, candidate) && hasLittlefsTagPrefix(candidate, view));
}

function hasLittlefsSuperblock(data: Uint8Array, view: DataView) {
  let offset = 0;
  while (offset <= data.length - LITTLEFS_MAGIC.length) {
    const index = findSequence(data, LITTLEFS_MAGIC, offset);
    if (index < 0) {
      return false;
    }
    const versionOffset = index + LITTLEFS_MAGIC.length;
    if (versionOffset + 4 <= data.length) {
      const version = view.getUint32(versionOffset, true);
      if (LITTLEFS_VERSIONS.has(version)) {
        return true;
      }
    }
    if (hasLittlefsTagPrefix(index, view) && hasMirroredLittlefsSuperblock(index, data, view)) {
      return true;
    }
    offset = index + 1;
  }
  return false;
}

function hasFatBootSector(data: Uint8Array, view: DataView) {
  for (let offset = 0; offset + FAT_SECTOR_SIZE <= data.length; offset += FAT_SECTOR_SIZE) {
    if (data[offset + 510] !== 0x55 || data[offset + 511] !== 0xaa) {
      continue;
    }
    const bytesPerSector = view.getUint16(offset + 11, true);
    if (![512, 1024, 2048, 4096].includes(bytesPerSector)) {
      continue;
    }
    const sectorsPerCluster = data[offset + 13];
    if (!isPowerOfTwo(sectorsPerCluster)) {
      continue;
    }
    const reservedSectors = view.getUint16(offset + 14, true);
    if (reservedSectors === 0) {
      continue;
    }
    const fatCount = data[offset + 16];
    if (fatCount === 0 || fatCount > 4) {
      continue;
    }
    const totalSectors16 = view.getUint16(offset + 19, true);
    const totalSectors32 = view.getUint32(offset + 32, true);
    if (totalSectors16 === 0 && totalSectors32 === 0) {
      continue;
    }
    const fatSize16 = view.getUint16(offset + 22, true);
    const fatSize32 = view.getUint32(offset + 36, true);
    if (fatSize16 === 0 && fatSize32 === 0) {
      continue;
    }
    return true;
  }
  return false;
}

function hasSpiffsPages(data: Uint8Array, view: DataView) {
  for (const pageSize of SPIFFS_PAGE_SIZES) {
    for (let offset = 0; offset + 20 <= data.length; offset += pageSize) {
      const objId = view.getUint16(offset, true);
      if (objId === 0xffff || objId === 0x0000) {
        continue;
      }
      const spanIx = view.getUint16(offset + 2, true);
      if (spanIx > 0x2000) {
        continue;
      }
      if (data[offset + 13] === 0x2f) {
        return true;
      }
    }
  }
  return false;
}

export type DetectedFilesystem = 'littlefs' | 'fatfs' | 'spiffs';

export async function detectFilesystemType(
  loader: { readFlash: (offset: number, length: number) => Promise<Uint8Array> },
  offset: number,
  size: number,
  log?: LogFn,
) {
  try {
    const readSize = Math.min(PROBE_BYTES, size);
    if (readSize <= 0) {
      logWarn(log, 'Filesystem probe skipped: invalid partition size.', { offset, size });
      return null;
    }
    const data = await loader.readFlash(offset, readSize);

    if (data.length < FAT_SECTOR_SIZE) {
      logWarn(log, 'Filesystem probe skipped: not enough data to inspect.', { offset, size, readSize: data.length });
      return null;
    }

    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

    if (hasLittlefsMarker(data) || hasLittlefsSuperblock(data, view)) {
      logInfo(log, 'Filesystem probe detected LittleFS signature.');
      return 'littlefs';
    }

    if (hasFatBootSector(data, view)) {
      logInfo(log, 'Filesystem probe detected FAT boot sector.');
      return 'fatfs';
    }

    if (hasSpiffsPages(data, view)) {
      logInfo(log, 'Filesystem probe detected SPIFFS page headers.');
      return 'spiffs';
    }

    logWarn(log, 'Filesystem probe inconclusive; falling back to partition subtype.', { offset, size, readSize });
    return null;
  } catch (err) {
    logWarn(log, 'Failed to detect filesystem type; falling back to partition subtype.', err);
    return null;
  }
}

const PARTITION_MAGIC = 0x50aa;
const DEFAULT_PARTITION_TABLE_OFFSET = 0x8000;
const PARTITION_TABLE_PROBE_OFFSETS = [
  0x8000, 0x9000, 0xa000, 0xc000, 0xd000, 0xe000, 0x10000,
];

export async function probePartitionTableOffset(
  loader: { readFlash: (offset: number, length: number) => Promise<Uint8Array> },
  log?: LogFn,
): Promise<number> {
  for (const candidate of PARTITION_TABLE_PROBE_OFFSETS) {
    try {
      const data = await loader.readFlash(candidate, 2);
      const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
      if (view.getUint16(0, true) === PARTITION_MAGIC) {
        if (candidate !== DEFAULT_PARTITION_TABLE_OFFSET) {
          logInfo(log, `Partition table detected at non-standard offset 0x${candidate.toString(16)}.`);
        }
        return candidate;
      }
    } catch {
      // probe failed for this offset, try next
    }
  }
  logWarn(log, `No partition table magic found at any probed offset; falling back to default 0x${DEFAULT_PARTITION_TABLE_OFFSET.toString(16)}.`);
  return DEFAULT_PARTITION_TABLE_OFFSET;
}

export async function readPartitionTable(
  loader: { readFlash: (offset: number, length: number) => Promise<Uint8Array> },
  offset?: number,
  length = 0x400,
  log?: LogFn,
) {
  if (offset == null) {
    offset = await probePartitionTableOffset(loader, log);
  }
  try {
    const data = await loader.readFlash(offset, length);
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const decoder = new TextDecoder();
    const entries: Array<{
      label: string;
      type: number;
      subtype: number;
      offset: number;
      size: number;
      detectedFilesystem?: DetectedFilesystem;
    }> = [];
    for (let i = 0; i + 32 <= data.length; i += 32) {
      const magic = view.getUint16(i, true);
      if (magic === 0xffff || magic === 0x0000) break;
      if (magic !== 0x50aa) continue;
      const type = view.getUint8(i + 2);
      const subtype = view.getUint8(i + 3);
      const addr = view.getUint32(i + 4, true);
      const size = view.getUint32(i + 8, true);
      const labelBytes = data.subarray(i + 12, i + 28);
      const label = decoder
        .decode(labelBytes)
        .replace(/\0/g, '')
        .trim();
      entries.push({ label: label || `type 0x${type.toString(16)}`, type, subtype, offset: addr, size });
    }

    const fsCandidateSubtypes = new Set([0x81, 0x82, 0x83]);
    for (const entry of entries) {
      if (entry.type === 0x01 && fsCandidateSubtypes.has(entry.subtype)) {
        const detected = await detectFilesystemType(loader, entry.offset, entry.size, log);
        if (detected) {
          entry.detectedFilesystem = detected;
          logInfo(
            log,
            `Partition "${entry.label}" at 0x${entry.offset.toString(16)}: detected ${detected}.`,
          );
        } else {
          logWarn(
            log,
            `Partition "${entry.label}" at 0x${entry.offset.toString(16)}: filesystem probe inconclusive.`,
          );
        }
      }
    }

    return entries;
  } catch (err) {
    log?.('Failed to read partition table', err);
    return [];
  }
}

import type { ChipMetadata } from './types';
import type { ESPLoader } from 'tasmota-webserial-esptool';

// Minimal ESP32-H21 metadata helper (constants mirrored from legacy target for reference)
export const CHIP_NAME = 'ESP32-H21';
export const IMAGE_CHIP_ID = 25;
export const EFUSE_BASE = 0x60008800;
export const MAC_EFUSE_REG = EFUSE_BASE + 0x044;
export const FLASH_WRITE_SIZE = 0x400;
export const BOOTLOADER_FLASH_OFFSET = 0;

// type Loader = {
//   chipName?: string;
//   chipRevision?: number;
//   macAddr?: () => number[];
// };

export async function readEsp32H21Metadata(loader: ESPLoader): Promise<ChipMetadata> {
  const mac = typeof loader.macAddr === 'function' ? safeMac(loader) : undefined;
  return {
    description: loader.chipName ?? CHIP_NAME,
    features: ['802.15.4', 'BLE'],
    crystalFreq: 40,
    macAddress: mac,
    pkgVersion: undefined,
    chipRevision: loader.chipRevision ?? undefined,
    majorVersion: undefined,
    minorVersion: undefined,
    flashVendor: undefined,
    psramVendor: undefined,
    flashCap: undefined,
    psramCap: undefined,
    blockVersionMajor: undefined,
    blockVersionMinor: undefined,
  };
}

function safeMac(loader: ESPLoader) {
  try {
    const mac = loader.macAddr?.();
    if (!Array.isArray(mac)) return undefined;
    return mac
      .slice(0, 6)
      .map(b => b.toString(16).padStart(2, '0'))
      .join(':');
  } catch {
    return undefined;
  }
}

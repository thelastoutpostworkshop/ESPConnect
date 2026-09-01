import type { ChipMetadata } from './types';
import type { ESPLoader } from 'tasmota-webserial-esptool';

// ESP32-S31 metadata helper. Variant-specific memory details require eFuse decoding.
export const CHIP_NAME = 'ESP32-S31';
export const IMAGE_CHIP_ID = 32;
export const EFUSE_BASE = 0x60008800;
export const MAC_EFUSE_REG = EFUSE_BASE + 0x044;
export const FLASH_WRITE_SIZE = 0x400;
export const BOOTLOADER_FLASH_OFFSET = 0;

// type Loader = {
//   chipName?: string;
//   chipRevision?: number;
//   macAddr?: () => number[];
// };

export async function readEsp32S31Metadata(loader: ESPLoader): Promise<ChipMetadata> {
  const mac = typeof loader.macAddr === 'function' ? safeMac(loader) : undefined;
  return {
    description: loader.chipName ?? CHIP_NAME,
    features: [
      'Wi-Fi 6',
      'Bluetooth 5.4 LE',
      'Bluetooth Classic',
      'IEEE 802.15.4 (Thread / Zigbee)',
      'Dual-core 32-bit RISC-V high-performance CPU',
      'Low-power RISC-V core',
      '320 MHz',
    ],
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

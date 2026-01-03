import type { ChipMetadata } from './types';
import type { ESPLoader } from 'tasmota-webserial-esptool';

// ESP32-C3 register and layout constants (mirrors original target structure)
export const CHIP_NAME = 'ESP32-C3';
export const IMAGE_CHIP_ID = 5;
export const EFUSE_BASE = 0x60008800;
export const MAC_EFUSE_REG = EFUSE_BASE + 0x044;
export const UART_CLKDIV_REG = 0x3ff40014;
export const UART_CLKDIV_MASK = 0xfffff;
export const UART_DATE_REG_ADDR = 0x6000007c;
export const FLASH_WRITE_SIZE = 0x400;
export const BOOTLOADER_FLASH_OFFSET = 0;
export const SPI_REG_BASE = 0x60002000;
export const SPI_USR_OFFS = 0x18;
export const SPI_USR1_OFFS = 0x1c;
export const SPI_USR2_OFFS = 0x20;
export const SPI_MOSI_DLEN_OFFS = 0x24;
export const SPI_MISO_DLEN_OFFS = 0x28;
export const SPI_W0_OFFS = 0x58;
export const IROM_MAP_START = 0x42000000;
export const IROM_MAP_END = 0x42800000;
export const MEMORY_MAP: Array<[number, number, string]> = [
  [0x00000000, 0x00010000, 'PADDING'],
  [0x3c000000, 0x3c800000, 'DROM'],
  [0x3fc80000, 0x3fce0000, 'DRAM'],
  [0x3fc88000, 0x3fd00000, 'BYTE_ACCESSIBLE'],
  [0x3ff00000, 0x3ff20000, 'DROM_MASK'],
  [0x40000000, 0x40060000, 'IROM_MASK'],
  [0x42000000, 0x42800000, 'IROM'],
  [0x4037c000, 0x403e0000, 'IRAM'],
  [0x50000000, 0x50002000, 'RTC_IRAM'],
  [0x50000000, 0x50002000, 'RTC_DRAM'],
  [0x600fe000, 0x60100000, 'MEM_INTERNAL2'],
];

// type Esp32C3Loader = {
//   readReg: (addr: number) => Promise<number>;
//   macAddr?: () => number[];
//   chipRevision?: number;
//   chipName?: string;
// };

export async function readEsp32C3Metadata(loader: ESPLoader): Promise<ChipMetadata> {
  const readRegister = (addr: number) => loader.readRegister(addr);

  const getPkgVersion = async () => {
    const word3 = await readRegister(EFUSE_BASE + 0x044 + 4 * 3);
    return (word3 >> 21) & 0x07;
  };
  const getMinorChipVersion = async () => {
    const hi = ((await readRegister(EFUSE_BASE + 0x044 + 4 * 5)) >> 23) & 0x01;
    const low = ((await readRegister(EFUSE_BASE + 0x044 + 4 * 3)) >> 18) & 0x07;
    return (hi << 3) + low;
  };
  const getMajorChipVersion = async () =>
    ((await readRegister(EFUSE_BASE + 0x044 + 4 * 5)) >> 24) & 0x03;

  const getFlashCap = async () => {
    const registerValue = await readRegister(EFUSE_BASE + 0x044 + 4 * 3);
    return (registerValue >> 27) & 0x07;
  };
  const getFlashVendor = async () => {
    const registerValue = await readRegister(EFUSE_BASE + 0x044 + 4 * 4);
    const vendorId = (registerValue >> 0) & 0x07;
    const vendorMap: Record<number, string> = {
      1: 'XMC',
      2: 'GD',
      3: 'FM',
      4: 'TT',
      5: 'ZBIT',
    };
    return vendorMap[vendorId] || '';
  };

  const pkgVersion = await safeCall(getPkgVersion);
  const majorVersion = await safeCall(getMajorChipVersion);
  const minorVersion = await safeCall(getMinorChipVersion);
  const flashCap = await safeCall(getFlashCap);
  const flashVendor = await safeCall(getFlashVendor);

  const description = (() => {
    const chipDesc: Record<number, string> = {
      0: 'ESP32-C3 (QFN32)',
      1: 'ESP8685 (QFN28)',
      2: 'ESP32-C3 AZ (QFN32)',
      3: 'ESP8686 (QFN24)',
    };
    if (pkgVersion === undefined || majorVersion === undefined || minorVersion === undefined) {
      return loader.chipName ?? CHIP_NAME;
    }
    return `${chipDesc[pkgVersion] || 'Unknown ESP32-C3'} (revision v${majorVersion}.${minorVersion})`;
  })();

  const features = await safeCall(async () => {
    const list = ['Wi-Fi', 'BLE'];
    const flashMap: Record<number, string | null | undefined> = {
      0: null,
      1: 'Embedded Flash 4MB',
      2: 'Embedded Flash 2MB',
      3: 'Embedded Flash 1MB',
      4: 'Embedded Flash 8MB',
    };
    const flashDesc = flashMap[flashCap ?? -1];
    if (flashDesc !== null && flashDesc !== undefined) {
      list.push(`${flashDesc}${flashVendor ? ` (${flashVendor})` : ''}`);
    }
    return list;
  });

  const macAddress = await safeCall(async () => {
    if (typeof loader.macAddr === 'function') {
      const mac = loader.macAddr();
      if (Array.isArray(mac) && mac.length >= 6) {
        return mac
          .slice(0, 6)
          .map(b => b.toString(16).padStart(2, '0'))
          .join(':');
      }
    }
    let mac0 = await readRegister(MAC_EFUSE_REG);
    mac0 = mac0 >>> 0;
    let mac1 = await readRegister(MAC_EFUSE_REG + 4);
    mac1 = (mac1 >>> 0) & 0x0000ffff;
    const mac = new Uint8Array(6);
    mac[0] = (mac1 >> 8) & 0xff;
    mac[1] = mac1 & 0xff;
    mac[2] = (mac0 >> 24) & 0xff;
    mac[3] = (mac0 >> 16) & 0xff;
    mac[4] = (mac0 >> 8) & 0xff;
    mac[5] = mac0 & 0xff;
    return Array.from(mac)
      .map(b => b.toString(16).padStart(2, '0'))
      .join(':');
  });

  return {
    description,
    features,
    crystalFreq: 40,
    macAddress,
    pkgVersion,
    chipRevision: loader.chipRevision ?? undefined,
    majorVersion,
    minorVersion,
    flashVendor,
    psramVendor: undefined,
    flashCap,
    psramCap: undefined,
    blockVersionMajor: undefined,
    blockVersionMinor: undefined,
  };
}

async function safeCall<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch {
    return undefined;
  }
}

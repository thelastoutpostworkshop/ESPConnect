import type { ChipMetadata } from './types';
import type { ESPLoader } from 'tasmota-webserial-esptool';

// ESP32-S3 register and layout constants (mirrors original target structure)
export const IMAGE_CHIP_ID = 9;
export const EFUSE_BASE = 0x60007000;
export const MAC_EFUSE_REG = EFUSE_BASE + 0x044;
export const EFUSE_BLOCK1_ADDR = EFUSE_BASE + 0x44;
export const EFUSE_BLOCK2_ADDR = EFUSE_BASE + 0x5c;
export const UART_CLKDIV_REG = 0x60000014;
export const UART_CLKDIV_MASK = 0xfffff;
export const UART_DATE_REG_ADDR = 0x60000080;
export const FLASH_WRITE_SIZE = 0x400;
export const BOOTLOADER_FLASH_OFFSET = 0x0;
export const SPI_REG_BASE = 0x60002000;
export const SPI_USR_OFFS = 0x18;
export const SPI_USR1_OFFS = 0x1c;
export const SPI_USR2_OFFS = 0x20;
export const SPI_MOSI_DLEN_OFFS = 0x24;
export const SPI_MISO_DLEN_OFFS = 0x28;
export const SPI_W0_OFFS = 0x58;
export const USB_RAM_BLOCK = 0x800;
export const UARTDEV_BUF_NO_USB = 3;
export const UARTDEV_BUF_NO = 0x3fcef14c;
export const IROM_MAP_START = 0x42000000;
export const IROM_MAP_END = 0x44000000;
export const MEMORY_MAP: Array<[number, number, string]> = [
  [0x00000000, 0x00010000, 'PADDING'],
  [0x3c000000, 0x3d000000, 'DROM'],
  [0x3d000000, 0x3e000000, 'EXTRAM_DATA'],
  [0x600fe000, 0x60100000, 'RTC_DRAM'],
  [0x3fc88000, 0x3fd00000, 'BYTE_ACCESSIBLE'],
  [0x3fc88000, 0x403e2000, 'MEM_INTERNAL'],
  [0x3fc88000, 0x3fd00000, 'DRAM'],
  [0x40000000, 0x4001a100, 'IROM_MASK'],
  [0x40370000, 0x403e0000, 'IRAM'],
  [0x600fe000, 0x60100000, 'RTC_IRAM'],
  [0x42000000, 0x42800000, 'IROM'],
  [0x50000000, 0x50002000, 'RTC_DATA'],
];

// type Esp32S3Loader = {
//   readReg: (addr: number) => Promise<number>;
//   macAddr?: () => number[];
//   chipRevision?: number;
//   chipName?: string;
// };

export async function readEsp32S3Metadata(loader: ESPLoader): Promise<ChipMetadata> {
  const readRegister = (addr: number) => loader.readRegister(addr);

  const getPkgVersion = async () => ((await readRegister(EFUSE_BLOCK1_ADDR + 4 * 3)) >> 21) & 0x07;
  const getBlkVersionMajor = async () => ((await readRegister(EFUSE_BLOCK2_ADDR + 4 * 4)) >> 0) & 0x03;
  const getBlkVersionMinor = async () => ((await readRegister(EFUSE_BLOCK1_ADDR + 4 * 3)) >> 24) & 0x07;
  const getRawMinor = async () => {
    const hi = ((await readRegister(EFUSE_BLOCK1_ADDR + 4 * 5)) >> 23) & 0x01;
    const low = ((await readRegister(EFUSE_BLOCK1_ADDR + 4 * 3)) >> 18) & 0x07;
    return (hi << 3) + low;
  };
  const getRawMajor = async () => ((await readRegister(EFUSE_BLOCK1_ADDR + 4 * 5)) >> 24) & 0x03;
  const isEco0 = async (minorRaw: number) =>
    (minorRaw & 0x7) === 0 && (await getBlkVersionMajor()) === 1 && (await getBlkVersionMinor()) === 1;
  const getMinorChipVersion = async () => {
    const minorRaw = await getRawMinor();
    if (await isEco0(minorRaw)) return 0;
    return minorRaw;
  };
  const getMajorChipVersion = async () => {
    const minorRaw = await getRawMinor();
    if (await isEco0(minorRaw)) return 0;
    return getRawMajor();
  };

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
      5: 'BY',
    };
    return vendorMap[vendorId] || '';
  };
  const getPsramCap = async () => {
    const registerValue = await readRegister(EFUSE_BASE + 0x044 + 4 * 4);
    return (registerValue >> 3) & 0x03;
  };
  const getPsramVendor = async () => {
    const registerValue = await readRegister(EFUSE_BASE + 0x044 + 4 * 4);
    const vendorId = (registerValue >> 7) & 0x03;
    const vendorMap: Record<number, string> = {
      1: 'AP_3v3',
      2: 'AP_1v8',
    };
    return vendorMap[vendorId] || '';
  };

  const pkgVersion = await safeCall(getPkgVersion);
  const majorVersion = await safeCall(getMajorChipVersion);
  const minorVersion = await safeCall(getMinorChipVersion);
  const blockVersionMajor = await safeCall(getBlkVersionMajor);
  const blockVersionMinor = await safeCall(getBlkVersionMinor);
  const flashCap = await safeCall(getFlashCap);
  const flashVendor = await safeCall(getFlashVendor);
  const psramCap = await safeCall(getPsramCap);
  const psramVendor = await safeCall(getPsramVendor);

  const features = await safeCall(async () => {
    const list = ['Wi-Fi', 'BLE', 'Dual Core', '240 MHz'];
    const flashMap: Record<number, string | null | undefined> = {
      0: null,
      1: 'Embedded Flash 8MB',
      2: 'Embedded Flash 4MB',
    };
    const psramMap: Record<number, string | null | undefined> = {
      0: null,
      1: 'Embedded PSRAM 8MB',
      2: 'Embedded PSRAM 2MB',
      3: "Embedded PSRAM present (8MB or more)"
    };
    const flashDesc = flashMap[flashCap ?? -1];
    const psramDesc = psramMap[psramCap ?? -1];
    if (flashDesc !== null && flashDesc !== undefined) {
      list.push(`${flashDesc}${flashVendor ? ` (${flashVendor})` : ''}`);
    }
    if (psramDesc !== null && psramDesc !== undefined) {
      list.push(`${psramDesc}${psramVendor ? ` (${psramVendor})` : ''}`);
    }
    return list;
  });

  const crystalFreq = 40; // MHz

  const description = (() => {
    const chipName: Record<number, string> = {
      0: 'ESP32-S3 (QFN56)',
      1: 'ESP32-S3-PICO-1 (LGA56)',
    };
    if (pkgVersion === undefined || majorVersion === undefined || minorVersion === undefined) {
      return loader.chipName ?? 'ESP32-S3';
    }
    const name = chipName[pkgVersion] || 'ESP32-S3';
    return `${name} (revision v${majorVersion}.${minorVersion})`;
  })();

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
    crystalFreq,
    macAddress,
    pkgVersion,
    chipRevision: loader.chipRevision ?? undefined,
    majorVersion,
    minorVersion,
    flashVendor,
    psramVendor,
    flashCap,
    psramCap,
    blockVersionMajor,
    blockVersionMinor,
  };
}

async function safeCall<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch {
    return undefined;
  }
}

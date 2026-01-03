import type { ChipMetadata } from './types';
import type { ESPLoader } from 'tasmota-webserial-esptool';

// ESP32-C6 constants and metadata helpers (mirrors legacy target structure)
export const CHIP_NAME = 'ESP32-C6';
export const IMAGE_CHIP_ID = 13;
export const EFUSE_BASE = 0x600b0800;
export const EFUSE_BLOCK1_ADDR = EFUSE_BASE + 0x044;
export const MAC_EFUSE_REG = EFUSE_BASE + 0x044;
export const UART_CLKDIV_REG = 0x3ff40014;
export const UART_CLKDIV_MASK = 0xfffff;
export const UART_DATE_REG_ADDR = 0x6000007c;

export const FLASH_WRITE_SIZE = 0x400;
export const BOOTLOADER_FLASH_OFFSET = 0x0;

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
  [0x42000000, 0x43000000, 'DROM'],
  [0x40800000, 0x40880000, 'DRAM'],
  [0x40800000, 0x40880000, 'BYTE_ACCESSIBLE'],
  [0x4004ac00, 0x40050000, 'DROM_MASK'],
  [0x40000000, 0x4004ac00, 'IROM_MASK'],
  [0x42000000, 0x43000000, 'IROM'],
  [0x40800000, 0x40880000, 'IRAM'],
  [0x50000000, 0x50004000, 'RTC_IRAM'],
  [0x50000000, 0x50004000, 'RTC_DRAM'],
  [0x600fe000, 0x60100000, 'MEM_INTERNAL2'],
];

// type Loader = {
//   chipName?: string;
//   chipRevision?: number;
//   macAddr?: () => number[];
//   readReg: (addr: number) => Promise<number>;
// };

export async function readEsp32C6Metadata(loader: ESPLoader): Promise<ChipMetadata> {
  const readEfuse = async (wordIndex: number) => loader.readRegister(EFUSE_BLOCK1_ADDR + 4 * wordIndex);

  const getPkgVersion = async () => {
    const word3 = await readEfuse(3);
    return (word3 >> 21) & 0x07;
  };

  const getChipRevision = async () => {
    const word3 = await readEfuse(3);
    const pos = 18;
    return (word3 >> pos) & 0x7;
  };

  const getChipDescription = async () => {
    const pkgVer = await getPkgVersion();
    const chipRev = await getChipRevision();
    const base = pkgVer === 0 ? 'ESP32-C6' : 'unknown ESP32-C6';
    return `${base} (revision ${chipRev})`;
  };

  const getChipFeatures = async () => ['Wi-Fi 6', 'BT 5', 'IEEE802.15.4'];
  const getCrystalFreq = async () => 40;

  const pkgVersion = await safeCall(getPkgVersion);
  const chipRevision = (await safeCall(getChipRevision)) ?? loader.chipRevision ?? undefined;
  const description = (await safeCall(getChipDescription)) ?? loader.chipName ?? CHIP_NAME;
  const features = await safeCall(getChipFeatures);
  const crystalFreq = await safeCall(getCrystalFreq);

  return {
    description,
    features,
    crystalFreq,
    macAddress: undefined,
    pkgVersion,
    chipRevision,
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

async function safeCall<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch {
    return undefined;
  }
}

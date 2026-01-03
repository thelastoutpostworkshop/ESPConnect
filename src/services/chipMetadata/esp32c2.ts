import type { ChipMetadata } from './types';
import type { ESPLoader } from 'tasmota-webserial-esptool';

// ESP32-C2 constants and metadata helpers (mirrors legacy target structure)
export const CHIP_NAME = 'ESP32-C2';
export const IMAGE_CHIP_ID = 12;
export const EFUSE_BASE = 0x60008800;
export const MAC_EFUSE_REG = EFUSE_BASE + 0x040;
export const UART_CLKDIV_REG = 0x60000014;
export const UART_CLKDIV_MASK = 0xfffff;
export const UART_DATE_REG_ADDR = 0x6000007c;
export const XTAL_CLK_DIVIDER = 1;

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
export const IROM_MAP_END = 0x42400000;

export const MEMORY_MAP: Array<[number, number, string]> = [
  [0x00000000, 0x00010000, 'PADDING'],
  [0x3c000000, 0x3c400000, 'DROM'],
  [0x3fca0000, 0x3fce0000, 'DRAM'],
  [0x3fc88000, 0x3fd00000, 'BYTE_ACCESSIBLE'],
  [0x3ff00000, 0x3ff50000, 'DROM_MASK'],
  [0x40000000, 0x40090000, 'IROM_MASK'],
  [0x42000000, 0x42400000, 'IROM'],
  [0x4037c000, 0x403c0000, 'IRAM'],
];

// type Loader = {
//   chipName?: string;
//   chipRevision?: number;
//   macAddr?: () => number[];
//   readReg: (addr: number) => Promise<number>;
//   // transport?: { baudrate?: number };
//   // info?: (msg: string) => void;
//   // changeBaud?: () => Promise<void>;
// };

export async function readEsp32C2Metadata(loader: ESPLoader): Promise<ChipMetadata> {
  const readEfuse = async (wordIndex: number) => loader.readRegister(MAC_EFUSE_REG + 4 * wordIndex);

  const getPkgVersion = async () => {
    const word1 = await readEfuse(1);
    return (word1 >> 22) & 0x07;
  };

  const getChipRevision = async () => {
    const word1 = await readEfuse(1);
    const pos = 20;
    return (word1 >> pos) & 0x03;
  };

  const getChipDescription = async () => {
    const pkgVer = await getPkgVersion();
    const chipRev = await getChipRevision();
    const base = pkgVer === 0 || pkgVer === 1 ? 'ESP32-C2' : 'unknown ESP32-C2';
    return `${base} (revision ${chipRev})`;
  };

  const getChipFeatures = async () => ['Wi-Fi', 'BLE'];

  const getCrystalFreq = async () => {
    const uartDiv = (await loader.readRegister(UART_CLKDIV_REG)) & UART_CLKDIV_MASK;
    // const baud = loader.transport?.baudrate ?? 115200;
    const baud =  115200;
    const etsXtal = (baud * uartDiv) / 1000000 / XTAL_CLK_DIVIDER;
    const normXtal = etsXtal > 33 ? 40 : 26;
    // if (Math.abs(normXtal - etsXtal) > 1 && typeof loader.info === 'function') {
    //   loader.info('WARNING: Unsupported crystal in use');
    // }
    return normXtal;
  };

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

import type { ChipMetadata } from './types';
import type { ESPLoader } from 'tasmota-webserial-esptool';

// ESP8266 constants and metadata helpers (mirrors legacy target structure)
export const CHIP_NAME = 'ESP8266';
export const CHIP_DETECT_MAGIC_VALUE = [0xfff0c101];
export const EFUSE_RD_REG_BASE = 0x3ff00050;
export const UART_CLKDIV_REG = 0x60000014;
export const UART_CLKDIV_MASK = 0xfffff;
export const XTAL_CLK_DIVIDER = 2;

export const FLASH_WRITE_SIZE = 0x4000;
export const BOOTLOADER_FLASH_OFFSET = 0x0; // Not implemented in legacy target
export const UART_DATE_REG_ADDR = 0x0; // Not implemented in legacy target

export const IROM_MAP_START = 0x40200000;
export const IROM_MAP_END = 0x40300000;

export const FLASH_SIZES: Record<string, number> = {
  '512KB': 0x00,
  '256KB': 0x10,
  '1MB': 0x20,
  '2MB': 0x30,
  '4MB': 0x40,
  '2MB-c1': 0x50,
  '4MB-c1': 0x60,
  '8MB': 0x80,
  '16MB': 0x90,
};

export const FLASH_FREQUENCY: Record<string, number> = {
  '80m': 0xf,
  '40m': 0x0,
  '26m': 0x1,
  '20m': 0x2,
};

export const MEMORY_MAP: Array<[number, number, string]> = [
  [0x3ff00000, 0x3ff00010, 'DPORT'],
  [0x3ffe8000, 0x40000000, 'DRAM'],
  [0x40100000, 0x40108000, 'IRAM'],
  [0x40201010, 0x402e1010, 'IROM'],
];

export const SPI_REG_BASE = 0x60000200;
export const SPI_USR_OFFS = 0x1c;
export const SPI_USR1_OFFS = 0x20;
export const SPI_USR2_OFFS = 0x24;
export const SPI_MOSI_DLEN_OFFS = 0x0; // not in esp8266
export const SPI_MISO_DLEN_OFFS = 0x0; // not in esp8266
export const SPI_W0_OFFS = 0x40;

// type Loader = {
//   chipName?: string;
//   chipRevision?: number;
//   macAddr?: () => number[];
//   readReg: (addr: number) => Promise<number>;
//   // transport?: { baudrate?: number };
// };

export async function readEsp8266Metadata(loader: ESPLoader): Promise<ChipMetadata> {
  const readEfuse = async (offset: number) => {
    const addr = EFUSE_RD_REG_BASE + 4 * offset;
    return loader.readRegister(addr);
  };

  const getChipDescription = async () => {
    const efuse3 = await readEfuse(2);
    const efuse0 = await readEfuse(0);
    const is8285 = ((efuse0 & (1 << 4)) | (efuse3 & (1 << 16))) !== 0;
    return is8285 ? 'ESP8285' : 'ESP8266EX';
  };

  const getChipFeatures = async () => {
    const features = ['WiFi'];
    const desc = await getChipDescription();
    if (desc === 'ESP8285') features.push('Embedded Flash');
    return features;
  };

  const getCrystalFreq = async () => {
    const uartDiv = (await loader.readRegister(UART_CLKDIV_REG)) & UART_CLKDIV_MASK;
    // const baud = loader.transport?.baudrate ?? 115200;
    const baud =  115200;
    const etsXtal = (baud * uartDiv) / 1000000 / XTAL_CLK_DIVIDER;
    const normXtal = etsXtal > 33 ? 40 : 26;
    // if (Math.abs(normXtal - etsXtal) > 1 && typeof loader.info === 'function') {
    //   loader.info(
    //     `WARNING: Detected crystal freq ${etsXtal}MHz is quite different to normalized freq ${normXtal}MHz. Unsupported crystal in use?`,
    //   );
    // }
    return normXtal;
  };

  const pkgVersion = undefined;
  const description = (await safeCall(getChipDescription)) ?? loader.chipName ?? CHIP_NAME;
  const features = await safeCall(getChipFeatures);
  const crystalFreq = await safeCall(getCrystalFreq);

  return {
    description,
    features,
    crystalFreq,
    macAddress: undefined,
    pkgVersion,
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

async function safeCall<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch {
    return undefined;
  }
}

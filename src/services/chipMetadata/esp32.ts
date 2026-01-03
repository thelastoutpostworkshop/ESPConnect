import type { ChipMetadata } from './types';
import type { ESPLoader } from 'tasmota-webserial-esptool';

// ESP32 constants and metadata readers (mirrors legacy target structure)
export const CHIP_NAME = 'ESP32';
export const IMAGE_CHIP_ID = 0;
export const EFUSE_RD_REG_BASE = 0x3ff5a000;
export const DR_REG_SYSCON_BASE = 0x3ff66000;
export const UART_CLKDIV_REG = 0x3ff40014;
export const UART_CLKDIV_MASK = 0xfffff;
export const UART_DATE_REG_ADDR = 0x60000078;
export const XTAL_CLK_DIVIDER = 1;

export const IROM_MAP_START = 0x400d0000;
export const IROM_MAP_END = 0x40400000;
export const DROM_MAP_START = 0x3f400000;
export const DROM_MAP_END = 0x3f800000;

export const MEMORY_MAP: Array<[number, number, string]> = [
  [0x00000000, 0x00010000, 'PADDING'],
  [0x3f400000, 0x3f800000, 'DROM'],
  [0x3f800000, 0x3fc00000, 'EXTRAM_DATA'],
  [0x3ff80000, 0x3ff82000, 'RTC_DRAM'],
  [0x3ff90000, 0x40000000, 'BYTE_ACCESSIBLE'],
  [0x3ffae000, 0x40000000, 'DRAM'],
  [0x3ffe0000, 0x3ffffffc, 'DIRAM_DRAM'],
  [0x40000000, 0x40070000, 'IROM'],
  [0x40070000, 0x40078000, 'CACHE_PRO'],
  [0x40078000, 0x40080000, 'CACHE_APP'],
  [0x40080000, 0x400a0000, 'IRAM'],
  [0x400a0000, 0x400bfffc, 'DIRAM_IRAM'],
  [0x400c0000, 0x400c2000, 'RTC_IRAM'],
  [0x400d0000, 0x40400000, 'IROM'],
  [0x50000000, 0x50002000, 'RTC_DATA'],
];

export const FLASH_SIZES: Record<string, number> = {
  '1MB': 0x00,
  '2MB': 0x10,
  '4MB': 0x20,
  '8MB': 0x30,
  '16MB': 0x40,
  '32MB': 0x50,
  '64MB': 0x60,
  '128MB': 0x70,
};

export const FLASH_FREQUENCY: Record<string, number> = {
  '80m': 0xf,
  '40m': 0x0,
  '26m': 0x1,
  '20m': 0x2,
};

export const FLASH_WRITE_SIZE = 0x400;
export const BOOTLOADER_FLASH_OFFSET = 0x1000;
export const SPI_REG_BASE = 0x3ff42000;
export const SPI_USR_OFFS = 0x1c;
export const SPI_USR1_OFFS = 0x20;
export const SPI_USR2_OFFS = 0x24;
export const SPI_W0_OFFS = 0x80;
export const SPI_MOSI_DLEN_OFFS = 0x28;
export const SPI_MISO_DLEN_OFFS = 0x2c;

// type Loader = {
//   chipName?: string;
//   chipRevision?: number;
//   macAddr?: () => number[];
//   readReg: (addr: number) => Promise<number>;
// };

export async function readEsp32Metadata(loader: ESPLoader): Promise<ChipMetadata> {
  const readEfuse = async (offset: number) => loader.readRegister(EFUSE_RD_REG_BASE + 4 * offset);

  const getPkgVersion = async () => {
    const word3 = await readEfuse(3);
    let pkgVersion = (word3 >> 9) & 0x07;
    pkgVersion += ((word3 >> 2) & 0x1) << 3;
    return pkgVersion;
  };

  const getChipRevision = async () => {
    const word3 = await readEfuse(3);
    const word5 = await readEfuse(5);
    const apbCtlDate = await loader.readRegister(DR_REG_SYSCON_BASE + 0x7c);

    const revBit0 = (word3 >> 15) & 0x1;
    const revBit1 = (word5 >> 20) & 0x1;
    const revBit2 = (apbCtlDate >> 31) & 0x1;
    if (revBit0 !== 0) {
      if (revBit1 !== 0) {
        if (revBit2 !== 0) return 3;
        return 2;
      }
      return 1;
    }
    return 0;
  };

  const getChipDescription = async () => {
    const chipDesc = [
      'ESP32-D0WDQ6',
      'ESP32-D0WD',
      'ESP32-D2WD',
      'ESP32-D0WD-OEM',
      'ESP32-U4WDH',
      'ESP32-PICO-D4',
      'ESP32-PICO-V3-02',
    ];
    let chipName = '';
    const pkgVersion = await getPkgVersion();
    const chipRevision = await getChipRevision();
    const rev3 = chipRevision === 3;
    const singleCore = (await readEfuse(3)) & (1 << 0);

    if (singleCore !== 0) {
      chipDesc[0] = 'ESP32-S0WDQ6';
      chipDesc[1] = 'ESP32-S0WD';
      chipDesc[3] = 'ESP32-S0WD-OEM';
    }
    if (rev3) {
      chipDesc[5] = 'ESP32-PICO-V3';
    }
    if (pkgVersion >= 0 && pkgVersion <= 6) {
      chipName = chipDesc[pkgVersion];
    } else {
      chipName = 'Unknown ESP32';
    }

    if (rev3 && (pkgVersion === 0 || pkgVersion === 1)) {
      chipName += '-V3';
    }
    return `${chipName} (revision ${chipRevision})`;
  };

  const getChipFeatures = async () => {
    const features = ['Wi-Fi'];
    const word3 = await readEfuse(3);

    const chipVerDisBt = word3 & (1 << 1);
    if (chipVerDisBt === 0) features.push('BT');

    const chipVerDisAppCpu = word3 & (1 << 0);
    features.push(chipVerDisAppCpu !== 0 ? 'Single Core' : 'Dual Core');

    const chipCpuFreqRated = word3 & (1 << 13);
    if (chipCpuFreqRated !== 0) {
      const chipCpuFreqLow = word3 & (1 << 12);
      features.push(chipCpuFreqLow !== 0 ? '160MHz' : '240MHz');
    }

    const pkgVersion = await getPkgVersion();
    if ([2, 4, 5, 6].includes(pkgVersion)) {
      features.push('Embedded Flash');
    }
    if (pkgVersion === 6) {
      features.push('Embedded PSRAM');
    }

    const word4 = await readEfuse(4);
    const adcVref = (word4 >> 8) & 0x1f;
    if (adcVref !== 0) {
      features.push('VRef calibration in efuse');
    }

    const blk3PartRes = (word3 >> 14) & 0x1;
    if (blk3PartRes !== 0) {
      features.push('BLK3 partially reserved');
    }

    const word6 = await readEfuse(6);
    const codingScheme = word6 & 0x3;
    const codingSchemeArr = ['None', '3/4', 'Repeat (UNSUPPORTED)', 'Invalid'];
    features.push(`Coding Scheme ${codingSchemeArr[codingScheme] ?? 'Unknown'}`);

    return features;
  };

  const getCrystalFreq = async () => {
    const uartDiv = (await loader.readRegister(UART_CLKDIV_REG)) & UART_CLKDIV_MASK;
    // const baud = loader.transport?.baudrate ?? 115200;
    const baud = 115200;
    const etsXtal = (baud * uartDiv) / 1000000 / XTAL_CLK_DIVIDER;
    const normXtal = etsXtal > 33 ? 40 : 26;
    // if (Math.abs(normXtal - etsXtal) > 1 && typeof loader.info === 'function') {
    //   loader.info('WARNING: Unsupported crystal in use');
    // }
    return normXtal;
  };

  const pkgVersion = await safeCall(getPkgVersion);
  const chipRevision = await safeCall(getChipRevision);
  const description = (await safeCall(getChipDescription)) ?? loader.chipName ?? CHIP_NAME;
  const features = await safeCall(getChipFeatures);
  const crystalFreq = await safeCall(getCrystalFreq);

  return {
    description,
    features,
    crystalFreq,
    macAddress: undefined,
    pkgVersion,
    chipRevision: chipRevision ?? loader.chipRevision ?? undefined,
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

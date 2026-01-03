import type { ChipMetadata } from './types';
import type { ESPLoader } from 'tasmota-webserial-esptool';

// ESP32-C61 constants and metadata helpers (mirrors legacy target structure)
export const CHIP_NAME = 'ESP32-C61';
export const IMAGE_CHIP_ID = 20;

export const CHIP_DETECT_MAGIC_VALUE = [0x33f0206f, 0x2421606f];

export const UART_DATE_REG_ADDR = 0x6000007c;

export const EFUSE_BASE = 0x600b4800;
export const EFUSE_BLOCK1_ADDR = EFUSE_BASE + 0x044;
export const MAC_EFUSE_REG = EFUSE_BASE + 0x044;

export const EFUSE_RD_REG_BASE = EFUSE_BASE + 0x030; // BLOCK0 read base address

export const EFUSE_PURPOSE_KEY0_REG = EFUSE_BASE + 0x34;
export const EFUSE_PURPOSE_KEY0_SHIFT = 0;
export const EFUSE_PURPOSE_KEY1_REG = EFUSE_BASE + 0x34;
export const EFUSE_PURPOSE_KEY1_SHIFT = 4;
export const EFUSE_PURPOSE_KEY2_REG = EFUSE_BASE + 0x34;
export const EFUSE_PURPOSE_KEY2_SHIFT = 8;
export const EFUSE_PURPOSE_KEY3_REG = EFUSE_BASE + 0x34;
export const EFUSE_PURPOSE_KEY3_SHIFT = 12;
export const EFUSE_PURPOSE_KEY4_REG = EFUSE_BASE + 0x34;
export const EFUSE_PURPOSE_KEY4_SHIFT = 16;
export const EFUSE_PURPOSE_KEY5_REG = EFUSE_BASE + 0x34;
export const EFUSE_PURPOSE_KEY5_SHIFT = 20;

export const EFUSE_DIS_DOWNLOAD_MANUAL_ENCRYPT_REG = EFUSE_RD_REG_BASE;
export const EFUSE_DIS_DOWNLOAD_MANUAL_ENCRYPT = 1 << 20;

export const EFUSE_SPI_BOOT_CRYPT_CNT_REG = EFUSE_BASE + 0x030;
export const EFUSE_SPI_BOOT_CRYPT_CNT_MASK = 0x7 << 23;

export const EFUSE_SECURE_BOOT_EN_REG = EFUSE_BASE + 0x034;
export const EFUSE_SECURE_BOOT_EN_MASK = 1 << 26;

export const FLASH_FREQUENCY: Record<string, number> = {
  '80m': 0xf,
  '40m': 0x0,
  '20m': 0x2,
};

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
  [0x41800000, 0x42000000, 'DROM'],
  [0x40800000, 0x40860000, 'DRAM'],
  [0x40800000, 0x40860000, 'BYTE_ACCESSIBLE'],
  [0x4004ac00, 0x40050000, 'DROM_MASK'],
  [0x40000000, 0x4004ac00, 'IROM_MASK'],
  [0x41000000, 0x41800000, 'IROM'],
  [0x40800000, 0x40860000, 'IRAM'],
  [0x50000000, 0x50004000, 'RTC_IRAM'],
  [0x50000000, 0x50004000, 'RTC_DRAM'],
  [0x600fe000, 0x60100000, 'MEM_INTERNAL2'],
];

export const UF2_FAMILY_ID = 0x77d850c4;

export const EFUSE_MAX_KEY = 5;
export const KEY_PURPOSES: Record<number, string> = {
  0: 'USER/EMPTY',
  1: 'ECDSA_KEY',
  2: 'XTS_AES_256_KEY_1',
  3: 'XTS_AES_256_KEY_2',
  4: 'XTS_AES_128_KEY',
  5: 'HMAC_DOWN_ALL',
  6: 'HMAC_DOWN_JTAG',
  7: 'HMAC_DOWN_DIGITAL_SIGNATURE',
  8: 'HMAC_UP',
  9: 'SECURE_BOOT_DIGEST0',
  10: 'SECURE_BOOT_DIGEST1',
  11: 'SECURE_BOOT_DIGEST2',
  12: 'KM_INIT_KEY',
  13: 'XTS_AES_256_KEY_1_PSRAM',
  14: 'XTS_AES_256_KEY_2_PSRAM',
  15: 'XTS_AES_128_KEY_PSRAM',
};

// type Loader = {
//   chipName?: string;
//   chipRevision?: number;
//   macAddr?: () => number[];
//   readReg: (addr: number) => Promise<number>;
// };

export async function readEsp32C61Metadata(loader: ESPLoader): Promise<ChipMetadata> {
  const readEfuse = async (wordIndex: number) => loader.readRegister(EFUSE_BLOCK1_ADDR + 4 * wordIndex);

  const getPkgVersion = async () => {
    const word2 = await readEfuse(2);
    return (word2 >> 26) & 0x07;
  };

  const getMinorChipVersion = async () => {
    const word2 = await readEfuse(2);
    return (word2 >> 0) & 0x0f;
  };

  const getMajorChipVersion = async () => {
    const word2 = await readEfuse(2);
    return (word2 >> 4) & 0x03;
  };

  const getChipDescription = async () => {
    const pkgVer = await getPkgVersion();
    const base = pkgVer === 0 ? 'ESP32-C61' : 'unknown ESP32-C61';
    const majorRev = await getMajorChipVersion();
    const minorRev = await getMinorChipVersion();
    return `${base} (revision v${majorRev}.${minorRev})`;
  };

  const getChipFeatures = async () => ['WiFi 6', 'BT 5'];

  const pkgVersion = await safeCall(getPkgVersion);
  const majorVersion = await safeCall(getMajorChipVersion);
  const minorVersion = await safeCall(getMinorChipVersion);
  const description = (await safeCall(getChipDescription)) ?? loader.chipName ?? CHIP_NAME;
  const features = await safeCall(getChipFeatures);

  return {
    description,
    features,
    crystalFreq: 40,
    macAddress: undefined,
    pkgVersion,
    chipRevision: loader.chipRevision ?? undefined,
    majorVersion,
    minorVersion,
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

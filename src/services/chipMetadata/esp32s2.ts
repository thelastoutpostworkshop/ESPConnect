import type { ChipMetadata } from './types';
import type { ESPLoader } from 'tasmota-webserial-esptool';

// ESP32-S2 register and layout constants (mirrors original target structure)
export const IMAGE_CHIP_ID = 2;
export const IROM_MAP_START = 0x40080000;
export const IROM_MAP_END = 0x40b80000;
export const DROM_MAP_START = 0x3f000000;
export const DROM_MAP_END = 0x3f3f0000;
export const CHIP_DETECT_MAGIC_VALUE = [0x000007c6];
export const SPI_REG_BASE = 0x3f402000;
export const SPI_USR_OFFS = 0x18;
export const SPI_USR1_OFFS = 0x1c;
export const SPI_USR2_OFFS = 0x20;
export const SPI_MOSI_DLEN_OFFS = 0x24;
export const SPI_MISO_DLEN_OFFS = 0x28;
export const SPI_W0_OFFS = 0x58;
export const SPI_ADDR_REG_MSB = false;
export const MAC_EFUSE_REG = 0x3f41a044;
export const UART_CLKDIV_REG = 0x3f400014;
export const SUPPORTS_ENCRYPTED_FLASH = true;
export const FLASH_ENCRYPTED_WRITE_ALIGN = 16;
export const EFUSE_BASE = 0x3f41a000;
export const EFUSE_RD_REG_BASE = EFUSE_BASE + 0x030;
export const EFUSE_BLOCK1_ADDR = EFUSE_BASE + 0x044;
export const EFUSE_BLOCK2_ADDR = EFUSE_BASE + 0x05c;
export const EFUSE_PURPOSE_KEY0_REG = EFUSE_BASE + 0x34;
export const EFUSE_PURPOSE_KEY0_SHIFT = 24;
export const EFUSE_PURPOSE_KEY1_REG = EFUSE_BASE + 0x34;
export const EFUSE_PURPOSE_KEY1_SHIFT = 28;
export const EFUSE_PURPOSE_KEY2_REG = EFUSE_BASE + 0x38;
export const EFUSE_PURPOSE_KEY2_SHIFT = 0;
export const EFUSE_PURPOSE_KEY3_REG = EFUSE_BASE + 0x38;
export const EFUSE_PURPOSE_KEY3_SHIFT = 4;
export const EFUSE_PURPOSE_KEY4_REG = EFUSE_BASE + 0x38;
export const EFUSE_PURPOSE_KEY4_SHIFT = 8;
export const EFUSE_PURPOSE_KEY5_REG = EFUSE_BASE + 0x38;
export const EFUSE_PURPOSE_KEY5_SHIFT = 12;
export const EFUSE_DIS_DOWNLOAD_MANUAL_ENCRYPT_REG = EFUSE_RD_REG_BASE;
export const EFUSE_DIS_DOWNLOAD_MANUAL_ENCRYPT = 1 << 19;
export const EFUSE_SPI_BOOT_CRYPT_CNT_REG = EFUSE_BASE + 0x034;
export const EFUSE_SPI_BOOT_CRYPT_CNT_MASK = 0x7 << 18;
export const EFUSE_SECURE_BOOT_EN_REG = EFUSE_BASE + 0x038;
export const EFUSE_SECURE_BOOT_EN_MASK = 1 << 20;
export const EFUSE_RD_REPEAT_DATA3_REG = EFUSE_BASE + 0x3c;
export const EFUSE_RD_REPEAT_DATA3_REG_FLASH_TYPE_MASK = 1 << 9;
export const PURPOSE_VAL_XTS_AES256_KEY_1 = 2;
export const PURPOSE_VAL_XTS_AES256_KEY_2 = 3;
export const PURPOSE_VAL_XTS_AES128_KEY = 4;
export const UARTDEV_BUF_NO = 0x3ffffd14;
export const UARTDEV_BUF_NO_USB_OTG = 2;
export const USB_RAM_BLOCK = 0x800;
export const GPIO_STRAP_REG = 0x3f404038;
export const GPIO_STRAP_SPI_BOOT_MASK = 1 << 3;
export const GPIO_STRAP_VDDSPI_MASK = 1 << 4;
export const RTC_CNTL_OPTION1_REG = 0x3f408128;
export const RTC_CNTL_FORCE_DOWNLOAD_BOOT_MASK = 0x1;
export const RTCCNTL_BASE_REG = 0x3f408000;
export const RTC_CNTL_WDTCONFIG0_REG = RTCCNTL_BASE_REG + 0x0094;
export const RTC_CNTL_WDTCONFIG1_REG = RTCCNTL_BASE_REG + 0x0098;
export const RTC_CNTL_WDTWPROTECT_REG = RTCCNTL_BASE_REG + 0x00ac;
export const RTC_CNTL_WDT_WKEY = 0x50d83aa1;
export const MEMORY_MAP: Array<[number, number, string]> = [
  [0x00000000, 0x00010000, 'PADDING'],
  [0x3f000000, 0x3ff80000, 'DROM'],
  [0x3f500000, 0x3ff80000, 'EXTRAM_DATA'],
  [0x3ff9e000, 0x3ffa0000, 'RTC_DRAM'],
  [0x3ff9e000, 0x40000000, 'BYTE_ACCESSIBLE'],
  [0x3ff9e000, 0x40072000, 'MEM_INTERNAL'],
  [0x3ffb0000, 0x40000000, 'DRAM'],
  [0x40000000, 0x4001a100, 'IROM_MASK'],
  [0x40020000, 0x40070000, 'IRAM'],
  [0x40070000, 0x40072000, 'RTC_IRAM'],
  [0x40080000, 0x40800000, 'IROM'],
  [0x50000000, 0x50002000, 'RTC_DATA'],
];
export const EFUSE_VDD_SPI_REG = EFUSE_BASE + 0x34;
export const VDD_SPI_XPD = 1 << 4;
export const VDD_SPI_TIEH = 1 << 5;
export const VDD_SPI_FORCE = 1 << 6;
export const UF2_FAMILY_ID = 0xbfdd4eee;
export const EFUSE_MAX_KEY = 5;
export const UART_CLKDIV_MASK = 0xfffff;
export const UART_DATE_REG_ADDR = 0x60000078;
export const FLASH_WRITE_SIZE = 0x400;
export const BOOTLOADER_FLASH_OFFSET = 0x1000;

// type Esp32S2Loader = {
//   readReg: (addr: number) => Promise<number>;
//   macAddr?: () => number[];
//   chipRevision?: number;
//   chipName?: string;
// };

export async function readEsp32S2Metadata(loader: ESPLoader): Promise<ChipMetadata> {
  const readRegister = (addr: number) => loader.readRegister(addr);

  const getPkgVersion = async () => {
    const word = await readRegister(EFUSE_BLOCK1_ADDR + 4 * 4);
    return (word >> 0) & 0x0f;
  };
  const getMinorChipVersion = async () => {
    const hi = ((await readRegister(EFUSE_BLOCK1_ADDR + 4 * 3)) >> 20) & 0x01;
    const low = ((await readRegister(EFUSE_BLOCK1_ADDR + 4 * 4)) >> 4) & 0x07;
    return (hi << 3) + low;
  };
  const getMajorChipVersion = async () =>
    ((await readRegister(EFUSE_BLOCK1_ADDR + 4 * 3)) >> 18) & 0x03;
  const getFlashCap = async () => ((await readRegister(EFUSE_BLOCK1_ADDR + 4 * 3)) >> 21) & 0x0f;
  const getPsramCap = async () => ((await readRegister(EFUSE_BLOCK1_ADDR + 4 * 3)) >> 28) & 0x0f;

  const pkgVersion = await safeCall(getPkgVersion);
  const majorVersion = await safeCall(getMajorChipVersion);
  const minorVersion = await safeCall(getMinorChipVersion);
  const flashCap = await safeCall(getFlashCap);
  const psramCap = await safeCall(getPsramCap);

  const description = (() => {
    const chipDesc: Record<number, string> = {
      0: 'ESP32-S2',
      1: 'ESP32-S2FH2',
      2: 'ESP32-S2FH4',
      102: 'ESP32-S2FNR2',
      100: 'ESP32-S2R2',
    };
    if (
      flashCap === undefined ||
      psramCap === undefined ||
      majorVersion === undefined ||
      minorVersion === undefined
    ) {
      return loader.chipName ?? 'ESP32-S2';
    }
    const chipIndex = flashCap + psramCap * 100;
    return `${chipDesc[chipIndex] || 'unknown ESP32-S2'} (revision v${majorVersion}.${minorVersion})`;
  })();

  const features = await safeCall(async () => {
    const list = ['Wi-Fi'];
    const flashMap: Record<number, string> = {
      0: 'No Embedded Flash',
      1: 'Embedded Flash 2MB',
      2: 'Embedded Flash 4MB',
    };
    const psramMap: Record<number, string> = {
      0: 'No Embedded Flash',
      1: 'Embedded PSRAM 2MB',
    };
    if (flashCap !== undefined && flashMap[flashCap]) list.push(flashMap[flashCap]);
    if (psramCap !== undefined && psramMap[psramCap]) list.push(psramMap[psramCap]);
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
    const mac0 = await readRegister(MAC_EFUSE_REG);
    const mac1 = await readRegister(MAC_EFUSE_REG + 4);
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
    flashVendor: undefined,
    psramVendor: undefined,
    flashCap,
    psramCap,
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

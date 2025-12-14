export const APP_VERSION = '1.0.10-beta';
export const APP_BASE_URL = (import.meta.env?.BASE_URL ?? '/').replace(/\/+$/, '/') || '/';
export const LITTLEFS_WASM_ENTRY = `${APP_BASE_URL}wasm/littlefs/index.js`;
export const FATFS_WASM_ENTRY = `${APP_BASE_URL}wasm/fatfs/index.js`;
export const LITTLEFS_MODULE_CACHE_KEY =
  import.meta.env?.DEV ?
    `dev-${Date.now().toString(36)}` :
    APP_VERSION;

export const APP_IMAGE_HEADER_MAGIC = 0xe9;
export const APP_DESCRIPTOR_MAGIC = 0xabcd5432;
export const APP_DESCRIPTOR_LENGTH = 0x100;
export const APP_SCAN_LENGTH = 0x10000; // 64 KB
export const OTA_SELECT_ENTRY_SIZE = 32;

export const asciiDecoder = new TextDecoder('utf-8');

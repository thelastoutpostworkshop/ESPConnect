export const APP_VERSION = '1.0.12';

export const APP_IMAGE_HEADER_MAGIC = 0xe9;
export const APP_DESCRIPTOR_MAGIC = 0xabcd5432;
export const APP_DESCRIPTOR_LENGTH = 0x100;
export const APP_SCAN_LENGTH = 0x10000; // 64 KB
export const OTA_SELECT_ENTRY_SIZE = 32;

export const asciiDecoder = new TextDecoder('utf-8');

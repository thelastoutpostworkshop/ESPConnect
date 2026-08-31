export type FlashReadProgressCallback = (
  packet: Uint8Array,
  progress: number,
  totalSize: number,
) => void;

export interface FlashReadOptions {
  chunkSize?: number;
  blockSize?: number;
  maxInFlight?: number;
}

export interface FlashReader {
  readFlash(
    offset: number,
    length: number,
    onPacketReceived?: FlashReadProgressCallback,
    options?: FlashReadOptions,
  ): Promise<Uint8Array>;
}

// These were the stable flash-read parameters in tasmota-webserial-esptool 7.3.10.
// Version 9's desktop defaults can repeatedly time out before returning even a
// small partition-table read; retain the known-good transfer profile until
// upstream resolves that regression.
export const V7_FLASH_READ_OPTIONS = {
  chunkSize: 0x10000,
  blockSize: 0x1000,
  maxInFlight: 1024,
} as const;

export function readFlashWithV7Compatibility(
  loader: FlashReader,
  offset: number,
  length: number,
  onPacketReceived?: FlashReadProgressCallback,
) {
  return loader.readFlash(offset, length, onPacketReceived, V7_FLASH_READ_OPTIONS);
}

export function createV7CompatibleFlashReader(loader: FlashReader) {
  return {
    readFlash: (offset: number, length: number) =>
      readFlashWithV7Compatibility(loader, offset, length),
  };
}

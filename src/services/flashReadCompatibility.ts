interface CdcPacketReaderConfig {
  _isCDCDevice?: boolean;
}

// v9's CDC burst packet parser loses the first flash-read response on native USB
// and CH343 devices. Use its existing byte-by-byte parser until upstream fixes it.
export function disableCdcBurstPacketReader(loader: unknown) {
  (loader as CdcPacketReaderConfig)._isCDCDevice = false;
}

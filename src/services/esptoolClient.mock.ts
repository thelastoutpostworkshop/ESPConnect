import type { ChipMetadata } from './chipMetadata/types';
import type { SecurityFact } from './securityInfo';

export type StatusPayload = {
  translationKey?: string;
  params?: Record<string, unknown>;
  message?: string;
  showInDialog?: boolean;
};
type StatusCallback = (payload: StatusPayload) => void;

export interface EsptoolOptions {
  port: SerialPort;
  terminal: unknown;
  desiredBaud?: number;
  debugSerial?: boolean;
  debugLogging?: boolean;
  onStatus?: StatusCallback;
}

export interface ConnectHandshakeResult {
  chipName: string;
  chipId?: number;
  macAddress?: string;
  securityFacts: SecurityFact[];
  flashSize?: string | null;
}

type MockLoader = {
  flashId: () => Promise<number>;
  readFlash: (offset: number, length: number) => Promise<Uint8Array>;
  readRegister: (address: number) => Promise<number>;
  writeRegister: (address: number, value: number) => Promise<void>;
  reconnect: () => Promise<void>;
  setBaudrate: (baud: number) => Promise<void>;
  sleep: (ms: number) => Promise<void>;
  hardReset: (toStub?: boolean) => Promise<void>;
};

export class CompatibleTransport {
  device: SerialPort;
  baudrate: number;
  tracing: boolean;
  loader: MockLoader;

  constructor(device: SerialPort, loader: MockLoader) {
    this.device = device;
    this.tracing = false;
    this.baudrate = 115200;
    this.loader = loader;
  }

  async flushInput() {
    return;
  }

  async disconnect() {
    try {
      await this.device?.close?.();
    } catch {
      // swallow
    }
  }

  async *rawRead(signal?: AbortSignal) {
    const encoder = new TextEncoder();
    const chunks = [
      '[ESPConnect] Mock serial: booting...\n',
      '[ESPConnect] Mock serial: stub running\n',
      '[ESPConnect] Mock serial: ready\n',
    ];
    for (const chunk of chunks) {
      yield encoder.encode(chunk);
    }
    while (!signal?.aborted) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  async writeRaw(_data: Uint8Array) {
    return;
  }
}

export interface EsptoolClient {
  loader: MockLoader;
  transport: CompatibleTransport;
  connectAndHandshake: () => Promise<ConnectHandshakeResult>;
  readChipMetadata: () => Promise<ChipMetadata>;
  syncWithStub: () => Promise<void>;
  runWithBusy: <T>(fn: () => Promise<T>) => Promise<T>;
  flashMd5sum: (addr: number, size: number) => Promise<string>;
}

const CHIP_NAME = 'ESP32-S3';
const MAC_ADDRESS = 'aa:bb:cc:dd:ee:ff';
const FLASH_SIZE = '16MB';
const CHIP_ID = 0x32;
const MOCK_MD5 = 'd41d8cd98f00b204e9800998ecf8427e';
const PARTITION_TABLE_OFFSET = 0x8000;
const PARTITION_TABLE_SIZE = 0x400;
const textEncoder = new TextEncoder();

type PartitionEntryInput = {
  type: number;
  subtype: number;
  offset: number;
  size: number;
  label: string;
};

function makePartitionEntry(entry: PartitionEntryInput): Uint8Array {
  const buffer = new Uint8Array(32).fill(0xff);
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  view.setUint16(0, 0x50aa, true);
  view.setUint8(2, entry.type);
  view.setUint8(3, entry.subtype);
  view.setUint32(4, entry.offset, true);
  view.setUint32(8, entry.size, true);

  const labelBytes = textEncoder.encode(entry.label);
  const labelLen = Math.min(labelBytes.length, 16);
  buffer.set(labelBytes.subarray(0, labelLen), 12);
  if (labelLen < 16) {
    buffer.fill(0x00, 12 + labelLen, 28);
  }

  return buffer;
}

function makePartitionTerminator(): Uint8Array {
  const buffer = new Uint8Array(32);
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  view.setUint16(0, 0xffff, true);
  return buffer;
}

function createPartitionTable(entries: Uint8Array[]): Uint8Array {
  const table = new Uint8Array(PARTITION_TABLE_SIZE).fill(0xff);
  let offset = 0;
  for (const entry of entries) {
    table.set(entry, offset);
    offset += 32;
  }
  return table;
}

const mockPartitionTable = createPartitionTable([
  makePartitionEntry({ type: 0x01, subtype: 0x02, offset: 0x9000, size: 0x6000, label: 'nvs' }),
  makePartitionEntry({ type: 0x00, subtype: 0x00, offset: 0x10000, size: 0x100000, label: 'app0' }),
  makePartitionTerminator(),
]);

export async function requestSerialPort(_filters?: SerialPortFilter[]) {
  const port = {
    readable: null,
    writable: null,
    getInfo: () => ({ usbVendorId: 0x303a, usbProductId: 0x1001 }),
    open: async () => {
      return;
    },
    close: async () => {
      return;
    },
    setSignals: async () => {
      return;
    },
    getSignals: async () => ({}),
  } as unknown as SerialPort;

  return port;
}

export function createEsptoolClient(options: EsptoolOptions): EsptoolClient {
  const status = (payload: StatusPayload) => options.onStatus?.(payload);

  const loader: MockLoader = {
    flashId: async () => 0x1640ef,
    readFlash: async (offset, length) => {
      if (offset === PARTITION_TABLE_OFFSET) {
        return mockPartitionTable.subarray(0, length);
      }
      return new Uint8Array(length);
    },
    readRegister: async (address) => (address ^ 0xa5a5a5a5) >>> 0,
    writeRegister: async () => {
      return;
    },
    reconnect: async () => {
      return;
    },
    setBaudrate: async () => {
      return;
    },
    sleep: async () => {
      return;
    },
    hardReset: async () => {
      return;
    },
  };

  const transport = new CompatibleTransport(options.port, loader);

  const connectAndHandshake = async (): Promise<ConnectHandshakeResult> => {
    status({
      translationKey: 'dialogs.openingSerialPort',
      message: 'Opening serial port...',
      showInDialog: true,
    });
    status({
      translationKey: 'dialogs.handshakingBootloader',
      message: 'Handshaking with ROM bootloader...',
      showInDialog: true,
    });
    status({
      translationKey: 'dialogs.loadingStubFlasher',
      message: 'Loading stub flasher...',
      showInDialog: true,
    });
    const securityFacts: SecurityFact[] = [
      { label: 'Flash Encryption', value: 'ENABLED', kind: 'status' },
      { label: 'Secure Boot', value: 'ENABLED', kind: 'status' },
      { label: 'JTAG Protection', value: 'HARD disabled', kind: 'detail' },
    ];
    return {
      chipName: CHIP_NAME,
      chipId: CHIP_ID,
      macAddress: MAC_ADDRESS,
      flashSize: FLASH_SIZE,
      securityFacts,
    };
  };

  const readChipMetadata = async (): Promise<ChipMetadata> => {
    return {
      description: CHIP_NAME,
      features: ['Wi-Fi', 'Bluetooth LE', 'USB OTG'],
      crystalFreq: 40,
      macAddress: MAC_ADDRESS,
      pkgVersion: 1,
      chipRevision: 2,
      majorVersion: 1,
      minorVersion: 0,
      flashVendor: 'winbond',
      psramVendor: 'espressif',
      flashCap: 16 * 1024 * 1024,
      psramCap: 2 * 1024 * 1024,
      blockVersionMajor: 1,
      blockVersionMinor: 0,
    };
  };

  const syncWithStub = async (): Promise<void> => {
    status({
      translationKey: 'dialogs.reconnectingStub',
      message: 'Reconnect and sync with the stub',
      showInDialog: false,
    });
  };

  const runWithBusy = async <T>(fn: () => Promise<T>) => {
    return await fn();
  };

  const flashMd5sum = async (_addr: number, _size: number) => {
    return MOCK_MD5;
  };

  return {
    loader,
    transport,
    connectAndHandshake,
    readChipMetadata,
    syncWithStub,
    runWithBusy,
    flashMd5sum,
  };
}

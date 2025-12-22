import { ESPLoader } from 'tasmota-webserial-esptool';
import type { Logger } from 'tasmota-webserial-esptool/dist/const.js';
import type {} from '../types/web-serial';
import type { ChipMetadata } from './chipMetadata/types';
import {
  CHIP_FAMILY_ESP32S3,
  CHIP_FAMILY_ESP32S2,
  CHIP_FAMILY_ESP32C3,
  CHIP_FAMILY_ESP32,
  CHIP_FAMILY_ESP8266,
  CHIP_FAMILY_ESP32C2,
  CHIP_FAMILY_ESP32C5,
  CHIP_FAMILY_ESP32C6,
  CHIP_FAMILY_ESP32C61,
  CHIP_FAMILY_ESP32H2,
  CHIP_FAMILY_ESP32H4,
  CHIP_FAMILY_ESP32H21,
  CHIP_FAMILY_ESP32S31,
  CHIP_FAMILY_ESP32P4,
  ESP_ROM_BAUD,
  ESP_SPI_FLASH_MD5,
  timeoutPerMb,
} from 'tasmota-webserial-esptool/dist/const.js';
import { buildSecurityFacts, type SecurityFact } from "./securityInfo";
import { pack } from 'tasmota-webserial-esptool/dist/struct.js';
import { DEBUG_SERIAL, DEFAULT_ROM_BAUD } from '../constants/usb';
import { readEsp32S3Metadata } from './chipMetadata/esp32s3';
import { readEsp32S2Metadata } from './chipMetadata/esp32s2';
import { readEsp32C3Metadata } from './chipMetadata/esp32c3';
import { readEsp32Metadata } from './chipMetadata/esp32';
import { readEsp8266Metadata } from './chipMetadata/esp8266';
import { readEsp32C2Metadata } from './chipMetadata/esp32c2';
import { readEsp32C5Metadata } from './chipMetadata/esp32c5';
import { readEsp32C6Metadata } from './chipMetadata/esp32c6';
import { readEsp32C61Metadata } from './chipMetadata/esp32c61';
import { readEsp32H2Metadata } from './chipMetadata/esp32h2';
import { readEsp32P4Metadata } from './chipMetadata/esp32p4';
import { readEsp32H4Metadata } from './chipMetadata/esp32h4';
import { readEsp32H21Metadata } from './chipMetadata/esp32h21';
import { readEsp32S31Metadata } from './chipMetadata/esp32s31';

type StatusCallback = (message: string) => void;

type BusySetter = (busy: boolean) => void;
type BusyGetter = () => boolean;

export interface EsptoolOptions {
  port: SerialPort;
  terminal: unknown;
  desiredBaud?: number;
  debugSerial?: boolean;
  debugLogging?: boolean;
  onStatus?: StatusCallback;
}

export async function requestSerialPort(filters?: SerialPortFilter[]) {
  if (!navigator?.serial?.requestPort) {
    throw new Error('Web Serial API not available in this browser.');
  }
  return navigator.serial.requestPort(filters ? { filters } : undefined);
}

export interface ConnectHandshakeResult {
  chipName: string;
  macAddress?: string;
  securityFacts: SecurityFact[];
  flashSize?: string | null;
}

export interface EsptoolClient {
  loader: CompatibleLoader;
  transport: CompatibleTransport;
  connectAndHandshake: () => Promise<ConnectHandshakeResult>;
  readPartitionTable: (offset?: number, length?: number) => Promise<any[]>;
  readChipMetadata: () => Promise<ChipMetadata>;
}

export type CompatibleLoader = ESPLoader & {
  baudrate: number;
  readReg: (addr: number) => Promise<number>;
  writeReg: (addr: number, value: number, mask?: number, delayUs?: number) => Promise<void>;
  flashMd5sum: (addr: number, size: number) => Promise<string>;
  eraseFlash?: () => Promise<void>;
};

const MD5_TIMEOUT_PER_MB = 8000;
const sleep = (ms = 50) => new Promise(resolve => setTimeout(resolve, ms));

export class CompatibleTransport {
  device: SerialPort;
  baudrate: number;
  tracing: boolean;
  loader:CompatibleLoader;
  private readonly isBusy: BusyGetter;

  constructor(
    device: SerialPort,
    tracing: boolean,
    loader:CompatibleLoader,
    isBusy: BusyGetter,
  ) {
    this.device = device;
    this.tracing = tracing;
    this.baudrate = ESP_ROM_BAUD;
    this.isBusy = isBusy;
    this.loader = loader;
  }

  async flushInput() {
    const buffer = getInputBuffer(this.loader);
    if (buffer) {
      buffer.length = 0;
    }
  }

  async disconnect() {
    if (this.loader) {
      try {
        const maybeDisconnect = this.loader.disconnect();
        // Guard against hanging if the device is already gone.
        await Promise.race([maybeDisconnect, sleep(800)]);
      } catch {
        // swallow
      }
    }
    try {
      await this.device.close();
    } catch {
      // swallow
    }
  }

  async *rawRead(signal?: AbortSignal) {
    // Stream raw bytes from the loader's shared input buffer without fighting the bootloader reader lock.
    while (true) {
      if (signal?.aborted) {
        break;
      }
      if (!this.loader) {
        break;
      }
      if (this.isBusy()) {
        await sleep(25);
        continue;
      }
      const buffer = getInputBuffer(this.loader);
      if (buffer && buffer.length > 0) {
        if (signal?.aborted) {
          break;
        }
        const chunk = new Uint8Array(buffer.splice(0));
        if (chunk.length > 0) {
          yield chunk;
          continue;
        }
      }
      await sleep(30);
    }
  }
}

function createLogger(terminal: any, debugLogging: boolean): Logger {
  const writeLine = (msg: string, tag = 'ESPLoader') => {
    const line = tag ? `[${tag}] ${msg}` : msg;
    if (typeof terminal?.writeLine === 'function') {
      terminal.writeLine(line);
    } else if (typeof terminal?.write === 'function') {
      terminal.write(`${line}\n`);
    }
  };

  return {
    log: (msg: string, ...args: any[]) => {
      writeLine(String(msg));
      if (args.length) writeLine(args.map(String).join(' '));
    },
    error: (msg: string, ...args: any[]) => {
      writeLine(String(msg), 'ESPLoader-Error');
      if (args.length) writeLine(args.map(String).join(' '), 'ESPLoader-Error');
    },
    debug: (msg: string, ...args: any[]) => {
      if (!debugLogging) return;
      writeLine(String(msg), 'ESPLoader-Debug');
      if (args.length) writeLine(args.map(String).join(' '), 'ESPLoader-Debug');
    },
  };
}

function md5ToHex(md5: Uint8Array) {
  return Array.from(md5.slice(0, 16))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function getInputBuffer(loader: CompatibleLoader | null | undefined) {
  try {
    return (loader as any)?._inputBuffer as number[] | undefined;
  } catch {
    return undefined;
  }
}

function decorateLoader(loader: ESPLoader, setBusy: BusySetter): CompatibleLoader {
  const decorated = loader as CompatibleLoader;
  decorated.baudrate = decorated.baudrate ?? DEFAULT_ROM_BAUD;

  const runBusy = async <T>(fn: () => Promise<T>) => {
    setBusy(true);
    try {
      return await fn();
    } finally {
      setBusy(false);
    }
  };

  const baseReadFlash = loader.readFlash.bind(loader);
  decorated.readFlash = async (...args: Parameters<ESPLoader['readFlash']>) =>
    runBusy(() => baseReadFlash(...args));

  decorated.readReg = async (addr: number) => runBusy(() => loader.readRegister(addr));

  decorated.writeReg = async (addr: number, value: number, mask = 0xffffffff, delayUs = 0) =>
    runBusy(() => loader.writeRegister(addr, value, mask, delayUs));

  decorated.flashMd5sum = async (addr: number, size: number) =>
    runBusy(async () => {
      const timeout = timeoutPerMb(MD5_TIMEOUT_PER_MB, size);
      const payload = pack('<IIII', addr, size, 0, 0);
      const [, res] = await loader.checkCommand(ESP_SPI_FLASH_MD5, payload, 0, timeout);
      const md5 = new Uint8Array(res ?? []);
      return md5ToHex(md5);
    });

  const baseEraseFlash = (loader as any).eraseFlash?.bind(loader);
  if (baseEraseFlash) {
    (decorated as any).eraseFlash = async () => runBusy(() => baseEraseFlash());
  }

  return decorated;
}

export function createEsptoolClient({
  port,
  terminal,
  desiredBaud,
  debugSerial = DEBUG_SERIAL,
  debugLogging = false,
  onStatus,
}: EsptoolOptions): EsptoolClient {
  let busy = false;
  const setBusy: BusySetter = value => {
    busy = value;
  };
  const isBusy: BusyGetter = () => busy;

  const logger = createLogger(terminal, debugLogging);
  const esp_loader = new ESPLoader(port, logger);
  let loader = decorateLoader(esp_loader, setBusy);
  loader.debug = debugLogging;

  const loaderProxy = new Proxy({} as CompatibleLoader, {
    get(_target, prop) {
      const value = (loader as any)[prop];
      if (typeof value === 'function') {
        return value.bind(loader);
      }
      return value;
    },
    set(_target, prop, value) {
      (loader as any)[prop] = value;
      return true;
    },
    has(_target, prop) {
      return prop in loader;
    },
    ownKeys(_target) {
      return Reflect.ownKeys(loader);
    },
    getOwnPropertyDescriptor(_target, prop) {
      const descriptor = Object.getOwnPropertyDescriptor(loader, prop);
      if (descriptor) {
        return descriptor;
      }
      return {
        configurable: true,
        enumerable: true,
        writable: true,
        value: (loader as any)[prop as any],
      };
    },
  });

  const transport = new CompatibleTransport(port, debugSerial ?? false, loader, isBusy);

  const status = (msg: string) => onStatus?.(msg);

  let client: EsptoolClient;

  // Open the serial port, talk to the ROM bootloader, load the stub flasher, optionally raise baud,
  // and return the detected chip name plus MAC/security metadata.
  async function connectAndHandshake(): Promise<ConnectHandshakeResult> {
    setBusy(true);
    try {
      status('Opening serial port...');
      if (!port.readable || !port.writable) {
        await port.open({ baudRate: DEFAULT_ROM_BAUD });
      }
      loader.baudrate = DEFAULT_ROM_BAUD;
      transport.baudrate = DEFAULT_ROM_BAUD;

      status('Handshaking with ROM bootloader...');
      await loader.initialize();
      const macAddress = formatMac(loader.macAddr());

      const chipName = loader.chipName ?? 'ESP (Unknown)';

      status('Loading stub flasher...');
      const stub = await loader.runStub();
      loader = decorateLoader(stub, setBusy);
      loader.debug = debugLogging;

      if (desiredBaud && desiredBaud !== DEFAULT_ROM_BAUD) {
        loader.baudrate = desiredBaud;
        await loader.setBaudrate(desiredBaud);
        transport.baudrate = desiredBaud;
      }

      let securityInfo = undefined;
      let securityFacts: SecurityFact[] = [];
      try {
        status('Getting security information...');
        securityInfo = await loader.getSecurityInfo();
        securityFacts = buildSecurityFacts(securityInfo, chipName);
      } catch (error) {
        logger.error('Cannot read security information');
      }

      const result: ConnectHandshakeResult = { chipName, macAddress, securityFacts,flashSize:loader.flashSize };
      return result;
    } finally {
      setBusy(false);
    }
  }

  async function readPartitionTable(offset = 0x8000, length = 0x400) {
    const data = await loader.readFlash(offset, length);
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const decoder = new TextDecoder();
    const entries = [];
    for (let i = 0; i + 32 <= data.length; i += 32) {
      const magic = view.getUint16(i, true);
      if (magic === 0xffff || magic === 0x0000) break;
      if (magic !== 0x50aa) continue;
      const type = view.getUint8(i + 2);
      const subtype = view.getUint8(i + 3);
      const addr = view.getUint32(i + 4, true);
      const size = view.getUint32(i + 8, true);
      const labelBytes = data.subarray(i + 12, i + 28);
      const label = decoder
        .decode(labelBytes)
        .replace(/\0/g, '')
        .trim();
      entries.push({ label: label || `type 0x${type.toString(16)}`, type, subtype, offset: addr, size });
    }
    return entries;
  }

  async function readChipMetadata(): Promise<ChipMetadata> {
    setBusy(true);
    try {
      const chipFamily =loader.getChipFamily();

      if (chipFamily === CHIP_FAMILY_ESP32S3) {
        return await readEsp32S3Metadata(loader);
      }
      if (chipFamily === CHIP_FAMILY_ESP32S2) {
        return await readEsp32S2Metadata(loader);
      }
      if (chipFamily === CHIP_FAMILY_ESP32C3) {
        return await readEsp32C3Metadata(loader);
      }
      if (chipFamily === CHIP_FAMILY_ESP32) {
        return await readEsp32Metadata(loader);
      }
      if (chipFamily === CHIP_FAMILY_ESP8266) {
        return await readEsp8266Metadata(loader);
      }
      if (chipFamily === CHIP_FAMILY_ESP32C2) {
        return await readEsp32C2Metadata(loader);
      }
      if (chipFamily === CHIP_FAMILY_ESP32C5) {
        return await readEsp32C5Metadata(loader);
      }
      if (chipFamily === CHIP_FAMILY_ESP32C6) {
        return await readEsp32C6Metadata(loader);
      }
      if (chipFamily === CHIP_FAMILY_ESP32C61) {
        return await readEsp32C61Metadata(loader);
      }
      if (chipFamily === CHIP_FAMILY_ESP32H2) {
        return await readEsp32H2Metadata(loader);
      }
      if (chipFamily === CHIP_FAMILY_ESP32H4) {
        return await readEsp32H4Metadata(loader);
      }
      if (chipFamily === CHIP_FAMILY_ESP32H21) {
        return await readEsp32H21Metadata(loader);
      }
      if (chipFamily === CHIP_FAMILY_ESP32S31) {
        return await readEsp32S31Metadata(loader);
      }
      if (chipFamily === CHIP_FAMILY_ESP32P4) {
        return await readEsp32P4Metadata(loader);
      }

      return {
        description: loader.chipName ?? undefined,
        features: undefined,
        crystalFreq: undefined,
        macAddress: undefined,
        pkgVersion: undefined,
        chipRevision:undefined,
        majorVersion: undefined,
        minorVersion: undefined,
        flashVendor: undefined,
        psramVendor: undefined,
        flashCap: undefined,
        psramCap: undefined,
        blockVersionMajor: undefined,
        blockVersionMinor: undefined,
      };
    } finally {
      setBusy(false);
    }
  }

  client = {
    loader: loaderProxy,
    transport,
    connectAndHandshake,
    readPartitionTable,
    readChipMetadata,
  };

  return client;
}

function formatMac(macArr: number[] | undefined) {
  if (!Array.isArray(macArr) || macArr.length < 6) return undefined;
  return macArr.slice(0, 6).map(byte => byte.toString(16).padStart(2, '0')).join(':');
}

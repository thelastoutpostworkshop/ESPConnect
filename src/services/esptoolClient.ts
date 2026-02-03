import { ESPLoader } from 'tasmota-webserial-esptool';
import type { Logger } from 'tasmota-webserial-esptool/dist/const.js';
import type { } from '../types/web-serial';
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
import { version as tasmotaEsptoolVersion } from 'tasmota-webserial-esptool/package.json';
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

export type StatusPayload = {
  translationKey?: string;
  params?: Record<string, unknown>;
  message?: string;
  showInDialog?: boolean;
};
type StatusCallback = (payload: StatusPayload) => void;

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
  chipId?: number;
  macAddress?: string;
  securityFacts: SecurityFact[];
  flashSize?: string | null;
}

export interface EsptoolClient {
  loader: ESPLoader;
  transport: CompatibleTransport;
  connectAndHandshake: () => Promise<ConnectHandshakeResult>;
  readChipMetadata: () => Promise<ChipMetadata>;
  syncWithStub: () => Promise<void>;
  runWithBusy: <T>(fn: () => Promise<T>) => Promise<T>;
  flashMd5sum: (addr: number, size: number) => Promise<string>;
}

const MD5_TIMEOUT_PER_MB = 8000;
const sleep = (ms = 50) => new Promise(resolve => setTimeout(resolve, ms));

export class CompatibleTransport {
  device: SerialPort;
  baudrate: number;
  tracing: boolean;
  loader: ESPLoader;
  private readonly isBusy: BusyGetter;

  constructor(
    device: SerialPort,
    tracing: boolean,
    loader: ESPLoader,
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

  async writeRaw(data: Uint8Array) {
    if (!data.length) {
      return;
    }
    if (this.isBusy()) {
      throw new Error('Serial transport busy.');
    }
    const loader = this.loader as unknown as { writeToStream?: (data: number[]) => Promise<void> };
    if (loader?.writeToStream) {
      await loader.writeToStream(Array.from(data));
      return;
    }
    if (!this.device?.writable) {
      throw new Error('Serial port is not writable.');
    }
    const writer = this.device.writable.getWriter();
    try {
      await writer.write(data);
    } finally {
      writer.releaseLock();
    }
  }
}

function createLogger(terminal: any, debugLogging: boolean): Logger {
  const versionLabel = `v${tasmotaEsptoolVersion} webserial`;
  const writeLine = (msg: string, tag = 'ESPLoader') => {
    const timestamp = new Date().toISOString();
    const prefix = `${versionLabel} ${timestamp} `;
    const line = tag ? `${prefix} [${tag}]  ${msg}` : `${prefix} ${msg}`;
    terminal.writeLine(line);
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

function getInputBuffer(loader: ESPLoader | null | undefined) {
  try {
    return (loader as any)?._inputBuffer as number[] | undefined;
  } catch {
    return undefined;
  }
}

export function createEsptoolClient({
  port,
  terminal,
  desiredBaud,
  debugSerial = DEBUG_SERIAL,
  debugLogging = false,
  onStatus,
}: EsptoolOptions): EsptoolClient {
  let busyCount = 0;
  const setBusy: BusySetter = value => {
    busyCount = Math.max(0, busyCount + (value ? 1 : -1));
  };
  const isBusy: BusyGetter = () => busyCount > 0;

  const runWithBusy = async <T>(fn: () => Promise<T>) => {
    setBusy(true);
    try {
      return await fn();
    } finally {
      setBusy(false);
    }
  };

  const logger = createLogger(terminal, debugLogging);
  const esp_loader = new ESPLoader(port, logger);
  let loader = esp_loader;
  loader.debug = debugLogging;

  const loaderProxy = new Proxy({} as ESPLoader, {
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

  const status = (payload: StatusPayload) => onStatus?.(payload);
  status({ message: `tasmota-webserial-esptool v(${tasmotaEsptoolVersion})`, showInDialog: false });

  let client: EsptoolClient;

  async function syncWithStub(): Promise<void> {
    await runWithBusy(async () => {
      try {
        status({
          translationKey: 'dialogs.reconnectingStub',
          message: 'Reconnect and sync with the stub',
          showInDialog: false,
        });
        await loader.reconnect();
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        status({ message: `Could not reconnect (${message})`, showInDialog: false });
        console.error("Reconnect");
        console.error(e);
      }
    });
  }

  // Open the serial port, talk to the ROM bootloader, load the stub flasher, optionally raise baud,
  // and return the detected chip name plus MAC/security metadata.
  async function connectAndHandshake(): Promise<ConnectHandshakeResult> {
    return await runWithBusy(async () => {
      status({
        translationKey: 'dialogs.openingSerialPort',
        message: 'Opening serial port...',
        showInDialog: true,
      });
      if (!port.readable || !port.writable) {
        await port.open({ baudRate: DEFAULT_ROM_BAUD });
      }
      transport.baudrate = DEFAULT_ROM_BAUD;

      status({
        translationKey: 'dialogs.handshakingBootloader',
        message: 'Handshaking with ROM bootloader...',
        showInDialog: true,
      });
      await loader.initialize();
      const macAddress = formatMac(loader.macAddr());

      const chipName = loader.chipName ?? 'ESP (Unknown)';

      status({
        translationKey: 'dialogs.loadingStubFlasher',
        message: 'Loading stub flasher...',
        showInDialog: true,
      });
      const stub = await loader.runStub();
      loader = stub;
      transport.loader = loader;
      loader.debug = debugLogging;

      if (desiredBaud && desiredBaud !== DEFAULT_ROM_BAUD) {
        await loader.setBaudrate(desiredBaud);
        transport.baudrate = desiredBaud;
      }

      let securityInfo = undefined;
      let securityFacts: SecurityFact[] = [];
      let chipId: number | undefined = undefined;
      try {
        status({
          translationKey: 'dialogs.gettingSecurityInfo',
          message: 'Getting security information...',
          showInDialog: false,
        });
        securityInfo = await loader.getSecurityInfo();
        chipId = securityInfo?.chipId;
        securityFacts = buildSecurityFacts(securityInfo, chipName);
      } catch (error) {
        logger.error('Cannot read security information', error);
      }

      const result: ConnectHandshakeResult = {
        chipName,
        chipId,
        macAddress,
        securityFacts,
        flashSize: loader.flashSize,
      };
      return result;
    });
  }

  async function readChipMetadata(): Promise<ChipMetadata> {
    return await runWithBusy(async () => {
      const chipFamily = loader.getChipFamily();

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
        chipRevision: undefined,
        majorVersion: undefined,
        minorVersion: undefined,
        flashVendor: undefined,
        psramVendor: undefined,
        flashCap: undefined,
        psramCap: undefined,
        blockVersionMajor: undefined,
        blockVersionMinor: undefined,
      };
    });
  }

  async function flashMd5sum(addr: number, size: number): Promise<string> {
    return await runWithBusy(async () => {
      const timeout = timeoutPerMb(MD5_TIMEOUT_PER_MB, size);
      const payload = pack('<IIII', addr, size, 0, 0);
      const [, res] = await loader.checkCommand(ESP_SPI_FLASH_MD5, payload, 0, timeout);
      const md5 = new Uint8Array(res ?? []);
      return md5ToHex(md5);
    });
  }

  client = {
    loader: loaderProxy,
    transport,
    connectAndHandshake,
    readChipMetadata,
    syncWithStub,
    runWithBusy,
    flashMd5sum,
  };

  return client;
}

function formatMac(macArr: number[] | undefined) {
  if (!Array.isArray(macArr) || macArr.length < 6) return undefined;
  return macArr.slice(0, 6).map(byte => byte.toString(16).padStart(2, '0')).join(':');
}

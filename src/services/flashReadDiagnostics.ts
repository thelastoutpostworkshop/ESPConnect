import type { ESPLoader } from 'tasmota-webserial-esptool';
import { ESP_READ_FLASH } from 'tasmota-webserial-esptool/dist/const.js';
import { unpack } from 'tasmota-webserial-esptool/dist/struct.js';

export const FLASH_READ_DIAGNOSTIC_LABEL = 'issue-180-timeout-3s';
export const DIAGNOSTIC_FLASH_READ_TIMEOUT = 3000;

type ReadStage = 'command-response' | 'data-packet' | 'acknowledgment' | 'recovery';
type ReadContext = {
  address: number;
  size: number;
  received: number;
  packets: number;
  attempt: number;
  stage: ReadStage;
  startedAt: number;
};

const installed = new WeakSet<ESPLoader>();
const hex = (value: number) => `0x${value.toString(16)}`;

function bufferedBytes(loader: ESPLoader): number | string {
  try {
    // The stub delegates this getter to its parent. Observe without consuming bytes.
    return (loader as unknown as { _inputBuffer?: number[] })._inputBuffer?.length ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

function errorDescription(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

// Diagnostic branch only: retain upstream framing, ACKs, retries, and recovery.
// Apply the longer timeout only to flash data packets, not command or stub responses.
export function installFlashReadDiagnostics(loader: ESPLoader): void {
  if (installed.has(loader)) return;
  installed.add(loader);

  let context: ReadContext | undefined;
  const readFlash = loader.readFlash.bind(loader);
  const readPacket = loader.readPacket.bind(loader);
  const checkCommand = loader.checkCommand.bind(loader);
  const reconnect = loader.reconnect.bind(loader);
  const log = (message: string) => loader.logger.log(`[FlashRead-Diagnostic] ${message}`);
  const details = (read: ReadContext) =>
    `address=${hex(read.address)}, size=${read.size}, stage=${read.stage}, ` +
    `attempt=${read.attempt}, received=${read.received}/${read.size}, packets=${read.packets}, ` +
    `buffered=${bufferedBytes(loader)}, elapsed=${Date.now() - read.startedAt}ms`;

  loader.checkCommand = async (opcode, buffer, checksum, timeout) => {
    const read = context;
    if (read && opcode === ESP_READ_FLASH) {
      const [address, size, packetSize, maxInFlight] = unpack('<IIII', buffer);
      read.address = address;
      read.size = size;
      read.received = 0;
      read.packets = 0;
      read.attempt++;
      read.stage = 'command-response';
      read.startedAt = Date.now();
      log(`Read command: ${details(read)}, packetSize=${packetSize}, maxInFlight=${maxInFlight}.`);
    }
    const response = await checkCommand(opcode, buffer, checksum, timeout);
    if (read && opcode === ESP_READ_FLASH) read.stage = 'data-packet';
    return response;
  };

  loader.readPacket = async timeout => {
    const read = context;
    const isFlashData = read && (read.stage === 'data-packet' || read.stage === 'acknowledgment');
    if (isFlashData) read.stage = 'data-packet';
    try {
      const packet = await readPacket(isFlashData ? DIAGNOSTIC_FLASH_READ_TIMEOUT : timeout);
      if (isFlashData && packet.length > 0) {
        read.received += packet.length;
        read.packets++;
        read.stage = 'acknowledgment';
      }
      return packet;
    } catch (error) {
      // Log before upstream abort/drain removes evidence of the receive state.
      if (read) log(`Packet failure: ${details(read)}, error=${errorDescription(error)}.`);
      throw error;
    }
  };

  loader.reconnect = async () => {
    if (context) context.stage = 'recovery';
    return await reconnect();
  };

  loader.readFlash = async (address, size, onPacketReceived) => {
    context = {
      address, size, received: 0, packets: 0, attempt: 0,
      stage: 'command-response', startedAt: Date.now(),
    };
    const startedAt = Date.now();
    log(`Read start: address=${hex(address)}, size=${size}, loaderBaud=${loader.currentBaudRate}, buffered=${bufferedBytes(loader)}.`);
    try {
      const data = await readFlash(address, size, onPacketReceived);
      log(`Read returned: address=${hex(address)}, requested=${size}, returned=${data.length}, buffered=${bufferedBytes(loader)}, elapsed=${Date.now() - startedAt}ms.`);
      return data;
    } catch (error) {
      log(`Read failed: ${details(context)}, error=${errorDescription(error)}.`);
      throw error;
    } finally {
      context = undefined;
    }
  };

  const info = loader.port.getInfo();
  log(`Build=${FLASH_READ_DIAGNOSTIC_LABEL}; flash data timeout=${DIAGNOSTIC_FLASH_READ_TIMEOUT}ms; loaderBaud=${loader.currentBaudRate}; USB VID=${info.usbVendorId === undefined ? 'unknown' : hex(info.usbVendorId)}, PID=${info.usbProductId === undefined ? 'unknown' : hex(info.usbProductId)}.`);
}

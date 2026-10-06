import type { ESPLoader } from 'tasmota-webserial-esptool';
import { ESP_READ_FLASH } from 'tasmota-webserial-esptool/dist/const.js';
import { pack, unpack } from 'tasmota-webserial-esptool/dist/struct.js';
import { serialReceiveSnapshot, type ReceiveSnapshot } from './serialReceiveDiagnostics';

export const FLASH_READ_DIAGNOSTIC_LABEL = 'issue-180-s3-new-stub-1.2.2';
export const DIAGNOSTIC_FLASH_READ_TIMEOUT = 3000;
export const DIAGNOSTIC_FLASH_READ_MAX_IN_FLIGHT = 1;
export const DIAGNOSTIC_FLASH_READ_PACKET_SIZE = 1024;

type ReadStage = 'command-response' | 'data-packet' | 'acknowledgment' | 'recovery';
type ReadContext = {
  address: number;
  size: number;
  received: number;
  packets: number;
  packetSize: number;
  attempt: number;
  stage: ReadStage;
  startedAt: number;
  receiveStart?: ReceiveSnapshot;
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

// Diagnostic branch only: request 1024-byte packets with one in flight.
// Retain upstream read sizes, framing, ACKs, retries, and recovery.
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
  const receiveDetails = (start?: ReceiveSnapshot) => {
    const now = serialReceiveSnapshot(loader.port);
    if (!now) return 'rx=unavailable';
    return `rxBytes=${now.bytes - (start?.bytes ?? 0)}, rxChunks=${now.chunks - (start?.chunks ?? 0)}, ` +
      `rxErrors=${now.errors - (start?.errors ?? 0)}, recentRxChunkSizes=[${now.recentChunkSizes.join(',')}]`;
  };
  const details = (read: ReadContext) =>
    `address=${hex(read.address)}, size=${read.size}, stage=${read.stage}, ` +
    `attempt=${read.attempt}, received=${read.received}/${read.size}, packets=${read.packets}, ` +
    `buffered=${bufferedBytes(loader)}, elapsed=${Date.now() - read.startedAt}ms, ${receiveDetails(read.receiveStart)}`;

  loader.checkCommand = async (opcode, buffer, checksum, timeout) => {
    const read = context;
    if (read && opcode === ESP_READ_FLASH) {
      const [address, size, packetSize, maxInFlight] = unpack('<IIII', buffer);
      // Apply the diagnostic packet size/window on every attempt, including recovery.
      // Retain the address and total size without mutating the caller's buffer.
      buffer = pack('<IIII', address, size, DIAGNOSTIC_FLASH_READ_PACKET_SIZE, DIAGNOSTIC_FLASH_READ_MAX_IN_FLIGHT);
      read.address = address;
      read.size = size;
      read.received = 0;
      read.packets = 0;
      read.packetSize = DIAGNOSTIC_FLASH_READ_PACKET_SIZE;
      read.attempt++;
      read.stage = 'command-response';
      read.startedAt = Date.now();
      read.receiveStart = serialReceiveSnapshot(loader.port);
      log(`Read command: ${details(read)}, packetSize=${DIAGNOSTIC_FLASH_READ_PACKET_SIZE}, maxInFlight=${DIAGNOSTIC_FLASH_READ_MAX_IN_FLIGHT}, upstreamPacketSize=${packetSize}, upstreamMaxInFlight=${maxInFlight}.`);
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
        const expected = Math.min(read.packetSize, read.size - read.received);
        if (packet.length !== expected) {
          log(`Unexpected data packet size: expected=${expected}, actual=${packet.length}, ${details(read)}.`);
        }
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
      address, size, received: 0, packets: 0, packetSize: 0, attempt: 0,
      stage: 'command-response', startedAt: Date.now(),
    };
    const startedAt = Date.now();
    const receiveStart = serialReceiveSnapshot(loader.port);
    log(`Read start: address=${hex(address)}, size=${size}, loaderBaud=${loader.currentBaudRate}, buffered=${bufferedBytes(loader)}.`);
    try {
      const data = await readFlash(address, size, onPacketReceived);
      log(`Read returned: address=${hex(address)}, requested=${size}, returned=${data.length}, buffered=${bufferedBytes(loader)}, elapsed=${Date.now() - startedAt}ms, ${receiveDetails(receiveStart)}.`);
      return data;
    } catch (error) {
      log(`Read failed: ${details(context)}, error=${errorDescription(error)}.`);
      throw error;
    } finally {
      context = undefined;
    }
  };

  const info = loader.port.getInfo();
  log(`Build=${FLASH_READ_DIAGNOSTIC_LABEL}; flash data timeout=${DIAGNOSTIC_FLASH_READ_TIMEOUT}ms; packetSize=${DIAGNOSTIC_FLASH_READ_PACKET_SIZE}; maxInFlight=${DIAGNOSTIC_FLASH_READ_MAX_IN_FLIGHT}; loaderBaud=${loader.currentBaudRate}; USB VID=${info.usbVendorId === undefined ? 'unknown' : hex(info.usbVendorId)}, PID=${info.usbProductId === undefined ? 'unknown' : hex(info.usbProductId)}.`);
}

import type { Logger } from 'tasmota-webserial-esptool/dist/const.js';

export const DIAGNOSTIC_SERIAL_BUFFER_SIZE = 64 * 1024;

export type ReceiveSnapshot = {
  bytes: number;
  chunks: number;
  errors: number;
  recentChunkSizes: number[];
};

const snapshots = new WeakMap<SerialPort, ReceiveSnapshot>();

export function serialReceiveSnapshot(port: SerialPort): ReceiveSnapshot | undefined {
  const snapshot = snapshots.get(port);
  return snapshot && { ...snapshot, recentChunkSizes: [...snapshot.recentChunkSizes] };
}

function boundMember(target: object, property: string | symbol) {
  // Web Serial and stream methods require their original receiver.
  const value = Reflect.get(target, property, target);
  return typeof value === 'function' ? value.bind(target) : value;
}

// Observe the existing reader without adding a reader, queue, or stream transform.
// Keep the original bytes, errors, cancellation, and loader recovery behavior.
export function createDiagnosticSerialPort(port: SerialPort, logger: Logger): SerialPort {
  const snapshot: ReceiveSnapshot = { bytes: 0, chunks: 0, errors: 0, recentChunkSizes: [] };
  const streams = new WeakMap<ReadableStream<Uint8Array>, ReadableStream<Uint8Array>>();
  const log = (message: string) => logger.log(`[FlashRead-Diagnostic] ${message}`);
  const totals = () => `rxBytes=${snapshot.bytes}, rxChunks=${snapshot.chunks}, rxErrors=${snapshot.errors}`;

  const observed = new Proxy(port, {
    get(target, property) {
      if (property === 'open') {
        return async (options: SerialOptions) => {
          // This also intercepts the loader's baud-change and recovery opens.
          await target.open({ ...options, bufferSize: DIAGNOSTIC_SERIAL_BUFFER_SIZE });
          log(`Serial opened: baud=${options.baudRate}, bufferSize=${DIAGNOSTIC_SERIAL_BUFFER_SIZE}.`);
        };
      }
      if (property !== 'readable') return boundMember(target, property);
      const stream = target.readable;
      if (!stream) return stream;
      const existing = streams.get(stream);
      if (existing) return existing;
      const wrapped = new Proxy(stream, {
        get(source, key) {
          if (key !== 'getReader') return boundMember(source, key);
          return (options?: ReadableStreamGetReaderOptions) => {
            // The loader uses a default reader. Leave other reader modes alone.
            if (options?.mode === 'byob') return source.getReader(options);
            const reader = source.getReader();
            log(`Serial reader acquired: ${totals()}.`);
            return new Proxy(reader, {
              get(original, member) {
                if (member !== 'read') return boundMember(original, member);
                return async () => {
                  try {
                    const result = await original.read();
                    if (result.value?.length) {
                      snapshot.bytes += result.value.length;
                      snapshot.chunks++;
                      snapshot.recentChunkSizes.push(result.value.length);
                      if (snapshot.recentChunkSizes.length > 8) snapshot.recentChunkSizes.shift();
                    }
                    if (result.done) log(`Serial reader ended (including cancellation): ${totals()}.`);
                    return result;
                  } catch (error) {
                    snapshot.errors++;
                    const description = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
                    log(`Serial read error: ${totals()}, error=${description}.`);
                    throw error;
                  }
                };
              },
            });
          };
        },
      });
      streams.set(stream, wrapped);
      return wrapped;
    },
  });
  snapshots.set(observed, snapshot);
  return observed;
}

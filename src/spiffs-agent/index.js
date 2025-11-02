import esp32 from './esp32.json';
import esp32s2 from './esp32s2.json';
import esp8266 from './esp8266.json';

const stubMap = {
  esp32,
  esp32s2,
  esp8266,
};

const chipAlias = {
  ESP32: 'esp32',
  'ESP32-S2': 'esp32s2',
  'ESP8266': 'esp8266',
};

const decodedCache = new Map();

function decodeBase64(data) {
  if (!data) {
    return new Uint8Array(0);
  }
  if (typeof atob === 'function') {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  const buffer = Buffer.from(data, 'base64');
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

export function resolveSpiffsStubKey(chipName) {
  if (!chipName) return null;
  return chipAlias[chipName] ?? null;
}

export function getDecodedSpiffsStub(chipName) {
  const key = resolveSpiffsStubKey(chipName);
  if (!key) {
    return null;
  }
  if (decodedCache.has(key)) {
    return decodedCache.get(key);
  }
  const stub = stubMap[key];
  if (!stub) {
    return null;
  }
  const decoded = {
    text: decodeBase64(stub.text),
    data: decodeBase64(stub.data),
    textStart: stub.text_start,
    dataStart: stub.data_start,
    entry: stub.entry,
  };
  decodedCache.set(key, decoded);
  return decoded;
}

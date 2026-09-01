import { describe, expect, it } from 'vitest';
import type { ESPLoader } from 'tasmota-webserial-esptool';
import { readEsp32S31Metadata } from '../src/services/chipMetadata/esp32s31';

describe('ESP32-S31 metadata', () => {
  it('reports the documented radio and CPU capabilities without inferring variant-specific memory', async () => {
    const loader = {
      chipName: 'ESP32-S31',
      chipRevision: 0,
    } as unknown as ESPLoader;

    const metadata = await readEsp32S31Metadata(loader);

    expect(metadata.features).toEqual([
      'Wi-Fi 6',
      'Bluetooth 5.4 LE',
      'Bluetooth Classic',
      'IEEE 802.15.4 (Thread / Zigbee)',
      'Dual-core 32-bit RISC-V high-performance CPU',
      'Low-power RISC-V core',
      '320 MHz',
    ]);
    expect(metadata.psramCap).toBeUndefined();
  });
});

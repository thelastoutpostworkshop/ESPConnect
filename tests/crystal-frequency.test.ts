import { describe, expect, it } from 'vitest';
import {
  CHIP_FAMILY_ESP32,
  CHIP_FAMILY_ESP8266,
  CHIP_FAMILY_ESP32C2,
  CHIP_FAMILY_ESP32C5,
} from 'tasmota-webserial-esptool/dist/const.js';
import { createEsptoolClient } from '../src/services/esptoolClient';

const targets = [
  { name: 'ESP32', family: CHIP_FAMILY_ESP32, register: 0x3ff40014, divider: 1, crystals: [26, 40] },
  { name: 'ESP8266', family: CHIP_FAMILY_ESP8266, register: 0x60000014, divider: 2, crystals: [26, 40] },
  { name: 'ESP32-C2', family: CHIP_FAMILY_ESP32C2, register: 0x60000014, divider: 1, crystals: [26, 40] },
  { name: 'ESP32-C5', family: CHIP_FAMILY_ESP32C5, register: 0x60000014, divider: 1, crystals: [40, 48] },
];

describe.each(targets)('$name crystal frequency', target => {
  const createClient = (baud: number) => {
    const client = createEsptoolClient({
      port: { getInfo: () => ({}) } as SerialPort,
      terminal: {},
    });
    client.loader.chipFamily = target.family;
    // The stub's property can remain at ROM speed after its parent changes baud.
    client.loader.currentBaudRate = 115200;
    client.transport.baudrate = baud;
    return client;
  };

  for (const crystal of target.crystals) {
    it.each([115200, 460800, 921600])(`reports ${crystal} MHz at %i baud`, async baud => {
      const client = createClient(baud);
      const uartDivider = Math.floor(crystal * 1_000_000 * target.divider / baud);
      client.loader.readRegister = async address => address === target.register ? uartDivider : 0;

      const metadata = await client.readChipMetadata();

      expect(metadata.crystalFreq).toBe(crystal);
    });
  }

  it('keeps metadata available when the UART register cannot be read', async () => {
    const client = createClient(460800);
    client.loader.readRegister = async address => {
      if (address === target.register) throw new Error('Register read failed');
      return 0;
    };

    const metadata = await client.readChipMetadata();

    expect(metadata.crystalFreq).toBeUndefined();
    expect(metadata.description).toBeTruthy();
    expect(metadata.features).toBeDefined();
  });
});

# tasmota-webserial-esptool v9.2.23 investigation

## Purpose

This branch evaluates the development build of `tasmota-webserial-esptool` v9.2.23 for the ESP32-S31 support requested in [issue #172](https://github.com/thelastoutpostworkshop/ESPConnect/issues/172).

The upstream v9 development build includes an ESP32-S31 stub flasher and corrected S31 flash/eFuse register addresses. It was evaluated before being considered for release.

## Result

Do not release v9.2.23 at this time.

The connection handshake completes, but v9 consistently stalls on the first flash read used to load the partition table. This adds about 18 seconds to every connection before the loader retries and performs a deep serial-port recovery.

## Reproduction

The regression was reproduced repeatedly on multiple ESP32-S3 boards and with two transport types:

| Transport | Board | Observed behavior |
| --- | --- | --- |
| ESP32 native USB | ESP32-S3, revision 2, 4 MB flash | `readFlash(0x8000, 32)` exhausted retries after about 18 seconds, then recovered and resumed. |
| CH343 USB-to-serial | ESP32-S3, revision 1, 16 MB flash | The same 18-second retry/recovery cycle occurred repeatedly. |

Representative v9 log sequence:

```text
[ESPLoader] Reading 32 bytes from flash at address 0x8000...
[ESPLoader] All retries exhausted at 0x8000. Attempting recovery (close and reopen port)...
[ESPLoader] Reconnecting serial port...
[ESPLoader] Deep recovery successful. Resuming read from current position...
[ESPLoader] Reading 1024 bytes from flash at address 0x8000...
```

On the CH343 board, the initial read began at `21:12:03.571Z` and retries were exhausted at `21:12:21.577Z`: approximately 18 seconds. The same timing was observed again at `21:18:14.789Z` through `21:18:32.801Z`.

## Experiments that did not resolve it

- Forced the v7 flash-read transfer settings in the v9 wrapper.
- Disabled v9's private CDC burst packet reader.

Neither change prevented the initial-read retry and deep recovery.

## Release decision

The production candidate remains `tasmota-webserial-esptool` v7.3.10. ESP32-S31 support is instead supplied through a narrowly scoped v7 compatibility backport:

- ESP32-S31 stub flasher
- Correct S31 SPI flash register base
- Correct S31 eFuse and MAC register addresses

This avoids the v9 connection-delay regression while retaining the required S31 support.

## Conditions to revisit v9

Re-evaluate a future upstream v9 build only after the initial flash read can complete without retries on both native USB and USB-to-serial transports. Test at minimum:

1. Connection and stub loading.
2. The first partition-table read at `0x8000`.
3. Partition discovery and filesystem probing.
4. Flash reads, writes, erase, and reset flows on representative ESP32 families.

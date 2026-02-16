# Changelog

## 1.1.8
### Improvement
- Fixed LittleFS not detected ([issue #132](https://github.com/thelastoutpostworkshop/ESPConnect/issues/132)).
- Implemented an Electron-only serial-port chooser ([issue #128](https://github.com/thelastoutpostworkshop/ESPConnect/issues/128)).
- Session log now records chip pkgVersion/chipRevision/chip ID values.

### Documentation
- Clarified i18n rules: session log entries must remain English-only.

### Internal runtime
- Bump tasmota-webserial-esptool 7.3.4 to 7.3.7

## 1.1.7
### Fixed
- Serial Monitor now appends a newline to every command sent.

### Internal runtime
- Bump electron from 39.2.7 to 40.0.0
- Bump vue from from 3.5.11 to 3.5.27
- Bump vuetify from 3.11.6 to 3.11.7

## 1.1.6
### Improvement
- Serial Monitor now lets you send text input, including Ctrl+C, suggest by ator1811 ([issue #90](https://github.com/thelastoutpostworkshop/ESPConnect/issues/90)).
- Flash tools can erase a selected partition or a custom flash region without wiping the entire chip ([issue #109](https://github.com/thelastoutpostworkshop/ESPConnect/issues/109)).

### Fixed
- Flash tools now refresh the partition table after full erase or firmware flashes so the partitions view stays accurate ([issue #104](https://github.com/thelastoutpostworkshop/ESPConnect/issues/104)).
- Partitions empty state now distinguishes between disconnected devices and connected ESP32s with no partition table ([issue #104](https://github.com/thelastoutpostworkshop/ESPConnect/issues/104)).
- OTA Apps tab now reads both OTADATA sectors so the active slot indicator updates correctly after OTA swaps ([issue #108](https://github.com/thelastoutpostworkshop/ESPConnect/issues/108)).

### Internal runtime
- Bump tasmota-webserial-esptool 7.3.3 to 7.3.4
- Bump @types/node from 25.0.5 to 25.0.6 

### Development tooling
- Bump vite from 7.3.0 to 7.3.1

## 1.1.5
### Improvement
- Serial Monitor now renders ANSI color/style escape sequences in the output.
- Serial Monitor adds a copy-to-clipboard action.
- Show a progress dialog while erasing the entire flash.
- Filesystem tools now probe partition contents to detect LittleFS/FAT/SPIFFS before mounting ([issue #102](https://github.com/thelastoutpostworkshop/ESPConnect/issues/102)).
- Filesystem tools now treat `.py` files as text for previews.

### Internal
- Removed the decorateLoader shim since it's no longer needed with tasmota-webserial-esptool
- Added Playwright E2E scaffolding with a mocked WebSerial/esptool client
- Added Vitest for tasmota-webserial-esptool
- Added filesystem probe tests, including MicroPython LittleFS fixture coverage
- Bump tasmota-webserial-esptool 7.2.3 to 7.3.3
- Bump vue-i18n 11.2.7 to 11.2.8
- Bump vuetify 3.1.15 to 3.1.16
- Bump @types/node from 22.19.3 to 25.0.3
- Bump sass from 1.97.1 to 1.97.2
- Bump vue-tsc from 3.2.1 to 3.2.2

## 1.1.4
### Improvement
- Fat filesystem now supports folders
- Automatically detect the browser language: On the first visit, it automatically matches the supported language (en, fr, zh) based on the browser settings by MeatSuger
 ([PR #96](https://github.com/thelastoutpostworkshop/ESPConnect/pull/96)).
- Serial monitor start button now shows a loading indicator while the monitor is being initialized
- Delay removed for the connection dialog
- Connect dialog now displays localized status updates while the bootloader workflow runs
### Fixed 
- Fixed error in the Serial Monitor component when clearing the filter output
### Internal
- Added Vitest to fatfs fixture
- Added Vitest to littlefs fixture
- Added Vitest to spiffs fixture
### New Contributors
- [MeatSuger](https://github.com/MeatSuger) made their first contribution in ([PR #96](https://github.com/thelastoutpostworkshop/ESPConnect/pull/96))
## 1.1.3
### Improvement
- Session log now shows the version of tasmota-webserial-esptool package along with a timestamp
- Failed detection of flashid is now non-fatal

### Fixed 
- FATFS is now using 4096 bytes for logical sectors ([issue #92](https://github.com/thelastoutpostworkshop/ESPConnect/issues/92)).
- Replaced the custom TypeScript SPIFFS image handling with a WebAssembly-based implementation for full ESP32 SPIFFS compatibility and reliability.
  ([issue #77](https://github.com/thelastoutpostworkshop/ESPConnect/issues/77)).

### Internal
- Serial Monitor start now use native tasmota-webserial-esptool hardreset(false) to enter user firmware
- Extracted deterministic helpers and added unit tests
- Bumps tasmota-webserial-esptool from 7.2.2 to 7.2.3
- Bumps vuetify from 3.11.4 to 3.11.5
- Bumps vue-i18n from 9.14.5 to 11.2.7. 

## 1.1.2
### Improvement
- Internationalization: Migrated UI translations to the standard Vue I18n + Vuetify integration.
This replaces the previous DOM-based translation shim with a fully reactive, maintainable solution.
- Added French (fr) support by Patriboom
 ([PR #85](https://github.com/thelastoutpostworkshop/ESPConnect/pull/85)).
- Added reconnect after flashing operations so the ROM has time to finalize
- In partitions tools, opening the ESP32Paritionbuilder application url, now passes the partition information
- Partitions tab now reports total flash consumed (excludes bootloader and partition table)
- File systems restore now show the filename in the confirmation dialog
- Append app version + timestamp to every log entry  

### Internal
- Remove unused legacy code that was needed for esptool-js
- CI now zips the built dist/ directory, uploads it, and includes it in release downloads so the static web bundle can be grab directly
- npm run build now do a typecheck

### New Contributors
- [Patriboom](https://github.com/Patriboom) made their first contribution in ([PR #85](https://github.com/thelastoutpostworkshop/ESPConnect/pull/85))

## 1.1.1

### Fixed
- LittleFS uploads now use `client.getUsage()`
- Serial Monitor: stopping the monitor now returns to maintenance mode (ROM bootloader + stub); use Disconnect to fully close the port.
- Fix when lowering the baudrate automatically in the serial monitor for Native USB (0x1001) 

### Internal
- Refactor components to TypeScript
- Enable `strict` TypeScript settings and add `vue-tsc` typecheck script
- Fix strict-mode issues across App.vue, filesystem/flash tabs, and composables
- Add missing i18n module declaration for TS resolution
- Move SPIFFS utilities from `src/utils` to `src/lib`
- Build: upgrade `@electron/fuses` to v2.0.0 (requires Node.js >= 22.12.0) and update Forge fuses integration for ESM compatibility
- CI/Docker: bump Node to 22.12.0+ for builds


## 1.1.0
- New Feature : NVS Inspector
- Filesystem backups now reuse the last partition read (avoids re-downloading the same flash region twice) ([issue #51](https://github.com/thelastoutpostworkshop/ESPConnect/issues/51)).
- Added Chinese i18n support by iKalyes ([PR #67](https://github.com/thelastoutpostworkshop/ESPConnect/pull/67)).
- Moved WASM modules from public/ to src/ to ensure proper Vite module handling and eliminate dev/build import errors.
- Renamed "Download used flash" to "Download flash backup" in Flash Tools.
- Added a responsible disclosure policy (SECURITY.md). 
- Added a contributing file (CONTRIBUTING.md).

## 1.0.11
- Added standalone electron app in release assets by Jason2866 ([PR #56](https://github.com/thelastoutpostworkshop/ESPConnect/pull/56)).
- Fixed filesystem image flashing to pass an `ArrayBuffer` into `flashData` (avoids `ArrayBufferLike` / `SharedArrayBuffer` TypeScript warnings).
- Use tasmota-webserial-esptool v7.2.2
- Refactor to be better aligned with tasmota-webserial-esptool
- Fixed LittleFS update to support disk version by Jason2866 ([PR #61](https://github.com/thelastoutpostworkshop/ESPConnect/pull/61)).

## 1.0.9
- Fixed issues on flash size determination ([issue #8](https://github.com/thelastoutpostworkshop/ESPConnect/issues/8)).
- Removed duplicate detectFlashSize().
- Add ESP32-S0WD-OEM and ESP32-D0WD-OEM to chip descriptions by Jason2866 ([PR #55](https://github.com/thelastoutpostworkshop/ESPConnect/pull/55)).
- Clear message in partitions that ESP8266 is not supported
- Updated the LittleFS component so audio files show proper icon

## 1.0.8
- Connection Tips asking to put the ESP32 into bootloader mode relies on WebSerial_ESPTool error message : "Couldn't sync to ESP. Try resetting."
- Added Espressif documentation links (HW reference, datasheet, TRM, errata, design guides) to Device Info, with clickable URLs.
- Automatically lower baud to 460,800 when a CH340 USB bridge is detected and notify the user ([issue #47](https://github.com/thelastoutpostworkshop/ESPConnect/issues/47)).
- Fixed the restauration of baud rate after stopping the serial monitor
- Added a pause/resume control to the Serial Monitor to temporarily freeze log output.
- Added more usb bridge information detection
- Added more info from sevetal MCUs (ESP8266, ESP32, ESP32-P4, ESP32-H2, ESP32-C61, ESP32-C5, ESP32-C2 and ESP32-C6)

## 1.0.7
- Switched flashing to use [WebSerial_ESPTool](https://github.com/Jason2866/WebSerial_ESPTool/tree/development) by Jason2866
- Added higher baud rate selection, proposed in ([issue #46](https://github.com/thelastoutpostworkshop/ESPConnect/issues/46)).

## 1.0.6
- Replaced esptool.js for [WebSerial_ESPTool](https://github.com/Jason2866/WebSerial_ESPTool/tree/development) by Jason2866
- LittleFS now supports folder and navigation, proposed in ([issue #31](https://github.com/thelastoutpostworkshop/ESPConnect/issues/31)).
- Fixed Peripherals section under Device Info has overlapping text ([issue #32](https://github.com/thelastoutpostworkshop/ESPConnect/issues/32)).

## 1.0.5
- Added PWM/LEDC capabilities to Device Info with tooltip context; values are based on chip family lookups. Proposed in ([issue #16](https://github.com/thelastoutpostworkshop/ESPConnect/issues/16)).
- Flush serial input before handshake and partition reads to avoid stale data when swapping boards.
- Added a Dockerfile proposed in ([issue #30](https://github.com/thelastoutpostworkshop/ESPConnect/issues/30)).
- Partition map now falls back to parsing the flash size label to show unused space when byte size isn’t available.

## 1.0.4
- Serial monitor now supports filtering output live via a search box ([issue #12](https://github.com/thelastoutpostworkshop/ESPConnect/issues/12)).
- Partition map keeps very small partitions visible with normalized minimum widths ([issue #20](https://github.com/thelastoutpostworkshop/ESPConnect/issues/20)).
- Device info fact cards now use a packed grid layout to remove excessive gaps.

## 1.0.3
- Added a port-busy warning dialog when the serial device is in use, instead of showing bootloader tips.
- Skipping partition table read for ESP8266 (not supported).
- Improved flash size detection and messaging: when detection fails, the UI now shows "Flash size not detected" instead of "Unknown".
- esptool-js is now embedded directly in the ESPConnect codebase, providing tighter integration, better control over the bootloader workflow, and easier maintenance.

## 1.0.2
- Fix LittleFS not detected ([issue #10](https://github.com/thelastoutpostworkshop/ESPConnect/issues/10)). Many thanks to Jason2866 for the PR.
- Add delayed connection progress dialog (shows after 1s during connect) to improve user feedback.

## 1.0.1
- Fix octal flash size detection (map 0x30-0x3F RDID capacity codes when OCTAL feature present).

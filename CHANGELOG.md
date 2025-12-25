# Changelog

## 1.1.2-preview
### Improvement
- Internationalization: Migrated UI translations to the standard Vue I18n + Vuetify integration.
This replaces the previous DOM-based translation shim with a fully reactive, maintainable solution.
- Add reconnect after flashing operations so the ROM has time to finalize
- File systems restore now show the filename in the confirmation dialog
- Append app version + timestamp to every log entry  

### Internal
- Remove unused legacy code that was needed for esptool-js
- CI now zips the built dist/ directory, uploads it, and includes it in release downloads so the static web bundle can be grab directly
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

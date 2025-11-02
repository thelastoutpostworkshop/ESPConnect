# ESPConnect

ESPConnect is a browser-based companion for ESP32-series development boards. It runs entirely in Chrome, Edge, and other Chromium browsers that support the Web Serial API, letting you inspect your device, back up or erase flash contents, and upload new firmware without installing desktop flashing tools.

## What You Need
- A Chromium browser version 89 or newer (Chrome, Edge, Brave, Arc, etc.).  
- An ESP32, ESP32-C3, ESP32-S2, ESP32-S3, or ESP8266 board connected with a USB cable.  
- USB data lines (DTR/RTS) connected if you want automatic boot/reset control—otherwise you can follow on-screen instructions to enter bootloader mode manually.

## Getting Started
1. Open the ESPConnect web app (either the hosted version or a local copy served from `https://` or `http://localhost`).  
2. Click **Connect** and grant permission when the browser asks to access your board.  
3. Once connected, ESPConnect reads your chip’s details and unlocks all available tools. Use the tabs along the top to explore each feature area.

## Firmware Tools at a Glance
- **Flash Firmware:** Choose a `.bin` file, set the target offset if needed, optionally enable “Erase entire flash,” and press **Flash Firmware**. A progress bar tracks the upload, and the device is reset automatically when finished.  
- **Flash Backup & Erase:** Read back custom regions, individual partitions, the full partition table, or only the used areas of flash. Downloads save straight to your computer. You can also trigger a full-chip erase from here.  
- **Flash Integrity (MD5):** Verify regions of flash by supplying an offset and length; ESPConnect computes an MD5 checksum for quick validation.  
- **Register Access:** Read or write hardware registers by address for low-level debugging.

## Other Tabs
- **Device Info:** Summaries of chip family, flash size, MAC address, crystal frequency, USB bridge details, and decoded eFuse metadata.  
- **Partitions:** A visual map of the flash layout plus a detailed table of partition entries. Handy for confirming offsets before flashing or backing up data.  
- **Serial Monitor:** View live UART output from the device, send commands, clear the console, or reset the board without leaving the browser.  
- **Session Log:** A running log of ESPConnect’s actions (handshakes, flashes, downloads) that you can clear at any time.

## Tips & Troubleshooting
- If the connection fails, hold the board’s **BOOT** button, tap **RESET**, keep holding **BOOT**, click **Connect**, and release **BOOT** once the ROM banner appears.  
- Close other serial tools (Arduino IDE, esptool.py, PlatformIO monitor, etc.) before connecting—only one program can own the USB-serial bridge at a time.  
- You can adjust the baud rate after connecting. Some bridges cannot sustain very high rates; if downloads stall, drop back to 460800 or 115200 bps.  
- Cancelling a flash download pauses gracefully; simply start the download again when you’re ready.  
- Web Serial permissions are remembered per site. If you want to revoke access, remove ESPConnect from your browser’s site permissions or unplug and reconnect the board.

## Privacy & Security
USB access is granted solely inside your browser session. ESPConnect does not upload firmware or device data to remote servers; everything stays on your machine unless you choose to share it. Always flash firmware from sources you trust.

## License
ESPConnect is released under the MIT License. See [LICENSE](LICENSE) for the full text.

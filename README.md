[<img src="https://github.com/thelastoutpostworkshop/images/blob/main/ESPConnect-github.png">](https://youtu.be/-nhDKzBxHiI)
# ESPConnect
<a href="https://www.buymeacoffee.com/thelastoutpostworkshop" target="_blank">
<img src="https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png" alt="Buy Me A Coffee">
</a>

ESPConnect is a browser-based control center for ESP32- and ESP8266-class boards. It runs entirely inside a modern Chromium browser so you can inspect hardware details, manage SPIFFS, Fat, LittleFS files, back up flash, and deploy firmware without installing desktop software. It is based on Jason2866's [WebSerial ESPTool](https://github.com/Jason2866/WebSerial_ESPTool/tree/development).
- [Tutorial](https://youtu.be/-nhDKzBxHiI)

## What You Need
- Chrome, Edge, Brave, Arc, or another Chromium browser based on version 89 or newer.  
- An ESP32, ESP32-C3, ESP32-S2, ESP32-S3, ESP32-C6, ESP32-H2, ESP32-C5, ESP32-P4, or ESP8266 board connected over USB.  
- A USB cable with data lines. If your board lacks automatic reset wiring, the app walks you through entering the bootloader manually.

## Quick Start
1. Open [ESPConnect](https://thelastoutpostworkshop.github.io/ESPConnect/).  
2. Click **Connect** and choose your device when the browser asks for permission.  
3. After the handshake completes, the navigation drawer unlocks every tool: Device Info, Partitions, SPIFFS, Apps, Flash, Console, and Logs.  
4. Use **Disconnect** whenever you want to free the USB port for another application.


## Feature Overview

### Device & flash awareness
- **Device Info tab** – live summary of chip family, revision, MAC address, flash size, crystal frequency, capabilities, and curated fact groups. A “No device connected” card appears automatically when nothing is attached.  
- **Partitions tab** – graphical map plus a detailed table of every partition entry, including sizes, offsets, and unused flash so you can double-check layout decisions before flashing.

### File system manager (supports SPIFFS, LittleFS and FATFS)
- Browse the files with instant text filtering, pagination controls.  
- Upload by file picker or drag-and-drop; the app checks available space and blocks oversized files before they transfer.  
- Run full file system backups, restore an image, or format the partition (after confirming you have a backup).  
- Stage edits locally, then push them down with **Save to Flash** once you are satisfied.  
- Preview UTF‑8 text (JSON, HTML, logs, etc.), render images inline, and listen to audio formats such as MP3, WAV, OGG/Opus, AAC/M4A, FLAC, and WebM—all without leaving the browser.  
- Download or delete individual files, and keep an eye on usage gauges that show used, free, and total bytes.

### OTA slot insights
- **Apps tab** – inspect application slots/OTA partitions. See which slot is active along with build metadata, sizes, and other identifying details so you always know what firmware is currently running and what is staged next.

### Flash & maintenance workspace
- **Flash Firmware** – load any `.bin`, pick from common offset presets, optionally erase the entire chip, and watch progress through detailed dialogs.  
- **Backups & downloads** – capture individual partitions, the whole partition table, only the used areas of flash, or arbitrary regions you specify.  
- **Integrity checks** – supply an offset and length to compute MD5 hashes for quick validation of what is stored on the device.  
- **Register access** – read or write hardware registers directly using the integrated guide of addresses and descriptions.  
- **Control actions** – cancel long transfers, stop backups, erase flash, or save staged SPIFFS changes with clear confirmations and progress indicators.

### Live monitoring & history
- **Serial Monitor tab** – stream UART output, send commands (including Ctrl+C), clear the console, change baud rate, or reset the board right from the browser.  
- **Session Log tab** – chronological ledger of connects, flashes, downloads, and warnings. Clear it whenever you want a clean slate.

### NVS Inspector (🧪 Experimental)

ESPConnect includes an **experimental NVS Inspector** that lets you **read and visualize** the contents of an ESP32’s NVS (Non-Volatile Storage) partition directly from the browser.

 What it can do
- Detect NVS format (**v1 / v2**) automatically
- List namespaces and keys
- Decode common value types (integers, strings, blobs)
- Heuristically decode floats and doubles
- Show page state, sequence numbers, CRC status, and entry usage
- Visualize page layout and occupancy

 Limitations
- **Read-only** (no editing or writing)
- Parsing is based on reverse-engineering ESP-IDF behavior and may not handle all edge cases
- Some value types may be shown as raw blobs
- Corrupt or partially erased pages may produce warnings

Status
> ⚠️ This feature is **experimental** and intended for **inspection and debugging only**.  
> Output should not be considered authoritative for recovery or forensic use.

Feedback and test reports are very welcome.

## Stable vs Preview Builds

ESPConnect is published in two variants:

- **Stable (recommended)**  
  👉 https://thelastoutpostworkshop.github.io/ESPConnect/  
  This version is built from tagged releases and is intended for everyday use.

- **Preview (development build)**  
  👉 https://thelastoutpostworkshop.github.io/ESPConnect/preview/  
  This version is automatically built from the `main` branch and may include new fix, features, experiments, or breaking changes. [View current preview changes](CHANGELOG.md)

> ⚠️ The preview build is provided for testing and feedback only.  
> If you encounter issues, please report them along with whether they occurred on **stable** or **preview**.

## Tips & Troubleshooting
- If automatic boot entry fails, hold **BOOT**, tap **RESET**, keep holding **BOOT** while clicking **Connect**, then release when you see the ESP-ROM banner.  
- Only one application can use the USB serial bridge at a time. Close Arduino IDE, PlatformIO, or other tools before connecting.  
- You can change baud rate even after connecting. If transfers stall, drop to 460800 or 115200 bps.  
- Cancelling a flash or download pauses safely. Simply run it again when you’re ready. 
### ESP8266 Compatibility
>ESP8266 devices can connect, but support is very limited.
The tool cannot read partition tables or access SPIFFS/LittleFS, and advanced features available on ESP32 are not implemented for ESP8266.
## Contributing
ESPConnect is open source and contributions are welcome.
If you want to run ESPConnect locally, work on the codebase, or submit a pull request, please see:

➡️ **[CONTRIBUTING.md](./CONTRIBUTING.md)**
That document contains development setup instructions, project conventions, and contribution guidelines.

## Running ESPConnect Locally

ESPConnect is a **pure in-browser web application** — no backend, no installation required, and all operations happen directly in your browser using Web Serial / WebUSB.

### 1. Web application Development Mode (Recommended for Contributors)

```bash
git clone https://github.com/mcuw/ESPConnect.git
cd ESPConnect
pnpm install
pnpm dev
```

```bash
docker build -t espconnect .
docker run --rm -p 8080:80 espconnect
```
### 2. Run the Built Version Locally (Static Server)
Follow instructions in the [latest release](https://github.com/thelastoutpostworkshop/ESPConnect/releases/latest) 

Step 1 — Build the App
```bash
pnpm install
pnpm build
```
Step 2 — Serve the dist/ Folder, you may use any of the following options:
> Option A — Node “serve”
```bash
cd dist
pnpx serve .
```
> Option B — Python 3
```bash
cd dist
python -m http.server 8080
```

## Privacy & Security
ESPConnect runs fully in your browser—there is no backend, account, or telemetry. Firmware files, backups, and diagnostics stay local and only move when you download them yourself. Always flash firmware from trusted sources.

## License
ESPConnect is released under the MIT License. See [LICENSE](LICENSE) for the full text.

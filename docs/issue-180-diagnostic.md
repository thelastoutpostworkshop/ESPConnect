# Issue #180: ESP32-S3 new-stub experiment

Local candidate version: `1.1.25-preview-5`.

Base: `diagnostic/issue-180-flash-read-timeout` at
`a85e0e812e1af7cf96af05bc7daf805dc99cf811` (`1.1.25-preview-4`).

The session log identifies the candidate as
`[FlashRead-Diagnostic] Build=issue-180-s3-new-stub-1.2.2` and logs
`Using official ESP32-S3 esp-flasher-stub v1.2.2 (issue #180 experiment).`
on initial upload and reload. This is an unproven hardware experiment, not a
confirmed fix for #180. No published preview is changed by this local patch.

## Exactly what changes

1. Replace only `tasmota-webserial-esptool/dist/stubs/esp32s3.json` with the
   official **esp-flasher-stub v1.2.2** release asset. Its payload is unmodified;
   patch-package appends a final newline to the JSON. This is the new
   implementation, not the legacy stub's v1.11.x version series. The library stays
   pinned to `7.3.10`; existing P4/S31 compatibility patches and other chips' stubs
   remain unchanged. The JSON's optional NAND plugin is retained for exact asset
   provenance but is not uploaded or enabled by the existing loader.
2. For ESP32-S3 only, replace the error-recovery abort frame `C0 C0` with
   `C0 00 C0`. The new stub deliberately ignores empty SLIP frames. A completed
   one-byte frame is not a four-byte ACK, so its READ_FLASH handler exits and
   emits the final digest. Without this adaptation, the next read command can be
   consumed as the abort, losing that retry. Other chips retain `C0 C0`.
3. Update the diagnostic label and local version to distinguish collected logs.

Read sizes, 64 KB chunks, cumulative ACK encoding, 1024-byte packets, one packet
in flight, 3000 ms flash-data timeout, 65536-byte Web Serial buffer, retry counts,
progress callbacks, connection baud choices, and receive instrumentation remain
unchanged. The 3000 ms timeout is a wait for the next byte, not a deadline for the
entire read. Command-response and startup timeouts remain unchanged.

## Provenance

- Release: https://github.com/espressif/esp-flasher-stub/releases/tag/v1.2.2
- Source commit: `23959b780454adf885916d42f2274ec648e96a94`
- Asset: https://github.com/espressif/esp-flasher-stub/releases/download/v1.2.2/esp32s3.json
- Downloaded asset SHA-256, checked against GitHub's release metadata
  (the asset has no final newline):
  `8816e0611701e8f7396a9fee9d1d33bc2021751bf24bda54560fb87c62de3f0b`
- Installed JSON SHA-256 after patch-package appends the newline:
  `1e9e67c529837f12055a9ea87545919502c6db389b9a671f0f0340620028fea3`
- Decoded text: 7832 bytes, SHA-256
  `c37a7d12d52633fd629fbed13f3a7418216af368d8e80f17853ce6de29741374`
- Decoded data: 264 bytes, SHA-256
  `75be8e20e5c91b2b92cd02be9abe2462436648780e4878ea173598c5ed14df93`
- Entry: `0x40379524`; text start: `0x40378000`; data start: `0x3fcb2dc0`
- Upstream license: Apache-2.0 OR MIT. The unchanged MIT notice is included in
  `public/esp-flasher-stub-LICENSE.txt` and copied into the web build.

Protocol references at the source commit:
[empty-frame handling](https://github.com/espressif/esp-flasher-stub/blob/23959b780454adf885916d42f2274ec648e96a94/src/slip.c#L111-L122),
[READ_FLASH ACK handling](https://github.com/espressif/esp-flasher-stub/blob/23959b780454adf885916d42f2274ec648e96a94/src/command_handler.c#L764-L844).

## Known host limitations deliberately kept separate

The diagnostic logs an unexpected decoded packet size but still ACKs the
received byte count. In particular, 979/1024 bytes can leave the new stub waiting
for the remainder of its cumulative ACK. The timeout/abort/retry test covers
that case, but this candidate does not repair packet validation.

The library still does not explicitly consume or validate the final MD5 before
returning success. A later command usually skips the leftover digest. Stub/parent
shared-buffer flushing and the limited recovery drain are also unchanged;
late or stale bytes can still contaminate recovery. The new abort is a necessary
compatibility adaptation, not a complete recovery or data-integrity fix.

Consequently, count correctly sized first-attempt reads separately from recovered
reads. A completed browser read alone is not proof that the bytes are correct.
These host-protocol issues should be tested in a separate change so this
experiment remains interpretable.

## Local test

1. Apply this patch to the exact base commit. Run `npm ci`, `npm test`,
   `npm run build`, then `npm run preview -- --host localhost`.
   Open `http://localhost:4173` in Chromium. Do not open `index.html` as a file.
   For a prebuilt web archive, extract it and run
   `python3 -m http.server 4173 --bind 127.0.0.1 --directory dist` in the extracted
   folder, then open the same URL. That archive does not require npm.
2. Close native esptool and all other serial tools. Use the same affected
   ESP32-S3, Mac, cable, USB port, and browser version as the prior test.
3. Select **115200 before connecting**. Confirm version **1.1.25-preview-5**, both
   labels above, `Serial opened: baud=115200, bufferSize=65536`, and
   `packetSize=1024, maxInFlight=1` in the log.
4. Repeat disconnect/connect three times. Record partition-table load, LittleFS
   probes, file listing, and file reading separately, including retries/recovery.
5. Read/save the same 64 KB ranges at `0x810000` and `0x820000`. Save full logs
   even on success; keep any `Unexpected data packet size`, timeout, and serial
   error lines. Do not erase, flash, format, or save filesystem edits for this
   diagnostic comparison.
6. Disconnect ESPConnect. With the flash contents unchanged, use the same native
   esptool environment and port as the successful comparison:

   ```sh
   python -m esptool --chip esp32s3 --port /dev/cu.usbmodem1101 --baud 115200 read-flash 0x810000 0x10000 native-810000-64k.bin
   python -m esptool --chip esp32s3 --port /dev/cu.usbmodem1101 --baud 115200 read-flash 0x820000 0x10000 native-820000-64k.bin
   ```

   Substitute the actual port and browser output filenames. Check file lengths
   (65536 bytes each), then compare each pair with `cmp` or `shasum -a 256`.
   Keep raw flash dumps local; logs and comparison results are sufficient.

## Automated coverage and limits

`tests/s3-new-stub.test.ts` verifies the official asset hash, exact decoded
segments, upload entry and parent-delegated reload, S3-only nonempty abort,
consecutive reads/chunk boundaries, the 979-byte short-ACK stall, successful
recovery, and bounded failure after the existing retry budget. Its stateful
serial model ignores empty frames and prevents a retry from succeeding while
the prior stream is active. Existing diagnostic and P4/S31 tests remain enabled.

The serial model, mocked USB I/O, and mock E2E suite cannot execute the Xtensa
binary or reproduce the affected Mac's USB behavior. No physical-device,
flash-write/erase, throughput, or native-USB recovery validation has been done.

# Issue #180: isolated chunk-reader diagnostic

Candidate version: `1.1.25-preview-6`.
Base: `diagnostic/issue-180-flash-read-timeout` at
`9fad3759fdfc9cf8860d61ed2e300b9e7a331bdf` (preview5).
Diagnostic URL: `http://localhost:4173/?flashReadDiagnostic=1`.
Log label: `Build=issue-180-chunk-reader-v1`.

This is a local, read-only diagnostic candidate. It has not been pushed,
deployed, or validated on the affected ESP32-S3/Mac.

## What this comparison tests

The new page exclusively owns one Web Serial reader and one persistent writer.
The normal ESPConnect root is not imported or mounted in this mode, so it cannot
run auto-probes, a console reader, partition scanning, or filesystem decoding.

The independent event-driven pump reads native `Uint8Array` chunks. It replaces
both the library receive loop (`Array.from` / `push.apply` into `_inputBuffer`)
and its per-byte `Array.shift` / polling packet reader. SLIP escapes and frame
boundaries are decoded synchronously across chunks; there is no per-byte sleep.
Writes use the same SLIP encoding and command/ACK order, with one awaited,
serialized persistent writer and no added pacing or write coalescing. Therefore
this tests an alternate host transport, not just a parser replacement.

ROM reset, chip detection, register operations, RAM upload, and flash-ID detection
reuse the pinned library's command implementations. The startup hooks explicitly
reset the independent queue before each ROM synchronization attempt; boot noise
is allowed only during startup. `runStub(true)` avoids invoking the newly created
stub loader before its receive/write hooks are installed. Flash-ID detection then
uses the same owned transport. Only ESP32-S3 is accepted before stub upload.
No baud change or optional post-connection security metadata request is made.
No legacy input reader runs at any point in this diagnostic.

After startup, strict mode prohibits buffer flushing, resynchronization, and
silently skipping unexpected frames. Each run closes its session before another
case can start. There is no handoff back to the normal application; reopen the
normal URL for ordinary use, then establish a fresh connection.

## Settings held constant

- Official ESP32-S3 esp-flasher-stub **v1.2.2**, unchanged from preview5
- `tasmota-webserial-esptool` **7.3.10** and its existing patch, unchanged
- Baud **115200**, Web Serial `bufferSize=65536`
- READ_FLASH packet size **1024**, maximum unacknowledged packets **1**
- Flash-data/MD5 idle timeout **3000 ms**, reset by incoming raw bytes
- Existing ROM/stub startup command deadlines and reset strategy order

MD5 verification, strict framing checks, and stop-on-first-failure are deliberate
changes. This experiment does not isolate checksum handling from receive-loop
behavior by itself. Interpret first-attempt raw ingress and valid data separately
from the new integrity checks.

## The three cases

Each Start opens a fresh port session, resets into ROM, and uploads the S3 stub.
All cases stop on their first error; there are no automatic flash-read retries.

- **A:** read 1024 bytes at `0x8000`, verify its trailing MD5, then disconnect.
- **B:** read 32 bytes at `0x8000`, consume and verify its MD5, then read 1024 bytes
  at `0x8000`, consume and verify its MD5, then disconnect.
- **C:** read 65536 bytes at `0x810000`; stop before ACKing the first invalid
  packet. If all 64 packets are valid, verify the exact total and trailing MD5,
  then disconnect.

The reader requires the exact READ_FLASH response header and status, then checks
`min(1024, remaining bytes)` for every decoded data frame before acknowledging
its cumulative little-endian byte count. Only after the final valid data ACK does
it consume exactly 16 digest bytes. It compares that digest with locally computed
MD5 over exactly the requested bytes. It never ACKs a digest or emits a partial
success. Unexpected pending frames prevent the next read.

On receive/protocol failure, the runner attempts one `C0 00 C0` abort and closes
its session. The new stub ignores empty `C0 C0`. An abort may emit a prefix digest;
it is not treated as success, drained for reuse, or passed to another operation.
Cancellation closes the owned session and requires a fresh connection. No flash
contents, files, or packet payloads are exported or uploaded; only sizes, timing,
status and verified hashes appear in the local report.

## Why MD5 leftovers are not the whole explanation

Preview5's repeated 32-byte-then-1024-byte failures and leftover digest motivate
case B. Failures also occurred after a clean stub reload with an empty buffer,
so leftover MD5 cannot explain all observed failures. Case A bypasses the
preceding small read; case C examines a longer fresh transfer.

The v1.2.2 stub increments its acknowledged-packet count for any four-byte ACK.
A short cumulative byte count can allow more packets to advance, then leave the
final byte-count wait incomplete. It does **not** necessarily cause an immediate
stall on the next packet. This diagnostic rejects the invalid packet before
sending such an ACK.

## Local metadata

Raw chunk length, wall-clock timestamp, monotonic elapsed time, and page visibility
are recorded before SLIP decoding. Per-read snapshots separate command-local
received-byte/chunk counts, completed frames, queued bytes, partial decoded bytes
and escape state from the earlier ROM/upload traffic. First-failure state is
preserved before cleanup clears buffers.

The trace is bounded, metadata-only, and retained in memory during reception.
It is emitted to the page after the operation settles, avoiding synchronous
per-chunk UI rendering. A dropped-entry count discloses if the trace limit was
reached. The UI records visibility transitions and browser/USB metadata locally.
The report download is a text Blob; there is no upload endpoint or telemetry.

## Run it

### From the prebuilt ZIP

Extract the archive, open a terminal in the extracted folder, and run:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

Open `http://localhost:4173/?flashReadDiagnostic=1` in the same Chromium browser
as the prior tests. Do not open `index.html` directly as a file. Close native
esptool, the normal ESPConnect page, serial monitors, and other serial apps first.

### From source

Apply the accompanying patch to a clean checkout of the exact base above:

```sh
git apply --check /path/to/ESPConnect-preview-6-chunk-reader.patch
git apply /path/to/ESPConnect-preview-6-chunk-reader.patch
npm ci
npm test
npm run build
npm run preview -- --host localhost
```

1. Keep the same board, cable, USB port, browser and visible foreground page.
2. Select A and Start; choose the ESP32-S3. Wait for completion or first failure.
3. Save the local report. Repeat for B and C, each with its own fresh session.
4. If useful, repeat each case three times. Keep failed reports too. Record
   physical unplug/replug, browser changes, or foreground/background changes.
5. Do not erase, flash, format, or save filesystem edits during this comparison.
6. On a cleanup error, close serial applications and unplug/replug the device
   before retrying. Do not start a second session while cancellation is pending.

A successful result must say the read was verified, with exact length and MD5.
A failure should identify command response, data, digest or transport stage,
raw ingress counts and the first divergent packet/state. The raw metadata can
show where host-visible delivery stops, but cannot alone prove why the device,
USB stack or browser stopped delivering bytes.

## Validation boundaries

Automated coverage includes independent SLIP decoding, MD5 reference vectors,
packet/response/digest rejection, ACK ordering, cases A/B/C, cancellation and lock
cleanup, and a real library ROM/stub startup bridge driven by scripted serial
responses. The script tests actual stub upload selection and returned-loader
hooks, while USB and the chip remain simulated.

The normal app retains its existing reader and behavior. New UI E2E tests cover
route isolation, cancellation and report download, but require a browser-capable
test environment. Unit tests and builds do not execute the Xtensa stub, measure
USB timing, or establish that the issue is fixed on hardware.

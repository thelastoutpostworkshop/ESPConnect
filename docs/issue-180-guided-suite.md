# Issue #180 guided flash-read suite

Local implementation based on preview-6, commit
`51bed8beeb8ef0737c80f5bdf2b7f87671959411`, on
`diagnostic/issue-180-flash-read-timeout`. Report schema/build label:
`issue-180-flash-read-suite-v2`. The package version remains preview-6; identify
this candidate by the suite page and report schema. Nothing is published by this
change.

## Run one guided session

1. Run `npm ci`, `npm run build`, then `npm run preview -- --host localhost`.
   Open `http://localhost:4173/?flashReadDiagnostic=1` in a Web Serial browser.
   The ordinary URL continues to load the normal app. Close other serial tools.
2. Keep the same ESP32-S3, USB port, cable, browser, visible page and unchanged
   flash contents throughout the comparison. The requested range requires more
   than 8 MiB of flash. Unsupported ranges are explicitly skipped after flash-ID
   detection; they are never counted as passes.
3. Choose **Choose port and begin suite**. One chooser starts the compact plan.
   Successful trials automatically continue, each with a new port open, reset,
   ROM verification, RAM stub upload, read and close. Flash is never written or
   erased. Uploading the stub uses RAM commands.
4. On failure or cancellation, wait for owned cleanup. Reconnect the same board;
   use BOOT/reset if required to enter download mode. Confirm the recovery prompt,
   then resume and choose the port again. Resume advances to the next pending
   trial and preserves the failed case; it does not retry a contaminated stream.
   **Skip next pending trial** records a skip. **Reset suite** clears the checkpoint
   and local frame/reference captures.
5. Download the single JSON report at any time after activity starts, including
   during a partial run. The tab's session storage checkpoints metadata across
   reloads. A reload marks an active trial interrupted and requires recovery.
   Closing the tab can discard session storage; download before doing so.

Browser port choosers cannot be programmatically dismissed. Cancellation waits
for a late chooser result and never opens that result. A browser `open()` or
reset/control-signal promise that never settles can also delay cancellation;
the UI stays locked rather than claiming teardown completed. USB re-enumeration
and BOOT recovery are hardware-dependent and have not been proven unattended.

## Controlled plan and budget

All trials use stub 1.2.2, baud 115200, a 65,536-byte serial buffer, one packet in
flight, a 3,000 ms incoming-byte idle timeout, and strict frame/digest checks.
The page displays the exact range, settings and status for every trial.

| Comparison | Range/settings | Repeats |
| --- | --- | --- |
| Target alone | `0x810800`, 1 KiB, packet 1024, immediate ACK | 3 |
| Target second | `0x810400`, 2 KiB, packet 1024, immediate ACK | 3 |
| Target third / length 3 KiB | `0x810000`, 3 KiB, packet 1024, immediate ACK | 3 |
| Length | `0x810000`, 1, 8, 64 KiB, packet 1024 | 1 each |
| Packet size | `0x810000`, 8 KiB, packet 256 / 512; compare with 1024 above | 1 each |
| ACK spacing | `0x810000`, 3 KiB, packet 1024, requested ACK delay 5 ms | 1 |

This is 15 trials, 110 KiB and 142 data packets, not a Cartesian sweep. The first
target-alone trial can supply an exact checksum-verified local reference.
ACK delay changes inter-packet spacing, not intra-packet transmission pacing.

Initial budget is approximately three minutes: roughly 10–20 seconds of
illustrative UART wire time plus a provisional 10 seconds per fresh startup.
Native USB timing is not determined by the selected UART baud. Actual trial,
chunk, frame and ACK times are reported. Manual recovery can add unbounded time;
the estimate is planning guidance, not a deadline or promise.

The pinned [stub READ_FLASH implementation](https://github.com/espressif/esp-flasher-stub/blob/23959b780454adf885916d42f2274ec648e96a94/src/command_handler.c#L705-L777)
supports packets up to 4096 bytes but hardcodes `max_unacked_packets = 1`,
regardless of the command window field. Any four-byte ACK advances accounting.
No ineffective window sweep is included. A nonempty short ACK aborts and emits
an untrusted prefix digest; [empty SLIP frames are ignored](https://github.com/espressif/esp-flasher-stub/blob/23959b780454adf885916d42f2274ec648e96a94/src/slip.c#L105-L113).

## Recovery and interpretation

Every independent trial requires a ROM-valued SYNC (`0x20120707`), verifies S3,
uploads the pinned RAM stub, and verifies the fresh OHAI response. This matters
because [the library's ordinary SYNC implementation](https://github.com/Jason2866/WebSerial_ESPTool/blob/v7.3.10/src/esp_loader.ts#L1428-L1458)
ignores the response value and can accept a surviving stub. A port reopen or a
buffer clear alone is not proof of recovery. Failure closes the transport and
port; no later trial is sent until explicit recovery. A failed close is reported
and cannot produce a pass. Startup reset strategies may retry ROM synchronization;
flash reads themselves have no retries.

Only exact data lengths, the requested total, final MD5 and successful cleanup
produce a pass. Prefix packets in an aborted transfer have length checks only.
The report distinguishes failed, cancelled, interrupted, skipped and pending
trials. All-skipped or partial reports never claim all trials passed.

Bart's supplied preview-6 observation was a completed 985-byte third data frame
where 1024 bytes were expected, a **39-byte length deficit**, after two packets
that passed length checks only. Browser chunks of 411 + 512 + 64 bytes included
the two delimiters. No pending/partial/discarded/dropped trace data was reported.
This is not evidence of a timeout, contiguous deletion, or a macOS-exclusive
cause. A/B used another address, so their success does not isolate length alone.
Prior successful Python reads are useful context; exact stub and packet parity
remain unverified.

## Evidence and privacy

Reports and checkpoints use an explicit recursive metadata projection. They
contain no flash payload, serial number, MAC address, efuse values or startup
logger output. Unknown fields and external error text are excluded. Safe
environment fields are app/schema version, browser user agent/platform,
visibility and USB VID/PID. Each trial records settings, status, capacity, ROM
verification, length/checksum result, pre-abort snapshot, actual ACK dispatch and
completion times, and bounded chunk/frame metadata. Packet receipt time in ACK
records is when the strict reader receives the decoded packet; raw chunk/frame
receipt times are independently recorded relative to transport startup.

Structured caps per trial are 2,048 chunks, 1,024 frames, 256 ACKs, and 4,096 text
trace entries. Lost metadata is counted explicitly. The first eligible failed data frame is
kept only in local memory (at most 8,194 raw / 4,096 decoded bytes plus 256 chunk
spans), together with at most one verified 1 KiB reference for `0x810800`.
A timeout with no current frame cannot substitute an earlier successful packet.
Analysis context records its trial start time and exact range, since an earlier
startup failure can precede the first captured data frame.

An independent decoder replays that same captured input with actual chunk spans
and six synthetic split patterns. An exact-range, same-port, MD5-verified small
read enables hashes, lengths, common prefix/suffix lengths and bounded differing
offset ranges. Different range, missing reference, truncated capture or lost
chunk spans produce explicit rejected/unavailable results. These comparisons
cannot establish where bytes were lost before browser delivery. Browser chunk
boundaries are not USB packet boundaries. Raw bytes disappear on reset/reload;
payload-free comparison findings can remain in the checkpoint/report. Keep the
same board and flash contents: port identity cannot prove physical board identity
across every driver reconnect.

## Validation boundaries

Automated tests cover fragmentation and escape handling, offline replay against
the production decoder, length/digest rejection, packet settings, ACK delays and
failed ACK completion, ROM-versus-stale-stub rejection, cancellation during open,
read and cleanup, reconnect, repeated start, failed close, capacity skips,
checkpoint validation/privacy, partial downloads and normal-root isolation.
The existing transcript test exercises the real ROM/stub bridge with simulated
serial responses. Windows patch files are kept LF by `.gitattributes` so
patch-package reproduces the official JSON asset hash without CRLF conversion;
the decoded stub payload is unchanged.

Unit, type and build checks and mocked UI E2E do not execute the Xtensa stub or
reproduce physical USB behavior. Hardware timing, USB recovery, native Python
parity and the affected device/browser comparison remain unrun.

Local verification on 2026-10-15:

- `npm test -- --maxWorkers=1`: 26 files, 290 tests passed.
- `npm run build`: TypeScript check and production build passed.
- `npm run test:e2e -- --workers=1`: 23 mocked UI tests passed, including eight
  suite tests and the existing normal-app scenarios; ready/recovery screenshots
  were visually inspected.
- `git diff --check` passed. Normal app entry/client files, dependency versions,
  lockfile and decoded stub payload were unchanged.

The Windows sandbox prevented some Vitest temporary modules from loading and
stalled the first browser-server startup; the successful complete runs used the
approved host execution path. Build output retains its existing large-chunk
warning; development UI tests emit expected English i18n fallback warnings.

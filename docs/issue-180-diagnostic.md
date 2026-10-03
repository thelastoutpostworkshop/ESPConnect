# Issue #180 diagnostic build

Branch: `diagnostic/issue-180-flash-read-timeout`

The session log identifies this build as `[FlashRead-Diagnostic] Build=issue-180-timeout-3s`.
It changes only the timeout used while receiving flash data packets, from 100 ms
to 3000 ms, and adds English session logs even when verbose serial logging is off.
The timeout is a wait for the next byte, not a deadline for the entire read.
Command response and stub startup timeouts retain their original values.

Logs include the selected connection baud, loader baud, USB IDs, address, read
size, packet size/window, attempt number, transaction stage, bytes in completed
packets, buffered receive byte count, elapsed time, and original errors. Attempts
count read commands across retries, recovery, and chunks within one read request.
Bytes from an incomplete SLIP packet are not included in `received`; the original
error distinguishes a header timeout from a content timeout. No flash contents
or filenames are dumped by this instrumentation.

The original ACKs, MD5 handling, buffer flushing, retry limits, recovery, and
progress callbacks remain unchanged to isolate the timeout experiment. A
successful return does not add checksum verification. Longer timeouts also mean
an unsuccessful operation can take longer to exhaust its retries.

## Reporter test

1. Serve the built `dist` directory at `http://localhost` on the Mac, or deploy it
   to a separate HTTPS diagnostic URL. Do not open `index.html` as a local file.
   From this branch, `npm ci`, `npm run build`, and `npm run preview -- --host localhost`
   will serve it locally. The preview URL is normally
   `http://localhost:4173`.
   If using the downloadable web archive, extract it, open a terminal in the
   extracted folder, and run `python3 -m http.server 4173 --bind 127.0.0.1 --directory dist`,
   then open `http://localhost:4173`. This archive does not
   require npm or a repository checkout.
2. Use the same ESP32-S3 and USB connection. Close native esptool before testing.
3. Select **115200 before connecting**. Confirm the diagnostic marker and selected
   baud are present in the session log.
4. Repeat disconnect/connect five times. Record whether the partition table loads
   without retries, with retries, or fails.
5. Open LittleFS and try listing and reading files. Save the complete session log,
   including any read that succeeds after recovery.
6. Return the browser/OS versions, success count, and full log, even if the test
   succeeds. Retest at 921600 only after completing the 115200 comparison.

This experiment needs validation on the affected Mac. Simulated serial tests and
the mock E2E suite cannot establish whether it fixes the native USB timing issue.

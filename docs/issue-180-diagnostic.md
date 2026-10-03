# Issue #180 diagnostic build

Branch: `diagnostic/issue-180-flash-read-timeout`

Version: `1.1.25-preview-2`

The session log identifies this build as `[FlashRead-Diagnostic] Build=issue-180-buffer-64k`.
It explicitly sets the Web Serial buffer to 65536 bytes on initial connection,
baud changes, and deep recovery. The previous diagnostic's 3000 ms flash data
timeout remains in place. This timeout is a wait for the next byte, not a deadline
for the entire read. Command response and stub startup timeouts retain their
original values. English diagnostic session logs appear even with verbose serial
logging off.

The previous build (`1.1.25-preview-1`, `issue-180-timeout-3s`) failed the partition
read in all five reporter attempts. Some failures included short decoded packets;
fresh recovery attempts also failed with an empty receive buffer. This build tests
larger browser buffering and observes receive errors; it is not a confirmed fix.

Logs include the selected connection baud, loader baud, USB IDs, address, read
size, packet size/window, attempt number, transaction stage, bytes in completed
packets, buffered receive byte count, elapsed time, and original errors. Attempts
count read commands across retries, recovery, and chunks within one read request.
Bytes from an incomplete SLIP packet are not included in `received`; the original
error distinguishes a header timeout from a content timeout. No flash contents
or filenames are dumped by this instrumentation.

Additional logs record every port open's baud and buffer size, reader acquisition,
reader termination (including normal cancellation), and the name/message of
underlying stream errors before the library suppresses them. Receive counters
remain cumulative across port reopens. In read-command and packet-failure logs,
`rxBytes`, `rxChunks`, and `rxErrors` are differences since that command began;
in successful return logs they cover the entire read request. These count browser
stream reads, including framing and command responses, rather than decoded flash
payload bytes. `recentRxChunkSizes` contains up to eight most recent nonempty
browser chunks across the connection. No log entry is emitted for each chunk.
An unexpected decoded data packet size is logged without changing its ACK or
rejecting it. `received=0` can coexist with nonzero `rxBytes` when no complete
data packet was decoded.

The original ACKs, MD5 handling, buffer flushing, retry limits, recovery, and
progress callbacks remain unchanged to isolate the buffer-size experiment. A
successful return does not add checksum verification. Longer timeouts also mean
an unsuccessful operation can take longer to exhaust its retries.

## Reporter test

1. Serve the built `dist` directory at `http://localhost` on the Mac, or deploy it
   to the HTTPS [preview URL](https://thelastoutpostworkshop.github.io/ESPConnect/preview/).
   Do not open `index.html` as a local file.
   From this branch, `npm ci`, `npm run build`, and `npm run preview -- --host localhost`
   will serve it locally. The preview URL is normally
   `http://localhost:4173`.
   If using the downloadable web archive, extract it, open a terminal in the
   extracted folder, and run `python3 -m http.server 4173 --bind 127.0.0.1 --directory dist`,
   then open `http://localhost:4173`. This archive does not
   require npm or a repository checkout.
2. Use the same ESP32-S3 and USB connection. Close native esptool before testing.
3. Refresh the preview and verify version **1.1.25-preview-2**. Select **115200
   before connecting**. Confirm `Build=issue-180-buffer-64k`, the selected baud,
   and `Serial opened: baud=115200, bufferSize=65536` in the session log.
4. Repeat disconnect/connect five times. Record whether the partition table loads
   without retries, with retries, or fails.
5. Open LittleFS and try listing and reading files. Save the complete session log,
   including any read that succeeds after recovery.
6. Return the success count and full log, even if the test succeeds. If a read
   fails, include any `Serial read error` and `Unexpected data packet size` lines
   and the receive counters. No additional baud-rate comparison is needed yet.

This experiment needs validation on the affected Mac. Simulated serial tests and
the mock E2E suite cannot establish whether it fixes the native USB timing issue.

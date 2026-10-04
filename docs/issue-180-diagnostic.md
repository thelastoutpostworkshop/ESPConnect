# Issue #180 diagnostic build

Branch: `diagnostic/issue-180-flash-read-timeout`

Version: `1.1.25-preview-4`

The session log identifies this build as `[FlashRead-Diagnostic] Build=issue-180-packet-1k`.
Compared with preview-3, it changes only the READ_FLASH data packet size from
4096 to 1024 bytes, including retries and reads after deep recovery. The transfer
window remains one unacknowledged packet, and total read sizes and 64 KB chunk
boundaries remain unchanged. A 64 KB chunk now uses 64 data packets and cumulative
acknowledgements. Shorter final packets remain valid when the read size is not a
multiple of 1024. This may reduce read throughput.

The previous diagnostic's 65536-byte Web Serial buffer remains in place on
initial connection, baud changes, and deep recovery, together with the 3000 ms
flash data timeout and receive instrumentation. This timeout is a wait for the
next byte, not a deadline for the entire read. Command response and stub startup
timeouts retain their original values. English diagnostic session logs appear
even with verbose serial logging off.

The timeout-only build (`1.1.25-preview-1`) failed the partition read in all five
reporter attempts. Preview-2 and preview-3 loaded the partition table in all three
attempts each, but filesystem access still failed. With preview-3's one-packet
window, all initial LittleFS probes failed; two later 64 KB reads at 0x810000
succeeded before the next chunk at 0x820000 failed. Some failures occurred before
the first 4096-byte packet completed, without reported serial read errors. This
build tests whether using the consistently successful 1024-byte packet size also
improves larger filesystem transfers; it is not a confirmed fix.

Logs include the selected connection baud, loader baud, USB IDs, address, read
size, packet size/window, attempt number, transaction stage, bytes in completed
packets, buffered receive byte count, elapsed time, and original errors. Attempts
count read commands across retries, recovery, and chunks within one read request.
Bytes from an incomplete SLIP packet are not included in `received`; the original
error distinguishes a header timeout from a content timeout. No flash contents
or filenames are dumped by this instrumentation.
Read-command logs report the effective `packetSize=1024, maxInFlight=1` and the
upstream values as `upstreamPacketSize=4096, upstreamMaxInFlight=1024`.

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
progress callbacks remain unchanged to isolate the packet-size experiment. A
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
3. Refresh the preview and verify version **1.1.25-preview-4**. Select **115200
   before connecting**. Confirm `Build=issue-180-packet-1k`, the selected baud,
   `Serial opened: baud=115200, bufferSize=65536`, and
   `packetSize=1024, maxInFlight=1` in the session log.
4. Repeat disconnect/connect three times. Record whether the partition table loads
   without retries, with retries, or fails.
5. Open LittleFS and try listing and reading files on every connection. Report
   probe, file-listing, and file-reading success separately. Save the complete
   session log, including any read that succeeds after recovery.
6. Return the success count and full log, even if the test succeeds. If a read
   fails, include any `Serial read error` and `Unexpected data packet size` lines
   and the receive counters. Keep the browser version the same as the previous
   test if possible; otherwise report the new version. No additional baud-rate
   comparison is needed yet.

## Native 64 KB comparison

After disconnecting ESPConnect, use the same native esptool environment and USB
connection as the earlier tests. Read 65536 bytes at each failing filesystem
address and return the command output for both reads. Update the port path if it
has changed. These commands save flash contents to local files, following the
[esptool read-flash syntax](https://docs.espressif.com/projects/esptool/en/latest/esp32/esptool/basic-commands.html#read-flash-contents-read-flash).

```sh
python -m esptool --chip esp32s3 --port /dev/cu.usbmodem1101 --baud 115200 read-flash 0x810000 0x10000 native-810000-64k.bin
python -m esptool --chip esp32s3 --port /dev/cu.usbmodem1101 --baud 115200 read-flash 0x820000 0x10000 native-820000-64k.bin
```

This verifies the exact addresses and transfer sizes that still fail in the
browser, rather than the earlier 1024/4096-byte reads at 0x8000.

This experiment needs validation on the affected Mac. Simulated serial tests and
the mock E2E suite cannot establish whether it fixes the native USB timing issue.

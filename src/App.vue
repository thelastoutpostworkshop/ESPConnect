<template>
  <v-app>
    <v-main>
      <v-container class="py-10" max-width="1100">
        <v-card elevation="8" class="pa-6">
          <v-card-title class="d-flex align-center pa-0 mb-2">
            <div class="text-h5 font-weight-semibold">ESPConnect</div>
            <v-spacer />
            <v-btn
              :title="`Switch to ${isDarkTheme ? 'light' : 'dark'} theme`"
              variant="text"
              icon
              color="primary"
              size="small"
              @click="toggleTheme"
            >
              <v-icon>{{ themeIcon }}</v-icon>
            </v-btn>
          </v-card-title>

          <v-system-bar class="status-bar mb-4" color="primary" :height="64" dark window>
            <div class="status-actions">
              <v-btn
                :class="['status-button', { 'status-button--active': !connected && !busy }]"
                color="primary"
                variant="outlined"
                density="comfortable"
                :disabled="!serialSupported || connected || busy"
                @click="connect"
              >
                <v-icon start>mdi-usb-flash-drive</v-icon>
                Connect
              </v-btn>
              <v-btn
                :class="['status-button', { 'status-button--active': connected }]"
                color="error"
                variant="outlined"
                density="comfortable"
                :disabled="!connected || busy"
                @click="disconnect"
              >
                <v-icon start>mdi-close-circle</v-icon>
                Disconnect
              </v-btn>
              <v-select
                v-model="selectedBaud"
                :items="baudrateOptions"
                label="Baud rate"
                density="compact"
                variant="outlined"
                hide-details
                class="status-select"
                :disabled="busy"
              />
            </div>
            <v-spacer />
            <v-chip
              :color="connected ? 'success' : 'grey-darken-1'"
              class="text-capitalize"
              variant="elevated"
              density="comfortable"
            >
              <template #prepend>
                <v-icon v-if="connected">mdi-usb-port</v-icon>
                <v-avatar
                  v-else
                  size="22"
                  class="status-logo-avatar"
                >
                  <v-img :src="disconnectedLogo" alt="Disconnected status logo" />
                </v-avatar>
              </template>
              {{ connectionChipLabel }}
            </v-chip>
          </v-system-bar>

          <v-alert
            v-if="!serialSupported"
            type="error"
            class="mb-4"
            variant="tonal"
            icon="mdi-alert-circle-outline"
          >
            This browser does not support the Web Serial API. Use Chrome, Edge, or another Chromium-based browser.
          </v-alert>

          <v-divider class="my-4" />

          <v-tabs v-model="activeTab" class="mb-4" color="primary" grow>
            <v-tab value="info">Device Info</v-tab>
            <v-tab value="partitions">Partitions</v-tab>
            <v-tab value="flash">Flash Firmware</v-tab>
            <v-tab value="log">Session Log</v-tab>
          </v-tabs>

          <v-window v-model="activeTab">
            <v-window-item value="info">
              <DeviceInfoTab
                :chip-details="chipDetails"
              />
            </v-window-item>

            <v-window-item value="partitions">
              <PartitionsTab
                :partition-segments="partitionSegments"
                :formatted-partitions="formattedPartitions"
                :unused-summary="unusedFlashSummary"
              />
            </v-window-item>

            <v-window-item value="flash">
              <FlashFirmwareTab
                v-model:flash-offset="flashOffset"
                v-model:selected-preset="selectedPreset"
                v-model:erase-flash="eraseFlash"
                :offset-presets="offsetPresets"
                :busy="busy"
                :can-flash="canFlash"
                :flash-in-progress="flashInProgress"
                :flash-progress="flashProgress"
                @firmware-input="handleFirmwareInput"
                @flash="flashFirmware"
                @apply-preset="applyOffsetPreset"
              />
              <SpiffsAgentCard
                class="mt-6"
                :connected="connected"
                :stub-available="spiffsAgent.available"
                :running="spiffsAgent.running"
                :busy="spiffsAgent.busy || busy"
                :uploading="spiffsAgent.uploading"
                :status="spiffsAgent.status"
                :error="spiffsAgent.error"
                :files="spiffsAgent.files"
                :preview="spiffsAgent.preview"
                @upload-agent="uploadSpiffsAgent"
                @list-files="listSpiffsFiles"
                @read-file="handleSpiffsRead"
                @delete-file="handleSpiffsDelete"
                @upload-file="handleSpiffsUpload"
                @format="formatSpiffs"
                @reset-agent="resetSpiffsDevice"
                @close-preview="closeSpiffsPreview"
              />
            </v-window-item>

            <v-window-item value="log">
              <SessionLogTab
                :log-text="logText"
                @clear-log="clearLog"
              />
            </v-window-item>
          </v-window>
        </v-card>

        <v-dialog v-model="showBootDialog" width="420">
          <v-card>
            <v-card-title class="text-h6">
              <v-icon start color="warning">mdi-alert-circle-outline</v-icon>
              Connection Tips
            </v-card-title>
            <v-card-text>
              <p class="text-body-2">
                We couldn't communicate with the board. Try putting your ESP32 into bootloader mode:
              </p>
              <ol class="text-body-2 ps-4">
                <li>Hold the <strong>BOOT</strong> (GPIO0) button.</li>
                <li>Tap <strong>RESET</strong>, then release it.</li>
                <li>Release the BOOT button after one second.</li>
                <li>Click <strong>Connect</strong> again.</li>
              </ol>
              <p class="text-caption text-medium-emphasis" v-if="lastErrorMessage">
                Last error: {{ lastErrorMessage }}
              </p>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn color="primary" variant="text" @click="showBootDialog = false">
                Got it
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { ESPLoader, Transport } from 'esptool-js';
import { useTheme } from 'vuetify';
import disconnectedLogo from './assets/disconnected-logo.svg';
import DeviceInfoTab from './components/DeviceInfoTab.vue';
import FlashFirmwareTab from './components/FlashFirmwareTab.vue';
import PartitionsTab from './components/PartitionsTab.vue';
import SessionLogTab from './components/SessionLogTab.vue';
import SpiffsAgentCard from './components/SpiffsAgentCard.vue';
import { getDecodedSpiffsStub } from './spiffs-agent';

const SUPPORTED_VENDORS = [
  { usbVendorId: 0x303a },
  { usbVendorId: 0x1a86 },
  { usbVendorId: 0x10c4 },
  { usbVendorId: 0x0403 },
];

const DEFAULT_ROM_BAUD = 115200;
const DEBUG_SERIAL = false;

const PACKAGE_LABELS = {
  ESP32: pkgVersion =>
    ({
      0: 'ESP32-D0WDQ6',
      1: 'ESP32-D0WD',
      2: 'ESP32-D2WD',
      4: 'ESP32-U4WDH',
      5: 'ESP32-PICO-D4',
      6: 'ESP32-PICO-V3-02',
    }[pkgVersion] ?? null),
  'ESP32-C3': pkgVersion =>
    ({
      0: 'ESP32-C3 (QFN32)',
      1: 'ESP8685 (QFN28)',
      2: 'ESP32-C3 (AZ QFN32)',
      3: 'ESP8686 (QFN24)',
    }[pkgVersion] ?? null),
  'ESP32-S3': pkgVersion =>
    ({
      0: 'ESP32-S3 (QFN56)',
      1: 'ESP32-S3-PICO-1 (LGA56)',
    }[pkgVersion] ?? null),
  'ESP32-S2': pkgVersion =>
    ({
      0: 'ESP32-S2',
      1: 'ESP32-S2FH2',
      2: 'ESP32-S2FH4',
    }[pkgVersion] ?? null),
};

const ECO_LABELS = {
  0: 'ECO0',
  1: 'ECO1',
  2: 'ECO2',
  3: 'ECO3',
};

const EMBEDDED_FLASH_CAPACITY = {
  'ESP32-C3': {
    1: '4MB',
    2: '2MB',
    3: '1MB',
    4: '8MB',
  },
  'ESP32-S3': {
    1: '8MB',
    2: '4MB',
  },
  'ESP32-S2': {
    1: '2MB',
    2: '4MB',
  },
};

const EMBEDDED_PSRAM_CAPACITY = {
  'ESP32-S3': {
    1: '8MB',
    2: '2MB',
  },
  'ESP32-S2': {
    1: '2MB',
    2: '4MB',
  },
};

const JEDEC_MANUFACTURERS = {
  0x01: 'Spansion / Cypress',
  0x04: 'Fujitsu',
  0x1c: 'Eon / Puya',
  0x20: 'Micron / Numonyx',
  0x37: 'AMIC',
  0x40: 'Zbit Semiconductor',
  0x41: 'Intel',
  0x45: 'XMC',
  0x62: 'SST',
  0x68: 'Atmel / Adesto',
  0x9d: 'ISSI',
  0x9f: 'ESMT',
  0xa1: 'Intel (legacy)',
  0xbf: 'Microchip',
  0xc2: 'Macronix',
  0xc8: 'GigaDevice',
  0xc9: 'GigaDevice',
  0xcd: 'GigaDevice',
  0xd5: 'ESMT',
  0xef: 'Winbond',
  0xff: 'XTX Technology',
};

const JEDEC_FLASH_PARTS = {
  0xef: {
    0x4014: 'Winbond W25Q80 (8 Mbit)',
    0x4015: 'Winbond W25Q16 (16 Mbit)',
    0x4016: 'Winbond W25Q32 (32 Mbit)',
    0x4017: 'Winbond W25Q64 (64 Mbit)',
    0x4018: 'Winbond W25Q128 (128 Mbit)',
    0x4019: 'Winbond W25Q256 (256 Mbit)',
  },
  0xc2: {
    0x4014: 'Macronix MX25L8006 (8 Mbit)',
    0x4015: 'Macronix MX25L1606 (16 Mbit)',
    0x4016: 'Macronix MX25L3206 (32 Mbit)',
    0x4017: 'Macronix MX25L6406 (64 Mbit)',
    0x4018: 'Macronix MX25L12835 (128 Mbit)',
  },
  0xc8: {
    0x4014: 'GigaDevice GD25Q80 (8 Mbit)',
    0x4015: 'GigaDevice GD25Q16 (16 Mbit)',
    0x4016: 'GigaDevice GD25Q32 (32 Mbit)',
    0x4017: 'GigaDevice GD25Q64 (64 Mbit)',
    0x4018: 'GigaDevice GD25Q128 (128 Mbit)',
    0x4019: 'GigaDevice GD25Q256 (256 Mbit)',
  },
  0xbf: {
    0x2541: 'Microchip SST26VF016B (16 Mbit)',
  },
};

const VENDOR_ALIASES = {
  AP_3v3: 'AP Memory (3.3 V)',
  AP_1v8: 'AP Memory (1.8 V)',
};

const USB_VENDOR_NAMES = {
  0x303a: 'Espressif',
  0x1a86: 'WCH (CH34x)',
  0x10c4: 'Silicon Labs (CP210x)',
  0x0403: 'FTDI',
};

const USB_PRODUCT_NAMES = {
  '1A86:55D3': 'CH343 Bridge',
  '1A86:7523': 'CH340 USB-Serial',
  '303A:1001': 'USB JTAG/Serial',
  '303A:4001': 'ESP32-S3 DevKit',
  '303A:4002': 'USB JTAG/Serial (CDC)',
  '10C4:EA60': 'CP210x USB-Serial',
  '0403:6001': 'FT232R USB UART',
};

const PACKAGE_FORM_FACTORS = {
  QFN56: '56-pin QFN (7 mm x 7 mm)',
  QFN32: '32-pin QFN (5 mm x 5 mm)',
  QFN28: '28-pin QFN',
  QFN24: '24-pin QFN',
  LGA56: '56-pad LGA module footprint',
  QFN48: '48-pin QFN',
};

const FACT_ICONS = {
  'Chip Variant': 'mdi-chip',
  Revision: 'mdi-update',
  'Embedded Flash': 'mdi-memory',
  'Embedded PSRAM': 'mdi-chip',
  'Flash Vendor (eFuse)': 'mdi-factory',
  'PSRAM Vendor (eFuse)': 'mdi-factory',
  'Flash ID': 'mdi-barcode',
  'Flash Manufacturer': 'mdi-domain',
  'Flash Device': 'mdi-chip',
  'Package Form Factor': 'mdi-package-variant-closed',
  'USB Bridge': 'mdi-usb-port',
  'Connection Baud': 'mdi-speedometer',
  'eFuse Block Version': 'mdi-shield-key',
};

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  const units = ['bytes', 'KB', 'MB', 'GB'];
  let idx = 0;
  let value = bytes;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  const formatted = value % 1 === 0 ? value.toFixed(0) : value.toFixed(1);
  return `${formatted} ${units[idx]}`;
}

function formatVendorLabel(label) {
  if (!label) return label;
  return VENDOR_ALIASES[label] ?? label.replace(/_/g, ' ');
}

function humanizeFeature(feature) {
  if (typeof feature !== 'string') return feature;
  let text = feature;
  for (const [code, friendly] of Object.entries(VENDOR_ALIASES)) {
    text = text.replace(new RegExp(code, 'g'), friendly);
  }
  return text;
}

function formatUsbBridge(info) {
  if (!info || typeof info.usbVendorId !== 'number') return null;
  const vendorHex = `0x${info.usbVendorId.toString(16).padStart(4, '0').toUpperCase()}`;
  const productHex =
    typeof info.usbProductId === 'number'
      ? `0x${info.usbProductId.toString(16).padStart(4, '0').toUpperCase()}`
      : null;
  const vendorName = USB_VENDOR_NAMES[info.usbVendorId] ?? `Vendor ${vendorHex}`;
  const productKey =
    typeof info.usbProductId === 'number'
      ? `${info.usbVendorId.toString(16).toUpperCase()}:${info.usbProductId.toString(16).toUpperCase()}`
      : null;
  const productName = productKey ? USB_PRODUCT_NAMES[productKey] : null;
  if (productName && productHex) {
    return `${vendorName} - ${productName} (${productHex})`;
  }
  if (productHex) {
    return `${vendorName} (${productHex})`;
  }
  return vendorName;
}

async function readPartitionTable(loader, offset = 0x8000, length = 0x400) {
  try {
    const data = await loader.readFlash(offset, length);
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const decoder = new TextDecoder();
    const entries = [];
    for (let i = 0; i + 32 <= data.length; i += 32) {
      const magic = view.getUint16(i, true);
      if (magic === 0xffff || magic === 0x0000) break;
      if (magic !== 0x50aa) continue;
      const type = view.getUint8(i + 2);
      const subtype = view.getUint8(i + 3);
      const addr = view.getUint32(i + 4, true);
      const size = view.getUint32(i + 8, true);
      const labelBytes = data.subarray(i + 12, i + 28);
      const label = decoder
        .decode(labelBytes)
        .replace(/\0/g, '')
        .trim();
      entries.push({ label: label || `type 0x${type.toString(16)}`, type, subtype, offset: addr, size });
    }
    return entries;
  } catch (err) {
    console.warn('Failed to read partition table', err);
    return [];
  }
}

function resolvePackageLabel(chipKey, pkgVersion, chipRevision) {
  const mapper = PACKAGE_LABELS[chipKey];
  if (!mapper || typeof pkgVersion !== 'number' || Number.isNaN(pkgVersion)) {
    return null;
  }
  let label = mapper(pkgVersion);
  if (!label) return null;
  if (chipKey === 'ESP32' && chipRevision === 3 && (pkgVersion === 0 || pkgVersion === 1)) {
    label += ' V3';
  }
  return label;
}

function resolveRevisionLabel(chipKey, chipRevision, majorVersion, minorVersion) {
  if (chipKey === 'ESP32' && typeof chipRevision === 'number' && !Number.isNaN(chipRevision)) {
    const eco = ECO_LABELS[chipRevision];
    return eco ? `${eco} (r${chipRevision})` : `r${chipRevision}`;
  }
  if (
    typeof majorVersion === 'number' &&
    typeof minorVersion === 'number' &&
    !Number.isNaN(majorVersion) &&
    !Number.isNaN(minorVersion)
  ) {
    return `v${majorVersion}.${minorVersion}`;
  }
  if (typeof chipRevision === 'number' && !Number.isNaN(chipRevision)) {
    return `r${chipRevision}`;
  }
  return null;
}

function cleanEmbeddedFeature(feature, keyword) {
  const match = feature.match(new RegExp(`${keyword}\\s*(.*)`, 'i'));
  if (match && match[1]) {
    return match[1].trim();
  }
  return feature.replace(new RegExp(keyword, 'i'), '').trim() || feature.trim();
}

function resolveEmbeddedFlash(chipKey, flashCap, flashVendor, featureList) {
  const map = EMBEDDED_FLASH_CAPACITY[chipKey];
  if (map && typeof flashCap === 'number' && !Number.isNaN(flashCap) && map[flashCap]) {
    const vendorLabel = formatVendorLabel(flashVendor);
    return `${map[flashCap]}${vendorLabel ? ` (${vendorLabel})` : ''}`;
  }
  const feature = featureList.find(value => /Embedded Flash/i.test(value));
  if (feature) {
    return cleanEmbeddedFeature(feature, 'Embedded Flash');
  }
  return null;
}

function resolveEmbeddedPsram(chipKey, psramCap, psramVendor, featureList) {
  const map = EMBEDDED_PSRAM_CAPACITY[chipKey];
  if (map && typeof psramCap === 'number' && !Number.isNaN(psramCap) && map[psramCap]) {
    const vendorLabel = formatVendorLabel(psramVendor);
    return `${map[psramCap]}${vendorLabel ? ` (${vendorLabel})` : ''}`;
  }
  const feature = featureList.find(value => /Embedded PSRAM/i.test(value));
  if (feature) {
    return cleanEmbeddedFeature(feature, 'Embedded PSRAM');
  }
  return null;
}

const serialSupported = 'serial' in navigator;
const connected = ref(false);
const busy = ref(false);
const flashInProgress = ref(false);
const flashProgress = ref(0);
const selectedBaud = ref('921600');
const baudrateOptions = ['115200', '230400', '460800', '921600'];
const flashOffset = ref('0x0');
const eraseFlash = ref(false);
const selectedPreset = ref(null);
const logBuffer = ref('');
const currentPort = ref(null);
const transport = ref(null);
const loader = ref(null);
const firmwareBuffer = ref(null);
const firmwareName = ref('');
const chipDetails = ref(null);
const partitionTable = ref([]);
const activeTab = ref('info');
const flashSizeBytes = ref(null);

const spiffsAgent = reactive({
  available: false,
  running: false,
  uploading: false,
  busy: false,
  files: [],
  status: '',
  error: '',
  buffer: '',
  preview: null,
  reader: null,
});

const spiffsTextEncoder = new TextEncoder();
const spiffsLineDecoder = new TextDecoder();
const spiffsPreviewDecoder = new TextDecoder('utf-8', { fatal: false });

function resetSpiffsAgentState() {
  if (spiffsAgent.preview?.downloadUrl && typeof URL !== 'undefined' && URL.revokeObjectURL) {
    URL.revokeObjectURL(spiffsAgent.preview.downloadUrl);
  }
  if (spiffsAgent.reader) {
    try {
      spiffsAgent.reader.cancel?.();
    } catch (error) {
      /* ignore */
    }
    try {
      spiffsAgent.reader.releaseLock?.();
    } catch (error) {
      /* ignore */
    }
  }
  if (transport.value) {
    transport.value.reader = undefined;
  }
  spiffsAgent.available = false;
  spiffsAgent.running = false;
  spiffsAgent.uploading = false;
  spiffsAgent.busy = false;
  spiffsAgent.files = [];
  spiffsAgent.status = '';
  spiffsAgent.error = '';
  spiffsAgent.buffer = '';
  spiffsAgent.preview = null;
  spiffsAgent.reader = null;
}

const showBootDialog = ref(false);
const lastErrorMessage = ref('');

const offsetPresets = [
  { label: 'Application (0x10000)', value: '0x10000' },
  { label: 'Bootloader (0x1000)', value: '0x1000' },
  { label: 'Partition Table (0x8000)', value: '0x8000' },
  { label: 'NVS Storage (0x9000)', value: '0x9000' },
];

const theme = useTheme();
const storedTheme =
  typeof window !== 'undefined' ? window.localStorage.getItem('esp32-theme') : null;
const currentTheme = ref(storedTheme === 'light' ? 'light' : 'dark');
const isDarkTheme = computed(() => currentTheme.value === 'dark');
const themeIcon = computed(() =>
  isDarkTheme.value ? 'mdi-weather-night' : 'mdi-white-balance-sunny'
);

function applyThemeClass(name) {
  if (typeof document !== 'undefined') {
    document.body.classList.toggle('light-theme', name === 'light');
  }
}

watch(
  currentTheme,
  name => {
    theme.change(name);
    applyThemeClass(name);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('esp32-theme', name);
    }
  },
  { immediate: true }
);

function toggleTheme() {
  currentTheme.value = isDarkTheme.value ? 'light' : 'dark';
}

watch(
  () => loader.value?.chip?.CHIP_NAME,
  chipName => {
    const stub = chipName ? getDecodedSpiffsStub(chipName) : null;
    spiffsAgent.available = Boolean(stub);
    if (!spiffsAgent.available) {
      spiffsAgent.running = false;
    }
  },
  { immediate: true }
);

watch(
  connected,
  value => {
    if (!value) {
      resetSpiffsAgentState();
    }
  }
);

function encodeBytesToBase64(bytes) {
  if (!bytes?.length) {
    return '';
  }
  if (typeof btoa === 'function') {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  throw new Error('Base64 encoding is not supported in this environment.');
}

function decodeBase64ToBytes(data) {
  if (!data) {
    return new Uint8Array(0);
  }
  if (typeof atob === 'function') {
    const binary = atob(data);
    const result = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      result[i] = binary.charCodeAt(i);
    }
    return result;
  }
  if (typeof Buffer !== 'undefined') {
    const buffer = Buffer.from(data, 'base64');
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }
  throw new Error('Base64 decoding is not supported in this environment.');
}

function chunkString(value, size = 76) {
  const chunks = [];
  for (let i = 0; i < value.length; i += size) {
    chunks.push(value.slice(i, i + size));
  }
  return chunks;
}

function createSpiffsPreview(name, bytes) {
  if (spiffsAgent.preview?.downloadUrl && typeof URL !== 'undefined' && URL.revokeObjectURL) {
    URL.revokeObjectURL(spiffsAgent.preview.downloadUrl);
  }
  const MAX_TEXT_PREVIEW = 4096;
  let text = '';
  let isBinary = false;
  if (!bytes.length) {
    text = '(Empty file)';
  } else {
    let printable = 0;
    for (let i = 0; i < bytes.length; i += 1) {
      const value = bytes[i];
      if ((value >= 32 && value <= 126) || value === 9 || value === 10 || value === 13) {
        printable += 1;
      }
    }
    if (printable / bytes.length < 0.85 || bytes.includes(0)) {
      isBinary = true;
    }
    try {
      text = spiffsPreviewDecoder.decode(bytes.subarray(0, MAX_TEXT_PREVIEW));
    } catch (error) {
      text = Array.from(bytes.slice(0, 256))
        .map(value => value.toString(16).padStart(2, '0'))
        .join(' ');
      isBinary = true;
    }
    if (!text) {
      text = '(Binary file preview not available)';
      isBinary = true;
    } else if (text.length > MAX_TEXT_PREVIEW) {
      text = `${text.slice(0, MAX_TEXT_PREVIEW)}…`;
    }
  }
  const downloadUrl =
    typeof URL !== 'undefined' && URL.createObjectURL
      ? URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }))
      : null;
  return {
    name,
    size: bytes.length,
    text,
    isBinary,
    downloadUrl,
  };
}

const SPIFFS_ERROR_MESSAGES = {
  NOFILE: 'File not found on SPIFFS.',
  WRITE: 'Failed to write file to SPIFFS.',
  FORMAT: 'SPIFFS format failed.',
  CMD: 'SPIFFS agent did not recognize that command.',
  RESET: 'Device reset request was rejected by SPIFFS agent.',
};

function createSpiffsAgentError(raw, fallback = 'SPIFFS agent reported an error.') {
  if (!raw) {
    return new Error(fallback);
  }
  if (raw instanceof Error) {
    return raw;
  }
  const text = typeof raw === 'string' ? raw : String(raw);
  if (!/^ERR\b/i.test(text)) {
    return Object.assign(new Error(text), { raw: text });
  }
  const trimmed = text.replace(/^ERR\s*/i, '');
  const [codeRaw, ...rest] = trimmed.split(/\s+/);
  const code = (codeRaw ?? '').toUpperCase();
  const friendly = SPIFFS_ERROR_MESSAGES[code] ?? fallback;
  const extra = rest.length ? ` (${rest.join(' ')})` : '';
  return Object.assign(new Error(`${friendly}${extra}`), { raw: text, code });
}

function formatBytesShort(bytes) {
  const formatted = formatBytes(bytes);
  return formatted ?? `${bytes} bytes`;
}

const partitionColorOverrides = {
  factory: '#f8b26a',
  ota_0: '#7cc576',
  ota_1: '#58a55b',
  ota_2: '#499550',
  ota: '#8d6be6',
  otadata: '#8d6be6',
  nvs: '#4dd0e1',
  fat: '#7986cb',
  ffat: '#7986cb',
  spiffs: '#64b5f6',
  littlefs: '#81d4fa',
  coredump: '#ef9a9a',
  phy: '#aed581',
  phy_init: '#aed581',
  test: '#f48fb1',
};

const partitionTypeColors = {
  0x00: '#4caf50',
  0x01: '#2196f3',
};

const partitionPalette = [
  '#ffadad',
  '#ffd6a5',
  '#fdffb6',
  '#caffbf',
  '#9bf6ff',
  '#a0c4ff',
  '#bdb2ff',
  '#ffc6ff',
];

const UNUSED_FLASH_ALERT_THRESHOLD = 64 * 1024;

const PARTITION_TYPE_NAMES = {
  0x00: 'Application',
  0x01: 'Data',
};

const PARTITION_DATA_SUBTYPE_NAMES = {
  0x00: 'OTA Data',
  0x01: 'PHY Init Data',
  0x02: 'NVS',
  0x03: 'Core Dump',
  0x04: 'NVS Keys',
  0x05: 'EFuse Emulation',
  0x06: 'Undefined Data',
  0x80: 'ESPHTTPD Data',
  0x81: 'FAT (FATFS)',
  0x82: 'SPIFFS',
  0x83: 'LittleFS',
  0x84: 'Storage',
  0x85: 'OTA Backup',
  0x86: 'NimBLE Data',
  0x87: 'Factory NVS',
};

function toPaddedHex(value) {
  const hex = Number(value).toString(16).toUpperCase();
  return `0x${hex.padStart(2, '0')}`;
}

function getPartitionTypeLabel(type) {
  const hex = toPaddedHex(type ?? 0);
  const name = PARTITION_TYPE_NAMES[type];
  return name ? `${name} (${hex})` : `Type ${hex}`;
}

function getPartitionSubtypeLabel(type, subtype) {
  const hex = toPaddedHex(subtype ?? 0);
  let name;

  if (type === 0x00) {
    if (subtype === 0x00) {
      name = 'Factory App';
    } else if (subtype === 0x01) {
      name = 'Test App';
    } else if (subtype >= 0x10 && subtype <= 0x1f) {
      name = `OTA ${subtype - 0x10}`;
    } else if (subtype === 0x20) {
      name = 'Any App';
    } else if (subtype === 0x21) {
      name = 'OTA App';
    }
  } else if (type === 0x01) {
    name = PARTITION_DATA_SUBTYPE_NAMES[subtype];
    if (!name && subtype >= 0x80 && subtype <= 0x9f) {
      name = 'Custom Data';
    }
  }

  return name ? `${name} (${hex})` : `Subtype ${hex}`;
}

const UNUSED_SEGMENT_COLOR = '#c62828';
const UNUSED_SEGMENT_PATTERN =
  'repeating-linear-gradient(270deg, rgba(248, 113, 113, 0.65) 0px, rgba(248, 113, 113, 0.65) 12px, rgba(220, 38, 38, 0.65) 12px, rgba(220, 38, 38, 0.65) 24px)';

const RESERVED_SEGMENTS = [
  {
    key: 'bootloader',
    label: 'Bootloader',
    offset: 0x0,
    size: 0x8000,
    color: '#546e7a',
  },
  {
    key: 'partition-table',
    label: 'Partition Table',
    offset: 0x8000,
    size: 0x1000,
    color: '#78909c',
  },
];

const partitionSegments = computed(() => {
  const sortedPartitions = [...partitionTable.value].sort((a, b) => a.offset - b.offset);
  const totalFlash = flashSizeBytes.value && flashSizeBytes.value > 0 ? flashSizeBytes.value : null;
  const segments = [];
  let cursor = 0;

  const createGapSegments = (start, size) => {
    if (size <= 0) return [];
    const end = start + size;
    const gapSegments = [];
    let pointer = start;

    const relevantReserved = RESERVED_SEGMENTS.filter(
      block => block.offset < end && block.offset + block.size > start
    ).sort((a, b) => a.offset - b.offset);

    for (const block of relevantReserved) {
      if (block.offset > pointer) {
        const unusedEnd = Math.min(block.offset, end);
        if (unusedEnd > pointer) {
          gapSegments.push({
            key: `unused-${pointer}-${unusedEnd}`,
            kind: 'unused',
            offset: pointer,
            size: unusedEnd - pointer,
          });
          pointer = unusedEnd;
        }
      }

      const blockStart = Math.max(pointer, block.offset);
      const blockEnd = Math.min(end, block.offset + block.size);
      if (blockEnd > blockStart) {
        gapSegments.push({
          key: `reserved-${block.key}-${blockStart}-${blockEnd}`,
          kind: 'reserved',
          offset: blockStart,
          size: blockEnd - blockStart,
          label: block.label,
          color: block.color,
        });
        pointer = blockEnd;
      }
    }

    if (pointer < end) {
      gapSegments.push({
        key: `unused-${pointer}-${end}`,
        kind: 'unused',
        offset: pointer,
        size: end - pointer,
      });
    }

    return gapSegments;
  };

  for (const entry of sortedPartitions) {
    const start = entry.offset;
    if (start > cursor) {
      const gapSize = start - cursor;
      segments.push(...createGapSegments(cursor, gapSize));
    }

    segments.push({
      key: `partition-${entry.offset}-${entry.type}-${entry.subtype}-${entry.size}`,
      kind: 'partition',
      offset: entry.offset,
      size: entry.size,
      entry,
    });

    const end = entry.offset + entry.size;
    if (end > cursor) {
      cursor = end;
    }
  }

  const totalSpanCandidate = totalFlash ?? cursor;
  if (totalSpanCandidate > cursor) {
    segments.push(...createGapSegments(cursor, totalSpanCandidate - cursor));
  }

  if (!segments.length && totalFlash) {
    segments.push(...createGapSegments(0, totalFlash));
  }

  const sizedSegments = segments.filter(segment => segment.size > 0);
  if (!sizedSegments.length) {
    return [];
  }

  const totalSpan = sizedSegments.reduce((sum, segment) => sum + segment.size, 0) || 1;
  let partitionIndex = 0;

  return sizedSegments.map(segment => {
    const widthPercent = (segment.size / totalSpan) * 100;
    const widthValue = Number.isFinite(widthPercent) ? Math.max(widthPercent, 0) : 0;
    const width = `${widthValue.toFixed(4)}%`;
    const offsetHex = `0x${segment.offset.toString(16).toUpperCase()}`;
    const sizeText = formatBytes(segment.size) ?? `${segment.size} bytes`;
    const endOffset = segment.offset + segment.size;
    const endHex = `0x${endOffset.toString(16).toUpperCase()}`;

    const showLabel = widthValue >= 6;
    const showMeta = widthValue >= 12 && segment.kind === 'partition';

    if (segment.kind === 'unused') {
      return {
        key: segment.key,
        label: 'Unused Flash',
        width,
        color: UNUSED_SEGMENT_COLOR,
        backgroundImage: UNUSED_SEGMENT_PATTERN,
        sizeText,
        offsetHex,
        endHex,
        offset: segment.offset,
        size: segment.size,
        typeHex: 'N/A',
        subtypeHex: 'N/A',
        typeLabel: 'Not applicable',
        subtypeLabel: 'Not applicable',
        isUnused: true,
        isReserved: false,
        showLabel,
        showMeta: false,
        tooltipLines: [`Size: ${sizeText}`, `Start: ${offsetHex}`, `End: ${endHex}`],
      };
    }

    if (segment.kind === 'reserved') {
      return {
        key: segment.key,
        label: segment.label,
        width,
        color: segment.color,
        backgroundImage: null,
        sizeText,
        offsetHex,
        endHex,
        offset: segment.offset,
        size: segment.size,
        typeHex: 'N/A',
        subtypeHex: 'N/A',
        typeLabel: 'Reserved',
        subtypeLabel: 'Reserved',
        isUnused: false,
        isReserved: true,
        showLabel,
        showMeta: widthValue >= 10,
        tooltipLines: [`Size: ${sizeText}`, `Start: ${offsetHex}`, `End: ${endHex}`],
      };
    }

    const entry = segment.entry;
    const typeHex = toPaddedHex(entry.type);
    const subtypeHex = toPaddedHex(entry.subtype);
    const typeLabel = getPartitionTypeLabel(entry.type);
    const subtypeLabel = getPartitionSubtypeLabel(entry.type, entry.subtype);
    const normalizedLabel = (entry.label || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    const colorOverride = normalizedLabel ? partitionColorOverrides[normalizedLabel] : undefined;
    const color =
      colorOverride ||
      partitionTypeColors[entry.type] ||
      partitionPalette[partitionIndex % partitionPalette.length];
    partitionIndex += 1;
    return {
      key: segment.key,
      label: entry.label || `type 0x${entry.type.toString(16)}`,
      width,
      color,
      backgroundImage: null,
      sizeText,
      offsetHex,
      endHex,
      offset: entry.offset,
      size: entry.size,
      typeHex,
      subtypeHex,
      typeLabel,
      subtypeLabel,
      isUnused: false,
      isReserved: false,
      showLabel,
      showMeta,
      tooltipLines: [
        `Size: ${sizeText}`,
        `Start: ${offsetHex}`,
        `End: ${endHex}`,
        `Type: ${typeLabel}`,
        `Subtype: ${subtypeLabel}`,
      ],
    };
  });
});

const totalUnusedFlashBytes = computed(() =>
  partitionSegments.value
    .filter(segment => segment.isUnused)
    .reduce((sum, segment) => sum + (segment.size || 0), 0)
);

const unusedFlashSummary = computed(() => {
  const bytes = totalUnusedFlashBytes.value;
  if (!bytes || bytes < UNUSED_FLASH_ALERT_THRESHOLD) {
    return null;
  }
  const readable = formatBytes(bytes) ?? `${bytes} bytes`;
  return {
    bytes,
    readable,
  };
});

const formattedPartitions = computed(() => {
  const segmentByOffset = new Map();
  for (const segment of partitionSegments.value) {
    if (!segment.isUnused && !segment.isReserved) {
      segmentByOffset.set(segment.offset, segment);
    }
  }

  return partitionTable.value.map((entry, index) => {
    const segment = segmentByOffset.get(entry.offset);
    const typeHex = toPaddedHex(entry.type);
    const subtypeHex = toPaddedHex(entry.subtype);
    const typeLabel = getPartitionTypeLabel(entry.type);
    const subtypeLabel = getPartitionSubtypeLabel(entry.type, entry.subtype);
    const offsetHex = `0x${entry.offset.toString(16).toUpperCase()}`;
    const sizeText = formatBytes(entry.size) ?? `${entry.size} bytes`;
    const fallbackColor =
      partitionColorOverrides[
        (entry.label || '')
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '')
      ] ||
      partitionTypeColors[entry.type] ||
      partitionPalette[index % partitionPalette.length];

    return {
      ...entry,
      typeHex,
      subtypeHex,
      typeLabel,
      subtypeLabel,
      offsetHex,
      sizeText,
      color: segment?.color ?? fallbackColor,
      backgroundImage: segment?.backgroundImage ?? null,
    };
  });
});

const connectionChipLabel = computed(() => {
  if (!connected.value) {
    return 'Disconnected';
  }

  const name = chipDetails.value?.name?.trim();
  return name ? `Connected: ${name}` : 'Connected';
});

const canFlash = computed(
  () => connected.value && Boolean(firmwareBuffer.value) && !flashInProgress.value
);

function appendLog(message, prefix = '[ui]') {
  const line = prefix ? `${prefix} ${message}` : message;
  logBuffer.value += `${line}\n`;
}

function logSpiffsError(action, error) {
  const detail = error?.raw ?? error?.message ?? String(error);
  appendLog(`SPIFFS ${action} failed: ${detail}`, '[error]');
}

const logText = computed(() => logBuffer.value);

const terminal = {
  clean() {
    logBuffer.value = '';
  },
  write(data) {
    logBuffer.value += data;
  },
  writeLine(data) {
    logBuffer.value += `${data}\n`;
  },
};

function clearLog() {
  terminal.clean();
}

function ensureSpiffsReady({ requireRunning = false } = {}) {
  spiffsAgent.error = '';
  if (!connected.value || !transport.value || !loader.value) {
    spiffsAgent.error = 'Connect to a device first.';
    return false;
  }
  if (!spiffsAgent.available) {
    spiffsAgent.error = 'SPIFFS agent is not available for this chip.';
    return false;
  }
  if (requireRunning && !spiffsAgent.running) {
    spiffsAgent.error = 'Upload the SPIFFS agent before performing this action.';
    return false;
  }
  return true;
}

async function ensureSpiffsReader() {
  const device = transport.value?.device;
  if (!device?.readable) {
    throw new Error('Serial reader unavailable.');
  }
  if (spiffsAgent.reader) {
    return spiffsAgent.reader;
  }
  if (transport.value.reader) {
    spiffsAgent.reader = transport.value.reader;
    return spiffsAgent.reader;
  }
  const reader = device.readable.getReader();
  transport.value.reader = reader;
  spiffsAgent.reader = reader;
  return reader;
}

async function writeSpiffsLine(line) {
  const device = transport.value?.device;
  if (!device?.writable) {
    throw new Error('Unable to write to the serial device.');
  }
  const writer = device.writable.getWriter();
  try {
    await writer.write(spiffsTextEncoder.encode(`${line}\n`));
  } finally {
    writer.releaseLock();
  }
}

async function readSpiffsLines(terminators, { timeoutMs = 5000, includeTerminator = false } = {}) {
  if (!Array.isArray(terminators) || !terminators.length) {
    throw new Error('Terminators are required to read SPIFFS responses.');
  }
  const reader = await ensureSpiffsReader();
  const collected = [];
  const startTime = timeoutMs
    ? (typeof performance !== 'undefined' ? performance.now() : Date.now())
    : null;
  const deadline = startTime && timeoutMs ? startTime + timeoutMs : null;
  while (true) {
    if (deadline) {
      const current = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (current > deadline) {
        throw new Error('Timeout waiting for SPIFFS agent response.');
      }
    }
    let result;
    try {
      result = await reader.read();
    } catch (error) {
      spiffsAgent.reader = null;
      if (transport.value) {
        transport.value.reader = undefined;
      }
      throw error;
    }
    const { value, done } = result ?? {};
    if (done) {
      spiffsAgent.reader = null;
      if (transport.value) {
        transport.value.reader = undefined;
      }
      throw new Error('Serial reader closed unexpectedly.');
    }
    if (!value || value.length === 0) {
      continue;
    }
    spiffsAgent.buffer += spiffsLineDecoder.decode(value, { stream: true });
    let newlineIndex;
    while ((newlineIndex = spiffsAgent.buffer.indexOf('\n')) !== -1) {
      const rawLine = spiffsAgent.buffer.slice(0, newlineIndex);
      spiffsAgent.buffer = spiffsAgent.buffer.slice(newlineIndex + 1);
      const line = rawLine.replace(/\r$/, '');
      if (!line && !collected.length) {
        continue;
      }
      collected.push(line);
      const matched = terminators.find(term =>
        term instanceof RegExp ? term.test(line) : term === line
      );
      if (matched) {
        const payload = includeTerminator ? [...collected] : collected.slice(0, -1);
        return { lines: payload, terminator: line };
      }
    }
  }
}

async function sendSpiffsCommand(command, options = {}) {
  spiffsAgent.buffer = '';
  await writeSpiffsLine(command);
  return readSpiffsLines(options.terminators ?? ['DONE'], options);
}

async function uploadSpiffsAgent() {
  if (!ensureSpiffsReady()) {
    return;
  }
  if (busy.value || spiffsAgent.uploading) {
    appendLog('Another operation is already running.', '[warn]');
    return;
  }
  const chipName = loader.value?.chip?.CHIP_NAME;
  const stub = chipName ? getDecodedSpiffsStub(chipName) : null;
  if (!stub) {
    spiffsAgent.error = 'No SPIFFS agent stub is available for this chip.';
    return;
  }
  spiffsAgent.uploading = true;
  spiffsAgent.status = '';
  spiffsAgent.error = '';
  spiffsAgent.files = [];
  busy.value = true;
  try {
    appendLog('Uploading SPIFFS agent stub...', '[spiffs]');
    await transport.value.flushInput?.();
    const blockSize = loader.value.ESP_RAM_BLOCK ?? 0x1800;
    const uploadPart = async (bytes, start) => {
      if (!bytes || !bytes.length) return;
      const length = bytes.length;
      const blocks = Math.floor((length + blockSize - 1) / blockSize);
      await loader.value.memBegin(length, blocks, blockSize, start);
      for (let seq = 0; seq < blocks; seq += 1) {
        const from = seq * blockSize;
        const to = Math.min(from + blockSize, length);
        await loader.value.memBlock(bytes.slice(from, to), seq);
      }
    };
    await uploadPart(stub.text, stub.textStart);
    await uploadPart(stub.data, stub.dataStart);
    await loader.value.memFinish(stub.entry);
    spiffsAgent.running = true;
    spiffsAgent.status = 'SPIFFS agent uploaded successfully.';
    appendLog('SPIFFS agent stub running.', '[spiffs]');
    await listSpiffsFiles();
  } catch (error) {
    const message = error?.message || String(error);
    spiffsAgent.error = message;
    appendLog(`SPIFFS agent upload failed: ${message}`, '[error]');
    spiffsAgent.running = false;
  } finally {
    busy.value = false;
    spiffsAgent.uploading = false;
  }
}

async function listSpiffsFiles() {
  if (!ensureSpiffsReady({ requireRunning: true }) || spiffsAgent.busy) {
    return;
  }
  spiffsAgent.busy = true;
  spiffsAgent.error = '';
  try {
    appendLog('Requesting SPIFFS file list...', '[spiffs]');
    const { lines, terminator } = await sendSpiffsCommand('LIST', {
      terminators: ['DONE', /^ERR /],
    });
    if (terminator && /^ERR /i.test(terminator)) {
      throw createSpiffsAgentError(terminator, 'Failed to list SPIFFS files.');
    }
    const files = lines
      .map(line => {
        if (!line.startsWith('FILE ')) {
          return null;
        }
        const rest = line.slice(5).trim();
        const lastSpace = rest.lastIndexOf(' ');
        if (lastSpace === -1) {
          return null;
        }
        const name = rest.slice(0, lastSpace).trim();
        const size = Number.parseInt(rest.slice(lastSpace + 1), 10);
        if (!name || Number.isNaN(size)) {
          return null;
        }
        return { name, size };
      })
      .filter(Boolean);
    spiffsAgent.files = files;
    spiffsAgent.status = files.length
      ? `Loaded ${files.length} file${files.length === 1 ? '' : 's'} from SPIFFS.`
      : 'SPIFFS is empty.';
    appendLog(
      `SPIFFS file list loaded (${files.length} entr${files.length === 1 ? 'y' : 'ies'}).`,
      '[spiffs]'
    );
  } catch (error) {
    const message = error?.message || String(error);
    spiffsAgent.error = message;
    logSpiffsError('list', error);
  } finally {
    spiffsAgent.busy = false;
  }
}

async function readSpiffsFile(name) {
  if (!name) return;
  if (!ensureSpiffsReady({ requireRunning: true }) || spiffsAgent.busy) {
    return;
  }
  spiffsAgent.busy = true;
  spiffsAgent.error = '';
  try {
    const { lines, terminator } = await sendSpiffsCommand(`READ ${name}`, {
      terminators: ['DONE', /^ERR /],
      timeoutMs: 8000,
    });
    if (terminator && /^ERR /i.test(terminator)) {
      throw createSpiffsAgentError(terminator, `Failed to read ${name} from SPIFFS.`);
    }
    if (!lines.length || !lines[0].startsWith('DATA ')) {
      throw new Error('Unexpected response from SPIFFS agent.');
    }
    const sizeLabel = lines[0].slice(5).trim();
    const expectedSize = Number.parseInt(sizeLabel, 10);
    const base64Payload = lines.slice(1).join('');
    const bytes = decodeBase64ToBytes(base64Payload);
    if (Number.isInteger(expectedSize) && expectedSize !== bytes.length) {
      appendLog(
        `SPIFFS agent reported ${expectedSize} bytes but returned ${bytes.length}.`,
        '[warn]'
      );
    }
    spiffsAgent.preview = createSpiffsPreview(name, bytes);
    spiffsAgent.status = `Read ${name} (${formatBytesShort(bytes.length)}).`;
    appendLog(`SPIFFS file read: ${name} (${bytes.length} bytes).`, '[spiffs]');
  } catch (error) {
    const message = error?.message || String(error);
    spiffsAgent.error = message;
    logSpiffsError('read', error);
  } finally {
    spiffsAgent.busy = false;
  }
}

async function deleteSpiffsFile(name) {
  if (!name) return;
  if (!ensureSpiffsReady({ requireRunning: true }) || spiffsAgent.busy) {
    return;
  }
  spiffsAgent.busy = true;
  spiffsAgent.error = '';
  let refresh = false;
  try {
    const { terminator } = await sendSpiffsCommand(`DELETE ${name}`, {
      terminators: ['OK', /^ERR /],
    });
    if (terminator !== 'OK') {
      throw createSpiffsAgentError(terminator, `Failed to delete ${name} from SPIFFS.`);
    }
    spiffsAgent.status = `Deleted ${name}.`;
    appendLog(`SPIFFS file deleted: ${name}.`, '[spiffs]');
    refresh = true;
  } catch (error) {
    const message = error?.message || String(error);
    spiffsAgent.error = message;
    logSpiffsError('delete', error);
  } finally {
    spiffsAgent.busy = false;
  }
  if (refresh) {
    await listSpiffsFiles();
  }
}

async function uploadSpiffsFile(file) {
  const fileObject = Array.isArray(file) ? file[0] : file;
  if (!fileObject) return;
  if (!ensureSpiffsReady({ requireRunning: true }) || spiffsAgent.busy) {
    return;
  }
  spiffsAgent.busy = true;
  spiffsAgent.error = '';
  try {
    const buffer = await fileObject.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    spiffsAgent.buffer = '';
    await writeSpiffsLine(`WRITE ${fileObject.name} ${bytes.length}`);
    const base64Data = encodeBytesToBase64(bytes);
    const chunks = chunkString(base64Data, 76);
    for (const chunk of chunks) {
      await writeSpiffsLine(chunk);
    }
    const { terminator } = await readSpiffsLines(['OK', /^ERR /], {
      includeTerminator: true,
      timeoutMs: Math.max(6000, bytes.length / 8 + 4000),
    });
    if (terminator !== 'OK') {
      throw createSpiffsAgentError(
        terminator,
        `Failed to upload ${fileObject.name} to SPIFFS.`
      );
    }
    spiffsAgent.status = `Uploaded ${fileObject.name} (${formatBytesShort(bytes.length)}).`;
    appendLog(`SPIFFS file written: ${fileObject.name} (${bytes.length} bytes).`, '[spiffs]');
  } catch (error) {
    const message = error?.message || String(error);
    spiffsAgent.error = message;
    logSpiffsError('upload', error);
  } finally {
    spiffsAgent.busy = false;
  }
  await listSpiffsFiles();
}

async function formatSpiffs() {
  if (!ensureSpiffsReady({ requireRunning: true }) || spiffsAgent.busy) {
    return;
  }
  spiffsAgent.busy = true;
  spiffsAgent.error = '';
  try {
    const { terminator } = await sendSpiffsCommand('FORMAT', {
      terminators: ['OK', /^ERR /],
      timeoutMs: 8000,
    });
    if (terminator !== 'OK') {
      throw createSpiffsAgentError(terminator, 'Failed to format SPIFFS.');
    }
    spiffsAgent.status = 'SPIFFS formatted successfully.';
    spiffsAgent.files = [];
    appendLog('SPIFFS volume formatted.', '[spiffs]');
  } catch (error) {
    const message = error?.message || String(error);
    spiffsAgent.error = message;
    logSpiffsError('format', error);
  } finally {
    spiffsAgent.busy = false;
  }
}

async function resetSpiffsDevice() {
  if (!ensureSpiffsReady({ requireRunning: true }) || spiffsAgent.busy) {
    return;
  }
  spiffsAgent.busy = true;
  spiffsAgent.error = '';
  try {
    const { terminator } = await sendSpiffsCommand('RESET', {
      terminators: ['OK', /^ERR /],
      timeoutMs: 6000,
    });
    if (terminator !== 'OK') {
      throw createSpiffsAgentError(terminator, 'Failed to reset device via SPIFFS agent.');
    }
    spiffsAgent.status = 'Device reset requested.';
    appendLog('SPIFFS agent requested device reset.', '[spiffs]');
  } catch (error) {
    const message = error?.message || String(error);
    spiffsAgent.error = message;
    logSpiffsError('reset', error);
  } finally {
    spiffsAgent.busy = false;
    spiffsAgent.running = false;
    spiffsAgent.files = [];
    closeSpiffsPreview();
  }
}

function closeSpiffsPreview() {
  if (spiffsAgent.preview?.downloadUrl && typeof URL !== 'undefined' && URL.revokeObjectURL) {
    URL.revokeObjectURL(spiffsAgent.preview.downloadUrl);
  }
  spiffsAgent.preview = null;
}

function handleSpiffsRead(file) {
  const name = typeof file === 'string' ? file : file?.name;
  if (name) {
    readSpiffsFile(name);
  }
}

function handleSpiffsDelete(file) {
  const name = typeof file === 'string' ? file : file?.name;
  if (name) {
    deleteSpiffsFile(name);
  }
}

function handleSpiffsUpload(file) {
  if (file) {
    uploadSpiffsFile(file);
  }
}

async function disconnectTransport() {
  try {
    if (transport.value) {
      await transport.value.disconnect();
    } else if (currentPort.value) {
      await currentPort.value.close();
    }
  } catch (error) {
    console.warn('Error disconnecting transport', error);
  } finally {
      transport.value = null;
      currentPort.value = null;
      loader.value = null;
      connected.value = false;
      chipDetails.value = null;
      flashSizeBytes.value = null;
      resetSpiffsAgentState();
  }
}

async function connect() {
  if (!serialSupported) {
    appendLog('Web Serial API not available in this browser.');
    return;
  }
  if (busy.value) return;
  busy.value = true;
  flashProgress.value = 0;

  logBuffer.value = '';
  partitionTable.value = [];
  appendLog('Requesting serial port access...');

  try {
    showBootDialog.value = false;
    currentPort.value = await navigator.serial.requestPort({ filters: SUPPORTED_VENDORS });
    const baudrate = Number.parseInt(selectedBaud.value, 10) || DEFAULT_ROM_BAUD;
    const portDetails = currentPort.value?.getInfo ? currentPort.value.getInfo() : null;
    transport.value = new Transport(currentPort.value, DEBUG_SERIAL);
    transport.value.tracing = DEBUG_SERIAL;
    loader.value = new ESPLoader({
      transport: transport.value,
      baudrate,
      romBaudrate: DEFAULT_ROM_BAUD,
      terminal,
      enableTracing: DEBUG_SERIAL,
    });

    const chipName = await loader.value.main('default_reset');
    const chip = loader.value.chip;

    const callChip = async method => {
      const fn = chip?.[method];
      if (typeof fn === 'function') {
        try {
          return await fn.call(chip, loader.value);
        } catch (err) {
          appendLog(`Unable to retrieve ${method}: ${err?.message || err}`, '[warn]');
          return undefined;
        }
      }
      return undefined;
    };

    const descriptionRaw = (await callChip('getChipDescription')) ?? chipName;
    const featuresRaw = await callChip('getChipFeatures');
    const crystalFreq = await callChip('getCrystalFreq');
    const macAddress = await callChip('readMac');
    const flashSizeKb = await loader.value.getFlashSize().catch(() => undefined);
    const packageVersion = await callChip('getPkgVersion');
    const chipRevision = await callChip('getChipRevision');
    const majorVersion = await callChip('getMajorChipVersion');
    const minorVersion = await callChip('getMinorChipVersion');
    const flashVendor = await callChip('getFlashVendor');
    const psramVendor = await callChip('getPsramVendor');
    const flashCap = await callChip('getFlashCap');
    const psramCap = await callChip('getPsramCap');
    const blockVersionMajor = await callChip('getBlkVersionMajor');
    const blockVersionMinor = await callChip('getBlkVersionMinor');

    const flashId = await loader.value.readFlashId().catch(() => undefined);

    const featureList = Array.isArray(featuresRaw)
      ? featuresRaw
      : typeof featuresRaw === 'string'
      ? featuresRaw.split(/,\s*/)
      : [];
    const flashBytesValue = typeof flashSizeKb === 'number' ? flashSizeKb * 1024 : null;
    flashSizeBytes.value = flashBytesValue;
    const flashLabel =
      typeof flashSizeKb === 'number'
        ? flashSizeKb >= 1024
          ? `${(flashSizeKb / 1024).toFixed(flashSizeKb % 1024 === 0 ? 0 : 1)} MB`
          : `${flashSizeKb} KB`
        : null;
    const crystalLabel =
      typeof crystalFreq === 'number' ? `${Number(crystalFreq).toFixed(0)} MHz` : null;
    const macLabel = macAddress || 'Unavailable';

    const chipKey = chip?.CHIP_NAME || chipName;
    const facts = [];
    const pushFact = (label, value) => {
      if (!value) return;
      facts.push({
        label,
        value,
        icon: FACT_ICONS[label] ?? null,
      });
    };
    const packageLabel = resolvePackageLabel(chipKey, packageVersion, chipRevision);
    pushFact('Chip Variant', packageLabel);
    const packageMatch = packageLabel?.match(/\(([^)]+)\)$/);
    if (packageMatch) {
      const detail = PACKAGE_FORM_FACTORS[packageMatch[1]];
      pushFact('Package Form Factor', detail);
    }
    pushFact('Revision', resolveRevisionLabel(chipKey, chipRevision, majorVersion, minorVersion));

    const embeddedFlash = resolveEmbeddedFlash(chipKey, flashCap, flashVendor, featureList);
    pushFact('Embedded Flash', embeddedFlash);

    const embeddedPsram = resolveEmbeddedPsram(chipKey, psramCap, psramVendor, featureList);
    pushFact('Embedded PSRAM', embeddedPsram);

    if (flashVendor && !embeddedFlash) {
      pushFact('Flash Vendor (eFuse)', formatVendorLabel(flashVendor));
    }
    if (psramVendor && !embeddedPsram) {
      pushFact('PSRAM Vendor (eFuse)', formatVendorLabel(psramVendor));
    }

    if (typeof flashId === 'number' && !Number.isNaN(flashId)) {
      const manufacturerCode = flashId & 0xff;
      const manufacturerHex = `0x${manufacturerCode.toString(16).padStart(2, '0').toUpperCase()}`;
      const memoryType = (flashId >> 8) & 0xff;
      const capacityCode = (flashId >> 16) & 0xff;
      const deviceCode = (memoryType << 8) | capacityCode;
      const deviceHex = `0x${memoryType.toString(16).padStart(2, '0').toUpperCase()}${capacityCode
        .toString(16)
        .padStart(2, '0')
        .toUpperCase()}`;
      const manufacturerName = JEDEC_MANUFACTURERS[manufacturerCode];
      const deviceName = JEDEC_FLASH_PARTS[manufacturerCode]?.[deviceCode];
      const capacityBytes = Number.isInteger(capacityCode) ? 2 ** capacityCode : null;
      const formattedCapacity = capacityBytes ? formatBytes(capacityBytes) : null;

      pushFact('Flash ID', `0x${flashId.toString(16).padStart(6, '0').toUpperCase()}`);
      pushFact(
        'Flash Manufacturer',
        manufacturerName ? `${manufacturerName} (${manufacturerHex})` : manufacturerHex
      );
      if (deviceName || formattedCapacity) {
        const detail = formattedCapacity
          ? `${formattedCapacity}${deviceName ? ` - ${deviceName}` : ''}`
          : deviceName;
        pushFact('Flash Device', detail || deviceHex);
      } else {
        pushFact('Flash Device', deviceHex);
      }
    }

    if (
      typeof blockVersionMajor === 'number' &&
      !Number.isNaN(blockVersionMajor) &&
      typeof blockVersionMinor === 'number' &&
      !Number.isNaN(blockVersionMinor)
    ) {
      pushFact('eFuse Block Version', `v${blockVersionMajor}.${blockVersionMinor}`);
    }

    const partitions = await readPartitionTable(loader.value);
    partitionTable.value = partitions;

    if (portDetails) {
      pushFact('USB Bridge', formatUsbBridge(portDetails));
    }

    pushFact('Connection Baud', `${baudrate.toLocaleString()} bps`);

    const featuresDisplay = featureList.filter(Boolean).map(humanizeFeature);

    chipDetails.value = {
      name: chipName,
      description: descriptionRaw || chipName,
      features: featuresDisplay,
      mac: macLabel,
      flashSize: flashLabel,
      crystal: crystalLabel,
      facts,
    };

      connected.value = true;
      appendLog(`Connection established. Ready to flash.`);
  } catch (error) {
    if (error?.name === 'AbortError' || error?.name === 'NotFoundError') {
      appendLog('Port selection was cancelled.');
    } else {
      appendLog(`Connection failed: ${error?.message || error}`, '[error]');
      lastErrorMessage.value = error?.message || String(error);
      showBootDialog.value = true;
    }
    await disconnectTransport();
  } finally {
    busy.value = false;
  }
}

async function disconnect() {
  if (busy.value) return;
  busy.value = true;
  await disconnectTransport();
  appendLog('Serial port disconnected.');
  busy.value = false;
}

function parseOffset(value) {
  if (!value) {
    throw new Error('Flash offset is required.');
  }
  const trimmed = value.trim().toLowerCase();
  const parsed = trimmed.startsWith('0x')
    ? Number.parseInt(trimmed, 16)
    : Number.parseInt(trimmed, 10);
  if (Number.isNaN(parsed)) {
    throw new Error('Invalid flash offset value.');
  }
  return parsed;
}

async function flashFirmware() {
  if (!loader.value || !firmwareBuffer.value) {
    appendLog('Select a firmware binary and connect to a device first.', '[warn]');
    return;
  }
  if (flashInProgress.value || busy.value) return;

  let offsetNumber;
  try {
    offsetNumber = parseOffset(flashOffset.value);
  } catch (error) {
    appendLog(error.message, '[error]');
    return;
  }

  flashInProgress.value = true;
  busy.value = true;
  flashProgress.value = 0;

  appendLog(`Flashing ${firmwareName.value} at 0x${offsetNumber.toString(16)}...`);

  try {
    const bytes = new Uint8Array(firmwareBuffer.value);
    const dataString = loader.value.ui8ToBstr(bytes);
    const startTime = performance.now();

    await loader.value.writeFlash({
      fileArray: [{ data: dataString, address: offsetNumber }],
      flashSize: 'keep',
      flashMode: 'keep',
      flashFreq: 'keep',
      eraseAll: eraseFlash.value,
      compress: true,
      reportProgress: (_fileIndex, written, total) => {
        const pct = total ? Math.floor((written / total) * 100) : 0;
        flashProgress.value = Math.min(100, Math.max(0, pct));
      },
    });

    await loader.value.after('hard_reset');
    const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
  appendLog(`Flashing complete in ${elapsed}s. Device rebooted.`);
  } catch (error) {
    appendLog(`Flashing failed: ${error?.message || error}`, '[error]');
  } finally {
    flashProgress.value = 0;
    flashInProgress.value = false;
    busy.value = false;
  }
}

async function handleFirmwareInput(files) {
  if (!files || files.length === 0) {
    firmwareBuffer.value = null;
    firmwareName.value = '';
    return;
  }
  const file = Array.isArray(files) ? files[0] : files;
  if (!file) return;
  firmwareBuffer.value = await file.arrayBuffer();
  firmwareName.value = file.name;
  appendLog(`Firmware loaded: ${file.name} (${file.size} bytes).`);
}

function applyOffsetPreset(value) {
  if (value) {
    flashOffset.value = value;
    appendLog(`Applied preset offset ${value}.`);
  }
}

function handleBeforeUnload() {
  if (connected.value && transport.value) {
    transport.value.disconnect();
  }
}

onMounted(() => {
  window.addEventListener('beforeunload', handleBeforeUnload);
});

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload);
  disconnectTransport();
});
</script>

<style scoped>
.status-bar {
  border-radius: 12px;
  padding-inline: 12px;
  border: 1px solid color-mix(in srgb, #ffffff 15%, transparent);
}

.status-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.status-button {
  min-width: 140px;
  border-width: 2px;
  transition: background-color 0.2s ease, color 0.2s ease, opacity 0.2s ease;
}

.status-button--active {
  background-color: rgba(255, 255, 255, 0.15) !important;
  color: #ffffff !important;
}

.status-button.v-btn--disabled {
  opacity: 0.6;
  border-color: rgba(255, 255, 255, 0.35) !important;
  color: rgba(255, 255, 255, 0.5) !important;
  background-color: rgba(255, 255, 255, 0.08) !important;
}

.status-logo-avatar {
  background: transparent;
  padding: 2px;
}

.status-logo-avatar :deep(.v-img__img) {
  object-fit: contain;
}

.status-select {
  min-width: 180px;
  max-width: 220px;
}

.status-bar .v-divider {
  height: 36px;
}

</style>



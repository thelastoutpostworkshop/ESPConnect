<template>
  <v-app>
    <v-main>
      <v-container class="py-10" max-width="1100">
        <v-card elevation="8" class="pa-6">
          <v-card-title class="d-flex align-center pa-0 mb-2">
            <div class="text-h5 font-weight-semibold">ESP32 Web Flasher</div>
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
              <v-divider vertical class="mx-4" />
              <div class="text-body-2 text-medium-emphasis">
                {{ statusLabel }}
              </div>
            </div>
            <v-spacer />
            <v-chip
              :color="connected ? 'success' : 'grey-darken-1'"
              :prepend-icon="connected ? 'mdi-usb-port' : 'mdi-usb-off'"
              class="text-capitalize"
              variant="elevated"
              density="comfortable"
            >
              {{ connected ? 'Connected' : 'Disconnected' }}
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
            <v-tab value="flash">Flash Firmware</v-tab>
            <v-tab value="partitions">Partitions</v-tab>
          </v-tabs>

          <v-window v-model="activeTab">
            <v-window-item value="info">
              <v-expand-transition>
                <v-card v-if="chipDetails" class="mb-4" variant="tonal">
                  <v-card-text>
                    <v-row dense>
                      <v-col cols="12" md="6">
                        <div class="text-subtitle-2 text-medium-emphasis">Chip</div>
                        <div class="text-body-1 font-weight-medium">
                          {{ chipDetails.description || chipDetails.name }}
                        </div>
                        <div class="text-caption text-medium-emphasis mt-1">
                          {{ chipDetails.name }}
                        </div>
                      </v-col>
                      <v-col cols="12" md="6">
                        <div class="text-subtitle-2 text-medium-emphasis">Flash</div>
                        <div class="text-body-1 font-weight-medium">
                          {{ chipDetails.flashSize || 'Unknown' }}
                        </div>
                        <div class="text-caption text-medium-emphasis mt-1">
                          Crystal: {{ chipDetails.crystal || 'Unknown' }}
                        </div>
                        <div class="text-caption text-medium-emphasis">
                          MAC: {{ chipDetails.mac || 'Unknown' }}
                        </div>
                      </v-col>
                      <v-col cols="12">
                        <div class="text-subtitle-2 text-medium-emphasis mb-2">Features</div>
                        <v-chip-group column>
                          <v-chip
                            v-for="feature in chipDetails.features"
                            :key="feature"
                            class="me-2 mb-2"
                            size="small"
                            variant="elevated"
                            color="primary"
                          >
                            {{ feature }}
                          </v-chip>
                          <v-chip v-if="!chipDetails.features?.length" size="small" variant="outlined">
                            Not reported
                          </v-chip>
                        </v-chip-group>
                      </v-col>
                      <v-col v-if="chipDetails.facts?.length" cols="12">
                        <div class="text-subtitle-2 text-medium-emphasis mb-3">Extra Details</div>
                        <v-table density="compact" class="extra-details-table">
                          <tbody>
                            <tr v-for="fact in chipDetails.facts" :key="fact.label">
                              <td class="extra-details-label">
                                <div class="d-flex align-center gap-2">
                                  <v-icon v-if="fact.icon" size="16">{{ fact.icon }}</v-icon>
                                  <span>{{ fact.label }}</span>
                                </div>
                              </td>
                              <td class="extra-details-value">{{ fact.value }}</td>
                            </tr>
                          </tbody>
                        </v-table>
                      </v-col>
                    </v-row>
                  </v-card-text>
                </v-card>
              </v-expand-transition>

              <v-card class="mt-6" variant="tonal">
                <v-card-title class="text-subtitle-1 font-weight-medium d-flex align-center">
                  <v-icon class="me-2" size="20">mdi-monitor</v-icon>
                  Session Log
                  <v-spacer />
                  <v-btn
                    variant="text"
                    color="primary"
                    size="small"
                    prepend-icon="mdi-trash-can-outline"
                    :disabled="!logText"
                    @click="clearLog"
                  >
                    Clear
                  </v-btn>
                </v-card-title>
                <v-card-text class="log-surface">
                  <pre class="log-output">{{ logText || 'Logs will appear here once actions begin.' }}</pre>
                </v-card-text>
              </v-card>
            </v-window-item>

            <v-window-item value="flash">
              <v-row class="mb-2" dense>
                <v-col cols="12" md="8">
                  <v-file-input
                    label="Firmware binary (.bin)"
                    prepend-icon="mdi-file-upload"
                    accept=".bin"
                    density="comfortable"
                    :disabled="busy"
                    @update:model-value="handleFirmwareInput"
                  />
                </v-col>
                <v-col cols="12" md="4">
                  <v-text-field
                    v-model="flashOffset"
                    label="Flash offset"
                    placeholder="0x0"
                    density="comfortable"
                    :disabled="busy"
                  />
                </v-col>
                <v-col cols="12" md="4">
                  <v-select
                    v-model="selectedPreset"
                    :items="offsetPresets"
                    label="Recommended offsets"
                    item-title="label"
                    item-value="value"
                    clearable
                    density="comfortable"
                    :disabled="busy"
                    @update:model-value="applyOffsetPreset"
                  />
                </v-col>
              </v-row>

              <v-checkbox
                v-model="eraseFlash"
                label="Erase entire flash before writing"
                density="comfortable"
                hide-details
                class="mb-4"
                :disabled="busy"
              />

              <v-btn
                color="primary"
                size="large"
                block
                :disabled="!canFlash || busy"
                @click="flashFirmware"
              >
                <v-icon start>mdi-lightning-bolt</v-icon>
                Flash Firmware
              </v-btn>

              <v-progress-linear
                v-if="flashInProgress"
                class="mt-4"
                :model-value="flashProgress"
                color="primary"
                height="12"
                rounded
                striped
              >
                <strong>{{ flashProgress }}%</strong>
              </v-progress-linear>
            </v-window-item>

            <v-window-item value="partitions">
              <div v-if="!partitionSegments.length" class="text-body-2 text-medium-emphasis">
                Connect to an ESP32 to load its partition table.
              </div>
              <div v-else class="partition-view">
                <div class="partition-map">
                  <div
                    v-for="segment in partitionSegments"
                    :key="segment.offset"
                    class="partition-segment"
                    :style="{ width: segment.width, backgroundColor: segment.color }"
                  >
                    <span class="partition-label">{{ segment.label || 'Unnamed' }}</span>
                    <span class="partition-meta">
                      {{ segment.sizeText }} — {{ segment.offsetHex }}
                    </span>
                  </div>
                </div>

                <v-table density="comfortable" class="mt-4">
                  <thead>
                    <tr>
                      <th>Label</th>
                      <th>Type</th>
                      <th>Subtype</th>
                      <th>Offset</th>
                      <th>Size</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="entry in formattedPartitions" :key="entry.offset">
                      <td>{{ entry.label || '—' }}</td>
                      <td>{{ entry.typeHex }}</td>
                      <td>{{ entry.subtypeHex }}</td>
                      <td>{{ entry.offsetHex }}</td>
                      <td>{{ entry.sizeText }}</td>
                    </tr>
                  </tbody>
                </v-table>
              </div>
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
                We couldn’t communicate with the board. Try putting your ESP32 into bootloader mode:
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
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { ESPLoader, Transport } from 'esptool-js';
import { useTheme } from 'vuetify';

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
  QFN56: '56-pin QFN (7 mm × 7 mm)',
  QFN32: '32-pin QFN (5 mm × 5 mm)',
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
  'Partition Table': 'mdi-table',
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
      ? `${info.usbVendorId.toString(16).toUpperCase()}:${info.usbProductId
          .toString(16)
          .toUpperCase()}`
      : null;
  const productName = productKey ? USB_PRODUCT_NAMES[productKey] : null;
  if (productName && productHex) {
    return `${vendorName} — ${productName} (${productHex})`;
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
const statusDetails = ref('No device connected.');
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

const partitionSegments = computed(() => {
  if (!partitionTable.value.length) return [];
  const total = partitionTable.value.reduce((sum, entry) => sum + entry.size, 0) || 1;
  const palette = ['#3b82f6', '#22d3ee', '#f59e0b', '#10b981', '#ef4444', '#a855f7', '#14b8a6'];
  return partitionTable.value.map((entry, index) => {
    const widthPercent = Math.max(2, (entry.size / total) * 100);
    return {
      ...entry,
      width: `${widthPercent}%`,
      color: palette[index % palette.length],
      sizeText: formatBytes(entry.size) ?? `${entry.size} bytes`,
      offsetHex: `0x${entry.offset.toString(16).toUpperCase()}`,
      typeHex: `0x${entry.type.toString(16).toUpperCase()}`,
      subtypeHex: `0x${entry.subtype.toString(16).toUpperCase()}`,
    };
  });
});

const formattedPartitions = computed(() =>
  partitionTable.value.map(entry => ({
    ...entry,
    typeHex: `0x${entry.type.toString(16).toUpperCase()}`,
    subtypeHex: `0x${entry.subtype.toString(16).toUpperCase()}`,
    offsetHex: `0x${entry.offset.toString(16).toUpperCase()}`,
    sizeText: formatBytes(entry.size) ?? `${entry.size} bytes`,
  }))
);

const statusLabel = computed(() =>
  connected.value ? statusDetails.value : 'No device connected. Choose a port to begin.'
);

const canFlash = computed(() => connected.value && firmwareBuffer.value && !flashInProgress.value);

function appendLog(message, prefix = '[ui]') {
  const line = prefix ? `${prefix} ${message}` : message;
  logBuffer.value += `${line}\n`;
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
    statusDetails.value = 'No device connected.';
    chipDetails.value = null;
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
          ? `${formattedCapacity}${deviceName ? ` — ${deviceName}` : ''}`
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
    if (partitions.length) {
      const partitionPreview = partitions.slice(0, 3).map(p => {
        const label = p.label || `type 0x${p.type.toString(16)}`;
        const offsetHex = `0x${p.offset.toString(16).toUpperCase()}`;
        const sizeText = formatBytes(p.size) ?? `${p.size} bytes`;
        return `${label} @ ${offsetHex} (${sizeText})`;
      });
      const extraCount = partitions.length - partitionPreview.length;
      const partitionSummary =
        partitionPreview.join(', ') + (extraCount > 0 ? `, … (+${extraCount} more)` : '');
      pushFact('Partition Table', partitionSummary);
    }

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
    statusDetails.value = `Connected to ${chipName} @ ${baudrate} baud.`;
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
.log-surface {
  background: rgba(15, 23, 42, 0.72);
  border-radius: 12px;
  padding: 12px;
  max-height: 320px;
  overflow-y: auto;
}

.log-output {
  margin: 0;
  font-family: 'Roboto Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 0.9rem;
  line-height: 1.45;
  white-space: pre-wrap;
  color: rgba(226, 232, 240, 0.9);
}

.extra-details-table {
  border-radius: 12px;
  background: color-mix(in srgb, var(--v-theme-surface) 80%, transparent);
  border: 1px solid color-mix(in srgb, var(--v-theme-on-surface) 12%, transparent);
  overflow: hidden;
}

.extra-details-table :deep(table) {
  width: 100%;
  border-collapse: collapse;
}

.extra-details-table :deep(td) {
  padding: 10px 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--v-theme-on-surface) 10%, transparent);
}

.extra-details-table :deep(tbody tr:last-child td) {
  border-bottom: none;
}

.extra-details-label {
  color: color-mix(in srgb, var(--v-theme-on-surface) 70%, transparent);
  font-size: 0.85rem;
  letter-spacing: 0.01em;
}

.extra-details-value {
  font-weight: 600;
  font-size: 0.9rem;
  text-align: right;
  color: color-mix(in srgb, var(--v-theme-on-surface) 95%, transparent);
  word-break: break-word;
}

@media (min-width: 960px) {
  .extra-details-value {
    text-align: left;
  }
}

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

.status-select {
  min-width: 180px;
  max-width: 220px;
}

.status-bar .v-divider {
  height: 36px;
}

.partition-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.partition-map {
  display: flex;
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--v-theme-on-surface) 12%, transparent);
  background: color-mix(in srgb, var(--v-theme-surface) 90%, transparent);
}

.partition-segment {
  position: relative;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.95);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
  min-width: 120px;
  box-sizing: border-box;
}

.partition-label {
  font-weight: 600;
  font-size: 0.9rem;
}

.partition-meta {
  font-size: 0.75rem;
  opacity: 0.85;
}

.partition-map:empty::before {
  content: 'No partitions detected.';
  padding: 16px;
  color: color-mix(in srgb, var(--v-theme-on-surface) 60%, transparent);
}
</style>

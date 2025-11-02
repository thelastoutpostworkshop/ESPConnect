<template>
  <v-app>
    <v-main>
      <v-container class="py-10" max-width="1100">
        <v-card elevation="8" class="pa-6">
          <v-card-title class="d-flex align-center pa-0 mb-1">
            <div class="app-title text-h5 font-weight-semibold">
              ESPConnect
              <span class="app-version">v{{ APP_VERSION }}</span>
            </div>
          </v-card-title>
          <v-card-subtitle class="pa-0 text-body-2 text-medium-emphasis mb-3">
            {{ APP_TAGLINE }}
          </v-card-subtitle>

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
                :disabled="busy || flashInProgress || maintenanceBusy || baudChangeBusy || monitorActive"
          />
        </div>
        <v-spacer />
        <div class="status-links">
          <v-btn
            class="status-link"
            color="surface"
            variant="text"
            density="comfortable"
            href="https://www.youtube.com/channel/UCnnU_HGvTr8ewpqvHe2llDw"
            target="_blank"
            rel="noopener"
          >
            <v-icon start>mdi-youtube</v-icon>
            Tutorial
          </v-btn>
          <v-btn
            class="status-link"
            color="surface"
            variant="text"
            density="comfortable"
            href="https://buymeacoffee.com/thelastoutpostworkshop"
            target="_blank"
            rel="noopener"
          >
            <v-icon start>mdi-coffee</v-icon>
            Buy Me a Coffee
          </v-btn>
          <v-btn
            class="status-link"
            color="surface"
            variant="text"
            density="comfortable"
            href="https://github.com/thelastoutpostworkshop/ESP32PartitionBuilder"
            target="_blank"
            rel="noopener"
          >
            <v-icon start>mdi-lifebuoy</v-icon>
            Get Help
          </v-btn>
        </div>
        <v-btn
          :title="`Switch to ${isDarkTheme ? 'light' : 'dark'} theme`"
          variant="text"
          icon
          color="surface"
          size="small"
          class="status-theme-toggle"
          @click="toggleTheme"
        >
          <v-icon>{{ themeIcon }}</v-icon>
        </v-btn>
        <v-chip
          :color="connected ? 'success' : 'grey-darken-1'"
          class="text-capitalize"
          variant="elevated"
          density="comfortable"
        >
          <template #prepend>
            <v-icon
              v-if="connected"
              start
              class="status-chip-icon status-chip-icon--connected"
            >
              mdi-usb-port
            </v-icon>
            <v-icon
              v-else
              start
              class="status-chip-icon status-chip-icon--disconnected"
            >
              mdi-usb-c-port
            </v-icon>
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
            <v-tab value="flash">Firmware Tools</v-tab>
            <v-tab value="console">Serial Monitor</v-tab>
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
                :flash-progress-dialog="flashProgressDialog"
                :maintenance-busy="maintenanceBusy"
                :register-address="registerAddress"
                :register-value="registerValue"
                :register-read-result="registerReadResult"
                :register-status="registerStatus"
                :register-status-type="registerStatusType"
                :register-options="registerOptions"
                :register-reference="registerReference"
                :md5-offset="md5Offset"
                :md5-length="md5Length"
                :md5-result="md5Result"
                :md5-status="md5Status"
                :md5-status-type="md5StatusType"
                :flash-read-offset="flashReadOffset"
                :flash-read-length="flashReadLength"
                :flash-read-status="flashReadStatus"
                :flash-read-status-type="flashReadStatusType"
                :partition-options="partitionDownloadOptions"
                :selected-partition="selectedPartitionDownload"
                :integrity-partition="integrityPartition"
                :spiffs-agent-status="spiffsAgent"
                :download-progress="downloadProgress"
                @firmware-input="handleFirmwareInput"
                @flash="flashFirmware"
                @apply-preset="applyOffsetPreset"
                @update:register-address="value => (registerAddress.value = value)"
                @update:register-value="value => (registerValue.value = value)"
                @read-register="handleReadRegister"
                @write-register="handleWriteRegister"
                @update:md5-offset="value => (md5Offset.value = value)"
                @update:md5-length="value => (md5Length.value = value)"
                @compute-md5="handleComputeMd5"
                @update:flash-read-offset="value => (flashReadOffset.value = value)"
                @update:flash-read-length="value => (flashReadLength.value = value)"
                @update:selected-partition="handleSelectPartition"
                @update:integrity-partition="handleSelectIntegrityPartition"
                @load-spiffs-agent="handleLoadSpiffsAgent"
                @deploy-spiffs-agent="handleDeploySpiffsAgent"
                @spiffs-list="handleListSpiffsFiles"
                @spiffs-delete="handleDeleteSpiffsFile"
                @spiffs-upload="handleUploadSpiffsFile"
                @spiffs-download="handleDownloadSpiffsFile"
                @spiffs-format="handleFormatSpiffsAgent"
                @spiffs-reset="handleResetSpiffsAgent"
                @download-flash="handleDownloadFlash"
                @download-partition="handleDownloadPartition"
                @download-all-partitions="handleDownloadAllPartitions"
                @download-used-flash="handleDownloadUsedFlash"
                @cancel-flash="handleCancelFlash"
                @erase-flash="handleEraseFlash"
                @cancel-download="handleCancelDownload"
                @select-register="handleSelectRegister"
              />
            </v-window-item>

            <v-window-item value="console">
              <SerialMonitorTab
                :monitor-text="monitorText"
                :monitor-active="monitorActive"
                :monitor-error="monitorError"
                :can-start="canStartMonitor"
                :can-command="canIssueMonitorCommands"
                @start-monitor="startMonitor"
                @stop-monitor="stopMonitor"
                @clear-monitor="clearMonitorOutput"
                @reset-board="resetBoard"
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

        <v-dialog
          :model-value="confirmationDialog.visible"
          max-width="420"
          @update:model-value="value => {
            if (!value) resolveConfirmation(false);
          }"
        >
          <v-card>
            <v-card-title class="text-h6">
              <v-icon
                start
                :color="confirmationDialog.destructive ? 'error' : 'warning'"
              >mdi-alert-circle-outline</v-icon>
              {{ confirmationDialog.title || 'Please confirm' }}
            </v-card-title>
            <v-card-text class="text-body-2">
              <div class="confirmation-message">
                {{ confirmationDialog.message }}
              </div>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn
                variant="text"
                @click="resolveConfirmation(false)"
              >
                {{ confirmationDialog.cancelText || 'Cancel' }}
              </v-btn>
              <v-btn
                :color="confirmationDialog.destructive ? 'error' : 'primary'"
                variant="tonal"
                @click="resolveConfirmation(true)"
              >
                {{ confirmationDialog.confirmText || 'Continue' }}
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

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
                <li>Press and hold the <strong>BOOT</strong> (GPIO0) button and keep it held down.</li>
                <li>Tap <strong>RESET</strong>, then release only the RESET button.</li>
                <li>While still holding BOOT, click <strong>Connect</strong>.</li>
                <li>Release the BOOT button once the log shows the ESP-ROM banner or the connection completes.</li>
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
import DeviceInfoTab from './components/DeviceInfoTab.vue';
import FlashFirmwareTab from './components/FlashFirmwareTab.vue';
import PartitionsTab from './components/PartitionsTab.vue';
import SessionLogTab from './components/SessionLogTab.vue';
import SerialMonitorTab from './components/SerialMonitorTab.vue';
import registerGuides from './data/register-guides.json';

const APP_VERSION = '0.1';
const APP_TAGLINE = 'Flash, back up, and troubleshoot your ESP32 straight from the browser.';

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
  AP_3v3: 'AP Memory 3.3 V',
  AP_1v8: 'AP Memory 1.8 V',
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

const FACT_DISPLAY_ORDER = [
  'Chip Variant',
  'Package Form Factor',
  'Revision',
  'Embedded Flash',
  'Embedded PSRAM',
  'Flash ID',
  'Flash Manufacturer',
  'Flash Device',
  'Flash Vendor (eFuse)',
  'PSRAM Vendor (eFuse)',
  'eFuse Block Version',
  'USB Bridge',
  'Connection Baud',
];

const FACT_GROUP_CONFIG = [
  {
    title: 'Package & Revision',
    icon: 'mdi-chip',
    labels: ['Chip Variant', 'Package Form Factor', 'Revision'],
  },
  {
    title: 'Embedded Memory',
    icon: 'mdi-memory',
    labels: [
      'Embedded Flash',
      'Embedded PSRAM',
      'Flash ID',
      'Flash Manufacturer',
      'Flash Device',
      'Flash Vendor (eFuse)',
      'PSRAM Vendor (eFuse)',
    ],
  },
  {
    title: 'Security',
    icon: 'mdi-shield-key-outline',
    labels: ['eFuse Block Version'],
  },
  {
    title: 'Connection',
    icon: 'mdi-usb-port',
    labels: ['USB Bridge', 'Connection Baud'],
  },
];

function sortFacts(facts) {
  return [...facts].sort((a, b) => {
    const orderA = FACT_DISPLAY_ORDER.indexOf(a.label);
    const orderB = FACT_DISPLAY_ORDER.indexOf(b.label);
    const hasOrderA = orderA !== -1;
    const hasOrderB = orderB !== -1;

    if (hasOrderA && hasOrderB) {
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return a.label.localeCompare(b.label);
    }

    if (hasOrderA) return -1;
    if (hasOrderB) return 1;

    return a.label.localeCompare(b.label);
  });
}

function buildFactGroups(facts) {
  const groups = [];
  const assigned = new Set();

  for (const config of FACT_GROUP_CONFIG) {
    const items = facts.filter(fact => {
      if (assigned.has(fact.label)) return false;
      return config.labels.includes(fact.label);
    });
    if (items.length) {
      items.forEach(item => assigned.add(item.label));
      groups.push({
        title: config.title,
        icon: config.icon,
        items,
      });
    }
  }

  const remaining = facts.filter(fact => !assigned.has(fact.label));
  if (remaining.length) {
    groups.push({
      title: 'Additional Details',
      icon: 'mdi-clipboard-text-outline',
      items: remaining,
    });
  }

  return groups;
}

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
const flashProgressDialog = reactive({ visible: false, value: 0, label: '' });
const flashCancelRequested = ref(false);
const selectedBaud = ref('115200');
const baudrateOptions = ['115200', '230400', '460800', '921600'];
const flashOffset = ref('0x0');
const eraseFlash = ref(false);
const selectedPreset = ref(null);
const selectedPartitionDownload = ref(null);
const integrityPartition = ref(null);
const currentBaud = ref(DEFAULT_ROM_BAUD);
const baudChangeBusy = ref(false);
const maintenanceBusy = ref(false);
const downloadProgress = reactive({ visible: false, value: 0, label: '' });
const downloadCancelRequested = ref(false);
const registerAddress = ref('0x0');
const registerValue = ref('');
const registerReadResult = ref(null);
const registerStatus = ref(null);
const registerStatusType = ref('info');
const registerOptions = ref([]);
const registerReference = ref(null);
const registerOptionLookup = computed(() => {
  const map = new Map();
  for (const option of registerOptions.value) {
    const normalized = normalizeRegisterAddressValue(option.address);
    if (normalized && !map.has(normalized)) {
      map.set(normalized, {
        ...option,
        address: normalized,
      });
    }
  }
  return map;
});
const md5Offset = ref('0x0');
const md5Length = ref('');
const md5Result = ref(null);
const md5Status = ref(null);
const md5StatusType = ref('info');
const flashReadOffset = ref('0x0');
const flashReadLength = ref('');
const flashReadStatus = ref(null);
const flashReadStatusType = ref('info');
const spiffsAgent = reactive({
  loading: false,
  loaded: false,
  size: 0,
  error: null,
  binary: null,
  uploading: false,
  running: false,
  busy: false,
  status: '',
  files: [],
});
const spiffsAgentRuntime = {
  buffer: '',
  decoder: null,
  encoder: new TextEncoder(),
};
const SPIFFS_AGENT_LINE_TIMEOUT = 6000;
const SPIFFS_AGENT_BASE64_CHUNK = 57;

function clearSpiffsAgentDecoder() {
  if (spiffsAgentRuntime.decoder) {
    try {
      spiffsAgentRuntime.decoder.decode(new Uint8Array(), { stream: false });
    } catch (err) {
      console.warn('SPIFFS agent decoder flush failed', err);
    }
  }
  spiffsAgentRuntime.decoder = null;
  spiffsAgentRuntime.buffer = '';
}

function setSpiffsAgentIdleStatus() {
  if (spiffsAgent.loaded) {
    const sizeLabel = spiffsAgent.size ? spiffsAgent.size.toLocaleString() : 'unknown';
    spiffsAgent.status = `Stub cached (${sizeLabel} bytes). Ready to upload.`;
  } else {
    spiffsAgent.status = 'Stub not loaded yet.';
  }
}

function resetSpiffsAgentSession(options = {}) {
  const { preserveBinary = true } = options;
  spiffsAgent.uploading = false;
  spiffsAgent.running = false;
  spiffsAgent.busy = false;
  spiffsAgent.files = [];
  if (!preserveBinary) {
    spiffsAgent.binary = null;
    spiffsAgent.loaded = false;
    spiffsAgent.size = 0;
  }
  clearSpiffsAgentDecoder();
  setSpiffsAgentIdleStatus();
}

setSpiffsAgentIdleStatus();
const logBuffer = ref('');
const monitorText = ref('');
const monitorActive = ref(false);
const monitorError = ref(null);
const monitorAbortController = ref(null);
const MONITOR_BUFFER_LIMIT = 20000;
let monitorPendingText = '';
let monitorFlushHandle = null;
let monitorFlushUsingAnimationFrame = false;
const confirmationDialog = reactive({
  visible: false,
  title: '',
  message: '',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  destructive: false,
});
let confirmationResolver = null;
const currentPort = ref(null);
const transport = ref(null);
const loader = ref(null);
const firmwareBuffer = ref(null);
const firmwareName = ref('');
const chipDetails = ref(null);
const partitionTable = ref([]);
const activeTab = ref('info');
const flashSizeBytes = ref(null);

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

watch(selectedBaud, async (value, oldValue) => {
  if (value === oldValue) {
    return;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    appendLog('Ignoring invalid baud selection: ' + value, '[warn]');
    if (oldValue != null) {
      selectedBaud.value = oldValue;
    } else {
      selectedBaud.value = String(currentBaud.value);
    }
    return;
  }
  if (!connected.value || !loader.value) {
    currentBaud.value = parsed;
    return;
  }
  if (parsed === currentBaud.value) {
    return;
  }
  if (busy.value || flashInProgress.value || maintenanceBusy.value || baudChangeBusy.value || monitorActive.value) {
    appendLog('Cannot change baud while operations are running. Keeping ' + currentBaud.value.toLocaleString() + ' bps.', '[warn]');
    selectedBaud.value = String(currentBaud.value);
    return;
  }
  try {
    baudChangeBusy.value = true;
    appendLog('Changing baud to ' + parsed.toLocaleString() + ' bps...', '[debug]');
    loader.value.baudrate = parsed;
    await loader.value.changeBaud(parsed);
    currentBaud.value = parsed;
    if (transport.value) {
      transport.value.baudrate = parsed;
    }
    selectedBaud.value = String(parsed);
    appendLog('Baud changed to ' + parsed.toLocaleString() + ' bps.', '[debug]');
  } catch (error) {
    appendLog('Baud change failed: ' + (error && error.message ? error.message : error), '[warn]');
    selectedBaud.value = String(currentBaud.value);
  } finally {
    baudChangeBusy.value = false;
  }
});

function normalizeRegisterAddressValue(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const stringValue = typeof value === 'string' ? value.trim() : value.toString();
  if (!stringValue) {
    return null;
  }
  const numeric = stringValue.startsWith('0x') || stringValue.startsWith('0X')
    ? Number.parseInt(stringValue, 16)
    : Number.parseInt(stringValue, 10);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return null;
  }
  return '0x' + numeric.toString(16).toUpperCase();
}

function applyRegisterGuide(chipKey) {
  const guide = chipKey ? registerGuides?.[chipKey] : undefined;
  if (!guide) {
    registerOptions.value = [];
    registerReference.value = null;
    return;
  }
  registerReference.value = guide.reference || null;
  registerOptions.value = (guide.registers || []).map(entry => {
    const normalized = normalizeRegisterAddressValue(entry.address);
    return {
      label: entry.name,
      address: normalized || entry.address,
      description: entry.description || '',
      link: entry.url || guide.reference?.url || null,
    };
  });
}

function showConfirmation(options = {}) {
  return new Promise(resolve => {
    confirmationResolver = resolve;
    confirmationDialog.title = options.title || 'Please confirm';
    confirmationDialog.message = options.message || '';
    confirmationDialog.confirmText = options.confirmText || 'Confirm';
    confirmationDialog.cancelText = options.cancelText || 'Cancel';
    confirmationDialog.destructive = !!options.destructive;
    confirmationDialog.visible = true;
  });
}

function resolveConfirmation(result) {
  if (!confirmationDialog.visible) {
    if (confirmationResolver) {
      confirmationResolver(result);
      confirmationResolver = null;
    }
    return;
  }
  confirmationDialog.visible = false;
  const resolver = confirmationResolver;
  confirmationResolver = null;
  if (resolver) {
    resolver(result);
  }
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
  if (!connected.value) {
    return [];
  }
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

  const reservedRows = RESERVED_SEGMENTS.map(segment => {
    const offsetHex = `0x${segment.offset.toString(16).toUpperCase()}`;
    const sizeText = formatBytes(segment.size) ?? `${segment.size} bytes`;
    return {
      label: segment.label,
      typeLabel: 'Reserved',
      subtypeLabel: 'Reserved',
      typeHex: 'N/A',
      subtypeHex: 'N/A',
      offset: segment.offset,
      offsetHex,
      size: segment.size,
      sizeText,
      color: segment.color,
      backgroundImage: null,
    };
  });

  const partitionRows = partitionTable.value.map((entry, index) => {
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

  return [...reservedRows, ...partitionRows].sort((a, b) => a.offset - b.offset);
});

const partitionDownloadOptions = computed(() => {
  return formattedPartitions.value
    .filter(row => !row.isUnused && row.size > 0)
    .map(row => {
      const baseLabel = row.label && row.label.trim() ? row.label.trim() : 'Partition ' + row.typeHex;
      const displayLabel = baseLabel + ' • ' + row.offsetHex + ' • ' + row.sizeText;
      return {
        label: displayLabel,
        value: row.offset,
        offset: row.offset,
        size: row.size,
        offsetHex: row.offsetHex,
        sizeText: row.sizeText,
        baseLabel,
        typeHex: row.typeHex,
        subtypeHex: row.subtypeHex,
      };
    });
});

const partitionOptionLookup = computed(() => {
  const map = new Map();
  for (const option of partitionDownloadOptions.value) {
    map.set(option.value, option);
  }
  return map;
});

watch(partitionDownloadOptions, options => {
  if (!options.some(option => option.value === selectedPartitionDownload.value)) {
    selectedPartitionDownload.value = null;
    flashReadOffset.value = '0x0';
    flashReadLength.value = '';
  }
  if (!options.some(option => option.value === integrityPartition.value)) {
    integrityPartition.value = null;
  }
});

watch([md5Offset, md5Length], ([offsetValue, lengthValue]) => {
  if (integrityPartition.value == null) {
    return;
  }
  const option = partitionOptionLookup.value.get(integrityPartition.value);
  if (!option) {
    integrityPartition.value = null;
    return;
  }
  const normalizedOffset = normalizeRegisterAddressValue(offsetValue);
  const expectedOffset = normalizeRegisterAddressValue(option.offsetHex);
  const normalizedLength = normalizeRegisterAddressValue(lengthValue);
  const expectedLength = normalizeRegisterAddressValue('0x' + option.size.toString(16).toUpperCase());
  if (normalizedOffset !== expectedOffset || normalizedLength !== expectedLength) {
    integrityPartition.value = null;
  }
});

const connectionChipLabel = computed(() => {
  if (!connected.value) {
    return 'Disconnected';
  }

  const name = chipDetails.value?.name?.trim();
  return name ? `${name}` : 'Connected';
});

const canFlash = computed(
  () =>
    connected.value &&
    Boolean(firmwareBuffer.value) &&
    !flashInProgress.value &&
    !spiffsAgent.running
);

function appendLog(message, prefix = '[ui]') {
  const line = prefix ? `${prefix} ${message}` : message;
  logBuffer.value += `${line}\n`;
}

const logText = computed(() => logBuffer.value);

const canStartMonitor = computed(
  () => connected.value && !busy.value && !flashInProgress.value && Boolean(transport.value)
);
const canIssueMonitorCommands = computed(() => connected.value && Boolean(transport.value));

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

let monitorDecoder = null;
let monitorNoiseChunks = 0;
let monitorNoiseWarned = false;
let monitorAutoResetPerformed = false;

function cancelMonitorFlush() {
  if (monitorFlushHandle === null) {
    return;
  }
  if (monitorFlushUsingAnimationFrame && typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
    window.cancelAnimationFrame(monitorFlushHandle);
  } else {
    clearTimeout(monitorFlushHandle);
  }
  monitorFlushHandle = null;
  monitorFlushUsingAnimationFrame = false;
}

function flushPendingMonitorText() {
  if (!monitorPendingText) {
    return;
  }
  monitorText.value += monitorPendingText;
  monitorPendingText = '';
  if (monitorText.value.length > MONITOR_BUFFER_LIMIT) {
    monitorText.value = monitorText.value.slice(-MONITOR_BUFFER_LIMIT);
  }
}

function scheduleMonitorFlush() {
  if (monitorFlushHandle !== null) {
    return;
  }
  const flush = () => {
    monitorFlushHandle = null;
    monitorFlushUsingAnimationFrame = false;
    flushPendingMonitorText();
  };
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    monitorFlushUsingAnimationFrame = true;
    monitorFlushHandle = window.requestAnimationFrame(flush);
  } else {
    monitorFlushHandle = setTimeout(flush, 16);
  }
}

async function releaseTransportReader() {
  const transportInstance = transport.value;
  const reader = transportInstance?.reader;
  if (!reader) {
    return;
  }
  try {
    await reader.cancel();
  } catch (err) {
    appendLog(`Monitor reader cancel failed: ${err?.message || err}`, '[debug]');
  }
  try {
    reader.releaseLock?.();
  } catch (err) {
    appendLog(`Monitor reader release failed: ${err?.message || err}`, '[debug]');
  }
  transportInstance.reader = null;
}

function appendMonitorChunk(bytes) {
  if (!bytes || !bytes.length) return;
  if (!monitorDecoder) {
    monitorDecoder = new TextDecoder();
  }
  const text = monitorDecoder.decode(bytes, { stream: true });
  if (!text) return;
  const printable = text.replace(/[^\x20-\x7e\r\n\t]/g, '');
  if (text.length > 0) {
    const readableRatio = printable.length / text.length;
    if (readableRatio < 0.2) {
      monitorNoiseChunks += 1;
      if (!monitorNoiseWarned && monitorNoiseChunks >= 3 && !monitorError.value) {
        const activeBaud =
          transport.value?.baudrate ||
          Number.parseInt(selectedBaud.value, 10) ||
          DEFAULT_ROM_BAUD;
        monitorError.value =
          `Monitor data looks binary. Check that the device UART baud matches the selected ` +
          `rate (currently ${activeBaud.toLocaleString()} bps). Try switching to 115200 bps and reconnecting.`;
        monitorNoiseWarned = true;
      }
    } else {
      monitorNoiseChunks = 0;
      if (
        monitorNoiseWarned &&
        monitorError.value &&
        monitorError.value.startsWith('Monitor data looks binary.')
      ) {
        monitorError.value = null;
      }
      monitorNoiseWarned = false;
    }
  }
  monitorPendingText += text;
  if (monitorPendingText.length > MONITOR_BUFFER_LIMIT * 2) {
    monitorPendingText = monitorPendingText.slice(-MONITOR_BUFFER_LIMIT * 2);
  }
  scheduleMonitorFlush();
}

function clearMonitorOutput() {
  cancelMonitorFlush();
  monitorText.value = '';
  monitorPendingText = '';
  monitorError.value = null;
  monitorNoiseChunks = 0;
  monitorNoiseWarned = false;
}

function ensureTransportReader() {
  const transportInstance = transport.value;
  if (!transportInstance) return null;
  if (!transportInstance.reader && transportInstance.device?.readable?.getReader) {
    transportInstance.reader = transportInstance.device.readable.getReader();
  }
  return transportInstance.reader ?? null;
}

async function monitorLoop(signal) {
  if (!transport.value || typeof transport.value.rawRead !== 'function') {
    throw new Error('Serial monitor not supported by current transport.');
  }
  if (!ensureTransportReader()) {
    throw new Error('Serial reader unavailable.');
  }
  const iterator = transport.value.rawRead();
  for await (const chunk of iterator) {
    if (signal.aborted) break;
    if (!chunk || !chunk.length) continue;
    appendMonitorChunk(chunk);
  }
  flushPendingMonitorText();
}

async function startMonitor() {
  if (!canStartMonitor.value || monitorActive.value) {
    return;
  }
  if (!transport.value) {
    appendLog('Monitor unavailable: transport not ready.', '[warn]');
    return;
  }
  if (!monitorAutoResetPerformed) {
    await releaseTransportReader();
    appendLog('Auto-resetting board before starting serial monitor output.', '[debug]');
    await resetBoard({ silent: true });
    monitorAutoResetPerformed = true;
  }
  monitorError.value = null;
  cancelMonitorFlush();
  flushPendingMonitorText();
  monitorPendingText = '';
  monitorDecoder = new TextDecoder();
  monitorNoiseChunks = 0;
  monitorNoiseWarned = false;
  const controller = new AbortController();
  monitorAbortController.value = controller;
  monitorActive.value = true;
  appendLog('Serial monitor started.', '[debug]');
  (async () => {
    try {
      await monitorLoop(controller.signal);
    } catch (err) {
      if (!controller.signal.aborted) {
        monitorError.value = err?.message || String(err);
        appendLog(`Monitor error: ${monitorError.value}`, '[warn]');
      }
    } finally {
      if (monitorAbortController.value === controller) {
        monitorAbortController.value = null;
      }
      monitorActive.value = false;
    }
  })();
}

async function stopMonitor() {
  if (!monitorActive.value) return;
  monitorAbortController.value?.abort();
  await releaseTransportReader();
  monitorActive.value = false;
  monitorAbortController.value = null;
  cancelMonitorFlush();
  flushPendingMonitorText();
  monitorPendingText = '';
  if (monitorDecoder) {
    try {
      monitorDecoder.decode(new Uint8Array(), { stream: false });
    } catch (err) {
      console.warn('Monitor decoder flush failed', err);
    }
    monitorDecoder = null;
  }
  appendLog('Serial monitor stopped.', '[debug]');
}

async function resetBoard(options = {}) {
  const { silent = false } = options;
  if (!transport.value) {
    appendLog('Cannot reset: transport not available.', '[warn]');
    return;
  }
  try {
    if (!silent) {
      appendLog('Resetting board (toggle RTS).', '[debug]');
    }
    await transport.value.setDTR(false);
    await transport.value.setRTS(true);
    await loader.value?.sleep?.(120);
    await transport.value.setRTS(false);
  } catch (err) {
    appendLog(`Board reset failed: ${err?.message || err}`, '[error]');
  }
}

async function disconnectTransport() {
  try {
    if (monitorActive.value) {
      await stopMonitor();
    } else {
      monitorAbortController.value?.abort();
      monitorAbortController.value = null;
      monitorActive.value = false;
    }
    cancelMonitorFlush();
    flushPendingMonitorText();
    monitorPendingText = '';
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
      monitorError.value = null;
      monitorText.value = '';
      monitorAutoResetPerformed = false;
      resetMaintenanceState();
      currentBaud.value = DEFAULT_ROM_BAUD;
      baudChangeBusy.value = false;
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
  monitorAutoResetPerformed = false;
  resetMaintenanceState();

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
    currentBaud.value = baudrate;
    transport.value.baudrate = baudrate;

    const chipName = await loader.value.main('default_reset');
    const chip = loader.value.chip;
    connected.value = true;
    appendLog(`Handshake complete with ${chipName}. Collecting device details...`, '[debug]');
    if (chip?.CHIP_NAME === 'ESP32-C6' && chip.SPI_REG_BASE === 0x60002000) {
      chip.SPI_REG_BASE = 0x60003000;
      appendLog(
        'Applied ESP32-C6 SPI register base workaround (0x60002000 → 0x60003000).',
        '[debug]'
      );
    }

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
    const manufacturerCode =
      typeof flashId === 'number' && Number.isFinite(flashId) ? flashId & 0xff : null;
    const memoryTypeCode =
      typeof flashId === 'number' && Number.isFinite(flashId) ? (flashId >> 8) & 0xff : null;
    const capacityCodeRaw =
      typeof flashId === 'number' && Number.isFinite(flashId) ? (flashId >> 16) & 0xff : null;
    appendLog(
      `Flash detect raw: getFlashSize=${Number.isFinite(flashSizeKb) ? `${flashSizeKb} KB` : 'n/a'}, flashId=${typeof flashId === 'number' && Number.isFinite(flashId) ? `0x${flashId
        .toString(16)
        .padStart(6, '0')
        .toUpperCase()}` : 'n/a'} (manuf=0x${Number.isInteger(manufacturerCode)
        ? manufacturerCode.toString(16).toUpperCase().padStart(2, '0')
        : '??'}, type=0x${Number.isInteger(memoryTypeCode)
        ? memoryTypeCode.toString(16).toUpperCase().padStart(2, '0')
        : '??'}, cap=0x${Number.isInteger(capacityCodeRaw)
        ? capacityCodeRaw.toString(16).toUpperCase().padStart(2, '0')
        : '??'})`,
      '[debug]'
    );

    const featureList = Array.isArray(featuresRaw)
      ? featuresRaw
      : typeof featuresRaw === 'string'
      ? featuresRaw.split(/,\s*/)
      : [];
    let flashBytesValue = null;
    let flashLabelSuffix = '';
    if (typeof flashSizeKb === 'number' && flashSizeKb > 0) {
      flashBytesValue = flashSizeKb * 1024;
    } else {
      const capacityCandidates = [capacityCodeRaw, memoryTypeCode, manufacturerCode].filter(
        value =>
          Number.isInteger(value) &&
          value >= 0x12 &&
          value <= 0x26
      );
      for (const candidate of capacityCandidates) {
        const fallbackFlashBytes = Math.pow(2, candidate);
        if (Number.isFinite(fallbackFlashBytes) && fallbackFlashBytes > 0) {
          flashBytesValue = fallbackFlashBytes;
          flashLabelSuffix = ' (via RDID)';
          appendLog(
            `Flash size detection fallback: using JEDEC capacity code 0x${candidate
              .toString(16)
              .toUpperCase()} from flash ID 0x${flashId
              ?.toString(16)
              .padStart(6, '0')
              .toUpperCase()}.`,
            '[warn]'
          );
          break;
        }
      }
    }
    const toHexByte = value =>
      Number.isInteger(value) && value >= 0
        ? value.toString(16).toUpperCase().padStart(2, '0')
        : '??';
    if (!flashBytesValue && typeof flashId === 'number' && !Number.isNaN(flashId)) {
      appendLog(
        `Flash size detection fallback unavailable. Flash ID 0x${flashId
          .toString(16)
          .padStart(6, '0')
          .toUpperCase()} (manuf=0x${toHexByte(manufacturerCode)}, type=0x${toHexByte(
          memoryTypeCode
        )}, cap=0x${toHexByte(capacityCodeRaw)}).`,
        '[warn]'
      );
    }

    flashSizeBytes.value = flashBytesValue;
    const flashLabel =
      flashBytesValue && flashBytesValue > 0
        ? `${formatBytes(flashBytesValue)}${flashLabelSuffix}`
        : null;
    const crystalLabel =
      typeof crystalFreq === 'number' ? `${Number(crystalFreq).toFixed(0)} MHz` : null;
    const macLabel = macAddress || 'Unavailable';

    const chipKey = chip?.CHIP_NAME || chipName;
    applyRegisterGuide(chipKey);
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
    const orderedFacts = sortFacts(facts);
    const factGroups = buildFactGroups(orderedFacts);

    chipDetails.value = {
      name: chipName,
      description: descriptionRaw || chipName,
      features: featuresDisplay,
      mac: macLabel,
      flashSize: flashLabel,
      crystal: crystalLabel,
      facts: orderedFacts,
      factGroups,
    };
    activeTab.value = 'info';
    appendLog(
      `Loaded device details: ${chipDetails.value.name}, ${orderedFacts.length} facts.`,
      '[debug]'
    );

    connected.value = true;
    showBootDialog.value = false;
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
    appendLog(`Connect flow finished (busy=${busy.value}).`, '[debug]');
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

function parseNumericInput(value, label) {
  if (!value || !value.toString().trim()) {
    throw new Error(`${label} is required.`);
  }
  const trimmed = value.toString().trim().toLowerCase();
  const parsed = trimmed.startsWith('0x')
    ? Number.parseInt(trimmed, 16)
    : Number.parseInt(trimmed, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid ${label.toLowerCase()} value.`);
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

  const firmwareLabel = firmwareName.value || 'selected firmware';
  const activeBaudRaw =
    transport.value?.baudrate ||
    currentBaud.value ||
    Number.parseInt(selectedBaud.value, 10) ||
    DEFAULT_ROM_BAUD;
  const flashBaud = Number.isFinite(activeBaudRaw) ? activeBaudRaw : DEFAULT_ROM_BAUD;
  const flashBaudLabel = flashBaud.toLocaleString() + ' bps';
  const confirmFlash = await showConfirmation({
    title: 'Confirm Flash',
    message:
      `Flash ${firmwareLabel} at 0x${offsetNumber.toString(16).toUpperCase()}?\n` +
      'This will overwrite the target region and may erase existing data.',
    confirmText: 'Flash',
    cancelText: 'Cancel',
    destructive: true,
  });
  if (!confirmFlash) {
    appendLog('Firmware flash cancelled by user.', '[warn]');
    return;
  }

  flashInProgress.value = true;
  busy.value = true;
  flashProgress.value = 0;
  flashCancelRequested.value = false;
  flashProgressDialog.visible = true;
  flashProgressDialog.value = 0;
  flashProgressDialog.label = `Preparing ${firmwareLabel} @ ${flashBaudLabel}...`;

  appendLog(`Flashing ${firmwareLabel} at 0x${offsetNumber.toString(16)}...`);

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
        if (flashCancelRequested.value) {
          throw new Error('Flash cancelled by user');
        }
        const pct = total ? Math.floor((written / total) * 100) : 0;
        const clamped = Math.min(100, Math.max(0, pct));
        flashProgress.value = clamped;
        flashProgressDialog.visible = true;
        flashProgressDialog.value = clamped;
        const writtenLabel = written.toLocaleString();
        const totalLabel = total ? total.toLocaleString() : '';
        flashProgressDialog.label = total
          ? `Flashing ${firmwareLabel} — ${writtenLabel} of ${totalLabel} bytes @ ${flashBaudLabel}`
          : `Flashing ${firmwareLabel} — ${writtenLabel} bytes @ ${flashBaudLabel}`;
      },
    });

    await loader.value.after('hard_reset');
    const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
    flashProgressDialog.value = 100;
    flashProgressDialog.label = `Flash complete in ${elapsed}s @ ${flashBaudLabel}. Finalizing...`;
    appendLog(`Flashing complete in ${elapsed}s. Device rebooted.`);
  } catch (error) {
    if (error?.message === 'Flash cancelled by user') {
      appendLog('Flash cancelled by user.', '[warn]');
    } else {
      appendLog(`Flashing failed: ${error?.message || error}`, '[error]');
    }
  } finally {
    flashProgress.value = 0;
    flashInProgress.value = false;
    busy.value = false;
    flashCancelRequested.value = false;
    flashProgressDialog.visible = false;
    flashProgressDialog.value = 0;
    flashProgressDialog.label = '';
  }
}

function resetMaintenanceState() {
  maintenanceBusy.value = false;
  registerStatus.value = null;
  registerStatusType.value = 'info';
  registerReadResult.value = null;
  registerValue.value = '';
  registerAddress.value = '0x0';
  registerOptions.value = [];
  registerReference.value = null;
  md5Result.value = null;
  md5Status.value = null;
  md5StatusType.value = 'info';
  md5Offset.value = '0x0';
  md5Length.value = '';
  integrityPartition.value = null;
  flashReadStatus.value = null;
  flashReadStatusType.value = 'info';
  flashReadOffset.value = '0x0';
  flashReadLength.value = '';
  selectedPartitionDownload.value = null;
  flashProgressDialog.visible = false;
  flashProgressDialog.value = 0;
  flashProgressDialog.label = '';
  flashCancelRequested.value = false;
  downloadProgress.visible = false;
  downloadProgress.value = 0;
  downloadProgress.label = '';
  resetSpiffsAgentSession({ preserveBinary: true });
}

function handleSelectRegister(address) {
  if (!address) {
    return;
  }
  const normalized = normalizeRegisterAddressValue(address);
  if (!normalized) {
    return;
  }
  const guide = registerOptionLookup.value.get(normalized);
  registerAddress.value = guide?.address ?? normalized;
  if (guide) {
    registerReadResult.value = null;
    registerStatusType.value = 'info';
    registerStatus.value = guide.description
      ? `${guide.label}: ${guide.description}`
      : `${guide.label} selected.`;
    appendLog(`Quick-selected register ${guide.label} (${guide.address}).`, '[debug]');
  }
}

async function handleReadRegister() {
  if (!loader.value) {
    registerStatus.value = 'Connect to a device first.';
    registerStatusType.value = 'warning';
    return;
  }
  try {
    maintenanceBusy.value = true;
    registerStatus.value = null;
    const address = parseNumericInput(registerAddress.value, 'Register address');
    const value = await loader.value.readReg(address);
    registerReadResult.value = `0x${value.toString(16).toUpperCase().padStart(8, '0')}`;
    registerStatusType.value = 'success';
    registerStatus.value = `Read 0x${address.toString(16).toUpperCase()} = ${registerReadResult.value}`;
  } catch (error) {
    registerStatusType.value = 'error';
    registerStatus.value = `Read failed: ${error?.message || error}`;
  } finally {
    maintenanceBusy.value = false;
    downloadProgress.visible = false;
  }
}

async function handleWriteRegister() {
  if (!loader.value) {
    registerStatus.value = 'Connect to a device first.';
    registerStatusType.value = 'warning';
    return;
  }
  try {
    maintenanceBusy.value = true;
    registerStatus.value = null;
    const address = parseNumericInput(registerAddress.value, 'Register address');
    const value = parseNumericInput(registerValue.value, 'Register value');
    await loader.value.writeReg(address, value);
    registerReadResult.value = `0x${value.toString(16).toUpperCase().padStart(8, '0')}`;
    registerStatusType.value = 'success';
    registerStatus.value = `Wrote ${registerReadResult.value} to 0x${address
      .toString(16)
      .toUpperCase()}.`;
    appendLog(
      `Register write completed at 0x${address.toString(16).toUpperCase()} = ${registerReadResult.value}.`,
      '[debug]'
    );
  } catch (error) {
    registerStatusType.value = 'error';
    registerStatus.value = `Write failed: ${error?.message || error}`;
  } finally {
    maintenanceBusy.value = false;
  }
}

async function handleComputeMd5() {
  if (!loader.value) {
    md5Status.value = 'Connect to a device first.';
    md5StatusType.value = 'warning';
    md5Result.value = null;
    return;
  }
  try {
    maintenanceBusy.value = true;
    md5Status.value = null;
    md5Result.value = null;
    const offset = parseNumericInput(md5Offset.value, 'MD5 offset');
    const length = parseNumericInput(md5Length.value, 'MD5 length');
    if (length <= 0) {
      throw new Error('MD5 length must be greater than zero.');
    }
    md5StatusType.value = 'info';
    md5Status.value = 'Calculating MD5 checksum...';
    const result = await loader.value.flashMd5sum(offset, length);
    md5Status.value = null;
    md5Result.value = result;
    appendLog(
      `Computed MD5 for 0x${offset.toString(16).toUpperCase()} (${length} bytes): ${result}`,
      '[debug]'
    );
  } catch (error) {
    md5StatusType.value = 'error';
    md5Status.value = `MD5 calculation failed: ${error?.message || error}`;
    md5Result.value = null;
  } finally {
    maintenanceBusy.value = false;
  }
}

function sanitizeFileName(name, fallback) {
  const base = name && name.trim() ? name.trim() : fallback;
  return base
    .replace(/[\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120);
}

async function downloadFlashRegion(offset, length, options = {}) {
  if (!loader.value) {
    throw new Error('Device not connected.');
  }
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new Error('Invalid flash offset.');
  }
  if (!Number.isSafeInteger(length) || length <= 0) {
    throw new Error('Invalid flash length.');
  }
  if (flashSizeBytes.value && offset + length > flashSizeBytes.value) {
    throw new Error('Requested region exceeds detected flash size.');
  }

  const { label, fileName, suppressStatus = false } = options;
  const offsetHex = '0x' + offset.toString(16).toUpperCase();
  const lengthHex = '0x' + length.toString(16).toUpperCase();
  const displayLabel = label || 'flash region (' + offsetHex + ' / ' + lengthHex + ')';
  const activeBaudRaw =
    transport.value?.baudrate ||
    currentBaud.value ||
    Number.parseInt(selectedBaud.value, 10) ||
    DEFAULT_ROM_BAUD;
  const baudNumber = Number.isFinite(activeBaudRaw) ? activeBaudRaw : DEFAULT_ROM_BAUD;
  const baudLabel = baudNumber.toLocaleString() + ' bps';
  appendLog('Downloading ' + displayLabel + ' at ' + baudLabel + '.', '[debug]');

  const CANCEL_ERROR_MESSAGE = 'Download cancelled by user';
  const MAX_CHUNK_SIZE = 0x10000;
  if (!suppressStatus) {
    flashReadStatusType.value = 'info';
    flashReadStatus.value = 'Downloading ' + displayLabel + ' @ ' + baudLabel + '...';
    downloadProgress.visible = true;
    downloadProgress.value = 0;
    downloadProgress.label = 'Preparing download @ ' + baudLabel + '...';
  }

  downloadCancelRequested.value = false;

  const chunkBuffers = [];
  const chunkSize = Math.max(0x1000, Math.min(MAX_CHUNK_SIZE, length));
  let totalReceived = 0;
  let buffer = null;
  let cancelled = false;
  try {
    while (totalReceived < length) {
      if (downloadCancelRequested.value) {
        cancelled = true;
        break;
      }
      const remaining = length - totalReceived;
      const currentChunkSize = Math.min(chunkSize, remaining);
      const chunkOffset = offset + totalReceived;
      const chunkBase = totalReceived;
      const chunkBuffer = await loader.value.readFlash(
        chunkOffset,
        currentChunkSize,
        (_packet, received) => {
          const chunkReceived = Math.min(received, currentChunkSize);
          const overallReceived = chunkBase + chunkReceived;
          const progressValue = length
            ? Math.min(100, Math.floor((overallReceived / length) * 100))
            : 0;
          let progressLabel =
            'Downloading ' +
            displayLabel +
            ' @ ' +
            baudLabel +
            ' — ' +
            overallReceived.toLocaleString() +
            ' of ' +
            length.toLocaleString() +
            ' bytes';
          if (downloadCancelRequested.value) {
            progressLabel =
              'Stopping download of ' +
              displayLabel +
              ' after current chunk... (' +
              overallReceived.toLocaleString() +
              ' of ' +
              length.toLocaleString() +
              ' bytes)';
          }
          if (!suppressStatus) {
            downloadProgress.visible = true;
            downloadProgress.value = progressValue;
            downloadProgress.label = progressLabel;
            flashReadStatusType.value = 'info';
            flashReadStatus.value = progressLabel;
          }
        }
      );
      if (chunkBuffer.length !== currentChunkSize) {
        throw new Error(
          'Incomplete flash chunk (expected ' +
            currentChunkSize +
            ' bytes, received ' +
            chunkBuffer.length +
            ').'
        );
      }
      chunkBuffers.push(chunkBuffer);
      totalReceived += chunkBuffer.length;
      if (downloadCancelRequested.value) {
        cancelled = true;
        break;
      }
    }

    if (cancelled) {
      throw new Error(CANCEL_ERROR_MESSAGE);
    }

    if (totalReceived !== length) {
      throw new Error(
        'Incomplete flash read (expected ' +
          length +
          ' bytes, received ' +
          totalReceived +
          ').'
      );
    }

    if (chunkBuffers.length === 1) {
      buffer = chunkBuffers[0];
    } else {
      buffer = new Uint8Array(totalReceived);
      let writeOffset = 0;
      for (const chunk of chunkBuffers) {
        buffer.set(chunk, writeOffset);
        writeOffset += chunk.length;
      }
    }
  } finally {
    if (cancelled && !suppressStatus) {
      downloadProgress.visible = false;
    }
    downloadCancelRequested.value = false;
  }

  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  const baseName =
    fileName ||
    sanitizeFileName((label || 'flash') + '_' + offsetHex + '_' + lengthHex, 'flash_' + offsetHex + '_' + lengthHex);
  const finalName = baseName.endsWith('.bin') ? baseName : baseName + '.bin';

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = finalName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  if (!suppressStatus) {
    downloadProgress.visible = false;
    downloadProgress.value = 100;
    downloadProgress.label = 'Download complete @ ' + baudLabel;
    flashReadStatusType.value = 'success';
    flashReadStatus.value =
      'Downloaded ' +
      finalName +
      ' (' +
      length.toLocaleString() +
      ' bytes) @ ' +
      baudLabel +
      '.';
  }
  appendLog(
    'Downloaded ' + displayLabel + ' to ' + finalName + ' @ ' + baudLabel + '.',
    '[debug]'
  );
  return finalName;
}

async function handleDownloadFlash(payload = { mode: 'manual' }) {
  if (!loader.value) {
    flashReadStatus.value = 'Connect to a device first.';
    flashReadStatusType.value = 'warning';
    return;
  }
  if (maintenanceBusy.value) {
    return;
  }
  const mode = (payload && payload.mode) || 'manual';
  try {
    maintenanceBusy.value = true;

    if (mode === 'manual') {
      const offset = parseNumericInput(flashReadOffset.value, 'Flash offset');
      const length = parseNumericInput(flashReadLength.value, 'Flash length');
      await downloadFlashRegion(offset, length, { label: 'manual flash region' });
      return;
    }

    if (mode === 'partition') {
      const option =
        (payload && payload.partition) ||
        partitionOptionLookup.value.get(selectedPartitionDownload.value);
      if (!option) {
        flashReadStatusType.value = 'warning';
        flashReadStatus.value = 'Select a partition to download.';
        return;
      }
      await downloadFlashRegion(option.offset, option.size, {
        label: option.baseLabel,
        fileName: sanitizeFileName(option.baseLabel + '_' + option.offsetHex, 'partition'),
      });
      return;
    }

    if (mode === 'all-partitions') {
      const partitions = ((payload && payload.partitions) || partitionDownloadOptions.value).filter(
        option => option.size > 0
      );
      if (!partitions.length) {
        flashReadStatusType.value = 'warning';
        flashReadStatus.value = 'No partitions available to download.';
        return;
      }
      let completed = 0;
      for (const option of partitions) {
        completed += 1;
        flashReadStatusType.value = 'info';
        flashReadStatus.value =
          'Downloading partition ' + completed + ' of ' + partitions.length + ': ' + option.baseLabel + '...';
        await downloadFlashRegion(option.offset, option.size, {
          label: option.baseLabel,
          fileName: sanitizeFileName(option.baseLabel + '_' + option.offsetHex, 'partition'),
          suppressStatus: true,
        });
      }
      flashReadStatusType.value = 'success';
      flashReadStatus.value =
        'Downloaded ' + partitions.length + ' partition' + (partitions.length === 1 ? '' : 's') + '.';
      return;
    }

    if (mode === 'used-flash') {
      const usedSegments = partitionSegments.value.filter(segment => !segment.isUnused);
      if (!usedSegments.length) {
        flashReadStatusType.value = 'warning';
        flashReadStatus.value = 'No flash usage detected.';
        return;
      }
      const minOffset = usedSegments.reduce(
        (min, segment) => Math.min(min, segment.offset),
        usedSegments[0].offset
      );
      const maxEnd = usedSegments.reduce(
        (max, segment) => Math.max(max, segment.offset + segment.size),
        usedSegments[0].offset + usedSegments[0].size
      );
      const length = maxEnd - minOffset;
      await downloadFlashRegion(minOffset, length, {
        label: 'used flash',
        fileName: sanitizeFileName('used_flash_' + ('0x' + minOffset.toString(16).toUpperCase()), 'used_flash'),
      });
      return;
    }

    if (mode === 'custom') {
      const offset = payload && payload.offset;
      const length = payload && payload.length;
      if (!Number.isInteger(offset) || !Number.isInteger(length)) {
        throw new Error('Custom download requires numeric offset and length.');
      }
      await downloadFlashRegion(offset, length, {
        label: payload && payload.label,
        fileName: payload && payload.fileName,
      });
      return;
    }

    flashReadStatusType.value = 'warning';
    flashReadStatus.value = 'Unsupported download mode.';
  } catch (error) {
    downloadProgress.visible = false;
    if (error && error.message === 'Download cancelled by user') {
      flashReadStatusType.value = 'warning';
      flashReadStatus.value = 'Download cancelled.';
    } else {
      flashReadStatusType.value = 'error';
      flashReadStatus.value = 'Download failed: ' + (error && error.message ? error.message : error);
    }
  } finally {
    maintenanceBusy.value = false;
  }
}

async function handleDownloadPartition() {
  const option = partitionOptionLookup.value.get(selectedPartitionDownload.value);
  if (!option) {
    flashReadStatusType.value = 'warning';
    flashReadStatus.value = 'Select a partition to download.';
    return;
  }
  await handleDownloadFlash({ mode: 'partition', partition: option });
}

async function handleDownloadAllPartitions() {
  const partitions = partitionDownloadOptions.value.filter(option => option.size > 0);
  if (!partitions.length) {
    flashReadStatusType.value = 'warning';
    flashReadStatus.value = 'No partitions available to download.';
    return;
  }
  await handleDownloadFlash({ mode: 'all-partitions', partitions });
}

async function handleDownloadUsedFlash() {
  await handleDownloadFlash({ mode: 'used-flash' });
}

function handleCancelFlash() {
  if (!flashInProgress.value) {
    return;
  }
  if (!flashCancelRequested.value) {
    flashCancelRequested.value = true;
    flashProgressDialog.label = 'Stopping flash...';
    appendLog('Flash cancellation requested by user.', '[warn]');
  }
}

function handleCancelDownload() {
  if (!downloadProgress.visible) {
    return;
  }
  if (!downloadCancelRequested.value) {
    downloadCancelRequested.value = true;
    downloadProgress.label = 'Stopping download...';
    flashReadStatusType.value = 'info';
    flashReadStatus.value = 'Stopping download...';
  }
}

function handleSelectPartition(value) {
  selectedPartitionDownload.value = value;
  const option = partitionOptionLookup.value.get(value);
  if (option) {
    flashReadOffset.value = option.offsetHex;
    flashReadLength.value = '0x' + option.size.toString(16).toUpperCase();
  } else {
    flashReadOffset.value = '0x0';
    flashReadLength.value = '';
  }
}

function handleSelectIntegrityPartition(value) {
  integrityPartition.value = value;
  const option = partitionOptionLookup.value.get(value);
  if (option) {
    md5Offset.value = option.offsetHex;
    md5Length.value = '0x' + option.size.toString(16).toUpperCase();
    md5Status.value = null;
    md5Result.value = null;
    md5StatusType.value = 'info';
    appendLog(
      `Flash integrity region set to ${option.baseLabel} (${option.offsetHex}, ${md5Length.value}).`,
      '[debug]'
    );
  } else if (value == null) {
    appendLog('Flash integrity partition selection cleared.', '[debug]');
  } else {
    md5StatusType.value = 'warning';
    md5Status.value = 'Selected partition is unavailable.';
    md5Result.value = null;
  }
}

async function handleLoadSpiffsAgent() {
  if (spiffsAgent.loading) {
    return;
  }
  spiffsAgent.loading = true;
  spiffsAgent.error = null;
  try {
    if (spiffsAgent.loaded && spiffsAgent.binary) {
      resetSpiffsAgentSession({ preserveBinary: true });
      appendLog(`SPIFFS agent stub already loaded (${spiffsAgent.size.toLocaleString()} bytes).`, '[debug]');
      return;
    }
    const response = await fetch('/stubs/spiffs_agent_esp32s3.bin', { cache: 'no-cache' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const buffer = await response.arrayBuffer();
    const binary = new Uint8Array(buffer);
    if (!binary.length) {
      throw new Error('Stub file is empty.');
    }
    spiffsAgent.binary = binary;
    spiffsAgent.size = binary.length;
    spiffsAgent.loaded = true;
    resetSpiffsAgentSession({ preserveBinary: true });
    appendLog(`SPIFFS agent stub loaded (${spiffsAgent.size.toLocaleString()} bytes).`, '[debug]');
  } catch (error) {
    spiffsAgent.error = error?.message || String(error);
    spiffsAgent.status = 'Stub load failed.';
    appendLog(`SPIFFS agent load failed: ${spiffsAgent.error}`, '[warn]');
  } finally {
    spiffsAgent.loading = false;
  }
}

function parseSpiffsAgentBinary(binary) {
  if (!(binary instanceof Uint8Array) || binary.length < 24) {
    throw new Error('Invalid SPIFFS agent stub.');
  }
  if (binary[0] !== 0xe9) {
    throw new Error('Unsupported stub format (missing ESP image header).');
  }
  const view = new DataView(binary.buffer, binary.byteOffset, binary.byteLength);
  const segmentCount = binary[1];
  const entry = view.getUint32(4, true);
  let offset = 24;
  const segments = [];
  for (let i = 0; i < segmentCount; i += 1) {
    if (offset + 8 > binary.length) {
      throw new Error('Stub image truncated (no segment header).');
    }
    const address = view.getUint32(offset, true);
    const length = view.getUint32(offset + 4, true);
    offset += 8;
    if (offset + length > binary.length) {
      throw new Error('Stub image truncated (segment payload exceeds file).');
    }
    segments.push({
      address,
      data: binary.slice(offset, offset + length),
    });
    offset += length;
  }
  return { entry, segments };
}

async function writeSpiffsAgentLines(lines) {
  const port = currentPort.value;
  if (!port?.writable) {
    throw new Error('Serial port is not writable.');
  }
  const writer = port.writable.getWriter();
  try {
    for (const raw of lines) {
      const line = raw.endsWith('\n') ? raw : `${raw}\n`;
      await writer.write(spiffsAgentRuntime.encoder.encode(line));
    }
  } finally {
    writer.releaseLock();
  }
}

async function readSpiffsAgentLine(options = {}) {
  const { timeout = SPIFFS_AGENT_LINE_TIMEOUT, skipEmpty = false } = options;
  const reader = ensureTransportReader();
  if (!reader) {
    throw new Error('Serial reader unavailable.');
  }
  if (!spiffsAgentRuntime.decoder) {
    spiffsAgentRuntime.decoder = new TextDecoder();
  }
  const started = performance.now();
  while (true) {
    const newlineIndex = spiffsAgentRuntime.buffer.indexOf('\n');
    if (newlineIndex >= 0) {
      let line = spiffsAgentRuntime.buffer.slice(0, newlineIndex);
      spiffsAgentRuntime.buffer = spiffsAgentRuntime.buffer.slice(newlineIndex + 1);
      if (line.endsWith('\r')) {
        line = line.slice(0, -1);
      }
      if (skipEmpty && !line.trim()) {
        continue;
      }
      return line;
    }
    if (timeout && performance.now() - started > timeout) {
      throw new Error('SPIFFS agent response timed out.');
    }
    // eslint-disable-next-line no-await-in-loop
    const { value, done } = await reader.read();
    if (done) {
      throw new Error('SPIFFS agent closed the serial stream.');
    }
    if (value?.length) {
      spiffsAgentRuntime.buffer += spiffsAgentRuntime.decoder.decode(value, { stream: true });
    }
  }
}

function decodeBase64Lines(lines, expectedLength) {
  const chunks = [];
  let total = 0;
  for (const line of lines) {
    if (!line && expectedLength === 0) {
      continue;
    }
    const decoded = atob(line || '');
    total += decoded.length;
    chunks.push(decoded);
  }
  if (typeof expectedLength === 'number' && expectedLength >= 0 && total !== expectedLength) {
    throw new Error(`SPIFFS agent reported ${expectedLength} bytes but transmitted ${total}.`);
  }
  const buffer = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    for (let i = 0; i < chunk.length; i += 1) {
      buffer[offset++] = chunk.charCodeAt(i);
    }
  }
  return buffer;
}

async function fetchSpiffsFileList() {
  await writeSpiffsAgentLines(['LIST']);
  const files = [];
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const line = await readSpiffsAgentLine({ skipEmpty: true });
    if (line === 'DONE') {
      break;
    }
    if (line.startsWith('ERR')) {
      throw new Error(line.slice(4).trim() || 'LIST command failed.');
    }
    const match = line.match(/^FILE\s+(.+)\s+(\d+)$/);
    if (match) {
      files.push({
        name: match[1],
        size: Number.parseInt(match[2], 10) || 0,
      });
    }
  }
  return files;
}

function triggerSpiffsFileDownload(name, data) {
  if (typeof document === 'undefined') {
    appendLog('Download unavailable in this runtime environment.', '[warn]');
    return;
  }
  const blob = new Blob([data], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function handleDeploySpiffsAgent() {
  if (!loader.value) {
    spiffsAgent.status = 'Connect to a device before uploading the stub.';
    appendLog('SPIFFS agent upload aborted: loader unavailable.', '[warn]');
    return;
  }
  if (!spiffsAgent.loaded || !spiffsAgent.binary) {
    spiffsAgent.status = 'Load the SPIFFS agent stub first.';
    appendLog('SPIFFS agent upload aborted: stub not loaded.', '[warn]');
    return;
  }
  if (spiffsAgent.uploading || spiffsAgent.busy) {
    return;
  }
  const loaderInstance = loader.value;
  const transportInstance = transport.value;
  if (!loaderInstance || !transportInstance) {
    spiffsAgent.status = 'Transport unavailable.';
    appendLog('SPIFFS agent upload aborted: transport unavailable.', '[warn]');
    return;
  }
  spiffsAgent.uploading = true;
  spiffsAgent.busy = true;
  spiffsAgent.error = null;
  maintenanceBusy.value = true;
  const romBaud = loaderInstance.romBaudrate || DEFAULT_ROM_BAUD;
  const previousBaud = loaderInstance.baudrate;
  const previousStubState = loaderInstance.IS_STUB;
  const previousSyncStub = loaderInstance.syncStubDetected;
  let spiffsStubStarted = false;
  try {
    spiffsAgent.status = 'Uploading stub to device RAM...';
    appendLog('Uploading SPIFFS agent stub to device RAM...', '[debug]');
    await releaseTransportReader();
    clearSpiffsAgentDecoder();
    spiffsAgent.status = 'Switching device to ROM bootloader...';
    appendLog('Re-synchronizing with ROM bootloader for SPIFFS agent upload.', '[debug]');
    try {
      await transportInstance.disconnect();
    } catch (disconnectError) {
      appendLog(
        `SPIFFS agent: transport disconnect warning: ${disconnectError?.message || disconnectError}`,
        '[debug]'
      );
    }
    loaderInstance.transport.reader = null;
    loaderInstance.IS_STUB = false;
    loaderInstance.syncStubDetected = false;
    await loaderInstance.connect('default_reset');
    if (loaderInstance.syncStubDetected) {
      throw new Error('Unable to enter ROM bootloader (stub still active).');
    }
    loaderInstance.baudrate = romBaud;
    transportInstance.baudrate = romBaud;
    await releaseTransportReader();
    const { entry, segments } = parseSpiffsAgentBinary(spiffsAgent.binary);
    const blockSize = loaderInstance.ESP_RAM_BLOCK || 0x1800;
    for (const segment of segments) {
      const { address, data } = segment;
      const length = data.length;
      const blocks = Math.ceil(length / blockSize);
      // eslint-disable-next-line no-await-in-loop
      await loaderInstance.memBegin(length, blocks, blockSize, address);
      for (let seq = 0; seq < blocks; seq += 1) {
        const start = seq * blockSize;
        const end = Math.min(start + blockSize, length);
        // eslint-disable-next-line no-await-in-loop
        await loaderInstance.memBlock(data.slice(start, end), seq);
      }
    }
    spiffsAgent.status = 'Starting stub...';
    await loaderInstance.memFinish(entry);
    await releaseTransportReader();
    loaderInstance.transport.buffer = new Uint8Array(0);
    spiffsAgent.running = true;
    spiffsStubStarted = true;
    spiffsAgent.files = [];
    const availabilityNote = ' Flasher stub disabled until you disconnect and reconnect.';
    spiffsAgent.status = 'Waiting for agent response...';
    const readyLine = await readSpiffsAgentLine({ skipEmpty: true }).catch(() => null);
    if (readyLine) {
      spiffsAgent.status = readyLine + availabilityNote;
      appendLog(`SPIFFS agent: ${readyLine}`, '[debug]');
    } else {
      spiffsAgent.status = 'Stub running. Ready for SPIFFS commands.' + availabilityNote;
    }
    spiffsAgentRuntime.buffer = '';
    appendLog('SPIFFS agent stub running. Use the controls below to manage SPIFFS.', '[debug]');
    appendLog(
      'Flasher stub disabled while SPIFFS agent is active. Disconnect & reconnect after finishing to restore flashing features.',
      '[warn]'
    );
  } catch (error) {
    spiffsAgent.running = false;
    spiffsAgent.error = error?.message || String(error);
    spiffsAgent.status = `Stub upload failed: ${spiffsAgent.error}`;
    appendLog(`SPIFFS agent upload failed: ${spiffsAgent.error}`, '[error]');
    clearSpiffsAgentDecoder();
    try {
      spiffsAgent.status = 'Attempting to restore flasher stub...';
      await releaseTransportReader();
      loaderInstance.transport.reader = null;
      loaderInstance.IS_STUB = false;
      loaderInstance.syncStubDetected = false;
      try {
        await transportInstance.disconnect();
      } catch (restoreDisconnectError) {
        appendLog(
          `SPIFFS agent: restore disconnect warning: ${restoreDisconnectError?.message || restoreDisconnectError}`,
          '[debug]'
        );
      }
      await loaderInstance.connect('default_reset');
      await loaderInstance.runStub();
      if (previousBaud && previousBaud !== romBaud) {
        loaderInstance.baudrate = previousBaud;
        transportInstance.baudrate = previousBaud;
        try {
          await loaderInstance.changeBaud();
        } catch (baudError) {
          appendLog(
            `SPIFFS agent: baud restore warning: ${baudError?.message || baudError}`,
            '[debug]'
          );
        }
      }
      appendLog('Flasher stub restored after SPIFFS agent failure.', '[debug]');
      spiffsAgent.status = 'Stub upload failed. Flasher stub restored.';
    } catch (restoreError) {
      appendLog(
        `Unable to automatically restore flasher stub: ${restoreError?.message || restoreError}. Use Disconnect/Connect to recover.`,
        '[warn]'
      );
    }
  } finally {
    if (spiffsStubStarted) {
      loaderInstance.IS_STUB = false;
      loaderInstance.syncStubDetected = false;
      loaderInstance.baudrate = romBaud;
      transportInstance.baudrate = romBaud;
    } else {
      loaderInstance.IS_STUB = previousStubState;
      loaderInstance.syncStubDetected = previousSyncStub;
      loaderInstance.baudrate = previousBaud;
      transportInstance.baudrate = previousBaud;
    }
    spiffsAgent.uploading = false;
    spiffsAgent.busy = false;
    maintenanceBusy.value = false;
  }
}

async function handleListSpiffsFiles() {
  if (!spiffsAgent.running) {
    spiffsAgent.status = 'Upload the stub to the device before listing files.';
    return;
  }
  if (spiffsAgent.busy) {
    return;
  }
  spiffsAgent.busy = true;
  spiffsAgent.error = null;
  try {
    spiffsAgent.status = 'Listing SPIFFS files...';
    const files = await fetchSpiffsFileList();
    spiffsAgent.files = files;
    if (files.length) {
      spiffsAgent.status = `Found ${files.length} file${files.length === 1 ? '' : 's'} on SPIFFS.`;
    } else {
      spiffsAgent.status = 'SPIFFS is empty.';
    }
    appendLog('SPIFFS agent: file list refreshed.', '[debug]');
  } catch (error) {
    const message = error?.message || String(error);
    spiffsAgent.error = message;
    spiffsAgent.status = `List failed: ${message}`;
    appendLog(`SPIFFS agent list failed: ${message}`, '[warn]');
  } finally {
    spiffsAgent.busy = false;
  }
}

async function handleDeleteSpiffsFile(name) {
  const target = typeof name === 'string' ? name.trim() : '';
  if (!target) {
    return;
  }
  if (!spiffsAgent.running) {
    spiffsAgent.status = 'SPIFFS agent is not running.';
    return;
  }
  if (spiffsAgent.busy) {
    return;
  }
  if (target.includes('\n')) {
    spiffsAgent.status = 'Filenames cannot contain newlines.';
    return;
  }
  spiffsAgent.busy = true;
  spiffsAgent.error = null;
  try {
    spiffsAgent.status = `Deleting ${target}...`;
    await writeSpiffsAgentLines([`DELETE ${target}`]);
    const response = await readSpiffsAgentLine({ skipEmpty: true });
    if (response === 'OK') {
      const files = await fetchSpiffsFileList();
      spiffsAgent.files = files;
      spiffsAgent.status = `Deleted ${target}.`;
      appendLog(`SPIFFS agent deleted ${target}.`, '[debug]');
    } else if (response.startsWith('ERR')) {
      throw new Error(response.slice(4).trim() || 'Delete failed.');
    } else {
      throw new Error(`Unexpected response: ${response}`);
    }
  } catch (error) {
    const message = error?.message || String(error);
    spiffsAgent.error = message;
    spiffsAgent.status = `Delete failed: ${message}`;
    appendLog(`SPIFFS agent delete failed: ${message}`, '[warn]');
  } finally {
    spiffsAgent.busy = false;
  }
}

async function handleUploadSpiffsFile(payload) {
  if (!payload || (!payload.file && !payload.bytes)) {
    return;
  }
  if (!spiffsAgent.running) {
    spiffsAgent.status = 'SPIFFS agent is not running.';
    return;
  }
  if (spiffsAgent.busy) {
    return;
  }
  let data = null;
  let name = '';
  if (payload.file) {
    data = new Uint8Array(await payload.file.arrayBuffer());
    name = payload.name?.trim() || payload.file.name || '';
  } else if (payload.bytes) {
    data = payload.bytes instanceof Uint8Array ? payload.bytes : new Uint8Array(payload.bytes);
    name = payload.name?.trim() || '';
  }
  if (!name) {
    spiffsAgent.status = 'Provide a filename to upload.';
    return;
  }
  if (name.includes('\n')) {
    spiffsAgent.status = 'Filenames cannot contain newlines.';
    return;
  }
  spiffsAgent.busy = true;
  spiffsAgent.error = null;
  try {
    spiffsAgent.status = `Uploading ${name} (${data.length.toLocaleString()} bytes)...`;
    const port = currentPort.value;
    if (!port?.writable) {
      throw new Error('Serial port is not writable.');
    }
    const writer = port.writable.getWriter();
    try {
      await writer.write(
        spiffsAgentRuntime.encoder.encode(`WRITE ${name} ${data.length}\n`),
      );
      const chunkSize = SPIFFS_AGENT_BASE64_CHUNK;
      for (let offset = 0; offset < data.length; offset += chunkSize) {
        const slice = data.subarray(offset, Math.min(offset + chunkSize, data.length));
        let binary = '';
        for (let i = 0; i < slice.length; i += 1) {
          binary += String.fromCharCode(slice[i]);
        }
        const base64 = btoa(binary);
        // eslint-disable-next-line no-await-in-loop
        await writer.write(spiffsAgentRuntime.encoder.encode(`${base64}\n`));
      }
      if (data.length === 0) {
        await writer.write(spiffsAgentRuntime.encoder.encode('\n'));
      }
    } finally {
      writer.releaseLock();
    }
    const response = await readSpiffsAgentLine({ skipEmpty: true });
    if (response === 'OK' || response === 'DONE') {
      const files = await fetchSpiffsFileList();
      spiffsAgent.files = files;
      spiffsAgent.status = `Uploaded ${name}.`;
      appendLog(`SPIFFS agent uploaded ${name}.`, '[debug]');
    } else if (response.startsWith('ERR')) {
      throw new Error(response.slice(4).trim() || 'Write failed.');
    } else {
      throw new Error(`Unexpected response: ${response}`);
    }
  } catch (error) {
    const message = error?.message || String(error);
    spiffsAgent.error = message;
    spiffsAgent.status = `Upload failed: ${message}`;
    appendLog(`SPIFFS agent upload failed: ${message}`, '[warn]');
  } finally {
    spiffsAgent.busy = false;
  }
}

async function handleDownloadSpiffsFile(name) {
  const target = typeof name === 'string' ? name.trim() : '';
  if (!target) {
    return;
  }
  if (!spiffsAgent.running) {
    spiffsAgent.status = 'SPIFFS agent is not running.';
    return;
  }
  if (spiffsAgent.busy) {
    return;
  }
  if (target.includes('\n')) {
    spiffsAgent.status = 'Filenames cannot contain newlines.';
    return;
  }
  spiffsAgent.busy = true;
  spiffsAgent.error = null;
  try {
    spiffsAgent.status = `Reading ${target}...`;
    await writeSpiffsAgentLines([`READ ${target}`]);
    const header = await readSpiffsAgentLine({ skipEmpty: true });
    if (header.startsWith('ERR')) {
      throw new Error(header.slice(4).trim() || 'Read failed.');
    }
    if (!header.startsWith('DATA ')) {
      throw new Error(`Unexpected response: ${header}`);
    }
    const expectedLength = Number.parseInt(header.slice(5).trim(), 10);
    const base64Lines = [];
    while (true) {
      const line = await readSpiffsAgentLine({ skipEmpty: false });
      if (line === 'DONE') {
        break;
      }
      if (line.startsWith('ERR')) {
        throw new Error(line.slice(4).trim() || 'Read failed.');
      }
      base64Lines.push(line.trim());
    }
    const bytes = decodeBase64Lines(base64Lines, Number.isFinite(expectedLength) ? expectedLength : undefined);
    triggerSpiffsFileDownload(target, bytes);
    spiffsAgent.status = `Downloaded ${target} (${bytes.length.toLocaleString()} bytes).`;
    appendLog(`SPIFFS agent downloaded ${target}.`, '[debug]');
  } catch (error) {
    const message = error?.message || String(error);
    spiffsAgent.error = message;
    spiffsAgent.status = `Download failed: ${message}`;
    appendLog(`SPIFFS agent download failed: ${message}`, '[warn]');
  } finally {
    spiffsAgent.busy = false;
  }
}

async function handleFormatSpiffsAgent() {
  if (!spiffsAgent.running) {
    spiffsAgent.status = 'SPIFFS agent is not running.';
    return;
  }
  if (spiffsAgent.busy) {
    return;
  }
  spiffsAgent.busy = true;
  spiffsAgent.error = null;
  try {
    spiffsAgent.status = 'Formatting SPIFFS...';
    await writeSpiffsAgentLines(['FORMAT']);
    const response = await readSpiffsAgentLine({ skipEmpty: true });
    if (response === 'OK') {
      spiffsAgent.files = [];
      spiffsAgent.status = 'SPIFFS formatted.';
      appendLog('SPIFFS agent formatted the filesystem.', '[debug]');
    } else if (response.startsWith('ERR')) {
      throw new Error(response.slice(4).trim() || 'Format failed.');
    } else {
      throw new Error(`Unexpected response: ${response}`);
    }
  } catch (error) {
    const message = error?.message || String(error);
    spiffsAgent.error = message;
    spiffsAgent.status = `Format failed: ${message}`;
    appendLog(`SPIFFS agent format failed: ${message}`, '[warn]');
  } finally {
    spiffsAgent.busy = false;
  }
}

async function handleResetSpiffsAgent() {
  if (!spiffsAgent.running) {
    spiffsAgent.status = 'SPIFFS agent is not running.';
    return;
  }
  if (spiffsAgent.busy) {
    return;
  }
  spiffsAgent.busy = true;
  spiffsAgent.error = null;
  try {
    spiffsAgent.status = 'Resetting device...';
    await writeSpiffsAgentLines(['RESET']);
    let response = null;
    try {
      response = await readSpiffsAgentLine({ skipEmpty: true, timeout: 3000 });
    } catch (err) {
      response = null;
    }
    if (response && response.startsWith('ERR')) {
      throw new Error(response.slice(4).trim() || 'Reset failed.');
    }
    spiffsAgent.status = 'Device reset requested. Reconnect to bootloader to continue.';
    appendLog('SPIFFS agent requested device reset.', '[debug]');
  } catch (error) {
    const message = error?.message || String(error);
    spiffsAgent.error = message;
    spiffsAgent.status = `Reset failed: ${message}`;
    appendLog(`SPIFFS agent reset failed: ${message}`, '[warn]');
    return;
  } finally {
    spiffsAgent.busy = false;
    spiffsAgent.running = false;
    spiffsAgent.files = [];
    clearSpiffsAgentDecoder();
    await releaseTransportReader();
  }
}


async function handleEraseFlash(payload = { mode: 'full' }) {
  if (!loader.value) {
    flashReadStatus.value = 'Connect to a device first.';
    flashReadStatusType.value = 'warning';
    return;
  }
  if (payload?.mode !== 'full') {
    flashReadStatusType.value = 'warning';
    flashReadStatus.value = 'Selective erase is not yet supported in this interface.';
    return;
  }

  const confirmErase = await showConfirmation({
    title: 'Erase Entire Flash',
    message: 'Erase the entire flash? This removes all data and cannot be undone.',
    confirmText: 'Erase Flash',
    cancelText: 'Cancel',
    destructive: true,
  });
  if (!confirmErase) {
    flashReadStatusType.value = 'info';
    flashReadStatus.value = 'Flash erase cancelled.';
    appendLog('Flash erase cancelled by user.', '[warn]');
    return;
  }

  try {
    maintenanceBusy.value = true;
    flashReadStatusType.value = 'info';
    flashReadStatus.value = 'Erasing entire flash...';
    await loader.value.eraseFlash();
    flashReadStatusType.value = 'success';
    flashReadStatus.value = 'Flash erase complete.';
    appendLog('Entire flash erased.', '[debug]');
  } catch (error) {
    flashReadStatusType.value = 'error';
    flashReadStatus.value = `Erase failed: ${error?.message || error}`;
  } finally {
    maintenanceBusy.value = false;
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
.app-title {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
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

.status-links {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.status-link {
  text-transform: none;
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

.status-chip-icon {
  color: currentColor !important;
  opacity: 0.92;
}

.status-chip-icon--connected {
  color: color-mix(in srgb, var(--v-theme-on-success) 94%, transparent) !important;
}

.status-chip-icon--disconnected {
  color: color-mix(in srgb, var(--v-theme-error) 65%, #ffffff 35%) !important;
}

.status-select {
  min-width: 180px;
  max-width: 220px;
}

.status-bar .v-divider {
  height: 36px;
}

.confirmation-message {
  white-space: pre-line;
}

</style>

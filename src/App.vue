<template>
  <v-app>
    <v-navigation-drawer permanent app elevation="1">
      <v-list>
        <v-list-item prepend-icon="mdi-transit-connection-variant" title="ESPConnect" :subtitle="'v' + APP_VERSION">
        </v-list-item>
      </v-list>
      <v-list nav density="comfortable">
        <v-list-subheader class="app-drawer__label text-overline text-medium-emphasis">
          Sections
        </v-list-subheader>
        <v-list-item v-for="item in navigationItems" :key="item.value" :value="item.value" :prepend-icon="item.icon"
          :active="activeTab === item.value" :disabled="item.disabled" class="app-drawer__list-item" rounded="lg"
          @click="!item.disabled && (activeTab = item.value)">
          <v-list-item-title>{{ item.title }}</v-list-item-title>
        </v-list-item>
      </v-list>
      <v-divider class="app-drawer__divider" />
      <v-list density="comfortable">
        <v-list-subheader class="app-drawer__label text-overline text-medium-emphasis">
          Resources
        </v-list-subheader>
        <v-list-item v-for="link in resourceLinks" :key="link.href" :href="link.href" :prepend-icon="link.icon"
          target="_blank" rel="noopener" class="app-drawer__list-item" rounded="lg">
          <v-list-item-title>{{ link.title }}</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>
    <v-app-bar app :elevation="8">
      <div class="status-actions">
        <v-btn color="primary" variant="outlined" density="comfortable"
          :disabled="!serialSupported || connected || busy" @click="connect">
          <v-icon start>mdi-usb-flash-drive</v-icon>
          Connect
        </v-btn>
        <v-btn color="error" variant="outlined" density="comfortable" :disabled="!connected || busy"
          @click="disconnect">
          <v-icon start>mdi-close-circle</v-icon>
          Disconnect
        </v-btn>
        <v-select v-model="selectedBaud" :items="baudrateOptions" label="Baud rate" density="compact" variant="outlined"
          hide-details class="status-select"
          :disabled="busy || flashInProgress || maintenanceBusy || baudChangeBusy || monitorActive" />
      </div>
      <v-spacer />
      <v-btn :title="`Switch to ${isDarkTheme ? 'light' : 'dark'} theme`" variant="text" icon size="small"
        @click="toggleTheme">
        <v-icon>{{ themeIcon }}</v-icon>
      </v-btn>
      <v-chip :color="connected ? 'success' : 'grey-darken-1'" class="text-capitalize" variant="elevated"
        density="comfortable">
        <template #prepend>
          <v-icon v-if="connected" start class="status-chip-icon status-chip-icon--connected">
            mdi-usb-port
          </v-icon>
          <v-icon v-else start class="status-chip-icon status-chip-icon--disconnected">
            mdi-usb-c-port
          </v-icon>
        </template>
        {{ connectionChipLabel }}
      </v-chip>
    </v-app-bar>
    <v-main>
      <v-container fluid>
        <v-card elevation="8" class="pa-6">
          <v-alert v-if="!serialSupported" type="error" class="mb-4" variant="tonal" icon="mdi-alert-circle-outline">
            This browser does not support the Web Serial API. Use Chrome, Edge, or another Chromium-based browser.
          </v-alert>
          <v-window v-model="activeTab" class="app-tab-content">
            <v-window-item value="info">
              <DeviceInfoTab :chip-details="chipDetails" />
            </v-window-item>

            <v-window-item value="partitions">
              <PartitionsTab :partition-segments="partitionSegments" :formatted-partitions="formattedPartitions"
                :unused-summary="unusedFlashSummary" />
            </v-window-item>

            <v-window-item value="spiffs">
              <SpiffsManagerTab :partitions="spiffsPartitions" :selected-partition-id="spiffsState.selectedId"
                :files="spiffsState.files" :status="spiffsState.status" :loading="spiffsState.loading"
                :busy="spiffsState.busy" :saving="spiffsState.saving" :read-only="spiffsState.readOnly"
                :read-only-reason="spiffsState.readOnlyReason" :dirty="spiffsState.dirty"
                :backup-done="spiffsState.backupDone || spiffsState.sessionBackupDone" :error="spiffsState.error"
                :has-partition="hasSpiffsPartitionSelected" :has-client="Boolean(spiffsState.client)"
                :usage="spiffsState.usage" :upload-blocked="spiffsState.uploadBlocked"
                :upload-blocked-reason="spiffsState.uploadBlockedReason"
                :is-file-viewable="isViewableSpiffsFile"
                @select-partition="handleSelectSpiffsPartition" @refresh="handleRefreshSpiffs"
                @backup="handleSpiffsBackup" @restore="handleSpiffsRestore" @download-file="handleSpiffsDownloadFile"
                @view-file="handleSpiffsView" @validate-upload="handleSpiffsUploadSelection"
                @upload-file="handleSpiffsUpload" @delete-file="handleSpiffsDelete" @format="handleSpiffsFormat"
                @save="handleSpiffsSave" />
            </v-window-item>

            <v-window-item value="apps">
              <AppsTab :apps="appPartitions" :active-slot-id="activeAppSlotId" :active-summary="appActiveSummary"
                :loading="appMetadataLoading" :error="appMetadataError" />
            </v-window-item>

            <v-window-item value="flash">
              <FlashFirmwareTab v-model:flash-offset="flashOffset" v-model:selected-preset="selectedPreset"
                v-model:erase-flash="eraseFlash" :offset-presets="offsetPresets" :busy="busy" :can-flash="canFlash"
                :flash-in-progress="flashInProgress" :flash-progress="flashProgress"
                :flash-progress-dialog="flashProgressDialog" :maintenance-busy="maintenanceBusy"
                :register-address="registerAddress" :register-value="registerValue"
                :register-read-result="registerReadResult" :register-status="registerStatus"
                :register-status-type="registerStatusType" :register-options="registerOptions"
                :register-reference="registerReference" :md5-offset="md5Offset" :md5-length="md5Length"
                :md5-result="md5Result" :md5-status="md5Status" :md5-status-type="md5StatusType"
                :flash-read-offset="flashReadOffset" :flash-read-length="flashReadLength"
                :flash-read-status="flashReadStatus" :flash-read-status-type="flashReadStatusType"
                :partition-options="partitionDownloadOptions" :selected-partition="selectedPartitionDownload"
                :integrity-partition="integrityPartition" :download-progress="downloadProgress"
                @firmware-input="handleFirmwareInput" @flash="flashFirmware"
                @apply-preset="applyOffsetPreset" @update:register-address="value => (registerAddress.value = value)"
                @update:register-value="value => (registerValue.value = value)" @read-register="handleReadRegister"
                @write-register="handleWriteRegister" @update:md5-offset="value => (md5Offset.value = value)"
                @update:md5-length="value => (md5Length.value = value)" @compute-md5="handleComputeMd5"
                @update:flash-read-offset="value => (flashReadOffset.value = value)"
                @update:flash-read-length="value => (flashReadLength.value = value)"
                @update:selected-partition="handleSelectPartition"
                @update:integrity-partition="handleSelectIntegrityPartition" @download-flash="handleDownloadFlash"
                @download-partition="handleDownloadPartition" @download-all-partitions="handleDownloadAllPartitions"
                @download-used-flash="handleDownloadUsedFlash" @cancel-flash="handleCancelFlash"
                @erase-flash="handleEraseFlash" @cancel-download="handleCancelDownload"
                @select-register="handleSelectRegister" />
            </v-window-item>
            <v-window-item value="console">
              <SerialMonitorTab :monitor-text="monitorText" :monitor-active="monitorActive"
                :monitor-error="monitorError" :can-start="canStartMonitor" :can-command="canIssueMonitorCommands"
                @start-monitor="startMonitor" @stop-monitor="stopMonitor" @clear-monitor="clearMonitorOutput"
                @reset-board="resetBoard" />
            </v-window-item>

            <v-window-item value="log">
              <SessionLogTab :log-text="logText" @clear-log="clearLog" />
            </v-window-item>
          </v-window>
        </v-card>

        <v-dialog :model-value="confirmationDialog.visible" max-width="420" @update:model-value="value => {
          if (!value) resolveConfirmation(false);
        }">
          <v-card>
            <v-card-title class="text-h6">
              <v-icon start
                :color="confirmationDialog.destructive ? 'error' : 'warning'">mdi-alert-circle-outline</v-icon>
              {{ confirmationDialog.title || 'Please confirm' }}
            </v-card-title>
            <v-card-text class="text-body-2">
              <div class="confirmation-message">
                {{ confirmationDialog.message }}
              </div>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn variant="text" @click="resolveConfirmation(false)">
                {{ confirmationDialog.cancelText || 'Cancel' }}
              </v-btn>
              <v-btn :color="confirmationDialog.destructive ? 'error' : 'primary'" variant="tonal"
                @click="resolveConfirmation(true)">
                {{ confirmationDialog.confirmText || 'Continue' }}
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <v-dialog :model-value="spiffsBackupDialog.visible" persistent max-width="420" class="progress-dialog">
          <v-card>
            <v-card-title class="text-h6">
              <v-icon start color="primary">mdi-content-save</v-icon>
              SPIFFS Backup
            </v-card-title>
            <v-card-text class="progress-dialog__body">
              <div class="progress-dialog__label">
                {{ spiffsBackupDialog.label || 'Preparing backup...' }}
              </div>
              <v-progress-linear :model-value="spiffsBackupDialog.value" height="24" color="primary" rounded>
                <strong>{{ Math.min(100, Math.max(0, Math.floor(spiffsBackupDialog.value))) }}%</strong>
              </v-progress-linear>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn variant="text" @click="cancelSpiffsBackup">
                Cancel
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <v-dialog :model-value="spiffsLoadingDialog.visible" persistent max-width="420" class="progress-dialog">
          <v-card>
            <v-card-title class="text-h6">
              <v-icon start color="primary">mdi-folder-sync</v-icon>
              Loading SPIFFS
            </v-card-title>
            <v-card-text class="progress-dialog__body">
              <div class="progress-dialog__label">
                {{ spiffsLoadingDialog.label }}
              </div>
              <v-progress-linear indeterminate height="24" color="primary" rounded />
            </v-card-text>
          </v-card>
        </v-dialog>

        <v-dialog :model-value="spiffsSaveDialog.visible" persistent max-width="420" class="progress-dialog">
          <v-card>
            <v-card-title class="text-h6">
              <v-icon start color="primary">mdi-floppy</v-icon>
              Saving SPIFFS
            </v-card-title>
            <v-card-text class="progress-dialog__body">
              <div class="progress-dialog__label">
                {{ spiffsSaveDialog.label || 'Writing SPIFFS image...' }}
              </div>
              <v-progress-linear :model-value="spiffsSaveDialog.value" height="24" color="primary" rounded>
                <strong>{{ Math.min(100, Math.max(0, Math.floor(spiffsSaveDialog.value))) }}%</strong>
              </v-progress-linear>
            </v-card-text>
          </v-card>
        </v-dialog>

        <v-dialog :model-value="spiffsRestoreDialog.visible" persistent max-width="420" class="progress-dialog">
          <v-card>
            <v-card-title class="text-h6">
              <v-icon start color="primary">mdi-backup-restore</v-icon>
              Restoring SPIFFS
            </v-card-title>
            <v-card-text class="progress-dialog__body">
              <div class="progress-dialog__label">
                {{ spiffsRestoreDialog.label || 'Writing SPIFFS image...' }}
              </div>
              <v-progress-linear :model-value="spiffsRestoreDialog.value" height="24" color="primary" rounded>
                <strong>{{ Math.min(100, Math.max(0, Math.floor(spiffsRestoreDialog.value))) }}%</strong>
              </v-progress-linear>
            </v-card-text>
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

        <v-dialog :model-value="spiffsViewerDialog.visible" max-width="900" scrollable
          @update:model-value="value => { if (!value) closeSpiffsViewer(); }">
          <v-card>
            <v-card-title class="text-h6 d-flex align-center">
              <v-icon start>mdi-eye</v-icon>
              {{ spiffsViewerDialog.name || 'Preview' }}
            </v-card-title>
            <v-card-text>
              <v-progress-linear v-if="spiffsViewerDialog.loading" indeterminate color="primary" class="mb-4" />
              <v-alert v-else-if="spiffsViewerDialog.error" type="error" variant="tonal" border="start" class="mb-4">
                {{ spiffsViewerDialog.error }}
              </v-alert>
              <template v-else>
                <img
                  v-if="spiffsViewerDialog.mode === 'image' && spiffsViewerDialog.imageUrl"
                  :src="spiffsViewerDialog.imageUrl"
                  class="spiffs-viewer__image"
                  :alt="spiffsViewerDialog.name"
                />
                <pre v-else class="spiffs-viewer__content">{{ spiffsViewerDialog.content }}</pre>
              </template>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn variant="text" @click="closeSpiffsViewer">
                Close
              </v-btn>
              <v-btn color="primary" variant="tonal" :disabled="!spiffsViewerDialog.name"
                @click="handleSpiffsDownloadFile(spiffsViewerDialog.name)">
                <v-icon start>mdi-download</v-icon>
                Download
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <v-dialog :model-value="spiffsUploadErrorDialog.visible" max-width="480"
          @update:model-value="value => { if (!value) spiffsUploadErrorDialog.visible = false; }">
          <v-card>
            <v-card-title class="text-h6">
              <v-icon start color="error">mdi-alert-circle</v-icon>
              Upload Failed
            </v-card-title>
            <v-card-text class="text-body-2">
              {{ spiffsUploadErrorDialog.message || 'Not enough SPIFFS space to store this file.' }}
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn color="primary" variant="text" @click="spiffsUploadErrorDialog.visible = false">
                Close
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
import AppsTab from './components/AppsTab.vue';
import SpiffsManagerTab from './components/SpiffsManagerTab.vue';
import PartitionsTab from './components/PartitionsTab.vue';
import SessionLogTab from './components/SessionLogTab.vue';
import SerialMonitorTab from './components/SerialMonitorTab.vue';
import registerGuides from './data/register-guides.json';
import { InMemorySpiffsClient } from './utils/spiffs/spiffsClient';

const APP_NAME = 'ESPConnect';
const APP_VERSION = '1.00';
const APP_TAGLINE = 'Flash, back up, and troubleshoot your ESP32 straight from the browser.';

const SUPPORTED_VENDORS = [
  { usbVendorId: 0x303a },
  { usbVendorId: 0x1a86 },
  { usbVendorId: 0x10c4 },
  { usbVendorId: 0x0403 },
];

const DEFAULT_ROM_BAUD = 115200;
const DEFAULT_FLASH_BAUD = 921600;
const MONITOR_BAUD = 115200;
const DEBUG_SERIAL = false;
const SPIFFS_TEXT_EXTENSIONS = [
  'txt',
  'log',
  'json',
  'csv',
  'ini',
  'cfg',
  'conf',
  'htm',
  'html',
  'md',
  'js',
  'ts',
  'css',
  'xml',
  'yaml',
  'yml',
];
const SPIFFS_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'];
const SPIFFS_IMAGE_MIME_MAP = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
  webp: 'image/webp',
  svg: 'image/svg+xml',
};
const SPIFFS_VIEWER_MAX_BYTES = 2 * 1024 * 1024; // 2 MB previews
const SPIFFS_VIEWER_DECODER = new TextDecoder('utf-8', { fatal: false, ignoreBOM: true });

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

const APP_IMAGE_HEADER_MAGIC = 0xe9;
const APP_DESCRIPTOR_MAGIC = 0xabcd5432;
const APP_DESCRIPTOR_LENGTH = 0x100;
const APP_SCAN_LENGTH = 0x10000; // 64 KB
const OTA_SELECT_ENTRY_SIZE = 32;
const asciiDecoder = new TextDecoder('utf-8');

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

function formatErrorMessage(error) {
  if (!error) {
    return 'Unknown error';
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error instanceof Error) {
    return error.message || String(error);
  }
  if (typeof error === 'object') {
    if (error?.message) {
      return error.message;
    }
    try {
      return JSON.stringify(error);
    } catch (serializationError) {
      return String(error);
    }
  }
  return String(error);
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

function saveBinaryFile(name, data) {
  if (!data) return;
  const safeName = sanitizeFileName(name, 'download');
  const blob = new Blob([data], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = safeName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function resetSpiffsState() {
  spiffsState.selectedId = null;
  spiffsState.client = null;
  spiffsState.files = [];
  spiffsState.status = 'Load a SPIFFS partition to begin.';
  spiffsState.loading = false;
  spiffsState.busy = false;
  spiffsState.saving = false;
  spiffsState.error = null;
  spiffsState.readOnly = false;
  spiffsState.readOnlyReason = '';
  spiffsState.dirty = false;
  spiffsState.backupDone = false;
  spiffsState.sessionBackupDone = false;
  spiffsState.diagnostics = [];
  spiffsState.baselineFiles = [];
  spiffsState.usage = {
    capacityBytes: 0,
    usedBytes: 0,
    freeBytes: 0,
  };
  closeSpiffsViewer();
  spiffsUploadErrorDialog.visible = false;
  spiffsUploadErrorDialog.message = '';
  spiffsState.uploadBlocked = false;
  spiffsState.uploadBlockedReason = '';
}

function updateSpiffsUsage() {
  if (spiffsState.client && typeof spiffsState.client.getUsage === 'function') {
    spiffsState.usage = spiffsState.client.getUsage();
  } else {
    spiffsState.usage = {
      capacityBytes: 0,
      usedBytes: 0,
      freeBytes: 0,
    };
  }
}

function resolveSpiffsViewInfo(name = '') {
  if (!name) return null;
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex === -1) return null;
  const ext = name.slice(dotIndex + 1).toLowerCase();
  if (SPIFFS_TEXT_EXTENSIONS.includes(ext)) {
    return { mode: 'text', ext };
  }
  if (SPIFFS_IMAGE_EXTENSIONS.includes(ext)) {
    return { mode: 'image', ext, mime: SPIFFS_IMAGE_MIME_MAP[ext] || 'image/*' };
  }
  return null;
}

function hasSpiffsBackup() {
  return Boolean(spiffsState.backupDone || spiffsState.sessionBackupDone);
}

async function ensureSpiffsReady(options = {}) {
  if (!connected.value || !spiffsAvailable.value) {
    return;
  }
  const partition = spiffsSelectedPartition.value ?? spiffsPartitions.value[0];
  if (!partition) {
    return;
  }
  if (!spiffsState.selectedId) {
    spiffsState.selectedId = partition.id;
  }
  if (spiffsState.loading || spiffsState.busy || spiffsState.saving) {
    return;
  }
  if (options.force || !spiffsState.client || spiffsState.selectedId !== partition.id) {
    await loadSpiffsPartition(partition);
  }
}

async function loadSpiffsPartition(partition) {
  if (!loader.value || !partition) {
    spiffsState.error = 'Connect to a device with a SPIFFS partition first.';
    return;
  }
  spiffsState.selectedId = partition.id;
  spiffsState.loading = true;
  spiffsState.error = null;
  spiffsState.readOnly = false;
  spiffsState.readOnlyReason = '';
  spiffsState.status = `Reading SPIFFS @ 0x${partition.offset.toString(16).toUpperCase()}...`;
  spiffsLoadingDialog.visible = true;
  spiffsLoadingDialog.label = `Reading ${partition.label || 'SPIFFS'}...`;
  try {
    await releaseTransportReader();
    const image = await loader.value.readFlash(partition.offset, partition.size);
    let client;
    try {
      client = await InMemorySpiffsClient.fromImage(image);
    } catch (error) {
      spiffsState.error = formatErrorMessage(error);
      spiffsState.readOnly = true;
      spiffsState.readOnlyReason = 'SPIFFS image unreadable (possibly encrypted).';
      spiffsState.status = 'SPIFFS is read-only.';
      spiffsState.client = null;
      spiffsState.files = [];
      spiffsState.baselineFiles = [];
      updateSpiffsUsage();
      return;
    }
    spiffsState.client = client;
    spiffsState.files = await client.list();
    spiffsState.baselineFiles = spiffsState.files.map(file => ({
      name: file.name,
      size: file.size,
    }));
    spiffsState.dirty = false;
    spiffsState.backupDone = false;
    updateSpiffsUsage();
    const count = spiffsState.files.length;
    spiffsState.status = count === 1 ? 'Loaded 1 file.' : `Loaded ${count} files.`;
    appendLog(
      `SPIFFS partition ${partition.label} loaded (${count} file${count === 1 ? '' : 's'}).`,
      '[debug]'
    );
  } catch (error) {
    spiffsState.error = formatErrorMessage(error);
    spiffsState.status = 'Failed to read SPIFFS.';
  } finally {
    spiffsState.loading = false;
    spiffsLoadingDialog.visible = false;
  }
}

async function refreshSpiffsListing() {
  if (!spiffsState.client) {
    return;
  }
  spiffsState.files = await spiffsState.client.list();
  updateSpiffsUsage();
}

function markSpiffsDirty(message) {
  spiffsState.dirty = true;
  if (message) {
    spiffsState.status = message;
  }
}

function computeSpiffsDiff() {
  const baselineMap = new Map(spiffsState.baselineFiles.map(file => [file.name, file.size]));
  const currentMap = new Map(spiffsState.files.map(file => [file.name, file.size]));
  const added = [];
  const removed = [];
  const modified = [];
  for (const [name, size] of currentMap.entries()) {
    if (!baselineMap.has(name)) {
      added.push(`${name} (${formatBytes(size) ?? `${size} bytes`})`);
    } else if (baselineMap.get(name) !== size) {
      modified.push(
        `${name} (${formatBytes(baselineMap.get(name)) ?? baselineMap.get(name)} → ${formatBytes(size) ?? `${size} bytes`})`,
      );
    }
  }
  for (const [name, size] of baselineMap.entries()) {
    if (!currentMap.has(name)) {
      removed.push(`${name} (${formatBytes(size) ?? `${size} bytes`})`);
    }
  }
  return { added, removed, modified };
}

async function handleSelectSpiffsPartition(partitionId) {
  if (spiffsState.loading || spiffsState.busy || spiffsState.saving) {
    return;
  }
  spiffsState.selectedId = partitionId;
  spiffsState.client = null;
  spiffsState.files = [];
  spiffsState.status = 'Loading SPIFFS...';
  const partition =
    spiffsPartitions.value.find(entry => entry.id === partitionId) ?? spiffsPartitions.value[0];
  if (partition) {
    await loadSpiffsPartition(partition);
  }
}

async function handleRefreshSpiffs() {
  const partition = spiffsSelectedPartition.value;
  if (!partition) {
    return;
  }
  await loadSpiffsPartition(partition);
}

async function handleSpiffsBackup() {
  const partition = spiffsSelectedPartition.value;
  if (!partition) {
    spiffsState.status = 'Select a SPIFFS partition first.';
    return;
  }
  if (!loader.value) {
    spiffsState.status = 'Connect to a device first.';
    return;
  }
  spiffsBackupDialog.visible = true;
  spiffsBackupDialog.value = 0;
  spiffsBackupDialog.label = 'Preparing backup...';
  try {
    const baseLabel = `${partition.label || 'spiffs'}_${partition.offset.toString(16)}`;
    const safeBase = sanitizeFileName(baseLabel, 'spiffs');
    const stampedName = `${safeBase}_${formatBackupTimestamp()}.bin`;
    await downloadFlashRegion(partition.offset, partition.size, {
      label: `${partition.label} SPIFFS`,
      fileName: stampedName,
      suppressStatus: true,
      onProgress: progress => {
        spiffsBackupDialog.value = progress.value ?? 0;
        spiffsBackupDialog.label = progress.label || 'Backing up SPIFFS...';
      },
    });
    spiffsState.backupDone = true;
    spiffsState.sessionBackupDone = true;
    spiffsState.status = 'Backup downloaded. You can now save changes.';
    appendLog('SPIFFS backup downloaded.', '[debug]');
  } catch (error) {
    spiffsState.error = formatErrorMessage(error);
    spiffsState.status = 'SPIFFS backup failed.';
  } finally {
    spiffsBackupDialog.visible = false;
    spiffsBackupDialog.value = 0;
    spiffsBackupDialog.label = '';
  }
}

async function handleSpiffsRestore(file) {
  const partition = spiffsSelectedPartition.value;
  if (!partition) return;
  if (!file) return;
  const buffer = new Uint8Array(await file.arrayBuffer());
  if (buffer.length !== partition.size) {
    spiffsState.status = `Restore file must be exactly ${formatBytes(partition.size) ?? `${partition.size} bytes`}.`;
    return;
  }
  const confirmed = await showConfirmation({
    title: 'Restore SPIFFS Partition',
    message:
      'This will overwrite the entire SPIFFS partition with the selected image. Continue?',
    confirmText: 'Restore',
    destructive: true,
  });
  if (!confirmed) {
    return;
  }
  try {
    spiffsState.saving = true;
    maintenanceBusy.value = true;
    spiffsRestoreDialog.visible = true;
    spiffsRestoreDialog.value = 0;
    spiffsRestoreDialog.label = 'Writing SPIFFS image...';
    await writeSpiffsImage(partition, buffer, progress => {
      spiffsRestoreDialog.value = progress.value ?? 0;
      spiffsRestoreDialog.label = progress.label || 'Writing SPIFFS image...';
    });
    spiffsState.status = 'SPIFFS image restored.';
    spiffsState.backupDone = true;
    appendLog('SPIFFS partition restored from backup.', '[debug]');
    await loadSpiffsPartition(partition);
  } catch (error) {
    spiffsState.error = formatErrorMessage(error);
    spiffsState.status = 'Restore failed.';
  } finally {
    spiffsState.saving = false;
    maintenanceBusy.value = false;
    spiffsRestoreDialog.visible = false;
    spiffsRestoreDialog.value = 0;
    spiffsRestoreDialog.label = 'Restoring SPIFFS image...';
  }
}

async function handleSpiffsDownloadFile(name) {
  if (!spiffsState.client) return;
  try {
    const data = await spiffsState.client.read(name);
    saveBinaryFile(name, data);
    appendLog(`SPIFFS downloaded ${name} (${data.length.toLocaleString()} bytes).`, '[debug]');
  } catch (error) {
    spiffsState.error = formatErrorMessage(error);
  }
}

function handleSpiffsUploadSelection(file) {
  if (!file || !spiffsState.client) {
    spiffsState.uploadBlocked = false;
    spiffsState.uploadBlockedReason = '';
    return;
  }
  const targetName = (file.name || '').trim();
  if (!targetName) {
    spiffsState.uploadBlocked = true;
    spiffsState.uploadBlockedReason = 'Selected file must have a name.';
    return;
  }
  if (
    typeof spiffsState.client.canFit === 'function' &&
    !spiffsState.client.canFit(targetName, file.size ?? 0)
  ) {
    const message = 'Not enough SPIFFS space for this file. Delete files or format the partition, then try again.';
    spiffsState.uploadBlocked = true;
    spiffsState.uploadBlockedReason = message;
    spiffsUploadErrorDialog.message = message;
    spiffsUploadErrorDialog.visible = true;
    return;
  }
  spiffsState.uploadBlocked = false;
  spiffsState.uploadBlockedReason = '';
}

function isViewableSpiffsFile(name = '') {
  return Boolean(resolveSpiffsViewInfo(name));
}

async function handleSpiffsView(name) {
  if (!spiffsState.client) return;
  const viewInfo = resolveSpiffsViewInfo(name);
  if (!viewInfo) {
    spiffsState.status = 'This file type cannot be previewed. Download it instead.';
    return;
  }
  if (spiffsViewerDialog.imageUrl) {
    URL.revokeObjectURL(spiffsViewerDialog.imageUrl);
  }
  spiffsViewerDialog.visible = true;
  spiffsViewerDialog.name = name;
  spiffsViewerDialog.loading = true;
  spiffsViewerDialog.error = null;
  spiffsViewerDialog.content = '';
  spiffsViewerDialog.imageUrl = '';
  spiffsViewerDialog.mode = viewInfo.mode;
  try {
    const data = await spiffsState.client.read(name);
    if (data.length > SPIFFS_VIEWER_MAX_BYTES) {
      throw new Error(
        `File too large to preview (limit ${formatBytes(SPIFFS_VIEWER_MAX_BYTES) ?? SPIFFS_VIEWER_MAX_BYTES} bytes).`,
      );
    }
    if (viewInfo.mode === 'image') {
      const blob = new Blob([data], { type: viewInfo.mime || 'image/*' });
      spiffsViewerDialog.imageUrl = URL.createObjectURL(blob);
    } else {
      spiffsViewerDialog.content = SPIFFS_VIEWER_DECODER.decode(data);
    }
  } catch (error) {
    spiffsViewerDialog.error = formatErrorMessage(error);
  } finally {
    spiffsViewerDialog.loading = false;
  }
}

function closeSpiffsViewer() {
  if (spiffsViewerDialog.imageUrl) {
    URL.revokeObjectURL(spiffsViewerDialog.imageUrl);
  }
  spiffsViewerDialog.visible = false;
  spiffsViewerDialog.name = '';
  spiffsViewerDialog.content = '';
  spiffsViewerDialog.error = null;
  spiffsViewerDialog.loading = false;
  spiffsViewerDialog.mode = null;
  spiffsViewerDialog.imageUrl = '';
}

function cancelSpiffsBackup() {
  if (!spiffsBackupDialog.visible) {
    return;
  }
  spiffsBackupDialog.label = 'Stopping backup...';
  handleCancelDownload();
}

async function handleSpiffsUpload({ file }) {
  if (!spiffsState.client) return;
  if (spiffsState.readOnly) {
    spiffsState.status = spiffsState.readOnlyReason || 'SPIFFS is read-only.';
    return;
  }
  if (spiffsState.uploadBlocked) {
    spiffsState.status = spiffsState.uploadBlockedReason || 'Resolve blocked upload before continuing.';
    if (spiffsState.uploadBlockedReason) {
      spiffsUploadErrorDialog.message = spiffsState.uploadBlockedReason;
      spiffsUploadErrorDialog.visible = true;
    }
    return;
  }
  if (!file) {
    spiffsState.status = 'Select a file to upload.';
    return;
  }
  const targetName = (file.name || '').trim();
  if (!targetName) {
    spiffsState.status = 'Selected file has no name. Rename it and try again.';
    return;
  }
  try {
    spiffsState.busy = true;
    const data = new Uint8Array(await file.arrayBuffer());
    await spiffsState.client.write(targetName, data);
    await refreshSpiffsListing();
    markSpiffsDirty(`Staged ${targetName}. Remember to Save.`);
    appendLog(`SPIFFS staged ${targetName} (${data.length.toLocaleString()} bytes).`, '[debug]');
    spiffsState.uploadBlocked = false;
    spiffsState.uploadBlockedReason = '';
  } catch (error) {
    const isSpaceError = typeof error?.message === 'string' && error.message.includes('Not enough SPIFFS space');
    const friendly = isSpaceError
      ? 'Not enough SPIFFS space for this file. Delete files or format the partition, then try again.'
      : formatErrorMessage(error);
    spiffsState.status = friendly || 'SPIFFS upload failed.';
    if (!isSpaceError) {
      spiffsState.error = friendly;
    }
    if (isSpaceError) {
      spiffsUploadErrorDialog.message = friendly;
      spiffsUploadErrorDialog.visible = true;
    }
  } finally {
    spiffsState.busy = false;
  }
}

async function handleSpiffsDelete(name) {
  if (!spiffsState.client || spiffsState.readOnly) {
    return;
  }
  const confirmed = await showConfirmation({
    title: 'Delete File',
    message: `Delete ${name} from SPIFFS? This cannot be undone.`,
    confirmText: 'Delete',
    destructive: true,
  });
  if (!confirmed) {
    return;
  }
  try {
    spiffsState.busy = true;
    await spiffsState.client.remove(name);
    await refreshSpiffsListing();
    markSpiffsDirty(`${name} deleted. Save to persist.`);
    appendLog(`SPIFFS staged deletion of ${name}.`, '[debug]');
  } catch (error) {
    spiffsState.error = formatErrorMessage(error);
  } finally {
    spiffsState.busy = false;
  }
}

async function handleSpiffsFormat() {
  if (!spiffsState.client || spiffsState.readOnly) {
    return;
  }
  const confirmed = await showConfirmation({
    title: 'Format SPIFFS',
    message: 'Erase all files from the SPIFFS image? You must Save to apply.',
    confirmText: 'Format',
    destructive: true,
  });
  if (!confirmed) return;
  try {
    spiffsState.busy = true;
    await spiffsState.client.format();
    await refreshSpiffsListing();
    markSpiffsDirty('SPIFFS formatted. Save to apply.');
    appendLog('SPIFFS staged format operation.', '[debug]');
  } catch (error) {
    spiffsState.error = formatErrorMessage(error);
  } finally {
    spiffsState.busy = false;
  }
}

async function handleSpiffsSave() {
  if (!spiffsState.client) {
    spiffsState.status = 'Load a SPIFFS partition first.';
    return;
  }
  if (spiffsState.readOnly) {
    spiffsState.status = spiffsState.readOnlyReason || 'SPIFFS is read-only.';
    return;
  }
  if (!spiffsState.dirty) {
    spiffsState.status = 'No staged changes to save.';
    return;
  }
  if (!hasSpiffsBackup()) {
    spiffsState.status = 'Download a SPIFFS backup before saving (one backup per session is enough).';
    return;
  }
  const partition = spiffsSelectedPartition.value;
  if (!partition) {
    spiffsState.status = 'Select a SPIFFS partition.';
    return;
  }
  const diff = computeSpiffsDiff();
  const summaryParts = [];
  if (diff.added.length) summaryParts.push(`Added: ${diff.added.join(', ')}`);
  if (diff.modified.length) summaryParts.push(`Modified: ${diff.modified.join(', ')}`);
  if (diff.removed.length) summaryParts.push(`Removed: ${diff.removed.join(', ')}`);
  const summary =
    summaryParts.length > 0
      ? summaryParts.join('\n')
      : 'No file-level changes detected (still writing updated image).';
  const confirmed = await showConfirmation({
    title: 'Write SPIFFS to Flash',
    message: `${summary}\n\nWrite these changes to flash now?`,
    confirmText: 'Save to Flash',
    destructive: true,
  });
  if (!confirmed) return;
  try {
    spiffsState.saving = true;
    maintenanceBusy.value = true;
    spiffsSaveDialog.visible = true;
    const image = await spiffsState.client.toImage();
    if (image.length > partition.size) {
      throw new Error('SPIFFS image exceeds partition size.');
    }
    await writeSpiffsImage(partition, image, progress => {
      spiffsSaveDialog.value = progress.value ?? 0;
      spiffsSaveDialog.label = progress.label || 'Writing SPIFFS image...';
    });
    spiffsState.dirty = false;
    spiffsState.status = 'SPIFFS saved to flash.';
    appendLog('SPIFFS partition updated on flash.', '[debug]');
    await loadSpiffsPartition(partition);
  } catch (error) {
    spiffsState.error = formatErrorMessage(error);
    spiffsState.status = 'SPIFFS save failed.';
  } finally {
    spiffsState.saving = false;
    maintenanceBusy.value = false;
    spiffsSaveDialog.visible = false;
    spiffsSaveDialog.value = 0;
    spiffsSaveDialog.label = 'Saving SPIFFS...';
  }
}

async function writeSpiffsImage(partition, image, onProgress) {
  if (!loader.value) {
    throw new Error('Loader unavailable.');
  }
  await releaseTransportReader();
  const dataString = loader.value.ui8ToBstr(image);
  await loader.value.writeFlash({
    fileArray: [{ data: dataString, address: partition.offset }],
    flashSize: 'keep',
    flashMode: 'keep',
    flashFreq: 'keep',
    eraseAll: false,
    compress: true,
    reportProgress: (_fileIndex, written, total) => {
      const progressValue = total ? Math.min(100, Math.floor((written / total) * 100)) : 0;
      const label = `Writing SPIFFS... ${written.toLocaleString()} / ${total.toLocaleString()} bytes`;
      spiffsState.status = label;
      onProgress?.({
        value: progressValue,
        label,
        written,
        total,
      });
    },
  });
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
const selectedBaud = ref(String(DEFAULT_FLASH_BAUD));
const baudrateOptions = ['115200', '230400', '460800', '921600'];
const flashOffset = ref('0x0');
const eraseFlash = ref(false);
const selectedPreset = ref(null);
const selectedPartitionDownload = ref(null);
const integrityPartition = ref(null);
const currentBaud = ref(DEFAULT_FLASH_BAUD);
const lastFlashBaud = ref(DEFAULT_FLASH_BAUD);
const previousMonitorBaud = ref(DEFAULT_FLASH_BAUD);
let suspendBaudWatcher = false;
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
const appPartitions = ref([]);
const appMetadataLoading = ref(false);
const appMetadataError = ref(null);
const activeAppSlotId = ref(null);
const appActiveSummary = ref('Active slot unknown.');
const appMetadataLoaded = ref(false);
const spiffsState = reactive({
  selectedId: null,
  files: [],
  status: 'Load a SPIFFS partition to begin.',
  loading: false,
  busy: false,
  saving: false,
  error: null,
  client: null,
  readOnly: false,
  readOnlyReason: '',
  dirty: false,
  backupDone: false,
  sessionBackupDone: false,
  diagnostics: [],
  baselineFiles: [],
  usage: {
    capacityBytes: 0,
    usedBytes: 0,
    freeBytes: 0,
  },
  uploadBlocked: false,
  uploadBlockedReason: '',
});
const spiffsBackupDialog = reactive({
  visible: false,
  value: 0,
  label: '',
});
const spiffsLoadingDialog = reactive({
  visible: false,
  value: 0,
  label: 'Reading SPIFFS...',
});
const spiffsSaveDialog = reactive({
  visible: false,
  value: 0,
  label: 'Saving SPIFFS...',
});
const spiffsRestoreDialog = reactive({
  visible: false,
  value: 0,
  label: 'Restoring SPIFFS image...',
});
const spiffsViewerDialog = reactive({
  visible: false,
  name: '',
  content: '',
  error: null,
  loading: false,
  mode: null,
  imageUrl: '',
});
const spiffsUploadErrorDialog = reactive({
  visible: false,
  message: '',
});
const spiffsPartitions = computed(() =>
  partitionTable.value
    .filter(
      entry =>
        entry &&
        typeof entry.type === 'number' &&
        typeof entry.subtype === 'number' &&
        entry.type === 0x01 &&
        entry.subtype === 0x82,
    )
    .map(entry => ({
      id: entry.offset,
      label: entry.label?.trim() || 'SPIFFS',
      offset: entry.offset,
      size: entry.size,
      sizeText: formatBytes(entry.size) ?? `${entry.size} bytes`,
    })),
);
const spiffsAvailable = computed(() => spiffsPartitions.value.length > 0);
const spiffsSelectedPartition = computed(() =>
  spiffsPartitions.value.find(partition => partition.id === spiffsState.selectedId) ?? null,
);
const hasSpiffsPartitionSelected = computed(() => Boolean(spiffsSelectedPartition.value));
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
const navigationItems = computed(() => [
  { title: 'Device Info', value: 'info', icon: 'mdi-information-outline', disabled: false },
  { title: 'Partitions', value: 'partitions', icon: 'mdi-table', disabled: false },
  {
    title: 'Apps',
    value: 'apps',
    icon: 'mdi-application',
    disabled: !connected.value,
  },
  {
    title: 'SPIFFS Tools',
    value: 'spiffs',
    icon: 'mdi-folder-wrench',
    disabled: !connected.value || !spiffsAvailable.value,
  },
  { title: 'Firmware Tools', value: 'flash', icon: 'mdi-chip', disabled: false },
  { title: 'Serial Monitor', value: 'console', icon: 'mdi-console-line', disabled: false },
  { title: 'Session Log', value: 'log', icon: 'mdi-clipboard-text-outline', disabled: false },
]);

const resourceLinks = [
  {
    title: 'Tutorial',
    href: 'https://www.youtube.com/channel/UCnnU_HGvTr8ewpqvHe2llDw',
    icon: 'mdi-youtube',
  },
  {
    title: 'Buy Me a Coffee',
    href: 'https://buymeacoffee.com/thelastoutpostworkshop',
    icon: 'mdi-coffee',
  },
  {
    title: 'Get Help',
    href: 'https://github.com/thelastoutpostworkshop/ESP32PartitionBuilder',
    icon: 'mdi-lifebuoy',
  },
];
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

async function setConnectionBaud(targetBaud, options = {}) {
  const { remember = true, log = true, updateDropdown = true } = options;
  const parsed = Number.parseInt(targetBaud, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return;
  }

  if (connected.value && loader.value) {
    try {
      baudChangeBusy.value = true;
      if (log) {
        appendLog('Changing baud to ' + parsed.toLocaleString() + ' bps...', '[debug]');
      }
      loader.value.baudrate = parsed;
      await loader.value.changeBaud(parsed);
      if (transport.value) {
        transport.value.baudrate = parsed;
      }
      if (log) {
        appendLog('Baud changed to ' + parsed.toLocaleString() + ' bps.', '[debug]');
      }
    } catch (error) {
      if (log) {
        appendLog('Baud change failed: ' + (error?.message || error), '[warn]');
      }
      throw error;
    } finally {
      baudChangeBusy.value = false;
    }
  }

  currentBaud.value = parsed;
  if (updateDropdown) {
    const previousSuspendState = suspendBaudWatcher;
    suspendBaudWatcher = true;
    selectedBaud.value = String(parsed);
    queueMicrotask(() => {
      suspendBaudWatcher = previousSuspendState;
    });
  }
  if (remember) {
    lastFlashBaud.value = parsed;
  }
}

watch(selectedBaud, async (value, oldValue) => {
  if (suspendBaudWatcher) {
    return;
  }
  if (value === oldValue) {
    return;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    appendLog('Ignoring invalid baud selection: ' + value, '[warn]');
    if (oldValue != null) {
      const previousSuspendState = suspendBaudWatcher;
      suspendBaudWatcher = true;
      selectedBaud.value = oldValue;
      queueMicrotask(() => {
        suspendBaudWatcher = previousSuspendState;
      });
    } else {
      const previousSuspendState = suspendBaudWatcher;
      suspendBaudWatcher = true;
      selectedBaud.value = String(currentBaud.value);
      queueMicrotask(() => {
        suspendBaudWatcher = previousSuspendState;
      });
    }
    return;
  }
  if (!connected.value || !loader.value) {
    currentBaud.value = parsed;
    lastFlashBaud.value = parsed;
    return;
  }
  if (parsed === currentBaud.value) {
    lastFlashBaud.value = parsed;
    return;
  }
  if (busy.value || flashInProgress.value || maintenanceBusy.value || baudChangeBusy.value || monitorActive.value) {
    appendLog(
      'Cannot change baud while operations are running. Keeping ' + currentBaud.value.toLocaleString() + ' bps.',
      '[warn]'
    );
    const previousSuspendState = suspendBaudWatcher;
    suspendBaudWatcher = true;
    selectedBaud.value = String(currentBaud.value);
    queueMicrotask(() => {
      suspendBaudWatcher = previousSuspendState;
    });
    return;
  }
  try {
    await setConnectionBaud(parsed, { remember: true, log: true, updateDropdown: false });
  } catch (error) {
    const previousSuspendState = suspendBaudWatcher;
    suspendBaudWatcher = true;
    selectedBaud.value = String(currentBaud.value);
    queueMicrotask(() => {
      suspendBaudWatcher = previousSuspendState;
    });
  }
});

watch(activeTab, value => {
  if (value === 'apps') {
    void loadAppMetadata();
  }
  if (value === 'spiffs') {
    void ensureSpiffsReady();
  }
});

watch(
  () => partitionTable.value,
  () => {
    appMetadataLoaded.value = false;
    if (activeTab.value === 'apps' && connected.value) {
      void loadAppMetadata({ force: true });
    }
    if (!connected.value) {
      resetSpiffsState();
      return;
    }
    if (spiffsPartitions.value.length) {
      if (!spiffsPartitions.value.some(partition => partition.id === spiffsState.selectedId)) {
        spiffsState.selectedId = spiffsPartitions.value[0].id;
      }
      if (activeTab.value === 'spiffs') {
        void ensureSpiffsReady();
      }
    } else {
      resetSpiffsState();
    }
  }
);

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

function readUint32LE(buffer, offset) {
  if (!buffer || offset == null || offset < 0 || offset + 4 > buffer.length) {
    return 0;
  }
  return (
    buffer[offset] |
    (buffer[offset + 1] << 8) |
    (buffer[offset + 2] << 16) |
    (buffer[offset + 3] << 24)
  ) >>> 0;
}

function decodeCString(bytes) {
  if (!bytes || !bytes.length) {
    return '';
  }
  let end = bytes.indexOf(0);
  if (end === -1) {
    end = bytes.length;
  }
  if (end <= 0) {
    return '';
  }
  try {
    return asciiDecoder.decode(bytes.subarray(0, end)).trim();
  } catch (error) {
    console.warn('Failed to decode string', error);
    return '';
  }
}

function extractAppDescriptor(buffer) {
  if (!buffer || buffer.length < APP_DESCRIPTOR_LENGTH) {
    return null;
  }
  for (let offset = 0; offset + 4 <= buffer.length; offset += 4) {
    if (readUint32LE(buffer, offset) !== APP_DESCRIPTOR_MAGIC) {
      continue;
    }
    if (offset + APP_DESCRIPTOR_LENGTH > buffer.length) {
      continue;
    }
    const view = buffer.subarray(offset, offset + APP_DESCRIPTOR_LENGTH);
    const versionOffset = 16;
    const projectOffset = versionOffset + 32;
    const timeOffset = projectOffset + 32;
    const dateOffset = timeOffset + 16;
    const idfOffset = dateOffset + 16;
    const descriptor = {
      version: decodeCString(view.subarray(versionOffset, versionOffset + 32)),
      projectName: decodeCString(view.subarray(projectOffset, projectOffset + 32)),
      time: decodeCString(view.subarray(timeOffset, timeOffset + 16)),
      date: decodeCString(view.subarray(dateOffset, dateOffset + 16)),
      idfVersion: decodeCString(view.subarray(idfOffset, idfOffset + 32)),
    };
    return descriptor;
  }
  return null;
}

function detectActiveOtaSlot(otadata, otaEntries) {
  const otaCount = otaEntries?.length ?? 0;
  if (!otadata || !otadata.length || !otaCount) {
    return { slotId: null, summary: 'Active slot unknown.' };
  }
  const entryCount = Math.min(Math.floor(otadata.length / OTA_SELECT_ENTRY_SIZE), otaCount > 1 ? 2 : 1);
  const entries = [];
  for (let index = 0; index < entryCount; index += 1) {
    const base = index * OTA_SELECT_ENTRY_SIZE;
    const seq = readUint32LE(otadata, base);
    if (!seq || Number.isNaN(seq) || seq === 0xffffffff || seq === 0xfffffffe || seq >= 0x80000000) {
      continue;
    }
    const slotIndex = (seq - 1) % otaCount;
    if (slotIndex < 0 || slotIndex >= otaCount) {
      continue;
    }
    const stateOffset = base + 16;
    const state = stateOffset < otadata.length ? otadata[stateOffset] : null;
    entries.push({
      seq,
      slotIndex,
      state,
    });
  }
  if (!entries.length) {
    return { slotId: null, summary: 'Active slot unknown.' };
  }
  entries.sort((a, b) => b.seq - a.seq);
  const winner = entries[0];
  const slotEntry = otaEntries[winner.slotIndex];
  if (!slotEntry) {
    return { slotId: null, summary: 'Active slot unknown.' };
  }
  const slotId = `ota_${winner.slotIndex}`;
  return {
    slotId,
    summary: `Active slot: ${slotId} (sequence ${winner.seq})`,
  };
}

async function analyzeAppPartitions(loaderInstance, partitions) {
  appPartitions.value = [];
  activeAppSlotId.value = null;
  appMetadataError.value = null;
  appActiveSummary.value = 'Active slot unknown.';
  if (!loaderInstance || !Array.isArray(partitions) || !partitions.length) {
    return;
  }

  const appEntries = partitions
    .filter(entry => entry && entry.type === 0x00)
    .map(entry => ({ ...entry }))
    .sort((a, b) => a.offset - b.offset);

  if (!appEntries.length) {
    return;
  }

  const factoryEntry = appEntries.find(entry => entry.subtype === 0x00);
  const otaEntries = appEntries
    .filter(entry => entry.subtype >= 0x10 && entry.subtype <= 0x1f)
    .sort((a, b) => (a.subtype ?? 0) - (b.subtype ?? 0));

  let activeSlotId = null;
  let activeSummary = 'Active slot unknown.';
  const otadataEntry = partitions.find(entry => entry.type === 0x01 && entry.subtype === 0x02);
  if (otadataEntry && otaEntries.length) {
    try {
      const readLength = Math.min(Math.max(OTA_SELECT_ENTRY_SIZE * 2, 64), otadataEntry.size || OTA_SELECT_ENTRY_SIZE * 2);
      const otadata = await loaderInstance.readFlash(otadataEntry.offset, readLength);
      const detected = detectActiveOtaSlot(otadata, otaEntries);
      if (detected.slotId) {
        activeSlotId = detected.slotId;
        activeSummary = detected.summary;
      }
    } catch (error) {
      console.warn('Failed to read OTA data partition', error);
      appMetadataError.value = 'Unable to read OTA metadata.';
    }
  }

  if (!activeSlotId) {
    if (factoryEntry) {
      activeSlotId = 'factory';
      activeSummary = 'Active slot: factory (fallback)';
    } else {
      activeSummary = 'Active slot unknown.';
    }
  }

  const results = [];
  for (const entry of appEntries) {
    const slotLabel =
      entry.subtype === 0x00
        ? 'factory'
        : entry.subtype >= 0x10 && entry.subtype <= 0x1f
          ? `ota_${entry.subtype - 0x10}`
          : `subtype_0x${entry.subtype.toString(16)}`;

    const readSize = Math.min(APP_SCAN_LENGTH, entry.size || APP_SCAN_LENGTH);
    let buffer = null;
    let imageError = null;
    if (readSize >= 24) {
      try {
        buffer = await loaderInstance.readFlash(entry.offset, readSize);
      } catch (error) {
        imageError = error?.message || String(error);
        console.warn(`Failed to read app partition ${entry.label || slotLabel}`, error);
      }
    } else {
      imageError = 'Partition too small to contain app image header.';
    }

    const offsetHex = `0x${entry.offset.toString(16).toUpperCase()}`;
    const sizeText = formatBytes(entry.size) ?? `${entry.size} bytes`;
    const displayName = entry.label?.trim() || slotLabel.toUpperCase();
    const appInfo = {
      key: `${slotLabel}-${entry.offset}`,
      label: displayName,
      slotLabel,
      subtype: entry.subtype,
      offset: entry.offset,
      offsetHex,
      size: entry.size,
      sizeText,
      isActive: false,
      valid: false,
      segmentCount: null,
    entryAddress: null,
    entryAddressHex: null,
      projectName: null,
      version: null,
      built: null,
      buildDate: null,
      buildTime: null,
      idfVersion: null,
      descriptorFound: false,
      error: null,
    };

    if (imageError) {
      appInfo.error = imageError;
      results.push(appInfo);
      continue;
    }

    if (!buffer || buffer.length < 8) {
      appInfo.error = 'App header truncated.';
      results.push(appInfo);
      continue;
    }

    if (buffer[0] !== APP_IMAGE_HEADER_MAGIC) {
      appInfo.error = 'Encrypted or invalid image header.';
      results.push(appInfo);
      continue;
    }

    appInfo.valid = true;
    appInfo.segmentCount = buffer[1];
    appInfo.entryAddress = readUint32LE(buffer, 4);
    appInfo.entryAddressHex =
      appInfo.entryAddress != null
        ? `0x${appInfo.entryAddress.toString(16).toUpperCase()}`
        : null;

    const descriptor = extractAppDescriptor(buffer);
    if (descriptor) {
      appInfo.descriptorFound = true;
      appInfo.projectName = descriptor.projectName || null;
      appInfo.version = descriptor.version || null;
      appInfo.buildTime = descriptor.time || null;
      appInfo.buildDate = descriptor.date || null;
      appInfo.idfVersion = descriptor.idfVersion || null;
      const builtParts = [];
      if (descriptor.date) builtParts.push(descriptor.date);
      if (descriptor.time) builtParts.push(descriptor.time);
      appInfo.built = builtParts.join(' ').trim() || null;
    }

    results.push(appInfo);
  }

  let resolvedSlotId = activeSlotId;
  let resolvedSummary = activeSummary;
  const activeInfoCandidate = resolvedSlotId
    ? results.find(info => info.slotLabel === resolvedSlotId)
    : null;

  if (!activeInfoCandidate || !activeInfoCandidate.valid) {
    const fallbackCandidates = [
      results.find(info => info.valid && info.slotLabel === 'factory'),
      results.find(info => info.valid && info.slotLabel.startsWith('ota_')),
      results.find(info => info.valid),
    ].filter(Boolean);
    const fallbackInfo = fallbackCandidates.length ? fallbackCandidates[0] : null;
    if (fallbackInfo) {
      resolvedSlotId = fallbackInfo.slotLabel;
      resolvedSummary =
        activeInfoCandidate && !activeInfoCandidate.valid
          ? `Active slot ${activeInfoCandidate.slotLabel} invalid. Using ${fallbackInfo.slotLabel}.`
          : `Active slot inferred: ${fallbackInfo.slotLabel}.`;
    } else if (activeInfoCandidate && !activeInfoCandidate.valid) {
      resolvedSlotId = null;
      resolvedSummary = 'Active slot invalid.';
    }
  }

  for (const info of results) {
    info.isActive = resolvedSlotId ? info.slotLabel === resolvedSlotId : false;
  }

  appPartitions.value = results;
  activeAppSlotId.value = resolvedSlotId;
  appActiveSummary.value = resolvedSummary;
  appMetadataLoaded.value = true;
}

function resetAppMetadata() {
  appPartitions.value = [];
  appMetadataLoading.value = false;
  appMetadataError.value = null;
  activeAppSlotId.value = null;
  appActiveSummary.value = 'Active slot unknown.';
  appMetadataLoaded.value = false;
}

async function loadAppMetadata(options = {}) {
  const force = options.force ?? false;
  if (appMetadataLoading.value) {
    return;
  }
  if (!force && appMetadataLoaded.value) {
    return;
  }
  if (!connected.value || !loader.value) {
    return;
  }
  const partitions = partitionTable.value;
  if (!Array.isArray(partitions) || !partitions.length) {
    return;
  }
  appMetadataLoading.value = true;
  appMetadataError.value = null;
  appMetadataLoaded.value = false;
  try {
    await analyzeAppPartitions(loader.value, partitions);
  } catch (error) {
    console.warn('Failed to analyze app partitions', error);
    appMetadataError.value = error?.message || String(error);
    appMetadataLoaded.value = false;
  } finally {
    appMetadataLoading.value = false;
  }
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
    !flashInProgress.value
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
  previousMonitorBaud.value = currentBaud.value || lastFlashBaud.value || DEFAULT_FLASH_BAUD;
  if (currentBaud.value !== MONITOR_BAUD) {
    try {
      await setConnectionBaud(MONITOR_BAUD, { remember: false, log: true });
    } catch (error) {
      appendLog(
        `Continuing monitor at ${currentBaud.value.toLocaleString()} bps (switch failed: ${error?.message || error}).`,
        '[warn]'
      );
    }
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
  const restoreBaud =
    previousMonitorBaud.value || lastFlashBaud.value || DEFAULT_FLASH_BAUD;
  if (restoreBaud && restoreBaud !== currentBaud.value) {
    try {
      await setConnectionBaud(restoreBaud, { remember: true, log: true });
    } catch (error) {
      appendLog(
        `Failed to restore baud rate (${error?.message || error}). Remaining at ${currentBaud.value.toLocaleString()} bps.`,
        '[warn]'
      );
    }
  }
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
    resetSpiffsState();
    spiffsState.selectedId = null;
    currentBaud.value = DEFAULT_FLASH_BAUD;
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
    const desiredBaud = Number.parseInt(selectedBaud.value, 10) || DEFAULT_FLASH_BAUD;
    const connectBaud = DEFAULT_ROM_BAUD;
    lastFlashBaud.value = desiredBaud;
    const portDetails = currentPort.value?.getInfo ? currentPort.value.getInfo() : null;
    transport.value = new Transport(currentPort.value, DEBUG_SERIAL);
    transport.value.tracing = DEBUG_SERIAL;
    loader.value = new ESPLoader({
      transport: transport.value,
      baudrate: connectBaud,
      romBaudrate: DEFAULT_ROM_BAUD,
      terminal,
      enableTracing: DEBUG_SERIAL,
    });
    currentBaud.value = connectBaud;
    transport.value.baudrate = connectBaud;

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

    if (desiredBaud !== connectBaud) {
      try {
        await setConnectionBaud(desiredBaud, { remember: true, log: true, updateDropdown: false });
        const previousSuspendState = suspendBaudWatcher;
        suspendBaudWatcher = true;
        selectedBaud.value = String(desiredBaud);
        queueMicrotask(() => {
          suspendBaudWatcher = previousSuspendState;
        });
      } catch (error) {
        appendLog(
          `Fast baud negotiation failed (${error?.message || error}). Staying at ${connectBaud.toLocaleString()} bps.`,
          '[warn]'
        );
        lastFlashBaud.value = connectBaud;
        const previousSuspendState = suspendBaudWatcher;
        suspendBaudWatcher = true;
        selectedBaud.value = String(connectBaud);
        queueMicrotask(() => {
          suspendBaudWatcher = previousSuspendState;
        });
      }
    } else {
      lastFlashBaud.value = desiredBaud;
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
    appMetadataLoaded.value = false;

    if (portDetails) {
      pushFact('USB Bridge', formatUsbBridge(portDetails));
    }

    pushFact('Connection Baud', `${currentBaud.value.toLocaleString()} bps`);

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
      const message = formatErrorMessage(error);
      appendLog(`Connection failed: ${message}`, '[error]');
      lastErrorMessage.value = message;
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
  resetAppMetadata();
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

function formatBackupTimestamp(date = new Date()) {
  const pad = value => String(value).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_` +
    `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
  );
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

  const { label, fileName, suppressStatus = false, onProgress } = options;
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
          if (typeof onProgress === 'function') {
            onProgress({
              value: progressValue,
              label: progressLabel,
              written: overallReceived,
              total: length,
            });
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
  if (typeof onProgress === 'function') {
    onProgress({
      value: 100,
      label: 'Download complete.',
      written: length,
      total: length,
    });
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
.status-bar {
  backdrop-filter: blur(22px);
  background: linear-gradient(90deg,
      color-mix(in srgb, var(--v-theme-surface) 88%, transparent) 0%,
      color-mix(in srgb, var(--v-theme-surface) 70%, #04070c 30%) 100%);
  border-bottom: 1px solid color-mix(in srgb, var(--v-theme-primary) 18%, transparent);
  box-shadow:
    0 18px 26px rgba(15, 23, 42, 0.24),
    inset 0 1px 0 color-mix(in srgb, #ffffff 12%, transparent);
}

.status-bar :deep(.v-toolbar__content) {
  padding: 0;
}

.status-bar__container {
  display: flex;
  align-items: center;
  gap: 20px;
  padding-inline: 12px;
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

.confirmation-message {
  white-space: pre-line;
}

.app-drawer {
  border-right: 1px solid color-mix(in srgb, var(--v-theme-primary) 10%, transparent);
  background: linear-gradient(180deg,
      color-mix(in srgb, var(--v-theme-surface) 88%, #000000 12%) 0%,
      color-mix(in srgb, var(--v-theme-surface) 70%, #020202 30%) 100%);
}

.app-drawer :deep(.v-navigation-drawer__content) {
  padding-block: 24px;
  padding-inline: 16px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
}

.app-drawer__hero {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 22px 20px;
  border-radius: 22px;
  backdrop-filter: blur(18px);
  background: linear-gradient(135deg,
      color-mix(in srgb, var(--v-theme-primary) 16%, transparent) 0%,
      color-mix(in srgb, var(--v-theme-primary) 46%, #0b0b0f 34%) 100%);
  border: 1px solid color-mix(in srgb, var(--v-theme-primary) 25%, transparent);
  box-shadow:
    0 18px 32px rgba(15, 23, 42, 0.28),
    inset 0 1px 0 color-mix(in srgb, #ffffff 40%, transparent);
}

.app-drawer__divider {
  opacity: 0.15;
  margin-inline: 12px;
}

.app-drawer__list {
  background: color-mix(in srgb, var(--v-theme-surface) 82%, transparent);
  border-radius: 18px;
  padding: 4px;
  box-shadow: inset 0 1px 0 color-mix(in srgb, #ffffff 12%, transparent);
}

.app-drawer__hero::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: radial-gradient(circle at 18% 12%,
      color-mix(in srgb, var(--v-theme-primary) 60%, transparent) 0%,
      transparent 55%);
  opacity: 0.6;
  pointer-events: none;
}

.app-drawer__hero-icon {
  z-index: 1;
}

.app-drawer__label {
  letter-spacing: 0.08em;
  font-weight: 600;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--v-theme-on-surface) 65%, transparent);
}

.app-drawer__hero-body {
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.app-drawer__hero-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.app-drawer__name {
  font-size: 1.15rem;
  letter-spacing: 0.02em;
  color: color-mix(in srgb, var(--v-theme-on-surface) 94%, #ffffff 6%);
}

.app-drawer__chip {
  font-weight: 600;
  text-transform: none;
  background-color: color-mix(in srgb, var(--v-theme-primary) 82%, #ffffff 18%) !important;
  color: color-mix(in srgb, var(--v-theme-on-primary) 94%, #ffffff 6%) !important;
  box-shadow: 0 4px 10px rgba(12, 74, 110, 0.35);
}

.app-drawer__chip :deep(.v-chip__content) {
  padding-inline: 10px;
}

.app-drawer__tagline {
  margin: 0;
  line-height: 1.4;
  color: color-mix(in srgb, var(--v-theme-on-surface) 70%, transparent);
  max-width: 180px;
}

.app-drawer__list-item {
  font-weight: 500;
  text-transform: none;
  transition: background-color 0.24s ease, transform 0.24s ease;
  border-radius: 14px;
}

.app-drawer :deep(.v-list-item__prepend .v-icon) {
  opacity: 0.92;
}

.app-drawer :deep(.v-list-item--active) {
  background-color: color-mix(in srgb, var(--v-theme-primary) 28%, transparent);
  color: color-mix(in srgb, var(--v-theme-primary) 88%, #ffffff 12%);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--v-theme-primary) 60%, transparent);
}

.app-drawer__list-item:hover {
  transform: translateX(4px);
  background-color: color-mix(in srgb, var(--v-theme-primary) 18%, transparent);
  color: color-mix(in srgb, var(--v-theme-primary) 80%, #ffffff 20%);
}

.spiffs-viewer__content {
  max-height: 60vh;
  overflow: auto;
  padding: 12px;
  border-radius: 10px;
  background-color: color-mix(in srgb, var(--v-theme-surface-variant) 80%, transparent);
  font-family: 'Roboto Mono', 'Fira Code', 'Source Code Pro', monospace;
  font-size: 0.9rem;
  white-space: pre-wrap;
  word-break: break-word;
}

.spiffs-viewer__image {
  max-width: 100%;
  max-height: 60vh;
  display: block;
  margin: 0 auto;
  border-radius: 8px;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
}
</style>

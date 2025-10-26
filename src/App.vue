<template>
  <v-app>
    <v-main>
      <v-container class="py-10" max-width="720">
        <v-card elevation="8" class="pa-6">
          <v-card-title class="d-flex flex-column align-start pa-0 mb-4">
            <div class="d-flex align-center w-100">
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
              <v-chip
                :color="connected ? 'success' : 'grey'"
                :prepend-icon="connected ? 'mdi-usb-port' : 'mdi-usb-off'"
                class="text-capitalize ms-2"
                variant="flat"
              >
                {{ connected ? 'Connected' : 'Disconnected' }}
              </v-chip>
            </div>
            <div class="text-body-2 text-medium-emphasis mt-2">
              {{ statusLabel }}
            </div>
          </v-card-title>

          <v-alert
            v-if="!serialSupported"
            type="error"
            class="mb-4"
            variant="tonal"
            icon="mdi-alert-circle-outline"
          >
            This browser does not support the Web Serial API. Use Chrome, Edge, or another Chromium-based browser.
          </v-alert>

          <v-row align="center" class="mb-4" dense>
            <v-col cols="12" md="4">
              <v-btn
                color="primary"
                block
                size="large"
                :disabled="!serialSupported || connected || busy"
                @click="connect"
              >
                <v-icon start>mdi-usb-flash-drive</v-icon>
                Connect
              </v-btn>
            </v-col>
            <v-col cols="12" md="4">
              <v-btn
                color="secondary"
                block
                size="large"
                variant="tonal"
                :disabled="!connected || busy"
                @click="disconnect"
              >
                <v-icon start>mdi-close-circle</v-icon>
                Disconnect
              </v-btn>
            </v-col>
            <v-col cols="12" md="4">
              <v-select
                v-model="selectedBaud"
                :items="baudrateOptions"
                label="Target baud rate"
                density="comfortable"
                :disabled="busy"
              />
            </v-col>
          </v-row>

          <v-divider class="my-4" />

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
                      <v-chip
                        v-if="!chipDetails.features?.length"
                        size="small"
                        variant="outlined"
                      >
                        Not reported
                      </v-chip>
                    </v-chip-group>
                  </v-col>
                  <v-col v-if="chipDetails.facts?.length" cols="12">
                    <div class="text-subtitle-2 text-medium-emphasis mb-2">Extra Details</div>
                    <v-list density="compact" class="bg-transparent pa-0">
                      <v-list-item
                        v-for="fact in chipDetails.facts"
                        :key="fact.label"
                        :title="fact.label"
                        :subtitle="fact.value"
                      />
                    </v-list>
                  </v-col>
                </v-row>
              </v-card-text>
            </v-card>
          </v-expand-transition>

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
    return `${map[flashCap]}${flashVendor ? ` (${flashVendor})` : ''}`;
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
    return `${map[psramCap]}${psramVendor ? ` (${psramVendor})` : ''}`;
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
    transport.value = new Transport(currentPort.value);
    loader.value = new ESPLoader({
      transport: transport.value,
      baudrate,
      romBaudrate: DEFAULT_ROM_BAUD,
      terminal,
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

    const packageLabel = resolvePackageLabel(chipKey, packageVersion, chipRevision);
    if (packageLabel) {
      facts.push({ label: 'Package', value: packageLabel });
    }

    const revisionLabel = resolveRevisionLabel(chipKey, chipRevision, majorVersion, minorVersion);
    if (revisionLabel) {
      facts.push({ label: 'Revision', value: revisionLabel });
    }

    const embeddedFlash = resolveEmbeddedFlash(chipKey, flashCap, flashVendor, featureList);
    if (embeddedFlash) {
      facts.push({ label: 'Embedded Flash', value: embeddedFlash });
    }

    const embeddedPsram = resolveEmbeddedPsram(chipKey, psramCap, psramVendor, featureList);
    if (embeddedPsram) {
      facts.push({ label: 'Embedded PSRAM', value: embeddedPsram });
    }

    if (flashVendor && !embeddedFlash) {
      facts.push({ label: 'Flash Vendor (eFuse)', value: flashVendor });
    }
    if (psramVendor && !embeddedPsram) {
      facts.push({ label: 'PSRAM Vendor (eFuse)', value: psramVendor });
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

      facts.push({
        label: 'Flash ID',
        value: `0x${flashId.toString(16).padStart(6, '0').toUpperCase()}`,
      });
      facts.push({
        label: 'Flash Manufacturer',
        value: manufacturerName ? `${manufacturerName} (${manufacturerHex})` : manufacturerHex,
      });
      if (deviceName || formattedCapacity) {
        const detail = formattedCapacity
          ? `${formattedCapacity}${deviceName ? ` — ${deviceName}` : ''}`
          : deviceName;
        facts.push({
          label: 'Flash Device',
          value: detail || deviceHex,
        });
      } else {
        facts.push({
          label: 'Flash Device',
          value: deviceHex,
        });
      }
    }

    chipDetails.value = {
      name: chipName,
      description: descriptionRaw || chipName,
      features: featureList.filter(Boolean),
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
</style>

<template>
  <v-app>
    <v-navigation-drawer permanent app elevation="1">
      <v-list>
        <v-list-item prepend-icon="mdi-usb" :title="$t('app.title')" :subtitle="'v' + APP_VERSION">
        </v-list-item>
      </v-list>
      <v-list nav density="comfortable">
        <v-list-subheader class="app-drawer__label text-overline text-medium-emphasis">
          {{ $t('drawer.sections') }}
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
          {{ $t('drawer.resources') }}
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
          {{ $t('buttons.connect') }}
        </v-btn>
        <v-btn color="error" variant="outlined" density="comfortable" :disabled="!connected || busy"
          @click="disconnect">
          <v-icon start>mdi-close-circle</v-icon>
          {{ $t('buttons.disconnect') }}
        </v-btn>
        <v-select v-model="selectedBaud" :items="baudrateOptions" :label="$t('labels.baudRate')" density="compact"
          variant="outlined" hide-details class="status-select"
          :disabled="busy || flashInProgress || maintenanceBusy || baudChangeBusy || monitorActive" />
        <span v-if="higherBaudrateAvailable">

          <v-tooltip :text="$t('tooltips.higherBaud')" location="bottom">
            <template v-slot:activator="{ props }">
              <v-btn class="text-none" stacked v-bind="props">
                <v-badge bordered color="success" dot>
                  <v-icon>mdi-bell-outline</v-icon>
                </v-badge>
              </v-btn>
            </template>
          </v-tooltip>
        </span>
      </div>
      <v-spacer />
      <v-select v-model="selectedLocale" :items="languageOptions" item-title="title" item-value="value"
        density="compact" variant="outlined" hide-details class="status-select locale-select"
        style="max-width: 140px" />
      <v-btn :title="themeSwitchTitle" variant="text" icon size="small" @click="toggleTheme">
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
            {{ $t('warnings.noSerial') }}
          </v-alert>
          <v-alert v-else-if="showSerialMonitorReconnectNotice" type="info" class="mb-4" variant="tonal"
            icon="mdi-console-line">
            {{ $t('info.serialMonitorClosed') }}
          </v-alert>
          <v-window v-model="activeTab" class="app-tab-content">
            <v-window-item value="info">
              <DeviceInfoTab :chip-details="chipDetails" />
            </v-window-item>

            <v-window-item value="partitions">
              <PartitionsTab :partition-segments="partitionSegments" :formatted-partitions="formattedPartitions"
                :unused-summary="unusedFlashSummary" :flash-size-label="partitionFlashSizeLabel" />
            </v-window-item>

            <v-window-item value="spiffs">
              <FilesystemManagerTab v-if="connected" :partitions="spiffsPartitions"
                :selected-partition-id="spiffsState.selectedId" :files="spiffsState.files" :status="spiffsState.status"
                :loading="spiffsState.loading" :busy="spiffsState.busy" :saving="spiffsState.saving"
                :read-only="spiffsState.readOnly" :read-only-reason="spiffsState.readOnlyReason"
                :dirty="spiffsState.dirty" :backup-done="spiffsState.backupDone || spiffsState.sessionBackupDone"
                :error="spiffsState.error" :has-partition="hasSpiffsPartitionSelected"
                :has-client="Boolean(spiffsState.client)" :usage="spiffsState.usage"
                :upload-blocked="spiffsState.uploadBlocked" :upload-blocked-reason="spiffsState.uploadBlockedReason"
                :is-file-viewable="isViewableSpiffsFile" :load-cancelled="spiffsState.loadCancelled"
                :get-file-preview-info="resolveSpiffsViewInfo" @select-partition="handleSelectSpiffsPartition"
                @refresh="handleRefreshSpiffs" @backup="handleSpiffsBackup" @restore="handleSpiffsRestore"
                @download-file="handleSpiffsDownloadFile" @view-file="handleSpiffsView"
                @validate-upload="handleSpiffsUploadSelection" @upload-file="handleSpiffsUpload"
                @delete-file="handleSpiffsDelete" @format="handleSpiffsFormat" @save="handleSpiffsSave" />
              <DisconnectedState v-else icon="mdi-folder-key-outline" :min-height="420"
                :subtitle="$t('disconnected.spiffs')" />
            </v-window-item>

            <v-window-item value="littlefs">
              <LittlefsManagerTab v-if="connected && littleFsAvailable" :partitions="littleFsPartitions"
                :selected-partition-id="littlefsState.selectedId" :files="littlefsVisibleFiles"
                :current-path="littlefsState.currentPath" :status="littlefsState.status"
                :loading="littlefsState.loading" :busy="littlefsState.busy" :saving="littlefsState.saving"
                :read-only="littlefsState.readOnly" :read-only-reason="littlefsState.readOnlyReason"
                :dirty="littlefsState.dirty" :backup-done="littlefsState.backupDone || littlefsState.sessionBackupDone"
                :error="littlefsState.error" :has-partition="hasLittlefsPartitionSelected"
                :has-client="Boolean(littlefsState.client)" :usage="littlefsState.usage"
                :disk-version="littlefsState.diskVersion" :format-disk-version="littlefsFormatDiskVersion"
                :upload-blocked="littlefsState.uploadBlocked" :upload-blocked-reason="littlefsState.uploadBlockedReason"
                :fs-label="$t('filesystem.labels.littlefs')" :load-cancelled="littlefsState.loadCancelled"
                :partition-title="$t('filesystem.partitionHeading', { fs: $t('filesystem.labels.littlefs') })"
                :empty-state-message="$t('filesystem.noFilesDetected', { fs: $t('filesystem.labels.littlefs') })"
                :is-file-viewable="isViewableSpiffsFile" :get-file-preview-info="resolveSpiffsViewInfo"
                @select-partition="handleSelectLittlefsPartition" @refresh="handleRefreshLittlefs"
                @backup="handleLittlefsBackup" @restore="handleLittlefsRestore"
                @download-file="handleLittlefsDownloadFile" @view-file="handleLittlefsView"
                @validate-upload="handleLittlefsUploadSelection" @upload-file="handleLittlefsUpload"
                @delete-file="handleLittlefsDelete" @format="handleLittlefsFormat" @save="handleLittlefsSave"
                @navigate="handleLittlefsNavigate" @navigate-up="handleLittlefsNavigateUp"
                @new-folder="handleLittlefsNewFolder" @reset-upload-block="handleLittlefsResetUploadBlock" />
              <DisconnectedState v-else icon="mdi-alpha-l-circle-outline" :min-height="420"
                :subtitle="$t('disconnected.littlefs')" />
            </v-window-item>

            <v-window-item value="fatfs">
              <FilesystemManagerTab v-if="connected && fatfsAvailable" :partitions="fatfsPartitions"
                :selected-partition-id="fatfsState.selectedId" :files="fatfsState.files" :status="fatfsState.status"
                :loading="fatfsState.loading" :busy="fatfsState.busy" :saving="fatfsState.saving"
                :read-only="fatfsState.readOnly" :read-only-reason="fatfsState.readOnlyReason" :dirty="fatfsState.dirty"
                :backup-done="fatfsState.backupDone || fatfsState.sessionBackupDone" :error="fatfsState.error"
                :has-partition="hasFatfsPartitionSelected" :has-client="Boolean(fatfsState.client)"
                :usage="fatfsState.usage" :upload-blocked="fatfsState.uploadBlocked"
                :upload-blocked-reason="fatfsState.uploadBlockedReason" :load-cancelled="fatfsState.loadCancelled"
                :fs-label="$t('filesystem.labels.fatfs')"
                :partition-title="$t('filesystem.partitionHeading', { fs: $t('filesystem.labels.fatfs') })"
                :empty-state-message="$t('filesystem.noFilesDetected', { fs: $t('filesystem.labels.fatfs') })"
                :is-file-viewable="isViewableSpiffsFile" :get-file-preview-info="resolveSpiffsViewInfo"
                @select-partition="handleSelectFatfsPartition" @refresh="handleRefreshFatfs" @backup="handleFatfsBackup"
                @restore="handleFatfsRestore" @download-file="handleFatfsDownloadFile" @view-file="handleFatfsView"
                @validate-upload="handleFatfsUploadSelection" @upload-file="handleFatfsUpload"
                @delete-file="handleFatfsDelete" @format="handleFatfsFormat" @save="handleFatfsSave" />
              <DisconnectedState v-else icon="mdi-alpha-f-circle-outline" :min-height="420"
                :subtitle="$t('disconnected.fatfs')" />
            </v-window-item>

            <v-window-item value="apps">
              <AppsTab v-if="connected" :apps="appPartitions" :active-slot-id="activeAppSlotId"
                :active-summary="appActiveSummary" :loading="appMetadataLoading" :error="appMetadataError" />
              <DisconnectedState v-else icon="mdi-application-cog-outline" :min-height="420"
                :subtitle="$t('disconnected.apps')" />
            </v-window-item>

            <v-window-item value="flash">
              <FlashFirmwareTab v-if="connected" v-model:flash-offset="flashOffset"
                v-model:selected-preset="selectedPreset" v-model:erase-flash="eraseFlash"
                :offset-presets="offsetPresets" :busy="busy" :can-flash="canFlash" :flash-in-progress="flashInProgress"
                :flash-progress="flashProgress" :flash-progress-dialog="flashProgressDialog"
                :maintenance-busy="maintenanceBusy" :register-address="registerAddress" :register-value="registerValue"
                :register-read-result="registerReadResult" :register-status="registerStatus"
                :register-status-type="registerStatusType" :register-options="registerOptions"
                :register-reference="registerReference" :md5-offset="md5Offset" :md5-length="md5Length"
                :md5-result="md5Result" :md5-status="md5Status" :md5-status-type="md5StatusType"
                :flash-read-offset="flashReadOffset" :flash-read-length="flashReadLength"
                :flash-read-status="flashReadStatus" :flash-read-status-type="flashReadStatusType"
                :partition-options="partitionDownloadOptions" :selected-partition="selectedPartitionDownload"
                :integrity-partition="integrityPartition" :download-progress="downloadProgress"
                @firmware-input="handleFirmwareInput" @flash="flashFirmware" @apply-preset="applyOffsetPreset"
                @update:register-address="value => (registerAddress = value)"
                @update:register-value="value => (registerValue = value)" @read-register="handleReadRegister"
                @write-register="handleWriteRegister" @update:md5-offset="value => (md5Offset = value)"
                @update:md5-length="value => (md5Length = value)" @compute-md5="handleComputeMd5"
                @update:flash-read-offset="value => (flashReadOffset = value)"
                @update:flash-read-length="value => (flashReadLength = value)"
                @update:selected-partition="handleSelectPartition"
                @update:integrity-partition="handleSelectIntegrityPartition" @download-flash="handleDownloadFlash"
                @download-partition="handleDownloadPartition" @download-all-partitions="handleDownloadAllPartitions"
                @download-used-flash="handleDownloadUsedFlash" @cancel-flash="handleCancelFlash"
                @erase-flash="handleEraseFlash" @cancel-download="handleCancelDownload"
                @select-register="handleSelectRegister" />
              <DisconnectedState v-else icon="mdi-chip" :min-height="420" :subtitle="$t('disconnected.flash')" />
            </v-window-item>
            <v-window-item value="console">
              <SerialMonitorTab :monitor-text="monitorText" :monitor-active="monitorActive"
                :monitor-error="monitorError" :can-start="canStartMonitor" :can-command="canIssueMonitorCommands"
                @start-monitor="startMonitor" @stop-monitor="stopMonitor({ closeConnection: true })"
                @clear-monitor="clearMonitorOutput" @reset-board="resetBoard" />
            </v-window-item>

            <v-window-item value="log">
              <SessionLogTab ref="sessionLogRef" :log-text="logText" @clear-log="clearLog" />
            </v-window-item>

            <v-window-item value="about">
              <AboutTab />
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
              {{ confirmationDialog.title || $t('dialogs.confirm.title') }}
            </v-card-title>
            <v-card-text class="text-body-2">
              <div class="confirmation-message">
                {{ confirmationDialog.message }}
              </div>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn variant="text" @click="resolveConfirmation(false)">
                {{ confirmationDialog.cancelText || $t('buttons.cancel') }}
              </v-btn>
              <v-btn :color="confirmationDialog.destructive ? 'error' : 'primary'" variant="tonal"
                @click="resolveConfirmation(true)">
                {{ confirmationDialog.confirmText || $t('buttons.continue') }}
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <v-dialog :model-value="connectDialog.visible" persistent max-width="420" class="progress-dialog">
          <v-card>
            <v-card-title class="text-h6">
              <v-icon start color="primary">mdi-usb</v-icon>
              {{ $t('dialogs.connect.title') }}
            </v-card-title>
            <v-card-text class="progress-dialog__body">
              <div class="progress-dialog__label">
                {{ connectDialog.label }}
              </div>
              <div class="text-body-2 text-medium-emphasis" v-if="connectDialog.message">
                {{ connectDialog.message }}
              </div>
              <v-progress-linear class="mt-4" indeterminate height="6" color="primary" rounded />
            </v-card-text>
          </v-card>
        </v-dialog>

        <v-dialog :model-value="littlefsBackupDialog.visible" persistent max-width="420" class="progress-dialog">
          <v-card>
            <v-card-title class="text-h6">
              <v-icon start color="primary">mdi-content-save</v-icon>
              {{ $t('dialogs.fs.backupTitle', { fs: 'LittleFS' }) }}
            </v-card-title>
            <v-card-text class="progress-dialog__body">
              <div class="progress-dialog__label">
                {{ littlefsBackupDialog.label || $t('dialogs.fs.backupPreparing') }}
              </div>
              <v-progress-linear :model-value="littlefsBackupDialog.value" height="24" color="primary" rounded>
                <strong>{{ Math.min(100, Math.max(0, Math.floor(littlefsBackupDialog.value))) }}%</strong>
              </v-progress-linear>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn variant="text" @click="cancelLittlefsBackup">
                {{ $t('buttons.cancel') }}
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <v-dialog :model-value="littlefsLoadingDialog.visible" persistent max-width="420" class="progress-dialog">
          <v-card>
            <v-card-title class="text-h6">
              <v-icon start color="primary">mdi-folder-sync</v-icon>
              {{ $t('dialogs.fs.loadingTitle', { fs: 'LittleFS' }) }}
            </v-card-title>
            <v-card-text class="progress-dialog__body">
              <div class="progress-dialog__label">
                {{ littlefsLoadingDialog.label }}
              </div>
              <v-progress-linear :model-value="littlefsLoadingDialog.value"
                :indeterminate="littlefsLoadingDialog.value <= 0" height="24" color="primary" rounded />
            </v-card-text>
            <v-card-actions class="progress-dialog__actions">
              <v-spacer />
              <v-btn variant="text" :disabled="littlefsLoadCancelRequested" @click="cancelLittlefsLoad">
                {{ $t('buttons.cancel') }}
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <v-dialog :model-value="littlefsSaveDialog.visible" persistent max-width="420" class="progress-dialog">
          <v-card>
            <v-card-title class="text-h6">
              <v-icon start color="primary">mdi-floppy</v-icon>
              {{ $t('dialogs.fs.savingTitle', { fs: 'LittleFS' }) }}
            </v-card-title>
            <v-card-text class="progress-dialog__body">
              <div class="progress-dialog__label">
                {{ littlefsSaveDialog.label || $t('dialogs.fs.writingImage', { fs: 'LittleFS' }) }}
              </div>
              <v-progress-linear :model-value="littlefsSaveDialog.value" height="24" color="primary" rounded>
                <strong>{{ Math.min(100, Math.max(0, Math.floor(littlefsSaveDialog.value))) }}%</strong>
              </v-progress-linear>
            </v-card-text>
          </v-card>
        </v-dialog>

        <v-dialog :model-value="littlefsRestoreDialog.visible" persistent max-width="420" class="progress-dialog">
          <v-card>
            <v-card-title class="text-h6">
              <v-icon start color="primary">mdi-backup-restore</v-icon>
              {{ $t('dialogs.fs.restoringTitle', { fs: 'LittleFS' }) }}
            </v-card-title>
            <v-card-text class="progress-dialog__body">
              <div class="progress-dialog__label">
                {{ littlefsRestoreDialog.label || $t('dialogs.fs.writingImage', { fs: 'LittleFS' }) }}
              </div>
              <v-progress-linear :model-value="littlefsRestoreDialog.value" height="24" color="primary" rounded>
                <strong>{{ Math.min(100, Math.max(0, Math.floor(littlefsRestoreDialog.value))) }}%</strong>
              </v-progress-linear>
            </v-card-text>
          </v-card>
        </v-dialog>

        <v-dialog :model-value="fatfsBackupDialog.visible" persistent max-width="420" class="progress-dialog">
          <v-card>
            <v-card-title class="text-h6">
              <v-icon start color="primary">mdi-content-save</v-icon>
              {{ $t('dialogs.fs.backupTitle', { fs: 'FATFS' }) }}
            </v-card-title>
            <v-card-text class="progress-dialog__body">
              <div class="progress-dialog__label">
                {{ fatfsBackupDialog.label || $t('dialogs.fs.backupPreparing') }}
              </div>
              <v-progress-linear :model-value="fatfsBackupDialog.value" height="24" color="primary" rounded>
                <strong>{{ Math.min(100, Math.max(0, Math.floor(fatfsBackupDialog.value))) }}%</strong>
              </v-progress-linear>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn variant="text" @click="cancelFatfsBackup">
                {{ $t('buttons.cancel') }}
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <v-dialog :model-value="fatfsLoadingDialog.visible" persistent max-width="420" class="progress-dialog">
          <v-card>
            <v-card-title class="text-h6">
              <v-icon start color="primary">mdi-folder-sync</v-icon>
              {{ $t('dialogs.fs.loadingTitle', { fs: 'FATFS' }) }}
            </v-card-title>
            <v-card-text class="progress-dialog__body">
              <div class="progress-dialog__label">
                {{ fatfsLoadingDialog.label }}
              </div>
              <v-progress-linear :model-value="fatfsLoadingDialog.value" :indeterminate="fatfsLoadingDialog.value <= 0"
                height="24" color="primary" rounded />
            </v-card-text>
            <v-card-actions class="progress-dialog__actions">
              <v-spacer />
              <v-btn variant="text" :disabled="fatfsLoadCancelRequested" @click="cancelFatfsLoad">
                {{ $t('buttons.cancel') }}
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <v-dialog :model-value="fatfsSaveDialog.visible" persistent max-width="420" class="progress-dialog">
          <v-card>
            <v-card-title class="text-h6">
              <v-icon start color="primary">mdi-floppy</v-icon>
              {{ $t('dialogs.fs.savingTitle', { fs: 'FATFS' }) }}
            </v-card-title>
            <v-card-text class="progress-dialog__body">
              <div class="progress-dialog__label">
                {{ fatfsSaveDialog.label || $t('dialogs.fs.writingImage', { fs: 'FATFS' }) }}
              </div>
              <v-progress-linear :model-value="fatfsSaveDialog.value" height="24" color="primary" rounded>
                <strong>{{ Math.min(100, Math.max(0, Math.floor(fatfsSaveDialog.value))) }}%</strong>
              </v-progress-linear>
            </v-card-text>
          </v-card>
        </v-dialog>

        <v-dialog :model-value="fatfsRestoreDialog.visible" persistent max-width="420" class="progress-dialog">
          <v-card>
            <v-card-title class="text-h6">
              <v-icon start color="primary">mdi-backup-restore</v-icon>
              {{ $t('dialogs.fs.restoringTitle', { fs: 'FATFS' }) }}
            </v-card-title>
            <v-card-text class="progress-dialog__body">
              <div class="progress-dialog__label">
                {{ fatfsRestoreDialog.label || $t('dialogs.fs.writingImage', { fs: 'FATFS' }) }}
              </div>
              <v-progress-linear :model-value="fatfsRestoreDialog.value" height="24" color="primary" rounded>
                <strong>{{ Math.min(100, Math.max(0, Math.floor(fatfsRestoreDialog.value))) }}%</strong>
              </v-progress-linear>
            </v-card-text>
          </v-card>
        </v-dialog>

        <v-dialog :model-value="spiffsBackupDialog.visible" persistent max-width="420" class="progress-dialog">
          <v-card>
            <v-card-title class="text-h6">
              <v-icon start color="primary">mdi-content-save</v-icon>
              {{ $t('dialogs.fs.backupTitle', { fs: 'SPIFFS' }) }}
            </v-card-title>
            <v-card-text class="progress-dialog__body">
              <div class="progress-dialog__label">
                {{ spiffsBackupDialog.label || $t('dialogs.fs.backupPreparing') }}
              </div>
              <v-progress-linear :model-value="spiffsBackupDialog.value" height="24" color="primary" rounded>
                <strong>{{ Math.min(100, Math.max(0, Math.floor(spiffsBackupDialog.value))) }}%</strong>
              </v-progress-linear>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn variant="text" @click="cancelSpiffsBackup">
                {{ $t('buttons.cancel') }}
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <v-dialog :model-value="spiffsLoadingDialog.visible" persistent max-width="420" class="progress-dialog">
          <v-card>
            <v-card-title class="text-h6">
              <v-icon start color="primary">mdi-folder-sync</v-icon>
              {{ $t('dialogs.fs.loadingTitle', { fs: 'SPIFFS' }) }}
            </v-card-title>
            <v-card-text class="progress-dialog__body">
              <div class="progress-dialog__label">
                {{ spiffsLoadingDialog.label }}
              </div>
              <v-progress-linear :model-value="spiffsLoadingDialog.value"
                :indeterminate="spiffsLoadingDialog.value <= 0" height="24" color="primary" rounded />
            </v-card-text>
            <v-card-actions class="progress-dialog__actions">
              <v-spacer />
              <v-btn variant="text" :disabled="spiffsLoadCancelRequested" @click="cancelSpiffsLoad">
                {{ $t('buttons.cancel') }}
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <v-dialog :model-value="spiffsSaveDialog.visible" persistent max-width="420" class="progress-dialog">
          <v-card>
            <v-card-title class="text-h6">
              <v-icon start color="primary">mdi-floppy</v-icon>
              {{ $t('dialogs.fs.savingTitle', { fs: 'SPIFFS' }) }}
            </v-card-title>
            <v-card-text class="progress-dialog__body">
              <div class="progress-dialog__label">
                {{ spiffsSaveDialog.label || $t('dialogs.fs.writingImage', { fs: 'SPIFFS' }) }}
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
              {{ $t('dialogs.fs.restoringTitle', { fs: 'SPIFFS' }) }}
            </v-card-title>
            <v-card-text class="progress-dialog__body">
              <div class="progress-dialog__label">
                {{ spiffsRestoreDialog.label || $t('dialogs.fs.writingImage', { fs: 'SPIFFS' }) }}
              </div>
              <v-progress-linear :model-value="spiffsRestoreDialog.value" height="24" color="primary" rounded>
                <strong>{{ Math.min(100, Math.max(0, Math.floor(spiffsRestoreDialog.value))) }}%</strong>
              </v-progress-linear>
            </v-card-text>
          </v-card>
        </v-dialog>

        <v-dialog v-model="showBusyDialog" width="420">
          <v-card>
            <v-card-title class="text-h6">
              <v-icon start color="warning">mdi-lock-alert</v-icon>
              {{ $t('dialogs.portBusy.title') }}
            </v-card-title>
            <v-card-text>
              <p class="text-body-2">
                {{ busyDialogMessage || $t('dialogs.portBusy.message') }}
              </p>
              <p class="text-caption text-medium-emphasis">
                {{ $t('dialogs.portBusy.hint') }}
              </p>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn color="primary" variant="text" @click="showBusyDialog = false">
                {{ $t('dialogs.portBusy.ok') }}
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <v-dialog v-model="showGeneralErrorDialog" width="420">
          <v-card>
            <v-card-title class="text-h6">
              <v-icon start color="error">mdi-alert-circle-outline</v-icon>
              {{ $t('dialogs.generalError.title') }}
            </v-card-title>
            <v-card-text>
              <p class="text-body-2">
                {{ $t('dialogs.generalError.message') }}
              </p>
              <p class="text-caption text-medium-emphasis" v-if="lastErrorMessage">
                {{ $t('dialogs.generalError.lastError', { error: lastErrorMessage }) }}
              </p>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn color="primary" variant="text" @click="showGeneralErrorDialog = false">
                {{ $t('buttons.gotIt') }}
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <v-dialog v-model="showBootDialog" width="420">
          <v-card>
            <v-card-title class="text-h6">
              <v-icon start color="warning">mdi-alert-circle-outline</v-icon>
              {{ $t('dialogs.boot.title') }}
            </v-card-title>
            <v-card-subtitle>
              {{ $t('dialogs.boot.lastError', { error: lastErrorMessage }) }}
            </v-card-subtitle>
            <v-card-text>
              <p class="text-body-2">
                {{ $t('dialogs.boot.description') }}
              </p>
              <ol class="text-body-2 ps-4">
                <li>{{ $t('dialogs.boot.steps.step1') }}</li>
                <li>{{ $t('dialogs.boot.steps.step2') }}</li>
                <li>{{ $t('dialogs.boot.steps.step3') }}</li>
                <li>{{ $t('dialogs.boot.steps.step4') }}</li>
              </ol>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn color="primary" variant="text" @click="showBootDialog = false">
                {{ $t('buttons.gotIt') }}
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <v-dialog :model-value="spiffsViewerDialog.visible" max-width="900" scrollable
          @update:model-value="value => { if (!value) closeSpiffsViewer(); }">
          <v-card>
            <v-card-title class="text-h6 d-flex align-center">
              <v-icon start>mdi-eye</v-icon>
              {{ spiffsViewerDialog.name || $t('viewer.preview') }}
            </v-card-title>
            <v-card-text>
              <v-progress-linear v-if="spiffsViewerDialog.loading" indeterminate color="primary" class="mb-4" />
              <v-alert v-else-if="spiffsViewerDialog.error" type="error" variant="tonal" border="start" class="mb-4">
                {{ spiffsViewerDialog.error }}
              </v-alert>
              <template v-else>
                <img v-if="spiffsViewerDialog.mode === 'image' && spiffsViewerDialog.imageUrl"
                  :src="spiffsViewerDialog.imageUrl" class="spiffs-viewer__image" :alt="spiffsViewerDialog.name" />
                <audio v-else-if="spiffsViewerDialog.mode === 'audio' && spiffsViewerDialog.audioUrl"
                  :src="spiffsViewerDialog.audioUrl" class="spiffs-viewer__audio" controls preload="auto">
                  {{ $t('viewer.audioUnsupported') }}
                </audio>
                <pre v-else class="spiffs-viewer__content">{{ spiffsViewerDialog.content }}</pre>
              </template>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn variant="text" @click="closeSpiffsViewer">
                {{ $t('buttons.close') }}
              </v-btn>
              <v-btn color="primary" variant="tonal" :disabled="!spiffsViewerDialog.name"
                @click="handleFilesystemViewerDownload">
                <v-icon start>mdi-download</v-icon>
                {{ $t('buttons.download') }}
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <v-snackbar v-model="toast.visible" :timeout="toast.timeout" :color="toast.color" location="bottom right">
          {{ toast.message }}
        </v-snackbar>
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useTheme } from 'vuetify';
import DeviceInfoTab from './components/DeviceInfoTab.vue';
import FlashFirmwareTab from './components/FlashFirmwareTab.vue';
import AppsTab from './components/AppsTab.vue';
import FilesystemManagerTab from './components/FilesystemManagerTab.vue';
import LittlefsManagerTab from './components/LittlefsManagerTab.vue';
import AboutTab from './components/AboutTab.vue';
import PartitionsTab from './components/PartitionsTab.vue';
import SessionLogTab from './components/SessionLogTab.vue';
import SerialMonitorTab from './components/SerialMonitorTab.vue';
import DisconnectedState from './components/DisconnectedState.vue';
import registerGuides from './data/register-guides.json';
import { InMemorySpiffsClient } from './utils/spiffs/spiffsClient';
import { useFatfsManager, useLittlefsManager, useSpiffsManager } from './composables/useFilesystemManagers';
import { useDialogs } from './composables/useDialogs';
import { readPartitionTable } from './utils/partitions';
import { createEsptoolClient, requestSerialPort, type CompatibleLoader, type CompatibleTransport } from './services/esptoolClient';
import {
  SPIFFS_AUDIO_EXTENSIONS,
  SPIFFS_AUDIO_MIME_MAP,
  SPIFFS_IMAGE_EXTENSIONS,
  SPIFFS_IMAGE_MIME_MAP,
  SPIFFS_MAX_FILENAME_LENGTH,
  SPIFFS_TEXT_EXTENSIONS,
  SPIFFS_VIEWER_DECODER,
  SPIFFS_VIEWER_MAX_BYTES,
  LITTLEFS_DEFAULT_BLOCK_SIZE,
  LITTLEFS_BLOCK_SIZE_CANDIDATES,
  FATFS_DEFAULT_BLOCK_SIZE,
} from './constants/filesystems';
import {
  APP_DESCRIPTOR_LENGTH,
  APP_DESCRIPTOR_MAGIC,
  APP_IMAGE_HEADER_MAGIC,
  APP_SCAN_LENGTH,
  APP_VERSION,
  OTA_SELECT_ENTRY_SIZE,
  asciiDecoder,
} from './constants/app';
import { PACKAGE_LABELS, ECO_LABELS, EMBEDDED_FLASH_CAPACITY, EMBEDDED_PSRAM_CAPACITY, PACKAGE_FORM_FACTORS } from './constants/chipLabels';
import { JEDEC_FLASH_PARTS, JEDEC_MANUFACTURERS, VENDOR_ALIASES, JEDEC_CAPACITY_CODES } from './constants/flashIds';
import {
  getUsbDeviceInfo, DEFAULT_FLASH_BAUD,
  DEFAULT_ROM_BAUD,
  MONITOR_BAUD,
  MAX_SUPPORTED_BAUDRATE,
  SUPPORTED_BAUDRATES,
  TIMEOUT_CONNECT,
} from './constants/usb';
import { FACT_GROUP_CONFIG, FACT_ICONS } from './constants/deviceFacts';
import { findChipDocs } from './constants/chipDocsLinks';
import { PWM_TABLE } from './utils/pwm-capabilities-table';

const PWM_NOTE_KEYS = {
  ESP32: 'facts.pwmNotes.esp32',
  'ESP32-S2': 'facts.pwmNotes.esp32s2',
  'ESP32-S3': 'facts.pwmNotes.esp32s3',
  'ESP32-C2': 'facts.pwmNotes.esp32c2',
  'ESP32-C3': 'facts.pwmNotes.esp32c3',
  'ESP32-C6': 'facts.pwmNotes.esp32c6',
  'ESP32-H2': 'facts.pwmNotes.esp32h2',
  'ESP32-P4': 'facts.pwmNotes.esp32p4',
  ESP8266: 'facts.pwmNotes.esp8266',
};

const { t, locale } = useI18n();
const languageOptions = [
  { title: 'English', value: 'en' },
  { title: '中文', value: 'zh-CN' },
];
const selectedLocale = ref(locale.value as string);
watch(selectedLocale, (val) => {
  locale.value = val as any;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('esp32-locale', String(val));
  }
});

let littlefsModulePromise = null;
let fatfsModulePromise = null;
const littlefsFormatDiskVersion = ref<((version: number) => string) | null>(null);

// Sort device facts using the preferred display order, then fall back to name sorting.
// function sortFacts(facts) {
//   return [...facts].sort((a, b) => {
//     const orderA = FACT_DISPLAY_ORDER.indexOf(a.label);
//     const orderB = FACT_DISPLAY_ORDER.indexOf(b.label);
//     const hasOrderA = orderA !== -1;
//     const hasOrderB = orderB !== -1;

//     if (hasOrderA && hasOrderB) {
//       if (orderA !== orderB) {
//         return orderA - orderB;
//       }
//       return a.label.localeCompare(b.label);
//     }

//     if (hasOrderA) return -1;
//     if (hasOrderB) return 1;

//     return a.label.localeCompare(b.label);
//   });
// }

// Lazy-load and cache the LittleFS WASM module.
async function loadLittlefsModule() {
  if (!littlefsModulePromise) {
    littlefsModulePromise = import('./wasm/littlefs/index.js')
      .then(module => {
        littlefsFormatDiskVersion.value =
          typeof module.formatDiskVersion === 'function' ? module.formatDiskVersion : null;
        return module;
      })
      .catch(error => {
        littlefsModulePromise = null;
        littlefsFormatDiskVersion.value = null;
        throw error;
      });
  }
  return littlefsModulePromise;
}

// Normalize filesystem paths by enforcing a leading slash and collapsing separators.
function normalizeFsPath(path = '/') {
  let p = path || '/';
  p = p.startsWith('/') ? p : `/${p}`;
  p = p.replace(/\/+/g, '/');
  if (p.length > 1 && p.endsWith('/')) {
    p = p.slice(0, -1);
  }
  return p || '/';
}

// Estimate LittleFS storage footprint for a single file (data + metadata block).
function littlefsEstimateFileFootprint(size = 0) {
  const block = littlefsState.blockSize || 1;
  const dataBytes = Math.max(1, Math.ceil(size / block)) * block;
  const metadataBytes = block; // per-file metadata block
  return dataBytes + metadataBytes;
}

// Estimate total LittleFS usage for a set of entries.
function littlefsEstimateUsage(entries) {
  const block = littlefsState.blockSize || 1;
  let total = block * 2; // root metadata copies
  for (const entry of entries || []) {
    if (entry.type === 'dir') {
      total += block;
    } else {
      total += littlefsEstimateFileFootprint(entry.size ?? 0);
    }
  }
  return total;
}

// Determine if a path is a direct child of another path.
function isDirectChildPath(childPath, basePath) {
  const child = normalizeFsPath(childPath);
  const base = normalizeFsPath(basePath);
  if (base === '/') {
    return child.split('/').filter(Boolean).length === 1;
  }
  if (!child.startsWith(base + '/')) return false;
  const remaining = child.slice(base.length);
  const segments = remaining.split('/').filter(Boolean);
  return segments.length === 1;
}

// Join and normalize filesystem paths.
function joinFsPath(basePath, name) {
  const base = normalizeFsPath(basePath);
  const cleanedName = String(name || '').replace(/\/+/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
  if (!cleanedName) return base;
  return normalizeFsPath(`${base}/${cleanedName}`);
}

// Lazy-load and cache the FATFS WASM module.
async function loadFatfsModule() {
  if (!fatfsModulePromise) {
    fatfsModulePromise = import('./wasm/fatfs/index.js').catch(error => {
      fatfsModulePromise = null;
      throw error;
    });
  }
  return fatfsModulePromise;
}

// Normalize LittleFS entry objects and paths into a consistent structure.
function normalizeLittlefsEntries(entries, basePath = '/') {
  if (!Array.isArray(entries)) {
    return [];
  }
  const base = normalizeFsPath(basePath || '/');
  const baseName = base.split('/').filter(Boolean).pop() || '';
  return entries
    .map(entry => {
      const rawPath = (entry?.path ?? entry?.name ?? '').toString();
      let path = rawPath;
      if (!path.startsWith('/')) {
        const strippedBase = base.replace(/^\//, '');
        if (strippedBase && (path === strippedBase || path.startsWith(`${strippedBase}/`))) {
          path = `/${path}`;
        } else {
          path = joinFsPath(base, path);
        }
      }
      path = normalizeFsPath(path);
      if (path !== '/' && path.endsWith('/')) {
        path = path.slice(0, -1);
      }
      if (!path || path === '/') {
        return null;
      }
      if (path === base || rawPath === baseName || rawPath === '.' || rawPath === './') {
        return null; // skip self entries
      }
      const segments = path.split('/').filter(Boolean);
      const name = segments[segments.length - 1] || '';
      const isDir = entry?.isDirectory === true || entry?.type === 'dir';
      return {
        name,
        path,
        type: isDir ? 'dir' : 'file',
        size: Number(entry?.size ?? 0) || 0,
      };
    })
    .filter(Boolean);
}

// Detect common signatures that indicate an unformatted LittleFS image.
function isLittlefsUnformattedError(error) {
  if (!error) {
    return false;
  }
  if (typeof error.code === 'number' && error.code === -84) {
    return true;
  }
  const message = String(error?.message ?? '').toLowerCase();
  return message.includes('failed to initialize littlefs from image') || message.includes('corrupted dir pair');
}

// Check if a LittleFS image is all 0xFF (blank).
function isBlankLittlefsImage(image) {
  if (!(image instanceof Uint8Array) || !image.length) {
    return true;
  }
  for (let index = 0; index < image.length; index += 1) {
    if (image[index] !== 0xff) {
      return false;
    }
  }
  return true;
}

// Tell whether a LittleFS backup exists for this session.
function hasLittlefsBackup() {
  return Boolean(littlefsState.backupDone || littlefsState.sessionBackupDone);
}

// Tell whether a FATFS backup exists for this session.
function hasFatfsBackup() {
  return Boolean(fatfsState.backupDone || fatfsState.sessionBackupDone);
}

// Mark the LittleFS state as dirty and optionally set a status message.
function markLittlefsDirty(message) {
  littlefsState.dirty = true;
  if (message) {
    littlefsState.status = message;
  }
}

// Mark the FATFS state as dirty and optionally set a status message.
function markFatfsDirty(message) {
  fatfsState.dirty = true;
  if (message) {
    fatfsState.status = message;
  }
}

// Ensure LittleFS has a selected partition and is loaded when needed.
async function ensureLittlefsReady(options: EnsureFsOptions = {}) {
  if (!connected.value || !littleFsAvailable.value) {
    return;
  }
  const partition = littlefsSelectedPartition.value ?? littleFsPartitions.value[0];
  if (!partition) {
    return;
  }
  if (!littlefsState.selectedId) {
    littlefsState.selectedId = partition.id;
  }
  if (littlefsState.loading || littlefsState.busy || littlefsState.saving) {
    return;
  }
  if (options.force || !littlefsState.client || littlefsState.selectedId !== partition.id) {
    await loadLittlefsPartition(partition);
  }
}

// Read LittleFS from flash, initialize the client, and populate state.
async function loadLittlefsPartition(partition) {
  const fsLabel = t('filesystem.labels.littlefs');
  if (!loader.value || !partition) {
    littlefsState.error = t('filesystem.messages.connectFirst');
    return;
  }
  littlefsLoadCancelRequested.value = false;
  littlefsState.selectedId = partition.id;
  littlefsState.loading = true;
  littlefsState.error = null;
  littlefsState.readOnly = false;
  littlefsState.readOnlyReason = '';
  littlefsLoadingDialog.value = 0;
  littlefsState.loadCancelled = false;
  const littlefsBaudLabel = currentBaud.value ? ` @ ${currentBaud.value.toLocaleString()} bps` : '';
  const readLabel = `${partition.label || fsLabel}${littlefsBaudLabel}`;
  const totalBytesLabel = partition.size?.toLocaleString() ?? '';
  littlefsState.status = t('filesystem.messages.readProgress', {
    label: readLabel,
    written: '0',
    total: totalBytesLabel,
  });
  littlefsLoadingDialog.visible = true;
  littlefsLoadingDialog.label = t('filesystem.messages.loading', { fs: readLabel });
  const attemptedConfigs = [];
  try {
    const image = await readFlashToBuffer(partition.offset, partition.size, {
      label: readLabel,
      cancelSignal: littlefsLoadCancelRequested,
      onProgress: progress => {
        littlefsLoadingDialog.label = progress.label;
        littlefsLoadingDialog.value = progress.value ?? 0;
      },
    });
    littlefsState.lastReadOffset = partition.offset;
    littlefsState.lastReadSize = partition.size;
    littlefsState.lastReadImage = image;
    const module = await loadLittlefsModule();
    const createLittleFSFromImage =
      typeof module.createLittleFSFromImage === 'function' ? module.createLittleFSFromImage : null;
    if (!createLittleFSFromImage) {
      throw new Error(t('filesystem.messages.missingLittlefsCreateFromImage'));
    }
    const imageIsBlank = isBlankLittlefsImage(image);
    const createLittleFS = typeof module.createLittleFS === 'function' ? module.createLittleFS : null;
    let client = null;
    let lastError = null;
    for (const candidateSize of LITTLEFS_BLOCK_SIZE_CANDIDATES) {
      if (partition.size % candidateSize !== 0) {
        continue;
      }
      try {
        const blockCount = partition.size / candidateSize;
        attemptedConfigs.push({ blockSize: candidateSize, blockCount });
        client = await createLittleFSFromImage(image, {
          blockSize: candidateSize,
          blockCount,
        });
        littlefsState.blockSize = candidateSize;
        littlefsState.blockCount = blockCount;
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!client) {
      if (createLittleFS && attemptedConfigs.length && (imageIsBlank || isLittlefsUnformattedError(lastError))) {
        try {
          const fallbackConfig = attemptedConfigs[0];
          client = await createLittleFS({
            blockSize: fallbackConfig.blockSize,
            blockCount: fallbackConfig.blockCount,
            formatOnInit: true,
          });
          littlefsState.blockSize = fallbackConfig.blockSize;
          littlefsState.blockCount = fallbackConfig.blockCount;
          littlefsState.client = client;
          littlefsState.files = [];
          littlefsState.baselineFiles = [];
          littlefsState.dirty = false;
          littlefsState.readOnly = false;
          littlefsState.readOnlyReason = '';
          littlefsState.error = null;
          updateLittlefsUsage(partition);
          littlefsState.status = t('filesystem.messages.blankPartition', { fs: fsLabel });
          appendLog(t('filesystem.messages.blankPartitionLog', { fs: fsLabel }), '[ESPConnect-Warn]');
          littlefsState.loadCancelled = false;
          return;
        } catch (fallbackError) {
          lastError = fallbackError;
        }
      }
      littlefsState.client = null;
      littlefsState.files = [];
      littlefsState.baselineFiles = [];
      littlefsState.readOnly = true;
      littlefsState.readOnlyReason = t('filesystem.messages.readOnlyReason', { fs: fsLabel });
      const detail = littlefsState.readOnlyReason || t('filesystem.readOnlyDefault');
      littlefsState.status = t('filesystem.readOnly', { fs: fsLabel, detail });
      littlefsState.error = formatErrorMessage(lastError);
      updateLittlefsUsage(partition);
      return;
    }
    littlefsState.client = client;
    littlefsState.currentPath = '/';
    const rootEntries = client.list?.('/') ?? [];
    littlefsState.allFiles = normalizeLittlefsEntries(rootEntries, '/');
    const entries = client.list?.(littlefsState.currentPath) ?? [];
    littlefsState.files = normalizeLittlefsEntries(entries, littlefsState.currentPath);
    try {
      console.info(
        '[ESPConnect-LittleFS] initial entries @',
        littlefsState.currentPath,
        littlefsState.files.map(entry => `${entry.type === 'dir' ? 'dir ' : 'file'} ${entry.path}`),
      );
    } catch {
      // ignore
    }
    littlefsState.baselineFiles = littlefsState.files.map(file => ({ ...file }));
    littlefsState.dirty = false;
    littlefsState.backupDone = false;
    updateLittlefsUsage(partition);
    const count = littlefsState.files.length;
    littlefsState.status = t('filesystem.messages.loadedCount', { count });
    appendLog(
      t('filesystem.messages.loadLog', {
        fs: fsLabel,
        label: partition.label,
        count,
      }),
      '[ESPConnect-Debug]'
    );
  } catch (error) {
    const message = formatErrorMessage(error);
    if (message === FILESYSTEM_LOAD_CANCELLED_MESSAGE) {
      littlefsState.loadCancelled = true;
      littlefsState.client = null;
      littlefsState.files = [];
      littlefsState.baselineFiles = [];
      littlefsState.dirty = false;
      littlefsState.backupDone = false;
      littlefsState.blockCount = 0;
      updateLittlefsUsage(partition);
      littlefsState.error = null;
      littlefsState.readOnly = false;
      littlefsState.readOnlyReason = '';
      littlefsState.status = t('filesystem.loadCancelled', { fs: fsLabel });
      return;
    } else {
      littlefsState.loadCancelled = false;
      littlefsState.client = null;
      littlefsState.files = [];
      littlefsState.baselineFiles = [];
      littlefsState.blockCount = 0;
      updateLittlefsUsage(partition);
      littlefsState.error = message;
      littlefsState.readOnly = true;
      littlefsState.readOnlyReason = t('filesystem.messages.readOnlyReason', { fs: fsLabel });
      const detail = littlefsState.readOnlyReason || t('filesystem.readOnlyDefault');
      littlefsState.status = t('filesystem.readOnly', { fs: fsLabel, detail });
    }
  } finally {
    littlefsState.loading = false;
    littlefsLoadingDialog.visible = false;
    littlefsLoadingDialog.value = 0;
    littlefsLoadCancelRequested.value = false;
  }
}

// Refresh the LittleFS listing and usage based on the current path.
async function refreshLittlefsListing() {
  if (!littlefsState.client) {
    return;
  }
  const rootEntries = littlefsState.client.list?.('/') ?? [];
  littlefsState.allFiles = normalizeLittlefsEntries(rootEntries, '/');
  const entries = littlefsState.client.list?.(littlefsState.currentPath || '/') ?? [];
  littlefsState.files = normalizeLittlefsEntries(entries, littlefsState.currentPath);
  try {
    console.info(
      '[ESPConnect-LittleFS] entries @',
      littlefsState.currentPath,
      littlefsState.files.map(entry => `${entry.type === 'dir' ? 'dir ' : 'file'} ${entry.path}`),
    );
  } catch {
    // ignore console errors
  }
  updateLittlefsUsage();
}

// Select a LittleFS partition and trigger a load.
function handleSelectLittlefsPartition(partitionId) {
  if (littlefsState.loading || littlefsState.busy || littlefsState.saving) {
    return;
  }
  const fsLabel = t('filesystem.labels.littlefs');
  littlefsState.selectedId = partitionId;
  littlefsState.client = null;
  littlefsState.files = [];
  littlefsState.currentPath = '/';
  littlefsState.status = t('filesystem.messages.loading', { fs: fsLabel });
  const partition = littleFsPartitions.value.find(entry => entry.id === partitionId) ?? littleFsPartitions.value[0];
  if (partition) {
    void loadLittlefsPartition(partition);
  }
}

// Reload the active LittleFS partition.
async function handleRefreshLittlefs() {
  const partition = littlefsSelectedPartition.value;
  if (!partition) {
    return;
  }
  await loadLittlefsPartition(partition);
}

// Download a LittleFS backup image for the selected partition.
async function handleLittlefsBackup() {
  const partition = littlefsSelectedPartition.value;
  const fsLabel = t('filesystem.labels.littlefs');
  if (!partition) {
    littlefsState.status = t('filesystem.messages.selectPartition', { fs: fsLabel });
    return;
  }
  if (!loader.value) {
    littlefsState.status = t('filesystem.messages.connectFirst');
    return;
  }
  littlefsBackupDialog.visible = true;
  littlefsBackupDialog.value = 0;
  littlefsBackupDialog.label = t('filesystem.messages.backupLabel', { fs: fsLabel });
  try {
    const baseLabel = `${partition.label || 'littlefs'}_${partition.offset.toString(16)}`;
    const safeBase = sanitizeFileName(baseLabel, 'littlefs');
    const stampedName = `${safeBase}_${formatBackupTimestamp()}.bin`;
    const cachedImage =
      littlefsState.lastReadImage &&
      littlefsState.lastReadOffset === partition.offset &&
      littlefsState.lastReadSize === partition.size
        ? littlefsState.lastReadImage
        : null;
    if (cachedImage) {
      littlefsBackupDialog.value = 100;
      littlefsBackupDialog.label = 'Saving backup from cached LittleFS image...';
      saveBinaryFile(stampedName, cachedImage);
    } else {
      await downloadFlashRegion(partition.offset, partition.size, {
        label: `${partition.label || 'LittleFS'} partition`,
        fileName: stampedName,
        suppressStatus: true,
        onProgress: progress => {
          littlefsBackupDialog.value = progress.value ?? 0;
          littlefsBackupDialog.label = progress.label || 'Backing up LittleFS...';
        },
      });
    }
    littlefsState.backupDone = true;
    littlefsState.sessionBackupDone = true;
    littlefsState.status = t('filesystem.messages.backupComplete', { fs: fsLabel });
    appendLog(t('filesystem.messages.backupLog', { fs: fsLabel }), '[ESPConnect-Debug]');
  } catch (error) {
    const message = formatErrorMessage(error);
    if (message === 'Download cancelled by user') {
      littlefsState.error = null;
      littlefsState.status = t('filesystem.messages.backupCancelled', { fs: fsLabel });
    } else {
      littlefsState.error = message;
      littlefsState.status = t('filesystem.messages.backupFailed', { fs: fsLabel });
    }
  } finally {
    littlefsBackupDialog.visible = false;
    littlefsBackupDialog.value = 0;
    littlefsBackupDialog.label = '';
  }
}

// Cancel an in-progress LittleFS backup download.
function cancelLittlefsBackup() {
  if (!littlefsBackupDialog.visible) {
    return;
  }
  littlefsBackupDialog.label = t('filesystem.messages.backupStopping');
  handleCancelDownload();
}

// Request cancellation of an in-progress LittleFS load.
function cancelLittlefsLoad() {
  if (!littlefsLoadingDialog.visible || littlefsLoadCancelRequested.value) {
    return;
  }
  littlefsLoadCancelRequested.value = true;
  littlefsLoadingDialog.label = t('filesystem.messages.loadStopping', {
    fs: t('filesystem.labels.littlefs'),
  });
}

// Restore a LittleFS image to the selected partition.
async function handleLittlefsRestore(file) {
  const partition = littlefsSelectedPartition.value;
  if (!partition) return;
  if (!file) return;
  const fsLabel = t('filesystem.labels.littlefs');
  const buffer = new Uint8Array(await file.arrayBuffer());
  if (buffer.length !== partition.size) {
    littlefsState.status = t('filesystem.messages.restoreSizeMismatch', {
      size: formatBytes(partition.size) ?? `${partition.size} bytes`,
    });
    return;
  }
  const confirmed = await showConfirmation({
    title: t('filesystem.messages.restoreTitle', { fs: fsLabel }),
    message: t('filesystem.messages.restoreMessage', { fs: fsLabel }),
    confirmText: t('filesystem.messages.restoreConfirm'),
    destructive: true,
  });
  if (!confirmed) {
    return;
  }
  try {
    littlefsState.saving = true;
    maintenanceBusy.value = true;
    littlefsRestoreDialog.visible = true;
    littlefsRestoreDialog.value = 0;
    littlefsRestoreDialog.label = t('filesystem.messages.restoreLabel', { fs: fsLabel });
    await writeFilesystemImage(partition, buffer, {
      label: fsLabel,
      state: littlefsState,
      onProgress: progress => {
        littlefsRestoreDialog.value = progress.value ?? 0;
        littlefsRestoreDialog.label = progress.label || t('filesystem.messages.restoreLabel', { fs: fsLabel });
      },
    });
    littlefsState.status = t('filesystem.messages.restoreStatus', { fs: fsLabel });
    littlefsState.backupDone = true;
    appendLog(t('filesystem.messages.restoreLog', { fs: fsLabel }), '[ESPConnect-Debug]');
    await loadLittlefsPartition(partition);
  } catch (error) {
    littlefsState.error = formatErrorMessage(error);
    littlefsState.status = t('filesystem.messages.restoreFailed', { fs: fsLabel });
  } finally {
    littlefsState.saving = false;
    maintenanceBusy.value = false;
    littlefsRestoreDialog.visible = false;
    littlefsRestoreDialog.value = 0;
    littlefsRestoreDialog.label = t('filesystem.messages.restoreLabel', { fs: fsLabel });
  }
}

// Validate a selected file before queueing a LittleFS upload.
function handleLittlefsUploadSelection(file) {
  if (!file || !littlefsState.client) {
    littlefsState.uploadBlocked = false;
    littlefsState.uploadBlockedReason = '';
    return;
  }
  const targetPath = joinFsPath(littlefsState.currentPath || '/', file.name);
  const partition = littlefsSelectedPartition.value;
  const partitionSize = partition?.size ?? littlefsState.blockSize * littlefsState.blockCount;
  const usageSource = littlefsState.allFiles?.length ? littlefsState.allFiles : littlefsState.files;
  const usedBytes = littlefsEstimateUsage(usageSource);
  const existingEntry = usageSource.find(entry => entry.path === targetPath);
  const existingFootprint =
    existingEntry?.type === 'dir'
      ? littlefsState.blockSize || existingEntry?.size || 0
      : littlefsEstimateFileFootprint(existingEntry?.size ?? 0);
  const incomingFootprint = littlefsEstimateFileFootprint(file.size);
  const availableBytes = partitionSize ? partitionSize - usedBytes + existingFootprint : 0;
  if (partitionSize && incomingFootprint > availableBytes) {
    const fsLabel = t('filesystem.labels.littlefs');
    const message = t('filesystem.messages.spaceError', { fs: fsLabel });
    littlefsState.uploadBlocked = true;
    littlefsState.uploadBlockedReason = message;
    littlefsState.status = message;
    showToast(message, { color: 'warning' });
    showUploadError(message);
    return;
  }
  littlefsState.uploadBlocked = false;
  littlefsState.uploadBlockedReason = '';
}

// Queue a LittleFS upload while serializing concurrent writes.
async function handleLittlefsUpload(payload) {
  // serialize uploads to avoid parallel free-space races
  littlefsUploadQueue = littlefsUploadQueue.then(() => performLittlefsUpload(payload));
  return littlefsUploadQueue;
}

// Perform a LittleFS upload or folder creation with size and conflict checks.
async function performLittlefsUpload(payload) {
  const { file, path, isDir } = payload || {};
  if (littlefsState.uploadBlocked) {
    console.warn('[ESPConnect-LittleFS] upload skipped because blocked', {
      path,
      reason: littlefsState.uploadBlockedReason,
    });
    return;
  }
  if (!littlefsState.client) return;
  if (littlefsState.readOnly) {
    const fsLabel = t('filesystem.labels.littlefs');
    const detail = littlefsState.readOnlyReason || t('filesystem.readOnlyDefault');
    littlefsState.status = t('filesystem.readOnly', { fs: fsLabel, detail });
    showToast(littlefsState.status, { color: 'info' });
    return;
  }
  if (littlefsState.uploadBlocked) {
    littlefsState.status = littlefsState.uploadBlockedReason || t('filesystem.messages.uploadBlocked');
    if (littlefsState.uploadBlockedReason) {
      showUploadError(littlefsState.uploadBlockedReason);
    }
    return;
  }
  const partition = littlefsSelectedPartition.value;
  const partitionSize = partition?.size ?? littlefsState.blockSize * littlefsState.blockCount;
  const usageSource = littlefsState.allFiles?.length ? littlefsState.allFiles : littlefsState.files;
  const usedBytes = littlefsEstimateUsage(usageSource);
  let workingFreeBytes =
    littlefsState.usage?.freeBytes ??
    (partitionSize ? Math.max(partitionSize - usedBytes, 0) : Number.POSITIVE_INFINITY);
  const derivedIsDir = isDir === true || (!file && !!path);
  if (derivedIsDir && !file && path) {
    const targetDir = joinFsPath(littlefsState.currentPath || '/', path);
    const exists =
      usageSource.find(entry => entry.path === targetDir && entry.type === 'dir') !== undefined;
    if (exists) {
      const msg = t('filesystem.messages.folderExistsPath', { path: targetDir });
      showToast(msg, { color: 'warning' });
      littlefsState.status = msg;
      return;
    }
  }
  console.info('[ESPConnect-LittleFS] upload start', {
    path,
    name: file?.name,
    size: file?.size,
    isDir,
    currentPath: littlefsState.currentPath,
    usedBytes,
    freeBytes: workingFreeBytes,
    partitionSize,
  });
  littlefsState.uploadBlocked = false;
  littlefsState.uploadBlockedReason = '';
  if (!file) {
    if (derivedIsDir && path) {
      await handleLittlefsNewFolder(path);
    }
    return;
  }
  const targetName = (file.name || '').trim();
  if (!targetName) {
    littlefsState.status = t('filesystem.messages.fileNoName');
    showToast(littlefsState.status, { color: 'warning' });
    return;
  }
  // size check using handleLittlefsUploadSelection logic
  const targetPath = joinFsPath(littlefsState.currentPath || '/', path || targetName);
  const existingEntry = usageSource.find(entry => entry.path === targetPath);
  const existingFootprint =
    existingEntry?.type === 'dir'
      ? littlefsState.blockSize || existingEntry?.size || 0
      : littlefsEstimateFileFootprint(existingEntry?.size ?? 0);
  const incomingFootprint = littlefsEstimateFileFootprint(file.size);
  const availableBytes = partitionSize ? workingFreeBytes + existingFootprint : Number.POSITIVE_INFINITY;
  if (incomingFootprint > availableBytes) {
    const message = t('filesystem.messages.spaceError', { fs: t('filesystem.labels.littlefs') });
    littlefsState.uploadBlocked = true;
    littlefsState.uploadBlockedReason = message;
    littlefsState.status = message;
    showUploadError(message);
    console.warn('[ESPConnect-LittleFS] upload blocked file', {
      targetPath,
      size: file.size,
      existingSize: existingEntry?.size ?? 0,
      availableBytes,
      freeBytes: workingFreeBytes,
    });
    return;
  }

  try {
    littlefsState.busy = true;
    const data = new Uint8Array(await file.arrayBuffer());
    const relativePath = path || targetName;
    const target = joinFsPath(littlefsState.currentPath || '/', relativePath);
    // ensure parent directories
    const segments = target.split('/').filter(Boolean);
    let built = '';
    if (segments.length > 1 && typeof littlefsState.client.mkdir === 'function') {
      for (let i = 0; i < segments.length - 1; i++) {
        built += `/${segments[i]}`;
        try {
          littlefsState.client.mkdir(built);
        } catch (e) {
          // ignore if exists
        }
      }
    }
    if (typeof littlefsState.client.writeFile === 'function') {
      littlefsState.client.writeFile(target, data);
    } else if (typeof littlefsState.client.addFile === 'function') {
      littlefsState.client.addFile(target, data);
    }
    await refreshLittlefsListing();
    markLittlefsDirty(t('filesystem.messages.staged', { name: target }));
    appendLog(
      t('filesystem.messages.stagedLog', {
        fs: t('filesystem.labels.littlefs'),
        name: target,
        size: data.length.toLocaleString(),
      }),
      '[ESPConnect-Debug]'
    );
    workingFreeBytes = partitionSize
      ? Math.max(0, partitionSize - littlefsEstimateUsage(littlefsState.allFiles?.length ? littlefsState.allFiles : littlefsState.files))
      : workingFreeBytes;
    console.info('[ESPConnect-LittleFS] upload success', {
      target,
      size: file.size,
      freeBytesRemaining: workingFreeBytes,
    });
  } catch (error) {
    console.error('[ESPConnect-LittleFS] upload error', {
      target: targetPath,
      size: file?.size,
      error,
    });
    const msg = formatErrorMessage(error);
    const spaceError = msg.toLowerCase().includes('no more free space') || msg.toLowerCase().includes('unable to add file');
    if (spaceError) {
      littlefsState.uploadBlocked = true;
      littlefsState.uploadBlockedReason = msg;
      littlefsState.status = msg;
      showUploadError(msg);
      // clean up any empty stub created by a failed write
      try {
        if (typeof littlefsState.client.delete === 'function') {
          littlefsState.client.delete(targetPath, { recursive: false });
        } else if (typeof littlefsState.client.deleteFile === 'function') {
          littlefsState.client.deleteFile(targetPath);
        }
      } catch {
        // ignore cleanup errors
      }
      await refreshLittlefsListing();
    } else {
      littlefsState.error = msg;
      showToast(msg, { color: 'error' });
    }
  } finally {
    littlefsState.busy = false;
  }
}

// Clear any upload-block state in LittleFS.
function handleLittlefsResetUploadBlock() {
  littlefsState.uploadBlocked = false;
  littlefsState.uploadBlockedReason = '';
}

// Delete a LittleFS file or directory after confirmation.
async function handleLittlefsDelete(path) {
  if (!littlefsState.client || littlefsState.readOnly) {
    return;
  }
  const targetPath = normalizeFsPath(path);
  const entry = littlefsState.files.find(f => normalizeFsPath(f.path) === targetPath);
  const isDir = entry?.type === 'dir';
  const confirmed = await showConfirmation({
    title: isDir ? t('filesystem.messages.deleteFolderTitle') : t('filesystem.messages.deleteTitle'),
    message: t('filesystem.messages.deleteMessage', { name: targetPath, fs: t('filesystem.labels.littlefs') }),
    confirmText: t('filesystem.messages.deleteConfirm'),
    destructive: true,
  });
  if (!confirmed) {
    return;
  }
  try {
    littlefsState.busy = true;
    if (typeof littlefsState.client.delete === 'function') {
      littlefsState.client.delete(targetPath, { recursive: true });
    } else if (!isDir && typeof littlefsState.client.deleteFile === 'function') {
      littlefsState.client.deleteFile(targetPath);
    } else {
      throw new Error(t('filesystem.messages.deleteUnsupportedLittlefs'));
    }
    await refreshLittlefsListing();
    markLittlefsDirty(t('filesystem.messages.deleted', { name: targetPath, fs: t('filesystem.labels.littlefs') }));
    appendLog(t('filesystem.messages.deletedLog', { fs: t('filesystem.labels.littlefs'), name: targetPath }), '[ESPConnect-Debug]');
  } catch (error) {
    littlefsState.error = formatErrorMessage(error);
  } finally {
    littlefsState.busy = false;
  }
}

// Navigate to a specific path within LittleFS.
async function handleLittlefsNavigate(path) {
  const target = normalizeFsPath(path || '/');
  if (littlefsState.currentPath === target || !littlefsState.client) return;
  littlefsState.currentPath = target;
  await refreshLittlefsListing();
}

// Navigate one directory up within LittleFS.
async function handleLittlefsNavigateUp() {
  const current = normalizeFsPath(littlefsState.currentPath || '/');
  if (current === '/') return;
  const segments = current.split('/').filter(Boolean);
  segments.pop();
  const parent = segments.length ? `/${segments.join('/')}` : '/';
  await handleLittlefsNavigate(parent);
}

// Create a new folder in the current LittleFS path.
async function handleLittlefsNewFolder(name?: string) {
  if (!littlefsState.client || littlefsState.readOnly) return;
  const folderName = (name || prompt(t('filesystem.newFolderName')))?.toString().trim();
  if (!folderName) return;
  if (folderName.includes('/') || folderName.includes('..')) {
    showToast(t('filesystem.messages.folderNameInvalid'), { color: 'warning' });
    return;
  }
  const targetPath = joinFsPath(littlefsState.currentPath || '/', folderName);
  const existingDir =
    littlefsState.allFiles?.find(entry => entry.path === targetPath && entry.type === 'dir') ||
    littlefsState.files.find(entry => entry.path === targetPath && entry.type === 'dir');
  if (existingDir) {
    const msg = t('filesystem.messages.folderExistsHere', { name: folderName });
    showToast(msg, { color: 'warning' });
    littlefsState.status = msg;
    return;
  }
  try {
    littlefsState.busy = true;
    if (typeof littlefsState.client.mkdir === 'function') {
      littlefsState.client.mkdir(targetPath);
    } else {
      showToast(t('filesystem.messages.mkdirUnavailable', { fs: t('filesystem.labels.littlefs') }), { color: 'error' });
      return;
    }
    await refreshLittlefsListing();
    markLittlefsDirty(`Created folder ${targetPath}. Save to persist.`);
  } catch (error) {
    littlefsState.error = formatErrorMessage(error);
  } finally {
    littlefsState.busy = false;
  }
}

// Format the LittleFS image and mark changes as staged.
async function handleLittlefsFormat() {
  if (!littlefsState.client || littlefsState.readOnly) {
    return;
  }
  const confirmed = await showConfirmation({
    title: t('filesystem.messages.formatTitle', { fs: t('filesystem.labels.littlefs') }),
    message: t('filesystem.messages.formatMessage', { fs: t('filesystem.labels.littlefs') }),
    confirmText: t('filesystem.messages.formatConfirm'),
    destructive: true,
  });
  if (!confirmed) return;
  try {
    littlefsState.busy = true;
    littlefsState.client.format();
    await refreshLittlefsListing();
    markLittlefsDirty(t('filesystem.messages.formatted', { fs: t('filesystem.labels.littlefs') }));
    appendLog(t('filesystem.messages.formatLog', { fs: t('filesystem.labels.littlefs') }), '[ESPConnect-Debug]');
  } catch (error) {
    littlefsState.error = formatErrorMessage(error);
  } finally {
    littlefsState.busy = false;
  }
}

// Persist staged LittleFS changes back to flash.
async function handleLittlefsSave() {
  if (!littlefsState.client) {
    littlefsState.status = t('filesystem.messages.loadFirst', { fs: t('filesystem.labels.littlefs') });
    return;
  }
  if (littlefsState.readOnly) {
    const detail = littlefsState.readOnlyReason || t('filesystem.readOnlyDefault');
    littlefsState.status = t('filesystem.readOnly', {
      fs: t('filesystem.labels.littlefs'),
      detail,
    });
    return;
  }
  if (!littlefsState.dirty) {
    littlefsState.status = t('filesystem.messages.noChanges');
    return;
  }
  if (!hasLittlefsBackup()) {
    littlefsState.status = t('filesystem.messages.backupFirst', { fs: t('filesystem.labels.littlefs') });
    return;
  }
  const partition = littlefsSelectedPartition.value;
  if (!partition) {
    littlefsState.status = t('filesystem.messages.selectPartition', { fs: t('filesystem.labels.littlefs') });
    return;
  }
  const diff = computeLittlefsDiff();
  const summaryParts = [];
  if (diff.added.length) summaryParts.push(t('filesystem.messages.diffAdded', { list: diff.added.join(', ') }));
  if (diff.modified.length) summaryParts.push(t('filesystem.messages.diffModified', { list: diff.modified.join(', ') }));
  if (diff.removed.length) summaryParts.push(t('filesystem.messages.diffRemoved', { list: diff.removed.join(', ') }));
  const summary =
    summaryParts.length > 0
      ? summaryParts.join('\n')
      : t('filesystem.messages.diffNone');
  const confirmed = await showConfirmation({
    title: t('filesystem.messages.writeTitle', { fs: t('filesystem.labels.littlefs') }),
    message: t('filesystem.messages.writeMessage', { summary }),
    confirmText: t('filesystem.messages.writeConfirm'),
    destructive: true,
  });
  if (!confirmed) return;
  try {
    littlefsState.saving = true;
    maintenanceBusy.value = true;
    littlefsSaveDialog.visible = true;
    const image = littlefsState.client.toImage();
    if (image.length > partition.size) {
      throw new Error(t('filesystem.messages.imageTooLarge', { fs: t('filesystem.labels.littlefs') }));
    }
    await writeFilesystemImage(partition, image, {
      label: t('filesystem.labels.littlefs'),
      state: littlefsState,
      onProgress: progress => {
        littlefsSaveDialog.value = progress.value ?? 0;
        littlefsSaveDialog.label = progress.label || t('filesystem.messages.saveStatusLabel', { fs: t('filesystem.labels.littlefs') });
      },
    });
    littlefsState.dirty = false;
    littlefsState.status = t('filesystem.messages.saveStatus', { fs: t('filesystem.labels.littlefs') });
    appendLog(t('filesystem.messages.saveLog', { fs: t('filesystem.labels.littlefs') }), '[ESPConnect-Debug]');
    await loadLittlefsPartition(partition);
  } catch (error) {
    littlefsState.error = formatErrorMessage(error);
    littlefsState.status = t('filesystem.messages.saveFailed', { fs: t('filesystem.labels.littlefs') });
  } finally {
    littlefsState.saving = false;
    maintenanceBusy.value = false;
    littlefsSaveDialog.visible = false;
    littlefsSaveDialog.value = 0;
    littlefsSaveDialog.label = t('filesystem.messages.savingLabel', { fs: t('filesystem.labels.littlefs') });
  }
}

// Read a LittleFS file and return its raw bytes.
async function readLittlefsFile(path) {
  if (!littlefsState.client) {
    throw new Error(t('filesystem.messages.littlefsUnavailable'));
  }
  if (!path) {
    throw new Error(t('filesystem.messages.filePathRequired'));
  }
  const reader =
    typeof littlefsState.client.readFile === 'function'
      ? littlefsState.client.readFile
      : typeof littlefsState.client.read === 'function'
        ? littlefsState.client.read
        : null;
  if (!reader) {
    throw new Error(t('filesystem.messages.littlefsReadUnsupported'));
  }
  const result = reader.call(littlefsState.client, path);
  const data = result instanceof Promise ? await result : result;
  if (!(data instanceof Uint8Array)) {
    throw new Error(t('filesystem.messages.littlefsReadUnexpected'));
  }
  return data;
}

// Download a LittleFS file to the host.
async function handleLittlefsDownloadFile(path) {
  if (!littlefsState.client || !path) return;
  try {
    const data = await readLittlefsFile(path);
    const name = path.split('/').filter(Boolean).pop() || 'file.bin';
    saveBinaryFile(name, data);
    appendLog(
      t('filesystem.messages.downloadedLog', {
        fs: t('filesystem.labels.littlefs'),
        name: path,
        bytes: data.length.toLocaleString(),
      }),
      '[ESPConnect-Debug]'
    );
  } catch (error) {
    littlefsState.error = formatErrorMessage(error);
    littlefsState.status = t('filesystem.messages.downloadFailed', { fs: t('filesystem.labels.littlefs') });
  }
}

// Preview a LittleFS file using the SPIFFS viewer dialog.
async function handleLittlefsView(path) {
  if (!littlefsState.client) return;
  const name = path.split('/').filter(Boolean).pop() || path;
  const viewInfo = resolveSpiffsViewInfo(name);
  if (!viewInfo) {
    littlefsState.status = t('filesystem.messages.unsupportedPreview');
    showToast(littlefsState.status, { color: 'info' });
    return;
  }
  resetViewerMedia();
  spiffsViewerDialog.visible = true;
  spiffsViewerDialog.name = path;
  spiffsViewerDialog.loading = true;
  spiffsViewerDialog.error = null;
  spiffsViewerDialog.content = '';
  spiffsViewerDialog.mode = viewInfo.mode;
  spiffsViewerDialog.source = 'littlefs';
  try {
    const data = await readLittlefsFile(path);
    if (data.length > SPIFFS_VIEWER_MAX_BYTES) {
      const limitText = formatBytes(SPIFFS_VIEWER_MAX_BYTES) ?? `${SPIFFS_VIEWER_MAX_BYTES} bytes`;
      throw new Error(t('filesystem.messages.tooLargePreview', { limit: limitText }));
    }
    if (viewInfo.mode === 'image') {
      const blob = new Blob([toArrayBuffer(data)], { type: viewInfo.mime || 'image/*' });
      spiffsViewerDialog.imageUrl = URL.createObjectURL(blob);
    } else if (viewInfo.mode === 'audio') {
      const blob = new Blob([toArrayBuffer(data)], { type: viewInfo.mime || 'audio/*' });
      spiffsViewerDialog.audioUrl = URL.createObjectURL(blob);
    } else {
      spiffsViewerDialog.content = SPIFFS_VIEWER_DECODER.decode(data);
    }
  } catch (error) {
    spiffsViewerDialog.error = formatErrorMessage(error);
    showToast(spiffsViewerDialog.error, { color: 'error' });
  } finally {
    spiffsViewerDialog.loading = false;
  }
}

// Ensure FATFS has a selected partition and is loaded when needed.
async function ensureFatfsReady(options: EnsureFsOptions = {}) {
  if (!connected.value || !fatfsAvailable.value) {
    return;
  }
  const partition = fatfsSelectedPartition.value ?? fatfsPartitions.value[0];
  if (!partition) {
    return;
  }
  if (!fatfsState.selectedId) {
    fatfsState.selectedId = partition.id;
  }
  if (fatfsState.loading || fatfsState.busy || fatfsState.saving) {
    return;
  }
  if (options.force || !fatfsState.client || fatfsState.selectedId !== partition.id) {
    await loadFatfsPartition(partition);
  }
}

// Read a FATFS partition image, build the client, and populate state.
async function loadFatfsPartition(partition) {
  if (!loader.value || !partition) {
    fatfsState.error = t('filesystem.messages.connectFirst');
    return;
  }
  fatfsLoadCancelRequested.value = false;
  fatfsState.selectedId = partition.id;
  fatfsState.loading = true;
  fatfsState.error = null;
  fatfsState.readOnly = false;
  fatfsState.readOnlyReason = '';
  fatfsLoadingDialog.value = 0;
  fatfsState.loadCancelled = false;
  const baudLabel = currentBaud.value ? ` @ ${currentBaud.value.toLocaleString()} bps` : '';
  const fsLabel = t('filesystem.labels.fatfs');
  const readLabel = `${partition.label || fsLabel}${baudLabel}`;
  fatfsState.status = t('filesystem.messages.loading', { fs: readLabel });
  fatfsLoadingDialog.visible = true;
  fatfsLoadingDialog.label = t('filesystem.messages.loading', { fs: readLabel });
  try {
    const image = await readFlashToBuffer(partition.offset, partition.size, {
      label: readLabel,
      cancelSignal: fatfsLoadCancelRequested,
      onProgress: progress => {
        fatfsLoadingDialog.label = progress.label;
        fatfsLoadingDialog.value = progress.value ?? 0;
      },
    });
    fatfsState.lastReadOffset = partition.offset;
    fatfsState.lastReadSize = partition.size;
    fatfsState.lastReadImage = image;
    const module = await loadFatfsModule();
    const createFatFSFromImage =
      typeof module.createFatFSFromImage === 'function' ? module.createFatFSFromImage : null;
    if (!createFatFSFromImage) {
      throw new Error(t('filesystem.messages.missingFatfsCreateFromImage'));
    }
    let blockSize = fatfsState.blockSize || FATFS_DEFAULT_BLOCK_SIZE;
    if (!Number.isFinite(blockSize) || blockSize <= 0) {
      blockSize = FATFS_DEFAULT_BLOCK_SIZE;
    }
    let blockCount = Math.max(1, Math.floor(partition.size / blockSize));
    if (blockCount <= 0) {
      blockCount = 1;
    }
    fatfsState.blockSize = blockSize;
    fatfsState.blockCount = blockCount;
    let client = null;
    try {
      client = await createFatFSFromImage(image, {
        blockSize,
        blockCount,
      });
    } catch (error) {
      const createFatFS =
        typeof module.createFatFS === 'function' ? module.createFatFS : module.default?.createFatFS;
      if (createFatFS) {
        client = await createFatFS({
          blockSize,
          blockCount,
          formatOnInit: true,
        });
        fatfsState.status = t('filesystem.messages.blankPartition', { fs: fsLabel });
        appendLog(t('filesystem.messages.blankPartitionLog', { fs: fsLabel }), '[ESPConnect-Warn]');
      } else {
        throw error;
      }
    }
    fatfsState.client = client;
    const entries = client.list?.() ?? [];
    fatfsState.files = normalizeLittlefsEntries(entries);
    fatfsState.baselineFiles = fatfsState.files.map(file => ({ ...file }));
    fatfsState.dirty = false;
    fatfsState.backupDone = false;
    updateFatfsUsage(partition);
    const count = fatfsState.files.length;
    fatfsState.status = t('filesystem.messages.loadedCount', { count });
    appendLog(
      t('filesystem.messages.loadLog', { fs: fsLabel, label: partition.label, count }),
      '[ESPConnect-Debug]'
    );
  } catch (error) {
    const message = formatErrorMessage(error);
    if (message === FILESYSTEM_LOAD_CANCELLED_MESSAGE) {
      fatfsState.loadCancelled = true;
      fatfsState.client = null;
      fatfsState.files = [];
      fatfsState.baselineFiles = [];
      fatfsState.dirty = false;
      fatfsState.backupDone = false;
      updateFatfsUsage(partition);
      fatfsState.error = null;
      fatfsState.readOnly = false;
      fatfsState.readOnlyReason = '';
      fatfsState.status = t('filesystem.loadCancelled', { fs: fsLabel });
      return;
    } else {
      fatfsState.loadCancelled = false;
      fatfsState.client = null;
      fatfsState.files = [];
      fatfsState.baselineFiles = [];
      updateFatfsUsage(partition);
      fatfsState.error = message;
      fatfsState.readOnly = true;
      fatfsState.readOnlyReason = t('filesystem.messages.readOnlyReason', { fs: fsLabel });
      const detail = fatfsState.readOnlyReason || t('filesystem.readOnlyDefault');
      fatfsState.status = t('filesystem.readOnly', { fs: fsLabel, detail });
    }
  } finally {
    fatfsState.loading = false;
    fatfsLoadingDialog.visible = false;
    fatfsLoadingDialog.value = 0;
    fatfsLoadCancelRequested.value = false;
  }
}

// Refresh the FATFS file listing and usage.
async function refreshFatfsListing() {
  if (!fatfsState.client) {
    return;
  }
  const entries = fatfsState.client.list?.() ?? [];
  fatfsState.files = normalizeLittlefsEntries(entries);
  updateFatfsUsage();
}

// Select a FATFS partition and trigger a load.
function handleSelectFatfsPartition(partitionId) {
  if (fatfsState.loading || fatfsState.busy || fatfsState.saving) {
    return;
  }
  fatfsState.selectedId = partitionId;
  fatfsState.client = null;
  fatfsState.files = [];
  fatfsState.status = t('filesystem.messages.loading', { fs: t('filesystem.labels.fatfs') });
  const partition = fatfsPartitions.value.find(entry => entry.id === partitionId) ?? fatfsPartitions.value[0];
  if (partition) {
    void loadFatfsPartition(partition);
  }
}

// Reload the active FATFS partition.
async function handleRefreshFatfs() {
  const partition = fatfsSelectedPartition.value;
  if (!partition) {
    return;
  }
  await loadFatfsPartition(partition);
}

// Download a FATFS backup image for the selected partition.
async function handleFatfsBackup() {
  const partition = fatfsSelectedPartition.value;
  const fsLabel = t('filesystem.labels.fatfs');
  if (!partition) {
    fatfsState.status = t('filesystem.messages.selectPartition', { fs: fsLabel });
    return;
  }
  if (!loader.value) {
    fatfsState.status = t('filesystem.messages.connectFirst');
    return;
  }
  fatfsBackupDialog.visible = true;
  fatfsBackupDialog.value = 0;
  fatfsBackupDialog.label = t('filesystem.messages.backupLabel', { fs: fsLabel });
  try {
    const baseLabel = `${partition.label || 'fatfs'}_${partition.offset.toString(16)}`;
    const safeBase = sanitizeFileName(baseLabel, 'fatfs');
    const stampedName = `${safeBase}_${formatBackupTimestamp()}.bin`;
    const cachedImage =
      fatfsState.lastReadImage &&
      fatfsState.lastReadOffset === partition.offset &&
      fatfsState.lastReadSize === partition.size
        ? fatfsState.lastReadImage
        : null;
    if (cachedImage) {
      fatfsBackupDialog.value = 100;
      fatfsBackupDialog.label = 'Saving backup from cached FATFS image...';
      saveBinaryFile(stampedName, cachedImage);
    } else {
      await downloadFlashRegion(partition.offset, partition.size, {
        label: `${partition.label || 'FATFS'} partition`,
        fileName: stampedName,
        suppressStatus: true,
        onProgress: progress => {
          fatfsBackupDialog.value = progress.value ?? 0;
          fatfsBackupDialog.label = progress.label || 'Backing up FATFS...';
        },
      });
    }
    fatfsState.backupDone = true;
    fatfsState.sessionBackupDone = true;
    fatfsState.status = t('filesystem.messages.backupComplete', { fs: fsLabel });
    appendLog(t('filesystem.messages.backupLog', { fs: fsLabel }), '[ESPConnect-Debug]');
  } catch (error) {
    const message = formatErrorMessage(error);
    if (message === 'Download cancelled by user') {
      fatfsState.error = null;
      fatfsState.status = t('filesystem.messages.backupCancelled', { fs: fsLabel });
    } else {
      fatfsState.error = message;
      fatfsState.status = t('filesystem.messages.backupFailed', { fs: fsLabel });
    }
  } finally {
    fatfsBackupDialog.visible = false;
    fatfsBackupDialog.value = 0;
    fatfsBackupDialog.label = '';
  }
}

// Cancel an in-progress FATFS backup download.
function cancelFatfsBackup() {
  if (!fatfsBackupDialog.visible) {
    return;
  }
  fatfsBackupDialog.label = t('filesystem.messages.backupStopping');
  handleCancelDownload();
}

// Request cancellation of an in-progress FATFS load.
function cancelFatfsLoad() {
  if (!fatfsLoadingDialog.visible || fatfsLoadCancelRequested.value) {
    return;
  }
  fatfsLoadCancelRequested.value = true;
  fatfsLoadingDialog.label = t('filesystem.messages.loadStopping', { fs: t('filesystem.labels.fatfs') });
}

// Restore a FATFS image to the selected partition.
async function handleFatfsRestore(file) {
  const partition = fatfsSelectedPartition.value;
  if (!partition) return;
  if (!file) return;
  const buffer = new Uint8Array(await file.arrayBuffer());
  if (buffer.length !== partition.size) {
    fatfsState.status = t('filesystem.messages.restoreSizeMismatch', {
      size: formatBytes(partition.size) ?? `${partition.size} bytes`,
    });
    return;
  }
  const confirmed = await showConfirmation({
    title: t('filesystem.messages.restoreTitle', { fs: t('filesystem.labels.fatfs') }),
    message: t('filesystem.messages.restoreMessage', { fs: t('filesystem.labels.fatfs') }),
    confirmText: t('filesystem.messages.restoreConfirm'),
    destructive: true,
  });
  if (!confirmed) {
    return;
  }
  try {
    fatfsState.saving = true;
    maintenanceBusy.value = true;
    fatfsRestoreDialog.visible = true;
    fatfsRestoreDialog.value = 0;
    fatfsRestoreDialog.label = t('filesystem.messages.restoreLabel', { fs: t('filesystem.labels.fatfs') });
    await writeFilesystemImage(partition, buffer, {
      label: t('filesystem.labels.fatfs'),
      state: fatfsState,
      onProgress: progress => {
        fatfsRestoreDialog.value = progress.value ?? 0;
        fatfsRestoreDialog.label = progress.label || t('filesystem.messages.restoreLabel', { fs: t('filesystem.labels.fatfs') });
      },
    });
    fatfsState.status = t('filesystem.messages.restoreStatus', { fs: t('filesystem.labels.fatfs') });
    fatfsState.backupDone = true;
    appendLog(t('filesystem.messages.restoreLog', { fs: t('filesystem.labels.fatfs') }), '[ESPConnect-Debug]');
    await loadFatfsPartition(partition);
  } catch (error) {
    fatfsState.error = formatErrorMessage(error);
    fatfsState.status = t('filesystem.messages.restoreFailed', { fs: t('filesystem.labels.fatfs') });
  } finally {
    fatfsState.saving = false;
    maintenanceBusy.value = false;
    fatfsRestoreDialog.visible = false;
    fatfsRestoreDialog.value = 0;
    fatfsRestoreDialog.label = t('filesystem.messages.restoreLabel', { fs: t('filesystem.labels.fatfs') });
  }
}

// Validate a selected file before queueing a FATFS upload.
function handleFatfsUploadSelection(file) {
  if (!file || !fatfsState.client) {
    fatfsState.uploadBlocked = false;
    fatfsState.uploadBlockedReason = '';
    return;
  }
  const partition = fatfsSelectedPartition.value;
  const partitionSize = partition?.size ?? fatfsState.blockSize * fatfsState.blockCount;
  const usedBytes = fatfsState.files.reduce((sum, entry) => sum + (entry.size ?? 0), 0);
  const existingSize = fatfsState.files.find(entry => entry.name === file.name)?.size ?? 0;
  const availableBytes = partitionSize ? partitionSize - usedBytes + existingSize : 0;
  if (partitionSize && file.size > availableBytes) {
    const message = t('filesystem.messages.spaceError', { fs: t('filesystem.labels.fatfs') });
    fatfsState.uploadBlocked = true;
    fatfsState.uploadBlockedReason = message;
    fatfsState.status = message;
    showToast(message, { color: 'warning' });
    showUploadError(message);
    return;
  }
  fatfsState.uploadBlocked = false;
  fatfsState.uploadBlockedReason = '';
}

// Upload a file to FATFS with size checks and staging.
async function handleFatfsUpload({ file }) {
  if (!fatfsState.client) return;
  if (fatfsState.readOnly) {
    const detail = fatfsState.readOnlyReason || t('filesystem.readOnlyDefault');
    fatfsState.status = t('filesystem.readOnly', { fs: t('filesystem.labels.fatfs'), detail });
    showToast(fatfsState.status, { color: 'info' });
    return;
  }
  if (fatfsState.uploadBlocked) {
    fatfsState.status = fatfsState.uploadBlockedReason || t('filesystem.messages.uploadBlocked');
    if (fatfsState.uploadBlockedReason) {
      showUploadError(fatfsState.uploadBlockedReason);
    }
    return;
  }
  if (!file) {
    fatfsState.status = t('filesystem.messages.selectFile', { fs: t('filesystem.labels.fatfs') });
    showToast(fatfsState.status, { color: 'info' });
    return;
  }
  const targetName = (file.name || '').trim();
  if (!targetName) {
    fatfsState.status = t('filesystem.messages.fileNoName');
    showToast(fatfsState.status, { color: 'warning' });
    return;
  }
  try {
    fatfsState.busy = true;
    const data = new Uint8Array(await file.arrayBuffer());
    fatfsState.client.writeFile(targetName, data);
    await refreshFatfsListing();
    markFatfsDirty(t('filesystem.messages.staged', { name: targetName }));
    appendLog(
      t('filesystem.messages.stagedLog', { fs: t('filesystem.labels.fatfs'), name: targetName, size: data.length.toLocaleString() }),
      '[ESPConnect-Debug]'
    );
  } catch (error) {
    fatfsState.error = formatErrorMessage(error);
    showToast(fatfsState.error, { color: 'error' });
  } finally {
    fatfsState.busy = false;
  }
}

// Delete a FATFS file after confirmation.
async function handleFatfsDelete(name) {
  if (!fatfsState.client || fatfsState.readOnly) {
    return;
  }
  const confirmed = await showConfirmation({
    title: t('filesystem.messages.deleteTitle'),
    message: t('filesystem.messages.deleteMessage', { name, fs: t('filesystem.labels.fatfs') }),
    confirmText: t('filesystem.messages.deleteConfirm'),
    destructive: true,
  });
  if (!confirmed) {
    return;
  }
  try {
    fatfsState.busy = true;
    fatfsState.client.deleteFile(name);
    await refreshFatfsListing();
    markFatfsDirty(t('filesystem.messages.deleted', { name, fs: t('filesystem.labels.fatfs') }));
    appendLog(t('filesystem.messages.deletedLog', { fs: t('filesystem.labels.fatfs'), name }), '[ESPConnect-Debug]');
  } catch (error) {
    fatfsState.error = formatErrorMessage(error);
  } finally {
    fatfsState.busy = false;
  }
}

// Format the FATFS image and mark changes as staged.
async function handleFatfsFormat() {
  if (!fatfsState.client || fatfsState.readOnly) {
    return;
  }
  const confirmed = await showConfirmation({
    title: t('filesystem.messages.formatTitle', { fs: t('filesystem.labels.fatfs') }),
    message: t('filesystem.messages.formatMessage', { fs: t('filesystem.labels.fatfs') }),
    confirmText: t('filesystem.messages.formatConfirm'),
    destructive: true,
  });
  if (!confirmed) return;
  try {
    fatfsState.busy = true;
    fatfsState.client.format();
    await refreshFatfsListing();
    markFatfsDirty(t('filesystem.messages.formatted', { fs: t('filesystem.labels.fatfs') }));
    appendLog(t('filesystem.messages.formatLog', { fs: t('filesystem.labels.fatfs') }), '[ESPConnect-Debug]');
  } catch (error) {
    fatfsState.error = formatErrorMessage(error);
  } finally {
    fatfsState.busy = false;
  }
}

// Persist staged FATFS changes back to flash.
async function handleFatfsSave() {
  if (!fatfsState.client) {
    fatfsState.status = t('filesystem.messages.loadFirst', { fs: t('filesystem.labels.fatfs') });
    return;
  }
  if (fatfsState.readOnly) {
    const detail = fatfsState.readOnlyReason || t('filesystem.readOnlyDefault');
    fatfsState.status = t('filesystem.readOnly', { fs: t('filesystem.labels.fatfs'), detail });
    return;
  }
  if (!fatfsState.dirty) {
    fatfsState.status = t('filesystem.messages.noChanges');
    return;
  }
  if (!hasFatfsBackup()) {
    fatfsState.status = t('filesystem.messages.backupFirst', { fs: t('filesystem.labels.fatfs') });
    return;
  }
  const partition = fatfsSelectedPartition.value;
  if (!partition) {
    fatfsState.status = t('filesystem.messages.selectPartition', { fs: t('filesystem.labels.fatfs') });
    return;
  }
  const diff = computeFatfsDiff();
  const summaryParts = [];
  if (diff.added.length) summaryParts.push(t('filesystem.messages.diffAdded', { list: diff.added.join(', ') }));
  if (diff.modified.length) summaryParts.push(t('filesystem.messages.diffModified', { list: diff.modified.join(', ') }));
  if (diff.removed.length) summaryParts.push(t('filesystem.messages.diffRemoved', { list: diff.removed.join(', ') }));
  const summary =
    summaryParts.length > 0
      ? summaryParts.join('\n')
      : t('filesystem.messages.diffNone');
  const confirmed = await showConfirmation({
    title: t('filesystem.messages.writeTitle', { fs: t('filesystem.labels.fatfs') }),
    message: t('filesystem.messages.writeMessage', { summary }),
    confirmText: t('filesystem.messages.writeConfirm'),
    destructive: true,
  });
  if (!confirmed) return;
  try {
    fatfsState.saving = true;
    maintenanceBusy.value = true;
    fatfsSaveDialog.visible = true;
    const image = await Promise.resolve(fatfsState.client.toImage());
    if (image.length > partition.size) {
      throw new Error(t('filesystem.messages.imageTooLarge', { fs: t('filesystem.labels.fatfs') }));
    }
    await writeFilesystemImage(partition, image, {
      label: t('filesystem.labels.fatfs'),
      state: fatfsState,
      onProgress: progress => {
        fatfsSaveDialog.value = progress.value ?? 0;
        fatfsSaveDialog.label = progress.label || t('filesystem.messages.saveStatusLabel', { fs: t('filesystem.labels.fatfs') });
      },
    });
    fatfsState.dirty = false;
    fatfsState.status = t('filesystem.messages.saveStatus', { fs: t('filesystem.labels.fatfs') });
    appendLog(t('filesystem.messages.saveLog', { fs: t('filesystem.labels.fatfs') }), '[ESPConnect-Debug]');
    await loadFatfsPartition(partition);
  } catch (error) {
    fatfsState.error = formatErrorMessage(error);
    fatfsState.status = t('filesystem.messages.saveFailed', { fs: t('filesystem.labels.fatfs') });
  } finally {
    fatfsState.saving = false;
    maintenanceBusy.value = false;
    fatfsSaveDialog.visible = false;
    fatfsSaveDialog.value = 0;
    fatfsSaveDialog.label = t('filesystem.messages.savingLabel', { fs: t('filesystem.labels.fatfs') });
  }
}

// Read a FATFS file and return its raw bytes.
async function readFatfsFile(name) {
  if (!fatfsState.client) {
    throw new Error(t('filesystem.messages.fatfsUnavailable'));
  }
  if (!name) {
    throw new Error(t('filesystem.messages.filenameRequired'));
  }
  const reader =
    typeof fatfsState.client.readFile === 'function'
      ? fatfsState.client.readFile
      : typeof fatfsState.client.read === 'function'
        ? fatfsState.client.read
        : null;
  if (!reader) {
    throw new Error(t('filesystem.messages.fatfsReadUnsupported'));
  }
  const result = reader.call(fatfsState.client, name);
  const data = result instanceof Promise ? await result : result;
  if (!(data instanceof Uint8Array)) {
    throw new Error(t('filesystem.messages.fatfsReadUnexpected'));
  }
  return data;
}

// Download a FATFS file to the host.
async function handleFatfsDownloadFile(name) {
  if (!fatfsState.client || !name) return;
  try {
    const data = await readFatfsFile(name);
    saveBinaryFile(name, data);
    appendLog(
      t('filesystem.messages.downloadedLog', {
        fs: t('filesystem.labels.fatfs'),
        name,
        bytes: data.length.toLocaleString(),
      }),
      '[ESPConnect-Debug]'
    );
  } catch (error) {
    fatfsState.error = formatErrorMessage(error);
    fatfsState.status = t('filesystem.messages.downloadFailed', { fs: t('filesystem.labels.fatfs') });
  }
}

// Preview a FATFS file using the SPIFFS viewer dialog.
async function handleFatfsView(name) {
  if (!fatfsState.client) return;
  const viewInfo = resolveSpiffsViewInfo(name);
  if (!viewInfo) {
    fatfsState.status = t('filesystem.messages.unsupportedPreview');
    showToast(fatfsState.status, { color: 'info' });
    return;
  }
  resetViewerMedia();
  spiffsViewerDialog.visible = true;
  spiffsViewerDialog.name = name;
  spiffsViewerDialog.loading = true;
  spiffsViewerDialog.error = null;
  spiffsViewerDialog.content = '';
  spiffsViewerDialog.mode = viewInfo.mode;
  spiffsViewerDialog.source = 'fatfs';
  try {
    const data = await readFatfsFile(name);
    if (data.length > SPIFFS_VIEWER_MAX_BYTES) {
      const limitText = formatBytes(SPIFFS_VIEWER_MAX_BYTES) ?? `${SPIFFS_VIEWER_MAX_BYTES} bytes`;
      throw new Error(t('filesystem.messages.tooLargePreview', { limit: limitText }));
    }
    if (viewInfo.mode === 'image') {
      const blob = new Blob([toArrayBuffer(data)], { type: viewInfo.mime || 'image/*' });
      spiffsViewerDialog.imageUrl = URL.createObjectURL(blob);
    } else if (viewInfo.mode === 'audio') {
      const blob = new Blob([toArrayBuffer(data)], { type: viewInfo.mime || 'audio/*' });
      spiffsViewerDialog.audioUrl = URL.createObjectURL(blob);
    } else {
      spiffsViewerDialog.content = SPIFFS_VIEWER_DECODER.decode(data);
    }
  } catch (error) {
    spiffsViewerDialog.error = formatErrorMessage(error);
    showToast(spiffsViewerDialog.error, { color: 'error' });
  } finally {
    spiffsViewerDialog.loading = false;
  }
}

// Group device facts into configured sections with a catch-all for leftovers.
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

// Human-friendly byte formatter with units.
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

// Normalize different error shapes to a readable message.
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

// Convert vendor codes into human-readable labels.
function formatVendorLabel(label) {
  if (!label) return label;
  return VENDOR_ALIASES[label] ?? label.replace(/_/g, ' ');
}

// Expand feature codes with vendor-friendly names.
function humanizeFeature(feature) {
  if (typeof feature !== 'string') return feature;
  let text = feature;
  for (const [code, friendly] of Object.entries(VENDOR_ALIASES)) {
    text = text.replace(new RegExp(code, 'g'), friendly);
  }
  return text;
}

// Build a user-facing USB bridge label from IDs.
function formatUsbBridge(info) {
  if (!info || typeof info.usbVendorId !== 'number') return null;
  const vendorHex = `0x${info.usbVendorId.toString(16).padStart(4, '0').toUpperCase()}`;
  const productHex =
    typeof info.usbProductId === 'number'
      ? `0x${info.usbProductId.toString(16).padStart(4, '0').toUpperCase()}`
      : null;
  const deviceInfo =
    typeof info.usbProductId === 'number'
      ? getUsbDeviceInfo(info.usbVendorId, info.usbProductId)
      : undefined;
  if (!deviceInfo) {
    return productHex ? `${vendorHex}:${productHex}` : vendorHex;
  }
  const parts = [];
  if (deviceInfo.vendorName) {
    parts.push(deviceInfo.vendorName);
  }
  if (deviceInfo.productName) {
    parts.push(deviceInfo.productName);
  }
  let label = parts.join(' - ');
  if (productHex) {
    label = label ? `${label} (${productHex})` : productHex;
  }
  return label || vendorHex;
}

// Trigger a binary download on the host.
function saveBinaryFile(name, data) {
  if (!data) return;
  const safeName = sanitizeFileName(name, 'download');
  const blob = new Blob([toArrayBuffer(data)], { type: 'application/octet-stream' });
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

// Reset SPIFFS state to initial defaults.
function resetSpiffsState() {
  spiffsState.selectedId = null;
  spiffsState.lastReadOffset = null;
  spiffsState.lastReadSize = 0;
  spiffsState.lastReadImage = null;
  spiffsState.client = null;
  spiffsState.files = [];
  spiffsState.status = t('filesystem.messages.loadPrompt', { fs: t('filesystem.labels.spiffs') });
  spiffsState.loading = false;
  spiffsState.busy = false;
  spiffsState.saving = false;
  spiffsState.error = null;
  spiffsState.loadCancelled = false;
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
  spiffsState.uploadBlocked = false;
  spiffsState.uploadBlockedReason = '';
}

// Update SPIFFS usage info if provided by the client.
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

// Reset LittleFS state to initial defaults.
function resetLittlefsState() {
  littlefsState.selectedId = null;
  littlefsState.lastReadOffset = null;
  littlefsState.lastReadSize = 0;
  littlefsState.lastReadImage = null;
  littlefsState.client = null;
  littlefsState.files = [];
  littlefsState.currentPath = '/';
  littlefsState.status = t('filesystem.messages.loadPrompt', { fs: t('filesystem.labels.littlefs') });
  littlefsState.loading = false;
  littlefsState.busy = false;
  littlefsState.saving = false;
  littlefsState.error = null;
  littlefsState.loadCancelled = false;
  littlefsState.readOnly = false;
  littlefsState.readOnlyReason = '';
  littlefsState.dirty = false;
  littlefsState.backupDone = false;
  littlefsState.sessionBackupDone = false;
  littlefsState.baselineFiles = [];
  littlefsState.currentPath = '/';
  littlefsState.allFiles = [];
  littlefsState.usage = {
    capacityBytes: 0,
    usedBytes: 0,
    freeBytes: 0,
  };
  littlefsState.uploadBlocked = false;
  littlefsState.uploadBlockedReason = '';
  littlefsState.blockSize = 0;
  littlefsState.blockCount = 0;
  littlefsState.currentPath = '/';
  // Ensure disk version doesn’t leak between sessions
  littlefsState.diskVersion = 0;
}

// Calculate LittleFS usage based on current entries.
function updateLittlefsUsage(partition = littlefsSelectedPartition.value) {
  const partitionSize = partition?.size ?? 0;
  const capacityBytes =
    littlefsState.blockSize && littlefsState.blockCount
      ? littlefsState.blockSize * littlefsState.blockCount
      : partitionSize;
  const source = littlefsState.allFiles?.length ? littlefsState.allFiles : littlefsState.files;
  const usedBytes = littlefsEstimateUsage(source);
  littlefsState.usage = {
    capacityBytes,
    usedBytes,
    freeBytes: Math.max(capacityBytes - usedBytes, 0),
  };
  // Update disk version from client if available
  if (littlefsState.client?.getDiskVersion) {
    littlefsState.diskVersion = littlefsState.client.getDiskVersion();
  }
}

// Reset FATFS state to initial defaults.
function resetFatfsState() {
  fatfsState.selectedId = null;
  fatfsState.lastReadOffset = null;
  fatfsState.lastReadSize = 0;
  fatfsState.lastReadImage = null;
  fatfsState.client = null;
  fatfsState.files = [];
  fatfsState.status = t('filesystem.messages.loadPrompt', { fs: t('filesystem.labels.fatfs') });
  fatfsState.loading = false;
  fatfsState.busy = false;
  fatfsState.saving = false;
  fatfsState.error = null;
  fatfsState.loadCancelled = false;
  fatfsState.readOnly = false;
  fatfsState.readOnlyReason = '';
  fatfsState.dirty = false;
  fatfsState.backupDone = false;
  fatfsState.sessionBackupDone = false;
  fatfsState.baselineFiles = [];
  fatfsState.usage = {
    capacityBytes: 0,
    usedBytes: 0,
    freeBytes: 0,
  };
  fatfsState.uploadBlocked = false;
  fatfsState.uploadBlockedReason = '';
  fatfsState.blockSize = FATFS_DEFAULT_BLOCK_SIZE;
  fatfsState.blockCount = 0;
}

// Calculate FATFS usage based on current entries.
function updateFatfsUsage(partition = fatfsSelectedPartition.value) {
  const partitionSize = partition?.size ?? fatfsState.blockSize * fatfsState.blockCount;
  const capacityBytes =
    fatfsState.blockSize && fatfsState.blockCount ? fatfsState.blockSize * fatfsState.blockCount : partitionSize;
  const usedBytes = fatfsState.files.reduce((sum, file) => sum + (file.size ?? 0), 0);
  fatfsState.usage = {
    capacityBytes,
    usedBytes,
    freeBytes: Math.max(capacityBytes - usedBytes, 0),
  };
}

// Resolve how to preview a SPIFFS/LittleFS/FATFS file by extension.
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
  if (SPIFFS_AUDIO_EXTENSIONS.includes(ext)) {
    return { mode: 'audio', ext, mime: SPIFFS_AUDIO_MIME_MAP[ext] || 'audio/*' };
  }
  return null;
}

// Tell whether a SPIFFS backup exists for this session.
function hasSpiffsBackup() {
  return Boolean(spiffsState.backupDone || spiffsState.sessionBackupDone);
}

// Normalize a Uint8Array into an ArrayBuffer slice (avoids SharedArrayBuffer typing issues).
function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  const { buffer, byteOffset, byteLength } = view;
  if (buffer instanceof ArrayBuffer) {
    return buffer.slice(byteOffset, byteOffset + byteLength);
  }
  const copy = new Uint8Array(byteLength);
  copy.set(new Uint8Array(buffer, byteOffset, byteLength));
  return copy.buffer;
}

// Ensure SPIFFS has a selected partition and is loaded when needed.
async function ensureSpiffsReady(options: EnsureFsOptions = {}) {
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

// Read SPIFFS from flash, build the client, and populate state.
async function loadSpiffsPartition(partition) {
  const fsLabel = t('filesystem.labels.spiffs');
  if (!loader.value || !partition) {
    spiffsState.error = t('filesystem.messages.connectFsFirst', { fs: fsLabel });
    return;
  }
  spiffsLoadCancelRequested.value = false;
  spiffsState.selectedId = partition.id;
  spiffsState.loading = true;
  spiffsState.error = null;
  spiffsState.readOnly = false;
  spiffsState.readOnlyReason = '';
  spiffsLoadingDialog.value = 0;
  spiffsState.loadCancelled = false;
  const spiffsBaudLabel = currentBaud.value ? ` @ ${currentBaud.value.toLocaleString()} bps` : '';
  const offsetHex = partition.offset.toString(16).toUpperCase();
  spiffsState.status = t('filesystem.messages.readingAtOffset', {
    fs: fsLabel,
    offset: offsetHex,
    baud: spiffsBaudLabel,
  });
  spiffsLoadingDialog.visible = true;
  spiffsLoadingDialog.label = t('filesystem.messages.readingLabel', {
    label: partition.label || fsLabel,
    baud: spiffsBaudLabel,
  });
  try {
    const image = await readFlashToBuffer(partition.offset, partition.size, {
      label: `${partition.label || fsLabel}${spiffsBaudLabel}`,
      cancelSignal: spiffsLoadCancelRequested,
      onProgress: progress => {
        spiffsLoadingDialog.label = progress.label;
        spiffsLoadingDialog.value = progress.value ?? 0;
      },
    });
    spiffsState.lastReadOffset = partition.offset;
    spiffsState.lastReadSize = partition.size;
    spiffsState.lastReadImage = image;
    let client;
    try {
      client = await InMemorySpiffsClient.fromImage(image);
    } catch (error) {
      spiffsState.error = formatErrorMessage(error);
      spiffsState.readOnly = true;
      spiffsState.readOnlyReason = t('filesystem.messages.readOnlyReasonEncrypted', { fs: fsLabel });
      spiffsState.status = t('filesystem.messages.readOnlySimple', { fs: fsLabel });
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
    spiffsState.status = t('filesystem.messages.loadedCount', { count });
    appendLog(
      t('filesystem.messages.loadLog', {
        fs: fsLabel,
        label: partition.label,
        count,
      }),
      '[ESPConnect-Debug]'
    );
  } catch (error) {
    const message = formatErrorMessage(error);
    if (message === FILESYSTEM_LOAD_CANCELLED_MESSAGE) {
      spiffsState.loadCancelled = true;
      spiffsState.client = null;
      spiffsState.files = [];
      spiffsState.baselineFiles = [];
      spiffsState.dirty = false;
      spiffsState.backupDone = false;
      updateSpiffsUsage();
      spiffsState.error = null;
      spiffsState.readOnly = false;
      spiffsState.readOnlyReason = '';
      spiffsState.status = t('filesystem.messages.loadCancelled', { fs: fsLabel });
      return;
    } else {
      spiffsState.loadCancelled = false;
      spiffsState.error = message;
      spiffsState.status = t('filesystem.messages.readFailed', { fs: fsLabel });
    }
  } finally {
    spiffsState.loading = false;
    spiffsLoadingDialog.visible = false;
    spiffsLoadingDialog.value = 0;
    spiffsLoadCancelRequested.value = false;
  }
}

// Refresh the SPIFFS file listing and usage.
async function refreshSpiffsListing() {
  if (!spiffsState.client) {
    return;
  }
  spiffsState.files = await spiffsState.client.list();
  updateSpiffsUsage();
}

// Mark the SPIFFS state as dirty and optionally set a status message.
function markSpiffsDirty(message) {
  spiffsState.dirty = true;
  if (message) {
    spiffsState.status = message;
  }
}

// Diff baseline vs. current SPIFFS files.
function computeSpiffsDiff() {
  return computeFileDiff(spiffsState.baselineFiles, spiffsState.files);
}

// Build file diff summary between two file lists.
function computeFileDiff(baselineFiles = [], currentFiles = []) {
  const baselineMap = new Map(baselineFiles.map(file => [(file.path || file.name), file.size]));
  const currentMap = new Map(currentFiles.map(file => [(file.path || file.name), file.size]));
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

// Diff baseline vs. current LittleFS files.
function computeLittlefsDiff() {
  return computeFileDiff(littlefsState.baselineFiles, littlefsState.files);
}

// Diff baseline vs. current FATFS files.
function computeFatfsDiff() {
  return computeFileDiff(fatfsState.baselineFiles, fatfsState.files);
}

// Select a SPIFFS partition and trigger a load.
async function handleSelectSpiffsPartition(partitionId) {
  if (spiffsState.loading || spiffsState.busy || spiffsState.saving) {
    return;
  }
  const fsLabel = t('filesystem.labels.spiffs');
  spiffsState.selectedId = partitionId;
  spiffsState.client = null;
  spiffsState.files = [];
  spiffsState.status = t('filesystem.messages.loading', { fs: fsLabel });
  const partition =
    spiffsPartitions.value.find(entry => entry.id === partitionId) ?? spiffsPartitions.value[0];
  if (partition) {
    await loadSpiffsPartition(partition);
  }
}

// Reload the active SPIFFS partition.
async function handleRefreshSpiffs() {
  const partition = spiffsSelectedPartition.value;
  if (!partition) {
    return;
  }
  await loadSpiffsPartition(partition);
}

// Download a SPIFFS backup image for the selected partition.
async function handleSpiffsBackup() {
  const partition = spiffsSelectedPartition.value;
  if (!partition) {
    spiffsState.status = t('filesystem.messages.selectPartition', { fs: t('filesystem.labels.spiffs') });
    return;
  }
  if (!loader.value) {
    spiffsState.status = t('filesystem.messages.connectFsFirst', { fs: t('filesystem.labels.spiffs') });
    return;
  }
  const fsLabel = t('filesystem.labels.spiffs');
  spiffsBackupDialog.visible = true;
  spiffsBackupDialog.value = 0;
  spiffsBackupDialog.label = t('filesystem.messages.backupLabel', { fs: fsLabel });
  try {
    const baseLabel = `${partition.label || 'spiffs'}_${partition.offset.toString(16)}`;
    const safeBase = sanitizeFileName(baseLabel, 'spiffs');
    const stampedName = `${safeBase}_${formatBackupTimestamp()}.bin`;
    const cachedImage =
      spiffsState.lastReadImage &&
      spiffsState.lastReadOffset === partition.offset &&
      spiffsState.lastReadSize === partition.size
        ? spiffsState.lastReadImage
        : null;
    if (cachedImage) {
      spiffsBackupDialog.value = 100;
      spiffsBackupDialog.label = 'Saving backup from cached SPIFFS image...';
      saveBinaryFile(stampedName, cachedImage);
    } else {
      await downloadFlashRegion(partition.offset, partition.size, {
        label: `${partition.label} SPIFFS`,
        fileName: stampedName,
        suppressStatus: true,
        onProgress: progress => {
          spiffsBackupDialog.value = progress.value ?? 0;
          spiffsBackupDialog.label = progress.label || 'Backing up SPIFFS...';
        },
      });
    }
    spiffsState.backupDone = true;
    spiffsState.sessionBackupDone = true;
    spiffsState.status = t('filesystem.messages.backupComplete', { fs: fsLabel });
    appendLog(t('filesystem.messages.backupLog', { fs: fsLabel }), '[ESPConnect-Debug]');
  } catch (error) {
    const message = formatErrorMessage(error);
    if (message === 'Download cancelled by user') {
      spiffsState.error = null;
      spiffsState.status = t('filesystem.messages.backupCancelled', { fs: fsLabel });
    } else {
      spiffsState.error = message;
      spiffsState.status = t('filesystem.messages.backupFailed', { fs: fsLabel });
    }
  } finally {
    spiffsBackupDialog.visible = false;
    spiffsBackupDialog.value = 0;
    spiffsBackupDialog.label = '';
  }
}

// Restore a SPIFFS image to the selected partition.
async function handleSpiffsRestore(file) {
  const partition = spiffsSelectedPartition.value;
  if (!partition) return;
  if (!file) return;
  const fsLabel = t('filesystem.labels.spiffs');
  const buffer = new Uint8Array(await file.arrayBuffer());
  if (buffer.length !== partition.size) {
    spiffsState.status = t('filesystem.messages.restoreSizeMismatch', {
      size: formatBytes(partition.size) ?? `${partition.size} bytes`,
    });
    return;
  }
  const confirmed = await showConfirmation({
    title: t('filesystem.messages.restoreTitle', { fs: fsLabel }),
    message: t('filesystem.messages.restoreMessage', { fs: fsLabel }),
    confirmText: t('filesystem.messages.restoreConfirm'),
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
    spiffsRestoreDialog.label = t('filesystem.messages.restoreLabel', { fs: fsLabel });
    await writeFilesystemImage(partition, buffer, {
      label: fsLabel,
      state: spiffsState,
      onProgress: progress => {
        spiffsRestoreDialog.value = progress.value ?? 0;
        spiffsRestoreDialog.label = progress.label || t('filesystem.messages.restoreLabel', { fs: fsLabel });
      },
    });
    spiffsState.status = t('filesystem.messages.restoreStatus', { fs: fsLabel });
    spiffsState.backupDone = true;
    appendLog(t('filesystem.messages.restoreLog', { fs: fsLabel }), '[ESPConnect-Debug]');
    await loadSpiffsPartition(partition);
  } catch (error) {
    spiffsState.error = formatErrorMessage(error);
    spiffsState.status = t('filesystem.messages.restoreFailed', { fs: fsLabel });
  } finally {
    spiffsState.saving = false;
    maintenanceBusy.value = false;
    spiffsRestoreDialog.visible = false;
    spiffsRestoreDialog.value = 0;
    spiffsRestoreDialog.label = t('filesystem.messages.restoreLabel', { fs: fsLabel });
  }
}

// Download a SPIFFS file to the host.
async function handleSpiffsDownloadFile(name) {
  if (!spiffsState.client) return;
  try {
    const data = await spiffsState.client.read(name);
    saveBinaryFile(name, data);
    appendLog(
      t('filesystem.messages.downloadedLog', {
        fs: t('filesystem.labels.spiffs'),
        name,
        bytes: data.length.toLocaleString(),
      }),
      '[ESPConnect-Debug]'
    );
  } catch (error) {
    spiffsState.error = formatErrorMessage(error);
  }
}

// Validate a selected file before queueing a SPIFFS upload.
function handleSpiffsUploadSelection(file) {
  if (!file || !spiffsState.client) {
    spiffsState.uploadBlocked = false;
    spiffsState.uploadBlockedReason = '';
    return;
  }
  const fsLabel = t('filesystem.labels.spiffs');
  const targetName = (file.name || '').trim();
  if (!targetName) {
    const message = t('filesystem.messages.filenameRequired');
    spiffsState.uploadBlocked = true;
    spiffsState.uploadBlockedReason = message;
    showUploadError(message);
    return;
  }
  if (targetName.length > SPIFFS_MAX_FILENAME_LENGTH) {
    const message = t('filesystem.messages.filenameTooLong', {
      fs: fsLabel,
      limit: SPIFFS_MAX_FILENAME_LENGTH,
    });
    spiffsState.uploadBlocked = true;
    spiffsState.uploadBlockedReason = message;
    showUploadError(message);
    return;
  }
  if (
    typeof spiffsState.client.canFit === 'function' &&
    !spiffsState.client.canFit(targetName, file.size ?? 0)
  ) {
    const message = t('filesystem.messages.spaceError', { fs: fsLabel });
    spiffsState.uploadBlocked = true;
    spiffsState.uploadBlockedReason = message;
    showUploadError(message);
    return;
  }
  spiffsState.uploadBlocked = false;
  spiffsState.uploadBlockedReason = '';
}

// Check if a file extension can be previewed.
function isViewableSpiffsFile(name = '') {
  return Boolean(resolveSpiffsViewInfo(name));
}

// Revoke any object URLs used in the viewer.
function resetViewerMedia() {
  if (spiffsViewerDialog.imageUrl) {
    URL.revokeObjectURL(spiffsViewerDialog.imageUrl);
  }
  if (spiffsViewerDialog.audioUrl) {
    URL.revokeObjectURL(spiffsViewerDialog.audioUrl);
  }
  spiffsViewerDialog.imageUrl = '';
  spiffsViewerDialog.audioUrl = '';
}

// Surface upload-related errors through the toast and dialog.
function showUploadError(message) {
  showToast(message || t('filesystem.messages.uploadSpaceGeneric', { fs: t('filesystem.labels.filesystem') }), {
    color: 'error',
    timeout: 6000,
  });
}

// Show a transient toast message.
type ToastOptions = {
  color?: string;
  timeout?: number;
};

// Show a transient toast message.
function showToast(message: string, options: ToastOptions = {}) {
  toast.message = message;
  toast.color = options.color || 'warning';
  toast.timeout = options.timeout ?? 4000;
  toast.visible = true;
}

// Preview a SPIFFS file using the viewer dialog.
async function handleSpiffsView(name) {
  if (!spiffsState.client) return;
  const viewInfo = resolveSpiffsViewInfo(name);
  if (!viewInfo) {
    spiffsState.status = t('filesystem.messages.unsupportedPreview');
    showToast(spiffsState.status, { color: 'info' });
    return;
  }
  resetViewerMedia();
  spiffsViewerDialog.visible = true;
  spiffsViewerDialog.name = name;
  spiffsViewerDialog.loading = true;
  spiffsViewerDialog.error = null;
  spiffsViewerDialog.content = '';
  spiffsViewerDialog.mode = viewInfo.mode;
  spiffsViewerDialog.source = 'spiffs';
  try {
    const data = await spiffsState.client.read(name);
    if (data.length > SPIFFS_VIEWER_MAX_BYTES) {
      const limitText = formatBytes(SPIFFS_VIEWER_MAX_BYTES) ?? `${SPIFFS_VIEWER_MAX_BYTES} bytes`;
      throw new Error(t('filesystem.messages.tooLargePreview', { limit: limitText }));
    }
    if (viewInfo.mode === 'image') {
      const blob = new Blob([data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)], { type: viewInfo.mime || 'image/*' });
      spiffsViewerDialog.imageUrl = URL.createObjectURL(blob);
    } else if (viewInfo.mode === 'audio') {
      const blob = new Blob([data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)], { type: viewInfo.mime || 'audio/*' });
      spiffsViewerDialog.audioUrl = URL.createObjectURL(blob);
    } else {
      spiffsViewerDialog.content = SPIFFS_VIEWER_DECODER.decode(data);
    }
  } catch (error) {
    spiffsViewerDialog.error = formatErrorMessage(error);
  } finally {
    spiffsViewerDialog.loading = false;
  }
}

// Close the filesystem viewer dialog and clear media.
function closeSpiffsViewer() {
  resetViewerMedia();
  spiffsViewerDialog.visible = false;
  spiffsViewerDialog.name = '';
  spiffsViewerDialog.content = '';
  spiffsViewerDialog.error = null;
  spiffsViewerDialog.loading = false;
  spiffsViewerDialog.mode = null;
  spiffsViewerDialog.source = 'spiffs';
}

// Download the file currently displayed in the viewer.
function handleFilesystemViewerDownload() {
  if (!spiffsViewerDialog.name) {
    return;
  }
  if (spiffsViewerDialog.source === 'littlefs') {
    void handleLittlefsDownloadFile(spiffsViewerDialog.name);
  } else if (spiffsViewerDialog.source === 'fatfs') {
    void handleFatfsDownloadFile(spiffsViewerDialog.name);
  } else {
    void handleSpiffsDownloadFile(spiffsViewerDialog.name);
  }
}

// Cancel an in-progress SPIFFS backup download.
function cancelSpiffsBackup() {
  if (!spiffsBackupDialog.visible) {
    return;
  }
  spiffsBackupDialog.label = t('filesystem.messages.backupStopping');
  handleCancelDownload();
}

// Request cancellation of an in-progress SPIFFS load.
function cancelSpiffsLoad() {
  if (!spiffsLoadingDialog.visible || spiffsLoadCancelRequested.value) {
    return;
  }
  spiffsLoadCancelRequested.value = true;
  spiffsLoadingDialog.label = t('filesystem.messages.loadStopping', {
    fs: t('filesystem.labels.spiffs'),
  });
}

// Upload a file to SPIFFS with size checks and staging.
async function handleSpiffsUpload({ file }) {
  if (!spiffsState.client) return;
  const fsLabel = t('filesystem.labels.spiffs');
  if (spiffsState.readOnly) {
    const detail = spiffsState.readOnlyReason || t('filesystem.readOnlyDefault');
    spiffsState.status = t('filesystem.readOnly', { fs: fsLabel, detail });
    showToast(spiffsState.status, { color: 'info' });
    return;
  }
  if (spiffsState.uploadBlocked) {
    spiffsState.status = spiffsState.uploadBlockedReason || t('filesystem.messages.uploadBlocked');
    if (spiffsState.uploadBlockedReason) {
      showUploadError(spiffsState.uploadBlockedReason);
    }
    return;
  }
  if (!file) {
    spiffsState.status = t('filesystem.messages.selectFile', { fs: fsLabel });
    showToast(spiffsState.status, { color: 'info' });
    return;
  }
  const targetName = (file.name || '').trim();
  if (!targetName) {
    spiffsState.status = t('filesystem.messages.fileNoName');
    showToast(spiffsState.status, { color: 'warning' });
    return;
  }
  try {
    spiffsState.busy = true;
    const data = new Uint8Array(await file.arrayBuffer());
    await spiffsState.client.write(targetName, data);
    await refreshSpiffsListing();
    markSpiffsDirty(t('filesystem.messages.staged', { name: targetName }));
    appendLog(
      t('filesystem.messages.stagedLog', {
        fs: fsLabel,
        name: targetName,
        size: data.length.toLocaleString(),
      }),
      '[ESPConnect-Debug]'
    );
    spiffsState.uploadBlocked = false;
    spiffsState.uploadBlockedReason = '';
  } catch (error) {
    const isSpaceError = typeof error?.message === 'string' && error.message.includes('Not enough SPIFFS space');
    const isNameTooLong = typeof error?.message === 'string' && error.message.includes('File name too long');
    const friendly = isSpaceError
      ? t('filesystem.messages.spaceError', { fs: fsLabel })
      : formatErrorMessage(error);
    if (!isNameTooLong) {
      spiffsState.status = friendly || t('filesystem.messages.uploadFailed', { fs: fsLabel });
    }
    if (!isSpaceError && !isNameTooLong) {
      spiffsState.error = friendly;
    }
    if (isSpaceError || isNameTooLong) {
      showUploadError(friendly);
    } else {
      showToast(friendly || t('filesystem.messages.uploadFailed', { fs: fsLabel }), { color: 'error' });
    }
  } finally {
    spiffsState.busy = false;
  }
}

// Delete a SPIFFS file after confirmation.
async function handleSpiffsDelete(name) {
  if (!spiffsState.client || spiffsState.readOnly) {
    return;
  }
  const fsLabel = t('filesystem.labels.spiffs');
  const confirmed = await showConfirmation({
    title: t('filesystem.messages.deleteTitle'),
    message: t('filesystem.messages.deleteMessage', { name, fs: fsLabel }),
    confirmText: t('filesystem.messages.deleteConfirm'),
    destructive: true,
  });
  if (!confirmed) {
    return;
  }
  try {
    spiffsState.busy = true;
    await spiffsState.client.remove(name);
    await refreshSpiffsListing();
    markSpiffsDirty(t('filesystem.messages.deleted', { name, fs: fsLabel }));
    appendLog(t('filesystem.messages.deletedLog', { fs: fsLabel, name }), '[ESPConnect-Debug]');
  } catch (error) {
    spiffsState.error = formatErrorMessage(error);
  } finally {
    spiffsState.busy = false;
  }
}

// Format the SPIFFS image and mark changes as staged.
async function handleSpiffsFormat() {
  if (!spiffsState.client || spiffsState.readOnly) {
    return;
  }
  const fsLabel = t('filesystem.labels.spiffs');
  const confirmed = await showConfirmation({
    title: t('filesystem.messages.formatTitle', { fs: fsLabel }),
    message: t('filesystem.messages.formatMessage', { fs: fsLabel }),
    confirmText: t('filesystem.messages.formatConfirm'),
    destructive: true,
  });
  if (!confirmed) return;
  try {
    spiffsState.busy = true;
    await spiffsState.client.format();
    await refreshSpiffsListing();
    markSpiffsDirty(t('filesystem.messages.formatted', { fs: fsLabel }));
    appendLog(t('filesystem.messages.formatLog', { fs: fsLabel }), '[ESPConnect-Debug]');
  } catch (error) {
    spiffsState.error = formatErrorMessage(error);
  } finally {
    spiffsState.busy = false;
  }
}

// Persist staged SPIFFS changes back to flash.
async function handleSpiffsSave() {
  if (!spiffsState.client) {
    spiffsState.status = t('filesystem.messages.loadFirst', { fs: t('filesystem.labels.spiffs') });
    return;
  }
  if (spiffsState.readOnly) {
    const detail = spiffsState.readOnlyReason || t('filesystem.readOnlyDefault');
    spiffsState.status = t('filesystem.readOnly', {
      fs: t('filesystem.labels.spiffs'),
      detail,
    });
    return;
  }
  if (!spiffsState.dirty) {
    spiffsState.status = t('filesystem.messages.noChanges');
    return;
  }
  if (!hasSpiffsBackup()) {
    spiffsState.status = t('filesystem.messages.backupFirst', { fs: t('filesystem.labels.spiffs') });
    return;
  }
  const partition = spiffsSelectedPartition.value;
  if (!partition) {
    spiffsState.status = t('filesystem.messages.selectPartition', { fs: t('filesystem.labels.spiffs') });
    return;
  }
  const fsLabel = t('filesystem.labels.spiffs');
  const diff = computeSpiffsDiff();
  const summaryParts = [];
  if (diff.added.length) summaryParts.push(t('filesystem.messages.diffAdded', { list: diff.added.join(', ') }));
  if (diff.modified.length) summaryParts.push(t('filesystem.messages.diffModified', { list: diff.modified.join(', ') }));
  if (diff.removed.length) summaryParts.push(t('filesystem.messages.diffRemoved', { list: diff.removed.join(', ') }));
  const summary = summaryParts.length > 0 ? summaryParts.join('\n') : t('filesystem.messages.diffNone');
  const confirmed = await showConfirmation({
    title: t('filesystem.messages.writeTitle', { fs: fsLabel }),
    message: t('filesystem.messages.writeMessage', { summary }),
    confirmText: t('filesystem.messages.writeConfirm'),
    destructive: true,
  });
  if (!confirmed) return;
  try {
    spiffsState.saving = true;
    maintenanceBusy.value = true;
    spiffsSaveDialog.visible = true;
    const image = await spiffsState.client.toImage();
    if (image.length > partition.size) {
      throw new Error(t('filesystem.messages.imageTooLarge', { fs: fsLabel }));
    }
    await writeFilesystemImage(partition, image, {
      label: fsLabel,
      state: spiffsState,
      onProgress: progress => {
        spiffsSaveDialog.value = progress.value ?? 0;
        spiffsSaveDialog.label = progress.label || t('filesystem.messages.saveStatusLabel', { fs: fsLabel });
      },
    });
    spiffsState.dirty = false;
    spiffsState.status = t('filesystem.messages.saveStatus', { fs: fsLabel });
    appendLog(t('filesystem.messages.saveLog', { fs: fsLabel }), '[ESPConnect-Debug]');
    await loadSpiffsPartition(partition);
  } catch (error) {
    spiffsState.error = formatErrorMessage(error);
    spiffsState.status = t('filesystem.messages.saveFailed', { fs: fsLabel });
  } finally {
    spiffsState.saving = false;
    maintenanceBusy.value = false;
    spiffsSaveDialog.visible = false;
    spiffsSaveDialog.value = 0;
    spiffsSaveDialog.label = t('filesystem.messages.savingLabel', { fs: fsLabel });
  }
}

type WriteFilesystemProgress = { value?: number; label?: string; written: number; total: number };
type WriteFilesystemOptions = {
  onProgress?: (progress: WriteFilesystemProgress) => void;
  label?: string;
  state?: { status?: string };
  compress?: boolean;
};

type EnsureFsOptions = {
  force?: boolean;
};

type ReadFlashOptions = {
  label?: string;
  cancelSignal?: { value?: boolean };
  onProgress?: (progress: WriteFilesystemProgress) => void;
};

type SetBaudOptions = {
  remember?: boolean;
  log?: boolean;
  updateDropdown?: boolean;
};

type ConfirmationOptions = {
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
};

type LoadAppMetadataOptions = {
  force?: boolean;
};

type ResetOptions = {
  silent?: boolean;
};

type StopMonitorOptions = {
  closeConnection?: boolean;
};

type BaudRate = (typeof SUPPORTED_BAUDRATES)[number];

type DownloadFlashOptions = {
  label?: string;
  fileName?: string;
  suppressStatus?: boolean;
  onProgress?: (progress: WriteFilesystemProgress) => void;
};

type DownloadFlashPayload = {
  mode: string;
  partition?: any;
  partitions?: any[];
  offset?: number;
  length?: number;
  label?: string;
  fileName?: string;
};

type CancelDownloadOptions = {
  label?: string;
};

// Write a filesystem image to flash with progress callbacks.
async function writeFilesystemImage(partition: any, image: Uint8Array, options: WriteFilesystemOptions = {}) {
  const { onProgress, label = t('filesystem.labels.filesystem'), state, compress = true } = options;
  if (!loader.value) {
    throw new Error(t('filesystem.messages.connectFirst'));
  }
  await loader.value.flashData(
    toArrayBuffer(image),
    (written, total) => {
      const progressValue = total ? Math.min(100, Math.floor((written / total) * 100)) : 0;
      const writtenLabel = written.toLocaleString();
      const totalLabel = Number.isFinite(total) ? total.toLocaleString() : '0';
      const statusLabel = t('filesystem.messages.writeStatus', {
        fs: label,
        written: writtenLabel,
        total: totalLabel,
      });
      if (state) {
        state.status = statusLabel;
      }
      onProgress?.({
        value: progressValue,
        label: statusLabel,
        written,
        total,
      });
    },
    partition.offset,
    compress
  );
}

const FILESYSTEM_LOAD_CANCELLED_MESSAGE = 'Filesystem load cancelled by user';
const FLASH_READ_MAX_CHUNK = 0x10000;
const FLASH_READ_MIN_CHUNK = 0x1000;

// Read a region of flash into a buffer with chunked progress reporting.
async function readFlashToBuffer(offset: number, length: number, options: ReadFlashOptions = {}) {
  if (!loader.value) {
    throw new Error(t('flashDownload.connectFirst'));
  }
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new Error(t('flashDownload.offsetInvalid'));
  }
  if (!Number.isSafeInteger(length) || length <= 0) {
    throw new Error(t('flashDownload.lengthInvalid'));
  }
  const cancelSignal = options.cancelSignal;
  const label = options.label || t('filesystem.labels.filesystem');
  const chunkBuffers = [];
  const chunkSize = Math.max(FLASH_READ_MIN_CHUNK, Math.min(FLASH_READ_MAX_CHUNK, length));
  let totalReceived = 0;
  while (totalReceived < length) {
    if (cancelSignal?.value) {
      throw new Error(FILESYSTEM_LOAD_CANCELLED_MESSAGE);
    }
    const remaining = length - totalReceived;
    const currentChunkSize = Math.min(chunkSize, remaining);
    const chunkOffset = offset + totalReceived;
    const chunkBase = totalReceived;
    const chunk = await loader.value.readFlash(
      chunkOffset,
      currentChunkSize,
      (_packet, received) => {
        const chunkReceived = Math.min(received, currentChunkSize);
        const overallReceived = chunkBase + chunkReceived;
        const progressValue = length ? Math.min(100, Math.floor((overallReceived / length) * 100)) : 0;
        const writtenLabel = overallReceived.toLocaleString();
        const totalLabel = length.toLocaleString();
        let progressLabel = t('filesystem.messages.readProgress', {
          label,
          written: writtenLabel,
          total: totalLabel,
        });
        if (cancelSignal?.value) {
          progressLabel = t('filesystem.messages.readStopping', {
            label,
            written: writtenLabel,
            total: totalLabel,
          });
        }
        if (typeof options.onProgress === 'function') {
          options.onProgress({
            value: progressValue,
            label: progressLabel,
            written: overallReceived,
            total: length,
          });
        }
      }
    );
    chunkBuffers.push(chunk);
    totalReceived += chunk.length;
  }
  if (cancelSignal?.value) {
    throw new Error(FILESYSTEM_LOAD_CANCELLED_MESSAGE);
  }
  if (chunkBuffers.length === 1) {
    return chunkBuffers[0];
  }
  const buffer = new Uint8Array(totalReceived);
  let writeOffset = 0;
  for (const chunk of chunkBuffers) {
    buffer.set(chunk, writeOffset);
    writeOffset += chunk.length;
  }
  return buffer;
}

// Map chip package codes to human-friendly labels.
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

// Build a revision label from chip revision or version numbers.
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

// Strip a keyword from an embedded feature string.
function cleanEmbeddedFeature(feature, keyword) {
  const match = feature.match(new RegExp(`${keyword}\\s*(.*)`, 'i'));
  if (match && match[1]) {
    return match[1].trim();
  }
  return feature.replace(new RegExp(keyword, 'i'), '').trim() || feature.trim();
}

// Resolve embedded flash capacity and vendor from chip metadata.
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

// Extract CPU frequency from a list of feature strings.
function extractCpuFrequency(featureList) {
  if (!Array.isArray(featureList)) return null;
  for (const feature of featureList) {
    if (!feature) continue;
    const match = String(feature).match(/(\d+)\s*mhz/i);
    if (match) {
      return `${match[1]} MHz`;
    }
  }
  return null;
}

// Extract core count from a list of feature strings.
function extractCoreCount(featureList) {
  if (!Array.isArray(featureList)) return null;
  for (const feature of featureList) {
    if (!feature) continue;
    const normalized = String(feature).toLowerCase();
    if (normalized.includes('single core')) {
      return '1 (Single)';
    }
    if (normalized.includes('dual core')) {
      return '2 (Dual)';
    }
    if (normalized.includes('quad core')) {
      return '4 (Quad)';
    }
  }
  return null;
}

// Resolve embedded PSRAM capacity and vendor from chip metadata.
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
const selectedBaud = ref<BaudRate>(DEFAULT_FLASH_BAUD as BaudRate);
const baudrateOptions = SUPPORTED_BAUDRATES;
const flashOffset = ref('0x0');
const eraseFlash = ref(false);
const higherBaudrateAvailable = ref(false);
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
const {
  spiffsState,
  spiffsLoadCancelRequested,
  spiffsBackupDialog,
  spiffsLoadingDialog,
  spiffsSaveDialog,
  spiffsRestoreDialog,
  spiffsViewerDialog,
} = useSpiffsManager();
const {
  littlefsState,
  littlefsLoadCancelRequested,
  littlefsBackupDialog,
  littlefsLoadingDialog,
  littlefsSaveDialog,
  littlefsRestoreDialog,
} = useLittlefsManager(LITTLEFS_DEFAULT_BLOCK_SIZE);
let littlefsUploadQueue = Promise.resolve();
const {
  fatfsState,
  fatfsLoadCancelRequested,
  fatfsBackupDialog,
  fatfsLoadingDialog,
  fatfsSaveDialog,
  fatfsRestoreDialog,
} = useFatfsManager(FATFS_DEFAULT_BLOCK_SIZE);
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
const appActiveSummary = ref(t('apps.activeSlotUnknown'));
const appMetadataLoaded = ref(false);
const { connectDialog, toast } = useDialogs();
let connectDialogTimer = null;
const spiffsPartitions = computed(() =>
  partitionTable.value
    .filter(
      entry =>
        entry &&
        typeof entry.type === 'number' &&
        typeof entry.subtype === 'number' &&
        entry.type === 0x01 &&
        entry.subtype === 0x82 &&
        // Show only partitions that are NOT detected as LittleFS
        entry.detectedFilesystem !== 'littlefs',
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

const littleFsPartitions = computed(() =>
  partitionTable.value
    .filter(entry => {
      if (!entry || typeof entry.type !== 'number' || typeof entry.subtype !== 'number') {
        return false;
      }
      if (entry.type !== 0x01) {
        return false;
      }
      // LittleFS: dedicated subtype 0x83 OR 0x82 with detected LittleFS
      return entry.subtype === 0x83 ||
        (entry.subtype === 0x82 && entry.detectedFilesystem === 'littlefs');
    })
    .map(entry => ({
      id: entry.offset,
      label: entry.label?.trim() || 'LittleFS',
      offset: entry.offset,
      size: entry.size,
      sizeText: formatBytes(entry.size) ?? `${entry.size} bytes`,
    })),
);
const littleFsAvailable = computed(() => littleFsPartitions.value.length > 0);
const littlefsVisibleFiles = computed(() => {
  const base = normalizeFsPath(littlefsState.currentPath || '/');
  return littlefsState.files.filter(entry => isDirectChildPath(entry.path, base));
});
const fatfsPartitions = computed(() =>
  partitionTable.value
    .filter(entry => {
      if (!entry || typeof entry.type !== 'number' || typeof entry.subtype !== 'number') {
        return false;
      }
      if (entry.type !== 0x01) {
        return false;
      }
      const label = entry.label?.toLowerCase().trim() || '';
      return entry.subtype === 0x81 || label.includes('fat');
    })
    .map(entry => ({
      id: entry.offset,
      label: entry.label?.trim() || 'FATFS',
      offset: entry.offset,
      size: entry.size,
      sizeText: formatBytes(entry.size) ?? `${entry.size} bytes`,
    })),
);
const fatfsAvailable = computed(() => fatfsPartitions.value.length > 0);
const littlefsSelectedPartition = computed(() =>
  littleFsPartitions.value.find(partition => partition.id === littlefsState.selectedId) ?? null,
);
const hasLittlefsPartitionSelected = computed(() => Boolean(littlefsSelectedPartition.value));
const fatfsSelectedPartition = computed(() =>
  fatfsPartitions.value.find(partition => partition.id === fatfsState.selectedId) ?? null,
);
const hasFatfsPartitionSelected = computed(() => Boolean(fatfsSelectedPartition.value));
const logBuffer = ref('');
const monitorText = ref('');
const monitorActive = ref(false);
const monitorError = ref(null);
const monitorAbortController = ref(null);
const serialMonitorClosedPrompt = ref(false);
const maintenanceNavigationLocked = computed(() => monitorActive.value);
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
const transport = ref<CompatibleTransport | null>(null);
const loader = ref<CompatibleLoader | null>(null);
const firmwareBuffer = ref(null);
const firmwareName = ref('');
const chipDetails = ref(null);
const partitionFlashSizeLabel = computed(() => chipDetails.value?.flashSize ?? null);
const partitionTable = ref([]);
const activeTab = ref('info');
const sessionLogRef = ref(null);
const navigationItems = computed(() => [
  { title: t('nav.deviceInfo'), value: 'info', icon: 'mdi-information-outline', disabled: false },
  { title: t('nav.partitions'), value: 'partitions', icon: 'mdi-table', disabled: !connected.value },
  {
    title: t('nav.apps'),
    value: 'apps',
    icon: 'mdi-application',
    disabled: !connected.value || maintenanceNavigationLocked.value,
  },
  {
    title: t('nav.spiffsTools'),
    value: 'spiffs',
    icon: 'mdi-folder-wrench',
    disabled:
      !connected.value || !spiffsAvailable.value || maintenanceNavigationLocked.value,
  },
  {
    title: t('nav.littlefsTools'),
    value: 'littlefs',
    icon: 'mdi-alpha-l-circle-outline',
    disabled:
      !connected.value || !littleFsAvailable.value || maintenanceNavigationLocked.value,
  },
  {
    title: t('nav.fatfsTools'),
    value: 'fatfs',
    icon: 'mdi-alpha-f-circle-outline',
    disabled:
      !connected.value || !fatfsAvailable.value || maintenanceNavigationLocked.value,
  },
  {
    title: t('nav.flashTools'),
    value: 'flash',
    icon: 'mdi-chip',
    disabled: !connected.value || maintenanceNavigationLocked.value,
  },
  { title: t('nav.serialMonitor'), value: 'console', icon: 'mdi-console-line', disabled: false },
  { title: t('nav.sessionLog'), value: 'log', icon: 'mdi-clipboard-text-outline', disabled: false },
  {
    title: t('nav.about'),
    value: 'about',
    icon: 'mdi-information-box-outline',
    disabled: false,
  },
]);

watch(
  activeTab,
  value => {
    if (value === 'log') {
      sessionLogRef.value?.scrollToBottom?.();
    }
  }
);

const resourceLinks = [
  {
    title: t('resources.tutorial'),
    href: 'https://youtu.be/-nhDKzBxHiI',
    icon: 'mdi-youtube',
  },
  {
    title: t('resources.buyCoffee'),
    href: 'https://buymeacoffee.com/thelastoutpostworkshop',
    icon: 'mdi-coffee',
  },
  {
    title: t('resources.getHelp'),
    href: 'https://github.com/thelastoutpostworkshop/ESPConnect',
    icon: 'mdi-lifebuoy',
  },
];
const flashSizeBytes = ref(null);

const showBusyDialog = ref(false);
const busyDialogMessage = ref('');
const showBootDialog = ref(false);
const showGeneralErrorDialog = ref(false);
const lastErrorMessage = ref('');

const DEFAULT_OFFSET_PRESETS = [
  { label: 'Application (0x10000)', value: '0x10000', color: null },
  { label: 'Bootloader (0x1000)', value: '0x1000', color: null },
  { label: 'Partition Table (0x8000)', value: '0x8000', color: null },
  { label: 'NVS Storage (0x9000)', value: '0x9000', color: null },
];

const theme = useTheme();
const storedTheme =
  typeof window !== 'undefined' ? window.localStorage.getItem('esp32-theme') : null;
const currentTheme = ref(storedTheme === 'light' ? 'light' : 'dark');
const isDarkTheme = computed(() => currentTheme.value === 'dark');
const themeIcon = computed(() =>
  isDarkTheme.value ? 'mdi-weather-night' : 'mdi-white-balance-sunny'
);
const themeSwitchTitle = computed(() => {
  const mode = isDarkTheme.value ? t('theme.light') : t('theme.dark');
  return t('theme.switch', { mode });
});

// Apply or remove the light-theme helper class on the document body.
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

// Toggle between light and dark themes.
function toggleTheme() {
  currentTheme.value = isDarkTheme.value ? 'light' : 'dark';
}

// Change the connection baud rate and optionally persist the selection.
async function setConnectionBaud(targetBaud: string | number, options: SetBaudOptions = {}) {
  const { remember = true, log = true, updateDropdown = true } = options;
  const parsed = Number.parseInt(String(targetBaud), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return;
  }

  if (connected.value && loader.value) {
    try {
      baudChangeBusy.value = true;
      if (log) {
        appendLog(t('baud.changing', { baud: parsed.toLocaleString() }), '[ESPConnect-Debug]');
      }
      loader.value.baudrate = parsed;
      await loader.value.setBaudrate(parsed);
      if (transport.value) {
        transport.value.baudrate = parsed;
      }
      if (log) {
        appendLog(t('baud.changed', { baud: parsed.toLocaleString() }), '[ESPConnect-Debug]');
      }
    } catch (error) {
      if (log) {
        const friendlyError = formatErrorMessage(error);
        appendLog(t('baud.changeFailed', { error: friendlyError }), '[ESPConnect-Warn]');
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
    selectedBaud.value = parsed as BaudRate;
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
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    appendLog(t('baud.invalidSelection', { value }), '[ESPConnect-Warn]');
    if (oldValue != null) {
      const previousSuspendState = suspendBaudWatcher;
      suspendBaudWatcher = true;
      selectedBaud.value = oldValue as BaudRate;
      queueMicrotask(() => {
        suspendBaudWatcher = previousSuspendState;
      });
    } else {
      const previousSuspendState = suspendBaudWatcher;
      suspendBaudWatcher = true;
      selectedBaud.value = currentBaud.value as BaudRate;
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
    appendLog(t('baud.busy', { baud: currentBaud.value.toLocaleString() }), '[ESPConnect-Warn]');
    const previousSuspendState = suspendBaudWatcher;
    suspendBaudWatcher = true;
    selectedBaud.value = currentBaud.value as BaudRate;
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
    selectedBaud.value = currentBaud.value as BaudRate;
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
  if (value === 'littlefs') {
    void ensureLittlefsReady();
  }
  if (value === 'fatfs') {
    void ensureFatfsReady();
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
      resetLittlefsState();
      resetFatfsState();
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
    if (littleFsPartitions.value.length) {
      if (!littleFsPartitions.value.some(partition => partition.id === littlefsState.selectedId)) {
        littlefsState.selectedId = littleFsPartitions.value[0].id;
      }
      if (activeTab.value === 'littlefs') {
        void ensureLittlefsReady();
      }
    } else {
      resetLittlefsState();
    }
    if (fatfsPartitions.value.length) {
      if (!fatfsPartitions.value.some(partition => partition.id === fatfsState.selectedId)) {
        fatfsState.selectedId = fatfsPartitions.value[0].id;
      }
      if (activeTab.value === 'fatfs') {
        void ensureFatfsReady();
      }
    } else {
      resetFatfsState();
    }
  }
);

// Normalize a register address input to hex string form.
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

// Read a 32-bit little-endian value from a byte buffer.
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

// Decode a null-terminated C string from a Uint8Array.
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
    appendLog(t('apps.decodeFailed'), error);
    return '';
  }
}

// Locate and parse an app descriptor from a firmware buffer.
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

// Determine the active OTA slot from otadata contents.
function detectActiveOtaSlot(otadata, otaEntries) {
  const otaCount = otaEntries?.length ?? 0;
  if (!otadata || !otadata.length || !otaCount) {
    return { slotId: null, summary: t('apps.activeSlotUnknown') };
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
    return { slotId: null, summary: t('apps.activeSlotUnknown') };
  }
  entries.sort((a, b) => b.seq - a.seq);
  const winner = entries[0];
  const slotEntry = otaEntries[winner.slotIndex];
  if (!slotEntry) {
    return { slotId: null, summary: t('apps.activeSlotUnknown') };
  }
  const slotId = `ota_${winner.slotIndex}`;
  return {
    slotId,
    summary: t('apps.activeSlotWithSeq', { slot: slotId, seq: winner.seq }),
  };
}

// Scan application partitions to build metadata and identify the active slot.
async function analyzeAppPartitions(loaderInstance, partitions) {
  appPartitions.value = [];
  activeAppSlotId.value = null;
  appMetadataError.value = null;
  appActiveSummary.value = t('apps.activeSlotUnknown');
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
  let activeSummary = t('apps.activeSlotUnknown');
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
      appendLog(t('apps.otaReadFailedLog'), error);
      appMetadataError.value = t('apps.otaMetadataError');
    }
  }

  if (!activeSlotId) {
    if (factoryEntry) {
      activeSlotId = 'factory';
      activeSummary = t('apps.activeSlotFactory');
    } else {
      activeSummary = t('apps.activeSlotUnknown');
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
        appendLog(t('apps.readPartitionFailed', { name: entry.label || slotLabel }), error);
      }
    } else {
      imageError = t('apps.partitionTooSmall');
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
      appInfo.error = t('apps.appHeaderTruncated');
      results.push(appInfo);
      continue;
    }

    if (buffer[0] !== APP_IMAGE_HEADER_MAGIC) {
      appInfo.error = t('apps.appHeaderInvalid');
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
          ? t('apps.activeSlotInvalidUse', {
              slot: activeInfoCandidate.slotLabel,
              fallback: fallbackInfo.slotLabel,
            })
          : t('apps.activeSlotInferred', { slot: fallbackInfo.slotLabel });
    } else if (activeInfoCandidate && !activeInfoCandidate.valid) {
      resolvedSlotId = null;
      resolvedSummary = t('apps.activeSlotInvalid');
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

// Reset cached application metadata.
function resetAppMetadata() {
  appPartitions.value = [];
  appMetadataLoading.value = false;
  appMetadataError.value = null;
  activeAppSlotId.value = null;
  appActiveSummary.value = t('apps.activeSlotUnknown');
  appMetadataLoaded.value = false;
}

// Load application metadata from flash partitions.
async function loadAppMetadata(options: LoadAppMetadataOptions = {}) {
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
    appendLog(t('apps.analyzeFailedLog'), error);
    appMetadataError.value = t('apps.analyzeFailed', { error: formatErrorMessage(error) });
    appMetadataLoaded.value = false;
  } finally {
    appMetadataLoading.value = false;
  }
}

// Apply register lookup data for the selected chip.
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

// Open a confirmation dialog and return the user's decision.
function showConfirmation(options: ConfirmationOptions = {}) {
  return new Promise<boolean>(resolve => {
    confirmationResolver = resolve;
    confirmationDialog.title = options.title || t('dialogs.confirm.title');
    confirmationDialog.message = options.message || '';
    confirmationDialog.confirmText = options.confirmText || t('buttons.confirm');
    confirmationDialog.cancelText = options.cancelText || t('buttons.cancel');
    confirmationDialog.destructive = !!options.destructive;
    confirmationDialog.visible = true;
  });
}

// Resolve the pending confirmation promise and close the dialog.
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

const PARTITION_TYPE_NAME_KEYS = {
  0x00: 'partitions.type.application',
  0x01: 'partitions.type.data',
};

const PARTITION_DATA_SUBTYPE_NAME_KEYS = {
  0x00: 'partitions.dataSubtype.ota',
  0x01: 'partitions.dataSubtype.phy',
  0x02: 'partitions.dataSubtype.nvs',
  0x03: 'partitions.dataSubtype.coreDump',
  0x04: 'partitions.dataSubtype.nvsKeys',
  0x05: 'partitions.dataSubtype.efuseEmulation',
  0x06: 'partitions.dataSubtype.undefined',
  0x80: 'partitions.dataSubtype.esphttpd',
  0x81: 'partitions.dataSubtype.fatfs',
  0x82: 'partitions.dataSubtype.spiffs',
  0x83: 'partitions.dataSubtype.littlefs',
  0x84: 'partitions.dataSubtype.storage',
  0x85: 'partitions.dataSubtype.otaBackup',
  0x86: 'partitions.dataSubtype.nimble',
  0x87: 'partitions.dataSubtype.factoryNvs',
};

// Format a number as a two-digit hex string with prefix.
function toPaddedHex(value) {
  const hex = Number(value).toString(16).toUpperCase();
  return `0x${hex.padStart(2, '0')}`;
}

// Build a label for a partition type value.
function getPartitionTypeLabel(type) {
  const hex = toPaddedHex(type ?? 0);
  const nameKey = PARTITION_TYPE_NAME_KEYS[type];
  const name = nameKey ? t(nameKey) : null;
  return name ? `${name} (${hex})` : t('partitions.type.fallback', { hex });
}

// Build a label for a partition subtype given its type.
function getPartitionSubtypeLabel(type, subtype) {
  const hex = toPaddedHex(subtype ?? 0);
  let name;

  if (type === 0x00) {
    if (subtype === 0x00) {
      name = t('partitions.subtype.factory');
    } else if (subtype === 0x01) {
      name = t('partitions.subtype.test');
    } else if (subtype >= 0x10 && subtype <= 0x1f) {
      name = t('partitions.subtype.ota', { index: subtype - 0x10 });
    } else if (subtype === 0x20) {
      name = t('partitions.subtype.any');
    } else if (subtype === 0x21) {
      name = t('partitions.subtype.otaApp');
    }
  } else if (type === 0x01) {
    const nameKey = PARTITION_DATA_SUBTYPE_NAME_KEYS[subtype];
    name = nameKey ? t(nameKey) : undefined;
    if (!name && subtype >= 0x80 && subtype <= 0x9f) {
      name = t('partitions.subtype.customData');
    }
  }

  return name ? `${name} (${hex})` : t('partitions.subtype.fallback', { hex });
}

const UNUSED_SEGMENT_COLOR = '#c62828';
const UNUSED_SEGMENT_PATTERN =
  'repeating-linear-gradient(270deg, rgba(248, 113, 113, 0.65) 0px, rgba(248, 113, 113, 0.65) 12px, rgba(220, 38, 38, 0.65) 12px, rgba(220, 38, 38, 0.65) 24px)';

const reservedSegments = () => [
  {
    key: 'bootloader',
    label: t('partitions.reserved.bootloader'),
    offset: 0x0,
    size: 0x8000,
    color: '#546e7a',
  },
  {
    key: 'partition-table',
    label: t('partitions.reserved.partitionTable'),
    offset: 0x8000,
    size: 0x1000,
    color: '#78909c',
  },
];

const MIN_SEGMENT_PERCENT = 1; // ensure tiny partitions remain hoverable in the map

const partitionSegments = computed(() => {
  if (!connected.value) {
    return [];
  }
  if (partitionTable.value.length == 0) {
    return [];
  }
  const sortedPartitions = [...partitionTable.value].sort((a, b) => a.offset - b.offset);
  const parseFlashSizeLabel = label => {
    if (!label || typeof label !== 'string') return null;
    const match = label.match(/(\d+(?:\.\d+)?)\s*(MB|KB)/i);
    if (!match) return null;
    const value = Number.parseFloat(match[1]);
    if (!Number.isFinite(value) || value <= 0) return null;
    return match[2].toUpperCase() === 'MB' ? value * 1024 * 1024 : value * 1024;
  };
  const totalFlash =
    (flashSizeBytes.value && flashSizeBytes.value > 0 ? flashSizeBytes.value : null) ||
    parseFlashSizeLabel(partitionFlashSizeLabel.value);
  const segments = [];
  let cursor = 0;

  const createGapSegments = (start, size) => {
    if (size <= 0) return [];
    const end = start + size;
    const gapSegments = [];
    let pointer = start;

    const relevantReserved = reservedSegments().filter(
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

  const adjustedPercents = sizedSegments.map(segment => {
    const widthPercent = (segment.size / totalSpan) * 100;
    return Number.isFinite(widthPercent)
      ? Math.max(widthPercent, MIN_SEGMENT_PERCENT)
      : MIN_SEGMENT_PERCENT;
  });
  const totalAdjusted = adjustedPercents.reduce((sum, value) => sum + value, 0) || 1;
  const normalizationFactor = 100 / totalAdjusted;

  return sizedSegments.map((segment, idx) => {
    const widthValue = adjustedPercents[idx] * normalizationFactor;
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
        label: t('partitions.unusedLabel'),
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
        typeLabel: t('partitions.notApplicable'),
        subtypeLabel: t('partitions.notApplicable'),
        isUnused: true,
        isReserved: false,
        showLabel,
        showMeta: false,
        tooltipLines: [
          t('partitions.tooltip.size', { size: sizeText }),
          t('partitions.tooltip.start', { start: offsetHex }),
          t('partitions.tooltip.end', { end: endHex }),
        ],
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
        typeLabel: t('partitions.reservedLabel'),
        subtypeLabel: t('partitions.reservedLabel'),
        isUnused: false,
        isReserved: true,
        showLabel,
        showMeta: widthValue >= 10,
        tooltipLines: [
          t('partitions.tooltip.size', { size: sizeText }),
          t('partitions.tooltip.start', { start: offsetHex }),
          t('partitions.tooltip.end', { end: endHex }),
        ],
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
      label: entry.label || t('partitions.fallbackLabel', { hex: typeHex }),
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
        t('partitions.tooltip.size', { size: sizeText }),
        t('partitions.tooltip.start', { start: offsetHex }),
        t('partitions.tooltip.end', { end: endHex }),
        t('partitions.tooltip.type', { type: typeLabel }),
        t('partitions.tooltip.subtype', { subtype: subtypeLabel }),
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

  const reservedRows = reservedSegments().map(segment => {
    const offsetHex = `0x${segment.offset.toString(16).toUpperCase()}`;
    const sizeText = formatBytes(segment.size) ?? `${segment.size} bytes`;
    return {
      label: segment.label,
      typeLabel: t('partitions.reservedLabel'),
      subtypeLabel: t('partitions.reservedLabel'),
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
      const baseLabel = row.label && row.label.trim() ? row.label.trim() : t('partitions.partitionLabel', { type: row.typeHex });
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
        color: row.color,
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

const offsetPresets = computed(() => {
  const options = partitionDownloadOptions.value;
  if (options.length) {
    return options.map(option => ({
      label: option.label,
      value: option.offsetHex || `0x${Number(option.offset).toString(16)}`,
      color: option.color || null,
    }));
  }
  return DEFAULT_OFFSET_PRESETS.map(preset => ({ ...preset }));
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
    return t('status.disconnected');
  }

  const name = chipDetails.value?.name?.trim();
  return name ? `${name}` : t('status.connected');
});

const canFlash = computed(
  () =>
    connected.value &&
    Boolean(firmwareBuffer.value) &&
    !flashInProgress.value
);

const showSerialMonitorReconnectNotice = computed(
  () => serialMonitorClosedPrompt.value && !connected.value && serialSupported
);

// Append a message to the session log buffer.
function appendLog(message, prefix = '[ESPConnect-ui]') {
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

// Clear the session log buffer.
function clearLog() {
  terminal.clean();
}

let monitorDecoder = null;
let monitorNoiseChunks = 0;
let monitorNoiseWarned = false;
let monitorAutoResetPerformed = false;

// Cancel any scheduled serial monitor flush.
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

// Flush buffered monitor text into the displayed log.
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

// Schedule a monitor flush on the next animation frame or a timer.
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

// Retrieve USB vendor/product info for a Web Serial port.
function getPortIdentity(port) {
  if (!port || typeof port.getInfo !== 'function') {
    return null;
  }
  try {
    return port.getInfo();
  } catch (error) {
    appendLog(t('serialMonitor.portInfoError'), error);
    return null;
  }
}

// Compare two serial ports by USB identity.
function serialPortsMatch(portA, portB) {
  if (!portA || !portB) return false;
  if (portA === portB) return true;
  const infoA = getPortIdentity(portA);
  const infoB = getPortIdentity(portB);
  if (infoA && infoB) {
    return infoA.usbVendorId === infoB.usbVendorId && infoA.usbProductId === infoB.usbProductId;
  }
  return false;
}

// Decode monitor data chunks and buffer them for display while handling noise.
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
          selectedBaud.value ||
          DEFAULT_ROM_BAUD;
        const baudText = Number(activeBaud).toLocaleString();
        const binaryWarningMessage = t('serialMonitor.binaryDataWarning', { baud: baudText });
        monitorError.value = binaryWarningMessage;
        monitorNoiseWarned = true;
      }
    } else {
      monitorNoiseChunks = 0;
      if (
        monitorNoiseWarned &&
        monitorError.value &&
        monitorError.value === t('serialMonitor.binaryDataWarning', {
          baud: Number(
            transport.value?.baudrate || selectedBaud.value || DEFAULT_ROM_BAUD
          ).toLocaleString(),
        })
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

// Reset monitor buffers and noise/error tracking.
function clearMonitorOutput() {
  cancelMonitorFlush();
  monitorText.value = '';
  monitorPendingText = '';
  monitorError.value = null;
  monitorNoiseChunks = 0;
  monitorNoiseWarned = false;
}

// React to browser-level serial disconnect events and clean up connections.
async function handleSerialDisconnectEvent(event) {
  const eventPort = event?.target?.port ?? event?.port ?? null;
  if (eventPort && currentPort.value && !serialPortsMatch(eventPort, currentPort.value)) {
    return;
  }
  if (!currentPort.value && !transport.value) {
    return;
  }
  appendLog(t('serialMonitor.usbDisconnected'), '[ESPConnect-Warn]');
  if (busy.value) {
    await disconnectTransport();
    busy.value = false;
    appendLog(t('serialMonitor.portDisconnected'));
  } else {
    await disconnect();
  }
}

// Read serial data in a loop, pushing it into the monitor until aborted.
async function monitorLoop(signal) {
  const transportInstance = transport.value;
  if (!transportInstance) {
    throw new Error(t('serialMonitor.notSupported'));
  }
  const iterator = transportInstance.rawRead();
  for await (const chunk of iterator) {
    if (signal.aborted) break;
    if (!chunk || !chunk.length) continue;
    appendMonitorChunk(chunk);
  }
  flushPendingMonitorText();
}

// Kick off the serial monitor and adjust baud if needed.
async function startMonitor() {
  if (!canStartMonitor.value || monitorActive.value) {
    return;
  }
  if (!transport.value) {
    appendLog(t('serialMonitor.transportNotReady'), '[ESPConnect-Warn]');
    return;
  }
  previousMonitorBaud.value = currentBaud.value || lastFlashBaud.value || DEFAULT_FLASH_BAUD;
  if (currentBaud.value !== MONITOR_BAUD) {
    try {
      await setConnectionBaud(MONITOR_BAUD, { remember: false, log: true });
    } catch (error) {
      appendLog(
        t('serialMonitor.monitorContinueFallback', {
          baud: currentBaud.value.toLocaleString(),
          error: formatErrorMessage(error),
        }),
        '[ESPConnect-Warn]'
      );
    }
  }
  if (!monitorAutoResetPerformed) {
    appendLog(t('serialMonitor.autoReset'), '[ESPConnect-Debug]');
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
  appendLog(t('serialMonitor.started'), '[ESPConnect-Debug]');
  (async () => {
    try {
      await monitorLoop(controller.signal);
    } catch (err) {
      if (!controller.signal.aborted) {
        monitorError.value = err?.message || String(err);
        appendLog(t('serialMonitor.monitorError', { error: monitorError.value }), '[ESPConnect-Warn]');
      }
    } finally {
      if (monitorAbortController.value === controller) {
        monitorAbortController.value = null;
      }
      monitorActive.value = false;
    }
  })();
}

// Stop the serial monitor and optionally disconnect from the device.
async function stopMonitor(options: StopMonitorOptions = {}) {
  if (!monitorActive.value) return;
  const { closeConnection = false } = options;
  monitorAbortController.value?.abort();
  monitorActive.value = false;
  monitorAbortController.value = null;
  cancelMonitorFlush();
  flushPendingMonitorText();
  monitorPendingText = '';
  if (monitorDecoder) {
    try {
      monitorDecoder.decode(new Uint8Array(), { stream: false });
    } catch (err) {
      appendLog(t('serialMonitor.decoderFlushFailed'), err);
    }
    monitorDecoder = null;
  }
  appendLog(t('serialMonitor.stopped'), '[ESPConnect-Debug]');
  if (closeConnection) {
    await disconnectTransport();
    serialMonitorClosedPrompt.value = true;
  }
  // const restoreBaud =
  //   previousMonitorBaud.value || lastFlashBaud.value || DEFAULT_FLASH_BAUD;
  if (lastFlashBaud.value) {
    try {
      await setConnectionBaud(lastFlashBaud.value, { remember: true, log: true });
    } catch (error) {
      appendLog(
        t('serialMonitor.restoreBaudFailed', {
          error: formatErrorMessage(error),
          baud: currentBaud.value.toLocaleString(),
        }),
        '[ESPConnect-Warn]'
      );
    }
  }

}

// Pulse RTS/DTR to reset the target board.
async function resetBoard(options: ResetOptions = {}) {
  const { silent = false } = options;
  const currentLoader = loader.value;
  if (!currentLoader) {
    appendLog(t('serialMonitor.resetUnavailable'), '[ESPConnect-Warn]');
    return;
  }
  try {
    if (!silent) {
      appendLog(t('serialMonitor.resettingBoard'), '[ESPConnect-Debug]');
    }
    await currentLoader.setDTR(false);
    await currentLoader.setRTS(true);
    await currentLoader.sleep(120);
    await currentLoader.setRTS(false);
  } catch (err) {
    appendLog(t('serialMonitor.resetFailed', { error: formatErrorMessage(err) }), '[error]');
  }
}

// Disconnect transport cleanly and reset local state.
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
    appendLog(t('serialMonitor.disconnectingTransportError'), error);
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
    serialMonitorClosedPrompt.value = false;
    resetMaintenanceState();
    resetSpiffsState();
    spiffsState.selectedId = null;
    resetLittlefsState();
    littlefsState.selectedId = null;
    resetFatfsState();
    fatfsState.selectedId = null;
    currentBaud.value = DEFAULT_FLASH_BAUD;
    baudChangeBusy.value = false;
    activeTab.value = 'info';
  }
}

// Open a serial connection, handshake the bootloader, and load device metadata.
async function connect() {
  if (!serialSupported) {
    appendLog(t('connectFlow.unsupportedSerial'));
    return;
  }
  if (busy.value) return;
  busy.value = true;
  flashProgress.value = 0;
  monitorAutoResetPerformed = false;
  serialMonitorClosedPrompt.value = false;
  resetMaintenanceState();
  connectDialog.visible = false;
  connectDialog.label = t('connectFlow.dialogLabel');
  connectDialog.message = t('connectFlow.openingPort');
  if (connectDialogTimer) {
    clearTimeout(connectDialogTimer);
    connectDialogTimer = null;
  }

  logBuffer.value = '';
  partitionTable.value = [];
  appendLog(t('connectFlow.requestPort'));

  try {
    showBusyDialog.value = false;
    busyDialogMessage.value = '';
    showBootDialog.value = false;
    showGeneralErrorDialog.value = false;
    // currentPort.value = await requestSerialPort(SUPPORTED_VENDORS);
    currentPort.value = await requestSerialPort();
    connectDialogTimer = setTimeout(() => {
      connectDialog.visible = true;
    }, TIMEOUT_CONNECT);
    let desiredBaud: BaudRate = (selectedBaud.value || DEFAULT_FLASH_BAUD) as BaudRate;
    const connectBaud_defaultROM = DEFAULT_ROM_BAUD;
    lastFlashBaud.value = desiredBaud;

    // Get port and usb bridge information
    const portDetails = currentPort.value?.getInfo ? currentPort.value.getInfo() : null;
    const usbBridge = portDetails ? formatUsbBridge(portDetails) : t('connectFlow.unknownBridge');
    const bridge = getUsbDeviceInfo(portDetails.usbVendorId, portDetails.usbProductId);

    if (bridge.productName === 'CH340' && desiredBaud > bridge.maxBaudrate) {
      // Reduce baud rate for CH340 to the highest supported value under its max.
      const cappedBaud =
        SUPPORTED_BAUDRATES.filter(rate => rate <= bridge.maxBaudrate).pop() ?? DEFAULT_FLASH_BAUD;
      desiredBaud = cappedBaud as BaudRate;
      lastFlashBaud.value = desiredBaud;
      const previousSuspendState = suspendBaudWatcher;
      suspendBaudWatcher = true;
      selectedBaud.value = desiredBaud;
      queueMicrotask(() => {
        suspendBaudWatcher = previousSuspendState;
      });
      const baudText = desiredBaud.toLocaleString();
      showToast(t('connectFlow.ch340Toast', { baud: baudText }), { color: 'warning' });
      appendLog(t('connectFlow.ch340Log', { baud: baudText }), '[ESPConnect-Debug]');
    }

    // Create the client to communicate and do operations on the MCU
    const esptool = createEsptoolClient({
      port: currentPort.value,
      terminal,
      desiredBaud,
      debugSerial: false,
      debugLogging: false,
      onStatus: msg => {
        connectDialog.message = msg;
        appendLog(msg, '[ESPConnect-Debug]');
      },
    });
    const transportInstance = esptool.transport;
    transport.value = transportInstance;
    loader.value = esptool.loader;
    currentBaud.value = connectBaud_defaultROM;
    transportInstance.baudrate = connectBaud_defaultROM;

    // Flush any input remaining on the transport
    try {
      await transportInstance.flushInput();
      appendLog(t('connectFlow.flushInput'), '[ESPConnect-Debug]');
    } catch (err) {
      appendLog(t('connectFlow.flushInputWarn', { error: formatErrorMessage(err) }), '[ESPConnect-Warn]');
    }

    // Open the serial port, talk to the ROM bootloader, load the stub flasher
    connectDialog.message = t('connectFlow.handshaking');
    const esp = await esptool.connectAndHandshake();
    currentBaud.value = desiredBaud || connectBaud_defaultROM;
    transportInstance.baudrate = currentBaud.value;
    const previousSuspendState = suspendBaudWatcher;
    suspendBaudWatcher = true;
    selectedBaud.value = currentBaud.value as BaudRate;
    queueMicrotask(() => {
      suspendBaudWatcher = previousSuspendState;
    });
    connected.value = true;
    appendLog(t('connectFlow.handshakeComplete', { chip: esp.chipName }), '[ESPConnect-Debug]');

    lastFlashBaud.value = currentBaud.value;

    const metadata = await esptool.readChipMetadata();

    const descriptionRaw = metadata.description ?? esp.chipName;
    const featuresRaw = metadata.features;
    const crystalFreq = metadata.crystalFreq;

    connectDialog.message = t('connectFlow.readingFlash');
    const flashLabel = esp.flashSize;
    appendLog(
      t('connectFlow.detectFlashSize', {
        size: flashLabel === null ? t('connectFlow.undefined') : flashLabel,
      }),
      '[ESPConnect-Debug]'
    );

    const flashId = await esptool.loader.flashId();
    const id = Number.isFinite(flashId) ? flashId : null;

    const manufacturerCode = id !== null ? id & 0xff : null;
    const memoryTypeCode = id !== null ? (id >> 8) & 0xff : null;
    const capacityCodeRaw = id !== null ? (id >> 16) & 0xff : null;

    appendLog(
      t('connectFlow.flashDetectRaw', {
        flashSize: flashLabel ?? 'n/a',
        flashId:
          typeof flashId === 'number' && Number.isFinite(flashId)
            ? `0x${flashId.toString(16).padStart(6, '0').toUpperCase()}`
            : 'n/a',
        manuf:
          Number.isInteger(manufacturerCode)
            ? `0x${manufacturerCode.toString(16).toUpperCase().padStart(2, '0')}`
            : '??',
        type:
          Number.isInteger(memoryTypeCode)
            ? `0x${memoryTypeCode.toString(16).toUpperCase().padStart(2, '0')}`
            : '??',
        cap:
          Number.isInteger(capacityCodeRaw)
            ? `0x${capacityCodeRaw.toString(16).toUpperCase().padStart(2, '0')}`
            : '??',
      }),
      '[ESPConnect-Debug]'
    );

    connectDialog.message = t('connectFlow.preparingInfo');
    const featureList: string[] = Array.isArray(featuresRaw)
      ? (featuresRaw as string[])
      : typeof featuresRaw === 'string'
        ? (featuresRaw as string).split(/,\s*/)
        : [];

    const crystalLabel =
      typeof crystalFreq === 'number' ? `${Number(crystalFreq).toFixed(0)} MHz` : null;
    const macLabel = esp.macAddress ?? t('deviceInfo.unknown');

    applyRegisterGuide(esp.chipName);
    const facts = [];
    const pushFact = (label, value) => {
      if (!value) return;
      facts.push({
        label,
        value,
        icon: FACT_ICONS[label] ?? null,
      });
    };
    const packageLabel = resolvePackageLabel(esp.chipName, metadata.pkgVersion, metadata.chipRevision);
    pushFact('Chip Variant', packageLabel);
    const packageMatch = packageLabel?.match(/\(([^)]+)\)$/);
    if (packageMatch) {
      const detail = PACKAGE_FORM_FACTORS[packageMatch[1]];
      pushFact('Package Form Factor', detail);
    }
    // if (macLabel && macLabel !== 'Unavailable') {
    //   pushFact('MAC Address', macLabel);
    // }
    pushFact(
      'Revision',
      resolveRevisionLabel(esp.chipName, metadata.chipRevision, metadata.majorVersion, metadata.minorVersion)
    );
    // pushFact('Flash Size', flashLabel);

    const embeddedFlash = resolveEmbeddedFlash(esp.chipName, metadata.flashCap, metadata.flashVendor, featureList);
    pushFact('Embedded Flash', embeddedFlash);

    const embeddedPsram = resolveEmbeddedPsram(esp.chipName, metadata.psramCap, metadata.psramVendor, featureList);
    pushFact('Embedded PSRAM', embeddedPsram);

    const cpuFrequency = extractCpuFrequency(featureList);
    pushFact('Max CPU Frequency', cpuFrequency);

    const coreCount = extractCoreCount(featureList);
    pushFact('CPU Cores', coreCount);

    const pwmEntry = esp.chipName ? PWM_TABLE[esp.chipName] : null;
    if (pwmEntry) {
      let pwmLabel = '';
      if (pwmEntry.hasLedc === false) {
        const noteKey = PWM_NOTE_KEYS[esp.chipName];
        const noteText = noteKey ? t(noteKey) : pwmEntry.notes;
        pwmLabel = noteText || t('facts.pwmSoftwareOnly');
      } else {
        const parts = [];
        if (pwmEntry.ledcChannels) {
          const unit = pwmEntry.ledcChannels === 1 ? t('facts.channelSingular') : t('facts.channelPlural');
          parts.push(`${pwmEntry.ledcChannels} ${unit}`);
        }
        if (pwmEntry.ledcTimers) {
          const unit = pwmEntry.ledcTimers === 1 ? t('facts.timerSingular') : t('facts.timerPlural');
          parts.push(`${pwmEntry.ledcTimers} ${unit}`);
        }
        const noteKey = PWM_NOTE_KEYS[esp.chipName];
        const noteText = noteKey ? t(noteKey) : pwmEntry.notes;
        if (noteText) parts.push(noteText);
        pwmLabel = parts.join(' · ');
      }
      pushFact('PWM/LEDC', pwmLabel);
    }

    if (metadata.flashVendor && !embeddedFlash) {
      pushFact('Flash Vendor (eFuse)', formatVendorLabel(metadata.flashVendor));
    }
    if (metadata.psramVendor && !embeddedPsram) {
      pushFact('PSRAM Vendor (eFuse)', formatVendorLabel(metadata.psramVendor));
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
      const capacityBytes = JEDEC_CAPACITY_CODES[capacityCode] ?? null;

      const formattedCapacity = capacityBytes !== null ? formatBytes(capacityBytes) : null;

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
      typeof metadata.blockVersionMajor === 'number' &&
      !Number.isNaN(metadata.blockVersionMajor) &&
      typeof metadata.blockVersionMinor === 'number' &&
      !Number.isNaN(metadata.blockVersionMinor)
    ) {
      pushFact('eFuse Block Version', `v${metadata.blockVersionMajor}.${metadata.blockVersionMinor}`);
    }

    const docs = esp.chipName ? findChipDocs(esp.chipName) : undefined;
    if (docs) {
      pushFact('Hardware Reference', docs.hwReference);
      pushFact('Datasheet', docs.datasheet);
      pushFact('Technical Reference Manual', docs.technicalReferenceManual);
      pushFact('Errata', docs.errata);
      pushFact('Hardware Design Guidelines', docs.hardwareDesignGuidelines);
    }

    if (esp.securityFacts) {
      for (const fact of esp.securityFacts) {
        pushFact(fact.label, fact.value);
      }
    }

    try {
      await transport.value?.flushInput();
    } catch (err) {
      appendLog(t('connectFlow.flushPartitionWarn', { error: formatErrorMessage(err) }), '[ESPConnect-Warn]');
    }

    connectDialog.message = t('connectFlow.readingPartition');
    if (esp.chipName?.includes('ESP8266')) {
      appendLog(t('connectFlow.skipPartitionEsp8266'), '[ESPConnect-Debug]');
      partitionTable.value = [];
      appMetadataLoaded.value = false;
    } else {
      const partitions = await readPartitionTable(loader.value, undefined, undefined, appendLog);
      partitionTable.value = partitions;
      appMetadataLoaded.value = false;
    }

    if (usbBridge) {
      pushFact('USB Bridge', usbBridge);
    }

    pushFact('Connection Baud', `${currentBaud.value.toLocaleString()} bps`);

    const featuresDisplay = featureList.filter(Boolean).map(humanizeFeature);
    // const orderedFacts = sortFacts(facts);
    const factGroups = buildFactGroups(facts);

    chipDetails.value = {
      name: esp.chipName,
      description: descriptionRaw || esp.chipName,
      features: featuresDisplay,
      mac: macLabel,
      flashSize: flashLabel,
      crystal: crystalLabel,
      facts: facts,
      factGroups,
    };
    activeTab.value = 'info';
    appendLog(
      t('connectFlow.loadedDetails', { name: chipDetails.value.name, count: facts.length }),
      '[ESPConnect-Debug]'
    );

    connected.value = true;
    showBusyDialog.value = false;
    showBootDialog.value = false;
    showGeneralErrorDialog.value = false;
    appendLog(t('connectFlow.readyToFlash'));
  } catch (error) {
    if (error?.name === 'AbortError' || error?.name === 'NotFoundError') {
      appendLog(t('connectFlow.portCancelled'));
    } else if (error?.name === 'NetworkError') {
      const busyMessage = t('connectFlow.portBusy');
      appendLog(busyMessage, '[warn]');
      lastErrorMessage.value = busyMessage;
      busyDialogMessage.value = busyMessage;
      showBusyDialog.value = true;
      showBootDialog.value = false;
      showGeneralErrorDialog.value = false;
    } else if (error?.message === "Couldn't sync to ESP. Try resetting.") {
      const message = t('connectFlow.syncFailed');
      lastErrorMessage.value = message;
      busyDialogMessage.value = '';
      showBusyDialog.value = false;
      showBootDialog.value = true;
      showGeneralErrorDialog.value = false;
    } else {
      appendLog(t('connectFlow.generalErrorLog', { error: formatErrorMessage(error) }), '[error]');
      lastErrorMessage.value = formatErrorMessage(error) || t('connectFlow.unknownError');
      busyDialogMessage.value = '';
      connectDialog.visible = false;
      connectDialog.message = '';
      showBusyDialog.value = false;
      showBootDialog.value = false;
      showGeneralErrorDialog.value = true;
    }
    await disconnectTransport();
  } finally {
    if (connectDialogTimer) {
      clearTimeout(connectDialogTimer);
      connectDialogTimer = null;
    }
    connectDialog.visible = false;
    connectDialog.message = '';
    busy.value = false;
    appendLog(t('connectFlow.finished', { busy: String(busy.value) }), '[ESPConnect-Debug]');
  }
}

// Disconnect from the device and clean up state.
async function disconnect() {
  busy.value = true;
  await disconnectTransport();
  appendLog(t('serialMonitor.portDisconnected'));
  busy.value = false;
}

// Parse a flash offset value from hex or decimal input.
function parseOffset(value) {
  if (!value) {
    throw new Error(t('flashInput.offsetRequired'));
  }
  const trimmed = value.trim().toLowerCase();
  const parsed = trimmed.startsWith('0x')
    ? Number.parseInt(trimmed, 16)
    : Number.parseInt(trimmed, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(t('flashInput.offsetInvalid'));
  }
  return parsed;
}

// Parse a numeric input (hex or decimal) with validation.
function parseNumericInput(value, label) {
  if (!value || !value.toString().trim()) {
    throw new Error(t('flashInput.valueRequired', { label }));
  }
  const trimmed = value.toString().trim().toLowerCase();
  const parsed = trimmed.startsWith('0x')
    ? Number.parseInt(trimmed, 16)
    : Number.parseInt(trimmed, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(t('flashInput.valueInvalid', { label }));
  }
  return parsed;
}

// Flash the selected firmware image to the device.
async function flashFirmware() {
  if (!loader.value || !firmwareBuffer.value) {
    appendLog(t('flashOps.selectFirmware'), '[ESPConnect-Warn]');
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

  const firmwareLabel = firmwareName.value || t('dialogs.flash.defaultName');
  const activeBaudRaw =
    transport.value?.baudrate ||
    currentBaud.value ||
    selectedBaud.value ||
    DEFAULT_ROM_BAUD;
  const flashBaud = Number.isFinite(activeBaudRaw) ? activeBaudRaw : DEFAULT_ROM_BAUD;
  const flashBaudLabel = flashBaud.toLocaleString() + ' bps';
  const confirmFlash = await showConfirmation({
    title: t('dialogs.flash.confirmTitle'),
    message: t('dialogs.flash.confirmMessage', {
      name: firmwareLabel,
      offset: `0x${offsetNumber.toString(16).toUpperCase()}`,
    }),
    confirmText: t('dialogs.flash.confirm'),
    cancelText: t('buttons.cancel'),
    destructive: true,
  });
  if (!confirmFlash) {
    appendLog(t('flashOps.cancelledLog'), '[ESPConnect-Warn]');
    return;
  }

  flashInProgress.value = true;
  busy.value = true;
  flashProgress.value = 0;
  flashCancelRequested.value = false;
  flashProgressDialog.visible = true;
  flashProgressDialog.value = 0;
  flashProgressDialog.label = t('dialogs.flash.preparing', { name: firmwareLabel, baud: flashBaudLabel });

  appendLog(t('flashOps.startLog', { name: firmwareLabel, offset: `0x${offsetNumber.toString(16)}` }));

  try {
    const bytes = new Uint8Array(firmwareBuffer.value);
    const startTime = performance.now();

    if (eraseFlash.value && typeof loader.value.eraseFlash === 'function') {
      flashProgressDialog.label = t('dialogs.flash.erasing', { baud: flashBaudLabel });
      await loader.value.eraseFlash();
    }

    await loader.value.flashData(
      bytes.buffer,
      (written, total) => {
        if (flashCancelRequested.value) {
          throw new Error(t('flashOps.cancelledError'));
        }
        const pct = total ? Math.floor((written / total) * 100) : 0;
        const clamped = Math.min(100, Math.max(0, pct));
        flashProgress.value = clamped;
        flashProgressDialog.visible = true;
        flashProgressDialog.value = clamped;
        const writtenLabel = written.toLocaleString();
        const totalLabel = total ? total.toLocaleString() : '';
        flashProgressDialog.label = total
          ? t('dialogs.flash.progressWithTotal', {
            name: firmwareLabel,
            written: writtenLabel,
            total: totalLabel,
            baud: flashBaudLabel,
          })
          : t('dialogs.flash.progressNoTotal', {
            name: firmwareLabel,
            written: writtenLabel,
            baud: flashBaudLabel,
          });
      },
      offsetNumber,
      true
    );

    await loader.value.hardReset();
    const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
    flashProgressDialog.value = 100;
    flashProgressDialog.label = t('dialogs.flash.complete', { seconds: elapsed, baud: flashBaudLabel });
    appendLog(`Flashing complete in ${elapsed}s. Device rebooted.`);
  } catch (error) {
    if (error?.message === t('flashOps.cancelledError')) {
      appendLog(t('flashOps.cancelledShort'), '[ESPConnect-Warn]');
    } else {
      appendLog(t('flashOps.failed', { error: error?.message || error }), '[error]');
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

// Reset maintenance, register, and MD5 UI state to defaults.
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

// Handle quick-selecting a register from the guide.
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
      ? t('register.statusWithDescription', { label: guide.label, description: guide.description })
      : t('register.statusSelected', { label: guide.label });
    appendLog(t('register.quickSelectedLog', { label: guide.label, address: guide.address }), '[ESPConnect-Debug]');
  }
}

// Read a register value via the loader.
async function handleReadRegister() {
  if (!loader.value) {
    registerStatus.value = t('register.connectFirst');
    registerStatusType.value = 'warning';
    return;
  }
  try {
    maintenanceBusy.value = true;
    registerStatus.value = null;
    const address = parseNumericInput(registerAddress.value, t('register.addressLabel'));
    const value = await loader.value.readReg(address);
    registerReadResult.value = `0x${value.toString(16).toUpperCase().padStart(8, '0')}`;
    registerStatusType.value = 'success';
    registerStatus.value = t('register.readSuccess', {
      address: `0x${address.toString(16).toUpperCase()}`,
      value: registerReadResult.value,
    });
  } catch (error) {
    registerStatusType.value = 'error';
    registerStatus.value = t('register.readFailed', { error: formatErrorMessage(error) });
  } finally {
    maintenanceBusy.value = false;
    downloadProgress.visible = false;
  }
}

// Write a value to the selected register via the loader.
async function handleWriteRegister() {
  if (!loader.value) {
    registerStatus.value = t('register.connectFirst');
    registerStatusType.value = 'warning';
    return;
  }
  try {
    maintenanceBusy.value = true;
    registerStatus.value = null;
    const address = parseNumericInput(registerAddress.value, t('register.addressLabel'));
    const value = parseNumericInput(registerValue.value, t('register.valueLabel'));
    await loader.value.writeReg(address, value);
    registerReadResult.value = `0x${value.toString(16).toUpperCase().padStart(8, '0')}`;
    registerStatusType.value = 'success';
    registerStatus.value = t('register.writeSuccess', {
      address: `0x${address.toString(16).toUpperCase()}`,
      value: registerReadResult.value,
    });
    appendLog(
      t('register.writeLog', {
        address: `0x${address.toString(16).toUpperCase()}`,
        value: registerReadResult.value,
      }),
      '[ESPConnect-Debug]'
    );
  } catch (error) {
    registerStatusType.value = 'error';
    registerStatus.value = t('register.writeFailed', { error: formatErrorMessage(error) });
  } finally {
    maintenanceBusy.value = false;
  }
}

// Compute an MD5 checksum over the specified flash region.
async function handleComputeMd5() {
  if (!loader.value) {
    md5Status.value = t('md5.connectFirst');
    md5StatusType.value = 'warning';
    md5Result.value = null;
    return;
  }
  try {
    maintenanceBusy.value = true;
    md5Status.value = null;
    md5Result.value = null;
    const offset = parseNumericInput(md5Offset.value, t('md5.offsetLabel'));
    const length = parseNumericInput(md5Length.value, t('md5.lengthLabel'));
    if (length <= 0) {
      throw new Error(t('md5.lengthPositive'));
    }
    md5StatusType.value = 'info';
    md5Status.value = t('md5.calculating');
    const result = await loader.value.flashMd5sum(offset, length);
    md5Status.value = null;
    md5Result.value = result;
    appendLog(
      t('md5.resultLog', {
        offset: `0x${offset.toString(16).toUpperCase()}`,
        length,
        result,
      }),
      '[ESPConnect-Debug]'
    );
  } catch (error) {
    md5StatusType.value = 'error';
    md5Status.value = t('md5.failed', { error: error?.message || error });
    md5Result.value = null;
  } finally {
    maintenanceBusy.value = false;
  }
}

// Sanitize a string into a filesystem-safe filename.
function sanitizeFileName(name, fallback) {
  const base = name && name.trim() ? name.trim() : fallback;
  return base
    .replace(/[\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120);
}

// Timestamp helper for naming backup files.
function formatBackupTimestamp(date = new Date()) {
  const pad = value => String(value).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_` +
    `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
  );
}

// Read a flash region and trigger a download with optional progress handling.
async function downloadFlashRegion(offset: number, length: number, options: DownloadFlashOptions = {}) {
  if (!loader.value) {
    throw new Error(t('flashDownload.connectFirst'));
  }
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new Error(t('flashDownload.offsetInvalid'));
  }
  if (!Number.isSafeInteger(length) || length <= 0) {
    throw new Error(t('flashDownload.lengthInvalid'));
  }
  if (flashSizeBytes.value && offset + length > flashSizeBytes.value) {
    throw new Error(t('flashDownload.exceedsFlashSize', { size: formatBytes(flashSizeBytes.value) }));
  }

  const { label, fileName, suppressStatus = false, onProgress } = options;
  const offsetHex = '0x' + offset.toString(16).toUpperCase();
  const lengthHex = '0x' + length.toString(16).toUpperCase();
  const displayLabel = label || t('flashDownload.defaultLabel', { offset: offsetHex, length: lengthHex });
  const activeBaudRaw =
    transport.value?.baudrate ||
    currentBaud.value ||
    selectedBaud.value ||
    DEFAULT_ROM_BAUD;
  const baudNumber = Number.isFinite(activeBaudRaw) ? activeBaudRaw : DEFAULT_ROM_BAUD;
  const baudLabel = baudNumber.toLocaleString() + ' bps';
  appendLog(t('flashDownload.startLog', { label: displayLabel, baud: baudLabel }), '[ESPConnect-Debug]');

  const CANCEL_ERROR_MESSAGE = 'Download cancelled by user';
  const MAX_CHUNK_SIZE = 0x10000;
  if (!suppressStatus) {
    flashReadStatusType.value = 'info';
    flashReadStatus.value = t('flashDownload.downloadingStatus', { label: displayLabel, baud: baudLabel });
    downloadProgress.visible = true;
    downloadProgress.value = 0;
    downloadProgress.label = t('flashDownload.preparingLabel', { baud: baudLabel });
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
          let progressLabel = t('flashDownload.progressLabel', {
            label: displayLabel,
            baud: baudLabel,
            written: overallReceived.toLocaleString(),
            total: length.toLocaleString(),
          });
          if (downloadCancelRequested.value) {
            progressLabel = t('flashDownload.progressStopping', {
              label: displayLabel,
              written: overallReceived.toLocaleString(),
              total: length.toLocaleString(),
            });
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
          t('flashDownload.incompleteChunk', {
            expected: currentChunkSize,
            received: chunkBuffer.length,
          })
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
        t('flashDownload.incompleteRead', {
          expected: length,
          received: totalReceived,
        })
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
    downloadProgress.label = t('flashDownload.completeLabel', { baud: baudLabel });
    flashReadStatusType.value = 'success';
    flashReadStatus.value = t('flashDownload.completeStatus', {
      name: finalName,
      bytes: length.toLocaleString(),
      baud: baudLabel,
    });
  }
  if (typeof onProgress === 'function') {
    onProgress({
      value: 100,
      label: t('flashDownload.progressComplete'),
      written: length,
      total: length,
    });
  }
  appendLog(
    t('flashDownload.downloadedLog', { label: displayLabel, file: finalName, baud: baudLabel }),
    '[ESPConnect-Debug]'
  );
  return finalName;
}

// Handle flash download flows (manual, partition, all, used, custom).
async function handleDownloadFlash(payload: DownloadFlashPayload = { mode: 'manual' }) {
  if (!loader.value) {
    flashReadStatus.value = t('flashDownload.connectFirst');
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
      const offset = parseNumericInput(flashReadOffset.value, t('flash.flashOffset'));
      const length = parseNumericInput(flashReadLength.value, t('flash.lengthBytes'));
      await downloadFlashRegion(offset, length, { label: t('flashDownload.manualLabel') });
      return;
    }

    if (mode === 'partition') {
      const option =
        (payload && payload.partition) ||
        partitionOptionLookup.value.get(selectedPartitionDownload.value);
      if (!option) {
        flashReadStatusType.value = 'warning';
        flashReadStatus.value = t('flashDownload.selectPartition');
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
        flashReadStatus.value = t('flashDownload.noPartitions');
        return;
      }
      downloadProgress.visible = true;
      downloadProgress.value = 0;
      downloadProgress.label = t('flashDownload.preparingPartitions', { count: partitions.length });
      let completed = 0;
      for (const option of partitions) {
        const partitionIndex = completed;
        const totalPartitions = partitions.length;
        const partitionFraction = 1 / totalPartitions;
        await downloadFlashRegion(option.offset, option.size, {
          label: option.baseLabel,
          fileName: sanitizeFileName(option.baseLabel + '_' + option.offsetHex, 'partition'),
          suppressStatus: true,
          onProgress: progress => {
            const partValue = Math.min(100, Math.max(0, progress?.value ?? 0));
            const overall = Math.min(100, (partitionIndex + partValue / 100) * partitionFraction * 100);
            downloadProgress.visible = true;
            downloadProgress.value = overall;
            const progressLabel = progress?.label
              ? progress.label
              : `${partValue.toFixed(0)}%`;
            downloadProgress.label = t('flashDownload.partitionProgress', {
              index: partitionIndex + 1,
              total: totalPartitions,
              label: option.baseLabel,
              progress: progressLabel,
            });
          },
        });
        completed += 1;
        downloadProgress.value = Math.min(100, (completed / totalPartitions) * 100);
        downloadProgress.label = t('flashDownload.partitionComplete', {
          index: completed,
          total: totalPartitions,
          label: option.baseLabel,
        });
      }
      downloadProgress.value = 100;
      downloadProgress.label = t('flashDownload.partitionsDownloaded', { count: partitions.length });
      downloadProgress.visible = false;
      flashReadStatusType.value = 'success';
      flashReadStatus.value = t('flashDownload.partitionsDownloaded', { count: partitions.length });
      return;
    }

    if (mode === 'used-flash') {
      const usedSegments = partitionSegments.value.filter(segment => !segment.isUnused);
      if (!usedSegments.length) {
        flashReadStatusType.value = 'warning';
        flashReadStatus.value = t('flashDownload.noUsage');
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
        label: t('flashDownload.usedFlashLabel'),
        fileName: sanitizeFileName('used_flash_' + ('0x' + minOffset.toString(16).toUpperCase()), 'used_flash'),
      });
      return;
    }

    if (mode === 'custom') {
      const offset = payload && payload.offset;
      const length = payload && payload.length;
      if (!Number.isInteger(offset) || !Number.isInteger(length)) {
        throw new Error(t('flashDownload.customNumeric'));
      }
      await downloadFlashRegion(offset, length, {
        label: payload && payload.label,
        fileName: payload && payload.fileName,
      });
      return;
    }

    flashReadStatusType.value = 'warning';
    flashReadStatus.value = t('flashDownload.unsupported');
  } catch (error) {
    downloadProgress.visible = false;
    if (error && error.message === 'Download cancelled by user') {
      flashReadStatusType.value = 'warning';
      flashReadStatus.value = t('flashDownload.cancelled');
    } else {
      flashReadStatusType.value = 'error';
      flashReadStatus.value = t('flashDownload.failed', { error: error && error.message ? error.message : error });
    }
  } finally {
    maintenanceBusy.value = false;
  }
}

// Download the selected partition via the flash reader.
async function handleDownloadPartition() {
  const option = partitionOptionLookup.value.get(selectedPartitionDownload.value);
  if (!option) {
    flashReadStatusType.value = 'warning';
    flashReadStatus.value = t('flashDownload.selectPartition');
    return;
  }
  await handleDownloadFlash({ mode: 'partition', partition: option });
}

// Download every partition found in the table.
async function handleDownloadAllPartitions() {
  const partitions = partitionDownloadOptions.value.filter(option => option.size > 0);
  if (!partitions.length) {
    flashReadStatusType.value = 'warning';
    flashReadStatus.value = t('flashDownload.noPartitions');
    return;
  }
  await handleDownloadFlash({ mode: 'all-partitions', partitions });
}

// Download only flash regions that contain data.
async function handleDownloadUsedFlash() {
  await handleDownloadFlash({ mode: 'used-flash' });
}

// Request cancellation of the current flash operation.
function handleCancelFlash() {
  if (!flashInProgress.value) {
    return;
  }
  if (!flashCancelRequested.value) {
    flashCancelRequested.value = true;
    flashProgressDialog.label = t('flashOps.stopping');
    appendLog(t('flashOps.cancelRequest'), '[ESPConnect-Warn]');
  }
}

// Request cancellation of the current flash download.
function handleCancelDownload(options: CancelDownloadOptions = {}) {
  if (downloadCancelRequested.value) {
    return;
  }
  downloadCancelRequested.value = true;
  const label = options?.label || t('flashDownload.stopping');
  if (downloadProgress.visible) {
    downloadProgress.label = label;
    flashReadStatusType.value = 'info';
    flashReadStatus.value = label;
  }
}

// Update flash read inputs when a partition option is chosen.
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

// Update MD5 target inputs based on integrity partition selection.
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
      t('md5.integritySetLog', {
        label: option.baseLabel,
        offset: option.offsetHex,
        length: md5Length.value,
      }),
      '[ESPConnect-Debug]'
    );
  } else if (value == null) {
    appendLog(t('md5.integrityClearedLog'), '[ESPConnect-Debug]');
  } else {
    md5StatusType.value = 'warning';
    md5Status.value = t('md5.partitionUnavailable');
    md5Result.value = null;
  }
}




// Erase flash (currently full-chip only) with confirmation.
async function handleEraseFlash(payload = { mode: 'full' }) {
  if (!loader.value) {
    flashReadStatus.value = t('flashErase.connectFirst');
    flashReadStatusType.value = 'warning';
    return;
  }
  if (payload?.mode !== 'full') {
    flashReadStatusType.value = 'warning';
    flashReadStatus.value = t('flashErase.unsupportedMode');
    return;
  }

  const confirmErase = await showConfirmation({
    title: t('flashErase.confirmTitle'),
    message: t('flashErase.confirmMessage'),
    confirmText: t('flashErase.confirm'),
    cancelText: t('buttons.cancel'),
    destructive: true,
  });
  if (!confirmErase) {
    flashReadStatusType.value = 'info';
    flashReadStatus.value = t('flashErase.cancelled');
    appendLog(t('flashErase.cancelledLog'), '[ESPConnect-Warn]');
    return;
  }

  try {
    maintenanceBusy.value = true;
    flashReadStatusType.value = 'info';
    flashReadStatus.value = t('flashErase.inProgress');
    await loader.value.eraseFlash();
    flashReadStatusType.value = 'success';
    flashReadStatus.value = t('flashErase.complete');
    appendLog(t('flashErase.completeLog'), '[ESPConnect-Debug]');
  } catch (error) {
    flashReadStatusType.value = 'error';
    flashReadStatus.value = t('flashErase.failed', { error: error?.message || error });
  } finally {
    maintenanceBusy.value = false;
  }
}

// Load a firmware file into memory for flashing.
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

// Apply a preset flash offset value.
function applyOffsetPreset(value) {
  if (value) {
    flashOffset.value = value;
    appendLog(`Applied preset offset ${value}.`);
  }
}

// Disconnect transport when the page is about to unload.
function handleBeforeUnload() {
  if (connected.value && transport.value) {
    transport.value.disconnect();
  }
}

onMounted(() => {
  window.addEventListener('beforeunload', handleBeforeUnload);
  if ('serial' in navigator && typeof navigator.serial?.addEventListener === 'function') {
    navigator.serial.addEventListener('disconnect', handleSerialDisconnectEvent);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload);
  if ('serial' in navigator && typeof navigator.serial?.removeEventListener === 'function') {
    navigator.serial.removeEventListener('disconnect', handleSerialDisconnectEvent);
  }
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

.spiffs-viewer__audio {
  width: 100%;
  max-width: 100%;
  display: block;
  margin: 0 auto;
  border-radius: 8px;
  background: color-mix(in srgb, var(--v-theme-surface) 60%, transparent);
}
</style>

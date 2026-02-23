<template>
  <v-app>
    <v-navigation-drawer permanent app elevation="1">
      <v-list>
        <v-list-item prepend-icon="mdi-usb" :title="t('app.title')" :subtitle="'v' + APP_VERSION">
        </v-list-item>
      </v-list>
      <v-list nav density="comfortable">
        <v-list-subheader class="app-drawer__label text-overline text-medium-emphasis">
          {{ t('app.sectionsLabel') }}
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
          {{ t('app.resourcesLabel') }}
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
          :disabled="!serialSupported || connected || busy" @click="connect" data-testid="connect-btn">
          <v-icon start>mdi-usb-flash-drive</v-icon>
          {{ t('actions.connect') }}
        </v-btn>
        <v-btn color="error" variant="outlined" density="comfortable" :disabled="!connected || busy" @click="disconnect"
          data-testid="disconnect-btn">
          <v-icon start>mdi-close-circle</v-icon>
          {{ t('actions.disconnect') }}
        </v-btn>
        <v-select v-model="selectedBaud" :items="baudrateOptions" :label="t('forms.baudRate')" density="compact"
          variant="outlined" hide-details class="status-select"
          :disabled="busy || flashInProgress || maintenanceBusy || baudChangeBusy || monitorActive" />
        <v-menu offset-y>
          <template #activator="{ props }">
            <v-btn variant="text" class="language-toggle-btn" v-bind="props" :title="languageMenuTitle">
              {{ currentLanguageLabel }}
              <v-icon>mdi-menu-down</v-icon>
            </v-btn>
          </template>
          <v-list>
            <v-list-item v-for="option in languageOptions" :key="option.code"
              :disabled="option.code === currentLanguage" @click="selectLanguage(option.code)">
              <v-list-item-title>{{ option.label }}</v-list-item-title>
              <v-icon v-if="option.code === currentLanguage" size="16">mdi-check</v-icon>
            </v-list-item>
          </v-list>
        </v-menu>
        <span v-if="higherBaudrateAvailable">

          <v-tooltip :text="t('tooltips.higherBaud')" location="bottom">
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
      <v-btn :title="`Switch to ${isDarkTheme ? 'light' : 'dark'} theme`" variant="text" icon size="small"
        @click="toggleTheme">
        <v-icon>{{ themeIcon }}</v-icon>
      </v-btn>
      <v-chip :color="connected ? 'success' : 'grey-darken-1'" class="text-capitalize" variant="elevated"
        density="comfortable" data-testid="connection-status">
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
            {{ t('alerts.browserUnsupported') }}
          </v-alert>
          <v-alert v-else-if="showSerialMonitorReconnectNotice" type="info" class="mb-4" variant="tonal"
            icon="mdi-console-line">
            {{ t('alerts.serialMonitorClosed') }}
          </v-alert>
          <v-window v-model="activeTab" class="app-tab-content">
            <v-window-item value="info">
              <DeviceInfoTab :chip-details="chipDetails" />
            </v-window-item>

            <v-window-item value="partitions">
              <PartitionsTab :partition-segments="partitionSegments" :formatted-partitions="formattedPartitions"
                :unused-summary="unusedFlashSummary" :flash-size-label="partitionFlashSizeLabel"
                :connected="connected" :partition-table-offset="partitionTableOffset"
                :busy="busy"
                @update:partition-table-offset="updatePartitionTableOffset"
                @refresh-partitions="refreshPartitionTable()" />
            </v-window-item>

            <v-window-item value="nvs">
              <NvsInspectorTab v-if="connected" :partitions="nvsPartitions" :selected-partition-id="nvsState.selectedId"
                :loading="nvsState.loading" :status="nvsState.status" :error="nvsState.error" :result="nvsState.result"
                :has-partition="hasNvsPartitionSelected" @select-partition="handleSelectNvsPartition"
                @read-nvs="handleReadNvs" />
              <DisconnectedState v-else icon="mdi-database-search" :min-height="420"
                :title="t('disconnected.defaultTitle')" :subtitle="t('disconnected.nvs')" />
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
                :title="t('disconnected.defaultTitle')" :subtitle="t('disconnected.spiffs')" />
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
                fs-label="LittleFS" :load-cancelled="littlefsState.loadCancelled" partition-title="LittleFS Partition"
                empty-state-message="No LittleFS files found. Read the partition or upload to begin."
                :is-file-viewable="isViewableSpiffsFile" :get-file-preview-info="resolveSpiffsViewInfo"
                @select-partition="handleSelectLittlefsPartition" @refresh="handleRefreshLittlefs"
                @backup="handleLittlefsBackup" @restore="handleLittlefsRestore"
                @download-file="handleLittlefsDownloadFile" @view-file="handleLittlefsView"
                @validate-upload="handleLittlefsUploadSelection" @upload-file="handleLittlefsUpload"
                @delete-file="handleLittlefsDelete" @format="handleLittlefsFormat" @save="handleLittlefsSave"
                @navigate="handleLittlefsNavigate" @navigate-up="handleLittlefsNavigateUp"
                @new-folder="handleLittlefsNewFolder" @reset-upload-block="handleLittlefsResetUploadBlock" />
              <DisconnectedState v-else icon="mdi-alpha-l-circle-outline" :min-height="420"
                :title="t('disconnected.defaultTitle')" :subtitle="t('disconnected.littlefs')" />
            </v-window-item>

            <v-window-item value="fatfs">
              <LittlefsManagerTab v-if="connected && fatfsAvailable" :partitions="fatfsPartitions"
                :selected-partition-id="fatfsState.selectedId" :files="fatfsVisibleFiles"
                :current-path="fatfsState.currentPath" :status="fatfsState.status" :loading="fatfsState.loading"
                :busy="fatfsState.busy" :saving="fatfsState.saving" :read-only="fatfsState.readOnly"
                :read-only-reason="fatfsState.readOnlyReason" :dirty="fatfsState.dirty"
                :backup-done="fatfsState.backupDone || fatfsState.sessionBackupDone" :error="fatfsState.error"
                :has-partition="hasFatfsPartitionSelected" :has-client="Boolean(fatfsState.client)"
                :usage="fatfsState.usage" :upload-blocked="fatfsState.uploadBlocked"
                :upload-blocked-reason="fatfsState.uploadBlockedReason" :load-cancelled="fatfsState.loadCancelled"
                :load-cancelled-message="t('filesystem.loadCancelled', {
                  fs: 'FATFS',
                  action: t('filesystem.controls.read'),
                })" fs-label="FATFS" partition-title="FATFS Partition"
                empty-state-message="No FATFS files found. Read the partition or upload to begin."
                :is-file-viewable="isViewableSpiffsFile" :get-file-preview-info="resolveSpiffsViewInfo"
                @select-partition="handleSelectFatfsPartition" @refresh="handleRefreshFatfs" @backup="handleFatfsBackup"
                @restore="handleFatfsRestore" @download-file="handleFatfsDownloadFile" @view-file="handleFatfsView"
                @validate-upload="handleFatfsUploadSelection" @upload-file="handleFatfsUpload"
                @delete-file="handleFatfsDelete" @format="handleFatfsFormat" @save="handleFatfsSave"
                @navigate="handleFatfsNavigate" @navigate-up="handleFatfsNavigateUp" @new-folder="handleFatfsNewFolder"
                @reset-upload-block="handleFatfsResetUploadBlock" />
              <DisconnectedState v-else icon="mdi-alpha-f-circle-outline" :min-height="420"
                :title="t('disconnected.defaultTitle')" :subtitle="t('disconnected.fatfs')" />
            </v-window-item>

            <v-window-item value="apps">
              <AppsTab v-if="connected" :apps="appPartitions" :active-slot-id="activeAppSlotId"
                :active-summary="appActiveSummary" :loading="appMetadataLoading" :error="appMetadataError" />
              <DisconnectedState v-else icon="mdi-application-cog-outline" :min-height="420"
                :title="t('disconnected.defaultTitle')" :subtitle="t('disconnected.apps')" />
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
              <DisconnectedState v-else icon="mdi-chip" :min-height="420" :title="t('disconnected.defaultTitle')"
                :subtitle="t('disconnected.flash')" />
            </v-window-item>
            <v-window-item value="console">
              <SerialMonitorTab :monitor-text="monitorText" :monitor-active="monitorActive"
                :monitor-error="monitorError" :monitor-starting="monitorStarting" :can-start="canStartMonitor"
                :can-command="canIssueMonitorCommands" @start-monitor="startMonitor" @stop-monitor="stopMonitor()"
                @clear-monitor="clearMonitorOutput" @send-monitor-text="sendMonitorText"
                @reset-board="enterUserFirmware" />
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
              {{ confirmationDialog.title || t('dialogs.confirmationTitle') }}
            </v-card-title>
            <v-card-text class="text-body-2">
              <div class="confirmation-message">
                {{ confirmationDialog.message }}
              </div>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn variant="text" @click="resolveConfirmation(false)">
                {{ confirmationDialog.cancelText || t('dialogs.cancel') }}
              </v-btn>
              <v-btn :color="confirmationDialog.destructive ? 'error' : 'primary'" variant="tonal"
                @click="resolveConfirmation(true)">
                {{ confirmationDialog.confirmText || t('dialogs.continue') }}
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <v-dialog :model-value="connectDialog.visible" persistent max-width="420" class="progress-dialog">
          <v-card>
            <v-card-title class="text-h6">
              <v-icon start color="primary">mdi-usb</v-icon>
              {{ t('dialogs.connecting') }}
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
              {{ t('dialogs.littlefsBackup') }}
            </v-card-title>
            <v-card-text class="progress-dialog__body">
              <div class="progress-dialog__label">
                {{ littlefsBackupDialog.label || t('dialogs.preparingBackup') }}
              </div>
              <v-progress-linear :model-value="littlefsBackupDialog.value" height="24" color="primary" rounded>
                <strong>{{ Math.min(100, Math.max(0, Math.floor(littlefsBackupDialog.value))) }}%</strong>
              </v-progress-linear>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn variant="text" @click="cancelLittlefsBackup">
                {{ t('dialogs.cancel') }}
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <v-dialog :model-value="littlefsLoadingDialog.visible" persistent max-width="420" class="progress-dialog">
          <v-card>
            <v-card-title class="text-h6">
              <v-icon start color="primary">mdi-folder-sync</v-icon>
              {{ t('dialogs.littlefsLoading') }}
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
                {{ t('dialogs.cancel') }}
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <v-dialog :model-value="littlefsSaveDialog.visible" persistent max-width="420" class="progress-dialog">
          <v-card>
            <v-card-title class="text-h6">
              <v-icon start color="primary">mdi-floppy</v-icon>
              {{ t('dialogs.littlefsSaving') }}
            </v-card-title>
            <v-card-text class="progress-dialog__body">
              <div class="progress-dialog__label">
                {{ littlefsSaveDialog.label || t('dialogs.writingLittlefs') }}
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
              {{ t('dialogs.littlefsRestoring') }}
            </v-card-title>
            <v-card-text class="progress-dialog__body">
              <div class="progress-dialog__label">
                {{ littlefsRestoreDialog.label || t('dialogs.writingLittlefs') }}
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
              {{ t('dialogs.fatfsBackup') }}
            </v-card-title>
            <v-card-text class="progress-dialog__body">
              <div class="progress-dialog__label">
                {{ fatfsBackupDialog.label || t('dialogs.preparingBackup') }}
              </div>
              <v-progress-linear :model-value="fatfsBackupDialog.value" height="24" color="primary" rounded>
                <strong>{{ Math.min(100, Math.max(0, Math.floor(fatfsBackupDialog.value))) }}%</strong>
              </v-progress-linear>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn variant="text" @click="cancelFatfsBackup">
                {{ t('dialogs.cancel') }}
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <v-dialog :model-value="fatfsLoadingDialog.visible" persistent max-width="420" class="progress-dialog">
          <v-card>
            <v-card-title class="text-h6">
              <v-icon start color="primary">mdi-folder-sync</v-icon>
              Loading FATFS
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
                Cancel
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <v-dialog :model-value="fatfsSaveDialog.visible" persistent max-width="420" class="progress-dialog">
          <v-card>
            <v-card-title class="text-h6">
              <v-icon start color="primary">mdi-floppy</v-icon>
              Saving FATFS
            </v-card-title>
            <v-card-text class="progress-dialog__body">
              <div class="progress-dialog__label">
                {{ fatfsSaveDialog.label || 'Writing FATFS image...' }}
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
              Restoring FATFS
            </v-card-title>
            <v-card-text class="progress-dialog__body">
              <div class="progress-dialog__label">
                {{ fatfsRestoreDialog.label || 'Writing FATFS image...' }}
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
              <v-progress-linear :model-value="spiffsLoadingDialog.value"
                :indeterminate="spiffsLoadingDialog.value <= 0" height="24" color="primary" rounded />
            </v-card-text>
            <v-card-actions class="progress-dialog__actions">
              <v-spacer />
              <v-btn variant="text" :disabled="spiffsLoadCancelRequested" @click="cancelSpiffsLoad">
                Cancel
              </v-btn>
            </v-card-actions>
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

        <v-dialog v-model="showBusyDialog" width="420">
          <v-card>
            <v-card-title class="text-h6">
              <v-icon start color="warning">mdi-lock-alert</v-icon>
              Port Busy
            </v-card-title>
            <v-card-text>
              <p class="text-body-2">
                {{
                  busyDialogMessage ||
                  ['The selected serial port is busy.', 'Close any other apps or tabs using it and try again.'].join(' ')
                }}
              </p>
              <p class="text-caption text-medium-emphasis">
                If you just disconnected from another tool, wait a moment for the OS to release the port.
              </p>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn color="primary" variant="text" @click="showBusyDialog = false">
                Got it
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <v-dialog v-model="showGeneralErrorDialog" width="420">
          <v-card>
            <v-card-title class="text-h6">
              <v-icon start color="error">mdi-alert-circle-outline</v-icon>
              Processing Error
            </v-card-title>
            <v-card-text>
              <p class="text-body-2">
                An error occurred while processing information from the device.
              </p>
              <p class="text-caption text-medium-emphasis" v-if="lastErrorMessage">
                Last error: {{ lastErrorMessage }}
              </p>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn color="primary" variant="text" @click="showGeneralErrorDialog = false">
                Got it
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
            <v-card-subtitle>
              Last error: {{ lastErrorMessage }}
            </v-card-subtitle>
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
                <img v-if="spiffsViewerDialog.mode === 'image' && spiffsViewerDialog.imageUrl"
                  :src="spiffsViewerDialog.imageUrl" class="spiffs-viewer__image" :alt="spiffsViewerDialog.name" />
                <audio v-else-if="spiffsViewerDialog.mode === 'audio' && spiffsViewerDialog.audioUrl"
                  :src="spiffsViewerDialog.audioUrl" class="spiffs-viewer__audio" controls preload="auto">
                  Your browser does not support audio playback.
                </audio>
                <pre v-else class="spiffs-viewer__content">{{ spiffsViewerDialog.content }}</pre>
              </template>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn variant="text" @click="closeSpiffsViewer">
                Close
              </v-btn>
              <v-btn color="primary" variant="tonal" :disabled="!spiffsViewerDialog.name"
                @click="handleFilesystemViewerDownload">
                <v-icon start>mdi-download</v-icon>
                Download
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <v-snackbar v-model="toast.visible" :timeout="toast.timeout" :color="toast.color" location="bottom right"
          data-testid="toast-container">
          {{ toast.message }}
        </v-snackbar>
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useTheme } from 'vuetify';
import DeviceInfoTab from './components/DeviceInfoTab.vue';
import FlashFirmwareTab from './components/FlashFirmwareTab.vue';
import AppsTab from './components/AppsTab.vue';
import FilesystemManagerTab from './components/FilesystemManagerTab.vue';
import LittlefsManagerTab from './components/LittlefsManagerTab.vue';
import NvsInspectorTab from './components/NvsInspectorTab.vue';
import AboutTab from './components/AboutTab.vue';
import PartitionsTab from './components/PartitionsTab.vue';
import SessionLogTab from './components/SessionLogTab.vue';
import SerialMonitorTab from './components/SerialMonitorTab.vue';
import DisconnectedState from './components/DisconnectedState.vue';
import registerGuides from './data/register-guides.json';
import { createSpiffsFromImage, SpiffsErrorCode } from './wasm/spiffs';
import { useFatfsManager, useLittlefsManager, useSpiffsManager } from './composables/useFilesystemManagers';
import { useDialogs } from './composables/useDialogs';
import { getLanguage, setLanguage, SupportedLocale } from './plugins/i18n';
import { readPartitionTable, probePartitionTableOffset } from './utils/partitions';
import { detectActiveOtaSlot } from './utils/ota';
import type { ESPLoader } from 'tasmota-webserial-esptool';
import { createEsptoolClient, requestSerialPort, type CompatibleTransport, type EsptoolClient, type StatusPayload } from './services/esptoolClient';
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
import { FACT_GROUP_CONFIG, FACT_ICONS, getFactLabelKey } from './constants/deviceFacts';
import { findChipDocs } from './constants/chipDocsLinks';
import { PWM_TABLE } from './utils/pwm-capabilities-table';
import { parseNvsPartition, type NvsParseResult } from './lib/nvs/nvsParser';
import type { AppPartitionMetadata } from './types/app-partitions';
import type { DeviceDetails, DeviceFact, DeviceFactGroup } from './types/device-details';
import type { FilePreviewInfo } from './types/filesystem';
import type { LittlefsDiskVersionFormatter, LittlefsEntry, LittlefsEntryType, LittlefsUploadPayload } from './types/littlefs';
import type { FormattedPartitionRow, PartitionSegment, UnusedFlashSummary } from './types/partitions';
import type { SerialMonitorError } from './types/serial-monitor';
import type { SessionLogTabRef } from './types/session-log';
import type {
  AlertType,
  EraseFlashPayload,
  PartitionOptionValue,
  ProgressDialogState,
  RegisterOption,
  RegisterReference,
} from './types/flash-firmware';

type LittlefsWasmModule = typeof import('./wasm/littlefs/index.js');
type FatfsWasmModule = typeof import('./wasm/fatfs/index.js');
type DetectedFilesystem = 'littlefs' | 'fatfs' | 'spiffs';
type PartitionTableEntry = {
  label: string;
  type: number;
  subtype: number;
  offset: number;
  size: number;
  detectedFilesystem?: DetectedFilesystem;
};
type FilesystemPartition = { id: number; label: string; offset: number; size: number; sizeText: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizePartitionId(value: string | number | null): number | null {
  if (value == null) {
    return null;
  }
  const parsed = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(parsed) ? parsed : null;
}

let littlefsModulePromise: Promise<LittlefsWasmModule> | null = null;
let fatfsModulePromise: Promise<FatfsWasmModule> | null = null;
const littlefsFormatDiskVersion = ref<LittlefsDiskVersionFormatter | null>(null);

// Lazy-load and cache the LittleFS WASM module.
async function loadLittlefsModule(): Promise<LittlefsWasmModule> {
  if (!littlefsModulePromise) {
    littlefsModulePromise = import('./wasm/littlefs/index.js')
      .then(module => {
        littlefsFormatDiskVersion.value =
          typeof module.formatDiskVersion === 'function' ? module.formatDiskVersion : null;
        return module;
      })
      .catch((error: unknown) => {
        littlefsModulePromise = null;
        littlefsFormatDiskVersion.value = null;
        throw error;
      });
  }
  return littlefsModulePromise;
}

// Normalize filesystem paths by enforcing a leading slash and collapsing separators.
function normalizeFsPath(path: string | null | undefined = '/') {
  let p = path || '/';
  p = p.startsWith('/') ? p : `/${p}`;
  p = p.replace(/\/+/g, '/');
  if (p.length > 1 && p.endsWith('/')) {
    p = p.slice(0, -1);
  }
  return p || '/';
}

const FATFS_MOUNT_PREFIX = '/fatfs';

function toFatfsClientPath(path: string | null | undefined = '/') {
  const normalized = normalizeFsPath(path);
  if (normalized === '/') {
    return FATFS_MOUNT_PREFIX;
  }
  return `${FATFS_MOUNT_PREFIX}${normalized}`;
}

function stripFatfsMountPath(value?: string | null) {
  if (!value) {
    return value;
  }
  if (value === FATFS_MOUNT_PREFIX) {
    return '/';
  }
  if (value.startsWith(`${FATFS_MOUNT_PREFIX}/`)) {
    return value.slice(FATFS_MOUNT_PREFIX.length);
  }
  return value;
}

// Estimate LittleFS storage footprint for a single file (data + metadata block).
function littlefsEstimateFileFootprint(size = 0) {
  const block = littlefsState.blockSize || 1;
  const dataBytes = Math.max(1, Math.ceil(size / block)) * block;
  const metadataBytes = block; // per-file metadata block
  return dataBytes + metadataBytes;
}

// Estimate total LittleFS usage for a set of entries.
function littlefsEstimateUsage(entries: LittlefsEntry[] | null | undefined) {
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
function isDirectChildPath(childPath: string | null | undefined, basePath: string | null | undefined) {
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
function joinFsPath(basePath: string | null | undefined, name: string | null | undefined) {
  const base = normalizeFsPath(basePath);
  const cleanedName = String(name || '').replace(/\/+/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
  if (!cleanedName) return base;
  return normalizeFsPath(`${base}/${cleanedName}`);
}

// Lazy-load and cache the FATFS WASM module.
async function loadFatfsModule(): Promise<FatfsWasmModule> {
  if (!fatfsModulePromise) {
    fatfsModulePromise = import('./wasm/fatfs/index.js').catch((error: unknown) => {
      fatfsModulePromise = null;
      throw error;
    });
  }
  return fatfsModulePromise;
}

// Normalize LittleFS entry objects and paths into a consistent structure.
function normalizeLittlefsEntries(entries: unknown, basePath = '/'): LittlefsEntry[] {
  if (!Array.isArray(entries)) {
    return [];
  }
  const base = normalizeFsPath(basePath || '/');
  const baseName = base.split('/').filter(Boolean).pop() || '';

  type RawLittlefsEntry = {
    path?: unknown;
    name?: unknown;
    size?: unknown;
    isDirectory?: unknown;
    type?: unknown;
  };

  return entries
    .map(entry => {
      const rawEntry = entry as RawLittlefsEntry | null | undefined;
      const rawPath = String(rawEntry?.path ?? rawEntry?.name ?? '');
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
      const isDir = rawEntry?.isDirectory === true || rawEntry?.type === 'dir';
      const type: LittlefsEntryType = isDir ? 'dir' : 'file';
      return {
        name,
        path,
        type,
        size: Number(rawEntry?.size ?? 0) || 0,
      };
    })
    .filter((entry): entry is LittlefsEntry => Boolean(entry));
}

function normalizeFatfsEntries(entries: unknown, basePath = '/'): LittlefsEntry[] {
  if (!Array.isArray(entries)) {
    return [];
  }
  const adjusted = entries.map(entry => {
    if (entry && typeof entry === 'object') {
      const rawPath = (entry as Record<string, unknown>).path;
      if (typeof rawPath === 'string') {
        return { ...entry, path: stripFatfsMountPath(rawPath) };
      }
    }
    return entry;
  });
  return normalizeLittlefsEntries(adjusted, basePath);
}

// Detect common signatures that indicate an unformatted LittleFS image.
function isLittlefsUnformattedError(error: unknown) {
  if (!error) {
    return false;
  }
  if (isRecord(error)) {
    const code = error.code;
    if (typeof code === 'number' && code === -84) {
      return true;
    }
  }
  const message = isRecord(error) && typeof error.message === 'string' ? error.message : String(error);
  const normalizedMessage = message.toLowerCase();
  return (
    normalizedMessage.includes('failed to initialize littlefs from image') ||
    normalizedMessage.includes('corrupted dir pair')
  );
}

// Check if a LittleFS image is all 0xFF (blank).
function isBlankLittlefsImage(image: unknown) {
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
function markLittlefsDirty(message?: string) {
  littlefsState.dirty = true;
  if (message) {
    littlefsState.status = message;
  }
}

// Mark the FATFS state as dirty and optionally set a status message.
function markFatfsDirty(message?: string) {
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
async function loadLittlefsPartition(partition: FilesystemPartition) {
  if (!loader.value || !partition) {
    littlefsState.error = 'Connect to a device with a LittleFS partition first.';
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
  littlefsState.status = `Reading LittleFS @ 0x${partition.offset.toString(16).toUpperCase()}${littlefsBaudLabel}...`;
  littlefsLoadingDialog.visible = true;
  littlefsLoadingDialog.label = `Reading LittleFS${littlefsBaudLabel}...`;
  const attemptedConfigs = [];
  try {
    const image = await readFlashToBuffer(partition.offset, partition.size, {
      label: `LittleFS${littlefsBaudLabel}`,
      cancelSignal: littlefsLoadCancelRequested,
      onProgress: progress => {
        littlefsLoadingDialog.label = progress.label ?? littlefsLoadingDialog.label;
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
      throw new Error('LittleFS module is missing createLittleFSFromImage(). Update the WASM bundle.');
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
          littlefsState.status =
            'LittleFS partition appears blank. Download a backup, click Format, then Save to Flash to initialize it.';
          appendLog('LittleFS partition appears blank/unformatted. Format then save to persist.', '[ESPConnect-Warn]');
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
      littlefsState.readOnlyReason = 'LittleFS image unreadable (unsupported layout or encrypted).';
      littlefsState.status = 'LittleFS is read-only.';
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
    littlefsState.status = count === 1 ? 'Loaded 1 file.' : `Loaded ${count} files.`;
    appendLog(
      `LittleFS partition ${partition.label} loaded (${count} file${count === 1 ? '' : 's'}).`,
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
      littlefsState.status = 'LittleFS load cancelled. Use "Read" to fetch the partition again.';
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
      littlefsState.readOnlyReason = 'LittleFS image unreadable.';
      littlefsState.status = 'LittleFS is read-only.';
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
function handleSelectLittlefsPartition(partitionId: string | number | null) {
  if (littlefsState.loading || littlefsState.busy || littlefsState.saving) {
    return;
  }
  const id = normalizePartitionId(partitionId);
  littlefsState.selectedId = id;
  littlefsState.client = null;
  littlefsState.files = [];
  littlefsState.currentPath = '/';
  littlefsState.status = 'Loading LittleFS...';
  const partition =
    (id != null ? littleFsPartitions.value.find(entry => entry.id === id) : null) ?? littleFsPartitions.value[0];
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
  if (!partition) {
    littlefsState.status = 'Select a LittleFS partition first.';
    return;
  }
  if (!loader.value) {
    littlefsState.status = 'Connect to a device first.';
    return;
  }
  littlefsBackupDialog.visible = true;
  littlefsBackupDialog.value = 0;
  littlefsBackupDialog.label = 'Preparing backup...';
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
    littlefsState.status = 'Backup downloaded. You can now save changes.';
    appendLog('LittleFS backup downloaded.', '[ESPConnect-Debug]');
  } catch (error) {
    const message = formatErrorMessage(error);
    if (message === 'Download cancelled by user') {
      littlefsState.error = null;
      littlefsState.status = 'LittleFS backup cancelled.';
    } else {
      littlefsState.error = message;
      littlefsState.status = 'LittleFS backup failed.';
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
  littlefsBackupDialog.label = 'Stopping backup...';
  handleCancelDownload();
}

// Request cancellation of an in-progress LittleFS load.
function cancelLittlefsLoad() {
  if (!littlefsLoadingDialog.visible || littlefsLoadCancelRequested.value) {
    return;
  }
  littlefsLoadCancelRequested.value = true;
  littlefsLoadingDialog.label = 'Stopping LittleFS load...';
}

// Restore a LittleFS image to the selected partition.
async function handleLittlefsRestore(file: File | null) {
  const partition = littlefsSelectedPartition.value;
  if (!partition) return;
  if (!file) return;
  const buffer = new Uint8Array(await file.arrayBuffer());
  if (buffer.length !== partition.size) {
    littlefsState.status = `Restore file must be exactly ${formatBytes(partition.size) ?? `${partition.size} bytes`}.`;
    return;
  }
  const fileLabel = file.name ? `"${file.name}"` : 'the selected image';
  const confirmed = await showConfirmation({
    title: 'Restore LittleFS Partition',
    message: `This will overwrite the entire LittleFS partition with ${fileLabel}. Continue?`,
    confirmText: 'Restore',
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
    littlefsRestoreDialog.label = 'Writing LittleFS image...';
    await writeFilesystemImage(partition, buffer, {
      label: 'LittleFS',
      state: littlefsState,
      onProgress: progress => {
        littlefsRestoreDialog.value = progress.value ?? 0;
        littlefsRestoreDialog.label = progress.label || 'Writing LittleFS image...';
      },
    });
    littlefsState.status = 'LittleFS image restored.';
    littlefsState.backupDone = true;
    appendLog('LittleFS partition restored from backup.', '[ESPConnect-Debug]');
    await loadLittlefsPartition(partition);
  } catch (error) {
    littlefsState.error = formatErrorMessage(error);
    littlefsState.status = 'LittleFS restore failed.';
  } finally {
    littlefsState.saving = false;
    maintenanceBusy.value = false;
    littlefsRestoreDialog.visible = false;
    littlefsRestoreDialog.value = 0;
    littlefsRestoreDialog.label = 'Restoring LittleFS image...';
  }
}

// Validate a selected file before queueing a LittleFS upload.
function handleLittlefsUploadSelection(file: File | null) {
  if (!file || !littlefsState.client) {
    littlefsState.uploadBlocked = false;
    littlefsState.uploadBlockedReason = '';
    return;
  }
  const targetPath = joinFsPath(littlefsState.currentPath || '/', file.name);
  const partition = littlefsSelectedPartition.value;
  updateLittlefsUsage(partition);
  const partitionSize =
    littlefsState.usage?.capacityBytes ?? partition?.size ?? littlefsState.blockSize * littlefsState.blockCount;
  const usageSource = littlefsState.allFiles?.length ? littlefsState.allFiles : littlefsState.files;
  const usedBytes = littlefsState.usage?.usedBytes ?? littlefsEstimateUsage(usageSource);
  const existingEntry = usageSource.find(entry => entry.path === targetPath);
  const existingFootprint =
    existingEntry?.type === 'dir'
      ? littlefsState.blockSize || existingEntry?.size || 0
      : littlefsEstimateFileFootprint(existingEntry?.size ?? 0);
  const incomingFootprint = littlefsEstimateFileFootprint(file.size);
  const availableBytes =
    partitionSize && typeof littlefsState.usage?.freeBytes === 'number'
      ? littlefsState.usage.freeBytes + existingFootprint
      : partitionSize
        ? partitionSize - usedBytes + existingFootprint
        : 0;
  if (partitionSize && incomingFootprint > availableBytes) {
    const message =
      'Not enough LittleFS space for this file. Delete files or format the partition, then try again.';
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
async function handleLittlefsUpload(payload: LittlefsUploadPayload) {
  // serialize uploads to avoid parallel free-space races
  littlefsUploadQueue = littlefsUploadQueue.then(() => performLittlefsUpload(payload));
  return littlefsUploadQueue;
}

// Perform a LittleFS upload or folder creation with size and conflict checks.
async function performLittlefsUpload(payload: LittlefsUploadPayload) {
  const { file, path, isDir } = payload;
  if (littlefsState.uploadBlocked) {
    console.warn('[ESPConnect-LittleFS] upload skipped because blocked', {
      path,
      reason: littlefsState.uploadBlockedReason,
    });
    return;
  }
  if (!littlefsState.client) return;
  if (littlefsState.readOnly) {
    littlefsState.status = littlefsState.readOnlyReason || 'LittleFS is read-only.';
    showToast(littlefsState.status, { color: 'info' });
    return;
  }
  if (littlefsState.uploadBlocked) {
    littlefsState.status = littlefsState.uploadBlockedReason || 'Resolve blocked upload before continuing.';
    if (littlefsState.uploadBlockedReason) {
      showUploadError(littlefsState.uploadBlockedReason);
    }
    return;
  }
  const partition = littlefsSelectedPartition.value;
  updateLittlefsUsage(partition);
  const partitionSize =
    littlefsState.usage?.capacityBytes ?? partition?.size ?? littlefsState.blockSize * littlefsState.blockCount;
  const usageSource = littlefsState.allFiles?.length ? littlefsState.allFiles : littlefsState.files;
  const usedBytes = littlefsState.usage?.usedBytes ?? littlefsEstimateUsage(usageSource);
  let workingFreeBytes =
    typeof littlefsState.usage?.freeBytes === 'number'
      ? littlefsState.usage.freeBytes
      : partitionSize
        ? Math.max(partitionSize - usedBytes, 0)
        : Number.POSITIVE_INFINITY;
  const derivedIsDir = isDir === true || (!file && !!path);
  if (derivedIsDir && !file && path) {
    const targetDir = joinFsPath(littlefsState.currentPath || '/', path);
    const exists =
      usageSource.find(entry => entry.path === targetDir && entry.type === 'dir') !== undefined;
    if (exists) {
      const msg = `Folder "${targetDir}" already exists.`;
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
    littlefsState.status = 'Selected file has no name. Rename it and try again.';
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
    const message =
      'Not enough LittleFS space for this upload. Delete files or format the partition, then try again.';
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
    markLittlefsDirty(`Staged ${target}. Remember to Save.`);
    appendLog(`LittleFS staged ${target} (${data.length.toLocaleString()} bytes).`, '[ESPConnect-Debug]');
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
    const code = isRecord(error) && typeof error.code === 'number' ? error.code : null;
    const normalized = msg.toLowerCase();
    const spaceError =
      code === -28 ||
      normalized.includes('no space') ||
      normalized.includes('no more free space') ||
      normalized.includes('unable to add file') ||
      normalized.includes('nospace') ||
      normalized.includes('enospc');
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
async function handleLittlefsDelete(path: string) {
  if (!littlefsState.client || littlefsState.readOnly) {
    return;
  }
  const targetPath = normalizeFsPath(path);
  const entry = littlefsState.files.find(f => normalizeFsPath(f.path) === targetPath);
  const isDir = entry?.type === 'dir';
  const confirmed = await showConfirmation({
    title: isDir ? 'Delete Folder' : 'Delete File',
    message: `Delete ${targetPath} from LittleFS? This cannot be undone.`,
    confirmText: 'Delete',
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
      throw new Error('Delete operation not supported by LittleFS client.');
    }
    await refreshLittlefsListing();
    markLittlefsDirty(`${targetPath} deleted. Save to persist.`);
    appendLog(`LittleFS staged deletion of ${targetPath}.`, '[ESPConnect-Debug]');
  } catch (error) {
    littlefsState.error = formatErrorMessage(error);
  } finally {
    littlefsState.busy = false;
  }
}

// Navigate to a specific path within LittleFS.
async function handleLittlefsNavigate(path: string) {
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
  const folderName = (name || prompt('New folder name'))?.toString().trim();
  if (!folderName) return;
  if (folderName.includes('/') || folderName.includes('..')) {
    showToast('Folder name cannot contain slashes or "..".', { color: 'warning' });
    return;
  }
  const targetPath = joinFsPath(littlefsState.currentPath || '/', folderName);
  const existingDir =
    littlefsState.allFiles?.find(entry => entry.path === targetPath && entry.type === 'dir') ||
    littlefsState.files.find(entry => entry.path === targetPath && entry.type === 'dir');
  if (existingDir) {
    const msg = `Folder "${folderName}" already exists here.`;
    showToast(msg, { color: 'warning' });
    littlefsState.status = msg;
    return;
  }
  try {
    littlefsState.busy = true;
    if (typeof littlefsState.client.mkdir === 'function') {
      littlefsState.client.mkdir(targetPath);
    } else {
      showToast('mkdir is not available in the LittleFS client.', { color: 'error' });
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
    title: 'Format LittleFS',
    message: 'Erase all files from the LittleFS image? You must Save to apply.',
    confirmText: 'Format',
    destructive: true,
  });
  if (!confirmed) return;
  try {
    littlefsState.busy = true;
    littlefsState.client.format();
    await refreshLittlefsListing();
    markLittlefsDirty('LittleFS formatted. Save to apply.');
    appendLog('LittleFS staged format operation.', '[ESPConnect-Debug]');
  } catch (error) {
    littlefsState.error = formatErrorMessage(error);
  } finally {
    littlefsState.busy = false;
  }
}

// Persist staged LittleFS changes back to flash.
async function handleLittlefsSave() {
  if (!littlefsState.client) {
    littlefsState.status = 'Load a LittleFS partition first.';
    return;
  }
  if (littlefsState.readOnly) {
    littlefsState.status = littlefsState.readOnlyReason || 'LittleFS is read-only.';
    return;
  }
  if (!littlefsState.dirty) {
    littlefsState.status = 'No staged changes to save.';
    return;
  }
  if (!hasLittlefsBackup()) {
    littlefsState.status = 'Download a LittleFS backup before saving (one backup per session is enough).';
    return;
  }
  const partition = littlefsSelectedPartition.value;
  if (!partition) {
    littlefsState.status = 'Select a LittleFS partition.';
    return;
  }
  const diff = computeLittlefsDiff();
  const summaryParts = [];
  if (diff.added.length) summaryParts.push(`Added: ${diff.added.join(', ')}`);
  if (diff.modified.length) summaryParts.push(`Modified: ${diff.modified.join(', ')}`);
  if (diff.removed.length) summaryParts.push(`Removed: ${diff.removed.join(', ')}`);
  const summary =
    summaryParts.length > 0
      ? summaryParts.join('\n')
      : 'No file-level changes detected (still writing updated image).';
  const confirmed = await showConfirmation({
    title: 'Write LittleFS to Flash',
    message: `${summary}\n\nWrite these changes to flash now?`,
    confirmText: 'Save to Flash',
    destructive: true,
  });
  if (!confirmed) return;
  try {
    littlefsState.saving = true;
    maintenanceBusy.value = true;
    littlefsSaveDialog.visible = true;
    const image = littlefsState.client.toImage();
    if (image.length > partition.size) {
      throw new Error('LittleFS image exceeds partition size.');
    }
    await writeFilesystemImage(partition, image, {
      label: 'LittleFS',
      state: littlefsState,
      onProgress: progress => {
        littlefsSaveDialog.value = progress.value ?? 0;
        littlefsSaveDialog.label = progress.label || 'Writing LittleFS image...';
      },
    });
    littlefsState.dirty = false;
    littlefsState.status = 'LittleFS saved to flash.';
    appendLog('LittleFS partition updated on flash.', '[ESPConnect-Debug]');
    await loadLittlefsPartition(partition);
  } catch (error) {
    littlefsState.error = formatErrorMessage(error);
    littlefsState.status = 'LittleFS save failed.';
  } finally {
    littlefsState.saving = false;
    maintenanceBusy.value = false;
    littlefsSaveDialog.visible = false;
    littlefsSaveDialog.value = 0;
    littlefsSaveDialog.label = 'Saving LittleFS...';
  }
}

// Read a LittleFS file and return its raw bytes.
async function readLittlefsFile(path: string) {
  if (!littlefsState.client) {
    throw new Error('LittleFS client unavailable.');
  }
  if (!path) {
    throw new Error('File path is required.');
  }
  const reader =
    typeof littlefsState.client.readFile === 'function'
      ? littlefsState.client.readFile
      : typeof littlefsState.client.read === 'function'
        ? littlefsState.client.read
        : null;
  if (!reader) {
    throw new Error('LittleFS module does not support per-file reads. Update the WASM bundle.');
  }
  const result = reader.call(littlefsState.client, path);
  const data = result instanceof Promise ? await result : result;
  if (!(data instanceof Uint8Array)) {
    throw new Error('LittleFS read returned unexpected data.');
  }
  return data;
}

// Download a LittleFS file to the host.
async function handleLittlefsDownloadFile(path: string) {
  if (!littlefsState.client || !path) return;
  try {
    const data = await readLittlefsFile(path);
    const name = path.split('/').filter(Boolean).pop() || 'file.bin';
    saveBinaryFile(name, data);
    appendLog(`LittleFS downloaded ${path} (${data.length.toLocaleString()} bytes).`, '[ESPConnect-Debug]');
  } catch (error) {
    littlefsState.error = formatErrorMessage(error);
    littlefsState.status = 'LittleFS download failed.';
  }
}

// Preview a LittleFS file using the SPIFFS viewer dialog.
async function handleLittlefsView(path: string) {
  if (!littlefsState.client) return;
  const name = path.split('/').filter(Boolean).pop() || path;
  const viewInfo = resolveSpiffsViewInfo(name);
  if (!viewInfo) {
    littlefsState.status = 'This file type cannot be previewed. Download it instead.';
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
      throw new Error(
        `File too large to preview (limit ${formatBytes(SPIFFS_VIEWER_MAX_BYTES) ?? SPIFFS_VIEWER_MAX_BYTES} bytes).`,
      );
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
async function loadFatfsPartition(partition: FilesystemPartition) {
  if (!loader.value || !partition) {
    fatfsState.error = 'Connect to a device with a FATFS partition first.';
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
  fatfsState.status = `Reading FATFS @ 0x${partition.offset.toString(16).toUpperCase()}${baudLabel}...`;
  fatfsLoadingDialog.visible = true;
  fatfsLoadingDialog.label = `Reading ${partition.label || 'FATFS'}${baudLabel}...`;
  try {
    const image = await readFlashToBuffer(partition.offset, partition.size, {
      label: `${partition.label || 'FATFS'}${baudLabel}`,
      cancelSignal: fatfsLoadCancelRequested,
      onProgress: progress => {
        fatfsLoadingDialog.label = progress.label ?? fatfsLoadingDialog.label;
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
      throw new Error('FATFS module is missing createFatFSFromImage(). Update the WASM bundle.');
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
      const createFatFS = typeof module.createFatFS === 'function' ? module.createFatFS : null;
      if (createFatFS) {
        client = await createFatFS({
          blockSize,
          blockCount,
          formatOnInit: true,
        });
        fatfsState.status =
          'FATFS partition appears blank. Download a backup, click Format, then Save to Flash to initialize it.';
        appendLog('FATFS partition appears blank/unformatted. Format then save to persist.', '[ESPConnect-Warn]');
      } else {
        throw error;
      }
    }
    fatfsState.client = client;
    fatfsState.currentPath = '/';
    await refreshFatfsListing();
    fatfsState.baselineFiles = fatfsState.files.map(file => ({ ...file }));
    fatfsState.dirty = false;
    fatfsState.backupDone = false;
    updateFatfsUsage(partition);
    const count = fatfsState.files.length;
    fatfsState.status = count === 1 ? 'Loaded 1 file.' : `Loaded ${count} files.`;
    appendLog(
      `FATFS partition ${partition.label} loaded (${count} file${count === 1 ? '' : 's'}).`,
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
      fatfsState.status = 'FATFS load cancelled. Use "Read" to fetch the partition again.';
      return;
    } else {
      fatfsState.loadCancelled = false;
      fatfsState.client = null;
      fatfsState.files = [];
      fatfsState.baselineFiles = [];
      updateFatfsUsage(partition);
      fatfsState.error = message;
      fatfsState.readOnly = true;
      fatfsState.readOnlyReason = 'FATFS image unreadable.';
      fatfsState.status = 'FATFS is read-only.';
    }
  } finally {
    fatfsState.loading = false;
    fatfsLoadingDialog.visible = false;
    fatfsLoadingDialog.value = 0;
    fatfsLoadCancelRequested.value = false;
  }
}

// Refresh the FATFS file listing and usage for the current path.
async function refreshFatfsListing() {
  if (!fatfsState.client) {
    return;
  }
  const rootEntries = fatfsState.client.list?.(FATFS_MOUNT_PREFIX) ?? [];
  fatfsState.allFiles = normalizeFatfsEntries(rootEntries, '/');
  const clientPath = toFatfsClientPath(fatfsState.currentPath || '/');
  const entries = fatfsState.client.list?.(clientPath) ?? [];
  fatfsState.files = normalizeFatfsEntries(entries, fatfsState.currentPath);
  try {
    console.info(
      '[ESPConnect-FATFS] entries @',
      fatfsState.currentPath,
      fatfsState.files.map(entry => `${entry.type === 'dir' ? 'dir ' : 'file'} ${entry.path}`),
    );
  } catch {
    // ignore console errors
  }
  updateFatfsUsage();
}

// Select a FATFS partition and trigger a load.
function handleSelectFatfsPartition(partitionId: string | number | null) {
  if (fatfsState.loading || fatfsState.busy || fatfsState.saving) {
    return;
  }
  const id = normalizePartitionId(partitionId);
  fatfsState.selectedId = id;
  fatfsState.client = null;
  fatfsState.files = [];
  fatfsState.currentPath = '/';
  fatfsState.status = 'Loading FATFS...';
  const partition =
    (id != null ? fatfsPartitions.value.find(entry => entry.id === id) : null) ?? fatfsPartitions.value[0];
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
  if (!partition) {
    fatfsState.status = 'Select a FATFS partition first.';
    return;
  }
  if (!loader.value) {
    fatfsState.status = 'Connect to a device first.';
    return;
  }
  fatfsBackupDialog.visible = true;
  fatfsBackupDialog.value = 0;
  fatfsBackupDialog.label = 'Preparing backup...';
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
    fatfsState.status = 'Backup downloaded. You can now save changes.';
    appendLog('FATFS backup downloaded.', '[ESPConnect-Debug]');
  } catch (error) {
    const message = formatErrorMessage(error);
    if (message === 'Download cancelled by user') {
      fatfsState.error = null;
      fatfsState.status = 'FATFS backup cancelled.';
    } else {
      fatfsState.error = message;
      fatfsState.status = 'FATFS backup failed.';
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
  fatfsBackupDialog.label = 'Stopping backup...';
  handleCancelDownload();
}

// Request cancellation of an in-progress FATFS load.
function cancelFatfsLoad() {
  if (!fatfsLoadingDialog.visible || fatfsLoadCancelRequested.value) {
    return;
  }
  fatfsLoadCancelRequested.value = true;
  fatfsLoadingDialog.label = 'Stopping FATFS load...';
}

// Restore a FATFS image to the selected partition.
async function handleFatfsRestore(file: File | null) {
  const partition = fatfsSelectedPartition.value;
  if (!partition) return;
  if (!file) return;
  const buffer = new Uint8Array(await file.arrayBuffer());
  if (buffer.length !== partition.size) {
    fatfsState.status = `Restore file must be exactly ${formatBytes(partition.size) ?? `${partition.size} bytes`}.`;
    return;
  }
  const fileLabel = file.name ? `"${file.name}"` : 'the selected image';
  const confirmed = await showConfirmation({
    title: 'Restore FATFS Partition',
    message: `This will overwrite the entire FATFS partition with ${fileLabel}. Continue?`,
    confirmText: 'Restore',
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
    fatfsRestoreDialog.label = 'Writing FATFS image...';
    await writeFilesystemImage(partition, buffer, {
      label: 'FATFS',
      state: fatfsState,
      onProgress: progress => {
        fatfsRestoreDialog.value = progress.value ?? 0;
        fatfsRestoreDialog.label = progress.label || 'Writing FATFS image...';
      },
    });
    fatfsState.status = 'FATFS image restored.';
    fatfsState.backupDone = true;
    appendLog('FATFS partition restored from backup.', '[ESPConnect-Debug]');
    await loadFatfsPartition(partition);
  } catch (error) {
    fatfsState.error = formatErrorMessage(error);
    fatfsState.status = 'FATFS restore failed.';
  } finally {
    fatfsState.saving = false;
    maintenanceBusy.value = false;
    fatfsRestoreDialog.visible = false;
    fatfsRestoreDialog.value = 0;
    fatfsRestoreDialog.label = 'Restoring FATFS image...';
  }
}

// Validate a selected file before queueing a FATFS upload.
function handleFatfsUploadSelection(file: File | null) {
  if (!file || !fatfsState.client) {
    fatfsState.uploadBlocked = false;
    fatfsState.uploadBlockedReason = '';
    return;
  }
  const partition = fatfsSelectedPartition.value;
  updateFatfsUsage(partition);
  const targetPath = joinFsPath(fatfsState.currentPath || '/', file.name);
  const usageSource = fatfsState.allFiles?.length ? fatfsState.allFiles : fatfsState.files;
  const existingEntry = usageSource.find(entry => entry.path === targetPath);
  const existingSize = existingEntry?.size ?? 0;
  const partitionSize = partition?.size ?? fatfsState.blockSize * fatfsState.blockCount;
  const usedBytes = usageSource.reduce((sum, entry) => sum + (entry.size ?? 0), 0);
  const freeBytes =
    typeof fatfsState.usage?.freeBytes === 'number'
      ? fatfsState.usage.freeBytes
      : partitionSize
        ? Math.max(partitionSize - usedBytes, 0)
        : Number.POSITIVE_INFINITY;
  const availableBytes = Number.isFinite(freeBytes) ? Math.max(freeBytes + existingSize, 0) : Number.POSITIVE_INFINITY;
  if (partitionSize && Number.isFinite(availableBytes) && file.size > availableBytes) {
    const message =
      'Not enough FATFS space for this file. Delete files or format the partition, then try again.';
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

// Queue a FATFS upload to avoid parallel writes.
function handleFatfsUpload(payload: LittlefsUploadPayload) {
  fatfsUploadQueue = fatfsUploadQueue.then(() => performFatfsUpload(payload));
  return fatfsUploadQueue;
}

// Perform a FATFS upload or folder creation with directory support.
async function performFatfsUpload(payload: LittlefsUploadPayload) {
  const { file, path = '', isDir } = payload;
  if (!fatfsState.client) return;
  if (fatfsState.readOnly) {
    fatfsState.status = fatfsState.readOnlyReason || 'FATFS is read-only.';
    showToast(fatfsState.status, { color: 'info' });
    return;
  }
  if (fatfsState.uploadBlocked) {
    fatfsState.status = fatfsState.uploadBlockedReason || 'Resolve blocked upload before continuing.';
    if (fatfsState.uploadBlockedReason) {
      showUploadError(fatfsState.uploadBlockedReason);
    }
    return;
  }
  const derivedIsDir = isDir === true || (!file && !!path);
  if (!file) {
    if (derivedIsDir && path) {
      await handleFatfsNewFolder(path);
    }
    return;
  }
  const targetName = (file.name || '').trim();
  if (!targetName) {
    fatfsState.status = 'Selected file has no name. Rename it and try again.';
    showToast(fatfsState.status, { color: 'warning' });
    return;
  }
  const relativePath = path || targetName;
  const target = joinFsPath(fatfsState.currentPath || '/', relativePath);
  updateFatfsUsage(fatfsSelectedPartition.value);
  const usageSource = fatfsState.allFiles?.length ? fatfsState.allFiles : fatfsState.files;
  const existingEntry = usageSource.find(entry => entry.path === target);
  const existingSize = existingEntry?.size ?? 0;
  const capacityBytes =
    fatfsState.usage?.capacityBytes ?? fatfsSelectedPartition.value?.size ?? fatfsState.blockSize * fatfsState.blockCount;
  const freeBytes =
    typeof fatfsState.usage?.freeBytes === 'number'
      ? fatfsState.usage.freeBytes
      : Number.isFinite(capacityBytes)
        ? Math.max(capacityBytes - usageSource.reduce((sum, entry) => sum + (entry.size ?? 0), 0), 0)
        : Number.POSITIVE_INFINITY;
  const availableBytes = Number.isFinite(freeBytes) ? Math.max(freeBytes + existingSize, 0) : Number.POSITIVE_INFINITY;
  if (Number.isFinite(capacityBytes) && Number.isFinite(availableBytes) && file.size > availableBytes) {
    const message =
      'Not enough FATFS space for this upload. Delete files or format the partition, then try again.';
    fatfsState.uploadBlocked = true;
    fatfsState.uploadBlockedReason = message;
    fatfsState.status = message;
    showUploadError(message);
    return;
  }

  try {
    fatfsState.busy = true;
    const data = new Uint8Array(await file.arrayBuffer());
    const segments = target.split('/').filter(Boolean);
    let built = '';
    if (segments.length > 1 && typeof fatfsState.client.mkdir === 'function') {
      for (let i = 0; i < segments.length - 1; i++) {
        built += `/${segments[i]}`;
        try {
          fatfsState.client.mkdir(toFatfsClientPath(built));
        } catch {
          // ignore if already exists
        }
      }
    }
    const clientPath = toFatfsClientPath(target);
    fatfsState.client.writeFile(clientPath, data);
    await refreshFatfsListing();
    markFatfsDirty(`Staged ${target}. Remember to Save.`);
    appendLog(`FATFS staged ${target} (${data.length.toLocaleString()} bytes).`, '[ESPConnect-Debug]');
  } catch (error) {
    const msg = formatErrorMessage(error);
    const code = isRecord(error) && typeof error.code === 'number' ? error.code : null;
    const normalized = msg.toLowerCase();
    const spaceError =
      normalized.includes('no space') ||
      normalized.includes('nospace') ||
      normalized.includes('enospc');
    if (spaceError) {
      fatfsState.uploadBlocked = true;
      fatfsState.uploadBlockedReason = msg;
      fatfsState.status = msg;
      showUploadError(msg);
      try {
        fatfsState.client.deleteFile(toFatfsClientPath(target));
      } catch {
        // ignore cleanup issues
      }
      await refreshFatfsListing();
    } else {
      fatfsState.error = msg;
      showToast(msg, { color: 'error' });
    }
  } finally {
    fatfsState.busy = false;
  }
}

// Delete a FATFS file or directory after confirmation.
async function handleFatfsDelete(path: string) {
  if (!fatfsState.client || fatfsState.readOnly) {
    return;
  }
  const targetPath = normalizeFsPath(path);
  const entries = fatfsState.allFiles?.length ? fatfsState.allFiles : fatfsState.files;
  const entry = entries.find(f => normalizeFsPath(f.path) === targetPath);
  const isDir = entry?.type === 'dir';
  const confirmed = await showConfirmation({
    title: isDir ? 'Delete Folder' : 'Delete File',
    message: `Delete ${targetPath} from FATFS? This cannot be undone.`,
    confirmText: 'Delete',
    destructive: true,
  });
  if (!confirmed) {
    return;
  }
  try {
    fatfsState.busy = true;
    await removeFatfsEntry(targetPath);
    await refreshFatfsListing();
    markFatfsDirty(`${targetPath} deleted. Save to persist.`);
    appendLog(`FATFS staged deletion of ${targetPath}.`, '[ESPConnect-Debug]');
  } catch (error) {
    fatfsState.error = formatErrorMessage(error);
  } finally {
    fatfsState.busy = false;
  }
}

// Recursively delete a FATFS entry and its children.
async function removeFatfsEntry(targetPath: string) {
  if (!fatfsState.client) {
    return;
  }
  const clientPath = toFatfsClientPath(targetPath);
  let children: LittlefsEntry[] = [];
  try {
    const rawEntries = fatfsState.client.list?.(clientPath) ?? [];
    children = normalizeFatfsEntries(rawEntries, targetPath);
  } catch {
    children = [];
  }
  for (const child of children) {
    if (child.type === 'dir') {
      await removeFatfsEntry(child.path);
    } else {
      fatfsState.client.deleteFile(toFatfsClientPath(child.path));
    }
  }
  fatfsState.client.deleteFile(clientPath);
}

// Navigate to a specific path within FATFS.
async function handleFatfsNavigate(path: string) {
  const target = normalizeFsPath(path || '/');
  if (fatfsState.currentPath === target || !fatfsState.client) return;
  fatfsState.currentPath = target;
  await refreshFatfsListing();
}

// Navigate one directory up within FATFS.
async function handleFatfsNavigateUp() {
  const current = normalizeFsPath(fatfsState.currentPath || '/');
  if (current === '/') return;
  const segments = current.split('/').filter(Boolean);
  segments.pop();
  const parent = segments.length ? `/${segments.join('/')}` : '/';
  await handleFatfsNavigate(parent);
}

// Create a new folder in FATFS.
async function handleFatfsNewFolder(name?: string) {
  if (!fatfsState.client || fatfsState.readOnly) {
    return;
  }
  const folderName = (name || prompt('New folder name'))?.toString().trim();
  if (!folderName) return;
  if (folderName.includes('/') || folderName.includes('..')) {
    const msg = 'Folder name cannot contain slashes or "..".';
    showToast(msg, { color: 'warning' });
    fatfsState.status = msg;
    return;
  }
  const targetPath = joinFsPath(fatfsState.currentPath || '/', folderName);
  const exists = (fatfsState.allFiles?.length ? fatfsState.allFiles : fatfsState.files).find(
    entry => entry.path === targetPath && entry.type === 'dir',
  );
  if (exists) {
    const msg = `Folder "${folderName}" already exists here.`;
    showToast(msg, { color: 'warning' });
    fatfsState.status = msg;
    return;
  }
  try {
    fatfsState.busy = true;
    if (typeof fatfsState.client.mkdir === 'function') {
      fatfsState.client.mkdir(toFatfsClientPath(targetPath));
      await refreshFatfsListing();
      markFatfsDirty(`Created folder ${targetPath}. Save to persist.`);
    } else {
      showToast('mkdir is not available in the FATFS client.', { color: 'error' });
    }
  } catch (error) {
    fatfsState.error = formatErrorMessage(error);
  } finally {
    fatfsState.busy = false;
  }
}

// Reset any upload block state for FATFS.
function handleFatfsResetUploadBlock() {
  fatfsState.uploadBlocked = false;
  fatfsState.uploadBlockedReason = '';
}

// Format the FATFS image and mark changes as staged.
async function handleFatfsFormat() {
  if (!fatfsState.client || fatfsState.readOnly) {
    return;
  }
  const confirmed = await showConfirmation({
    title: 'Format FATFS',
    message: 'Erase all files from the FATFS image? You must Save to apply.',
    confirmText: 'Format',
    destructive: true,
  });
  if (!confirmed) return;
  try {
    fatfsState.busy = true;
    fatfsState.client.format();
    await refreshFatfsListing();
    markFatfsDirty('FATFS formatted. Save to apply.');
    appendLog('FATFS staged format operation.', '[ESPConnect-Debug]');
  } catch (error) {
    fatfsState.error = formatErrorMessage(error);
  } finally {
    fatfsState.busy = false;
  }
}

// Persist staged FATFS changes back to flash.
async function handleFatfsSave() {
  if (!fatfsState.client) {
    fatfsState.status = 'Load a FATFS partition first.';
    return;
  }
  if (fatfsState.readOnly) {
    fatfsState.status = fatfsState.readOnlyReason || 'FATFS is read-only.';
    return;
  }
  if (!fatfsState.dirty) {
    fatfsState.status = 'No staged changes to save.';
    return;
  }
  if (!hasFatfsBackup()) {
    fatfsState.status = 'Download a FATFS backup before saving (one backup per session is enough).';
    return;
  }
  const partition = fatfsSelectedPartition.value;
  if (!partition) {
    fatfsState.status = 'Select a FATFS partition.';
    return;
  }
  const diff = computeFatfsDiff();
  const summaryParts = [];
  if (diff.added.length) summaryParts.push(`Added: ${diff.added.join(', ')}`);
  if (diff.modified.length) summaryParts.push(`Modified: ${diff.modified.join(', ')}`);
  if (diff.removed.length) summaryParts.push(`Removed: ${diff.removed.join(', ')}`);
  const summary =
    summaryParts.length > 0
      ? summaryParts.join('\n')
      : 'No file-level changes detected (still writing updated image).';
  const confirmed = await showConfirmation({
    title: 'Write FATFS to Flash',
    message: `${summary}\n\nWrite these changes to flash now?`,
    confirmText: 'Save to Flash',
    destructive: true,
  });
  if (!confirmed) return;
  try {
    fatfsState.saving = true;
    maintenanceBusy.value = true;
    fatfsSaveDialog.visible = true;
    const image = await Promise.resolve(fatfsState.client.toImage());
    if (image.length > partition.size) {
      throw new Error('FATFS image exceeds partition size.');
    }
    await writeFilesystemImage(partition, image, {
      label: 'FATFS',
      state: fatfsState,
      onProgress: progress => {
        fatfsSaveDialog.value = progress.value ?? 0;
        fatfsSaveDialog.label = progress.label || 'Writing FATFS image...';
      },
    });
    fatfsState.dirty = false;
    fatfsState.status = 'FATFS saved to flash.';
    appendLog('FATFS partition updated on flash.', '[ESPConnect-Debug]');
    await loadFatfsPartition(partition);
  } catch (error) {
    fatfsState.error = formatErrorMessage(error);
    fatfsState.status = 'FATFS save failed.';
  } finally {
    fatfsState.saving = false;
    maintenanceBusy.value = false;
    fatfsSaveDialog.visible = false;
    fatfsSaveDialog.value = 0;
    fatfsSaveDialog.label = 'Saving FATFS...';
  }
}

// Read a FATFS file and return its raw bytes.
async function readFatfsFile(targetPath: string) {
  if (!fatfsState.client) {
    throw new Error('FATFS client unavailable.');
  }
  if (!targetPath) {
    throw new Error('File name is required.');
  }
  const reader =
    typeof fatfsState.client.readFile === 'function'
      ? fatfsState.client.readFile
      : typeof fatfsState.client.read === 'function'
        ? fatfsState.client.read
        : null;
  if (!reader) {
    throw new Error('FATFS module does not support per-file reads. Update the WASM bundle.');
  }
  const normalized = normalizeFsPath(targetPath || '/');
  const clientPath = toFatfsClientPath(normalized);
  const result = reader.call(fatfsState.client, clientPath);
  const data = result instanceof Promise ? await result : result;
  if (!(data instanceof Uint8Array)) {
    throw new Error('FATFS read returned unexpected data.');
  }
  return data;
}

// Download a FATFS file to the host.
async function handleFatfsDownloadFile(path: string) {
  if (!fatfsState.client || !path) return;
  try {
    const data = await readFatfsFile(path);
    const fileName = path.split('/').filter(Boolean).pop() || 'fatfs-file';
    saveBinaryFile(fileName, data);
    appendLog(
      `FATFS downloaded ${path} (${data.length.toLocaleString()} bytes).`,
      '[ESPConnect-Debug]',
    );
  } catch (error) {
    fatfsState.error = formatErrorMessage(error);
    fatfsState.status = 'FATFS download failed.';
  }
}

// Preview a FATFS file using the SPIFFS viewer dialog.
async function handleFatfsView(path: string) {
  if (!fatfsState.client) return;
  const fileName = path.split('/').filter(Boolean).pop() || path;
  const viewInfo = resolveSpiffsViewInfo(fileName);
  if (!viewInfo) {
    fatfsState.status = 'This file type cannot be previewed. Download it instead.';
    showToast(fatfsState.status, { color: 'info' });
    return;
  }
  resetViewerMedia();
  spiffsViewerDialog.visible = true;
  spiffsViewerDialog.name = path;
  spiffsViewerDialog.loading = true;
  spiffsViewerDialog.error = null;
  spiffsViewerDialog.content = '';
  spiffsViewerDialog.mode = viewInfo.mode;
  spiffsViewerDialog.source = 'fatfs';
  try {
    const data = await readFatfsFile(path);
    if (data.length > SPIFFS_VIEWER_MAX_BYTES) {
      throw new Error(
        `File too large to preview (limit ${formatBytes(SPIFFS_VIEWER_MAX_BYTES) ?? SPIFFS_VIEWER_MAX_BYTES} bytes).`,
      );
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
function buildFactGroups(facts: DeviceFact[]): DeviceFactGroup[] {
  const groups: DeviceFactGroup[] = [];
  const assigned = new Set<string>();

  for (const config of FACT_GROUP_CONFIG) {
    const labelMap = new Map(config.labels.map(entry => [entry.label, entry.key]));
    const items = facts.filter(fact => {
      if (assigned.has(fact.label)) return false;
      return labelMap.has(fact.label);
    });
    if (items.length) {
      items.forEach(item => assigned.add(item.label));
      const enhancedItems = items.map(fact => ({
        ...fact,
        translationKey: fact.translationKey ?? labelMap.get(fact.label),
      }));
      groups.push({
        title: config.title,
        titleKey: config.titleKey,
        icon: config.icon,
        items: enhancedItems,
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
function formatBytes(bytes: number | null | undefined): string | null {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0) return null;
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
function formatErrorMessage(error: unknown): string {
  if (error == null) {
    return 'Unknown error';
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error instanceof Error) {
    return error.message || String(error);
  }
  if (isRecord(error)) {
    const message = error.message;
    if (typeof message === 'string' && message) {
      return message;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

// Convert vendor codes into human-readable labels.
function formatVendorLabel(label: string | null | undefined) {
  if (!label) return label;
  return VENDOR_ALIASES[label] ?? label.replace(/_/g, ' ');
}

// Expand feature codes with vendor-friendly names.
function humanizeFeature(feature: string) {
  let text = feature;
  for (const [code, friendly] of Object.entries(VENDOR_ALIASES)) {
    text = text.replace(new RegExp(code, 'g'), friendly);
  }
  return text;
}

// Build a user-facing USB bridge label from IDs.
function formatUsbBridge(info: SerialPortInfo | null | undefined): string | null {
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
function saveBinaryFile(name: string, data: Uint8Array) {
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
  spiffsState.status = 'Load a SPIFFS partition to begin.';
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
  spiffsState.usage = getDefaultSpiffsUsage();
  closeSpiffsViewer();
  spiffsState.uploadBlocked = false;
  spiffsState.uploadBlockedReason = '';
}

function getDefaultSpiffsUsage() {
  return {
    capacityBytes: 0,
    usedBytes: 0,
    freeBytes: 0,
  };
}

// Update SPIFFS usage info if provided by the client.
async function updateSpiffsUsage() {
  if (spiffsState.client && typeof spiffsState.client.getUsage === 'function') {
    try {
      const usage = await spiffsState.client.getUsage();
      spiffsState.usage = usage ?? getDefaultSpiffsUsage();
      return;
    } catch (error) {
      console.error('[ESPConnect] Failed to read SPIFFS usage', error);
    }
  }
  spiffsState.usage = getDefaultSpiffsUsage();
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
  littlefsState.status = 'Load a LittleFS partition to begin.';
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
  if (littlefsState.client && typeof littlefsState.client.getUsage === 'function') {
    littlefsState.usage = littlefsState.client.getUsage();
  } else {
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
  }
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
  fatfsState.allFiles = [];
  fatfsState.currentPath = '/';
  fatfsState.status = 'Load a FATFS partition to begin.';
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

function resetNvsState() {
  nvsState.selectedId = null;
  nvsState.status = 'Select an NVS partition to begin.';
  nvsState.loading = false;
  nvsState.error = null;
  nvsState.result = null;
}

// Calculate FATFS usage based on current entries.
function updateFatfsUsage(partition = fatfsSelectedPartition.value) {
  if (fatfsState.client && typeof fatfsState.client.getUsage === 'function') {
    fatfsState.usage = fatfsState.client.getUsage();
    return;
  }
  const partitionSize = partition?.size ?? fatfsState.blockSize * fatfsState.blockCount;
  const capacityBytes =
    fatfsState.blockSize && fatfsState.blockCount ? fatfsState.blockSize * fatfsState.blockCount : partitionSize;
  const source = fatfsState.allFiles?.length ? fatfsState.allFiles : fatfsState.files;
  const usedBytes = source.reduce((sum, file) => sum + (file.size ?? 0), 0);
  fatfsState.usage = {
    capacityBytes,
    usedBytes,
    freeBytes: Math.max(capacityBytes - usedBytes, 0),
  };
}

// Resolve how to preview a SPIFFS/LittleFS/FATFS file by extension.
function resolveSpiffsViewInfo(name = ''): FilePreviewInfo | null {
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
async function loadSpiffsPartition(partition: FilesystemPartition) {
  if (!loader.value || !partition) {
    spiffsState.error = 'Connect to a device with a SPIFFS partition first.';
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
  spiffsState.status = `Reading SPIFFS @ 0x${partition.offset.toString(16).toUpperCase()}${spiffsBaudLabel}...`;
  spiffsLoadingDialog.visible = true;
  spiffsLoadingDialog.label = `Reading ${partition.label || 'SPIFFS'}${spiffsBaudLabel}...`;
  try {
    const image = await readFlashToBuffer(partition.offset, partition.size, {
      label: `${partition.label || 'SPIFFS'}${spiffsBaudLabel}`,
      cancelSignal: spiffsLoadCancelRequested,
      onProgress: progress => {
        spiffsLoadingDialog.label = progress.label ?? spiffsLoadingDialog.label;
        spiffsLoadingDialog.value = progress.value ?? 0;
      },
    });
    spiffsState.lastReadOffset = partition.offset;
    spiffsState.lastReadSize = partition.size;
    spiffsState.lastReadImage = image;
    let client;
    try {
      client = await createSpiffsFromImage(image);
    } catch (error) {
      spiffsState.error = formatErrorMessage(error);
      spiffsState.readOnly = true;
      spiffsState.readOnlyReason = 'SPIFFS image unreadable (possibly encrypted).';
      spiffsState.status = 'SPIFFS is read-only.';
      spiffsState.client = null;
      spiffsState.files = [];
      spiffsState.baselineFiles = [];
      await updateSpiffsUsage();
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
    await updateSpiffsUsage();
    const count = spiffsState.files.length;
    spiffsState.status = count === 1 ? 'Loaded 1 file.' : `Loaded ${count} files.`;
    appendLog(
      `SPIFFS partition ${partition.label} loaded (${count} file${count === 1 ? '' : 's'}).`,
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
      await updateSpiffsUsage();
      spiffsState.error = null;
      spiffsState.readOnly = false;
      spiffsState.readOnlyReason = '';
      spiffsState.status = 'SPIFFS load cancelled. Use "Read" to fetch the partition again.';
      return;
    } else {
      spiffsState.loadCancelled = false;
      spiffsState.error = message;
      spiffsState.status = 'Failed to read SPIFFS.';
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
  await updateSpiffsUsage();
}

// Mark the SPIFFS state as dirty and optionally set a status message.
function markSpiffsDirty(message?: string) {
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
type FileDiffEntry = { name?: string; path?: string; size?: number };

function computeFileDiff(baselineFiles: FileDiffEntry[] = [], currentFiles: FileDiffEntry[] = []) {
  const baselineMap = new Map<string, number | undefined>();
  for (const file of baselineFiles) {
    const key = file.path || file.name;
    if (!key) continue;
    baselineMap.set(key, file.size);
  }

  const currentMap = new Map<string, number | undefined>();
  for (const file of currentFiles) {
    const key = file.path || file.name;
    if (!key) continue;
    currentMap.set(key, file.size);
  }
  const added: string[] = [];
  const removed: string[] = [];
  const modified: string[] = [];
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

function handleSelectNvsPartition(partitionId: string | number | null) {
  nvsState.selectedId = normalizePartitionId(partitionId);
  nvsState.result = null;
  nvsState.error = null;
  nvsState.status = 'Ready to read NVS.';
}

async function handleReadNvs() {
  const partition = nvsSelectedPartition.value ?? nvsPartitions.value[0];
  if (!partition) {
    nvsState.error = 'No NVS partition found in the partition table.';
    nvsState.status = 'NVS read unavailable.';
    return;
  }
  if (!loader.value) {
    nvsState.error = 'Connect to a device first.';
    nvsState.status = 'NVS read unavailable.';
    return;
  }
  if (nvsState.loading) {
    return;
  }

  nvsState.selectedId = partition.id;
  nvsState.loading = true;
  nvsState.error = null;
  nvsState.result = null;
  const baudLabel = currentBaud.value ? ` @ ${currentBaud.value.toLocaleString()} bps` : '';
  nvsState.status = `Reading NVS @ 0x${partition.offset.toString(16).toUpperCase()}${baudLabel}...`;
  try {
    const image = await readFlashToBuffer(partition.offset, partition.size, {
      label: `NVS${baudLabel}`,
      onProgress: progress => {
        if (progress?.label) {
          nvsState.status = progress.label;
        }
      },
    });
    const parsed = parseNvsPartition(image);
    nvsState.result = parsed;
    nvsState.status = `Parsed NVS v${parsed.version} (${parsed.namespaces.length.toLocaleString()} namespaces, ${parsed.entries.length.toLocaleString()} entries).`;
  } catch (error) {
    nvsState.error = formatErrorMessage(error);
    nvsState.status = 'NVS read failed.';
  } finally {
    nvsState.loading = false;
  }
}

// Select a SPIFFS partition and trigger a load.
function handleSelectSpiffsPartition(partitionId: string | number | null) {
  if (spiffsState.loading || spiffsState.busy || spiffsState.saving) {
    return;
  }
  const id = normalizePartitionId(partitionId);
  spiffsState.selectedId = id;
  spiffsState.client = null;
  spiffsState.files = [];
  spiffsState.status = 'Loading SPIFFS...';
  const partition =
    (id != null ? spiffsPartitions.value.find(entry => entry.id === id) : null) ?? spiffsPartitions.value[0];
  if (partition) {
    void loadSpiffsPartition(partition);
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
    spiffsState.status = 'Backup downloaded. You can now save changes.';
    appendLog('SPIFFS backup downloaded.', '[ESPConnect-Debug]');
  } catch (error) {
    const message = formatErrorMessage(error);
    if (message === 'Download cancelled by user') {
      spiffsState.error = null;
      spiffsState.status = 'SPIFFS backup cancelled.';
    } else {
      spiffsState.error = message;
      spiffsState.status = 'SPIFFS backup failed.';
    }
  } finally {
    spiffsBackupDialog.visible = false;
    spiffsBackupDialog.value = 0;
    spiffsBackupDialog.label = '';
  }
}

// Restore a SPIFFS image to the selected partition.
async function handleSpiffsRestore(file: File | null) {
  const partition = spiffsSelectedPartition.value;
  if (!partition) return;
  if (!file) return;
  const buffer = new Uint8Array(await file.arrayBuffer());
  if (buffer.length !== partition.size) {
    spiffsState.status = `Restore file must be exactly ${formatBytes(partition.size) ?? `${partition.size} bytes`}.`;
    return;
  }
  const fileLabel = file.name ? `"${file.name}"` : 'the selected image';
  const confirmed = await showConfirmation({
    title: 'Restore SPIFFS Partition',
    message:
      `This will overwrite the entire SPIFFS partition with ${fileLabel}. Continue?`,
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
    await writeFilesystemImage(partition, buffer, {
      label: 'SPIFFS',
      state: spiffsState,
      onProgress: progress => {
        spiffsRestoreDialog.value = progress.value ?? 0;
        spiffsRestoreDialog.label = progress.label || 'Writing SPIFFS image...';
      },
    });
    spiffsState.status = 'SPIFFS image restored.';
    spiffsState.backupDone = true;
    appendLog('SPIFFS partition restored from backup.', '[ESPConnect-Debug]');
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

// Download a SPIFFS file to the host.
async function handleSpiffsDownloadFile(name: string) {
  if (!spiffsState.client) return;
  try {
    const data = await spiffsState.client.read(name);
    saveBinaryFile(name, data);
    appendLog(`SPIFFS downloaded ${name} (${data.length.toLocaleString()} bytes).`, '[ESPConnect-Debug]');
  } catch (error) {
    spiffsState.error = formatErrorMessage(error);
  }
}

// Validate a selected file before queueing a SPIFFS upload.
function handleSpiffsUploadSelection(file: File | null) {
  if (!file || !spiffsState.client) {
    spiffsState.uploadBlocked = false;
    spiffsState.uploadBlockedReason = '';
    return;
  }
  const targetName = (file.name || '').trim();
  if (!targetName) {
    spiffsState.uploadBlocked = true;
    spiffsState.uploadBlockedReason = 'Selected file must have a name.';
    showUploadError('Selected file must have a name.');
    return;
  }
  if (targetName.length > SPIFFS_MAX_FILENAME_LENGTH) {
    const message = `SPIFFS filenames are limited to ${SPIFFS_MAX_FILENAME_LENGTH} characters.`;
    spiffsState.uploadBlocked = true;
    spiffsState.uploadBlockedReason = message;
    showUploadError(message);
    return;
  }
  if (
    typeof spiffsState.client.canFit === 'function' &&
    !spiffsState.client.canFit(targetName, file.size ?? 0)
  ) {
    const message = 'Not enough SPIFFS space for this file. Delete files or format the partition, then try again.';
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
function showUploadError(message: string) {
  showToast(message || 'Not enough filesystem space to store this file.', { color: 'error', timeout: 6000 });
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
async function handleSpiffsView(name: string) {
  if (!spiffsState.client) return;
  const viewInfo = resolveSpiffsViewInfo(name);
  if (!viewInfo) {
    spiffsState.status = 'This file type cannot be previewed. Download it instead.';
    showToast('This file type cannot be previewed. Download it instead.', { color: 'info' });
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
      throw new Error(
        `File too large to preview (limit ${formatBytes(SPIFFS_VIEWER_MAX_BYTES) ?? SPIFFS_VIEWER_MAX_BYTES} bytes).`,
      );
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
    console.error('[ESPConnect] SPIFFS preview failed', { name, error });
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
  spiffsBackupDialog.label = 'Stopping backup...';
  handleCancelDownload();
}

// Request cancellation of an in-progress SPIFFS load.
function cancelSpiffsLoad() {
  if (!spiffsLoadingDialog.visible || spiffsLoadCancelRequested.value) {
    return;
  }
  spiffsLoadCancelRequested.value = true;
  spiffsLoadingDialog.label = 'Stopping SPIFFS load...';
}

function isSpiffsPartitionFullError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === 'number' && code === SpiffsErrorCode.SPIFFS_ERR_FULL;
}

// Upload a file to SPIFFS with size checks and staging.
async function handleSpiffsUpload({ file }: { file: File | null }) {
  if (!spiffsState.client) return;
  if (spiffsState.readOnly) {
    spiffsState.status = spiffsState.readOnlyReason || 'SPIFFS is read-only.';
    showToast(spiffsState.status, { color: 'info' });
    return;
  }
  if (spiffsState.uploadBlocked) {
    spiffsState.status = spiffsState.uploadBlockedReason || 'Resolve blocked upload before continuing.';
    if (spiffsState.uploadBlockedReason) {
      showUploadError(spiffsState.uploadBlockedReason);
    }
    return;
  }
  if (!file) {
    spiffsState.status = 'Select a file to upload.';
    showToast(spiffsState.status, { color: 'info' });
    return;
  }
  const targetName = (file.name || '').trim();
  if (!targetName) {
    spiffsState.status = 'Selected file has no name. Rename it and try again.';
    showToast(spiffsState.status, { color: 'warning' });
    return;
  }
  try {
    spiffsState.busy = true;
    const data = new Uint8Array(await file.arrayBuffer());
    await spiffsState.client.write(targetName, data);
    await refreshSpiffsListing();
    markSpiffsDirty(`Staged ${targetName}. Remember to Save.`);
    appendLog(`SPIFFS staged ${targetName} (${data.length.toLocaleString()} bytes).`, '[ESPConnect-Debug]');
    spiffsState.uploadBlocked = false;
    spiffsState.uploadBlockedReason = '';
  } catch (error) {
    const partitionFullMessage = 'SPIFFS partition is full. Delete files or format the partition before uploading.';
    if (isSpiffsPartitionFullError(error)) {
      spiffsState.status = partitionFullMessage;
      spiffsState.error = partitionFullMessage;
      showUploadError(partitionFullMessage);
      return;
    }
    const message = formatErrorMessage(error);
    const isSpaceError = message.includes('Not enough SPIFFS space');
    const isNameTooLong = message.includes('File name too long');
    const friendly = isSpaceError
      ? 'Not enough SPIFFS space for this file. Delete files or format the partition, then try again.'
      : message;
    if (!isNameTooLong) {
      spiffsState.status = friendly || 'SPIFFS upload failed.';
    }
    if (!isSpaceError && !isNameTooLong) {
      spiffsState.error = friendly;
    }
    if (isSpaceError || isNameTooLong) {
      showUploadError(friendly);
    } else {
      showToast(friendly || 'SPIFFS upload failed.', { color: 'error' });
    }
  } finally {
    spiffsState.busy = false;
  }
}

// Delete a SPIFFS file after confirmation.
async function handleSpiffsDelete(name: string) {
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
    appendLog(`SPIFFS staged deletion of ${name}.`, '[ESPConnect-Debug]');
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
    appendLog('SPIFFS staged format operation.', '[ESPConnect-Debug]');
  } catch (error) {
    spiffsState.error = formatErrorMessage(error);
  } finally {
    spiffsState.busy = false;
  }
}

// Persist staged SPIFFS changes back to flash.
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
    await writeFilesystemImage(partition, image, {
      label: 'SPIFFS',
      state: spiffsState,
      onProgress: progress => {
        spiffsSaveDialog.value = progress.value ?? 0;
        spiffsSaveDialog.label = progress.label || 'Writing SPIFFS image...';
      },
    });
    spiffsState.dirty = false;
    spiffsState.status = 'SPIFFS saved to flash.';
    appendLog('SPIFFS partition updated on flash.', '[ESPConnect-Debug]');
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

type StopMonitorOptions = {
  closeConnection?: boolean;
  returnToMaintenance?: boolean;
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
  const { onProgress, label = 'filesystem', state, compress = true } = options;
  const loaderInstance = loader.value;
  if (!loaderInstance) {
    throw new Error('Loader unavailable.');
  }
  await runLoaderOperation(() => loaderInstance.flashData(
    toArrayBuffer(image),
    (written, total) => {
      const progressValue = total ? Math.min(100, Math.floor((written / total) * 100)) : 0;
      const statusLabel = `Writing ${label}... ${written.toLocaleString()} / ${total.toLocaleString()} bytes`;
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
  ));
  const finishingLabel = `Finalizing ${label}...`;
  if (state) {
    state.status = finishingLabel;
  }
  onProgress?.({
    value: 100,
    label: finishingLabel,
    written: image.length,
    total: image.length,
  });
  await esptoolClient.value?.syncWithStub();
}

const FILESYSTEM_LOAD_CANCELLED_MESSAGE = 'Filesystem load cancelled by user';
const FLASH_READ_MAX_CHUNK = 0x10000;
const FLASH_READ_MIN_CHUNK = 0x1000;

// Read a region of flash into a buffer with chunked progress reporting.
async function readFlashToBuffer(offset: number, length: number, options: ReadFlashOptions = {}) {
  const loaderInstance = loader.value;
  if (!loaderInstance) {
    throw new Error('Device not connected.');
  }
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new Error('Invalid flash offset.');
  }
  if (!Number.isSafeInteger(length) || length <= 0) {
    throw new Error('Invalid flash length.');
  }
  const cancelSignal = options.cancelSignal;
  const label = options.label || 'filesystem';
  return await runLoaderOperation(async () => {
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
      const chunk = await loaderInstance.readFlash(
        chunkOffset,
        currentChunkSize,
        (_packet, received) => {
          const chunkReceived = Math.min(received, currentChunkSize);
          const overallReceived = chunkBase + chunkReceived;
          const progressValue = length ? Math.min(100, Math.floor((overallReceived / length) * 100)) : 0;
          let progressLabel = `Reading ${label} - ${overallReceived.toLocaleString()} of ${length.toLocaleString()} bytes`;
          if (cancelSignal?.value) {
            progressLabel = `Stopping read of ${label} after current chunk... (${overallReceived.toLocaleString()} of ${length.toLocaleString()} bytes)`;
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
  });
}

// Map chip package codes to human-friendly labels.
function resolvePackageLabel(chipKey: string, pkgVersion: unknown, chipRevision: unknown): string | null {
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
function resolveRevisionLabel(
  chipKey: string,
  chipRevision: unknown,
  majorVersion: unknown,
  minorVersion: unknown
): string | null {
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
function cleanEmbeddedFeature(feature: string, keyword: string): string {
  const match = feature.match(new RegExp(`${keyword}\\s*(.*)`, 'i'));
  if (match && match[1]) {
    return match[1].trim();
  }
  return feature.replace(new RegExp(keyword, 'i'), '').trim() || feature.trim();
}

// Resolve embedded flash capacity and vendor from chip metadata.
function resolveEmbeddedFlash(
  chipKey: string,
  flashCap: unknown,
  flashVendor: string | null | undefined,
  featureList: string[],
): string | null {
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
function extractCpuFrequency(featureList: unknown): string | null {
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
function extractCoreCount(featureList: unknown): string | null {
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
function resolveEmbeddedPsram(
  chipKey: string,
  psramCap: unknown,
  psramVendor: string | null | undefined,
  featureList: string[],
): string | null {
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

const isE2E =
  import.meta.env.VITE_E2E === '1' ||
  import.meta.env.VITE_E2E === 'true' ||
  (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('e2e'));
const serialSupported = isE2E || 'serial' in navigator;
const { t } = useI18n();
const connected = ref(false);
const busy = ref(false);
const flashInProgress = ref(false);
const flashProgress = ref(0);
const flashProgressDialog = reactive<ProgressDialogState>({
  visible: false,
  value: 0,
  label: '',
  indeterminate: false,
});
const flashCancelRequested = ref(false);
const ERASE_CANCEL_MESSAGE = 'Flash erase cancelled by user';
let eraseFillBlock: number[] | null = null;
const selectedBaud = ref<BaudRate>(DEFAULT_FLASH_BAUD as BaudRate);
const baudrateOptions = SUPPORTED_BAUDRATES;
const flashOffset = ref('0x0');
const PARTITION_OFFSET_STORAGE_KEY = 'espconnect-partition-offset';
const partitionTableOffset = ref(
  typeof window !== 'undefined'
    ? window.localStorage.getItem(PARTITION_OFFSET_STORAGE_KEY) ?? '0x8000'
    : '0x8000',
);
function updatePartitionTableOffset(value: string) {
  partitionTableOffset.value = value;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(PARTITION_OFFSET_STORAGE_KEY, value);
  }
}
const eraseFlash = ref(false);
const higherBaudrateAvailable = ref(false);
const selectedPreset = ref<string | number | null>(null);
const selectedPartitionDownload = ref<PartitionOptionValue | null>(null);
const integrityPartition = ref<PartitionOptionValue | null>(null);
const currentBaud = ref(DEFAULT_FLASH_BAUD);
const lastFlashBaud = ref(DEFAULT_FLASH_BAUD);
const previousMonitorBaud = ref(DEFAULT_FLASH_BAUD);
let suspendBaudWatcher = false;
const baudChangeBusy = ref(false);
const maintenanceBusy = ref(false);
const downloadProgress = reactive<ProgressDialogState>({ visible: false, value: 0, label: '' });
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
let fatfsUploadQueue = Promise.resolve();
const nvsState = reactive<{
  selectedId: number | null;
  status: string;
  loading: boolean;
  error: string | null;
  result: NvsParseResult | null;
}>({
  selectedId: null,
  status: 'Select an NVS partition to begin.',
  loading: false,
  error: null,
  result: null,
});
const registerAddress = ref('0x0');
const registerValue = ref('');
const registerReadResult = ref<string | null>(null);
const registerStatus = ref<string | null>(null);
const registerStatusType = ref<AlertType>('info');
const registerOptions = ref<RegisterOption[]>([]);
const registerReference = ref<RegisterReference | null>(null);
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
const md5Result = ref<string | null>(null);
const md5Status = ref<string | null>(null);
const md5StatusType = ref<AlertType>('info');
const flashReadOffset = ref('0x0');
const flashReadLength = ref('');
const flashReadStatus = ref<string | null>(null);
const flashReadStatusType = ref<AlertType>('info');
const appPartitions = ref<AppPartitionMetadata[]>([]);
const appMetadataLoading = ref(false);
const appMetadataError = ref<string | null>(null);
const activeAppSlotId = ref<string | null>(null);
const appActiveSummary = ref('Active slot unknown.');
const appMetadataLoaded = ref(false);
const { connectDialog, toast } = useDialogs();
let connectDialogTimer: ReturnType<typeof setTimeout> | null = null;
const nvsPartitions = computed(() =>
  partitionTable.value
    .filter(
      entry =>
        entry &&
        typeof entry.type === 'number' &&
        typeof entry.subtype === 'number' &&
        entry.type === 0x01 &&
        (entry.subtype === 0x02 || entry.subtype === 0x87),
    )
    .map(entry => ({
      id: entry.offset,
      label: entry.label?.trim() || (entry.subtype === 0x87 ? 'Factory NVS' : 'NVS'),
      offset: entry.offset,
      size: entry.size,
      sizeText: formatBytes(entry.size) ?? `${entry.size} bytes`,
    })),
);
const nvsAvailable = computed(() => nvsPartitions.value.length > 0);
const nvsSelectedPartition = computed(() =>
  nvsPartitions.value.find(partition => partition.id === nvsState.selectedId) ?? null,
);
const hasNvsPartitionSelected = computed(() => Boolean(nvsSelectedPartition.value));
const spiffsPartitions = computed(() =>
  partitionTable.value
    .filter(
      entry =>
        entry &&
        typeof entry.type === 'number' &&
        typeof entry.subtype === 'number' &&
        entry.type === 0x01 &&
        (entry.detectedFilesystem ? entry.detectedFilesystem === 'spiffs' : entry.subtype === 0x82),
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
      if (entry.detectedFilesystem) {
        return entry.detectedFilesystem === 'littlefs';
      }
      return entry.subtype === 0x83;
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
const fatfsVisibleFiles = computed(() => {
  const base = normalizeFsPath(fatfsState.currentPath || '/');
  return fatfsState.files.filter(entry => isDirectChildPath(entry.path, base));
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
      if (entry.detectedFilesystem) {
        return entry.detectedFilesystem === 'fatfs';
      }
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
const monitorText = ref<string>('');
const monitorActive = ref<boolean>(false);
const monitorError = ref<SerialMonitorError>(null);
const monitorStarting = ref<boolean>(false);
const monitorAbortController = ref<AbortController | null>(null);
const serialMonitorClosedPrompt = ref(false);
const maintenanceReturnInProgress = ref(false);
const maintenanceNavigationLocked = computed(
  () => monitorActive.value || maintenanceReturnInProgress.value
);
const MONITOR_BUFFER_LIMIT = 20000;
let monitorPendingText = '';
let monitorFlushHandle: ReturnType<typeof setTimeout> | number | null = null;
let monitorFlushUsingAnimationFrame = false;
const confirmationDialog = reactive({
  visible: false,
  title: '',
  message: '',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  destructive: false,
});
let confirmationResolver: ((confirmed: boolean) => void) | null = null;
const currentPort = ref<SerialPort | null>(null);
const transport = shallowRef<CompatibleTransport | null>(null);
const loader = shallowRef<ESPLoader | null>(null);
const esptoolClient = shallowRef<EsptoolClient | null>(null);
async function runLoaderOperation<T>(operation: () => Promise<T>): Promise<T> {
  const client = esptoolClient.value;
  if (client?.runWithBusy) {
    return await client.runWithBusy(operation);
  }
  return await operation();
}
const firmwareBuffer = ref<ArrayBuffer | null>(null);
const firmwareName = ref('');
const chipDetails = ref<DeviceDetails | null>(null);
const partitionFlashSizeLabel = computed(() => chipDetails.value?.flashSize ?? null);
const partitionTable = ref<PartitionTableEntry[]>([]);
const activeTab = ref('info');
const sessionLogRef = ref<SessionLogTabRef | null>(null);
const navigationItems = computed(() => [
  { title: t('navigation.deviceInfo'), value: 'info', icon: 'mdi-information-outline', disabled: false },
  { title: t('navigation.partitions'), value: 'partitions', icon: 'mdi-table', disabled: !connected.value },
  {
    title: t('navigation.apps'),
    value: 'apps',
    icon: 'mdi-application',
    disabled: !connected.value || maintenanceNavigationLocked.value,
  },
  {
    title: t('navigation.nvs'),
    value: 'nvs',
    icon: 'mdi-database-search',
    disabled:
      !connected.value || !nvsAvailable.value || maintenanceNavigationLocked.value,
  },
  {
    title: t('navigation.spiffs'),
    value: 'spiffs',
    icon: 'mdi-folder-wrench',
    disabled:
      !connected.value || !spiffsAvailable.value || maintenanceNavigationLocked.value,
  },
  {
    title: t('navigation.littlefs'),
    value: 'littlefs',
    icon: 'mdi-alpha-l-circle-outline',
    disabled:
      !connected.value || !littleFsAvailable.value || maintenanceNavigationLocked.value,
  },
  {
    title: t('navigation.fatfs'),
    value: 'fatfs',
    icon: 'mdi-alpha-f-circle-outline',
    disabled:
      !connected.value || !fatfsAvailable.value || maintenanceNavigationLocked.value,
  },
  {
    title: t('navigation.flash'),
    value: 'flash',
    icon: 'mdi-chip',
    disabled: !connected.value || maintenanceNavigationLocked.value,
  },
  { title: t('navigation.console'), value: 'console', icon: 'mdi-console-line', disabled: false },
  { title: t('navigation.log'), value: 'log', icon: 'mdi-clipboard-text-outline', disabled: false },
  {
    title: t('navigation.about'),
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

const resourceLinks = computed(() => [
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
]);
const flashSizeBytes = ref<number | null>(null);

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

const currentLanguage = computed<SupportedLocale>(() => getLanguage());
const languageOptions = computed(() => [
  { code: 'en', label: t('language.english') },
  { code: 'fr', label: t('language.french') },
  { code: 'zh', label: t('language.chinese') },
]);
const currentLanguageLabel = computed(() =>
  languageOptions.value.find(lang => lang.code === currentLanguage.value)?.label ??
  t('language.english'),
);
const otherLanguageLabel = computed(() => {
  const option = languageOptions.value.find(lang => lang.code !== currentLanguage.value);
  return option?.label ?? currentLanguageLabel.value;
});
const languageMenuTitle = computed(() =>
  t('language.switchTo', { language: otherLanguageLabel.value }),
);

function selectLanguage(code: string) {
  if (code !== currentLanguage.value) {
    setLanguage(code);
  }
}

// Apply or remove the light-theme helper class on the document body.
function applyThemeClass(name: string) {
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
    const loaderInstance = loader.value;
    try {
      baudChangeBusy.value = true;
      if (log) {
        appendLog('Changing baud to ' + parsed.toLocaleString() + ' bps...', '[ESPConnect-Debug]');
      }
      await runLoaderOperation(async () => {
        await loaderInstance.setBaudrate(parsed);
        await loaderInstance.sleep(300); // Fix needed for Native USB (0x1001), otherwise an error is raised
      });
      if (transport.value) {
        transport.value.baudrate = parsed;
      }
      if (log) {
        appendLog('Baud changed to ' + parsed.toLocaleString() + ' bps.', '[ESPConnect-Debug]');
      }
    } catch (error) {
      if (log) {
        appendLog('Baud change failed: ' + formatErrorMessage(error), '[ESPConnect-Warn]');
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
    appendLog('Ignoring invalid baud selection: ' + value, '[ESPConnect-Warn]');
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
    appendLog(
      'Cannot change baud while operations are running. Keeping ' + currentBaud.value.toLocaleString() + ' bps.',
      '[ESPConnect-Warn]'
    );
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
      resetNvsState();
      return;
    }
    if (nvsPartitions.value.length) {
      if (!nvsPartitions.value.some(partition => partition.id === nvsState.selectedId)) {
        nvsState.selectedId = nvsPartitions.value[0].id;
      }
    } else {
      resetNvsState();
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
function normalizeRegisterAddressValue(value: string | number | null | undefined): string | null {
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
function readUint32LE(buffer: Uint8Array, offset: number) {
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
function decodeCString(bytes: Uint8Array) {
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
    appendLog('Failed to decode string', error);
    return '';
  }
}

// Locate and parse an app descriptor from a firmware buffer.
type AppDescriptor = {
  version: string;
  projectName: string;
  time: string;
  date: string;
  idfVersion: string;
};

function extractAppDescriptor(buffer: Uint8Array): AppDescriptor | null {
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

// Scan application partitions to build metadata and identify the active slot.
const OTA_DATA_SECTOR_BYTES = 0x1000;

async function analyzeAppPartitions(loaderInstance: ESPLoader, partitions: PartitionTableEntry[]) {
  appPartitions.value = [];
  activeAppSlotId.value = null;
  appMetadataError.value = null;
  appActiveSummary.value = "Active slot unknown.";

  if (!loaderInstance || !Array.isArray(partitions) || !partitions.length) return;

  const appEntries = partitions
    .filter(entry => entry && entry.type === 0x00)
    .map(entry => ({ ...entry }))
    .sort((a, b) => a.offset - b.offset);

  if (!appEntries.length) return;

  const factoryEntry = appEntries.find(entry => entry.subtype === 0x00) ?? null;
  const otaEntries = appEntries
    .filter(entry => entry.subtype >= 0x10 && entry.subtype <= 0x1f)
    .sort((a, b) => (a.subtype ?? 0) - (b.subtype ?? 0));

  let activeSlotId: string | null = null;
  let activeSummary: string | null = null;
  let otadataSelectionUnavailable = false;
  let activeSlotFromOtadata = false;

  // ---- Read otadata (DATA/OTA = type 0x01, subtype 0x00) ----
  const otadataEntry = partitions.find(entry => entry.type === 0x01 && entry.subtype === 0x00) ?? null;
  appendLog(
    `otadataEntry: type=0x${otadataEntry?.type?.toString(16)} subtype=0x${otadataEntry?.subtype?.toString(16)} offset=0x${otadataEntry?.offset?.toString(16)} size=${otadataEntry?.size}`
  );

  const hex = (buf: Uint8Array) =>
    Array.from(buf).map(b => b.toString(16).padStart(2, "0")).join(" ");

  if (otadataEntry && otaEntries.length) {
    try {
      // Always read the two otadata sectors (0x2000) from the otadata partition start.
      const desiredLength = OTA_DATA_SECTOR_BYTES * 2; // 0x2000
      const primaryBlock = await loaderInstance.readFlash(otadataEntry.offset, desiredLength);

      // Debug: show the first 32 bytes of each sector.
      appendLog(`otadata sector0[0..31]=${hex(primaryBlock.subarray(0x0000, 0x0020))}`);
      appendLog(`otadata sector1[0..31]=${hex(primaryBlock.subarray(0x1000, 0x1020))}`);

      // Debug: parse seq/crc directly from the same buffer (sector starts).
      const seq0 = readUint32LE(primaryBlock, 0x0000);
      const crc0 = readUint32LE(primaryBlock, 0x0000 + 28);
      const seq1 = readUint32LE(primaryBlock, 0x1000);
      const crc1 = readUint32LE(primaryBlock, 0x1000 + 28);

      appendLog(
        `otadata parsed: seq0=${seq0} crc0=0x${(crc0 ?? 0).toString(16)} seq1=${seq1} crc1=0x${(crc1 ?? 0).toString(16)}`
      );

      // Detect active slot from REAL-layout otadata (primaryBlock is already 0x2000).
      const otaDetected = detectActiveOtaSlot(primaryBlock, otaEntries);

      if (otaDetected.slotId) {
        activeSlotId = otaDetected.slotId;
        activeSlotFromOtadata = true;
      } else if (otaDetected.summary === "No valid OTA selection found") {
        otadataSelectionUnavailable = true;
      }

      activeSummary = otaDetected.summary;
    } catch (error) {
      appendLog("Failed to read OTA data partition", error);
      appMetadataError.value = "Unable to read OTA metadata.";
    }
  }

  // If otadata didn’t give a slot, fall back (factory if present, else unknown for now).
  if (!activeSlotId && !otadataSelectionUnavailable) {
    if (factoryEntry) {
      activeSlotId = "factory";
      activeSummary = activeSummary ?? "Active slot: factory (fallback)";
    } else {
      activeSummary = activeSummary ?? "Active slot unknown.";
    }
  }

  if (!activeSummary) activeSummary = "Active slot unknown.";

  // ---- Scan app partitions and extract metadata ----
  const results: AppPartitionMetadata[] = [];

  for (const entry of appEntries) {
    const slotLabel =
      entry.subtype === 0x00
        ? "factory"
        : entry.subtype >= 0x10 && entry.subtype <= 0x1f
          ? `ota_${entry.subtype - 0x10}`
          : `subtype_0x${entry.subtype.toString(16)}`;

    const readSize = Math.min(APP_SCAN_LENGTH, entry.size || APP_SCAN_LENGTH);
    let buffer: Uint8Array | null = null;
    let imageError: string | null = null;

    if (readSize >= 24) {
      try {
        buffer = await loaderInstance.readFlash(entry.offset, readSize);
      } catch (error) {
        imageError = formatErrorMessage(error);
        appendLog(`Failed to read app partition ${entry.label || slotLabel}`, error);
      }
    } else {
      imageError = "Partition too small to contain app image header.";
    }

    const offsetHex = `0x${entry.offset.toString(16).toUpperCase()}`;
    const sizeText = formatBytes(entry.size) ?? `${entry.size} bytes`;
    const displayName = entry.label?.trim() || slotLabel.toUpperCase();

    const appInfo: AppPartitionMetadata = {
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
      appInfo.error = "App header truncated.";
      results.push(appInfo);
      continue;
    }

    // If flash encryption is enabled, header magic won’t be readable.
    // The partition can still be a valid app slot; we just can’t parse metadata.
    if (buffer[0] !== APP_IMAGE_HEADER_MAGIC) {
      appInfo.valid = true;
      appInfo.error = "Image header unreadable (likely flash-encrypted).";
      results.push(appInfo);
      continue;
    }

    appInfo.valid = true;
    appInfo.segmentCount = buffer[1];
    appInfo.entryAddress = readUint32LE(buffer, 4);
    appInfo.entryAddressHex =
      appInfo.entryAddress != null ? `0x${appInfo.entryAddress.toString(16).toUpperCase()}` : null;

    const descriptor = extractAppDescriptor(buffer);
    if (descriptor) {
      appInfo.descriptorFound = true;
      appInfo.projectName = descriptor.projectName || null;
      appInfo.version = descriptor.version || null;
      appInfo.buildTime = descriptor.time || null;
      appInfo.buildDate = descriptor.date || null;
      appInfo.idfVersion = descriptor.idfVersion || null;

      const builtParts: string[] = [];
      if (descriptor.date) builtParts.push(descriptor.date);
      if (descriptor.time) builtParts.push(descriptor.time);
      appInfo.built = builtParts.join(" ").trim() || null;
    }

    results.push(appInfo);
  }

  // ---- Resolve active slot for UI ----
  let resolvedSlotId: string | null = activeSlotId;
  let resolvedSummary = activeSummary;
  const activeInfoCandidate = resolvedSlotId ? results.find(info => info.slotLabel === resolvedSlotId) ?? null : null;

  // Only do “infer active slot from valid images” when we DID NOT get a slot from otadata.
  if (!otadataSelectionUnavailable && !activeSlotFromOtadata && (!activeInfoCandidate || !activeInfoCandidate.valid)) {
    const fallbackCandidates = [
      results.find(info => info.valid && info.slotLabel === "factory"),
      results.find(info => info.valid && info.slotLabel.startsWith("ota_")),
      results.find(info => info.valid),
    ].filter((candidate): candidate is AppPartitionMetadata => Boolean(candidate));

    const fallbackInfo = fallbackCandidates.length ? fallbackCandidates[0] : null;

    if (fallbackInfo) {
      resolvedSlotId = fallbackInfo.slotLabel;
      resolvedSummary =
        activeInfoCandidate && !activeInfoCandidate.valid
          ? `Active slot ${activeInfoCandidate.slotLabel} invalid. Using ${fallbackInfo.slotLabel}.`
          : `Active slot inferred: ${fallbackInfo.slotLabel}.`;
    } else if (activeInfoCandidate && !activeInfoCandidate.valid) {
      resolvedSlotId = null;
      resolvedSummary = "Active slot invalid.";
    }
  } else if (activeSlotFromOtadata && activeInfoCandidate && !activeInfoCandidate.valid) {
    // Keep the otadata-selected slot even if we can’t parse the header/metadata.
    resolvedSummary =
      `Active slot from otadata: ${activeInfoCandidate.slotLabel}. ` +
      `Image metadata unavailable (encrypted or unreadable header).`;
  } else if (otadataSelectionUnavailable) {
    // If you prefer bootloader-style fallback, replace this branch with the fallback logic.
    resolvedSlotId = null;
    resolvedSummary = activeSummary;
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
  appActiveSummary.value = 'Active slot unknown.';
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
  const loaderInstance = loader.value;
  if (!connected.value || !loaderInstance) {
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
    await runLoaderOperation(() => analyzeAppPartitions(loaderInstance, partitions));
  } catch (error) {
    appendLog('Failed to analyze app partitions', error);
    appMetadataError.value = formatErrorMessage(error);
    appMetadataLoaded.value = false;
  } finally {
    appMetadataLoading.value = false;
  }
}

// Apply register lookup data for the selected chip.
function applyRegisterGuide(chipKey: string | null | undefined) {
  const guide = chipKey ? (registerGuides as Record<string, any>)[chipKey] : undefined;
  if (!guide) {
    registerOptions.value = [];
    registerReference.value = null;
    return;
  }
  registerReference.value = guide.reference || null;
  registerOptions.value = (guide.registers || []).map((entry: any) => {
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
    confirmationDialog.title = options.title || 'Please confirm';
    confirmationDialog.message = options.message || '';
    confirmationDialog.confirmText = options.confirmText || 'Confirm';
    confirmationDialog.cancelText = options.cancelText || 'Cancel';
    confirmationDialog.destructive = !!options.destructive;
    confirmationDialog.visible = true;
  });
}

// Resolve the pending confirmation promise and close the dialog.
function resolveConfirmation(result: boolean) {
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

const partitionColorOverrides: Record<string, string | undefined> = {
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

const partitionTypeColors: Record<number, string | undefined> = {
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

const UNUSED_FLASH_ALERT_THRESHOLD = 500 * 1024;

const PARTITION_TYPE_NAMES: Record<number, string> = {
  0x00: 'Application',
  0x01: 'Data',
};

const PARTITION_DATA_SUBTYPE_NAMES: Record<number, string> = {
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

// Format a number as a two-digit hex string with prefix.
function toPaddedHex(value: string | number | null | undefined) {
  const hex = Number(value).toString(16).toUpperCase();
  return `0x${hex.padStart(2, '0')}`;
}

// Build a label for a partition type value.
function getPartitionTypeLabel(type: number | null | undefined) {
  const hex = toPaddedHex(type ?? 0);
  const name = PARTITION_TYPE_NAMES[type ?? 0];
  return name ? `${name} (${hex})` : `Type ${hex}`;
}

// Build a label for a partition subtype given its type.
function getPartitionSubtypeLabel(type: number | null | undefined, subtype: number | null | undefined) {
  const subtypeValue = subtype ?? 0;
  const typeValue = type ?? 0;
  const hex = toPaddedHex(subtypeValue);
  let name: string | undefined;

  if (typeValue === 0x00) {
    if (subtypeValue === 0x00) {
      name = 'Factory App';
    } else if (subtypeValue === 0x01) {
      name = 'Test App';
    } else if (subtypeValue >= 0x10 && subtypeValue <= 0x1f) {
      name = `OTA ${subtypeValue - 0x10}`;
    } else if (subtypeValue === 0x20) {
      name = 'Any App';
    } else if (subtypeValue === 0x21) {
      name = 'OTA App';
    }
  } else if (typeValue === 0x01) {
    name = PARTITION_DATA_SUBTYPE_NAMES[subtypeValue];
    if (!name && subtypeValue >= 0x80 && subtypeValue <= 0x9f) {
      name = 'Custom Data';
    }
  }

  return name ? `${name} (${hex})` : `Subtype ${hex}`;
}

const UNUSED_SEGMENT_COLOR = '#c62828';
const UNUSED_SEGMENT_PATTERN =
  'repeating-linear-gradient(270deg, rgba(248, 113, 113, 0.65) 0px, rgba(248, 113, 113, 0.65) 12px, rgba(220, 38, 38, 0.65) 12px, rgba(220, 38, 38, 0.65) 24px)';

const RESERVED_SEGMENTS = computed(() => {
  let ptOffset = 0x8000;
  try {
    ptOffset = parseOffset(partitionTableOffset.value);
  } catch {
    // keep default
  }
  return [
    {
      key: 'bootloader',
      label: 'Bootloader',
      offset: 0x0,
      size: ptOffset,
      color: '#546e7a',
    },
    {
      key: 'partition-table',
      label: 'Partition Table',
      offset: ptOffset,
      size: 0x1000,
      color: '#78909c',
    },
  ];
});

const MIN_SEGMENT_PERCENT = 1; // ensure tiny partitions remain hoverable in the map

type PartitionMapSegment =
  | {
    kind: 'unused';
    key: string;
    offset: number;
    size: number;
  }
  | {
    kind: 'reserved';
    key: string;
    offset: number;
    size: number;
    label: string;
    color: string;
  }
  | {
    kind: 'partition';
    key: string;
    offset: number;
    size: number;
    entry: PartitionTableEntry;
  };

const partitionSegments = computed<PartitionSegment[]>(() => {
  if (!connected.value) {
    return [];
  }
  if (partitionTable.value.length == 0) {
    return [];
  }
  const sortedPartitions = [...partitionTable.value].sort((a, b) => a.offset - b.offset);
  const parseFlashSizeLabel = (label: unknown): number | null => {
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
  const segments: PartitionMapSegment[] = [];
  let cursor = 0;

  const createGapSegments = (start: number, size: number): PartitionMapSegment[] => {
    if (size <= 0) return [];
    const end = start + size;
    const gapSegments: PartitionMapSegment[] = [];
    let pointer = start;

    const relevantReserved = RESERVED_SEGMENTS.value.filter(
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

const unusedFlashSummary = computed<UnusedFlashSummary | null>(() => {
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

const formattedPartitions = computed<FormattedPartitionRow[]>(() => {
  const segmentByOffset = new Map();
  for (const segment of partitionSegments.value) {
    if (!segment.isUnused && !segment.isReserved) {
      segmentByOffset.set(segment.offset, segment);
    }
  }

  const reservedRows = RESERVED_SEGMENTS.value.map(segment => {
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

  if (isE2E) {
    return t('status.connected');
  }

  const name = chipDetails.value?.name?.trim();
  return name || t('status.connected');
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
function appendLog(message: string, prefix?: string): void;
function appendLog(message: string, detail: unknown, prefix?: string): void;
function appendLog(message: string, detailOrPrefix: unknown = '[ESPConnect-ui]', prefix?: string) {
  const defaultPrefix = '[ESPConnect-ui]';
  let effectivePrefix = defaultPrefix;
  let detail: unknown = undefined;

  if (typeof detailOrPrefix === 'string') {
    effectivePrefix = detailOrPrefix || defaultPrefix;
  } else if (detailOrPrefix != null) {
    detail = detailOrPrefix;
    if (typeof prefix === 'string') {
      effectivePrefix = prefix || defaultPrefix;
    }
  } else if (typeof prefix === 'string') {
    effectivePrefix = prefix || defaultPrefix;
  }

  const detailText = detail != null ? ` ${formatErrorMessage(detail)}` : '';
  const timestamp = new Date().toISOString();
  const versionTag = `v${APP_VERSION ?? '?.?'}`;
  const meta = `${versionTag} ${timestamp}`;
  const entry = effectivePrefix ? `${effectivePrefix} ${message}${detailText}` : `${message}${detailText}`;
  const line = `${meta} ${entry}`;
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
  write(data: string) {
    logBuffer.value += data;
  },
  writeLine(data: string) {
    logBuffer.value += `${data}\n`;
  },
};

// Clear the session log buffer.
function clearLog() {
  terminal.clean();
}

let monitorDecoder: TextDecoder | null = null;
let monitorNoiseChunks = 0;
let monitorNoiseWarned = false;
let monitorAutoResetPerformed = false;
let monitorTask: Promise<void> | null = null;
const monitorTextEncoder = new TextEncoder();

// Cancel any scheduled serial monitor flush.
function cancelMonitorFlush() {
  if (monitorFlushHandle === null) {
    return;
  }
  if (monitorFlushUsingAnimationFrame && typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
    window.cancelAnimationFrame(monitorFlushHandle as number);
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
function getPortIdentity(port: SerialPort | null | undefined): SerialPortInfo | null {
  if (!port || typeof port.getInfo !== 'function') {
    return null;
  }
  try {
    return port.getInfo();
  } catch (error) {
    appendLog('Unable to read serial port info', error);
    return null;
  }
}

// Compare two serial ports by USB identity.
function serialPortsMatch(portA: SerialPort | null | undefined, portB: SerialPort | null | undefined): boolean {
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
function appendMonitorChunk(bytes: Uint8Array) {
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
type SerialDisconnectEvent = Event & { port?: SerialPort; target?: { port?: SerialPort } };

async function onSerialDisconnectEvent(event: SerialDisconnectEvent) {
  const eventPort = event?.target?.port ?? event?.port ?? null;
  if (eventPort && currentPort.value && !serialPortsMatch(eventPort, currentPort.value)) {
    return;
  }
  if (!currentPort.value && !transport.value) {
    return;
  }
  appendLog('Serial device disconnected from USB. Cleaning up connection.', '[ESPConnect-Warn]');
  if (busy.value) {
    await disconnectTransport();
    busy.value = false;
    appendLog('Serial port disconnected.');
  } else {
    await disconnect();
  }
}

function handleSerialDisconnectEvent(event: Event) {
  void onSerialDisconnectEvent(event as SerialDisconnectEvent);
}

// Read serial data in a loop, pushing it into the monitor until aborted.
async function monitorLoop(signal: AbortSignal) {
  const transportInstance = transport.value;
  if (!transportInstance) {
    throw new Error('Serial monitor not supported by current transport.');
  }
  const iterator = transportInstance.rawRead(signal);
  for await (const chunk of iterator) {
    if (signal.aborted) break;
    if (!chunk || !chunk.length) continue;
    appendMonitorChunk(chunk);
  }
  flushPendingMonitorText();
}

async function sendMonitorText(text: string) {
  if (!text || !monitorActive.value || !canIssueMonitorCommands.value) {
    return;
  }
  const transportInstance = transport.value;
  if (!transportInstance) {
    return;
  }
  try {
    await transportInstance.writeRaw(monitorTextEncoder.encode(text));
  } catch (error) {
    appendLog(`Unable to send serial input (${formatErrorMessage(error)}).`, '[ESPConnect-Warn]');
  }
}

// Kick off the serial monitor and adjust baud if needed.
async function startMonitor() {
  if (!canStartMonitor.value || monitorActive.value || monitorStarting.value) {
    return;
  }
  if (!transport.value) {
    appendLog('Monitor unavailable: transport not ready.', '[ESPConnect-Warn]');
    return;
  }
  monitorStarting.value = true;
  try {
    await startMonitorFlow();
  } finally {
    monitorStarting.value = false;
  }
}

async function startMonitorFlow() {
  previousMonitorBaud.value = currentBaud.value || lastFlashBaud.value || DEFAULT_FLASH_BAUD;
  if (currentBaud.value !== MONITOR_BAUD) {
    try {
      await setConnectionBaud(MONITOR_BAUD, { remember: false, log: true });
    } catch (error) {
      appendLog(
        `Continuing monitor at ${currentBaud.value.toLocaleString()} bps (switch failed: ${formatErrorMessage(error)}).`,
        '[ESPConnect-Warn]'
      );
    }
  }
  if (!monitorAutoResetPerformed) {
    appendLog('Auto-resetting board before starting serial monitor output.', '[ESPConnect-Debug]');
    await enterUserFirmware();
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
  appendLog('Serial monitor started.', '[ESPConnect-Debug]');
  monitorTask = (async () => {
    try {
      await monitorLoop(controller.signal);
    } catch (err) {
      if (!controller.signal.aborted) {
        monitorError.value = formatErrorMessage(err);
        appendLog(`Monitor error: ${monitorError.value}`, '[ESPConnect-Warn]');
      }
    } finally {
      if (monitorAbortController.value === controller) {
        monitorAbortController.value = null;
      }
      monitorActive.value = false;
      monitorTask = null;
    }
  })();
}

// Stop the serial monitor and optionally disconnect from the device.
async function stopMonitor(options: StopMonitorOptions = {}) {
  const { closeConnection = false, returnToMaintenance = true } = options;

  const controller = monitorAbortController.value;
  const task = monitorTask;

  if (!monitorActive.value && !controller && !task) {
    return;
  }

  controller?.abort();
  monitorAbortController.value = null;
  monitorActive.value = false;

  if (task) {
    try {
      await task;
    } catch {
      // errors are surfaced in the monitor loop/log
    }
  }

  cancelMonitorFlush();
  flushPendingMonitorText();
  monitorPendingText = '';
  if (monitorDecoder) {
    try {
      monitorDecoder.decode(new Uint8Array(), { stream: false });
    } catch (err) {
      appendLog('Monitor decoder flush failed', err);
    }
    monitorDecoder = null;
  }

  appendLog('Serial monitor stopped.', '[ESPConnect-Debug]');

  if (closeConnection) {
    await disconnectTransport();
    serialMonitorClosedPrompt.value = true;
    return;
  }

  if (!returnToMaintenance) {
    return;
  }

  const loaderInstance = loader.value;
  if (!connected.value || !loaderInstance) {
    return;
  }

  busy.value = true;
  maintenanceReturnInProgress.value = true;
  appendLog('Returning to maintenance mode.', '[ESPConnect-ui]');
  connectDialog.label = t('dialogs.returningToMaintenance');
  connectDialog.message = t('dialogs.reEnteringBootloader');
  connectDialog.visible = true;
  try {
    await runLoaderOperation(() => loaderInstance.reconnect());
    monitorAutoResetPerformed = false;

    if (lastFlashBaud.value) {
      connectDialog.message = t('dialogs.restoringBaud', {
        baud: lastFlashBaud.value.toLocaleString(),
      });
      await setConnectionBaud(lastFlashBaud.value, { remember: true, log: true });
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : isRecord(error) && typeof error.message === 'string'
          ? error.message
          : undefined;

    if (errorMessage === "Couldn't sync to ESP. Try resetting.") {
      lastErrorMessage.value = formatErrorMessage(error);
      busyDialogMessage.value = '';
      showBusyDialog.value = false;
      showBootDialog.value = true;
      showGeneralErrorDialog.value = false;
    } else {
      appendLog(`Failed to return to maintenance mode: ${formatErrorMessage(error)}`, '[ESPConnect-Warn]');
    }
    await disconnectTransport();
  } finally {
    connectDialog.visible = false;
    connectDialog.message = '';
    maintenanceReturnInProgress.value = false;
    busy.value = false;
  }
}

// Pulse RTS/DTR to reset the target board.
async function enterUserFirmware() {
  const currentLoader = loader.value;
  if (!currentLoader) {
    appendLog('Cannot reset: loader not available.', '[ESPConnect-Warn]');
    return;
  }
  try {
    appendLog('Board Hard Reset', '[ESPConnect-Debug]');
    await runLoaderOperation(() => currentLoader.hardReset(false));
  } catch (err) {
    appendLog(`Board reset failed: ${formatErrorMessage(err)}`, '[error]');
  }
}

// Disconnect transport cleanly and reset local state.
async function disconnectTransport() {
  try {
    if (monitorActive.value) {
      await stopMonitor({ returnToMaintenance: false });
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
    appendLog('Error disconnecting transport', error);
  } finally {
    transport.value = null;
    currentPort.value = null;
    loader.value = null;
    esptoolClient.value = null;
    connected.value = false;
    chipDetails.value = null;
    flashSizeBytes.value = null;
    monitorError.value = null;
    monitorText.value = '';
    monitorAutoResetPerformed = false;
    serialMonitorClosedPrompt.value = false;
    maintenanceReturnInProgress.value = false;
    resetMaintenanceState();
    resetSpiffsState();
    spiffsState.selectedId = null;
    resetLittlefsState();
    littlefsState.selectedId = null;
    resetFatfsState();
    fatfsState.selectedId = null;
    resetNvsState();
    currentBaud.value = DEFAULT_FLASH_BAUD;
    baudChangeBusy.value = false;
    activeTab.value = 'info';
  }
}

// Open a serial connection, handshake the bootloader, and load device metadata.
async function connect() {
  if (!serialSupported) {
    appendLog('Web Serial API not available in this browser.');
    return;
  }
  if (busy.value) return;
  busy.value = true;
  flashProgress.value = 0;
  monitorAutoResetPerformed = false;
  serialMonitorClosedPrompt.value = false;
  resetMaintenanceState();
  connectDialog.visible = false;
  connectDialog.label = t('dialogs.connectingToDevice');
  connectDialog.message = t('dialogs.openingSerialPort');
  if (connectDialogTimer) {
    clearTimeout(connectDialogTimer);
    connectDialogTimer = null;
  }

  logBuffer.value = '';
  partitionTable.value = [];
  appendLog('Requesting serial port access...');

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
    const usbBridge = portDetails ? formatUsbBridge(portDetails) : "Unknown";
    const bridge =
      portDetails &&
        typeof portDetails.usbVendorId === 'number' &&
        typeof portDetails.usbProductId === 'number'
        ? getUsbDeviceInfo(portDetails.usbVendorId, portDetails.usbProductId)
        : undefined;

    if (bridge && bridge.productName === 'CH340' && typeof bridge.maxBaudrate === 'number' && desiredBaud > bridge.maxBaudrate) {
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
      showToast('Detected CH340 bridge; lowering baud to ' + desiredBaud + ' bps for stability.', { color: 'warning' });
      appendLog('Detected CH340 bridge; lowering baud to ' + desiredBaud + ' bps.', '[ESPConnect-Debug]');
    }

    // Create the client to communicate and do operations on the MCU
    const esptool = createEsptoolClient({
      port: currentPort.value,
      terminal,
      desiredBaud,
      debugSerial: false,
      debugLogging: false,
      onStatus: (payload: StatusPayload) => {
        if (!payload) {
          return;
        }
        const dialogText =
          payload.translationKey != null
            ? t(payload.translationKey, payload.params ?? {})
            : payload.message ?? '';
        const sessionLogMessage = payload.message ?? '';
        if (sessionLogMessage) {
          appendLog(sessionLogMessage, '[ESPConnect-Debug]');
        }
        const showInDialog = payload.showInDialog ?? true;
        if (showInDialog && dialogText) {
          connectDialog.message = dialogText;
        }
      },
    });
    esptoolClient.value = esptool;
    const client = esptoolClient.value;
    const transportInstance = client.transport;
    transport.value = transportInstance;
    loader.value = client.loader;
    currentBaud.value = connectBaud_defaultROM;
    transportInstance.baudrate = connectBaud_defaultROM;

    // Flush any input remaining on the transport
    try {
      await transportInstance.flushInput();
      appendLog('Serial input flushed before handshake.', '[ESPConnect-Debug]');
    } catch (err) {
      appendLog(`Warning: unable to flush serial input before handshake (${formatErrorMessage(err)}).`, '[ESPConnect-Warn]');
    }

    // Open the serial port, talk to the ROM bootloader, load the stub flasher
    connectDialog.message = t('dialogs.handshakingBootloader');
    const esp = await client.connectAndHandshake();
    currentBaud.value = desiredBaud || connectBaud_defaultROM;
    transportInstance.baudrate = currentBaud.value;
    const previousSuspendState = suspendBaudWatcher;
    suspendBaudWatcher = true;
    selectedBaud.value = currentBaud.value as BaudRate;
    queueMicrotask(() => {
      suspendBaudWatcher = previousSuspendState;
    });
    connected.value = true;
    appendLog(`Handshake complete with ${esp.chipName}. Collecting device details...`, '[ESPConnect-Debug]');

    const englishUnknown = t('deviceInfo.unknown', {}, { locale: 'en' });
    const chipIdLabel =
      typeof esp.chipId === 'number' && Number.isFinite(esp.chipId)
        ? `0x${esp.chipId.toString(16).toUpperCase()}`
        : englishUnknown;
    appendLog(
      t('sessionLog.chipId', { chipId: chipIdLabel }, { locale: 'en' }),
      '[ESPConnect-Debug]'
    );

    lastFlashBaud.value = currentBaud.value;

    const metadata = await client.readChipMetadata();
    const pkgVersionLabel =
      typeof metadata.pkgVersion === 'number' && !Number.isNaN(metadata.pkgVersion)
        ? String(metadata.pkgVersion)
        : englishUnknown;
    const chipRevisionLabel =
      typeof metadata.chipRevision === 'number' && !Number.isNaN(metadata.chipRevision)
        ? String(metadata.chipRevision)
        : englishUnknown;
    appendLog(
      t(
        'sessionLog.chipMetadata',
        { pkgVersion: pkgVersionLabel, chipRevision: chipRevisionLabel },
        { locale: 'en' }
      ),
      '[ESPConnect-Debug]'
    );

    const descriptionRaw = metadata.description ?? esp.chipName;
    const featuresRaw = metadata.features;
    const crystalFreq = metadata.crystalFreq;

    connectDialog.message = t('dialogs.readingFlashSize');
    const flashLabel = esp.flashSize;
    appendLog(
      `Chip detectFlashSize: ${flashLabel === null ? 'undefined' : flashLabel}`,
      '[ESPConnect-Debug]'
    );

    let flashId: number | null = null;
    let id: number | null = null;
    try {
      const detectedFlashId = await runLoaderOperation(() => client.loader.flashId());
      flashId = detectedFlashId;
      id = Number.isFinite(detectedFlashId) ? detectedFlashId : null;
    } catch (error) {
      appendLog(
        `Warning: unable to read flash ID (${formatErrorMessage(error)}).`,
        '[ESPConnect-Warn]'
      );
    }

    const manufacturerCode = id !== null ? id & 0xff : null;
    const memoryTypeCode = id !== null ? (id >> 8) & 0xff : null;
    const capacityCodeRaw = id !== null ? (id >> 16) & 0xff : null;

    appendLog(
      `Flash detect raw: getFlashSize=${flashLabel ?? 'n/a'}, flashId=${typeof flashId === 'number' && Number.isFinite(flashId) ? `0x${flashId
        .toString(16)
        .padStart(6, '0')
        .toUpperCase()}` : 'n/a'} (manuf=0x${typeof manufacturerCode === 'number'
          ? manufacturerCode.toString(16).toUpperCase().padStart(2, '0')
          : '??'}, type=0x${typeof memoryTypeCode === 'number'
            ? memoryTypeCode.toString(16).toUpperCase().padStart(2, '0')
            : '??'}, cap=0x${typeof capacityCodeRaw === 'number'
              ? capacityCodeRaw.toString(16).toUpperCase().padStart(2, '0')
              : '??'})`,
      '[ESPConnect-Debug]'
    );

    connectDialog.message = t('dialogs.preparingInformation');
    const featureList: string[] = Array.isArray(featuresRaw)
      ? (featuresRaw as string[])
      : typeof featuresRaw === 'string'
        ? (featuresRaw as string).split(/,\s*/)
        : [];

    const crystalLabel =
      typeof crystalFreq === 'number' ? `${Number(crystalFreq).toFixed(0)} MHz` : null;
    const macLabel = esp.macAddress ?? "unknown";

    applyRegisterGuide(esp.chipName);
    const facts: DeviceFact[] = [];
    const pushFact = (label: string, value: string | null | undefined) => {
      if (!value) return;
      facts.push({
        label,
        value,
        icon: FACT_ICONS[label] ?? null,
        translationKey: getFactLabelKey(label),
      });
    };
    const packageLabel = resolvePackageLabel(esp.chipName, metadata.pkgVersion, metadata.chipRevision);
    pushFact('Chip Variant', packageLabel);
    const packageMatch = packageLabel?.match(/\(([^)]+)\)$/);
    if (packageMatch) {
      const detail = PACKAGE_FORM_FACTORS[packageMatch[1]];
      pushFact('Package Form Factor', detail);
    }

    pushFact('Revision', resolveRevisionLabel(esp.chipName, metadata.chipRevision, metadata.majorVersion, metadata.minorVersion));

    const embeddedFlash = resolveEmbeddedFlash(esp.chipName, metadata.flashCap, metadata.flashVendor, featureList);
    pushFact('Embedded Flash', embeddedFlash);

    const embeddedPsram = resolveEmbeddedPsram(esp.chipName, metadata.psramCap, metadata.psramVendor, featureList);
    pushFact('Embedded PSRAM', embeddedPsram);

    const cpuFrequency = extractCpuFrequency(featureList);
    pushFact('Max CPU Frequency', cpuFrequency);

    const coreCount = extractCoreCount(featureList);
    pushFact('CPU Cores', coreCount);

    const pwmEntry =
      esp.chipName && esp.chipName in PWM_TABLE ? PWM_TABLE[esp.chipName as keyof typeof PWM_TABLE] : null;
    if (pwmEntry) {
      let pwmLabel = '';
      if (pwmEntry.hasLedc === false) {
        pwmLabel = pwmEntry.notes || 'Software PWM only';
      } else {
        const parts: string[] = [];
        const ledcChannels = (pwmEntry as any).ledcChannels;
        if (typeof ledcChannels === 'number') parts.push(`${ledcChannels} channels`);
        const ledcTimers = (pwmEntry as any).ledcTimers;
        if (typeof ledcTimers === 'number') parts.push(`${ledcTimers} timers`);
        if (pwmEntry.notes) parts.push(pwmEntry.notes);
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
      appendLog(`Warning: failed to flush serial input before partition read (${formatErrorMessage(err)}).`, '[ESPConnect-Warn]');
    }

    connectDialog.message = t('dialogs.readingPartitionTable');
    if (esp.chipName?.includes('ESP8266')) {
      appendLog('Skipping partition table read for ESP8266 (not supported).', '[ESPConnect-Debug]');
      partitionTable.value = [];
      appMetadataLoaded.value = false;
    } else if (loader.value) {
      const loaderInstance = loader.value;
      const detectedOffset = await runLoaderOperation(() => probePartitionTableOffset(loaderInstance, appendLog));
      updatePartitionTableOffset(`0x${detectedOffset.toString(16)}`);
      const partitions = await runLoaderOperation(() => readPartitionTable(loaderInstance, detectedOffset, undefined, appendLog));
      partitionTable.value = partitions;
      appMetadataLoaded.value = false;
    } else {
      partitionTable.value = [];
      appMetadataLoaded.value = false;
    }

    if (usbBridge) {
      pushFact('USB Bridge', usbBridge);
    }

    pushFact('Connection Baud', `${currentBaud.value.toLocaleString()} bps`);

    const featuresDisplay = featureList.filter(Boolean).map(humanizeFeature);
    // const orderedFacts = sortFacts(facts);
    const factGroups = buildFactGroups(facts);

    const details: DeviceDetails = {
      name: esp.chipName,
      description: descriptionRaw || esp.chipName,
      features: featuresDisplay,
      mac: macLabel,
      flashSize: flashLabel ?? null,
      crystal: crystalLabel,
      facts,
      factGroups,
    };
    chipDetails.value = details;
    activeTab.value = 'info';
    appendLog(
      `Loaded device details: ${details.name}, ${facts.length} facts.`,
      '[ESPConnect-Debug]'
    );

    connected.value = true;
    showBusyDialog.value = false;
    showBootDialog.value = false;
    showGeneralErrorDialog.value = false;
    appendLog(`Connection established. Ready to flash.`);
  } catch (error) {
    const errorName =
      error instanceof Error
        ? error.name
        : isRecord(error) && typeof error.name === 'string'
          ? error.name
          : undefined;
    const errorMessage =
      error instanceof Error
        ? error.message
        : isRecord(error) && typeof error.message === 'string'
          ? error.message
          : undefined;

    if (errorName === 'AbortError' || errorName === 'NotFoundError') {
      appendLog('Port selection was cancelled.');
    } else if (errorName === 'NetworkError') {
      const busyMessage = 'Selected port is busy or in use. Close other apps or tabs using it and try again.';
      appendLog(busyMessage, '[warn]');
      lastErrorMessage.value = busyMessage;
      busyDialogMessage.value = busyMessage;
      showBusyDialog.value = true;
      showBootDialog.value = false;
      showGeneralErrorDialog.value = false;
    } else if (errorMessage === "Couldn't sync to ESP. Try resetting.") {
      const message = formatErrorMessage(error);
      lastErrorMessage.value = message;
      busyDialogMessage.value = '';
      showBusyDialog.value = false;
      showBootDialog.value = true;
      showGeneralErrorDialog.value = false;
    } else {
      const message = formatErrorMessage(error);
      appendLog(`General code error: ${message}`, '[error]');
      lastErrorMessage.value = message;
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
    appendLog(`Connect flow finished (busy=${busy.value}).`, '[ESPConnect-Debug]');
  }
}

// Disconnect from the device and clean up state.
async function disconnect() {
  busy.value = true;
  await disconnectTransport();
  appendLog('Serial port disconnected.');
  busy.value = false;
}

// Parse a flash offset value from hex or decimal input.
function parseOffset(value: string): number {
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

// Parse a numeric input (hex or decimal) with validation.
function parseNumericInput(value: string | number | null | undefined, label: string): number {
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

async function refreshPartitionTable(loaderInstance = loader.value) {
  if (!loaderInstance) {
    return;
  }
  const showDialog = !connectDialog.visible;
  const previousDialog = showDialog
    ? { label: connectDialog.label, message: connectDialog.message }
    : null;

  if (showDialog) {
    connectDialog.label = t('dialogs.readingPartitionTable');
    connectDialog.message = '';
    connectDialog.visible = true;
  }

  try {
    if (chipDetails.value?.name?.includes('ESP8266')) {
      partitionTable.value = [];
      return;
    }
    let offset: number;
    try {
      offset = parseOffset(partitionTableOffset.value);
    } catch {
      offset = 0x8000;
    }
    const partitions = await runLoaderOperation(() =>
      readPartitionTable(loaderInstance, offset, undefined, appendLog),
    );
    partitionTable.value = partitions;
  } finally {
    if (showDialog) {
      connectDialog.visible = false;
      connectDialog.label = previousDialog?.label ?? connectDialog.label;
      connectDialog.message = previousDialog?.message ?? connectDialog.message;
    }
  }
}

// Flash the selected firmware image to the device.
async function flashFirmware() {
  const loaderInstance = loader.value;
  if (!loaderInstance || !firmwareBuffer.value) {
    appendLog('Select a firmware binary and connect to a device first.', '[ESPConnect-Warn]');
    return;
  }
  if (flashInProgress.value || busy.value) return;
  let shouldRefreshPartitions = false;

  let offsetNumber;
  try {
    offsetNumber = parseOffset(flashOffset.value);
  } catch (error) {
    appendLog(formatErrorMessage(error), '[error]');
    return;
  }

  const firmwareLabel = firmwareName.value || 'selected firmware';
  const activeBaudRaw =
    transport.value?.baudrate ||
    currentBaud.value ||
    selectedBaud.value ||
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
    appendLog('Firmware flash cancelled by user.', '[ESPConnect-Warn]');
    return;
  }
  shouldRefreshPartitions = true;

  flashInProgress.value = true;
  busy.value = true;
  flashProgress.value = 0;
  flashCancelRequested.value = false;
  flashProgressDialog.visible = true;
  flashProgressDialog.value = 0;
  flashProgressDialog.indeterminate = false;
  flashProgressDialog.label = `Preparing ${firmwareLabel} @ ${flashBaudLabel}...`;

  appendLog(`Flashing ${firmwareLabel} at 0x${offsetNumber.toString(16)}...`);

  try {
    const bytes = new Uint8Array(firmwareBuffer.value);
    const startTime = performance.now();

    await runLoaderOperation(async () => {
      const eraseFlashFn = (loaderInstance as ESPLoader & { eraseFlash?: () => Promise<void> }).eraseFlash;
      if (eraseFlash.value && typeof eraseFlashFn === 'function') {
        flashProgressDialog.label = `Erasing flash @ ${flashBaudLabel}...`;
        await eraseFlashFn.call(loaderInstance);
      }

      await loaderInstance.flashData(
        bytes.buffer,
        (written, total) => {
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
            ? `Flashing ${firmwareLabel} - ${writtenLabel} of ${totalLabel} bytes @ ${flashBaudLabel}`
            : `Flashing ${firmwareLabel} - ${writtenLabel} bytes @ ${flashBaudLabel}`;
        },
        offsetNumber,
        true
      );
    });
    flashProgressDialog.value = 100;
    flashProgressDialog.label = 'Finalizing Flash...'
    await esptoolClient.value?.syncWithStub();
    const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
    flashProgressDialog.label = `Flash complete in ${elapsed}s @ ${flashBaudLabel}. Finalizing...`;
    appendLog(`Flashing complete in ${elapsed}s. Device rebooted.`);
  } catch (error) {
    const message = formatErrorMessage(error);
    if (message === 'Flash cancelled by user') {
      appendLog('Flash cancelled by user.', '[ESPConnect-Warn]');
    } else {
      appendLog(`Flashing failed: ${message}`, '[error]');
    }
  } finally {
    flashProgress.value = 0;
    flashInProgress.value = false;
    flashCancelRequested.value = false;
    flashProgressDialog.visible = false;
    flashProgressDialog.value = 0;
    flashProgressDialog.label = '';
    flashProgressDialog.indeterminate = false;
    if (shouldRefreshPartitions) {
      await refreshPartitionTable(loaderInstance);
    }
    busy.value = false;
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
  flashProgressDialog.indeterminate = false;
  flashCancelRequested.value = false;
  downloadProgress.visible = false;
  downloadProgress.value = 0;
  downloadProgress.label = '';
  resetAppMetadata();
}

// Handle quick-selecting a register from the guide.
function handleSelectRegister(address: string) {
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
    appendLog(`Quick-selected register ${guide.label} (${guide.address}).`, '[ESPConnect-Debug]');
  }
}

// Read a register value via the loader.
async function handleReadRegister() {
  const loaderInstance = loader.value;
  if (!loaderInstance) {
    registerStatus.value = 'Connect to a device first.';
    registerStatusType.value = 'warning';
    return;
  }
  try {
    maintenanceBusy.value = true;
    registerStatus.value = null;
    const address = parseNumericInput(registerAddress.value, 'Register address');
    const value = await runLoaderOperation(() => loaderInstance.readRegister(address));
    registerReadResult.value = `0x${value.toString(16).toUpperCase().padStart(8, '0')}`;
    registerStatusType.value = 'success';
    registerStatus.value = `Read 0x${address.toString(16).toUpperCase()} = ${registerReadResult.value}`;
  } catch (error) {
    registerStatusType.value = 'error';
    registerStatus.value = `Read failed: ${formatErrorMessage(error)}`;
  } finally {
    maintenanceBusy.value = false;
    downloadProgress.visible = false;
  }
}

// Write a value to the selected register via the loader.
async function handleWriteRegister() {
  const loaderInstance = loader.value;
  if (!loaderInstance) {
    registerStatus.value = 'Connect to a device first.';
    registerStatusType.value = 'warning';
    return;
  }
  try {
    maintenanceBusy.value = true;
    registerStatus.value = null;
    const address = parseNumericInput(registerAddress.value, 'Register address');
    const value = parseNumericInput(registerValue.value, 'Register value');
    await runLoaderOperation(() => loaderInstance.writeRegister(address, value));
    registerReadResult.value = `0x${value.toString(16).toUpperCase().padStart(8, '0')}`;
    registerStatusType.value = 'success';
    registerStatus.value = `Wrote ${registerReadResult.value} to 0x${address
      .toString(16)
      .toUpperCase()}.`;
    appendLog(
      `Register write completed at 0x${address.toString(16).toUpperCase()} = ${registerReadResult.value}.`,
      '[ESPConnect-Debug]'
    );
  } catch (error) {
    registerStatusType.value = 'error';
    registerStatus.value = `Write failed: ${formatErrorMessage(error)}`;
  } finally {
    maintenanceBusy.value = false;
  }
}

// Compute an MD5 checksum over the specified flash region.
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
    const client = esptoolClient.value;
    if (!client) {
      throw new Error('ESPLoader client not available.');
    }
    const result = await client.flashMd5sum(offset, length);
    md5Status.value = null;
    md5Result.value = result;
    showToast('MD5 checksum computed.', { color: 'success' });
    appendLog(
      `Computed MD5 for 0x${offset.toString(16).toUpperCase()} (${length} bytes): ${result}`,
      '[ESPConnect-Debug]'
    );
  } catch (error) {
    md5StatusType.value = 'error';
    md5Status.value = `MD5 calculation failed: ${formatErrorMessage(error)}`;
    md5Result.value = null;
  } finally {
    maintenanceBusy.value = false;
  }
}

// Sanitize a string into a filesystem-safe filename.
function sanitizeFileName(name: string | null | undefined, fallback: string) {
  const base = typeof name === 'string' && name.trim() ? name.trim() : fallback;
  return base
    .replace(/[\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120);
}

// Timestamp helper for naming backup files.
function formatBackupTimestamp(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_` +
    `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
  );
}

// Read a flash region and trigger a download with optional progress handling.
async function downloadFlashRegion(offset: number, length: number, options: DownloadFlashOptions = {}) {
  const loaderInstance = loader.value;
  if (!loaderInstance) {
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
    selectedBaud.value ||
    DEFAULT_ROM_BAUD;
  const baudNumber = Number.isFinite(activeBaudRaw) ? activeBaudRaw : DEFAULT_ROM_BAUD;
  const baudLabel = baudNumber.toLocaleString() + ' bps';
  appendLog('Downloading ' + displayLabel + ' at ' + baudLabel + '.', '[ESPConnect-Debug]');

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

  const chunkBuffers: Uint8Array[] = [];
  const chunkSize = Math.max(0x1000, Math.min(MAX_CHUNK_SIZE, length));
  let totalReceived = 0;
  let buffer = null;
  let cancelled = false;
  return await runLoaderOperation(async () => {
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
        const chunkBuffer = await loaderInstance.readFlash(
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
              ' - ' +
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

    const blob = new Blob([toArrayBuffer(buffer)], { type: 'application/octet-stream' });
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
      '[ESPConnect-Debug]'
    );
    return finalName;
  });
}

// Handle flash download flows (manual, partition, all, used, custom).
async function handleDownloadFlash(payload: DownloadFlashPayload = { mode: 'manual' }) {
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
      downloadProgress.visible = true;
      downloadProgress.value = 0;
      downloadProgress.label = `Preparing ${partitions.length} partition download${partitions.length === 1 ? '' : 's'}...`;
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
            downloadProgress.label = `Partition ${partitionIndex + 1} of ${totalPartitions}: ${option.baseLabel} - ${progressLabel}`;
          },
        });
        completed += 1;
        downloadProgress.value = Math.min(100, (completed / totalPartitions) * 100);
        downloadProgress.label = `Partition ${completed} of ${totalPartitions}: ${option.baseLabel} complete.`;
      }
      downloadProgress.value = 100;
      downloadProgress.label =
        'Downloaded ' + partitions.length + ' partition' + (partitions.length === 1 ? '' : 's') + '.';
      downloadProgress.visible = false;
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
      const offset = payload?.offset;
      const length = payload?.length;
      if (typeof offset !== 'number' || !Number.isInteger(offset) || typeof length !== 'number' || !Number.isInteger(length)) {
        throw new Error('Custom download requires numeric offset and length.');
      }
      await downloadFlashRegion(offset, length, {
        label: payload?.label,
        fileName: payload?.fileName,
      });
      return;
    }

    flashReadStatusType.value = 'warning';
    flashReadStatus.value = 'Unsupported download mode.';
  } catch (error) {
    downloadProgress.visible = false;
    const errorMessage = formatErrorMessage(error);
    if (errorMessage === 'Download cancelled by user') {
      flashReadStatusType.value = 'warning';
      flashReadStatus.value = 'Download cancelled.';
    } else {
      flashReadStatusType.value = 'error';
      flashReadStatus.value = 'Download failed: ' + errorMessage;
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
    flashReadStatus.value = 'Select a partition to download.';
    return;
  }
  await handleDownloadFlash({ mode: 'partition', partition: option });
}

// Download every partition found in the table.
async function handleDownloadAllPartitions() {
  const partitions = partitionDownloadOptions.value.filter(option => option.size > 0);
  if (!partitions.length) {
    flashReadStatusType.value = 'warning';
    flashReadStatus.value = 'No partitions available to download.';
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
    flashProgressDialog.label = 'Stopping flash...';
    appendLog('Flash cancellation requested by user.', '[ESPConnect-Warn]');
  }
}

// Request cancellation of the current flash download.
function handleCancelDownload(options: CancelDownloadOptions = {}) {
  if (downloadCancelRequested.value) {
    return;
  }
  downloadCancelRequested.value = true;
  const label = options?.label || 'Stopping download...';
  if (downloadProgress.visible) {
    downloadProgress.label = label;
    flashReadStatusType.value = 'info';
    flashReadStatus.value = label;
  }
}

// Update flash read inputs when a partition option is chosen.
function handleSelectPartition(value: PartitionOptionValue) {
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
function handleSelectIntegrityPartition(value: PartitionOptionValue) {
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
      '[ESPConnect-Debug]'
    );
  } else if (value == null) {
    appendLog('Flash integrity partition selection cleared.', '[ESPConnect-Debug]');
  } else {
    md5StatusType.value = 'warning';
    md5Status.value = 'Selected partition is unavailable.';
    md5Result.value = null;
  }
}




// Erase a specific flash region by streaming 0xFF blocks to the loader.
async function eraseFlashRegion(offset: number, length: number, options: { label?: string } = {}) {
  const loaderInstance = loader.value as ESPLoader & { getFlashWriteSize?: () => number; IS_STUB?: boolean };
  if (!loaderInstance) {
    throw new Error('Device not connected.');
  }
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new Error('Invalid flash offset.');
  }
  if (!Number.isSafeInteger(length) || length <= 0) {
    throw new Error('Invalid flash length.');
  }
  const writeSize = typeof loaderInstance.getFlashWriteSize === 'function' ? loaderInstance.getFlashWriteSize() : 0x4000;
  if (!eraseFillBlock || eraseFillBlock.length !== writeSize) {
    eraseFillBlock = new Array(writeSize).fill(0xff);
  }
  const totalBlocks = Math.ceil(length / writeSize);
  const baseLabel =
    options.label && options.label.trim()
      ? `${t('flashFirmware.backup.status.erasingRegion')} (${options.label})`
      : t('flashFirmware.backup.status.erasingRegion');

  flashProgressDialog.visible = true;
  flashProgressDialog.indeterminate = false;
  flashProgressDialog.value = 0;
  flashProgressDialog.label = baseLabel;
  flashCancelRequested.value = false;

  await runLoaderOperation(async () => {
    await loaderInstance.flashBegin(length, offset);
    for (let seq = 0; seq < totalBlocks; seq += 1) {
      if (flashCancelRequested.value) {
        throw new Error(ERASE_CANCEL_MESSAGE);
      }
      await loaderInstance.flashBlock(eraseFillBlock as number[], seq);
      const written = Math.min(length, (seq + 1) * writeSize);
      const pct = Math.min(100, Math.floor((written / length) * 100));
      flashProgressDialog.value = pct;
      flashProgressDialog.label = `${baseLabel} - ${pct}%`;
    }
    if (loaderInstance.IS_STUB) {
      await loaderInstance.flashBegin(0, 0);
      await loaderInstance.flashFinish();
    }
  });

  flashProgressDialog.value = 100;
}

// Erase flash with confirmation (entire chip, partition, or custom region).
async function handleEraseFlash(payload: EraseFlashPayload = { mode: 'full' }) {
  const loaderInstance = loader.value;
  if (!loaderInstance) {
    flashReadStatus.value = t('flashFirmware.backup.status.connectFirst');
    flashReadStatusType.value = 'warning';
    return;
  }

  const mode = payload.mode ?? 'full';

  if (mode === 'partition') {
    const partitionPayload = payload as Extract<EraseFlashPayload, { mode: 'partition' }>;
    const partitionValue = partitionPayload.partition ?? selectedPartitionDownload.value;
    const option = partitionOptionLookup.value.get(partitionValue);
    if (!option) {
      flashReadStatusType.value = 'warning';
      flashReadStatus.value = t('flashFirmware.backup.status.partitionRequired');
      return;
    }

    const confirmErase = await showConfirmation({
      title: t('flashFirmware.backup.erasePartitionConfirmTitle'),
      message: t('flashFirmware.backup.erasePartitionConfirmMessage', {
        label: option.baseLabel,
        offset: option.offsetHex,
        size: option.sizeText,
      }),
      confirmText: t('flashFirmware.backup.eraseConfirmButton'),
      cancelText: t('dialogs.cancel'),
      destructive: true,
    });
    if (!confirmErase) {
      flashReadStatusType.value = 'info';
      flashReadStatus.value = t('flashFirmware.backup.status.cancelled');
      appendLog('Flash erase cancelled by user.', '[ESPConnect-Warn]');
      return;
    }

    try {
      maintenanceBusy.value = true;
      flashInProgress.value = true;
      flashReadStatusType.value = 'info';
      flashReadStatus.value = t('flashFirmware.backup.status.erasingPartition');
      await eraseFlashRegion(option.offset, option.size, { label: option.baseLabel });
      flashReadStatusType.value = 'success';
      flashReadStatus.value = t('flashFirmware.backup.status.partitionComplete');
      appendLog(
        `Partition erased: ${option.baseLabel} (${option.offsetHex}, ${option.sizeText}).`,
        '[ESPConnect-Debug]',
      );
    } catch (error) {
      const message = formatErrorMessage(error);
      const cancelled = message === ERASE_CANCEL_MESSAGE;
      flashReadStatusType.value = cancelled ? 'warning' : 'error';
      flashReadStatus.value = cancelled
        ? t('flashFirmware.backup.status.cancelled')
        : t('flashFirmware.backup.status.failed', { error: message });
    } finally {
      maintenanceBusy.value = false;
      flashInProgress.value = false;
      flashProgressDialog.visible = false;
      flashProgressDialog.value = 0;
      flashProgressDialog.label = '';
      flashProgressDialog.indeterminate = false;
      flashCancelRequested.value = false;
    }
    return;
  }

  if (mode === 'region') {
    let offset: number;
    let length: number;
    try {
      const regionPayload = payload as Extract<EraseFlashPayload, { mode: 'region' }>;
      const offsetSource = regionPayload.offset ?? flashReadOffset.value;
      const lengthSource = regionPayload.length ?? flashReadLength.value;
      if (!offsetSource?.toString().trim() || !lengthSource?.toString().trim()) {
        flashReadStatusType.value = 'warning';
        flashReadStatus.value = t('flashFirmware.backup.status.regionRequired');
        return;
      }
      offset = parseNumericInput(offsetSource as string, 'Flash offset');
      length = parseNumericInput(lengthSource as string, 'Flash length');
    } catch (error) {
      flashReadStatusType.value = 'error';
      flashReadStatus.value = formatErrorMessage(error);
      return;
    }
    if (flashSizeBytes.value && offset + length > flashSizeBytes.value) {
      flashReadStatusType.value = 'warning';
      flashReadStatus.value = t('flashFirmware.backup.status.regionOutOfBounds');
      return;
    }

    const offsetHex = '0x' + offset.toString(16).toUpperCase();
    const lengthHex = '0x' + length.toString(16).toUpperCase();
    const regionPayload = payload as Extract<EraseFlashPayload, { mode: 'region' }>;
    const label = regionPayload.label || t('flashFirmware.backup.downloadRegion');
    const confirmErase = await showConfirmation({
      title: t('flashFirmware.backup.eraseRegionConfirmTitle'),
      message: t('flashFirmware.backup.eraseRegionConfirmMessage', {
        label,
        offset: offsetHex,
        length: length.toLocaleString(),
      }),
      confirmText: t('flashFirmware.backup.eraseConfirmButton'),
      cancelText: t('dialogs.cancel'),
      destructive: true,
    });
    if (!confirmErase) {
      flashReadStatusType.value = 'info';
      flashReadStatus.value = t('flashFirmware.backup.status.cancelled');
      appendLog('Flash erase cancelled by user.', '[ESPConnect-Warn]');
      return;
    }

    try {
      maintenanceBusy.value = true;
      flashInProgress.value = true;
      flashReadStatusType.value = 'info';
      flashReadStatus.value = t('flashFirmware.backup.status.erasingRegion');
      await eraseFlashRegion(offset, length, { label: `${label} ${offsetHex} (${lengthHex})` });
      flashReadStatusType.value = 'success';
      flashReadStatus.value = t('flashFirmware.backup.status.regionComplete');
      appendLog(`Flash region erased: ${offsetHex} length ${lengthHex}.`, '[ESPConnect-Debug]');
    } catch (error) {
      const message = formatErrorMessage(error);
      const cancelled = message === ERASE_CANCEL_MESSAGE;
      flashReadStatusType.value = cancelled ? 'warning' : 'error';
      flashReadStatus.value = cancelled
        ? t('flashFirmware.backup.status.cancelled')
        : t('flashFirmware.backup.status.failed', { error: message });
    } finally {
      maintenanceBusy.value = false;
      flashInProgress.value = false;
      flashProgressDialog.visible = false;
      flashProgressDialog.value = 0;
      flashProgressDialog.label = '';
      flashProgressDialog.indeterminate = false;
      flashCancelRequested.value = false;
    }
    return;
  }

  const eraseFlashFn = (loaderInstance as ESPLoader & { eraseFlash?: () => Promise<void> }).eraseFlash;
  if (!eraseFlashFn) {
    flashReadStatusType.value = 'warning';
    flashReadStatus.value = t('flashFirmware.backup.status.unsupported');
    return;
  }

  const confirmErase = await showConfirmation({
    title: t('flashFirmware.backup.eraseConfirmTitle'),
    message: t('flashFirmware.backup.eraseConfirmMessage'),
    confirmText: t('flashFirmware.backup.eraseConfirmButton'),
    cancelText: t('dialogs.cancel'),
    destructive: true,
  });
  if (!confirmErase) {
    flashReadStatusType.value = 'info';
    flashReadStatus.value = t('flashFirmware.backup.status.cancelled');
    appendLog('Flash erase cancelled by user.', '[ESPConnect-Warn]');
    return;
  }

  let shouldRefreshPartitions = false;
  try {
    maintenanceBusy.value = true;
    flashReadStatusType.value = 'info';
    flashReadStatus.value = t('flashFirmware.backup.status.erasing');
    flashProgressDialog.visible = true;
    flashProgressDialog.value = 0;
    flashProgressDialog.indeterminate = true;
    flashProgressDialog.label = t('flashFirmware.progress.erasingFlash');
    await runLoaderOperation(() => eraseFlashFn.call(loaderInstance));
    shouldRefreshPartitions = true;
  } catch (error) {
    flashReadStatusType.value = 'error';
    flashReadStatus.value = t('flashFirmware.backup.status.failed', {
      error: formatErrorMessage(error),
    });
  } finally {
    maintenanceBusy.value = false;
    flashProgressDialog.visible = false;
    flashProgressDialog.value = 0;
    flashProgressDialog.label = '';
    flashProgressDialog.indeterminate = false;
    if (shouldRefreshPartitions) {
      await refreshPartitionTable(loaderInstance);
      flashReadStatusType.value = 'success';
      flashReadStatus.value = t('flashFirmware.backup.status.complete');
      appendLog('Entire flash erased.', '[ESPConnect-Debug]');
    }
  }
}

// Load a firmware file into memory for flashing.
async function handleFirmwareInput(files: File | File[] | null) {
  const file = Array.isArray(files) ? files[0] : files;
  if (!file) {
    firmwareBuffer.value = null;
    firmwareName.value = '';
    return;
  }
  firmwareBuffer.value = await file.arrayBuffer();
  firmwareName.value = file.name;
  appendLog(`Firmware loaded: ${file.name} (${file.size} bytes).`);
}

// Apply a preset flash offset value.
function applyOffsetPreset(value: string | null | undefined) {
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

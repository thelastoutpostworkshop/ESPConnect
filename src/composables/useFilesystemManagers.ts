import { reactive, ref } from 'vue';
import type { LittlefsEntry } from '../types/littlefs';

export interface FatFSEntry {
  path: string;
  size: number;
}

export interface LittleFSEntry {
  path: string;
  size: number;
  type: "file" | "dir";
}

export type SpiffsClient = {
  list: () => Promise<Array<{ name: string; size: number; type: 'file' | 'dir' }>>;
  read: (path: string) => Promise<Uint8Array>;
  write: (path: string, data: Uint8Array) => Promise<void>;
  remove: (path: string) => Promise<void>;
  format: () => Promise<void>;
  toImage: () => Promise<Uint8Array>;
  getUsage?: () => { capacityBytes: number; usedBytes: number; freeBytes: number };
  canFit?: (path: string, size: number) => boolean;
};

export type LittlefsClient = {
  list?: (path?: string) =>  LittleFSEntry[];
  readFile?: (path: string) => any;
  read?: (path: string) => Uint8Array;
  writeFile?: (path: string, data: any) => any;
  addFile?: (path: string, data: any) => any;
  delete?: (path: string, options?: { recursive?: boolean }) => any;
  deleteFile?: (path: string) => any;
  mkdir?: (path: string) => any;
  format: () => any;
  toImage: () => Uint8Array;
  getUsage?: () => { capacityBytes: number; usedBytes: number; freeBytes: number };
  canFit?: (path: string, size: number) => boolean;
  getDiskVersion?: () => number;
  setDiskVersion?: (version: number) => void;
};

export type FatfsClient = {
  list?: () => FatFSEntry[];
  writeFile: (path: string, data: any) => any;
  deleteFile: (path: string) => any;
  format: () => any;
  toImage: () => Uint8Array;
  readFile?: (path: string) => Uint8Array;
  read?: (path: string) => any;
};

export function useSpiffsManager() {
  const spiffsLoadCancelRequested = ref(false);
  const spiffsState = reactive({
    selectedId: null as number | null,
    lastReadOffset: null as number | null,
    lastReadSize: 0,
    lastReadImage: null as Uint8Array | null,
    files: [] as Array<{ name?: string; size?: number }>,
    status: 'Load a SPIFFS partition to begin.',
    loading: false,
    busy: false,
    saving: false,
    error: null as string | null,
    client: null as SpiffsClient | null,
    readOnly: false,
    readOnlyReason: '',
    dirty: false,
    backupDone: false,
    sessionBackupDone: false,
    loadCancelled: false,
    diagnostics: [] as Array<unknown>,
    baselineFiles: [] as Array<{ name?: string; size?: number }>,
    usage: {
      capacityBytes: 0,
      usedBytes: 0,
      freeBytes: 0,
    },
    uploadBlocked: false,
    uploadBlockedReason: '',
  });
  const spiffsBackupDialog = reactive({ visible: false, value: 0, label: '' });
  const spiffsLoadingDialog = reactive({ visible: false, value: 0, label: 'Reading SPIFFS...' });
  const spiffsSaveDialog = reactive({ visible: false, value: 0, label: 'Saving SPIFFS...' });
  const spiffsRestoreDialog = reactive({ visible: false, value: 0, label: 'Restoring SPIFFS image...' });
  const spiffsViewerDialog = reactive({
    visible: false,
    name: '',
    content: '',
    error: null as string | null,
    loading: false,
    mode: null as string | null,
    imageUrl: '',
    audioUrl: '',
    source: 'spiffs' as 'spiffs' | 'fatfs' | 'littlefs',
  });

  return {
    spiffsState,
    spiffsLoadCancelRequested,
    spiffsBackupDialog,
    spiffsLoadingDialog,
    spiffsSaveDialog,
    spiffsRestoreDialog,
    spiffsViewerDialog,
  };
}

export function useLittlefsManager(defaultBlockSize: number) {
  const littlefsLoadCancelRequested = ref(false);
  const littlefsState = reactive({
    selectedId: null as number | null,
    lastReadOffset: null as number | null,
    lastReadSize: 0,
    lastReadImage: null as Uint8Array | null,
    client: null as LittlefsClient | null,
    files: [] as LittlefsEntry[],
    allFiles: [] as LittlefsEntry[],
    currentPath: '/' as string,
    status: 'Load a LittleFS partition to begin.',
    loading: false,
    busy: false,
    saving: false,
    error: null as string | null,
    readOnly: false,
    readOnlyReason: '',
    dirty: false,
    backupDone: false,
    sessionBackupDone: false,
    loadCancelled: false,
    usage: {
      capacityBytes: 0,
      usedBytes: 0,
      freeBytes: 0,
    },
    baselineFiles: [] as LittlefsEntry[],
    uploadBlocked: false,
    uploadBlockedReason: '',
    blockSize: defaultBlockSize,
    blockCount: 0,
    diskVersion: 0 as number,  // LittleFS disk version (0x00020000 = v2.0, 0x00020001 = v2.1)
  });
  const littlefsBackupDialog = reactive({ visible: false, value: 0, label: '' });
  const littlefsLoadingDialog = reactive({ visible: false, value: 0, label: 'Reading LittleFS...' });
  const littlefsSaveDialog = reactive({ visible: false, value: 0, label: 'Saving LittleFS...' });
  const littlefsRestoreDialog = reactive({ visible: false, value: 0, label: 'Restoring LittleFS image...' });

  return {
    littlefsState,
    littlefsLoadCancelRequested,
    littlefsBackupDialog,
    littlefsLoadingDialog,
    littlefsSaveDialog,
    littlefsRestoreDialog,
  };
}

export function useFatfsManager(defaultBlockSize: number) {
  const fatfsLoadCancelRequested = ref(false);
  const fatfsState = reactive({
    selectedId: null as number | null,
    lastReadOffset: null as number | null,
    lastReadSize: 0,
    lastReadImage: null as Uint8Array | null,
    client: null as FatfsClient | null,
    files: [] as Array<{ name?: string; size?: number }>,
    status: 'Load a FATFS partition to begin.',
    loading: false,
    busy: false,
    saving: false,
    error: null as string | null,
    readOnly: false,
    readOnlyReason: '',
    dirty: false,
    backupDone: false,
    sessionBackupDone: false,
    loadCancelled: false,
    usage: {
      capacityBytes: 0,
      usedBytes: 0,
      freeBytes: 0,
    },
    baselineFiles: [] as Array<{ name?: string; size?: number }>,
    uploadBlocked: false,
    uploadBlockedReason: '',
    blockSize: defaultBlockSize,
    blockCount: 0,
  });
  const fatfsBackupDialog = reactive({ visible: false, value: 0, label: '' });
  const fatfsLoadingDialog = reactive({ visible: false, value: 0, label: 'Reading FATFS...' });
  const fatfsSaveDialog = reactive({ visible: false, value: 0, label: 'Saving FATFS...' });
  const fatfsRestoreDialog = reactive({ visible: false, value: 0, label: 'Restoring FATFS image...' });

  return {
    fatfsState,
    fatfsLoadCancelRequested,
    fatfsBackupDialog,
    fatfsLoadingDialog,
    fatfsSaveDialog,
    fatfsRestoreDialog,
  };
}

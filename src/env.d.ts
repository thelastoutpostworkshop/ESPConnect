/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

interface ImportMetaEnv {
  readonly VITE_E2E?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface ElectronSerialPortPickerPort {
  index: number;
  portId: string;
  portName?: string;
  displayName?: string;
  serialNumber?: string;
  vendorId?: number;
  productId?: number;
  recommended?: boolean;
}

interface ElectronSerialPortPickerRequest {
  requestId: string;
  ports: ElectronSerialPortPickerPort[];
  defaultPortId?: string;
}

interface ElectronAPI {
  platform: NodeJS.Platform;
  isElectron: boolean;
  versions: {
    node: string;
    chrome: string;
    electron: string;
  };
  saveFile: (
    data: ArrayBuffer | Uint8Array | number[],
    defaultFilename?: string,
    filters?: Array<{ name: string; extensions: string[] }>,
  ) => Promise<unknown>;
  openFile: (filters?: Array<{ name: string; extensions: string[] }>) => Promise<unknown>;
  showMessage: (type: string, title: string, message: string, buttons?: string[]) => Promise<number>;
  showConfirm: (message: string, title?: string) => Promise<boolean>;
  onSerialPortPickerOpen: (callback: (payload: ElectronSerialPortPickerRequest) => void) => () => void;
  selectSerialPort: (requestId: string, portId: string) => void;
}

interface Window {
  electronAPI?: ElectronAPI;
}

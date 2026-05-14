// Preload script for Electron
// This runs in a sandboxed environment with access to some Node.js APIs

const { contextBridge, ipcRenderer } = require('electron');

// Expose platform info and file APIs to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
  
  // File operations
  saveFile: (data, defaultFilename, filters) => 
    ipcRenderer.invoke('save-file', { data, defaultFilename, filters }),
  
  openFile: (filters) => 
    ipcRenderer.invoke('open-file', { filters }),
  
  // Dialog operations
  showMessage: (type, title, message, buttons) =>
    ipcRenderer.invoke('show-message', { type, title, message, buttons }),
  
  showConfirm: (message, title) =>
    ipcRenderer.invoke('show-confirm', { message, title }),

  onSerialPortPickerOpen: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('serial-port-picker:open', listener);
    return () => ipcRenderer.removeListener('serial-port-picker:open', listener);
  },

  selectSerialPort: (requestId, portId) =>
    ipcRenderer.send('serial-port-picker:select', { requestId, portId })
});

// Log when preload script runs
console.log('ESPConnect Electron preload script loaded');
console.log('Platform:', process.platform);
console.log('Electron version:', process.versions.electron);
console.log('Chrome version:', process.versions.chrome);

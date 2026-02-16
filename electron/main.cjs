const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// Only required for Windows Squirrel installer
if (process.platform === 'win32') {
  try {
    if (require('electron-squirrel-startup')) {
      app.quit();
    }
  } catch (e) {
    // Module not available, ignore
  }
}

let mainWindow;

// Store granted serial port devices
const grantedDevices = new Map();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    title: 'ESPConnect - ESP Device Manager',
    autoHideMenuBar: false,
  });

  const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
  const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL(devServerUrl).catch((error) => {
      console.warn(
        `[ESPConnect] Failed to load Vite dev server at ${devServerUrl}; falling back to built assets if available.`,
        error
      );

      if (fs.existsSync(indexPath)) {
        return mainWindow.loadFile(indexPath);
      }

      dialog.showErrorBox(
        'ESPConnect',
        `Could not load the Vite dev server at ${devServerUrl}.\n\nStart it with: npm run dev`
      );
      app.quit();
    });
  } else if (fs.existsSync(indexPath)) {
    mainWindow.loadFile(indexPath);
  } else {
    mainWindow.loadURL(devServerUrl);
  }

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Setup serial port handlers for this window's session
  setupSerialPortHandlers(mainWindow.webContents.session);
}

function setupSerialPortHandlers(session) {
  const isLikelyEspPort = (port) => {
    const name = `${port?.displayName || ''} ${port?.portName || ''}`.toLowerCase();
    return (
      name.includes('cp210') ||
      name.includes('cp2102') ||
      name.includes('cp2104') ||
      name.includes('ch910') ||
      name.includes('ch340') ||
      name.includes('ch341') ||
      name.includes('ch343') ||
      name.includes('ch9102') ||
      name.includes('ftdi') ||
      name.includes('ft232') ||
      name.includes('usb') ||
      name.includes('uart') ||
      name.includes('silicon labs') ||
      name.includes('esp32') ||
      name.includes('esp8266') ||
      name.includes('esp')
    );
  };

  const getPortLabel = (port) => port?.displayName || port?.portName || port?.portId || 'Unknown port';

  const getPortButtonLabel = (port, isRecommended = false) => {
    const shortId = port?.portName || port?.displayName || port?.portId || 'Unknown';
    return isRecommended ? `${shortId} (Recommended)` : shortId;
  };

  const toHexId = (value) =>
    typeof value === 'number' ? `0x${value.toString(16).toUpperCase().padStart(4, '0')}` : null;

  // Handle serial port selection - shows when navigator.serial.requestPort() is called
  session.on('select-serial-port', async (event, portList, webContents, callback) => {
    event.preventDefault();

    console.log('Available serial ports:', portList.map(p => ({
      portId: p.portId,
      portName: p.portName,
      displayName: p.displayName
    })));

    if (!portList || portList.length === 0) {
      console.log('No serial ports available');
      callback('');
      return;
    }

    if (portList.length === 1) {
      const selectedPort = portList[0];
      console.log('Only one serial port available; selecting:', selectedPort.portId);
      callback(selectedPort.portId);
      return;
    }

    const detail = portList.map((port, index) => {
      const vendorId = toHexId(port.vendorId);
      const productId = toHexId(port.productId);
      const usbId = vendorId && productId ? `${vendorId}:${productId}` : null;
      const metadata = [usbId].filter(Boolean).join(' | ');
      const primary = port.portName ? `${port.portName} - ${getPortLabel(port)}` : getPortLabel(port);
      return `${index + 1}. ${primary}${metadata ? ` (${metadata})` : ''}`;
    }).join('\n');

    const defaultIndex = Math.max(portList.findIndex(isLikelyEspPort), 0);
    const buttonLabels = portList.map((port, index) => getPortButtonLabel(port, index === defaultIndex));
    const cancelIndex = buttonLabels.length;

    try {
      const ownerWindow = BrowserWindow.fromWebContents(webContents) || mainWindow;
      const result = await dialog.showMessageBox(ownerWindow, {
        type: 'question',
        title: 'ESPConnect',
        message: 'Select the serial port for your ESP device.',
        detail,
        buttons: [...buttonLabels, 'Cancel'],
        defaultId: defaultIndex,
        cancelId: cancelIndex,
        noLink: true,
      });

      const selectedPort = portList[result.response];
      if (!selectedPort) {
        console.log('Serial port selection canceled');
        callback('');
        return;
      }

      console.log('Selected port:', selectedPort.portId, getPortLabel(selectedPort));
      callback(selectedPort.portId);
    } catch (error) {
      console.error('Failed to show serial port picker:', error);
      callback('');
    }
  });

  // Track port additions
  session.on('serial-port-added', (event, port) => {
    console.log('Serial port added:', port);
  });

  // Track port removals
  session.on('serial-port-removed', (event, port) => {
    console.log('Serial port removed:', port);
  });

  // Grant permission for serial port access checks
  session.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    if (permission === 'serial') {
      return true;
    }
    return true;
  });

  // Handle device permission requests  
  session.setDevicePermissionHandler((details) => {
    if (details.deviceType === 'serial') {
      if (details.device) {
        grantedDevices.set(details.device.deviceId, details.device);
      }
      return true;
    }
    return true;
  });
}

// Create application menu
function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About ESPConnect',
          click: async () => {
            const { shell } = require('electron');
            await shell.openExternal('https://github.com/thelastoutpostworkshop/ESPConnect');
          }
        },
        {
          label: 'ESP32 Documentation',
          click: async () => {
            const { shell } = require('electron');
            await shell.openExternal('https://docs.espressif.com/');
          }
        },
        {
          label: 'Tutorial Video',
          click: async () => {
            const { shell } = require('electron');
            await shell.openExternal('https://youtu.be/-nhDKzBxHiI');
          }
        }
      ]
    }
  ];

  // macOS specific menu adjustments
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  createMenu();
  createWindow();

  app.on('activate', () => {
    // On macOS re-create a window when dock icon is clicked and no windows are open
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ============================================
// IPC Handlers for File Operations
// ============================================

// Save file dialog and write data
ipcMain.handle('save-file', async (event, { data, defaultFilename, filters }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultFilename,
    filters: filters || [
      { name: 'Binary Files', extensions: ['bin'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (result.canceled || !result.filePath) {
    return { success: false, canceled: true };
  }

  try {
    // Convert data to Buffer if it's a Uint8Array or array
    const buffer = Buffer.from(data);
    fs.writeFileSync(result.filePath, buffer);
    return { success: true, filePath: result.filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Open file dialog and read data
ipcMain.handle('open-file', async (event, { filters }) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: filters || [
      { name: 'Binary Files', extensions: ['bin'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, canceled: true };
  }

  try {
    const filePath = result.filePaths[0];
    const data = fs.readFileSync(filePath);
    const filename = path.basename(filePath);
    return { 
      success: true, 
      filePath, 
      filename,
      data: Array.from(data) // Convert Buffer to array for IPC transfer
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Show message box
ipcMain.handle('show-message', async (event, { type, title, message, buttons }) => {
  const result = await dialog.showMessageBox(mainWindow, {
    type: type || 'info',
    title: title || 'ESPConnect',
    message: message,
    buttons: buttons || ['OK']
  });
  return result.response;
});

// Show confirm dialog
ipcMain.handle('show-confirm', async (event, { message, title }) => {
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    title: title || 'Confirm',
    message: message,
    buttons: ['OK', 'Cancel'],
    defaultId: 0,
    cancelId: 1
  });
  return result.response === 0; // true if OK clicked
});

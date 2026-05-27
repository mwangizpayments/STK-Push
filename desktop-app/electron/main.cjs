const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('node:path');
const {
  createSplashWindow,
  getBrandingAssetPath,
  startSplashSequence
} = require('./splash.cjs');
const { configureAutoUpdater } = require('./updater.cjs');

const isDev = process.argv.includes('--dev');
const APP_NAME = 'M-PESA STK Terminal';
const STARTUP_FALLBACK_MS = 14000;
const enableKioskMode =
  process.env.MPESA_KIOSK_MODE === 'true' || process.env.VITE_KIOSK_MODE === 'true';

let mainWindow = null;
let splashWindow = null;
let splashSequence = null;
let startupFallbackTimer = null;
let updateController = null;
let terminalShell = {
  cashierLocked: false,
  cashierMode: 'simple',
  role: ''
};
const revealState = {
  fallbackReady: false,
  mainReady: false,
  rendererReady: false,
  revealed: false,
  splashDone: false
};

const singleInstanceLock = app.requestSingleInstanceLock();

if (!singleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const targetWindow = mainWindow || BrowserWindow.getAllWindows()[0];

    if (!targetWindow || targetWindow.isDestroyed()) {
      return;
    }

    if (targetWindow.isMinimized()) {
      targetWindow.restore();
    }

    targetWindow.focus();
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1200,
    minHeight: 800,
    show: false,
    title: APP_NAME,
    backgroundColor: '#f8fafc',
    autoHideMenuBar: !isDev,
    icon: getBrandingAssetPath('icon-placeholder.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      devTools: isDev,
      nodeIntegration: false,
      sandbox: false
    }
  });

  installWindowGuards(mainWindow);

  if (!isDev) {
    mainWindow.removeMenu();
  }

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer-dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    revealState.mainReady = true;
    maybeRevealMainWindow();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

function installWindowGuards(windowInstance) {
  windowInstance.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  windowInstance.webContents.on('before-input-event', (event, input) => {
    if (shouldBlockInput(input)) {
      event.preventDefault();
    }
  });

  windowInstance.webContents.on('will-navigate', (event, navigationUrl) => {
    if (isNavigationEscape(windowInstance.webContents.getURL(), navigationUrl)) {
      event.preventDefault();
    }
  });

  windowInstance.webContents.on('did-finish-load', () => {
    windowInstance.webContents.setZoomFactor(1);
    windowInstance.webContents.setVisualZoomLevelLimits(1, 1).catch(() => {});
  });

  if (!isDev) {
    windowInstance.webContents.on('devtools-opened', () => {
      windowInstance.webContents.closeDevTools();
    });
  }
}

function shouldBlockInput(input) {
  const key = String(input.key || '').toLowerCase();
  const hasCommandModifier = Boolean(input.control || input.meta);
  const blocksRefresh = key === 'f5' || (hasCommandModifier && key === 'r');
  const blocksZoom = hasCommandModifier && ['+', '=', '-', '0'].includes(key);
  const blocksDevTools =
    !isDev && (key === 'f12' || (hasCommandModifier && input.shift && ['i', 'j', 'c'].includes(key)));
  const blocksCashierEscape =
    terminalShell.cashierLocked &&
    (key === 'browserback' ||
      key === 'browserforward' ||
      key === 'f11' ||
      (input.alt && ['arrowleft', 'arrowright', 'left', 'right'].includes(key)));

  return blocksRefresh || blocksZoom || blocksDevTools || blocksCashierEscape;
}

function isNavigationEscape(currentUrl, nextUrl) {
  if (!currentUrl || !nextUrl) {
    return false;
  }

  try {
    const current = new URL(currentUrl);
    const next = new URL(nextUrl);

    return current.origin !== next.origin || current.protocol !== next.protocol;
  } catch (_error) {
    return true;
  }
}

function configureTerminalShell({ cashierMode = 'simple', role = '' } = {}) {
  terminalShell = {
    cashierLocked: role === 'cashier',
    cashierMode,
    role
  };

  if (!mainWindow || mainWindow.isDestroyed()) {
    return terminalShell;
  }

  if (terminalShell.cashierLocked) {
    mainWindow.setMinimumSize(1200, 800);
    mainWindow.setResizable(false);
    if (enableKioskMode) {
      mainWindow.setKiosk(true);
      mainWindow.setFullScreen(true);
    }
  } else {
    if (mainWindow.isKiosk()) {
      mainWindow.setKiosk(false);
    }
    if (mainWindow.isFullScreen()) {
      mainWindow.setFullScreen(false);
    }
    mainWindow.setResizable(true);
  }

  return terminalShell;
}

function maybeRevealMainWindow() {
  if (
    revealState.revealed ||
    !mainWindow ||
    mainWindow.isDestroyed() ||
    !revealState.mainReady ||
    !revealState.splashDone ||
    (!revealState.rendererReady && !revealState.fallbackReady)
  ) {
    return;
  }

  revealState.revealed = true;
  clearTimeout(startupFallbackTimer);

  if (!mainWindow.isMaximized() && !enableKioskMode) {
    mainWindow.maximize();
  }

  mainWindow.show();

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  if (splashSequence) {
    splashSequence.stop();
  }

  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
  }
}

function resetRevealState() {
  Object.assign(revealState, {
    fallbackReady: false,
    mainReady: false,
    rendererReady: false,
    revealed: false,
    splashDone: false
  });
}

function openTerminalWithSplash() {
  clearTimeout(startupFallbackTimer);
  resetRevealState();

  splashWindow = createSplashWindow({ appName: APP_NAME });
  splashSequence = startSplashSequence(splashWindow);
  splashSequence.complete.then(() => {
    revealState.splashDone = true;
    maybeRevealMainWindow();
  });

  startupFallbackTimer = setTimeout(() => {
    revealState.fallbackReady = true;
    splashSequence?.setStatus('Opening terminal...');
    maybeRevealMainWindow();
  }, STARTUP_FALLBACK_MS);

  createMainWindow();
}

if (singleInstanceLock) {
  app.whenReady().then(() => {
    app.setName(APP_NAME);

    if (!isDev) {
      Menu.setApplicationMenu(null);
    }

    ipcMain.handle('app:version', () => app.getVersion());
    ipcMain.handle('app:platform', () => process.platform);
    ipcMain.handle('startup:set-status', (_event, message) => {
      splashSequence?.setStatus(message);
      return true;
    });
    ipcMain.handle('terminal:configure-shell', (_event, options) => configureTerminalShell(options));
    ipcMain.on('app:boot-ready', (_event, payload = {}) => {
      if (payload.status) {
        splashSequence?.setStatus(payload.status);
      }

      revealState.rendererReady = true;
      maybeRevealMainWindow();
    });

    updateController = configureAutoUpdater({
      app,
      getMainWindow: () => mainWindow,
      ipcMain,
      isDev
    });

    openTerminalWithSplash();
    updateController.checkOnStartup();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        openTerminalWithSplash();
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

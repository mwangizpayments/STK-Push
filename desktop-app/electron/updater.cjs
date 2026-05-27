const { autoUpdater } = require('electron-updater');

const UPDATE_STATE_CHANNEL = 'update:state';
const UPDATE_RESTART_CHANNEL = 'update:restart-and-install';
const UPDATE_GET_STATE_CHANNEL = 'update:get-state';
const STARTUP_UPDATE_CHECK_DELAY_MS = 5000;

function configureAutoUpdater({ app, getMainWindow, ipcMain, isDev }) {
  let latestState = {
    status: isDev || !app.isPackaged ? 'disabled' : 'idle',
    version: app.getVersion()
  };
  let hasCheckedForUpdates = false;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = false;
  autoUpdater.allowDowngrade = false;

  configureUpdateFeed();
  registerUpdaterEvents();

  ipcMain.handle(UPDATE_GET_STATE_CHANNEL, () => latestState);
  ipcMain.handle(UPDATE_RESTART_CHANNEL, () => {
    if (latestState.status !== 'downloaded') {
      return { ok: false, reason: 'update_not_ready' };
    }

    publishState('installing');
    setImmediate(() => autoUpdater.quitAndInstall(false, true));
    return { ok: true };
  });

  function checkOnStartup() {
    if (isDev || !app.isPackaged || hasCheckedForUpdates) {
      return;
    }

    hasCheckedForUpdates = true;
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((error) => {
        publishState('error', { message: normalizeErrorMessage(error) });
      });
    }, STARTUP_UPDATE_CHECK_DELAY_MS);
  }

  function configureUpdateFeed() {
    const customUpdateUrl = String(process.env.UPDATE_SERVER_URL || '').trim();

    if (!customUpdateUrl) {
      return;
    }

    autoUpdater.setFeedURL({
      provider: 'generic',
      url: customUpdateUrl
    });
  }

  function registerUpdaterEvents() {
    autoUpdater.on('checking-for-update', () => {
      publishState('checking');
    });

    autoUpdater.on('update-available', (info) => {
      publishState('downloading', {
        releaseName: info.releaseName,
        releaseNotes: info.releaseNotes,
        updateVersion: info.version
      });
    });

    autoUpdater.on('update-not-available', () => {
      publishState('idle');
    });

    autoUpdater.on('download-progress', (progress) => {
      publishState('downloading', {
        percent: Math.round(Number(progress.percent || 0))
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      publishState('downloaded', {
        releaseName: info.releaseName,
        releaseNotes: info.releaseNotes,
        updateVersion: info.version
      });

      if (process.env.MPESA_FORCE_UPDATE_ON_DOWNLOAD === 'true') {
        publishState('installing');
        setImmediate(() => autoUpdater.quitAndInstall(false, true));
      }
    });

    autoUpdater.on('error', (error) => {
      publishState('error', { message: normalizeErrorMessage(error) });
    });
  }

  function publishState(status, details = {}) {
    latestState = {
      ...latestState,
      ...details,
      status,
      version: app.getVersion()
    };

    const targetWindow = getMainWindow();

    if (!targetWindow || targetWindow.isDestroyed()) {
      return;
    }

    targetWindow.webContents.send(UPDATE_STATE_CHANNEL, latestState);
  }

  return {
    checkOnStartup,
    getState: () => latestState
  };
}

function normalizeErrorMessage(error) {
  return error?.message || 'Update check failed';
}

module.exports = {
  configureAutoUpdater
};

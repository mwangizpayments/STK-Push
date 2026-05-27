const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mpesaDesktop', {
  appVersion: () => ipcRenderer.invoke('app:version'),
  bootReady: (payload) => ipcRenderer.send('app:boot-ready', payload),
  configureTerminal: (options) => ipcRenderer.invoke('terminal:configure-shell', options),
  getUpdateState: () => ipcRenderer.invoke('update:get-state'),
  onUpdateState: (callback) => {
    if (typeof callback !== 'function') {
      return () => {};
    }

    const listener = (_event, state) => callback(state);
    ipcRenderer.on('update:state', listener);
    return () => ipcRenderer.removeListener('update:state', listener);
  },
  platform: () => ipcRenderer.invoke('app:platform'),
  restartAndInstallUpdate: () => ipcRenderer.invoke('update:restart-and-install'),
  setBootStatus: (message) => ipcRenderer.invoke('startup:set-status', message)
});

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mpesaDesktop', {
  appVersion: () => ipcRenderer.invoke('app:version'),
  platform: () => ipcRenderer.invoke('app:platform')
});


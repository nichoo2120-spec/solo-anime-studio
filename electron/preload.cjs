// Tiny safe bridge (optional for the web app): version + manual update check.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('soloDesktop', {
  version: ipcRenderer.sendSync('sas-version'),
  checkForUpdates: () => ipcRenderer.invoke('sas-check-updates'),
});

// Tiny safe bridge (optional for the web app): version + manual update check.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('soloDesktop', {
  version: ipcRenderer.sendSync('sas-version'),
  onSaveBeforeClose: callback => {
    const listener = () => callback();
    ipcRenderer.on('sas-save-before-close', listener);
    return () => ipcRenderer.removeListener('sas-save-before-close', listener);
  },
  closeAfterSave: () => ipcRenderer.send('sas-close-after-save'),
  checkForUpdates: () => ipcRenderer.invoke('sas-check-updates'),
});

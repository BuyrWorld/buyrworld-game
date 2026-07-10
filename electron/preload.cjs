// Safe bridge into the renderer. Exposes just enough for the game to know it's
// running as a desktop app (so it can hide the web "Install" button, etc.).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('buyrworld', {
  isDesktop: true,
  platform: process.platform,
  version: () => ipcRenderer.invoke('app:version'),
});

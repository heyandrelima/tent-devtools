const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tend', {
  loadMappings: async () => {
    return await ipcRenderer.invoke('mappings:load');
  },
  saveMappings: async (mappings) => {
    return await ipcRenderer.invoke('mappings:save', mappings);
  },
  openSetup: async () => {
    return await ipcRenderer.invoke('window:openSetup');
  },
  checkCaddy: async () => {
    return await ipcRenderer.invoke('deps:checkCaddy');
  },
  downloadCaddy: async () => {
    return await ipcRenderer.invoke('deps:downloadCaddy');
  },
  startService: async () => {
    return await ipcRenderer.invoke('service:start');
  },
  stopService: async () => {
    return await ipcRenderer.invoke('service:stop');
  },
  serviceStatus: async () => {
    return await ipcRenderer.invoke('service:status');
  }
});



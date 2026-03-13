const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    secureStore: {
        getItem: (key) => ipcRenderer.invoke('secure-store:get', key),
        setItem: (key, value) => ipcRenderer.invoke('secure-store:set', key, value),
        removeItem: (key) => ipcRenderer.invoke('secure-store:remove', key),
    },
});

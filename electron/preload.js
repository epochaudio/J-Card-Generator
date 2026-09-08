const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    ai: {
        text: request => ipcRenderer.invoke('ai:text', request),
        image: request => ipcRenderer.invoke('ai:image', request)
    },
    projects: {
        open: () => ipcRenderer.invoke('projects:open'),
        save: value => ipcRenderer.invoke('projects:save', value),
        readDraft: () => ipcRenderer.invoke('projects:readDraft'),
        writeDraft: value => ipcRenderer.invoke('projects:writeDraft', value),
        clearDraft: () => ipcRenderer.invoke('projects:clearDraft'),
        onCloseRequest: callback => {
            const listener = () => callback();
            ipcRenderer.on('projects:close-request', listener);
            return () => ipcRenderer.removeListener('projects:close-request', listener);
        },
        cancelClose: () => ipcRenderer.send('projects:close-cancelled'),
        approveClose: () => ipcRenderer.send('projects:close-approved')
    },
    secureStore: {
        getItem: (key) => ipcRenderer.invoke('secure-store:get', key),
        setItem: (key, value) => ipcRenderer.invoke('secure-store:set', key, value),
        removeItem: (key) => ipcRenderer.invoke('secure-store:remove', key),
    },
});

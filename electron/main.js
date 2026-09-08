const { app, BrowserWindow, ipcMain, safeStorage, net } = require('electron');
const path = require('path');

const { createSecureStore } = require('./secureStore.cjs');
let secureStore;
let providerAPI;

const { createProjectStore } = require('./projectStore.cjs');
let projectStore;
let mainWindow;
let closeApproved = false;
let quitRequested = false;
app.on('before-quit', () => { quitRequested = true; });

function assertMainWindow(event) {
    if (event.sender !== mainWindow?.webContents || event.senderFrame !== mainWindow.webContents.mainFrame) {
        throw new Error('无效的应用窗口。');
    }
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1400,
        height: 900,
        icon: path.join(__dirname, '../build/icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        },
    });

    mainWindow = win;
    closeApproved = false;
    win.on('close', event => {
        if (!closeApproved) {
            event.preventDefault();
            win.webContents.send('projects:close-request');
        }
    });

    const startUrl = process.env.ELECTRON_START_URL ||
        `file://${path.join(__dirname, '../dist/index.html')}`;

    if (process.env.ELECTRON_START_URL) {
        win.loadURL(startUrl);
    } else {
        win.loadFile(path.join(__dirname, '../dist/index.html'));
    }
}

for (const [channel, method] of [['get', 'getItem'], ['set', 'setItem'], ['remove', 'removeItem']]) {
    ipcMain.handle(`secure-store:${channel}`, (event, ...args) => {
        assertMainWindow(event);
        return secureStore[method](...args);
    });
}
for (const [kind, method] of [['text', 'generateText'], ['image', 'generateImage']]) {
    ipcMain.handle(`ai:${kind}`, (event, request) => {
        assertMainWindow(event);
        // Endpoints are selected inside providerAPI; renderer cannot supply a target URL.
        return providerAPI[method](request, { fetchImpl: (url, options) => net.fetch(url, options) });
    });
}

for (const method of ['open', 'save', 'readDraft', 'writeDraft', 'clearDraft']) {
    ipcMain.handle(`projects:${method}`, (event, argument) => {
        if (event.sender !== mainWindow?.webContents || event.senderFrame !== mainWindow.webContents.mainFrame) {
            throw new Error('无效的作品窗口。');
        }
        return projectStore[method](argument);
    });
}
ipcMain.on('projects:close-approved', event => {
    if (event.sender !== mainWindow?.webContents || event.senderFrame !== mainWindow.webContents.mainFrame) return;
    closeApproved = true;
    if (quitRequested) app.quit();
    else mainWindow.close();
});
ipcMain.on('projects:close-cancelled', event => {
    if (event.sender === mainWindow?.webContents) quitRequested = false;
});

app.whenReady().then(async () => {
    secureStore = createSecureStore(path.join(app.getPath('userData'), 'secure-store.json'), safeStorage);
    providerAPI = await import('../src/ai/providerAPI.mjs');
    const { parseProject, MAX_PROJECT_BYTES } = await import('../src/project/projectFormat.mjs');
    projectStore = createProjectStore({
        userData: app.getPath('userData'), dialog: require('electron').dialog,
        parent: () => mainWindow, validate: parseProject, maxBytes: MAX_PROJECT_BYTES
    });
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

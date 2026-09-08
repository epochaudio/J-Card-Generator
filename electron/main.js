const { app, BrowserWindow, ipcMain, safeStorage, net, shell, dialog } = require('electron');
const path = require('path');

// Keep existing settings, encrypted credentials and drafts after the display-name change.
const legacyProductName = 'Tape Cover Generator';
const defaultBrandedDataPath = path.join(app.getPath('appData'), 'TapeFolio');
if (app.isPackaged && app.getPath('userData') === defaultBrandedDataPath) {
    app.setPath('userData', path.join(app.getPath('appData'), legacyProductName));
}


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
        title: '带藏 · TapeFolio',
        icon: path.join(__dirname, '../build/icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        },
    });

    mainWindow = win;
    const openWebPage = url => {
        let destination;
        try { destination = new URL(url); }
        catch { return; }
        if (!['http:', 'https:'].includes(destination.protocol)) return;
        void shell.openExternal(destination.href).catch(() => {
            dialog.showErrorBox('无法打开网页', '系统默认浏览器启动失败，请检查默认浏览器设置后重试。');
        });
    };
    win.webContents.setWindowOpenHandler(({ url }) => {
        openWebPage(url);
        return { action: 'deny' };
    });
    win.webContents.on('will-navigate', (event, url) => {
        event.preventDefault();
        openWebPage(url);
    });
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
const visionRequests = new Map();
ipcMain.handle('ai:vision', async (event, request) => {
    assertMainWindow(event);
    const id = request?.requestId;
    if (typeof id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(id) || visionRequests.has(id)) throw new Error('视觉请求标识无效。');
    if (visionRequests.size) throw new Error('已有视觉分析正在进行，请先取消或等待完成。');
    const controller = new AbortController();
    visionRequests.set(id, controller);
    try { return await providerAPI.analyzeImages(request, { fetchImpl: (url, options) => net.fetch(url, options), signal: controller.signal }); }
    finally { visionRequests.delete(id); }
});
ipcMain.handle('ai:vision-cancel', (event, id) => {
    assertMainWindow(event);
    visionRequests.get(id)?.abort();
});

for (const [kind, method] of [['text', 'generateText'], ['image', 'generateImage'], ['models', 'listModels']]) {
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

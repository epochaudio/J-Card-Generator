const { app, BrowserWindow, ipcMain, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');

const SECURE_STORE_PATH = () => path.join(app.getPath('userData'), 'secure-store.json');

function readSecureStore() {
    try {
        return JSON.parse(fs.readFileSync(SECURE_STORE_PATH(), 'utf8'));
    } catch (error) {
        return {};
    }
}

function writeSecureStore(store) {
    fs.writeFileSync(SECURE_STORE_PATH(), JSON.stringify(store), 'utf8');
}

function encryptString(value) {
    if (!safeStorage.isEncryptionAvailable()) {
        return null;
    }
    return safeStorage.encryptString(value).toString('base64');
}

function decryptString(value) {
    if (!value) return '';
    if (!safeStorage.isEncryptionAvailable()) {
        return '';
    }
    return safeStorage.decryptString(Buffer.from(value, 'base64'));
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

    const startUrl = process.env.ELECTRON_START_URL ||
        `file://${path.join(__dirname, '../dist/index.html')}`;

    if (process.env.ELECTRON_START_URL) {
        win.loadURL(startUrl);
    } else {
        win.loadFile(path.join(__dirname, '../dist/index.html'));
    }
}

ipcMain.handle('secure-store:get', async (_event, key) => {
    const store = readSecureStore();
    return decryptString(store[key]);
});

ipcMain.handle('secure-store:set', async (_event, key, value) => {
    const encryptedValue = encryptString(value);
    if (!encryptedValue) {
        return false;
    }
    const store = readSecureStore();
    store[key] = encryptedValue;
    writeSecureStore(store);
    return true;
});

ipcMain.handle('secure-store:remove', async (_event, key) => {
    const store = readSecureStore();
    if (key in store) {
        delete store[key];
        writeSecureStore(store);
    }
    return true;
});

app.whenReady().then(() => {
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

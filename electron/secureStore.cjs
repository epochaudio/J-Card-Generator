const fs = require('node:fs/promises');
const { atomicWrite } = require('./projectStore.cjs');
const KEYS = new Set(['jcard_ai_settings_v1', 'jcard_dashscope_api_key', 'dashscope_api_key', 'gemini_api_key']);

function createSecureStore(filename, encryption, io = fs) {
  let queue = Promise.resolve();
  const run = (key, operation) => {
    if (!KEYS.has(key)) return Promise.reject(new Error('不支持的设置项。'));
    const pending = queue.then(operation);
    queue = pending.catch(() => {});
    return pending;
  };
  const read = async () => {
    try {
      const data = JSON.parse(await io.readFile(filename, 'utf8'));
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('invalid');
      return data;
    } catch (error) {
      if (error.code === 'ENOENT') return {};
      throw new Error('密钥存储无法读取，未覆盖原有文件。');
    }
  };
  return {
    getItem: key => run(key, async () => {
      const store = await read();
      if (!store[key]) return '';
      if (!encryption.isEncryptionAvailable()) throw new Error('系统加密存储不可用。');
      try { return encryption.decryptString(Buffer.from(store[key], 'base64')); }
      catch { throw new Error('密钥无法解密，请检查当前系统账户。'); }
    }),
    setItem: (key, value) => run(key, async () => {
      if (typeof value !== 'string') throw new Error('设置内容无效。');
      if (!encryption.isEncryptionAvailable()) return false;
      const store = await read();
      store[key] = encryption.encryptString(value).toString('base64');
      await atomicWrite(filename, JSON.stringify(store), io);
      return true;
    }),
    removeItem: key => run(key, async () => {
      const store = await read();
      if (Object.hasOwn(store, key)) {
        delete store[key];
        await atomicWrite(filename, JSON.stringify(store), io);
      }
      return true;
    })
  };
}
module.exports = { createSecureStore };

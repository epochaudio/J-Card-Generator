const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

async function atomicWrite(filename, content, io = fs) {
  const temporary = `${filename}.${randomUUID()}.tmp`;
  try {
    await io.writeFile(temporary, content, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    await io.rename(temporary, filename);
  } finally {
    await io.unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}

function createProjectStore({ userData, dialog, parent, validate, maxBytes, io = fs }) {
  const targets = new Map();
  const draftPath = path.join(userData, 'current-project.jcard');
  // Serialize writes and deletes, so an older draft cannot replace a newer one.
  let draftQueue = Promise.resolve();
  const enqueue = operation => {
    const pending = draftQueue.then(operation);
    draftQueue = pending.catch(() => {});
    return pending;
  };
  const read = async filename => {
    const info = await io.stat(filename);
    if (info.size > maxBytes) throw new Error('作品超过 64 MB。');
    const content = await io.readFile(filename, 'utf8');
    validate(content);
    return content;
  };
  const filters = [{ name: 'J-Card 作品', extensions: ['jcard'] }];
  return {
    async open() {
      const result = await dialog.showOpenDialog(parent(), { filters, properties: ['openFile'] });
      if (result.canceled || !result.filePaths.length) return null;
      const filename = result.filePaths[0];
      const content = await read(filename);
      const token = randomUUID();
      targets.set(token, filename);
      return { content, token, name: path.basename(filename) };
    },
    async save({ content, name, token }) {
      validate(content);
      let filename = token ? targets.get(token) : null;
      if (token && !filename) throw new Error('保存目标已失效，请另存为。');
      if (!filename) {
        const result = await dialog.showSaveDialog(parent(), { filters, defaultPath: path.basename(name || '未命名作品.jcard') });
        if (result.canceled || !result.filePath) return null;
        filename = result.filePath;
        if (!filename.toLowerCase().endsWith('.jcard')) filename += '.jcard';
      }
      await atomicWrite(filename, content, io);
      const savedToken = token || randomUUID();
      targets.set(savedToken, filename);
      return { token: savedToken, name: path.basename(filename) };
    },
    readDraft: () => enqueue(async () => {
      try { return await read(draftPath); } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
      }
    }),
    writeDraft: content => enqueue(async () => { validate(content); await atomicWrite(draftPath, content, io); }),
    clearDraft: () => enqueue(() => io.unlink(draftPath).catch(error => { if (error.code !== 'ENOENT') throw error; }))
  };
}
module.exports = { createProjectStore, atomicWrite };

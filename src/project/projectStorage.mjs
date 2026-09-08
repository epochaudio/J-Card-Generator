import { MAX_PROJECT_BYTES } from './projectFormat.mjs';

const databaseName = 'jcard-projects';
const storeName = 'drafts';
const draftKey = 'current';
const desktop = () => globalThis.window?.electronAPI?.projects;

function draftRequest(mode, operation) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(storeName, mode);
      const result = operation(transaction.objectStore(storeName));
      transaction.oncomplete = () => { db.close(); resolve(result.result ?? null); };
      transaction.onabort = transaction.onerror = () => { db.close(); reject(transaction.error || new Error('草稿存储失败')); };
    };
  });
}

export const projectStorage = {
  async open() {
    if (desktop()) return desktop().open();
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = '.jcard';
      input.oncancel = () => resolve(null);
      input.onchange = async () => {
        const file = input.files[0];
        if (!file) return resolve(null);
        try {
          if (file.size > MAX_PROJECT_BYTES) throw new Error('作品超过 64 MB。');
          resolve({ content: await file.text(), name: file.name, token: null });
        } catch (error) { reject(error); }
      };
      input.click();
    });
  },
  async save(content, name, token, saveAs) {
    if (desktop()) return desktop().save({ content, name, token: saveAs ? null : token });
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = name; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { name, token: null, downloaded: true };
  },
  readDraft: () => desktop() ? desktop().readDraft() : draftRequest('readonly', store => store.get(draftKey)),
  writeDraft: (content) => desktop() ? desktop().writeDraft(content) : draftRequest('readwrite', store => store.put(content, draftKey)),
  clearDraft: () => desktop() ? desktop().clearDraft() : draftRequest('readwrite', store => store.delete(draftKey))
};

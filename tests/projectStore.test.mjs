import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseProject, serializeProject, MAX_PROJECT_BYTES } from '../src/project/projectFormat.mjs';
const { createProjectStore, atomicWrite } = createRequire(import.meta.url)('../electron/projectStore.cjs');
const content = title => serializeProject({ data: { title, sideA: [], sideB: [] } });

async function setup(t) {
  const dir = await mkdtemp(path.join(tmpdir(), 'jcard-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const selected = path.join(dir, '作品.jcard');
  const dialog = { showOpenDialog: async () => ({ canceled: false, filePaths: [selected] }), showSaveDialog: async () => ({ canceled: false, filePath: selected }) };
  const store = createProjectStore({ userData: dir, dialog, parent: () => null, validate: parseProject, maxBytes: MAX_PROJECT_BYTES });
  return { dir, selected, dialog, store };
}
test('save, overwrite and open use authorized tokens and portable contents', async t => {
  const { selected, store } = await setup(t);
  const first = await store.save({ content: content('one'), name: '作品.jcard' });
  await store.save({ content: content('two'), token: first.token });
  assert.equal(parseProject(await readFile(selected, 'utf8')).data.title, 'two');
  assert.equal(parseProject((await store.open()).content).data.title, 'two');
  await assert.rejects(store.save({ content: content('bad'), token: '/unauthorized/path' }), /失效/);
});
test('cancelled dialogs do not modify disk; corrupt open does not create a target', async t => {
  const { dir, selected, store, dialog } = await setup(t);
  dialog.showSaveDialog = async () => ({ canceled: true });
  assert.equal(await store.save({ content: content('cancel') }), null);
  assert.deepEqual(await readdir(dir), []);
  await writeFile(selected, '{');
  await assert.rejects(store.open(), /JSON/);
});
test('failed atomic replacement preserves previous file and removes temporary file', async t => {
  const { dir, selected } = await setup(t);
  await writeFile(selected, 'original');
  const io = await import('node:fs/promises');
  await assert.rejects(atomicWrite(selected, 'new', { ...io, rename: async () => { throw new Error('disk full'); } }), /disk full/);
  assert.equal(await readFile(selected, 'utf8'), 'original');
  assert.deepEqual(await readdir(dir), ['作品.jcard']);
});
test('draft operations remain ordered and deletion does not leave an older draft', async t => {
  const { store } = await setup(t);
  await Promise.all([store.writeDraft(content('old')), store.writeDraft(content('new'))]);
  assert.equal(parseProject(await store.readDraft()).data.title, 'new');
  await Promise.all([store.writeDraft(content('pending')), store.clearDraft()]);
  assert.equal(await store.readDraft(), null);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const {createSecureStore}=createRequire(import.meta.url)('../electron/secureStore.cjs');
const encryption={isEncryptionAvailable:()=>true,encryptString:s=>Buffer.from(s).map(b=>b^173),decryptString:b=>Buffer.from(b).map(b=>b^173).toString()};
const key='jcard_ai_settings_v1';
async function fixture(t){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'jcard-secure-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));return path.join(dir,'secure.json');}
test('secure store persists opaque bytes and serializes concurrent legacy/new writes',async t=>{
 const file=await fixture(t),store=createSecureStore(file,encryption);
 await Promise.all([store.setItem(key,'private-secret'),store.setItem('dashscope_api_key','legacy-secret')]);
 assert.equal((await fs.readFile(file,'utf8')).includes('private-secret'),false);
 assert.equal(await createSecureStore(file,encryption).getItem(key),'private-secret');
 assert.equal(await store.getItem('dashscope_api_key'),'legacy-secret');
 await store.removeItem('dashscope_api_key');assert.equal(await store.getItem(key),'private-secret');
});
test('unavailable encryption and failed atomic write preserve last good data',async t=>{
 const file=await fixture(t);await createSecureStore(file,encryption).setItem(key,'old');
 const before=await fs.readFile(file,'utf8');
 const unavailable=createSecureStore(file,{...encryption,isEncryptionAvailable:()=>false});
 assert.equal(await unavailable.setItem(key,'new'),false);await assert.rejects(unavailable.getItem(key),/不可用/);
 const failing=createSecureStore(file,encryption,{...fs,rename:async()=>{throw new Error('disk failure');}});
 await assert.rejects(failing.setItem(key,'new'),/disk failure/);
 assert.equal(await fs.readFile(file,'utf8'),before);
});
test('corrupt store and unknown keys cannot overwrite existing data',async t=>{
 const file=await fixture(t);await fs.writeFile(file,'{broken');const store=createSecureStore(file,encryption);
 await assert.rejects(store.setItem(key,'new'),/未覆盖/);await assert.rejects(store.getItem('arbitrary'),/不支持/);
 assert.equal(await fs.readFile(file,'utf8'),'{broken');
});

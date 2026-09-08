import test from 'node:test';
import assert from 'node:assert/strict';
import { AI_CONFIG_VERSION, AI_SETTINGS_KEY, normalizeAISettings, resolveProvider } from '../src/ai/providerConfig.mjs';
import { createSettingsStorage } from '../src/ai/settingsStorage.mjs';
import { serializeProject } from '../src/project/projectFormat.mjs';
const memory = entries => {
  const values = new Map(Object.entries(entries || {}));
  return { values, getItem: key => values.get(key) || null, setItem: (key,value) => values.set(key,value), removeItem: key => values.delete(key) };
};
const secure = (values = memory()) => ({ ...values, setItem: async (key,value) => { values.setItem(key,value); return true; }, removeItem: async key => { values.removeItem(key); return true; } });
const settings = () => {
 const config = normalizeAISettings();
 config.textProvider = 'volcengine'; config.imageProvider = 'aliyun';
 config.providers.aliyun.apiKey='ali-test-secret';
 config.providers.volcengine={...config.providers.volcengine,apiKey:'volc-test-secret',textModel:'ep-text',imageModel:'ep-image'};
 config.providers.deepseek.apiKey='deepseek-test-secret';
 return config;
};
test('independent credentials, models and selections survive save and restart',async()=>{
 const localStore=memory(),secureStore=secure();
 const store=createSettingsStorage({localStore,secureStore});
 await store.save(settings());
 assert.deepEqual((await store.load()).settings,settings());
 assert.equal(localStore.getItem(AI_SETTINGS_KEY),null);
 const changed=settings();changed.providers.deepseek.apiKey='';await store.save(changed);
 const loaded=(await store.load()).settings;
 assert.equal(loaded.providers.aliyun.apiKey,'ali-test-secret');assert.equal(loaded.providers.deepseek.apiKey,'');
});
test('legacy Ali migration commits before deleting aliases',async()=>{
 const localStore=memory({dashscope_api_key:'ali-legacy'}),secureStore=secure();
 const loaded=await createSettingsStorage({localStore,secureStore}).load();
 assert.equal(loaded.settings.providers.aliyun.apiKey,'ali-legacy');
 assert.equal(loaded.settings.textProvider,'aliyun');assert.equal(localStore.getItem('dashscope_api_key'),null);
 assert.ok(secureStore.getItem(AI_SETTINGS_KEY));
});
test('encryption unavailable never removes legacy key or claims a saved replacement',async()=>{
 const localStore=memory({dashscope_api_key:'ali-legacy'}),secureStore=secure();secureStore.setItem=async()=>false;
 await assert.rejects(createSettingsStorage({localStore,secureStore}).load(),/未保存/);
 assert.equal(localStore.getItem('dashscope_api_key'),'ali-legacy');
});
test('storage write failure retains last good config; corrupt config cannot silently default',async()=>{
 const localStore=memory(),secureStore=secure(),store=createSettingsStorage({localStore,secureStore});
 await store.save(settings());const previous=secureStore.getItem(AI_SETTINGS_KEY);
 secureStore.setItem=async()=>{throw new Error('disk full');};
 await assert.rejects(store.save(normalizeAISettings()),/disk full/);
 assert.equal(secureStore.getItem(AI_SETTINGS_KEY),previous);
 const broken=secure(memory({[AI_SETTINGS_KEY]:'{'}));
 await assert.rejects(createSettingsStorage({localStore,secureStore:broken}).load());
});
test('browser storage reports failure and does not pretend to be encrypted',async()=>{
 const localStore=memory(),store=createSettingsStorage({localStore});await store.save(settings());
 assert.deepEqual((await store.load()).settings,settings());
 localStore.setItem=()=>{throw new Error('quota');};await assert.rejects(store.save(settings()),/quota/);
});
test('ordinary channel rejects known subscription keys and missing model, preserves Ali defaults',()=>{
 const config=settings();
 assert.equal(resolveProvider(config,'text').apiKey,'volc-test-secret');
 assert.equal(resolveProvider(config,'image').id,'aliyun');
 config.textProvider='aliyun';assert.equal(resolveProvider(config,'text','qwen-plus').model,'qwen-plus');
 config.providers.aliyun.apiKey='sk-sp-plan';assert.throws(()=>resolveProvider(config,'text'),/订阅/);
 config.imageProvider='deepseek';assert.throws(()=>resolveProvider(config,'image'),/图片/);config.imageProvider='aliyun';
 config.textProvider='volcengine';config.providers.volcengine.textModel='';assert.throws(()=>resolveProvider(config,'text'),/模型 ID/);
});
test('all provider secrets are excluded from project and draft serialization',()=>{
 const content=serializeProject({data:{sideA:[],sideB:[]},aiSettings:settings(),providers:settings().providers});
 assert.equal(content.includes('test-secret'),false);
});

const oldMiniMax = () => ({ version: 1, textProvider: 'minimax', imageProvider: 'minimax', providers: {
  aliyun: { apiKey: 'keep-ali', textModel: 'qwen-plus', imageModel: 'wan2.5-t2i-preview' },
  volcengine: { apiKey: 'keep-ark', textModel: 'ep-text', imageModel: 'ep-image' },
  minimax: { apiKey: 'remove-minimax-secret', textModel: 'MiniMax-M2.7', imageModel: 'image-01' }
} });

for (const desktop of [false, true]) test(`MiniMax migration is atomic and never redirects billing (${desktop ? 'desktop' : 'browser'})`, async () => {
  const original = JSON.stringify(oldMiniMax());
  const localStore = memory(desktop ? {} : { [AI_SETTINGS_KEY]: original });
  const secureStore = desktop ? secure(memory({ [AI_SETTINGS_KEY]: original })) : undefined;
  const store = createSettingsStorage({ localStore, secureStore });
  const result = await store.load();
  assert.equal(result.settings.version, AI_CONFIG_VERSION);
  assert.equal(result.settings.textProvider, '');
  assert.equal(result.settings.imageProvider, '');
  assert.equal(result.settings.providers.deepseek.apiKey, '');
  assert.equal(result.settings.providers.deepseek.textModel, 'deepseek-v4-flash');
  assert.equal(result.settings.providers.aliyun.apiKey, 'keep-ali');
  assert.equal(result.settings.providers.volcengine.imageModel, 'ep-image');
  assert.match(result.warning, /MiniMax 已移除/);
  assert.throws(() => resolveProvider(result.settings, 'text'), /重新选择/);
  assert.throws(() => resolveProvider(result.settings, 'image'), /重新选择/);
  const saved = (secureStore || localStore).getItem(AI_SETTINGS_KEY);
  assert.equal(saved.includes('minimax'), false);
  assert.equal(saved.includes('remove-minimax-secret'), false);
  assert.deepEqual((await store.load()).settings, result.settings);
});

test('failed MiniMax migration preserves the complete old configuration', async () => {
  const original = JSON.stringify(oldMiniMax());
  const localStore = memory({ [AI_SETTINGS_KEY]: original });
  const secureStore = secure(); secureStore.setItem = async () => false;
  await assert.rejects(createSettingsStorage({ localStore, secureStore }).load(), /未保存/);
  assert.equal(localStore.getItem(AI_SETTINGS_KEY), original);
  assert.equal(secureStore.getItem(AI_SETTINGS_KEY), null);
});

test('version 1 migration preserves existing non-MiniMax selections and workspace ID roundtrips', async () => {
  const old = oldMiniMax(); old.textProvider = 'volcengine'; old.imageProvider = 'aliyun';
  const localStore = memory({ [AI_SETTINGS_KEY]: JSON.stringify(old) });
  const store = createSettingsStorage({ localStore });
  const { settings: config } = await store.load();
  assert.equal(config.textProvider, 'volcengine'); assert.equal(config.imageProvider, 'aliyun');
  config.providers.aliyun.workspaceId = 'workspace-123';
  await store.save(config);
  assert.equal((await store.load()).settings.providers.aliyun.workspaceId, 'workspace-123');
  config.providers.aliyun.workspaceId = 'attacker.test/path';
  await assert.rejects(store.save(config), /业务空间 ID/);
});

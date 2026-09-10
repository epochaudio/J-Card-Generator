import test from 'node:test';
import assert from 'node:assert/strict';
import { AI_CONFIG_VERSION, AI_SETTINGS_KEY, normalizeAISettings, resolveProvider } from '../src/ai/providerConfig.mjs';
import { createSettingsStorage } from '../src/ai/settingsStorage.mjs';
import { serializeProject } from '../src/project/projectFormat.mjs';
import { DEEPSEEK_CURRENT_MODEL } from '../src/ai/modelCatalog.mjs';

const memory = entries => {
  const values = new Map(Object.entries(entries || {}));
  return { values, getItem: key => values.get(key) || null, setItem: (key,value) => values.set(key,value), removeItem: key => values.delete(key) };
};
const secure = (values = memory()) => ({ ...values, setItem: async (key,value) => { values.setItem(key,value); return true; }, removeItem: async key => { values.removeItem(key); return true; } });
const settings = () => normalizeAISettings({ imageProvider: 'aliyun', providers: {
  deepseek: { apiKey: 'deepseek-test-secret' },
  aliyun: { apiKey: 'ali-test-secret' },
  volcengine: { apiKey: 'volc-test-secret' }
} });

test('simple AI settings survive encrypted save and restart', async () => {
  const localStore = memory(), secureStore = secure();
  const store = createSettingsStorage({ localStore, secureStore });
  const expected = settings();
  await store.save(expected);
  assert.deepEqual((await store.load()).settings, expected);
  assert.equal(localStore.getItem(AI_SETTINGS_KEY), null);
  expected.providers.deepseek.apiKey = '';
  await store.save(expected);
  const loaded = (await store.load()).settings;
  assert.equal(loaded.providers.aliyun.apiKey, 'ali-test-secret');
  assert.equal(loaded.providers.deepseek.apiKey, '');
});

test('legacy Ali key is retained without enabling optional image generation', async () => {
  const localStore = memory({ dashscope_api_key: 'ali-legacy' }), secureStore = secure();
  const loaded = await createSettingsStorage({ localStore, secureStore }).load();
  assert.equal(loaded.settings.providers.aliyun.apiKey, 'ali-legacy');
  assert.equal(loaded.settings.imageProvider, '');
  assert.equal(localStore.getItem('dashscope_api_key'), null);
  assert.ok(secureStore.getItem(AI_SETTINGS_KEY));
});

test('encryption unavailable never removes a legacy key or claims a saved replacement', async () => {
  const localStore = memory({ dashscope_api_key: 'ali-legacy' }), secureStore = secure(); secureStore.setItem = async () => false;
  await assert.rejects(createSettingsStorage({ localStore, secureStore }).load(), /未保存/);
  assert.equal(localStore.getItem('dashscope_api_key'), 'ali-legacy');
});

test('storage failures retain the last good configuration', async () => {
  const localStore = memory(), secureStore = secure(), store = createSettingsStorage({ localStore, secureStore });
  await store.save(settings()); const previous = secureStore.getItem(AI_SETTINGS_KEY);
  secureStore.setItem = async () => { throw new Error('disk full'); };
  await assert.rejects(store.save(normalizeAISettings()), /disk full/);
  assert.equal(secureStore.getItem(AI_SETTINGS_KEY), previous);
  const broken = secure(memory({ [AI_SETTINGS_KEY]: '{' }));
  await assert.rejects(createSettingsStorage({ localStore, secureStore: broken }).load());
});

test('browser storage reports failure and does not pretend to be encrypted', async () => {
  const localStore = memory(), store = createSettingsStorage({ localStore }), expected = settings();
  await store.save(expected);
  assert.deepEqual((await store.load()).settings, expected);
  localStore.setItem = () => { throw new Error('quota'); };
  await assert.rejects(store.save(expected), /quota/);
});

test('DeepSeek is the only understanding service and image generation remains optional', () => {
  const config = settings();
  assert.deepEqual(resolveProvider(config, 'text'), { id: 'deepseek', apiKey: 'deepseek-test-secret', model: DEEPSEEK_CURRENT_MODEL });
  assert.deepEqual(resolveProvider(config, 'vision'), resolveProvider(config, 'text'));
  assert.equal(resolveProvider(config, 'image').id, 'aliyun');
  const withoutImage = normalizeAISettings({ providers: { deepseek: { apiKey: 'key' } } });
  assert.throws(() => resolveProvider(withoutImage, 'image'), /开启并配置生图服务/);
  config.providers.aliyun.apiKey = 'sk-sp-plan';
  assert.throws(() => resolveProvider(config, 'image'), /订阅/);
});

test('configuration shape fixes one DeepSeek model and discards obsolete model choices', () => {
  const config = normalizeAISettings({ version: 4, textProvider: 'volcengine', visionProvider: 'aliyun', providers: {
    deepseek: { apiKey: 'keep-key', textModel: 'old-text', visionModel: 'old-vision' },
    aliyun: { apiKey: 'ali', textModel: 'qwen-custom', visionModel: 'qwen-vl-custom', imageModel: 'wan-custom' }
  } });
  assert.equal(config.version, AI_CONFIG_VERSION);
  assert.equal(Object.hasOwn(config, 'textProvider'), false);
  assert.equal(Object.hasOwn(config, 'visionProvider'), false);
  assert.deepEqual(config.providers.deepseek, { apiKey: 'keep-key', model: DEEPSEEK_CURRENT_MODEL });
  assert.deepEqual(config.providers.aliyun, { apiKey: 'ali', imageModel: 'wan2.5-t2i-preview' });
});

test('all provider secrets are excluded from project and draft serialization', () => {
  const content = serializeProject({ data: { sideA: [], sideB: [] }, aiSettings: settings(), providers: settings().providers });
  assert.equal(content.includes('test-secret'), false);
});

const oldMiniMax = () => ({ version: 1, textProvider: 'minimax', imageProvider: 'minimax', providers: {
  aliyun: { apiKey: 'keep-ali', textModel: 'qwen-plus', imageModel: 'wan-old' },
  volcengine: { apiKey: 'keep-ark', textModel: 'ep-text', imageModel: 'ep-image' },
  minimax: { apiKey: 'remove-minimax-secret', textModel: 'MiniMax-M2.7', imageModel: 'image-01' }
} });

for (const desktop of [false, true]) test(`old provider settings collapse atomically to the simple shape (${desktop ? 'desktop' : 'browser'})`, async () => {
  const original = JSON.stringify(oldMiniMax());
  const localStore = memory(desktop ? {} : { [AI_SETTINGS_KEY]: original });
  const secureStore = desktop ? secure(memory({ [AI_SETTINGS_KEY]: original })) : undefined;
  const store = createSettingsStorage({ localStore, secureStore });
  const result = await store.load();
  assert.equal(result.settings.version, AI_CONFIG_VERSION);
  assert.equal(Object.hasOwn(result.settings, 'textProvider'), false);
  assert.equal(Object.hasOwn(result.settings, 'visionProvider'), false);
  assert.equal(result.settings.imageProvider, '');
  assert.equal(result.settings.providers.deepseek.model, DEEPSEEK_CURRENT_MODEL);
  assert.equal(result.settings.providers.aliyun.apiKey, 'keep-ali');
  assert.equal(result.settings.providers.volcengine.apiKey, 'keep-ark');
  assert.match(result.warning, /MiniMax/);
  const saved = (secureStore || localStore).getItem(AI_SETTINGS_KEY);
  assert.equal(saved.includes('minimax'), false);
  assert.equal(saved.includes('remove-minimax-secret'), false);
});

test('failed shape replacement preserves the complete old configuration', async () => {
  const original = JSON.stringify(oldMiniMax());
  const localStore = memory({ [AI_SETTINGS_KEY]: original });
  const secureStore = secure(); secureStore.setItem = async () => false;
  await assert.rejects(createSettingsStorage({ localStore, secureStore }).load(), /未保存/);
  assert.equal(localStore.getItem(AI_SETTINGS_KEY), original);
});

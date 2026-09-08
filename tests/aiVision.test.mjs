import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeImages, VISION_MAX_IMAGES } from '../src/ai/providerAPI.mjs';
import { AI_CONFIG_VERSION, AI_SETTINGS_KEY, normalizeAISettings, resolveProvider, PROVIDERS } from '../src/ai/providerConfig.mjs';
import { createSettingsStorage } from '../src/ai/settingsStorage.mjs';
import { supportsVision, buildModelCatalog, DEEPSEEK_VISION_BETA } from '../src/ai/modelCatalog.mjs';
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=';
const request = (id = 'aliyun') => ({ id, apiKey: `test-${id}`, model: id === 'deepseek' ? DEEPSEEK_VISION_BETA : id === 'aliyun' ? 'qwen3-vl-flash' : 'doubao-seed-1-6-250615', prompt: 'Design JSON', images: [png] });
const response = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });

for (const id of ['aliyun','volcengine','deepseek']) test(`${id} vision sends images in one request to the fixed endpoint with independent model`, async () => {
  let count = 0;
  const result = await analyzeImages({ ...request(id), meta: { textUrl: 'https://example.invalid' } }, { fetchImpl: async (url, options) => {
    count++; assert.equal(url, PROVIDERS[id].textUrl); assert.equal(options.redirect, 'error'); assert.equal(options.headers.Authorization, `Bearer test-${id}`);
    const body = JSON.parse(options.body); assert.equal(body.model, request(id).model); assert.equal(body.stream, false);
    assert.deepEqual(body.messages[0].content[1], { type: 'image_url', image_url: { url: png } });
    if (id === 'aliyun') assert.equal(body.enable_thinking, false); else assert.deepEqual(body.thinking, { type: 'disabled' });
    return response({ choices: [{ message: { content: '{"candidates":[]}' } }] });
  } });
  assert.equal(count, 1); assert.deepEqual(result, { candidates: [] });
});
test('unsupported models, remote/malformed images and excess images fail before any request', async () => {
  let count = 0; const fetchImpl = async () => { count++; };
  for (const patch of [{ id: 'deepseek' }, { model: 'qwen-plus' }, { model: 'ep-unknown' }, { images: ['https://example.com/private'] }, { images: ['data:image/jpeg;base64,' + png.split(',')[1]] }, { images: Array(VISION_MAX_IMAGES + 1).fill(png) }]) await assert.rejects(analyzeImages({ ...request(), ...patch }, { fetchImpl }));
  assert.equal(count, 0);
});
test('cancellation, timeout, truncated and malformed responses never retry or echo provider content', async () => {
  const controller = new AbortController(); controller.abort(); let count = 0;
  await assert.rejects(analyzeImages(request(), { signal: controller.signal, fetchImpl: async () => { count++; } }), /取消/); assert.equal(count, 0);
  await assert.rejects(analyzeImages(request(), { timeoutMs: 5, fetchImpl: async (_, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('abort')))) }), /超时/);
  await assert.rejects(analyzeImages(request(), { fetchImpl: async () => response({ choices: [{ finish_reason: 'length', message: { content: '{"candidates":[]}' } }] }) }), /截断/);
  await assert.rejects(analyzeImages(request(), { fetchImpl: async () => new Response('secret-key-from-upstream', { status: 403 }) }), error => !error.message.includes('secret-key'));
});
test('v2 settings migrate to v3 without selecting or billing vision and preserve original choices', async () => {
  const original = { ...normalizeAISettings(), version: 2 }; delete original.visionProvider;
  for (const entry of Object.values(original.providers)) delete entry.visionModel;
  original.providers.aliyun.apiKey = 'keep-key';
  const memory = new Map([[AI_SETTINGS_KEY, JSON.stringify(original)]]);
  const localStore = { getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) };
  const result = await createSettingsStorage({ localStore }).load();
  assert.equal(result.settings.version, AI_CONFIG_VERSION); assert.equal(result.settings.visionProvider, '');
  assert.equal(result.settings.providers.aliyun.apiKey, 'keep-key'); assert.equal(result.settings.providers.aliyun.visionModel, '');
  assert.throws(() => resolveProvider(result.settings, 'vision'), /视觉分析/);
  result.settings.visionProvider = 'aliyun'; result.settings.providers.aliyun.visionModel = 'qwen3-vl-plus';
  await createSettingsStorage({ localStore }).save(result.settings);
  assert.equal((await createSettingsStorage({ localStore }).load()).settings.providers.aliyun.visionModel, 'qwen3-vl-plus');
});
test('failed v2 migration preserves original settings', async () => {
  const original = JSON.stringify({ version: 2, providers: { aliyun: { apiKey: 'keep-key' } } });
  let saved = original;
  await assert.rejects(createSettingsStorage({ localStore: { getItem: () => saved, setItem: () => { throw new Error('disk unavailable'); } } }).load());
  assert.equal(saved, original);
});
test('vision catalog uses known protocols and never treats unknown endpoints as vision', () => {
  assert.equal(supportsVision('volcengine', 'ep-private'), false); assert.equal(supportsVision('deepseek', 'qwen3-vl-plus'), false);
  const catalog = buildModelCatalog('aliyun', [{ model: 'qwen3-vl-plus' }, { model: 'qwen-plus', capabilities: ['TG'] }]);
  assert.deepEqual(catalog.models.find(model => model.id === 'qwen3-vl-plus').kinds, ['text','vision']);
});

test('DeepSeek beta is explicitly vision-capable without enabling ordinary Flash or changing defaults', () => {
  assert.equal(supportsVision('deepseek', DEEPSEEK_VISION_BETA), true);
  assert.equal(supportsVision('deepseek', 'deepseek-v4-flash'), false);
  assert.equal(supportsVision('deepseek', 'deepseek-v4.1-future'), false);
  const settings = normalizeAISettings({ version: 3, visionProvider: 'deepseek', providers: { deepseek: { apiKey: 'test-key', visionModel: DEEPSEEK_VISION_BETA } } });
  assert.equal(resolveProvider(settings, 'vision').model, DEEPSEEK_VISION_BETA);
  assert.equal(settings.providers.deepseek.textModel, 'deepseek-v4-flash');
  assert.equal(normalizeAISettings().visionProvider, '');
  const catalog = buildModelCatalog('deepseek', [{id: DEEPSEEK_VISION_BETA}, {id:'deepseek-v4-flash'}]);
  assert.deepEqual(catalog.models.find(model => model.id === DEEPSEEK_VISION_BETA).kinds, ['text', 'vision']);
});

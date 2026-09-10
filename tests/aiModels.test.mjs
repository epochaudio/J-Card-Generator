import test from 'node:test';
import assert from 'node:assert/strict';
import { generateImage, generateText } from '../src/ai/providerAPI.mjs';
import { PROVIDERS, providersFor, normalizeAISettings } from '../src/ai/providerConfig.mjs';
import { DEEPSEEK_CURRENT_MODEL, supportsVision } from '../src/ai/modelCatalog.mjs';

const request = (id, model) => ({ id, apiKey: `test-${id}-key`, model, prompt: 'test' });

test('provider catalog presents one understanding service and two optional image services', () => {
  assert.deepEqual(Object.keys(PROVIDERS), ['deepseek', 'aliyun', 'volcengine']);
  assert.deepEqual(providersFor('text'), ['deepseek']);
  assert.deepEqual(providersFor('vision'), ['deepseek']);
  assert.deepEqual(providersFor('image'), ['aliyun', 'volcengine']);
  assert.equal(supportsVision('deepseek', DEEPSEEK_CURRENT_MODEL), true);
});

test('new settings require no image provider and expose no model choices', () => {
  const settings = normalizeAISettings();
  assert.equal(settings.imageProvider, '');
  assert.deepEqual(settings.providers.deepseek, { apiKey: '', model: DEEPSEEK_CURRENT_MODEL });
  assert.deepEqual(settings.providers.aliyun, { apiKey: '', imageModel: PROVIDERS.aliyun.imageModel });
  assert.deepEqual(settings.providers.volcengine, { apiKey: '', imageModel: PROVIDERS.volcengine.imageModel });
});

test('fixed model boundaries reject alternate understanding and image models before network', async () => {
  let calls = 0; const fetchImpl = async () => { calls++; };
  await assert.rejects(generateText(request('deepseek', 'deepseek-custom'), { fetchImpl }), /固定使用/);
  await assert.rejects(generateText(request('aliyun', PROVIDERS.aliyun.imageModel), { fetchImpl }), /统一使用 DeepSeek/);
  await assert.rejects(generateImage(request('aliyun', 'wan-custom'), { fetchImpl }), /默认生图模型/);
  await assert.rejects(generateImage(request('deepseek', DEEPSEEK_CURRENT_MODEL), { fetchImpl }), /未接入/);
  assert.equal(calls, 0);
});

test('invalid providers, missing keys and subscription keys fail before network', async () => {
  let calls = 0; const fetchImpl = async () => { calls++; };
  for (const input of [request('minimax', 'old'), { ...request('deepseek', DEEPSEEK_CURRENT_MODEL), apiKey: '' }, { ...request('deepseek', DEEPSEEK_CURRENT_MODEL), apiKey: 'bad\nkey' }, request('aliyun', PROVIDERS.aliyun.imageModel)]) {
    if (input.id === 'aliyun') input.apiKey = 'sk-sp-plan';
    await assert.rejects(input.id === 'aliyun' ? generateImage(input, { fetchImpl }) : generateText(input, { fetchImpl }));
  }
  assert.equal(calls, 0);
});

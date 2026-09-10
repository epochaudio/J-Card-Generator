import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeImages, VISION_MAX_IMAGES } from '../src/ai/providerAPI.mjs';
import { normalizeAISettings, resolveProvider, PROVIDERS } from '../src/ai/providerConfig.mjs';
import { supportsVision, DEEPSEEK_CURRENT_MODEL } from '../src/ai/modelCatalog.mjs';

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=';
const request = () => ({ id: 'deepseek', apiKey: 'test-deepseek', model: DEEPSEEK_CURRENT_MODEL, prompt: 'Design JSON', images: [png] });
const response = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });

test('DeepSeek V4.1 Flash sends text and images in one fixed-endpoint request', async () => {
  let count = 0;
  const result = await analyzeImages({ ...request(), meta: { textUrl: 'https://example.invalid' } }, { fetchImpl: async (url, options) => {
    count++; assert.equal(url, PROVIDERS.deepseek.textUrl); assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, 'Bearer test-deepseek');
    const body = JSON.parse(options.body); assert.equal(body.model, DEEPSEEK_CURRENT_MODEL); assert.equal(body.stream, false);
    assert.deepEqual(body.messages[0].content[1], { type: 'image_url', image_url: { url: png } });
    assert.deepEqual(body.thinking, { type: 'disabled' });
    return response({ choices: [{ message: { content: '{"candidates":[]}' } }] });
  } });
  assert.equal(count, 1); assert.deepEqual(result, { candidates: [] });
});

test('other providers cannot be used for image understanding', async () => {
  let count = 0; const fetchImpl = async () => { count++; };
  for (const id of ['aliyun', 'volcengine']) await assert.rejects(analyzeImages({ ...request(), id, apiKey: `test-${id}` }, { fetchImpl }), /统一使用 DeepSeek/);
  assert.equal(count, 0);
});

test('unsupported models, remote or malformed images and excess images fail before any request', async () => {
  let count = 0; const fetchImpl = async () => { count++; };
  for (const patch of [{ model: 'qwen-plus' }, { images: ['https://example.com/private'] }, { images: ['data:image/jpeg;base64,' + png.split(',')[1]] }, { images: Array(VISION_MAX_IMAGES + 1).fill(png) }]) {
    await assert.rejects(analyzeImages({ ...request(), ...patch }, { fetchImpl }));
  }
  assert.equal(count, 0);
});

test('cancellation, timeout, truncated and malformed responses never retry or echo provider content', async () => {
  const controller = new AbortController(); controller.abort(); let count = 0;
  await assert.rejects(analyzeImages(request(), { signal: controller.signal, fetchImpl: async () => { count++; } }), /取消/); assert.equal(count, 0);
  await assert.rejects(analyzeImages(request(), { timeoutMs: 5, fetchImpl: async (_, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('abort')))) }), /超时/);
  await assert.rejects(analyzeImages(request(), { fetchImpl: async () => response({ choices: [{ finish_reason: 'length', message: { content: '{"candidates":[]}' } }] }) }), /截断/);
  await assert.rejects(analyzeImages(request(), { fetchImpl: async () => new Response('secret-key-from-upstream', { status: 403 }) }), error => !error.message.includes('secret-key'));
});

test('DeepSeek is the fixed default for both text and vision while image generation stays off', () => {
  const settings = normalizeAISettings({ providers: { deepseek: { apiKey: 'test-key' } } });
  assert.equal(Object.hasOwn(settings, 'textProvider'), false);
  assert.equal(Object.hasOwn(settings, 'visionProvider'), false);
  assert.equal(settings.imageProvider, '');
  assert.deepEqual(resolveProvider(settings, 'vision'), resolveProvider(settings, 'text'));
  assert.equal(resolveProvider(settings, 'vision').model, DEEPSEEK_CURRENT_MODEL);
  assert.deepEqual(settings.providers.deepseek, { apiKey: 'test-key', model: DEEPSEEK_CURRENT_MODEL });
  assert.equal(supportsVision('deepseek', DEEPSEEK_CURRENT_MODEL), true);
});

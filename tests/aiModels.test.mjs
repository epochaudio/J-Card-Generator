import test from 'node:test';
import assert from 'node:assert/strict';
import { listModels, generateImage, generateText, MODELS_PAGE_SIZE } from '../src/ai/providerAPI.mjs';
import { PROVIDERS, providersFor, normalizeAISettings } from '../src/ai/providerConfig.mjs';
import { buildModelCatalog } from '../src/ai/modelCatalog.mjs';

const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
const request = id => ({ id, apiKey: `test-${id}-key`, workspaceId: 'workspace-test' });

test('DeepSeek catalog is fetched from the fixed endpoint, deduplicated, with no generation', async () => {
  let calls = 0;
  const result = await listModels({ ...request('deepseek'), modelsUrl: 'https://attacker.test', meta: { modelsUrl: 'https://attacker.test' } }, { fetchImpl: async (url, options) => {
    calls++;
    assert.equal(url, PROVIDERS.deepseek.modelsUrl);
    assert.equal(options.method, 'GET'); assert.equal(options.body, undefined);
    assert.equal(options.headers.Authorization, 'Bearer test-deepseek-key');
    assert.equal(options.redirect, 'error'); assert.equal(options.credentials, 'omit');
    return json({ data: [{ id: 'deepseek-v4-pro' }, { id: 'deepseek-v4-flash' }, { id: 'deepseek-v4-flash' }, { id: '<bad>' }] });
  } });
  assert.equal(calls, 1);
  assert.deepEqual(result.models.map(m => m.id), ['deepseek-v4-flash', 'deepseek-v4-pro']);
  assert.equal(result.skipped, 1); assert.equal(result.source, 'api');
});

test('Ali catalog reads all pages and separates only compatible text and async image models', async () => {
  const pages = [];
  const result = await listModels(request('aliyun'), { fetchImpl: async (url, options) => {
    const parsed = new URL(url); const page = Number(parsed.searchParams.get('page_no')); pages.push(page);
    assert.equal(parsed.hostname, 'workspace-test.cn-beijing.maas.aliyuncs.com');
    assert.equal(parsed.searchParams.get('page_size'), String(MODELS_PAGE_SIZE));
    assert.equal(parsed.searchParams.get('service_site'), 'asia-pacific-china');
    assert.equal(options.headers.Authorization, 'Bearer test-aliyun-key');
    return json({ output: { total: 5, page_no: page, models: page === 1 ? [
      { model: 'qwen3-max', capabilities: ['TG', 'Reasoning'] },
      { model: 'wan2.5-t2i-preview', capabilities: ['IG'] }
    ] : [
      { model: 'wan2.6-t2i', capabilities: ['IG'] },
      { model: 'qwen-image', capabilities: ['IG'] },
      { model: 'text-embedding-v4', capabilities: ['TR'] }
    ] } });
  } });
  assert.deepEqual(pages, [1, 2]);
  assert.deepEqual(result.models, [{ id: 'qwen3-max', kinds: ['text'] }, { id: 'wan2.5-t2i-preview', kinds: ['image'] }]);
  assert.equal(result.skipped, 3);
});

test('Ark fetch uses its own API key; unknown endpoints and non-chat models are not guessed', async () => {
  const result = await listModels(request('volcengine'), { fetchImpl: async (url, options) => {
    assert.equal(url, PROVIDERS.volcengine.modelsUrl);
    assert.equal(options.headers.Authorization, 'Bearer test-volcengine-key');
    return json({ data: [
      { id: 'doubao-seed-1-6-250615' }, { id: 'doubao-seedream-4-0-250828' },
      { id: 'doubao-embedding-large' }, { id: 'doubao-seedance-1-0-pro' },
      { id: 'ep-unclassified' }, { id: 'future-unknown' }, { id: 'doubao-seedream-3-0-t2i-250415' }
    ] });
  } });
  assert.equal(result.models.length, 2); assert.equal(result.skipped, 5);
  assert.deepEqual(result.models.find(m => m.id.includes('seedream')).kinds, ['image']);
});

test('model catalog rejects malformed data and never invents presets on an empty list', () => {
  assert.deepEqual(buildModelCatalog('deepseek', []), { models: [], skipped: 0, source: 'api' });
  assert.throws(() => buildModelCatalog('deepseek', {}), /模型列表/);
  assert.equal(buildModelCatalog('aliyun', [{ model: 'qwen3-max', capabilities: 1 }]).models.length, 0);
});

test('unsupported image providers, removed MiniMax and invalid keys fail before network', async () => {
  let calls = 0; const fetchImpl = async () => { calls++; return json({}); };
  assert.deepEqual(providersFor('image'), ['aliyun', 'volcengine']);
  assert.throws(() => normalizeAISettings({ imageProvider: 'deepseek' }), /图片/);
  await assert.rejects(generateImage({ ...request('deepseek'), model: 'deepseek-v4-flash', prompt: 'cover' }, { fetchImpl }), /未接入/);
  await assert.rejects(generateText({ ...request('minimax'), model: 'old', prompt: 'text' }, { fetchImpl }), /无效/);
  for (const input of [request('minimax'), { ...request('deepseek'), apiKey: '' }, { ...request('deepseek'), apiKey: 'bad\nkey' }, { ...request('aliyun'), apiKey: 'sk-sp-plan' }]) {
    await assert.rejects(listModels(input, { fetchImpl }));
  }
  assert.equal(calls, 0);
});

test('workspace cannot redirect API credentials to an arbitrary host', async () => {
  let calls = 0;
  for (const workspaceId of ['', undefined, 'x.evil.test', 'user@host', 'a/path', 'a?x', '-bad', 'x'.repeat(64)]) {
    await assert.rejects(listModels({ ...request('aliyun'), workspaceId }, { fetchImpl: async () => { calls++; } }), /业务空间/);
  }
  assert.equal(calls, 0);
});

test('auth, unsupported endpoint, corrupt data and timeout errors are sanitized, without fallback', async () => {
  for (const status of [401, 403, 404, 429, 500]) {
    let calls = 0;
    await assert.rejects(listModels(request('volcengine'), { fetchImpl: async () => {
      calls++; return json({ message: 'test-volcengine-key' }, status);
    } }), error => error.message.includes(String(status)) && !error.message.includes('test-volcengine-key'));
    assert.equal(calls, 1);
  }
  await assert.rejects(listModels(request('deepseek'), { fetchImpl: async () => json({ data: {} }) }), /模型列表/);
  await assert.rejects(listModels(request('deepseek'), { fetchImpl: async () => new Response('secret') }), /无法读取/);
  await assert.rejects(listModels(request('deepseek'), { timeoutMs: 1, fetchImpl: async (url, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('secret')))) }), /超时/);
});

test('incomplete pagination never produces a successful catalog', async () => {
  await assert.rejects(listModels(request('aliyun'), { fetchImpl: async () => json({ output: { total: 3, models: [] } }) }), /不完整/);
  await assert.rejects(listModels(request('aliyun'), { fetchImpl: async () => json({ output: { total: 3, page_no: 2, models: [] } }) }), /分页/);
  await assert.rejects(listModels(request('deepseek'), { fetchImpl: async () => json({ data: [], has_more: true }) }), /分页/);
});

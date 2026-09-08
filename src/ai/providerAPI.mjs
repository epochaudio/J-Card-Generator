import { PROVIDERS } from './providerConfig.mjs';

export const TEXT_TIMEOUT_MS = 120000;
export const IMAGE_TIMEOUT_MS = 180000;
export const IMAGE_POLL_INTERVAL_MS = 2000;
export const MAX_RESPONSE_BYTES = 48 * 1024 * 1024;
const TEXT_MAX_TOKENS = 12000;
const BASE64_ENCODING_CHUNK_BYTES = 8192;

function checkedRequest(input) {
  if (!input || !Object.hasOwn(PROVIDERS, input.id)) throw new Error('无效的 AI 服务商。');
  for (const field of ['apiKey', 'model', 'prompt']) {
    if (typeof input[field] !== 'string' || !input[field].trim()) throw new Error('请先配置密钥、模型并填写生成内容。');
  }
  if (input.systemPrompt != null && typeof input.systemPrompt !== 'string') throw new Error('提示词格式无效。');
  return { ...input, meta: PROVIDERS[input.id] };
}

// Never show provider response bodies: an upstream error can echo credentials or user content.
function providerError(name, status) {
  const label = status === 401 ? '密钥无效或已失效'
    : status === 403 ? '无权使用该模型，请核对密钥类型、地域及开通权限'
    : status === 402 ? '账户余额或额度不足'
    : status === 429 ? '请求限流或额度不足'
    : status === 404 ? '模型或接口不存在，请核对模型 ID'
    : status >= 500 ? '服务暂时不可用' : '请求失败，请检查模型和参数';
  // Codes from non-HTTP errors are deliberately not interpolated into messages.
  return new Error(`${name}：${label}${status ? `（HTTP ${status}）` : ''}。未切换其他服务商。`);
}

async function readLimited(response) {
  if (Number(response.headers.get('content-length')) > MAX_RESPONSE_BYTES) throw new Error('AI 响应过大，请减小生成规模。');
  if (!response.body?.getReader) {
    const text = await response.text();
    if (new TextEncoder().encode(text).length > MAX_RESPONSE_BYTES) throw new Error('AI 响应过大。');
    return text;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0, text = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) throw new Error('AI 响应过大，请减小生成规模。');
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally { await reader.cancel().catch(() => {}); }
}

async function jsonRequest(fetchImpl, url, apiKey, body, signal, name) {
  let response;
  try {
    response = await fetchImpl(url, {
      method: body == null ? 'GET' : 'POST', redirect: 'error', credentials: 'omit',
      headers: { Authorization: `Bearer ${apiKey}`, ...(body != null ? { 'Content-Type': 'application/json' } : {}) },
      ...(body == null ? {} : { body: JSON.stringify(body) }), signal
    });
  } catch (error) {
    if (signal.aborted) throw new Error(`${name}请求超时，请稍后重试。`);
    throw new Error(`${name}网络连接失败，请检查网络或服务地域。`);
  }
  if (!response.ok) throw providerError(name, response.status);
  let data;
  try { data = JSON.parse(await readLimited(response)); }
  catch (error) {
    if (signal.aborted) throw new Error(`${name}请求超时。`);
    throw new Error(`${name}返回了无法读取的响应。`);
  }
  if (!data || typeof data !== 'object') throw new Error(`${name}返回了无效响应。`);
  if (data.error || data.code || (data.base_resp?.status_code != null && Number(data.base_resp.status_code) !== 0)) {
    throw providerError(name, 0);
  }
  return data;
}

export function parseJSONContent(content) {
  if (typeof content !== 'string') throw new Error('模型没有返回可用的文本。');
  const text = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('模型未返回有效的结构化内容，当前作品未改变。请重试或调整文本模型。'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('模型返回的数据结构无效。');
  return parsed;
}

function imageDataURL(base64) {
  if (typeof base64 !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 !== 0) throw new Error('图片服务未返回有效图片。');
  let signature;
  try { signature = atob(base64.slice(0, 32)); } catch { throw new Error('图片编码无效。'); }
  const mime = signature.startsWith('\x89PNG\r\n\x1a\n') ? 'image/png'
    : signature.startsWith('\xff\xd8\xff') ? 'image/jpeg'
    : signature.startsWith('RIFF') && signature.slice(8, 12) === 'WEBP' ? 'image/webp' : null;
  if (!mime) throw new Error('图片格式不受支持。');
  return `data:${mime};base64,${base64}`;
}

async function downloadAliImage(url, fetchImpl, signal) {
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('阿里云未返回有效图片地址。'); }
  if (parsed.protocol !== 'https:' || parsed.port || parsed.username || parsed.password || !parsed.hostname.endsWith('.aliyuncs.com')) {
    throw new Error('阿里云返回了未支持的图片存储地址。');
  }
  // Signed image URLs are fetched without the API credential and without redirects.
  const response = await fetchImpl(parsed.href, { signal, redirect: 'error', credentials: 'omit' });
  if (!response.ok) throw new Error('封面图片下载失败，请重试。');
  if (Number(response.headers.get('content-length')) > MAX_RESPONSE_BYTES) throw new Error('封面图片过大。');
  const chunks = [];
  let size = 0;
  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > MAX_RESPONSE_BYTES) throw new Error('封面图片过大。');
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  let binary = '';
  for (const chunk of chunks) {
    for (let i = 0; i < chunk.length; i += BASE64_ENCODING_CHUNK_BYTES) binary += String.fromCharCode(...chunk.subarray(i, i + BASE64_ENCODING_CHUNK_BYTES));
  }
  return imageDataURL(btoa(binary));
}

function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new Error('图片生成超时。')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
}

export async function generateText(input, { fetchImpl = globalThis.fetch, timeoutMs = TEXT_TIMEOUT_MS } = {}) {
  const { meta, id, apiKey, model, prompt, systemPrompt = '' } = checkedRequest(input);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const body = { model, messages: [
      { role: 'system', content: `${systemPrompt}\n仅返回符合用户要求的 JSON 对象，不要输出解释或 Markdown。` },
      { role: 'user', content: prompt }
    ], stream: false, max_tokens: TEXT_MAX_TOKENS };
    // JSON mode and thinking controls differ by vendor; do not send Ali-only options to MiniMax.
    if (id === 'aliyun') body.response_format = { type: 'json_object' };
    if (id === 'minimax') body.reasoning_split = true;
    const response = await jsonRequest(fetchImpl, meta.textUrl, apiKey, body, controller.signal, meta.name);
    if (response.choices?.[0]?.finish_reason === 'length') throw new Error('文本输出被截断，当前作品未改变。请减少输入或调整模型。');
    return parseJSONContent(response.choices?.[0]?.message?.content);
  } finally { clearTimeout(timer); }
}

export async function generateImage(input, { fetchImpl = globalThis.fetch, timeoutMs = IMAGE_TIMEOUT_MS, wait = delay } = {}) {
  const { meta, id, apiKey, model, prompt } = checkedRequest(input);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    if (id === 'volcengine') {
      const response = await jsonRequest(fetchImpl, meta.imageUrl, apiKey, { model, prompt, size: '2K', response_format: 'b64_json', watermark: true }, controller.signal, meta.name);
      return imageDataURL(response.data?.[0]?.b64_json);
    }
    if (id === 'minimax') {
      if (prompt.length > 1500) throw new Error('MiniMax 图片提示词最多 1500 个字符，请缩短后重试。');
      const response = await jsonRequest(fetchImpl, meta.imageUrl, apiKey, { model, prompt, aspect_ratio: '1:1', response_format: 'base64', n: 1 }, controller.signal, meta.name);
      return imageDataURL(response.data?.image_base64?.[0]);
    }
    // Wanx needs one async submission header; the common request helper remains unchanged.
    const submitFetch = (url, options) => fetchImpl(url, { ...options, headers: { ...options.headers, 'X-DashScope-Async': 'enable' } });
    const created = await jsonRequest(submitFetch, meta.imageUrl, apiKey, { model, input: { prompt }, parameters: { size: '1024*1024', n: 1 } }, controller.signal, meta.name);
    const taskId = created.output?.task_id;
    if (typeof taskId !== 'string' || !/^[a-zA-Z0-9-]+$/.test(taskId)) throw new Error('阿里云未返回有效的图片任务 ID。');
    while (!controller.signal.aborted) {
      await wait(IMAGE_POLL_INTERVAL_MS, controller.signal);
      const response = await jsonRequest(fetchImpl, `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`, apiKey, null, controller.signal, meta.name);
      const status = response.output?.task_status;
      if (status === 'SUCCEEDED') return await downloadAliImage(response.output?.results?.[0]?.url, fetchImpl, controller.signal);
      if (!['PENDING', 'RUNNING'].includes(status)) throw new Error('阿里云图片任务失败或已取消，请检查模型和提示词。');
    }
    throw new Error('图片生成超时。');
  } catch (error) {
    if (controller.signal.aborted) throw new Error('图片生成超时，请稍后重试。');
    // All application-created errors are sanitized; transport errors must not expose signed URLs.
    if (error instanceof TypeError) throw new Error('图片服务连接或下载失败，请重试。');
    throw error;
  } finally { clearTimeout(timer); }
}

// Compatibility with the request bodies in providerAPI, not a catalog of all
// models offered by a vendor. Unknown models remain available via manual entry.
// Wan 2.6 uses a different protocol and is deliberately not offered here.
export const ALI_ASYNC_IMAGE_MODELS = new Set([
  'wan2.5-t2i-preview', 'wan2.2-t2i-flash', 'wan2.2-t2i-plus',
  'wanx2.1-t2i-turbo', 'wanx2.1-t2i-plus', 'wanx2.0-t2i-turbo'
]);
const MODEL_ID_MAX_LENGTH = 200;
const TEXT_FAMILIES = /^(?:qwen|qwq|deepseek|glm|kimi|moonshot)(?:[\d.-]|$)/i;
const ARK_CHAT_FAMILIES = /^doubao-(?:seed-|pro-|lite-|1\.5-(?:pro|lite|thinking)|1\.6)/i;
const NON_CHAT_MODELS = /(?:embedding|rerank|realtime|audio|tts|asr|omni|image|seedream|seedance|video)/i;
// The existing Ark image request uses the 2K size preset of Seedream 4.x.
const ARK_IMAGE_FAMILY = /^doubao-seedream-4[.-][05](?:-|$)/i;

// Supported request protocols; this does not imply account access.
export const DEEPSEEK_VISION_BETA = 'deepseek-v4.1-flash-expires-on-0910';

export function supportsVision(provider, id) {
  if (provider === 'deepseek') return id === DEEPSEEK_VISION_BETA;
  if (provider === 'aliyun') return /^qwen3-vl-(?:plus|flash)(?:-\d{4}-\d{2}-\d{2})?$/.test(id);
  return provider === 'volcengine' && ['doubao-seed-1-6-250615', 'doubao-seed-1-6-flash-250615'].includes(id);
}

export function modelKinds(provider, model) {
  const id = model.id;
  if (supportsVision(provider, id)) return ['text', 'vision'];
  if (provider === 'deepseek') {
    return /^deepseek-(?:v4-(?:flash|pro)(?:-|$)|chat$|reasoner$)/i.test(id) ? ['text'] : [];
  }
  if (provider === 'aliyun') {
    if (ALI_ASYNC_IMAGE_MODELS.has(id)) return ['image'];
    if (Array.isArray(model.capabilities) && model.capabilities.includes('TG') && TEXT_FAMILIES.test(id) && !NON_CHAT_MODELS.test(id)) return ['text'];
    return [];
  }
  if (provider === 'volcengine') {
    if (ARK_IMAGE_FAMILY.test(id)) return ['image'];
    if (!NON_CHAT_MODELS.test(id) && (TEXT_FAMILIES.test(id) || ARK_CHAT_FAMILIES.test(id))) return ['text'];
  }
  return [];
}

export function buildModelCatalog(provider, entries) {
  if (!Array.isArray(entries)) throw new Error('服务商未返回有效的模型列表，原有选择未改变。');
  const unique = new Map();
  let skipped = 0;
  for (const entry of entries) {
    const id = provider === 'aliyun' ? entry?.model : entry?.id;
    if (typeof id !== 'string' || id.length > MODEL_ID_MAX_LENGTH || !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/.test(id)) {
      skipped++; continue;
    }
    if (unique.has(id)) continue;
    const kinds = modelKinds(provider, { id, capabilities: entry.capabilities });
    unique.set(id, { id, kinds });
  }
  const models = [...unique.values()].filter(model => model.kinds.length).sort((a, b) => a.id.localeCompare(b.id));
  skipped += unique.size - models.length;
  return { models, skipped, source: 'api' };
}

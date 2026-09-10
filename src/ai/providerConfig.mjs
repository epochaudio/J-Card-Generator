import { DEEPSEEK_CURRENT_MODEL } from './modelCatalog.mjs';

// Mainland China endpoints. Account regions and subscription channels are not interchangeable.
export const AI_CONFIG_VERSION = 5;
// Keep the storage key stable so an existing encrypted key can be read into the simpler shape.
export const AI_SETTINGS_KEY = 'jcard_ai_settings_v1';
export const LEGACY_ALI_KEYS = ['jcard_dashscope_api_key', 'dashscope_api_key', 'gemini_api_key'];

export const PROVIDERS = {
  deepseek: {
    name: 'DeepSeek',
    capabilities: ['text', 'vision'],
    textUrl: 'https://api.deepseek.com/chat/completions',
    model: DEEPSEEK_CURRENT_MODEL,
    keyUrl: 'https://platform.deepseek.com/api_keys',
    planUrl: 'https://api-docs.deepseek.com/quick_start/pricing',
    planNote: '文本生成与图片理解统一使用 DeepSeek-V4.1-Flash；本应用接普通 API，按实际调用计费。'
  },
  aliyun: {
    name: '阿里云百炼',
    capabilities: ['image'],
    imageUrl: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis',
    imageModel: 'wan2.5-t2i-preview',
    keyUrl: 'https://help.aliyun.com/zh/model-studio/get-api-key/',
    planUrl: 'https://help.aliyun.com/zh/model-studio/coding-plan',
    planNote: '仅在需要 AI 生成封面图片时使用普通按量 API。'
  },
  volcengine: {
    name: '火山引擎（火山方舟）',
    capabilities: ['image'],
    imageUrl: 'https://ark.cn-beijing.volces.com/api/v3/images/generations',
    imageModel: 'doubao-seedream-4-0-250828',
    keyUrl: 'https://www.volcengine.com/docs/82379/1541594',
    planUrl: 'https://www.volcengine.com/docs/82379/1925114',
    planNote: '仅在需要 AI 生成封面图片时使用普通按量 API。'
  }
};

export const PROVIDER_IDS = Object.keys(PROVIDERS);
export const providersFor = kind => PROVIDER_IDS.filter(id => PROVIDERS[id].capabilities.includes(kind));

export function validateProviderKey(id, apiKey) {
  if (!Object.hasOwn(PROVIDERS, id)) throw new Error('无效的 AI 服务商。');
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw new Error(`请填写${PROVIDERS[id].name}的普通 API Key。`);
  if (/\s/.test(apiKey)) throw new Error('API Key 中不能包含空格或换行。');
  if (id === 'aliyun' && apiKey.startsWith('sk-sp-')) {
    throw new Error('阿里云百炼当前填写的是订阅密钥。本版本接普通按量 API，请使用普通 API Key；不会自动切换计费通道。');
  }
}

export function normalizeAISettings(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('AI 设置格式无效。');
  if (input.version != null && (!Number.isInteger(input.version) || input.version < 1 || input.version > AI_CONFIG_VERSION)) {
    throw new Error('不支持此 AI 设置版本。');
  }
  const text = value => {
    if (value == null) return '';
    if (typeof value !== 'string') throw new Error('AI 设置字段必须为文本。');
    return value.trim();
  };
  const imageProvider = input.imageProvider == null || input.imageProvider === 'minimax' ? '' : input.imageProvider;
  if (imageProvider && !providersFor('image').includes(imageProvider)) throw new Error('请选择支持图片生成的 AI 服务商。');

  return {
    version: AI_CONFIG_VERSION,
    imageProvider,
    providers: Object.fromEntries(PROVIDER_IDS.map(id => {
      const entry = input.providers?.[id] ?? {};
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('服务商设置格式无效。');
      const apiKey = text(entry.apiKey);
      if (/\s/.test(apiKey)) throw new Error(`${PROVIDERS[id].name} 密钥中不能包含空格或换行。`);
      if (id === 'deepseek') return [id, { apiKey, model: DEEPSEEK_CURRENT_MODEL }];
      return [id, { apiKey, imageModel: PROVIDERS[id].imageModel }];
    }))
  };
}

export function resolveProvider(settings, kind) {
  if (!['text', 'image', 'vision'].includes(kind)) throw new Error('不支持的 AI 能力。');
  const config = normalizeAISettings(settings);
  const id = kind === 'image' ? config.imageProvider : 'deepseek';
  if (!id) throw new Error('如需 AI 生成封面图片，请先在设置中开启并配置生图服务。');
  const entry = config.providers[id];
  validateProviderKey(id, entry.apiKey);
  const model = id === 'deepseek' ? entry.model : entry.imageModel;
  return { id, apiKey: entry.apiKey, model };
}

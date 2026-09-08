// Mainland China endpoints. Account regions and subscription channels are not interchangeable.
export const AI_CONFIG_VERSION = 2;
// Keep the storage key stable so version 1 can be migrated atomically.
export const AI_SETTINGS_KEY = 'jcard_ai_settings_v1';
export const LEGACY_ALI_KEYS = ['jcard_dashscope_api_key', 'dashscope_api_key', 'gemini_api_key'];
export const PROVIDERS = {
  aliyun: {
    name: '阿里云百炼',
    capabilities: ['text', 'image'],
    textUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    imageUrl: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis',
    textModel: '', imageModel: 'wan2.5-t2i-preview',
    textHint: '留空沿用原默认：标题 qwen-plus，其余 qwen3-max',
    imageHint: '通义万相异步文生图模型',
    keyUrl: 'https://help.aliyun.com/zh/model-studio/get-api-key/',
    planUrl: 'https://help.aliyun.com/zh/model-studio/coding-plan',
    planNote: '本应用接百炼普通 API，按实际调用计费。Coding Plan 是独立的编程订阅，使用专用密钥与地址，本版本不接入；订阅中的图片理解不等于万相封面生成额度。其他订阅权益以控制台为准。'
  },
  volcengine: {
    name: '火山引擎（火山方舟）',
    capabilities: ['text', 'image'],
    modelsUrl: 'https://ark.cn-beijing.volces.com/api/v3/models',
    textUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    imageUrl: 'https://ark.cn-beijing.volces.com/api/v3/images/generations',
    textModel: '', imageModel: '',
    textHint: '填写已开通的文本 Model ID 或推理接入点 ID（ep-…）',
    imageHint: '填写已开通的 Seedream Model ID 或推理接入点 ID',
    keyUrl: 'https://www.volcengine.com/docs/82379/1541594',
    planUrl: 'https://www.volcengine.com/docs/82379/1925114',
    planNote: '本应用接方舟普通 API，按实际调用计费。Coding Plan 是面向 AI 编程工具的独立套餐，不能当作本应用通用 API 额度；本版本未接入 Coding / Agent 订阅通道。'
  },
  deepseek: {
    name: 'DeepSeek',
    capabilities: ['text'],
    textUrl: 'https://api.deepseek.com/chat/completions',
    modelsUrl: 'https://api.deepseek.com/models',
    textModel: 'deepseek-v4-flash', imageModel: '',
    textHint: '默认 deepseek-v4-flash；可获取模型后选择或手动填写',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    planUrl: 'https://api-docs.deepseek.com/quick_start/pricing',
    planNote: '本应用接 DeepSeek 官方普通 API，按实际调用计费。API 余额与网页或 App 使用权益分开；本应用仅接入文本生成，封面图片请选择阿里云或火山方舟。'
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

export function validateWorkspaceId(value) {
  // A workspace is one DNS label, never a user-controlled URL or hostname.
  if (typeof value !== 'string' || !/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(value)) {
    throw new Error('请填写有效的阿里云业务空间 ID（在百炼控制台查看）。');
  }
  return value;
}

export function normalizeAISettings(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('AI 设置格式无效。');
  if (input.version != null && ![1, AI_CONFIG_VERSION].includes(input.version)) throw new Error('不支持此 AI 设置版本。');
  const text = value => {
    if (value == null) return '';
    if (typeof value !== 'string') throw new Error('AI 设置字段必须为文本。');
    return value.trim();
  };
  const provider = (value, kind) => {
    // Removing MiniMax must not silently select another billable service.
    if (value === 'minimax' && (input.version == null || input.version === 1)) return '';
    if (value === '') return '';
    if (!providersFor(kind).includes(value)) throw new Error(`请选择支持${kind === 'image' ? '图片' : '文本'}的 AI 服务商。`);
    return value;
  };
  return {
    version: AI_CONFIG_VERSION,
    textProvider: provider(input.textProvider ?? 'aliyun', 'text'),
    imageProvider: provider(input.imageProvider ?? 'aliyun', 'image'),
    providers: Object.fromEntries(PROVIDER_IDS.map(id => {
      const entry = input.providers?.[id] ?? {};
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('服务商设置格式无效。');
      const apiKey = text(entry.apiKey);
      if (/\s/.test(apiKey)) throw new Error(`${PROVIDERS[id].name} 密钥中不能包含空格或换行。`);
      const workspaceId = id === 'aliyun' ? text(entry.workspaceId) : '';
      if (workspaceId) validateWorkspaceId(workspaceId);
      return [id, {
        apiKey,
        textModel: text(entry.textModel ?? PROVIDERS[id].textModel),
        imageModel: PROVIDERS[id].capabilities.includes('image') ? text(entry.imageModel ?? PROVIDERS[id].imageModel) : '',
        ...(id === 'aliyun' ? { workspaceId } : {})
      }];
    }))
  };
}

export function resolveProvider(settings, kind, defaultTextModel = 'qwen3-max') {
  const config = normalizeAISettings(settings);
  const id = config[kind === 'image' ? 'imageProvider' : 'textProvider'];
  if (!id) throw new Error(`请在设置中重新选择并保存${kind === 'image' ? '图片' : '文本'}服务商。`);
  const entry = config.providers[id];
  const meta = PROVIDERS[id];
  if (!entry.apiKey) throw new Error(`请在设置中填写并保存${meta.name}的普通 API Key。`);
  validateProviderKey(id, entry.apiKey);
  const model = kind === 'image' ? entry.imageModel : entry.textModel || (id === 'aliyun' ? defaultTextModel : '');
  if (!model) throw new Error(`请在设置中填写${meta.name}的${kind === 'image' ? '图片' : '文本'}模型 ID。`);
  return { id, apiKey: entry.apiKey, model };
}

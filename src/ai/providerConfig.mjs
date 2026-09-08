// Mainland China endpoints. Account regions and subscription channels are not interchangeable.
export const AI_CONFIG_VERSION = 1;
export const AI_SETTINGS_KEY = 'jcard_ai_settings_v1';
export const LEGACY_ALI_KEYS = ['jcard_dashscope_api_key', 'dashscope_api_key', 'gemini_api_key'];
export const PROVIDERS = {
  aliyun: {
    name: '阿里云百炼',
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
    textUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    imageUrl: 'https://ark.cn-beijing.volces.com/api/v3/images/generations',
    textModel: '', imageModel: '',
    textHint: '填写已开通的文本 Model ID 或推理接入点 ID（ep-…）',
    imageHint: '填写已开通的 Seedream Model ID 或推理接入点 ID',
    keyUrl: 'https://www.volcengine.com/docs/82379/1541594',
    planUrl: 'https://www.volcengine.com/docs/82379/1925114',
    planNote: '本应用接方舟普通 API，按实际调用计费。Coding Plan 是面向 AI 编程工具的独立套餐，不能当作本应用通用 API 额度；本版本未接入 Coding / Agent 订阅通道。'
  },
  minimax: {
    name: 'MiniMax',
    textUrl: 'https://api.minimax.cn/v1/chat/completions',
    imageUrl: 'https://api.minimax.cn/v1/image_generation',
    textModel: 'MiniMax-M2.7', imageModel: 'image-01',
    textHint: '例如 MiniMax-M2.7；可改为账户已开通的文本模型',
    imageHint: '文生图模型 image-01',
    keyUrl: 'https://platform.minimaxi.com/docs/guides/quickstart-preparation',
    planUrl: 'https://platform.minimaxi.com/docs/token-plan/faq',
    planNote: '本应用接普通按量 API。MiniMax 的 Token Plan 订阅可覆盖文本、图片等资源，并非一概只限写代码；订阅 Key 与普通 API Key 独立，本版本未接订阅通道。旧 Coding Plan 请按当前控制台权益核对。'
  }
};
export const PROVIDER_IDS = Object.keys(PROVIDERS);

export function normalizeAISettings(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('AI 设置格式无效。');
  if (input.version != null && input.version !== AI_CONFIG_VERSION) throw new Error('不支持此 AI 设置版本。');
  const text = value => {
    if (value == null) return '';
    if (typeof value !== 'string') throw new Error('AI 设置字段必须为文本。');
    return value.trim();
  };
  const provider = value => {
    if (!PROVIDER_IDS.includes(value)) throw new Error('请选择支持的 AI 服务商。');
    return value;
  };
  return {
    version: AI_CONFIG_VERSION,
    textProvider: provider(input.textProvider ?? 'aliyun'),
    imageProvider: provider(input.imageProvider ?? 'aliyun'),
    providers: Object.fromEntries(PROVIDER_IDS.map(id => {
      const entry = input.providers?.[id] ?? {};
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('服务商设置格式无效。');
      const apiKey = text(entry.apiKey);
      if (/\s/.test(apiKey)) throw new Error(`${PROVIDERS[id].name} 密钥中不能包含空格或换行。`);
      return [id, {
        apiKey,
        textModel: text(entry.textModel ?? PROVIDERS[id].textModel),
        imageModel: text(entry.imageModel ?? PROVIDERS[id].imageModel)
      }];
    }))
  };
}

export function resolveProvider(settings, kind, defaultTextModel = 'qwen3-max') {
  const config = normalizeAISettings(settings);
  const id = config[kind === 'image' ? 'imageProvider' : 'textProvider'];
  const entry = config.providers[id];
  const meta = PROVIDERS[id];
  if (!entry.apiKey) throw new Error(`请在设置中填写并保存${meta.name}的普通 API Key。`);
  // Known subscription prefixes only; do not infer account entitlements from other prefixes.
  if ((id === 'aliyun' && entry.apiKey.startsWith('sk-sp-')) || (id === 'minimax' && entry.apiKey.startsWith('sk-cp-'))) {
    throw new Error(`${meta.name}当前填写的是订阅密钥。本版本接普通按量 API，请使用普通 API Key；不会自动切换计费通道。`);
  }
  const model = kind === 'image' ? entry.imageModel : entry.textModel || (id === 'aliyun' ? defaultTextModel : '');
  if (!model) throw new Error(`请在设置中填写${meta.name}的${kind === 'image' ? '图片' : '文本'}模型 ID。`);
  return { id, apiKey: entry.apiKey, model };
}

import { generateImage, generateText, listModels } from './providerAPI.mjs';
import { resolveProvider } from './providerConfig.mjs';

export const aiTransport = {
  async models(id, entry) {
    const request = { id, apiKey: entry.apiKey.trim(), workspaceId: entry.workspaceId?.trim() };
    if (globalThis.window?.electronAPI?.ai) {
      if (!window.electronAPI.ai.models) throw new Error('请重启桌面应用以启用模型获取。');
      return window.electronAPI.ai.models(request);
    }
    return listModels(request);
  },
  async text(settings, prompt, systemPrompt, defaultModel) {
    const request = { ...resolveProvider(settings, 'text', defaultModel), prompt, systemPrompt };
    if (globalThis.window?.electronAPI?.ai) return window.electronAPI.ai.text(request);
    return generateText(request);
  },
  async image(settings, prompt) {
    const request = { ...resolveProvider(settings, 'image'), prompt };
    if (globalThis.window?.electronAPI?.ai) return window.electronAPI.ai.image(request);
    return generateImage(request);
  }
};

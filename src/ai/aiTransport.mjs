import { generateImage, generateText } from './providerAPI.mjs';
import { resolveProvider } from './providerConfig.mjs';

export const aiTransport = {
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

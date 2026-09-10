import { generateImage, generateText, analyzeImages } from './providerAPI.mjs';
import { resolveProvider } from './providerConfig.mjs';

export const aiTransport = {
  async vision(settings, prompt, images, signal) {
    const request = { ...resolveProvider(settings, 'vision'), prompt, images };
    if (!globalThis.window?.electronAPI?.ai) return analyzeImages(request, { signal });
    if (!window.electronAPI.ai.vision) throw new Error('请重启更新后的桌面应用以启用视觉分析。');
    const requestId = crypto.randomUUID();
    const cancel = () => { void window.electronAPI.ai.cancelVision(requestId).catch(() => {}); };
    if (signal?.aborted) throw new Error('已取消智能搭配。');
    signal?.addEventListener('abort', cancel, { once: true });
    try { return await window.electronAPI.ai.vision({ ...request, requestId }); }
    finally { signal?.removeEventListener('abort', cancel); }
  },
  async text(settings, prompt, systemPrompt) {
    const request = { ...resolveProvider(settings, 'text'), prompt, systemPrompt };
    if (globalThis.window?.electronAPI?.ai) return window.electronAPI.ai.text(request);
    return generateText(request);
  },
  async image(settings, prompt) {
    const request = { ...resolveProvider(settings, 'image'), prompt };
    if (globalThis.window?.electronAPI?.ai) return window.electronAPI.ai.image(request);
    return generateImage(request);
  }
};

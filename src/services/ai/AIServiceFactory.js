
// src/services/ai/AIServiceFactory.js
import DashScopeProvider from './providers/DashScopeProvider.js';
import OpenAIProvider from './providers/OpenAIProvider.js';

// If we add Gemini later
// import GeminiProvider from './providers/GeminiProvider.js';

const PROVIDERS = {
    'dashscope': DashScopeProvider,
    'openai': OpenAIProvider,
    // 'gemini': GeminiProvider
};

const AIServiceFactory = {
    getProvider: (providerKey) => {
        const key = providerKey ? providerKey.toLowerCase() : 'dashscope';
        return PROVIDERS[key] || DashScopeProvider;
    },

    getAvailableProviders: () => {
        return [
            { id: 'dashscope', name: 'Alibaba Cloud (DashScope / Qwen)' },
            { id: 'openai', name: 'OpenAI (GPT-4 / DALL-E)' },
            // { id: 'gemini', name: 'Google Gemini' }
        ];
    }
};

export default AIServiceFactory;

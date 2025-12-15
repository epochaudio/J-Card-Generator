
// src/services/AIService.js
import AIServiceFactory from './ai/AIServiceFactory.js';

// Constants for storage keys
const STORAGE_KEYS = {
    PROVIDER: 'jcard_ai_provider',
    API_KEYS: 'jcard_ai_keys', // Object { dashscope: "...", openai: "..." }
};

const AIService = {
    // --- State Management Helpers ---
    getProviderName: () => {
        return localStorage.getItem(STORAGE_KEYS.PROVIDER) || 'dashscope';
    },

    setProviderName: (name) => {
        localStorage.setItem(STORAGE_KEYS.PROVIDER, name);
    },

    // Get key for specific provider
    getApiKey: (providerName) => {
        try {
            const keysStr = localStorage.getItem(STORAGE_KEYS.API_KEYS);
            const keys = keysStr ? JSON.parse(keysStr) : {};
            return keys[providerName] || "";
        } catch (e) {
            return "";
        }
    },

    // Save key for specific provider
    setApiKey: (providerName, key) => {
        try {
            const keysStr = localStorage.getItem(STORAGE_KEYS.API_KEYS);
            const keys = keysStr ? JSON.parse(keysStr) : {};
            keys[providerName] = key;
            localStorage.setItem(STORAGE_KEYS.API_KEYS, JSON.stringify(keys));
        } catch (e) {
            console.error("Failed to save API key", e);
        }
    },

    // --- Core Methods (Proxy to Active Provider) ---

    // 1. Get the active provider instance
    _getActiveProvider: () => {
        const name = AIService.getProviderName();
        return AIServiceFactory.getProvider(name);
    },

    // 2. Get the active key
    _getActiveKey: () => {
        const name = AIService.getProviderName();
        return AIService.getApiKey(name);
    },

    // --- Interface Implementation ---

    enhanceContent: async (data) => {
        const provider = AIService._getActiveProvider();
        const key = AIService._getActiveKey();
        return await provider.enhanceContent(data, key);
    },

    generateImage: async (prompt) => {
        const provider = AIService._getActiveProvider();
        const key = AIService._getActiveKey();
        return await provider.generateImage(prompt, key);
    },

    suggestTitle: async (tracks) => {
        const provider = AIService._getActiveProvider();
        const key = AIService._getActiveKey();
        return await provider.suggestTitle(tracks, key);
    },

    generateSlogan: async (tracks) => {
        const provider = AIService._getActiveProvider();
        const key = AIService._getActiveKey();
        return await provider.generateSlogan(tracks, key);
    },

    generateImagePrompt: async (isDark, tracks, notes) => {
        const provider = AIService._getActiveProvider();
        const key = AIService._getActiveKey();
        return await provider.generateImagePrompt(isDark, tracks, notes, key);
    },

    parseImportData: async (text) => {
        const provider = AIService._getActiveProvider();
        const key = AIService._getActiveKey();
        return await provider.parseImportData(text, key);
    },

    // Helper exposed for App
    urlToBase64: async (url) => {
        const provider = AIService._getActiveProvider();
        // Fallback to local if provider doesn't support it (optional, but good practice)
        if (provider.urlToBase64) {
            return await provider.urlToBase64(url);
        }

        try {
            const response = await fetch(url);
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            return url;
        }
    }
};

export default AIService;

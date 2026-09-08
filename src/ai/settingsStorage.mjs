import { AI_SETTINGS_KEY, LEGACY_ALI_KEYS, normalizeAISettings } from './providerConfig.mjs';

export function createSettingsStorage({ secureStore, localStore }) {
  const removeLegacy = async () => {
    for (const key of LEGACY_ALI_KEYS) {
      if (secureStore) await secureStore.removeItem(key);
      localStore?.removeItem(key);
    }
  };
  const save = async settings => {
    const normalized = normalizeAISettings(settings);
    const payload = JSON.stringify(normalized);
    let warning = '';
    if (secureStore) {
      const stored = await secureStore.setItem(AI_SETTINGS_KEY, payload);
      if (stored !== true) throw new Error('系统加密存储不可用，设置未保存。原有密钥保持不变。');
      try { localStore?.removeItem(AI_SETTINGS_KEY); } catch { warning = '设置已加密保存，但浏览器旧副本清理失败。'; }
    } else {
      if (!localStore) throw new Error('浏览器本地存储不可用，设置未保存。');
      localStore.setItem(AI_SETTINGS_KEY, payload);
    }
    // Cleanup happens only after the complete replacement has been committed.
    try { await removeLegacy(); } catch { warning = '新设置已保存，旧版密钥副本清理失败，请检查本地存储权限。'; }
    return { settings: normalized, warning };
  };
  const load = async () => {
    const encrypted = secureStore ? await secureStore.getItem(AI_SETTINGS_KEY) : null;
    if (encrypted) return { settings: normalizeAISettings(JSON.parse(encrypted)), warning: '' };
    const local = localStore?.getItem(AI_SETTINGS_KEY);
    if (local) {
      const settings = normalizeAISettings(JSON.parse(local));
      return secureStore ? save(settings) : { settings, warning: '' };
    }
    // Prefer the existing canonical key, then the two historical aliases.
    let legacyKey = '';
    if (secureStore) {
      for (const key of LEGACY_ALI_KEYS) { legacyKey = await secureStore.getItem(key); if (legacyKey) break; }
    }
    if (!legacyKey) {
      for (const key of LEGACY_ALI_KEYS) { legacyKey = localStore?.getItem(key); if (legacyKey) break; }
    }
    const settings = normalizeAISettings();
    if (legacyKey) {
      settings.providers.aliyun.apiKey = legacyKey;
      return save(settings);
    }
    return { settings, warning: '' };
  };
  return { load, save };
}

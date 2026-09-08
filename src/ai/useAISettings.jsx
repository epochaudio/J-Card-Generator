import { useEffect, useRef, useState } from 'react';
import { normalizeAISettings } from './providerConfig.mjs';
import { createSettingsStorage } from './settingsStorage.mjs';

export default function useAISettings() {
  const [settings, setSettings] = useState(() => normalizeAISettings());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const storage = useRef(null);
  if (!storage.current) {
    let localStore;
    try { localStore = window.localStorage; } catch { /* Report unavailable storage on save. */ }
    storage.current = createSettingsStorage({ secureStore: window.electronAPI?.secureStore, localStore });
  }
  // One load promise also prevents StrictMode from racing two legacy migrations.
  const loading = useRef(null);
  useEffect(() => {
    let cancelled = false;
    loading.current ||= storage.current.load();
    loading.current.then(result => {
      if (!cancelled) { setSettings(result.settings); setError(result.warning); setReady(true); }
    }).catch(() => { if (!cancelled) { setError('AI 设置读取或迁移失败。原有数据未主动清除，请重试读取。'); } });
    return () => { cancelled = true; };
  }, []);
  const retry = async () => {
    try {
      const result = await storage.current.load();
      setSettings(result.settings); setError(result.warning); setReady(true);
    } catch { setError('AI 设置仍无法读取，请检查系统存储权限。'); }
  };
  const save = async next => {
    if (!ready) throw new Error('请先成功读取原设置，避免覆盖尚未读取的密钥。');
    const result = await storage.current.save(next);
    setSettings(result.settings); setError(result.warning);
    return result;
  };
  return { settings, ready, error, retry, save };
}

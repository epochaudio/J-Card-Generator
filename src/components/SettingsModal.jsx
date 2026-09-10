import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ImagePlus, Key, Settings, Sparkles, X } from 'lucide-react';
import { PROVIDERS, providersFor, normalizeAISettings } from '../ai/providerConfig.mjs';

const inputClass = 'w-full bg-gray-900 border border-gray-600 rounded p-2.5 text-white focus:ring-2 focus:ring-orange-500 outline-none text-sm';

const SettingsModal = ({ isOpen, aiSettings, onClose, onSave, ready, loadError, onRetry }) => {
  const [draft, setDraft] = useState(() => normalizeAISettings());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const savingRef = useRef(false);
  const dialog = useRef(null);

  useLayoutEffect(() => {
    if (isOpen) { setDraft(normalizeAISettings(aiSettings)); setMessage(''); setFailed(false); }
  }, [isOpen, ready]);

  useEffect(() => {
    if (!isOpen) return;
    const node = dialog.current;
    const previous = document.activeElement;
    node.querySelector('button')?.focus();
    const trap = event => {
      if (event.key === 'Escape') { if (!savingRef.current) onClose(); return; }
      if (event.key !== 'Tab') return;
      const controls = [...node.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], summary')].filter(control => control.getClientRects().length);
      const index = controls.indexOf(document.activeElement);
      if (event.shiftKey && index <= 0) { event.preventDefault(); controls.at(-1)?.focus(); }
      if (!event.shiftKey && index === controls.length - 1) { event.preventDefault(); controls[0]?.focus(); }
    };
    node.addEventListener('keydown', trap);
    return () => { node.removeEventListener('keydown', trap); previous?.focus(); };
  }, [isOpen]);

  if (!isOpen) return null;
  const deepseek = draft.providers.deepseek;
  const imageEnabled = Boolean(draft.imageProvider);
  const imageMeta = imageEnabled ? PROVIDERS[draft.imageProvider] : null;
  const imageEntry = imageEnabled ? draft.providers[draft.imageProvider] : null;
  const markChanged = () => { setMessage('有未保存的设置'); setFailed(false); };
  const updateKey = (id, apiKey) => {
    setDraft(prev => ({ ...prev, providers: { ...prev.providers, [id]: { ...prev.providers[id], apiKey } } }));
    markChanged();
  };
  const toggleImage = enabled => {
    setDraft(prev => ({ ...prev, imageProvider: enabled ? 'aliyun' : '' }));
    markChanged();
  };
  const selectImageProvider = id => {
    setDraft(prev => ({ ...prev, imageProvider: id }));
    markChanged();
  };
  const save = async () => {
    if (savingRef.current) return;
    savingRef.current = true; setSaving(true); setMessage(''); setFailed(false);
    try {
      const result = await onSave(draft);
      setMessage(result.warning || '设置已保存；密钥是否有效、账户套餐与余额尚未验证。');
    } catch (error) { setFailed(true); setMessage(error.message); }
    finally { savingRef.current = false; setSaving(false); }
  };

  return <div className="absolute inset-0 z-[60] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="ai-settings-title" className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-xl border border-gray-700 text-white flex flex-col max-h-[92vh]">
      <div className="flex justify-between items-center p-4 border-b border-gray-700 shrink-0">
        <h3 id="ai-settings-title" className="text-lg font-bold flex items-center gap-2"><Settings size={20} /> AI 服务设置</h3>
        <button aria-label="关闭设置" disabled={saving} onClick={onClose}><X size={20} /></button>
      </div>
      <div className="p-5 space-y-5 overflow-y-auto">
        <section className="rounded-lg border border-orange-500/60 bg-orange-950/20 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h4 className="font-semibold flex items-center gap-2"><Sparkles size={18} /> DeepSeek AI</h4>
            <span className="rounded-full bg-orange-500 px-2.5 py-1 text-xs font-semibold text-black">推荐</span>
          </div>
          <p className="text-sm text-gray-300">一个服务完成文字生成、曲目解析、封面识别、智能搭配和视觉复核。</p>
          <div className="rounded bg-gray-900/70 px-3 py-2 text-sm text-gray-300">固定模型：<span className="font-mono text-orange-200">deepseek-flash</span> · DeepSeek-V4.1-Flash</div>
          <label className="block text-sm"><span className="flex items-center gap-2 mb-1"><Key size={15} />DeepSeek 普通 API Key</span>
            <input aria-label="DeepSeek API Key" type="password" autoComplete="off" spellCheck={false} disabled={saving || !ready} value={deepseek.apiKey} onChange={event => updateKey('deepseek', event.target.value)} className={`${inputClass} font-mono`} placeholder="输入 DeepSeek 普通 API Key" />
          </label>
          <div className="flex justify-between text-xs text-gray-400"><span>{deepseek.apiKey ? '已填写（保存后生效）' : '未配置'}</span><a href={PROVIDERS.deepseek.keyUrl} target="_blank" rel="noopener noreferrer" className="text-orange-300 underline">获取 API Key</a></div>
        </section>

        <section className="rounded-lg border border-gray-600 p-4 space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input aria-label="启用 AI 生成封面图片" type="checkbox" checked={imageEnabled} disabled={saving || !ready} onChange={event => toggleImage(event.target.checked)} className="mt-1 h-4 w-4 accent-orange-500" />
            <span><span className="font-semibold flex items-center gap-2"><ImagePlus size={17} />AI 生成封面图片</span><span className="block text-xs text-gray-400 mt-1">可选。不生图时无需开启，也无需配置其他平台。</span></span>
          </label>
          {imageEnabled && <div className="space-y-3 border-t border-gray-700 pt-3">
            <label className="block text-sm">生图服务商
              <select aria-label="生图服务商" disabled={saving || !ready} value={draft.imageProvider} onChange={event => selectImageProvider(event.target.value)} className={`${inputClass} mt-1`}>
                {providersFor('image').map(id => <option key={id} value={id}>{PROVIDERS[id].name}</option>)}
              </select>
            </label>
            <p className="text-xs text-gray-400">使用已适配的默认生图模型：<span className="font-mono">{imageEntry.imageModel}</span></p>
            <label className="block text-sm"><span className="flex items-center gap-2 mb-1"><Key size={15} />{imageMeta.name}普通 API Key</span>
              <input aria-label={`${imageMeta.name} API Key`} type="password" autoComplete="off" spellCheck={false} disabled={saving || !ready} value={imageEntry.apiKey} onChange={event => updateKey(draft.imageProvider, event.target.value)} className={`${inputClass} font-mono`} placeholder={`输入${imageMeta.name}普通 API Key`} />
            </label>
            <div className="flex justify-between text-xs text-gray-400"><span>{imageEntry.apiKey ? '已填写（保存后生效）' : '未配置'}</span><a href={imageMeta.keyUrl} target="_blank" rel="noopener noreferrer" className="text-orange-300 underline">获取 API Key</a></div>
          </div>}
        </section>

        <p className="text-xs text-gray-400">当前接入普通 API，按实际调用计费。网页或 App 会员不自动等于 API 额度；不会自动切换平台。{window.electronAPI?.secureStore ? '桌面版使用系统加密存储。' : '浏览器版使用本地存储，不具备系统加密保护。'} 密钥不写入作品文件或草稿。</p>
        {loadError && <p role="alert" className="text-red-300 text-sm">{loadError}</p>}
        {!ready && <button onClick={onRetry} className="text-orange-300 underline">重试读取设置</button>}
        <details className="border-t border-gray-700 pt-3 text-xs text-gray-400">
          <summary>关于与使用许可</summary>
          <p className="mt-2">© 2025 门耳朵 (Epoch Audio). 保留所有权利。本软件仅供个人非商业目的免费使用、学习与研究。禁止商业化售卖、会员付费下载或有偿代制作。转载及修改版须保留版权声明。</p>
        </details>
      </div>
      <div className="p-4 border-t border-gray-700 space-y-3 shrink-0">
        {message && <p role={failed ? 'alert' : 'status'} className={`text-sm ${failed ? 'text-red-300' : 'text-green-300'}`}>{message}</p>}
        <div className="flex justify-end gap-3">
          <button disabled={saving} onClick={onClose} className="px-4 py-2 border border-gray-600 rounded">关闭</button>
          <button disabled={saving || !ready} onClick={save} className="px-4 py-2 bg-orange-600 hover:bg-orange-500 rounded disabled:opacity-40">{saving ? '正在保存…' : '保存设置'}</button>
        </div>
      </div>
    </div>
  </div>;
};

export default SettingsModal;

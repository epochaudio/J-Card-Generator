import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Key, Settings, X } from 'lucide-react';
import { PROVIDERS, PROVIDER_IDS, providersFor, normalizeAISettings } from '../ai/providerConfig.mjs';
import { aiTransport } from '../ai/aiTransport.mjs';
import ModelPicker from './ModelPicker.jsx';

const inputClass = 'w-full bg-gray-900 border border-gray-600 rounded p-2.5 text-white focus:ring-2 focus:ring-orange-500 outline-none text-sm';
const SettingsModal = ({ isOpen, aiSettings, onClose, onSave, ready, loadError, onRetry }) => {
  const [draft, setDraft] = useState(() => normalizeAISettings());
  const [active, setActive] = useState('aliyun');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const savingRef = useRef(false);
  const [catalogs, setCatalogs] = useState({});
  const [modelStatus, setModelStatus] = useState({});
  const requestGeneration = useRef(0);
  const dialog = useRef(null);
  useLayoutEffect(() => {
    requestGeneration.current++;
    setCatalogs({}); setModelStatus({});
    if (isOpen) { setDraft(normalizeAISettings(aiSettings)); setMessage(''); setFailed(false); }
    return () => { requestGeneration.current++; };
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
  const meta = PROVIDERS[active];
  const entry = draft.providers[active];
  const updateProvider = (field, value) => {
    if (field === 'apiKey' || field === 'workspaceId') {
      requestGeneration.current++;
      setCatalogs(prev => ({ ...prev, [active]: undefined }));
      setModelStatus({});
    }
    setDraft(prev => ({ ...prev, providers: { ...prev.providers, [active]: { ...prev.providers[active], [field]: value } } }));
    setMessage('有未保存的设置'); setFailed(false);
  };
  const fetchModels = async () => {
    const generation = ++requestGeneration.current;
    const id = active;
    setModelStatus({ [id]: { loading: true, text: '正在获取模型…' } });
    try {
      const result = await aiTransport.models(id, entry);
      if (generation !== requestGeneration.current) return;
      setCatalogs(prev => ({ ...prev, [id]: result }));
      setModelStatus({ [id]: { text: `已获取 ${result.models.length} 个已适配模型${result.skipped ? `，另有 ${result.skipped} 项未适配或能力不明确，未列入选项` : ''}。列表不代表余额或实际调用已验证。` } });
    } catch (error) {
      if (generation !== requestGeneration.current) return;
      setModelStatus({ [id]: { failed: true, text: `${error.message} 原有选择保留，可重试或手动填写模型 ID。` } });
    }
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
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="ai-settings-title" className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl border border-gray-700 text-white flex flex-col max-h-[92vh]">
      <div className="flex justify-between items-center p-4 border-b border-gray-700 shrink-0">
        <h3 id="ai-settings-title" className="text-lg font-bold flex items-center gap-2"><Settings size={20} /> AI 服务设置</h3>
        <button aria-label="关闭设置" disabled={saving} onClick={onClose}><X size={20} /></button>
      </div>
      <div className="p-5 space-y-4 overflow-y-auto">
        <p className="text-sm text-gray-300">当前接入：<strong className="text-orange-300">普通 API · 按实际调用计费</strong>。不会自动切换服务商或订阅通道。</p>
        <div className="grid grid-cols-2 gap-4">
          {[['textProvider', '文本服务商'], ['imageProvider', '图片服务商']].map(([field, label]) => <label key={field} className="text-sm space-y-1 block">{label}
            <select aria-label={label} disabled={saving || !ready} value={draft[field]} onChange={event => { setDraft(prev => ({...prev,[field]:event.target.value})); setMessage('有未保存的设置'); }} className={inputClass}>
              <option value="">请选择服务商</option>
              {providersFor(field === 'imageProvider' ? 'image' : 'text').map(id => <option key={id} value={id}>{PROVIDERS[id].name}</option>)}
            </select>
          </label>)}
        </div>
        <p className="text-xs text-gray-400">文本用于曲目解析、标题、标语及提示词；图片用于生成封面。两者可分别选择。</p>
        {(!draft.textProvider || !draft.imageProvider) && <p role="status" className="text-sm text-orange-200">有服务商尚未选择。旧版 MiniMax 已移除，请重新选择对应服务；不会自动改用其他家的额度。</p>}
        <div className="flex gap-2" role="tablist" aria-label="服务商配置">
          {PROVIDER_IDS.map(id => <button role="tab" aria-selected={active === id} key={id} disabled={saving} onClick={() => { requestGeneration.current++; setModelStatus({}); setActive(id); }} className={`flex-1 py-2 px-1 text-sm rounded ${active === id ? 'bg-orange-600' : 'bg-gray-700'}`}>{PROVIDERS[id].name}</button>)}
        </div>
        <fieldset disabled={saving || !ready} className="space-y-3">
          <label className="block text-sm"><span className="flex items-center gap-2 mb-1"><Key size={15} />{meta.name} 普通 API Key</span>
            <input aria-label={`${meta.name} API Key`} type="password" autoComplete="off" spellCheck={false} value={entry.apiKey} onChange={event => updateProvider('apiKey', event.target.value)} className={`${inputClass} font-mono`} placeholder="输入该平台的普通 API Key" />
          </label>
          <div className="flex justify-between text-xs text-gray-400"><span>{entry.apiKey ? '已填写（保存后生效）' : '未配置'} · 清空后保存可删除该密钥</span><a href={meta.keyUrl} target="_blank" rel="noopener noreferrer" className="text-orange-300 underline">获取 API Key</a></div>
          {active === 'aliyun' && <label className="block text-sm">业务空间 ID（获取模型时需要）
            <input aria-label="阿里云业务空间 ID" value={entry.workspaceId} onChange={event => updateProvider('workspaceId', event.target.value)} className={`${inputClass} mt-1`} placeholder="在百炼控制台查看北京地域的业务空间 ID" />
          </label>}
          <div className="space-y-2">
            <button disabled={saving || !ready || modelStatus[active]?.loading || !entry.apiKey.trim()} onClick={fetchModels} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm disabled:opacity-40">{modelStatus[active]?.loading ? '正在获取…' : catalogs[active] ? '刷新模型' : '获取模型'}</button>
            <p className="text-xs text-gray-400">使用当前填写的密钥读取列表；获取不会保存设置或发起生成。列表只显示本应用已适配的模型。</p>
            {active === 'volcengine' && <p className="text-xs text-gray-400">若账户接口不提供模型列表，可手动填写 Model ID 或 ep-… 接入点；接入点未必包含在列表中。</p>}
            {modelStatus[active] && <p role={modelStatus[active].failed ? 'alert' : 'status'} className={`text-xs ${modelStatus[active].failed ? 'text-red-300' : 'text-gray-300'}`}>{modelStatus[active].text}</p>}
          </div>
          <ModelPicker key={`${active}-text`} label={`${meta.name} 文本模型`} value={entry.textModel} onChange={value => updateProvider('textModel', value)} models={(catalogs[active]?.models || []).filter(model => model.kinds.includes('text'))} hint={meta.textHint} disabled={saving || !ready} allowDefault={active === 'aliyun'} />
          {meta.capabilities.includes('image')
            ? <ModelPicker key={`${active}-image`} label={`${meta.name} 图片模型`} value={entry.imageModel} onChange={value => updateProvider('imageModel', value)} models={(catalogs[active]?.models || []).filter(model => model.kinds.includes('image'))} hint={meta.imageHint} disabled={saving || !ready} />
            : <p className="text-xs text-orange-200">DeepSeek 用于文本和封面提示词；封面图片请在上方选择阿里云或火山方舟。</p>}
        </fieldset>
        <div className="rounded border border-gray-600 bg-gray-900/60 p-3 text-xs leading-relaxed space-y-2">
          <p className="font-semibold text-orange-200">订阅包 / Coding Plan（code 包）说明</p>
          <p>{meta.planNote}</p>
          <p>网页或 App 会员不自动等于开放平台 API 额度。密钥前缀不能证明账户已订阅或有余额，请在服务商控制台核对。模型与接口采用中国大陆平台配置。</p>
          <a href={meta.planUrl} target="_blank" rel="noopener noreferrer" className="text-orange-300 underline">查看官方套餐说明</a>
          <p className="text-gray-500">说明核对日期：2026-09-08；价格、模型权限与权益以官方当前页面为准。</p>
        </div>
        <p className="text-xs text-gray-400">{window.electronAPI?.secureStore ? '桌面版使用系统加密存储。' : '浏览器版保存在此浏览器的本地存储中，不具备系统加密保护。'} 密钥不写入作品文件或草稿。关闭未保存的设置会取消本次编辑。</p>
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

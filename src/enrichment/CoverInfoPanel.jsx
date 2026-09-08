import React, { useLayoutEffect, useRef, useState } from 'react';
import SearchModal from '../components/SearchModal.jsx';
import { aiTransport } from '../ai/aiTransport.mjs';
import { resolveProvider } from '../ai/providerConfig.mjs';
import { supportsVision } from '../ai/modelCatalog.mjs';
import { prepareCoverImage, checkCancelled } from '../design/designMaterials.js';
import { COVER_RECOGNITION_PROMPT, parseCoverRecognition } from './coverRecognition.mjs';

export default function CoverInfoPanel({ snapshot, settings, projectIdentity, ready, onApply, onSettings }) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [search, setSearch] = useState(null);
  const active = useRef(null), latest = useRef(null), previous = useRef(null);
  const stamp = JSON.stringify({ snapshot, settings, projectIdentity });
  latest.current = { snapshot, settings, stamp, ready, onApply };
  useLayoutEffect(() => {
    if (previous.current && previous.current !== stamp) {
      if (active.current || search) setMessage('封面、作品或设置已变化，请重新识别。');
      active.current?.abort(); active.current = null; setBusy(false); setSearch(null);
    }
    previous.current = stamp;
  }, [stamp]);
  useLayoutEffect(() => () => active.current?.abort(), []);
  const cancel = () => { active.current?.abort(); active.current = null; setBusy(false); setMessage('已取消封面识别。'); };
  const identify = async () => {
    const current = latest.current;
    if (!current.ready || !current.snapshot.coverImage || active.current) return;
    try {
      const provider = resolveProvider(current.settings, 'vision');
      if (!supportsVision(provider.id, provider.model)) throw new Error('请先配置已适配的视觉模型。');
    } catch (error) { setMessage(error.message); return; }
    const controller = new AbortController(); active.current = controller; setBusy(true); setSearch(null); setMessage('正在识别封面…');
    try {
      const image = await prepareCoverImage(current.snapshot.coverImage, controller.signal); checkCancelled(controller.signal);
      const result = await aiTransport.vision(current.settings, COVER_RECOGNITION_PROMPT, [image], controller.signal); checkCancelled(controller.signal);
      if (active.current !== controller || latest.current.stamp !== current.stamp) return;
      const clues = parseCoverRecognition(result);
      setSearch({ clues, snapshot: current.snapshot, stamp: current.stamp }); setMessage('识别完成，请核对 MusicBrainz 资料。');
    } catch (error) { if (!controller.signal.aborted && active.current === controller) setMessage(error.message); }
    finally { if (active.current === controller) { active.current = null; setBusy(false); } }
  };
  const apply = next => {
    if (!search || search.stamp !== latest.current.stamp || !latest.current.ready) throw new Error('作品已变化，请重新识别。');
    latest.current.onApply(next); setSearch(null); setMessage('已补足所选信息，原封面与未选择的内容已保留。');
  };
  return <div className="mt-2 space-y-2" aria-label="封面智能补足" role="region">
    <div className="flex flex-wrap gap-2"><button className="rounded border border-orange-300 bg-orange-50 text-orange-900 px-3 py-2 text-xs disabled:opacity-40" disabled={busy || !ready || !snapshot.coverImage} onClick={identify}>智能补足信息</button>
      {busy && <button className="text-xs underline" onClick={cancel}>取消识别</button>}
      <button className="text-xs underline text-gray-500" onClick={onSettings}>视觉模型设置</button></div>
    <p className="text-xs text-gray-500">识别主封面并搜索 MusicBrainz，核对后补足；已有内容可逐项选择替换。</p>
    <p role="status" className="text-xs text-gray-600">{message}</p>
    {search && <SearchModal isOpen onClose={() => setSearch(null)} onImport={apply} initialSearch={search.clues} supplementSnapshot={search.snapshot} hasCover={!!snapshot.coverImage} hasSecondCover={!!snapshot.coverImageB} />}
  </div>;
}

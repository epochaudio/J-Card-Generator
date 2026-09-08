import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FONT_THEMES } from '../config/fonts.js';
import { PALETTES } from '../config/design.mjs';
import { DIRECTIONS, MAX_INTENT_LENGTH } from './smartDesign.mjs';
import useSmartDesign from './useSmartDesign.jsx';

const button = 'rounded border border-stone-300 px-3 py-1.5 text-xs hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed';
const titleSizes = { compact: '克制', balanced: '均衡', expressive: '醒目' };
function CandidateDetails({ candidate }) {
  return <>
    <p className="text-xs text-stone-600">{FONT_THEMES[candidate.fields.fontTheme].name} · {candidate.fields.paletteId === 'custom' ? 'AI 完整配色' : PALETTES[candidate.fields.paletteId]?.name || '锁定配色'} · {candidate.fields.frontStyle === 'EDITORIAL' ? '编辑左齐' : '经典居中'} · 标题{titleSizes[candidate.fields.titleSize]}</p>
    <p className="text-sm leading-relaxed text-stone-700">{candidate.reason}</p>
    <p className="text-xs text-stone-500">实测标题 {candidate.metrics.titleLines} 行 · {candidate.metrics.backFolded ? '背面紧凑显示' : '背面未启用信息折叠'}</p>
    {candidate.warnings.map(warning => <p key={warning} className="text-xs text-amber-800">{warning}</p>)}
  </>;
}

function PreviewDialog({ candidate, onClose, onApply }) {
  const [panel, setPanel] = useState('all');
  const node = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    node.current.querySelector('button')?.focus();
    const handler = event => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key !== 'Tab') return;
      const buttons = [...node.current.querySelectorAll('button:not(:disabled)')];
      const index = buttons.indexOf(document.activeElement);
      if (event.shiftKey && index <= 0) { event.preventDefault(); buttons.at(-1)?.focus(); }
      else if (!event.shiftKey && index === buttons.length - 1) { event.preventDefault(); buttons[0]?.focus(); }
    };
    const dialog = node.current; dialog.addEventListener('keydown', handler);
    return () => { dialog.removeEventListener('keydown', handler); previous?.focus(); };
  }, []);
  return createPortal(<div className="fixed inset-0 z-[70] bg-stone-950/70 p-3 md:p-8 flex items-center justify-center">
    <section ref={node} role="dialog" aria-modal="true" aria-label="搭配放大预览" className="bg-white rounded-xl w-full max-w-6xl max-h-[92vh] overflow-y-auto p-5 space-y-4 shadow-2xl">
      <div className="flex justify-between items-center gap-3"><h2 className="font-semibold">{candidate.direction ? `${DIRECTIONS[candidate.direction]} · 候选预览` : '生成时的作品对照 · 仅在本地'}</h2><button className={button} onClick={onClose}>关闭预览</button></div>
      <p className="text-xs text-stone-500">候选预览不会写入作品；保存和导出使用已应用的设计。</p>
      <div className="flex flex-wrap gap-2">{[['all', '完整展开图'], ['front', '正面'], ['spine', '脊背'], ['back', '曲目表'], ['shortBack', '折页']].map(([id, label]) => <button key={id} aria-pressed={panel === id} onClick={() => setPanel(id)} className={`${button} ${panel === id ? 'bg-stone-100 border-stone-600' : ''}`}>{label}</button>)}</div>
      <div className="overflow-auto bg-stone-100 rounded p-3"><img alt={panel === 'all' ? '完整磁带展开图' : '所选面板的实际渲染'} src={panel === 'all' ? candidate.preview : candidate.panels[panel]} className="block mx-auto max-w-none" style={panel === 'all' ? { width: '100%', minWidth: 720 } : { height: 680, width: 'auto' }} /></div>
      {candidate.fields && <CandidateDetails candidate={candidate} />}
      {onApply && <button className={`${button} bg-orange-50 text-orange-900 border-orange-300`} onClick={onApply}>应用这套</button>}
    </section>
  </div>, document.body);
}

export default function SmartDesignPanel(props) {
  const design = useSmartDesign(props);
  return <section aria-label="智能搭配" className="border border-stone-200 rounded-xl p-4 bg-stone-50/70 space-y-3">
    <div className="flex items-center justify-between"><h3 className="font-semibold text-sm">智能搭配</h3><span className="text-[11px] text-stone-500">根据素材重新设计</span></div>
    <p className="text-xs text-stone-500 leading-relaxed">只分析封面原图、内容和可用设计资源。当前外观仅在主动锁定时约束 AI。</p>
    <div className="flex gap-4 text-xs text-stone-700">
      <label className="flex gap-1.5 items-center"><input type="checkbox" checked={design.locks.font} onChange={event => design.setLocks(prev => ({ ...prev, font: event.target.checked }))} />锁定字体</label>
      <label className="flex gap-1.5 items-center"><input type="checkbox" checked={design.locks.palette} onChange={event => design.setLocks(prev => ({ ...prev, palette: event.target.checked }))} />锁定配色</label>
    </div>
    <label className="block text-xs text-stone-600">风格要求（可选）<input aria-label="搭配风格要求" maxLength={MAX_INTENT_LENGTH} value={design.intent} onChange={event => design.setIntent(event.target.value)} placeholder="例如：安静、克制，有唱片内页的感觉" className="mt-1 w-full rounded border border-stone-200 bg-white p-2 text-sm" /></label>
    <div className="flex flex-wrap gap-2">
      <button className={`${button} bg-orange-50 border-orange-300 text-orange-900`} disabled={design.busy || !props.ready || !!design.unavailable} onClick={design.generate}>生成三套搭配</button>
      {design.busy && <button className={button} onClick={design.cancel}>取消生成</button>}
      {design.undo && <button className={button} onClick={design.revert} disabled={!props.ready}>撤销本次搭配</button>}
      <button className={button} onClick={props.onSettings}>视觉模型设置</button>
    </div>
    <p className="text-[11px] text-stone-500">AI 自主决定各区域和文字颜色；检查未通过时最多自动修订一次。预览、应用与撤销不调用 AI。</p>
    {design.unavailable && <p className="text-xs text-amber-800">{design.unavailable}</p>}
    <p role="status" aria-live="polite" className="text-xs text-stone-700">{design.busy ? design.status : design.message}</p>
    {design.batch && <div className="space-y-3">
      <button className="w-full flex items-center gap-3 text-left rounded border border-stone-200 bg-white p-2" onClick={() => design.setExpanded(design.batch.baseline)}>
        <img src={design.batch.baseline.preview} alt="生成时的作品对照" className="w-24 h-auto" /><span className="text-xs text-stone-500">生成时的作品对照<br />仅在本地保留 · 点击放大</span>
      </button>
      {design.batch.candidates.map(candidate => <article key={candidate.id} data-smart-candidate={candidate.direction} className="p-3 border border-stone-200 rounded-lg bg-white space-y-2">
        <h4 className="text-sm font-semibold">{DIRECTIONS[candidate.direction]}</h4>
        <button className="block w-full" aria-label={`放大${DIRECTIONS[candidate.direction]}`} onClick={() => design.setExpanded(candidate)}><img src={candidate.preview} alt={`${DIRECTIONS[candidate.direction]}候选展开图`} className="w-full h-auto rounded" /></button>
        <CandidateDetails candidate={candidate} />
        <div className="flex gap-2"><button className={button} onClick={() => design.setExpanded(candidate)}>放大预览</button><button className={`${button} text-orange-900 bg-orange-50`} onClick={() => design.apply(candidate)} disabled={!props.ready}>应用这套</button></div>
      </article>)}
      {!!design.batch.rejected.length && <details className="text-xs text-stone-500"><summary>未采用的候选说明</summary><ul className="list-disc pl-5 space-y-1 mt-2">{design.batch.rejected.map((reason, index) => <li key={index}>{reason}</li>)}</ul></details>}
    </div>}
    {design.expanded && <PreviewDialog key={design.expanded.id || 'baseline'} candidate={design.expanded} onClose={() => design.setExpanded(null)} onApply={design.expanded.fields && props.ready ? () => design.apply(design.expanded) : null} />}
  </section>;
}

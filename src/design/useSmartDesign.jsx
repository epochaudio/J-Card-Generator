import { useLayoutEffect, useRef, useState } from 'react';
import { aiTransport } from '../ai/aiTransport.mjs';
import { resolveProvider } from '../ai/providerConfig.mjs';
import { supportsVision } from '../ai/modelCatalog.mjs';
import { applyDesignFields, buildDesignInput, contentStamp, designChange, designFields, designPrompt, DIRECTIONS, eligibility, parseDesignCandidates, selectDesignCandidates } from './smartDesign.mjs';
import { checkCancelled, prepareDesignImages } from './designMaterials.js';
import { renderDesign, visiblyDifferent } from './renderDesign.jsx';

export default function useSmartDesign({ snapshot, settings, projectIdentity, onApply, ready }) {
  const [locks, setLocks] = useState({ font: false, palette: false });
  const [intent, setIntent] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [batch, setBatch] = useState(null);
  const [message, setMessage] = useState('');
  const [undo, setUndo] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const latest = useRef();
  latest.current = { snapshot, settings, projectIdentity, onApply, ready, locks, intent };
  const request = useRef(null);
  const previous = useRef(null);
  const managedDesign = useRef(null);
  const undoRef = useRef(null);
  undoRef.current = undo;
  const stamp = contentStamp(snapshot);
  const design = JSON.stringify(designFields(snapshot));
  const configuration = JSON.stringify(settings);

  const invalidate = (reason = '') => {
    request.current?.abort(); request.current = null;
    setBusy(false); setStatus(''); setBatch(null); setExpanded(null);
    if (reason) setMessage(reason);
  };
  useLayoutEffect(() => {
    const next = { stamp, design, configuration, projectIdentity, locks: JSON.stringify(locks), intent };
    const old = previous.current;
    if (old) {
      const differentProject = old.projectIdentity !== projectIdentity;
      const manualDesign = old.design !== design && managedDesign.current !== design;
      if (differentProject || old.stamp !== stamp || manualDesign || old.configuration !== configuration || old.locks !== next.locks || old.intent !== intent) {
        invalidate('素材或设置已变化，请重新生成搭配。');
      }
      if (differentProject || (manualDesign && undoRef.current && Object.keys(undoRef.current.after).some(key => designFields(snapshot)[key] !== undoRef.current.after[key]))) setUndo(null);
      if (differentProject) { setLocks({ font: false, palette: false }); setIntent(''); setMessage(''); }
    }
    managedDesign.current = null;
    previous.current = next;
  }, [stamp, design, configuration, projectIdentity, locks, intent]);
  useLayoutEffect(() => () => { request.current?.abort(); }, []);

  const generate = async () => {
    if (request.current || !latest.current.ready) return;
    const current = latest.current;
    const unavailable = eligibility(current.snapshot, current.locks);
    if (unavailable) { setMessage(unavailable); return; }
    try {
      const provider = resolveProvider(current.settings, 'vision');
      if (!supportsVision(provider.id, provider.model)) throw new Error('请在 AI 服务设置中选择已适配的视觉模型。');
    } catch (error) { setMessage(error.message); return; }
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setBatch(null); setExpanded(null); setMessage(''); setStatus('准备设计素材与字体小样…');
    const active = () => { checkCancelled(controller.signal); if (request.current !== controller) throw new Error('设计请求已过期。'); };
    try {
      const input = buildDesignInput(current.snapshot, current.locks, current.intent);
      const images = await prepareDesignImages(current.snapshot, controller.signal); active();
      setStatus('视觉模型正在根据素材设计…');
      const result = await aiTransport.vision(current.settings, designPrompt(input), images, controller.signal); active();
      const parsed = parseDesignCandidates(result, current.snapshot, current.locks);
      const measured = [], rejected = [...parsed.rejected];
      for (const [index, candidate] of parsed.candidates.entries()) {
        active(); setStatus(`检查排版 ${index + 1} / ${parsed.candidates.length}…`);
        const candidateSnapshot = applyDesignFields(current.snapshot, candidate.fields);
        try {
          const rendered = await renderDesign(candidateSnapshot, controller.signal); active();
          if (rendered.failures.length) { rejected.push(`${DIRECTIONS[candidate.direction]}：${rendered.failures.join('；')}`); continue; }
          measured.push({ ...candidate, ...rendered });
        } catch (error) { active(); rejected.push(`${DIRECTIONS[candidate.direction]}：${error.message}`); }
      }
      const selected = selectDesignCandidates(measured, (a, b) => visiblyDifferent(a.signature, b.signature));
      for (const direction of Object.keys(DIRECTIONS)) if (!selected.some(candidate => candidate.direction === direction) && measured.some(candidate => candidate.direction === direction)) rejected.push(`${DIRECTIONS[direction]}：实际效果与其他方案过于接近`);
      active();
      if (!selected.length) { setMessage(`没有通过检查的方案。${rejected.join('；') || '模型没有提供可用组合。'}`); return; }
      setStatus('准备当前作品对照（仅在本地）…');
      const baseline = await renderDesign(current.snapshot, controller.signal); active();
      setBatch({ baseline, candidates: selected, rejected });
      setMessage(selected.length === 3 ? '三套搭配已准备好，预览后选择应用。' : `仅 ${selected.length} 套通过检查，其他方向未能提供有效且不同的组合。`);
    } catch (error) { if (request.current === controller && !controller.signal.aborted) setMessage(error.message); }
    finally { if (request.current === controller) { request.current = null; setBusy(false); setStatus(''); } }
  };

  const apply = candidate => {
    if (!batch?.candidates.includes(candidate) || busy || !ready) return;
    const current = latest.current;
    // Layout-effect invalidation normally handles these; verify again at the write boundary.
    if (previous.current?.stamp !== contentStamp(current.snapshot) || previous.current?.design !== JSON.stringify(designFields(current.snapshot))) { invalidate('作品已变化，请重新生成。'); return; }
    if ((locks.font && candidate.fields.fontTheme !== current.snapshot.fontTheme) || (locks.palette && (candidate.fields.paletteId !== current.snapshot.theme.paletteId || candidate.fields.accent !== current.snapshot.theme.accent))) { invalidate('锁定设置已变化，请重新生成。'); return; }
    const before = designFields(current.snapshot);
    const patch = designChange(before, candidate.fields);
    if (!Object.keys(patch).length) { setMessage('当前作品已使用这套搭配。'); return; }
    managedDesign.current = JSON.stringify({ ...before, ...patch });
    setUndo({ before: Object.fromEntries(Object.keys(patch).map(key => [key, before[key]])), after: patch });
    current.onApply(patch); setMessage(`已应用“${DIRECTIONS[candidate.direction]}”，可撤销本次搭配。`);
  };
  const revert = () => {
    const record = undoRef.current; if (!record || !ready) return;
    const current = latest.current;
    const fields = designFields(current.snapshot);
    if (Object.entries(record.after).some(([key, value]) => fields[key] !== value)) { setUndo(null); setMessage('设计已手动修改，撤销记录已结束。'); return; }
    managedDesign.current = JSON.stringify({ ...fields, ...record.before });
    current.onApply(record.before); setUndo(null); setMessage('已撤销本次搭配，其他内容编辑保留。');
  };
  return { locks, setLocks, intent, setIntent, status, busy, batch, message, undo, expanded, setExpanded, generate, apply, revert,
    cancel: () => { invalidate('已取消智能搭配。'); }, unavailable: eligibility(snapshot, locks) };
}

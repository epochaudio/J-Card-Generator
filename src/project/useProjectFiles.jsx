import { useEffect, useMemo, useRef, useState } from 'react';
import { DRAFT_DELAY_MS, parseProject, projectFilename, serializeProject } from './projectFormat.mjs';
import { projectStorage } from './projectStorage.mjs';

async function checkCoverImages(project) {
  await Promise.all([project.coverImage, project.coverImageB].filter(Boolean).map(source => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('作品中的封面图片损坏，当前作品未改变。'));
    image.src = source;
  })));
  return project;
}

export default function useProjectFiles(snapshot, applySnapshot, resetProject) {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [decision, setDecision] = useState(null);
  const [file, setFile] = useState(null);
  const [savedContent, setSavedContent] = useState(null);
  const [error, setError] = useState('');
  const [draftStatus, setDraftStatus] = useState('');
  const locked = useRef(false);
  const latest = useRef({});
  const draftQueue = useRef(Promise.resolve());
  const draftGeneration = useRef(0);
  const encoded = useMemo(() => {
    try { return { content: serializeProject(snapshot), error: '' }; }
    catch (error) { return { content: null, error: error.message }; }
  }, [snapshot]);
  const dirty = ready && (encoded.error || encoded.content !== savedContent);
  latest.current = { content: encoded.content, encodingError: encoded.error, dirty, snapshot, file, ready, applySnapshot, resetProject };

  const queueDraft = operation => {
    const next = draftQueue.current.then(operation);
    draftQueue.current = next.catch(() => {});
    return next;
  };
  const ask = (title, message, choices) => new Promise(resolve => setDecision({ title, message, choices, resolve }));
  const answer = value => {
    const resolve = decision.resolve;
    setDecision(null);
    resolve(value);
  };
  const clearDraft = async () => {
    draftGeneration.current += 1;
    await queueDraft(() => projectStorage.clearDraft());
    setDraftStatus('');
  };

  useEffect(() => {
    let cancelled = false;
    const initialize = async () => {
      while (!cancelled) {
        try {
          const content = await projectStorage.readDraft();
          if (cancelled) return;
          if (content) {
            const project = await checkCoverImages(parseProject(content));
            if (cancelled) return;
            const response = await ask('恢复上次作品', `发现“${project.data.title || '未命名作品'}”的自动草稿。草稿不会覆盖已保存的作品文件。`, [
              { value: 'restore', label: '恢复草稿' }, { value: 'discard', label: '放弃草稿' }
            ]);
            if (cancelled) return;
            if (response === 'restore') {
              latest.current.applySnapshot(project);
              setSavedContent(null);
              setDraftStatus('已恢复草稿，请保存作品');
            } else {
              await clearDraft();
              setSavedContent(latest.current.content);
            }
          } else setSavedContent(latest.current.content);
          if (!cancelled) setReady(true);
          return;
        } catch (error) {
          if (cancelled) return;
          const response = await ask('草稿暂时无法恢复', error.message, [
            { value: 'retry', label: '重试' }, { value: 'discard', label: '删除草稿并继续' }
          ]);
          if (cancelled) return;
          if (response === 'discard') {
            try {
              await clearDraft(); setSavedContent(latest.current.content); setReady(true); return;
            } catch (failure) { setError(`删除草稿失败：${failure.message}`); }
          }
        }
      }
    };
    void initialize();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ready || !dirty || !encoded.content) return;
    const generation = ++draftGeneration.current;
    setDraftStatus('草稿待保存');
    const timer = setTimeout(() => {
      void queueDraft(async () => {
        if (generation !== draftGeneration.current) return;
        await projectStorage.writeDraft(encoded.content);
        if (generation === draftGeneration.current) setDraftStatus('草稿已自动保存');
      }).catch(error => {
        if (generation === draftGeneration.current) setDraftStatus(`草稿保存失败：${error.message}`);
      });
    }, DRAFT_DELAY_MS);
    return () => { clearTimeout(timer); draftGeneration.current += 1; };
  }, [ready, dirty, encoded.content]);

  const save = async (saveAs = false) => {
    const current = latest.current;
    if (current.encodingError) throw new Error(current.encodingError);
    const result = await projectStorage.save(current.content, projectFilename(current.snapshot.data.title), current.file?.token, saveAs);
    if (!result) return false;
    setFile(result);
    if (result.downloaded) {
      setError('已请求下载作品副本，请在浏览器中确认下载完成。草稿继续保留；切换作品时可选择放弃修改。');
      return false;
    }
    // Remember exactly what reached disk, not edits made while saving.
    setSavedContent(current.content);
    if (latest.current.content === current.content) {
      try { await clearDraft(); } catch (error) { setError(`作品已保存，但清理草稿失败：${error.message}`); }
    }
    return latest.current.content === current.content;
  };

  const mayLeave = async () => {
    if (!latest.current.dirty) return true;
    const choice = await ask('当前作品尚未保存', '保存后继续，或放弃修改。取消会保留当前作品。', [
      { value: 'save', label: '保存并继续' }, { value: 'discard', label: '放弃修改' }, { value: 'cancel', label: '取消' }
    ]);
    if (choice === 'cancel') return false;
    if (choice === 'discard') return true;
    const saved = await save();
    if (!saved && window.electronAPI?.projects) setError('操作已取消，或保存期间作品发生变化；当前作品已保留。');
    return saved;
  };

  const run = async operation => {
    if (locked.current || !latest.current.ready) return;
    locked.current = true; setBusy(true); setError('');
    try { await operation(); } catch (error) { setError(error.message); }
    finally { locked.current = false; setBusy(false); }
  };
  const open = () => run(async () => {
    const result = await projectStorage.open();
    if (!result) return;
    const project = await checkCoverImages(parseProject(result.content));
    if (!await mayLeave()) return;
    await clearDraft();
    latest.current.applySnapshot(project);
    setFile(result);
    setSavedContent(serializeProject(project));
  });
  const createNew = () => run(async () => {
    if (!await mayLeave()) return;
    await clearDraft();
    const project = latest.current.resetProject();
    latest.current.applySnapshot(project);
    setFile(null); setSavedContent(serializeProject(project));
  });
  const close = () => {
    if (!latest.current.ready) { window.electronAPI?.projects.approveClose(); return; }
    return run(async () => {
      let approved = false;
      try {
        if (!await mayLeave()) return;
        await clearDraft();
        approved = true;
        window.electronAPI?.projects.approveClose();
      } finally {
        if (!approved) window.electronAPI?.projects.cancelClose();
      }
    });
  };
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => window.electronAPI?.projects.onCloseRequest(() => closeRef.current()), []);
  useEffect(() => {
    if (window.electronAPI?.projects) return;
    const warn = event => {
      if (latest.current.dirty) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  return { ready, busy, decision, answer, dirty: Boolean(dirty), file, error: error || encoded.error, draftStatus,
    open, createNew, save: saveAs => run(() => save(saveAs)) };
}

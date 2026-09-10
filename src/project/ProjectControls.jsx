import React, { useEffect, useRef } from 'react';
import DisclosureMenu from '../components/DisclosureMenu.jsx';

export default function ProjectControls({ project, onNew, about, children }) {
  const { decision } = project;
  const overlay = useRef(null);
  const blocked = !project.ready || project.busy || Boolean(decision);
  useEffect(() => {
    if (!blocked) return;
    const dialog = overlay.current;
    const previous = document.activeElement;
    (dialog.querySelector('button') || dialog).focus();
    const trap = event => {
      if (event.key !== 'Tab') return;
      const buttons = [...dialog.querySelectorAll('button')];
      if (!buttons.length) { event.preventDefault(); return; }
      const current = buttons.indexOf(document.activeElement);
      event.preventDefault();
      buttons[(current + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus();
    };
    dialog.addEventListener('keydown', trap);
    return () => { dialog.removeEventListener('keydown', trap); previous?.focus(); };
  }, [blocked, decision]);
  return <>
    <div className="flex flex-wrap items-center gap-2 bg-white text-sm min-w-0 flex-1 justify-end">
      <DisclosureMenu label="作品">
      <button onClick={onNew} className="w-full text-left px-3 py-2 rounded hover:bg-gray-50" title="新建/重置项目">新建作品</button>
      <button disabled={!project.ready || project.busy} onClick={project.open} className="w-full text-left px-3 py-2 rounded hover:bg-gray-50 disabled:opacity-40">打开作品</button>
      <button disabled={!project.ready || project.busy} onClick={() => project.save(true)} className="w-full text-left px-3 py-2 rounded hover:bg-gray-50 disabled:opacity-40">另存为</button>
      <details className="mt-3 border-t pt-3 text-xs"><summary className="cursor-pointer">关于带藏</summary>{about}</details>
      </DisclosureMenu>
      <span className="text-gray-600 truncate max-w-xs" title={project.file?.name}>{project.file?.name || '未命名作品'} · {project.dirty ? '未保存修改' : project.file?.downloaded ? '已下载副本' : project.file ? '已保存' : '新作品'}</span>
      <span role="status" className="text-xs text-gray-500">{project.draftStatus}</span>
      <button disabled={!project.ready || project.busy} onClick={() => project.save(false)} className="px-3 py-2 rounded bg-orange-600 text-white disabled:opacity-40">保存作品</button>
      {children}
      {project.error && <span role="alert" className="text-sm text-red-700">{project.error}</span>}
    </div>
    {blocked && <div ref={overlay} tabIndex={-1} className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-6">
      {decision ? <div role="dialog" aria-modal="true" aria-labelledby="project-dialog-title" className="bg-white rounded-xl shadow-xl p-6 max-w-lg w-full text-gray-900">
        <h2 id="project-dialog-title" className="font-bold text-lg">{decision.title}</h2>
        <p className="my-4 text-sm whitespace-pre-wrap break-words">{decision.message}</p>
        <div className="flex gap-3 justify-end flex-wrap">{decision.choices.map((choice, index) => <button autoFocus={index === 0} key={choice.value} onClick={() => project.answer(choice.value)} className="rounded border px-3 py-2 hover:bg-orange-50">{choice.label}</button>)}</div>
      </div> : <div role="status" className="rounded bg-white px-6 py-4">{project.ready ? '正在处理作品…' : '正在检查草稿…'}</div>}
    </div>}
  </>;
}

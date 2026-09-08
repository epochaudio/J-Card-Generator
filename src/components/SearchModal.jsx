import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Database, Loader2, X } from 'lucide-react';
import MusicBrainzService from '../services/MusicBrainzService.js';
import { createRequestScope } from '../musicbrainz/client.mjs';
import { creditText, sortReleases, suggestMode, suggestSplit, SPLIT_RULES } from '../musicbrainz/model.mjs';
import { searchFromCover, uniqueObservedGroup, uniqueObservedVersion } from '../enrichment/coverRecognition.mjs';
import { supplementCandidate, supplementRows, applySupplement } from '../enrichment/supplement.mjs';
import { formatDurationMs } from '../utils/formatDuration.mjs';

const field = 'border border-gray-300 rounded px-3 py-2 bg-white text-sm';
const button = 'border border-gray-300 rounded px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-40';
const emptyPage = { items: [], total: 0, nextOffset: null };
const mergePage = (old, page) => ({ ...page, items: [...new Map([...old.items, ...page.items].map(item => [item.id, item])).values()] });
export default function SearchModal({ isOpen, onClose, onImport, hasCover, hasSecondCover, initialSearch, supplementSnapshot, service = MusicBrainzService }) {
  const scope = useRef(createRequestScope());
  const [selectedFields, setSelectedFields] = useState([]);
  const [query, setQuery] = useState({ album: '', artist: '', broad: false, type: 'Album' });
  const [groups, setGroups] = useState(emptyPage);
  const [versions, setVersions] = useState(emptyPage);
  const [group, setGroup] = useState(null);
  const [preview, setPreview] = useState(null);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [fetchCover, setFetchCover] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState([]);
  const [capacity, setCapacity] = useState(SPLIT_RULES.defaultCapacityMinutes);
  const [splitIndex, setSplitIndex] = useState(0);
  const [preserveSides, setPreserveSides] = useState(true);
  const [mode, setMode] = useState('STANDARD');
  const [artist, setArtist] = useState('');
  const [dateDisplay, setDateDisplay] = useState('edition');
  const [coverAction, setCoverAction] = useState('clear');
  const [secondCoverAction, setSecondCoverAction] = useState('clear');
  useEffect(() => {
    if (!isOpen) { scope.current.cancel(); setBusy(false); setPreview(null); setGroup(null); setGroups(emptyPage); setVersions(emptyPage); setSearched(false); setError(''); }
    return () => scope.current.cancel();
  }, [isOpen]);
  const close = () => { scope.current.cancel(); onClose(); };
  useEffect(() => {
    if (!isOpen) return;
    const escape = event => { if (event.key === 'Escape') close(); };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [isOpen, onClose]);
  const tracks = useMemo(() => preview?.release.tracks.filter(t => selectedMedia.includes(t.musicbrainz.mediumPosition)) || [], [preview, selectedMedia]);
  const suggested = useMemo(() => suggestSplit(tracks, capacity, preserveSides), [tracks, capacity, preserveSides]);
  useEffect(() => setSplitIndex(suggested.index), [suggested]);
  const totalA = tracks.slice(0, splitIndex).reduce((sum, t) => sum + (t.musicbrainz.durationMs || 0), 0);
  const totalB = tracks.slice(splitIndex).reduce((sum, t) => sum + (t.musicbrainz.durationMs || 0), 0);
  const splitWork = splitIndex > 0 && splitIndex < tracks.length && tracks[splitIndex - 1]._workId && tracks[splitIndex - 1]._workId === tracks[splitIndex]._workId;
  async function run(task, apply) {
    const request = scope.current.begin();
    setBusy(true); setError(''); setProgress('正在读取资料…');
    try {
      const result = await task(request.signal, message => { if (request.isCurrent()) setProgress(message); });
      if (request.isCurrent()) apply(result);
    } catch (e) { if (request.isCurrent() && e.name !== 'AbortError') setError(e.message || '读取失败，当前作品未改变。'); }
    finally { if (request.isCurrent()) { setBusy(false); setProgress(''); } }
  }
  const search = (more = false) => {
    if (!query.album.trim() && !query.artist.trim()) return;
    setPreview(null); setGroup(null);
    if (!more) setGroups(emptyPage);
    run(signal => service.searchReleaseGroup(query.album, query.artist, { ...query, offset: more ? groups.nextOffset : 0, signal }), page => { setGroups(old => more ? mergePage(old, page) : page); setSearched(true); });
  };
  const selectGroup = (chosen, more = false) => {
    setGroup(chosen); setPreview(null);
    if (!more) setVersions(emptyPage);
    run(signal => service.getReleases(chosen.id, { offset: more ? versions.nextOffset : 0, signal }), page => setVersions(old => ({ ...(more ? mergePage(old, page) : page), items: sortReleases(more ? mergePage(old, page).items : page.items) })));
  };
  const readVersion = async (version, chosenGroup, signal, onProgress, includeCover = fetchCover) => {
    const release = await service.getReleaseDetails(version.id, { signal, onProgress });
    onProgress('正在读取封面…');
    const cover = includeCover ? await service.getCoverArt(version.id, chosenGroup.id, { signal }) : { image: null, sourceReleaseId: '', fallback: false, status: 'skipped' };
    if (cover.image) {
      const image = new Image(); image.src = cover.image; await image.decode();
    }
    return { release, cover };
  };
  const showPreview = result => {
    setPreview(result); setSelectedMedia(result.release.media.map((m, i) => m.position || i + 1));
    setMode(suggestMode(result.release, result.release.tracks)); setArtist(creditText(result.release['artist-credit']));
    setDateDisplay('edition'); setCoverAction(supplementSnapshot ? 'keep' : result.cover.image ? 'replace' : 'clear'); setSecondCoverAction(supplementSnapshot ? 'keep' : 'clear');
  };
  const selectVersion = version => run((signal, progress) => readVersion(version, group, signal, progress, supplementSnapshot ? false : fetchCover), showPreview);
  const applyImport = () => {
    try {
      const selection = { ...preview, group, tracks, splitIndex, capacityMinutes: capacity, mode, artist, dateDisplay, coverAction, secondCoverAction };
      if (supplementSnapshot) onImport(applySupplement(supplementSnapshot, supplementCandidate(supplementSnapshot, selection), selectedFields));
      else onImport(selection);
      close();
    } catch (e) { setError(e.message || '导入资料无效，当前作品未改变。'); }
  };
  const supplement = useMemo(() => {
    if (!supplementSnapshot || !preview || !tracks.length) return { rows: [], error: '' };
    try { return { rows: supplementRows(supplementSnapshot, supplementCandidate(supplementSnapshot, { ...preview, group, tracks, splitIndex, capacityMinutes: capacity, mode, artist, dateDisplay })), error: '' }; }
    catch (error) { return { rows: [], error: error.message }; }
  }, [supplementSnapshot, preview, group, tracks, splitIndex, capacity, mode, artist, dateDisplay]);
  useEffect(() => {
    if (preview && supplementSnapshot) setSelectedFields(supplement.rows.filter(row => row.empty && row.available && row.different).map(row => row.key));
  }, [preview, supplementSnapshot]);
  useEffect(() => {
    if (!isOpen || !initialSearch) return;
    setFetchCover(false); setPreview(null); setGroup(null); setGroups(emptyPage); setVersions(emptyPage);
    setQuery({ album: initialSearch.album, artist: initialSearch.artist, broad: false, type: 'Album' });
    run(async (signal, progress) => {
      const result = await searchFromCover(service, initialSearch, signal, progress);
      const chosen = uniqueObservedGroup(result.page, initialSearch);
      if (!chosen) return result;
      progress('已找到匹配专辑，正在核对发行版本…');
      const releases = await service.getReleases(chosen.id, { signal, offset: 0 });
      const version = uniqueObservedVersion(releases, initialSearch);
      return { ...result, chosen, releases, detail: version ? await readVersion(version, chosen, signal, progress, false) : null };
    }, result => {
      setQuery(result.query); setGroups(result.page); setSearched(true);
      if (result.chosen) { setGroup(result.chosen); setVersions({ ...result.releases, items: sortReleases(result.releases.items) }); }
      if (result.detail) showPreview(result.detail);
    });
  }, [isOpen, initialSearch]);
  const summarizeValue = value => typeof value === 'string' ? value || '（空）' : Array.isArray(value) ? value.map(track => `${track.side || ''} ${track.title} ${track.duration || ''}`).join('；') || '（空）' : Object.entries(value || {}).filter(([, items]) => Array.isArray(items) && items.length).map(([key, items]) => `${({composers:'作曲',performers:'演奏／演唱',conductors:'指挥',producers:'制作',engineers:'录音',roles:'完整关系'})[key] || '署名'}: ${items.map(item => typeof item === 'string' ? item : item.name || item.type || '').join(' / ')}`).join('；') || '（空）';
  if (!isOpen) return null;
  return <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="MusicBrainz 搜索与导入">
    <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col text-gray-800">
      <div className="flex justify-between items-center px-5 py-4 border-b"><h3 className="font-semibold flex gap-2 items-center"><Database size={18} />MusicBrainz · {preview ? '核对导入' : group ? '选择发行版本' : '搜索专辑'}</h3><button aria-label="关闭 MusicBrainz" onClick={close}><X size={20} /></button></div>
      <div className="p-5 overflow-auto space-y-4">
        {initialSearch && <div className="text-sm bg-amber-50 rounded p-3 space-y-1">
          <p>封面识别仅作为搜索线索，以下数据库资料仍需核对。</p>
          <p>模型读到：{[initialSearch.observed.album, initialSearch.observed.artist, initialSearch.observed.label, initialSearch.observed.catalogNumber].filter(Boolean).join(' · ') || '无清晰文字'}</p>
          {!!(initialSearch.inferred.album || initialSearch.inferred.artist) && <p>推测（未经确认）：{[initialSearch.inferred.album, initialSearch.inferred.artist].filter(Boolean).join(' · ')}</p>}
          {initialSearch.notes && <p>{initialSearch.notes}</p>}
          <p>可修改下方搜索词继续查找；补足时保留当前封面。</p>
        </div>}
        <form onSubmit={event => { event.preventDefault(); search(); }} className="space-y-2">
          <div className="flex flex-wrap gap-2"><input aria-label="搜索专辑标题" className={`${field} flex-1 min-w-40`} value={query.album} onChange={e => { scope.current.cancel(); setBusy(false); setSearched(false); setGroups(emptyPage); setGroup(null); setPreview(null); setQuery({ ...query, album: e.target.value }); }} placeholder="专辑标题" /><input aria-label="搜索艺术家" className={`${field} flex-1 min-w-40`} value={query.artist} onChange={e => { scope.current.cancel(); setBusy(false); setSearched(false); setGroups(emptyPage); setGroup(null); setPreview(null); setQuery({ ...query, artist: e.target.value }); }} placeholder="艺术家 / 演奏者" /><button className={button} disabled={busy}>搜索</button></div>
          <div className="flex flex-wrap gap-4 text-xs text-gray-600"><label><input type="checkbox" checked={query.broad} onChange={e => { scope.current.cancel(); setBusy(false); setGroups(emptyPage); setGroup(null); setPreview(null); setSearched(false); setQuery({ ...query, broad: e.target.checked }); }} /> 宽松搜索（仍核对所有词）</label><span>搜索范围：专辑；不包含 EP、单曲</span></div>
        </form>
        {busy && <p role="status" className="text-sm flex gap-2"><Loader2 className="animate-spin" size={16} />{progress}</p>}
        {error && <p role="alert" className="p-3 bg-red-50 text-red-700 rounded">{error}</p>}
        {!group && !preview && <div className="space-y-2">
          {searched && !busy && !groups.items.length && <p>没有找到候选，请尝试别名或宽松搜索。</p>}
          {groups.items.map(item => <button key={item.id} disabled={busy} onClick={() => selectGroup(item)} className={`${button} text-left block w-full`}><strong>{item.title}</strong><span className="block text-sm">{creditText(item['artist-credit'])}</span><span className="block text-xs text-gray-500">首发：{item['first-release-date'] || '未知'} · {item.match}</span></button>)}
          {groups.nextOffset != null && <button className={button} disabled={busy} onClick={() => search(true)}>加载更多专辑（已显示 {groups.items.length} / {groups.total}）</button>}
        </div>}
        {group && !preview && <div className="space-y-3">
          <button className={button} disabled={busy} onClick={() => setGroup(null)}>返回专辑列表</button>
          <div><strong>{group.title}</strong><p className="text-sm">{creditText(group['artist-credit'])}</p><p className="text-xs text-gray-500">专辑首发：{group['first-release-date'] || '未知'}。下列是不同发行版本；当前已加载版本按官方发行优先、日期从早到晚排列，不自动代选。</p></div>
          {!supplementSnapshot && <label className="text-sm block"><input type="checkbox" checked={fetchCover} disabled={busy} onChange={e => setFetchCover(e.target.checked)} /> 读取封面（封面服务不可用时可关闭后重试）</label>}
          {!busy && !versions.items.length && <p>没有可用发行版本。</p>}
          {versions.items.map(item => <button className={`${button} w-full text-left`} disabled={busy} key={item.id} onClick={() => selectVersion(item)}><strong>{item.date || '日期未知'} · {item.country || '地区未知'} · {item.status || '状态未知'}</strong><span className="block">{item.media?.map(m => `${m.format || '介质未知'} ${m['track-count'] ?? '?'} 曲`).join(' / ') || '曲目数待读取'} {item.disambiguation}</span><span className="block text-xs text-gray-500">{item['label-info']?.map(l => [l.label?.name, l['catalog-number']].filter(Boolean).join(' ')).join(' / ') || '厂牌 / 编号未提供'}</span><span className="block text-xs text-gray-500">{creditText(item['artist-credit'])}</span></button>)}
          {versions.nextOffset != null && <button className={button} disabled={busy} onClick={() => selectGroup(group, true)}>加载更多版本（已显示 {versions.items.length} / {versions.total}）</button>}
        </div>}
        {preview && <div className="space-y-4">
          <button className={button} onClick={() => setPreview(null)}>返回发行版本</button>
          <div className="flex gap-4"><div className="w-28 shrink-0">{(supplementSnapshot?.coverImage || preview.cover.image) ? <img alt={supplementSnapshot ? "保留的原封面" : "待导入封面"} src={supplementSnapshot?.coverImage || preview.cover.image} className="w-full rounded" /> : <div className="bg-gray-100 p-4 text-sm">{preview.cover.status === 'skipped' ? '已跳过封面读取' : '未找到封面'}</div>}</div><div className="space-y-1"><strong>{preview.release.title}</strong><p className="text-sm">完整署名：{creditText(preview.release['artist-credit'])}</p><p className="text-sm">作曲者：{preview.release.credits.composers.join(' / ') || '未提供明确关系'}</p><p className="text-sm">演奏 / 演唱者：{preview.release.credits.performers.join(' / ') || '未提供明确关系'}</p><p className="text-sm">指挥：{preview.release.credits.conductors.join(' / ') || '未提供明确关系'}</p></div></div>
          {preview.cover.fallback && <p className="bg-amber-50 p-2 text-sm">封面回退到专辑组，可能与所选发行版本不同。{preview.cover.sourceReleaseId ? <a className="underline" href={`https://musicbrainz.org/release/${preview.cover.sourceReleaseId}`} target="_blank" rel="noreferrer">查看来源版本</a> : <span>封面服务未提供具体来源版本。</span>}</p>}
          {supplementSnapshot && <fieldset className="border rounded p-3 space-y-3 text-sm"><legend>选择要补足的字段</legend>
            <p>仅空字段默认勾选；已有内容需明确选择替换。未勾选字段与两张封面保持原样。部分补足不会将保留的曲目归属到新发行版本。</p>
            {supplement.error && <p role="alert" className="text-red-700">{supplement.error}</p>}
            {supplement.rows.map(row => <div key={row.key} className="border-t pt-2"><label className="font-medium"><input type="checkbox" aria-label={`补足${row.label}`} disabled={!row.available || !row.different} checked={selectedFields.includes(row.key)} onChange={event => setSelectedFields(old => event.target.checked ? [...old, row.key] : old.filter(key => key !== row.key))} /> {row.label}{!row.available ? '（数据库未提供）' : !row.different ? '（相同）' : row.empty ? '（补充空字段）' : '（替换需勾选）'}</label><p className="break-words max-h-24 overflow-auto text-gray-500">当前：{summarizeValue(row.before)}</p><p className="break-words max-h-24 overflow-auto">新值：{summarizeValue(row.after)}</p></div>)}
          </fieldset>}
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <label>正面与脊背署名<input aria-label="导入显示署名" className={`${field} w-full`} value={artist} onChange={e => setArtist(e.target.value)} /><button className="underline text-xs mr-3" onClick={() => setArtist(creditText(preview.release['artist-credit']))}>使用完整署名</button>{preview.release.credits.performers.length > 0 && <button className="underline text-xs" onClick={() => setArtist(preview.release.credits.performers.join(' / '))}>使用明确演奏者</button>}</label>
            <label>成品显示日期<select aria-label="导入日期类型" className={`${field} w-full`} value={dateDisplay} onChange={e => setDateDisplay(e.target.value)}><option value="edition">此版本：{preview.release.date || '未知'}</option><option value="first">专辑首发：{group['first-release-date'] || '未知'}</option></select></label>
            {!supplementSnapshot && <label>主封面<select aria-label="导入主封面" className={`${field} w-full`} value={coverAction} onChange={e => setCoverAction(e.target.value)}>{preview.cover.image && <option value="replace">替换为待导入封面</option>}<option value="clear">清空（显示无图）</option>{hasCover && <option value="keep">明确保留当前主封面</option>}</select></label>}
            {!supplementSnapshot && <label>第二封面<select aria-label="导入第二封面" className={`${field} w-full`} value={secondCoverAction} onChange={e => setSecondCoverAction(e.target.value)}><option value="clear">清空第二封面</option>{hasSecondCover && <option value="keep">明确保留当前第二封面</option>}</select></label>}
            <label>内容模式<select aria-label="导入内容模式" className={`${field} w-full`} value={mode} onChange={e => setMode(e.target.value)}><option value="STANDARD">普通曲目</option><option value="CLASSICAL">古典作品</option><option value="COMPILATION">合辑</option></select></label>
            <label>每面容量（分钟）<input aria-label="每面容量" type="number" min={SPLIT_RULES.minCapacityMinutes} max={SPLIT_RULES.maxCapacityMinutes} className={`${field} w-full`} value={capacity} onChange={e => setCapacity(Math.max(SPLIT_RULES.minCapacityMinutes, Math.min(SPLIT_RULES.maxCapacityMinutes, Number(e.target.value) || SPLIT_RULES.minCapacityMinutes)))} /></label>
          </div>
          <fieldset className="text-sm"><legend>导入碟片（保留原碟号与曲序）</legend>{preview.release.media.map((m, i) => { const pos = m.position || i + 1; return <label className="block" key={pos}><input type="checkbox" checked={selectedMedia.includes(pos)} onChange={e => setSelectedMedia(old => e.target.checked ? [...old, pos] : old.filter(n => n !== pos))} /> 第 {pos} 碟 · {m.format || '介质未知'} · {m.title || ''} · {m.tracks.length} 曲</label>; })}</fieldset>
          <label className="text-sm block"><input type="checkbox" checked={preserveSides} onChange={e => setPreserveSides(e.target.checked)} /> 有明确 A/B 曲号时优先保留原分面</label>
          <label className="text-sm block">分面位置<select aria-label="分面位置" className={`${field} ml-3`} value={splitIndex} onChange={e => setSplitIndex(Number(e.target.value))}>{Array.from({ length: tracks.length + 1 }, (_, i) => <option key={i} value={i}>{i === 0 ? '全部放在 B 面' : `第 ${i} 曲后转 B 面`}</option>)}</select></label>
          <p className="text-sm">A 面 {formatDurationMs(totalA)} ／ B 面 {formatDurationMs(totalB)}（每面 {capacity} 分钟）</p>
          {totalA > capacity * SPLIT_RULES.millisecondsPerMinute || totalB > capacity * SPLIT_RULES.millisecondsPerMinute ? <p role="alert" className="text-red-700">超出每面容量，请调整曲目或分面；无法按当前方案导入。</p> : null}
          {splitWork && <p className="text-amber-700 text-sm">分面跨越同一作品，请确认这是你需要的乐章分面位置。</p>}
          {!preview.release.tracks.some(t => t.musicbrainz.workPaths.length) && <p className="text-gray-500 text-sm">数据库未提供录音与作品关系，将保留原曲目标题；可手动选择内容模式。</p>}
          {preview.release.warnings.map(w => <p className="text-amber-700 text-sm" key={w}>{w}</p>)}
          <ol className="text-sm max-h-52 overflow-auto border rounded p-3 space-y-1">{tracks.map((t, i) => <li key={t.id}><span className="text-gray-500">{i < splitIndex ? 'A' : 'B'} · 碟 {t.musicbrainz.mediumPosition} / {t.musicbrainz.trackNumber} </span>{t.title} <span className="text-gray-500">{t.duration || '时长未知'}</span></li>)}</ol>
          {!supplementSnapshot && <p className="text-xs text-gray-500">将替换当前曲目、专辑信息和演职员，清理旧封面文案及图片提示；保留设计样式、设备与录音日期。两个封面按上方选择处理。完整署名和来源日期会随作品保存。</p>}

          <button className="bg-orange-700 text-white rounded px-4 py-2 disabled:opacity-40" disabled={busy || (supplementSnapshot && (!!supplement.error || !supplement.rows.some(row => selectedFields.includes(row.key) && row.available && row.different))) || !tracks.length || !artist.trim() || totalA > capacity * SPLIT_RULES.millisecondsPerMinute || totalB > capacity * SPLIT_RULES.millisecondsPerMinute} onClick={applyImport}>{supplementSnapshot ? '确认补足信息' : `确认导入 ${tracks.length} 首曲目`}</button>
        </div>}
      </div>
    </div>
  </div>;
}

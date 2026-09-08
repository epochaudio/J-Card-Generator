import { formatDurationMs } from '../utils/formatDuration.mjs';
export const PAGE_SIZE = 25;
export const SPLIT_RULES = { defaultCapacityMinutes: 45, minCapacityMinutes: 1, maxCapacityMinutes: 120, millisecondsPerMinute: 60000 };
export const CLASSIFICATION_RULES = { classicalTitleRatio: 0.5 };
export const WORK_RULES = { maxLookups: 64, maxDepth: 6, cacheMs: 600000 };
export const creditText = credits => (credits || []).map(a => `${a.name || a.artist?.name || ''}${a.joinphrase || ''}`).join('');
export const creditList = credits => (credits || []).map(a => ({ id: a.artist?.id || '', name: a.name || a.artist?.name || '', joinphrase: a.joinphrase || '' }));
export const normalizedText = text => String(text || '').normalize('NFKC').toLocaleLowerCase().replace(/[\p{P}\p{Z}\s]/gu, '');
export const quoteQuery = text => `"${String(text).trim().replace(/([+\-!(){}\[\]^"~*?:\\/])/g, '\\$1')}"`;
export function searchExpression(album, artist, broad = false, type = 'Album') {
  const phrase = (field, text) => broad
    ? `${field}:(${text.trim().split(/\s+/).map(quoteQuery).join(' AND ')})`
    : `${field}:${quoteQuery(text)}`;
  return [type === 'Album' ? 'primarytype:Album' : '', album.trim() ? phrase('releasegroup', album) : '', artist.trim() ? phrase('artist', artist) : ''].filter(Boolean).join(' AND ');
}
export function rankGroups(groups, album, artist) {
  return groups.map(group => {
    const exactTitle = !album.trim() || [group.title, ...(group.aliases || []).map(a => a.name)].some(title => normalizedText(title) === normalizedText(album));
    const exactArtist = !artist.trim() || normalizedText(creditText(group['artist-credit'])) === normalizedText(artist) || (group['artist-credit'] || []).some(a => [a.name, a.artist?.name, ...(a.artist?.aliases || []).map(alias => alias.name)].some(name => normalizedText(name) === normalizedText(artist)));
    return { ...group, match: exactTitle && exactArtist ? '标题与艺术家匹配' : '宽松候选，请核对标题与艺术家', exactMatch: exactTitle && exactArtist };
  }).sort((a, b) => Number(b.exactMatch) - Number(a.exactMatch) || Number(b.score || 0) - Number(a.score || 0) || a.id.localeCompare(b.id));
}
export function sortReleases(releases) {
  return [...releases].sort((a, b) => Number(b.status === 'Official') - Number(a.status === 'Official') || (a.date || '9999').localeCompare(b.date || '9999') || a.id.localeCompare(b.id));
}
export function validateRelease(data, expectedId) {
  if (data.id !== expectedId || typeof data.title !== 'string' || !data.title.trim() || !Array.isArray(data['artist-credit']) || !creditText(data['artist-credit']).trim() || !Array.isArray(data.media) || !data.media.length) throw new Error('发行资料缺少标题、署名或碟片信息，无法导入。');
  let count = 0;
  for (const medium of data.media) {
    if (!Array.isArray(medium.tracks) || (Number.isInteger(medium['track-count']) && medium.tracks.length !== medium['track-count'])) throw new Error('发行资料的曲目列表不完整，无法导入。');
    for (const track of medium.tracks) {
      if (!track || typeof track.title !== 'string' || !track.title.trim()) throw new Error('曲目标题无效，无法导入。');
      const duration = track.length ?? track.recording?.length;
      if (duration != null && (typeof duration !== 'number' || !Number.isFinite(duration) || duration < 0)) throw new Error('曲目时长无效，无法导入。');
      count++;
    }
  }
  if (!count) throw new Error('此发行版没有可导入的曲目。');
  return data;
}
export function parseCredits(data, workMap = new Map()) {
  const roles = [];
  const add = (relation, role) => {
    if (!relation.artist?.name) return;
    const item = { id: relation.artist.id || '', name: relation.artist.name, role, attributes: relation.attributes || [] };
    if (!roles.some(r => JSON.stringify(r) === JSON.stringify(item))) roles.push(item);
  };
  const scan = relations => (relations || []).forEach(r => {
    if (['producer', 'engineer', 'mix', 'mastering', 'recording', 'conductor', 'instrument', 'vocal', 'performer', 'composer', 'writer', 'lyricist'].includes(r.type)) add(r, r.type);
  });
  scan(data.relations);
  data.media?.forEach(m => m.tracks?.forEach(t => { scan(t.recording?.relations); t.recording?.relations?.forEach(r => r.work && scan(r.work.relations)); }));
  workMap.forEach(work => scan(work.relations));
  const names = types => [...new Set(roles.filter(r => types.includes(r.role)).map(r => r.name))];
  return { roles, producers: names(['producer']), engineers: names(['engineer', 'mix', 'mastering', 'recording']), performers: names(['conductor', 'instrument', 'vocal', 'performer']), composers: names(['composer']), conductors: names(['conductor']) };
}
export const parentsOf = work => (work?.relations || []).filter(r => r['target-type'] === 'work' && r.type === 'parts' && r.direction === 'backward' && r.work?.id).map(r => r.work);
export function workPaths(work, workMap, visited = new Set()) {
  if (visited.has(work.id) || visited.size >= WORK_RULES.maxDepth) return { paths: [[work]], incomplete: true };
  const complete = workMap.get(work.id) || work;
  const parents = parentsOf(complete);
  if (!parents.length) return { paths: [[complete]], incomplete: !workMap.has(work.id) };
  const seen = new Set([...visited, work.id]);
  const next = parents.map(parent => workPaths(parent, workMap, seen));
  return { paths: next.flatMap(result => result.paths.map(p => [complete, ...p])), incomplete: next.some(result => result.incomplete) || !workMap.has(work.id) };
}
export function normalizeRelease(data, workMap = new Map()) {
  const warnings = new Set();
  const works = new Map();
  const tracks = data.media.flatMap((m, mi) => m.tracks.map((t, ti) => {
    const directWorks = (t.recording?.relations || []).filter(r => r['target-type'] === 'work' && r.work?.id).map(r => r.work);
    const resolved = directWorks.map(w => workPaths(w, workMap));
    if (resolved.some(r => r.incomplete)) warnings.add('部分作品层级缺失或达到查询上限，保留原曲名供核对。');
    const paths = resolved.flatMap(r => r.paths);
    const roots = [...new Map(paths.map(p => [p.at(-1).id, p.at(-1)])).values()];
    const canGroup = roots.length === 1 && !resolved.some(r => r.incomplete);
    if (roots.length > 1) warnings.add('部分录音关联多个作品，保留全部关系，不自动合并为单一作品。');
    const root = canGroup ? roots[0] : null;
    const composers = [...new Set(paths.flat().flatMap(w => (w.relations || []).filter(r => r.type === 'composer' && r.artist).map(r => r.artist.name)))];
    const durationMs = t.length ?? t.recording?.length ?? null;
    if (durationMs == null) warnings.add('部分曲目缺少时长，容量计算不完整；请核对分面。');
    const id = `mb-${data.id}-${mi + 1}-${ti + 1}`;
    if (root) {
      if (!works.has(root.id)) works.set(root.id, { id: root.id, title: root.title, composer: composers.join(' / '), tracks: [] });
      works.get(root.id).tracks.push(id);
    }
    return { id, title: t.title, artist: creditText(t['artist-credit']?.length ? t['artist-credit'] : t.recording?.['artist-credit']?.length ? t.recording['artist-credit'] : data['artist-credit']), duration: durationMs == null ? '' : formatDurationMs(durationMs), note: '',
      _workId: root?.id || '', _workTitle: root?.title || '', _workComposer: root ? composers.join(' / ') : '',
      musicbrainz: { trackId: t.id || '', recordingId: t.recording?.id || '', mediumPosition: m.position || mi + 1, mediumTitle: m.title || '', mediumFormat: m.format || '', trackPosition: t.position || ti + 1, trackNumber: String(t.number || ti + 1), durationMs,
        artistCredit: creditList(t['artist-credit']?.length ? t['artist-credit'] : t.recording?.['artist-credit'] || []),
        workPaths: paths.map(p => p.map(w => ({ id: w.id, title: w.title || '', composers: (w.relations || []).filter(r => r.type === 'composer' && r.artist).map(r => ({ id: r.artist.id || '', name: r.artist.name })) }))) }
    };
  }));
  return { tracks, works: [...works.values()], credits: parseCredits(data, workMap), warnings: [...warnings] };
}
export function suggestMode(data, tracks = []) {
  const group = data['release-group'] || {};
  const tags = [...(data.tags || []), ...(group.tags || [])].map(t => t.name?.toLowerCase());
  if (tags.some(t => ['classical', 'baroque', 'classical music', '古典'].includes(t))) return 'CLASSICAL';
  if ((group['secondary-types'] || []).includes('Compilation') || (data['artist-credit'] || []).some(a => a.artist?.id === '89ad4ac3-39f7-470e-963a-56509c546377' || a.name === 'Various Artists')) return 'COMPILATION';
  // Specific forms/catalogue identifiers are hints; work presence and key names are not genres.
  const classical = /\b(?:sonata|concerto|symphony|BWV\s*\d|HWV\s*\d)\b|交响曲|协奏曲|奏鸣曲/i;
  return tracks.length && tracks.filter(t => classical.test(t.title || '')).length / tracks.length >= CLASSIFICATION_RULES.classicalTitleRatio ? 'CLASSICAL' : 'STANDARD';
}
export function suggestSplit(tracks, capacityMinutes = SPLIT_RULES.defaultCapacityMinutes, preserveOriginalSides = true) {
  if (!tracks.length) return { index: 0, warnings: ['请选择需要导入的碟片。'], totalA: 0, totalB: 0 };
  const times = tracks.map(t => t.musicbrainz?.durationMs ?? 0);
  const total = times.reduce((s, n) => s + n, 0);
  const cap = capacityMinutes * SPLIT_RULES.millisecondsPerMinute;
  const warnings = [];
  const sideLabels = tracks.map(t => t.musicbrainz?.trackNumber?.match(/^([AB])\d/i)?.[1]?.toUpperCase());
  const originalBoundary = sideLabels.indexOf('B');
  let index;
  if (preserveOriginalSides && originalBoundary > 0 && sideLabels.slice(0, originalBoundary).every(s => s === 'A') && sideLabels.slice(originalBoundary).every(s => s === 'B')) index = originalBoundary;
  else {
    let running = 0;
    const candidates = [];
    for (let i = 1; i <= tracks.length; i++) {
      running += times[i - 1];
      const sameWork = i < tracks.length && tracks[i - 1]._workId && tracks[i - 1]._workId === tracks[i]._workId;
      candidates.push({ index: i, sameWork, overflow: Math.max(0, running - cap) + Math.max(0, total - running - cap), balance: Math.abs(total - 2 * running) });
    }
    candidates.sort((a, b) => a.overflow - b.overflow || Number(a.sameWork) - Number(b.sameWork) || a.balance - b.balance || a.index - b.index);
    index = candidates[0].index;
  }
  const totalA = times.slice(0, index).reduce((s, n) => s + n, 0), totalB = total - totalA;
  if (totalA > cap || totalB > cap) warnings.push('所选曲目超出每面容量，请减少碟片或调整分面。');
  if (index < tracks.length && tracks[index - 1]._workId && tracks[index - 1]._workId === tracks[index]._workId) warnings.push('当前分面跨越同一作品，请核对乐章连续性。');
  if (tracks.some(t => t.musicbrainz?.durationMs == null)) warnings.push('存在缺失时长，容量结果仅供参考。');
  return { index, totalA, totalB, warnings };
}

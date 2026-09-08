import { normalizeSnapshot, serializeProject } from '../project/projectFormat.mjs';
import { createImportSnapshot } from '../musicbrainz/importProject.mjs';

export const SUPPLEMENT_FIELDS = { title: '专辑标题', artist: '艺术家', releaseDate: '发行日期', tapeSubtitle: '厂牌／目录信息', credits: '演职员资料', tracks: '曲目、分面与内容模式' };
const empty = value => value == null || (typeof value === 'string' ? !value.trim() : Array.isArray(value) ? !value.length : typeof value === 'object' && Object.values(value).every(empty));
const valueFor = (snapshot, key) => key === 'credits' ? snapshot.recordingData.credits : key === 'tracks' ? [...snapshot.data.sideA.map(track => ({ ...track, side: 'A' })), ...snapshot.data.sideB.map(track => ({ ...track, side: 'B' }))] : snapshot.data[key];
export function supplementCandidate(current, selection) {
  return createImportSnapshot(current, { ...selection, coverAction: 'keep', secondCoverAction: 'keep' });
}
export function supplementRows(current, candidate) {
  return Object.entries(SUPPLEMENT_FIELDS).map(([key, label]) => {
    const before = valueFor(current, key), after = valueFor(candidate, key);
    return { key, label, before, after, empty: empty(before), available: !empty(after), different: JSON.stringify(before) !== JSON.stringify(after) || (key === 'tracks' && (current.data.layout.mode !== candidate.data.layout.mode || JSON.stringify(current.data.layout.worksData) !== JSON.stringify(candidate.data.layout.worksData))) };
  });
}
export function applySupplement(current, candidate, selected) {
  if (!Array.isArray(selected) || selected.some(key => !Object.hasOwn(SUPPLEMENT_FIELDS, key))) throw new Error('补足字段无效。');
  const rows = supplementRows(current, candidate);
  const keys = new Set(selected);
  if (!rows.some(row => keys.has(row.key) && row.available && row.different)) throw new Error('请选择需要补足或替换的字段。');
  const next = { ...current, data: { ...current.data, layout: { ...current.data.layout } }, recordingData: { ...current.recordingData } };
  for (const row of rows.filter(row => keys.has(row.key))) {
    if (!row.available) throw new Error('数据库未提供该字段，不能清空已有资料。');
    if (row.key === 'credits') next.recordingData.credits = candidate.recordingData.credits;
    else if (row.key === 'tracks') {
      next.data.sideA = candidate.data.sideA; next.data.sideB = candidate.data.sideB;
      next.data.layout.mode = candidate.data.layout.mode; next.data.layout.worksData = candidate.data.layout.worksData;
    } else next.data[row.key] = candidate.data[row.key];
  }
  // Do not attribute retained tracks or another title to the selected release.
  const same = key => JSON.stringify(next.data[key]) === JSON.stringify(candidate.data[key]);
  if (['title', 'artist', 'sideA', 'sideB', 'releaseDate'].every(same)) next.data.musicbrainz = candidate.data.musicbrainz;
  else if (rows.some(row => keys.has(row.key) && row.different)) delete next.data.musicbrainz;
  const normalized = normalizeSnapshot(next); serializeProject(normalized); return normalized;
}

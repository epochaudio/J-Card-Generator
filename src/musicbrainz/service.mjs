import { formatDurationMs } from '../utils/formatDuration.mjs';
import { createClient, abortError } from './client.mjs';
import { PAGE_SIZE, WORK_RULES, searchExpression, rankGroups, sortReleases, validateRelease, normalizeRelease, parentsOf } from './model.mjs';
const MB_ROOT = 'https://musicbrainz.org/ws/2';
const COVER_ROOT = 'https://coverartarchive.org';
const UUID = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
const id = value => { if (!UUID.test(value || '')) throw new Error('资料编号无效。'); return value; };
const MAX_COVER_BYTES = 20 * 1024 * 1024;
export function createMusicBrainzService(client = createClient()) {
  const workCache = new Map();
  const requestMB = (endpoint, params, options) => client.request(`${MB_ROOT}/${endpoint}?${new URLSearchParams({ ...params, fmt: 'json' })}`, options);
  return {
    async searchReleaseGroup(album, artist, { offset = 0, broad = false, type = 'Album', signal } = {}) {
      if (!album.trim() && !artist.trim()) return { items: [], total: 0, nextOffset: null };
      const data = await requestMB('release-group', { query: searchExpression(album, artist, broad, type), limit: PAGE_SIZE, offset }, { signal });
      if (!Array.isArray(data['release-groups'])) throw new Error('搜索响应缺少候选列表。');
      const items = rankGroups(data['release-groups'], album, artist);
      const total = data.count ?? data['release-group-count'] ?? items.length;
      return { items, total, nextOffset: items.length && offset + items.length < total ? offset + items.length : null };
    },
    async getReleases(groupId, { offset = 0, signal } = {}) {
      const data = await requestMB('release', { 'release-group': id(groupId), inc: 'media+labels+artist-credits', limit: PAGE_SIZE, offset }, { signal });
      if (!Array.isArray(data.releases)) throw new Error('发行版本响应缺少列表。');
      const total = data['release-count'] ?? data.releases.length;
      return { items: sortReleases(data.releases), total, nextOffset: data.releases.length && offset + data.releases.length < total ? offset + data.releases.length : null };
    },
    async getReleaseDetails(releaseId, { signal, onProgress = () => {} } = {}) {
      const data = validateRelease(await requestMB(`release/${id(releaseId)}`, { inc: 'recordings+artist-credits+labels+release-groups+recording-level-rels+work-rels+work-level-rels+artist-rels+tags' }, { signal }), releaseId);
      const workMap = new Map();
      const pending = data.media.flatMap(m => m.tracks.flatMap(t => (t.recording?.relations || []).filter(r => r.work?.id).map(r => ({ work: r.work, depth: 0 }))));
      const visited = new Set();
      let lookups = 0;
      while (pending.length && lookups < WORK_RULES.maxLookups) {
        if (signal?.aborted) throw abortError();
        const { work, depth } = pending.shift();
        if (visited.has(work.id) || depth >= WORK_RULES.maxDepth) continue;
        visited.add(work.id);
        const cached = workCache.get(work.id);
        let detail;
        if (cached && Date.now() - cached.time < WORK_RULES.cacheMs) detail = cached.data;
        else {
          onProgress(`正在核对作品关系（${++lookups}）…`);
          detail = await requestMB(`work/${id(work.id)}`, { inc: 'work-rels+artist-rels' }, { signal, allow404: true });
          if (detail && detail.id !== work.id) throw new Error('作品关系响应编号不一致。');
          if (detail) {
            if (workCache.size >= WORK_RULES.maxLookups * 4) workCache.delete(workCache.keys().next().value);
            workCache.set(work.id, { data: detail, time: Date.now() });
          }
        }
        if (detail) { workMap.set(detail.id, detail); parentsOf(detail).forEach(parent => pending.push({ work: parent, depth: depth + 1 })); }
      }
      return { ...data, ...normalizeRelease(data, workMap) };
    },
    async getCoverArt(releaseId, groupId, { signal } = {}) {
      for (const [kind, mbid] of [['release', releaseId], ['release-group', groupId]]) {
        const data = await client.request(`${COVER_ROOT}/${kind}/${id(mbid)}`, { signal, allow404: true });
        if (!data) continue;
        if (!Array.isArray(data.images)) throw new Error('封面响应缺少图片列表。');
        const front = data.images.find(image => image.front);
        if (!front) continue;
        const imageUrl = front.thumbnails?.['500'] || front.thumbnails?.['1200'] || front.image;
        const parsed = new URL(imageUrl);
        if (!['https:', 'http:'].includes(parsed.protocol) || !['coverartarchive.org', 'archive.org'].some(host => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`))) throw new Error('封面图片来源不受支持。');
        parsed.protocol = 'https:';
        const sourceId = kind === 'release' ? releaseId : data.release?.match(/\/release\/([a-f\d-]{36})(?:\/|$)/i)?.[1] || '';
        const blob = await client.request(parsed.href, { signal, binary: true });
        if (!blob || blob.size > MAX_COVER_BYTES) throw new Error('封面图片过大，无法内嵌到作品。');
        if (!/^image\/(png|jpeg|webp|gif)$/.test(blob.type)) throw new Error('封面图片格式不支持。');
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let binary = ''; for (let start = 0; start < bytes.length; start += 8192) binary += String.fromCharCode(...bytes.subarray(start, start + 8192));
        return { image: `data:${blob.type};base64,${btoa(binary)}`, sourceReleaseId: sourceId, fallback: kind === 'release-group', status: 'available' };
      }
      return { image: null, sourceReleaseId: '', fallback: false, status: 'missing' };
    },
    formatDuration: formatDurationMs,
  };
}
export default createMusicBrainzService();

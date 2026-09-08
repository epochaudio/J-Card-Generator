import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createClient, createRequestScope } from '../src/musicbrainz/client.mjs';
import { createMusicBrainzService } from '../src/musicbrainz/service.mjs';
import { creditText, searchExpression, rankGroups, sortReleases, validateRelease, normalizeRelease, suggestMode, suggestSplit, workPaths } from '../src/musicbrainz/model.mjs';
import { createImportSnapshot } from '../src/musicbrainz/importProject.mjs';
import { normalizeSnapshot, serializeProject, parseProject } from '../src/project/projectFormat.mjs';
const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/musicbrainz.json', import.meta.url)));
const uuid = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const response = (data, status = 200) => ({ ok: status < 400, status, headers: new Headers(), json: async () => data });
const fastRules = { intervalMs: 0, timeoutMs: 25, attempts: 2, retryBaseMs: 1, maxRetryWaitMs: 2 };
const rootWork = { id: uuid(10), title: 'Sonata', relations: [{ type: 'composer', artist: { id: uuid(99), name: 'Composer A' } }, { type: 'composer', artist: { id: uuid(98), name: 'Composer B' } }] };
const movement = n => ({ id: uuid(n), title: `Sonata: ${n}. Movement`, relations: [{ type: 'parts', direction: 'backward', 'target-type': 'work', work: { id: rootWork.id, title: rootWork.title } }] });
const makeRelease = () => ({ id: uuid(1), title: 'Solo', date: '2023', 'artist-credit': fixture.groups.solo['artist-credit'], media: [{ position: 1, format: 'CD', 'track-count': 2, tracks: [2, 3].map((n, i) => ({ id: uuid(n + 10), title: `Sonata: ${i + 1}. Movement`, length: 180000, position: i + 1, number: String(i + 1), recording: { id: uuid(n + 20), relations: [{ type: 'performance', 'target-type': 'work', work: movement(n) }, { type: 'instrument', attributes: ['violin'], artist: { id: uuid(88), name: 'Isabelle Faust' } }] } })) }] });
const withNormalized = (raw = makeRelease()) => ({ ...raw, ...normalizeRelease(raw, new Map([[rootWork.id, rootWork], [uuid(2), movement(2)], [uuid(3), movement(3)]])) });
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aOWQAAAAASUVORK5CYII=';

test('search escapes Lucene syntax and distinguishes exact artist identities', () => {
  const query = searchExpression('A+B: "Live" / 2', 'AC/DC');
  assert.match(query, /releasegroup:"A\\\+B\\:/); assert.match(query, /artist:"AC\\\/DC"/);
  const groups = rankGroups([{ id: uuid(1), title: 'Solo', 'artist-credit': [{ name: 'Isabelle van Keulen' }], score: 100 }, { ...fixture.groups.solo, score: 90 }], 'Solo', 'Isabelle Faust');
  assert.equal(groups[0].id, fixture.groups.solo.id); assert.equal(groups[1].exactMatch, false);
  assert.equal(creditText(fixture.groups.solo['artist-credit']).endsWith('; Isabelle Faust'), true);
});
test('versions have stable ordering, no country preference, and distinct dates', () => {
  const a = sortReleases(fixture.brightVersions), b = sortReleases([...fixture.brightVersions].reverse());
  assert.deepEqual(a.map(r => r.id), b.map(r => r.id));
  assert.notEqual(a[0].date, '2016-10-26'); assert.equal(fixture.groups.bright['first-release-date'], '1976');
});
test('search and release browsing expose offset-based pagination including beyond 100', async () => {
  const urls = []; const service = createMusicBrainzService({ request: async url => { urls.push(new URL(url)); return url.includes('release-group?') ? { 'release-groups': [fixture.groups.solo], count: 26 } : { releases: [{ id: uuid(1), date: '2000' }], 'release-count': 126 }; } });
  const search = await service.searchReleaseGroup('Solo', 'Isabelle Faust'); assert.equal(search.nextOffset, 1);
  const page = await service.getReleases(uuid(2), { offset: 100 }); assert.equal(page.nextOffset, 101); assert.equal(urls[1].searchParams.get('offset'), '100');
});
test('503 never becomes a successful release, malformed JSON and empty media fail closed', async () => {
  let calls = 0; const client = createClient({ rules: fastRules, fetchImpl: async () => { calls++; return response({ error: 'busy' }, 503); } });
  await assert.rejects(client.request('https://musicbrainz.org/ws/2/release/x'), /503/); assert.equal(calls, 2);
  const invalid = createClient({ rules: fastRules, fetchImpl: async () => ({ ...response({}), json: async () => { throw new SyntaxError(); } }) });
  await assert.rejects(invalid.request('https://musicbrainz.org/ws/2/release/x'), /JSON/);
  for (const data of [{ error: 'busy' }, { ...makeRelease(), media: [] }, { ...makeRelease(), id: uuid(9) }]) assert.throws(() => validateRelease(data, uuid(1)));
  const incomplete = makeRelease(); incomplete.media[0]['track-count'] = 3; assert.throws(() => validateRelease(incomplete, uuid(1)), /不完整/);
});
test('request scheduler spaces starts and a cancelled queued request never fetches', async () => {
  const starts = []; const client = createClient({ rules: { ...fastRules, intervalMs: 30 }, fetchImpl: async () => { starts.push(Date.now()); return response({ ok: true }); } });
  const cancelled = new AbortController();
  const results = [client.request('https://musicbrainz.org/a'), client.request('https://musicbrainz.org/b', { signal: cancelled.signal }), client.request('https://musicbrainz.org/c')];
  cancelled.abort(); const settled = await Promise.allSettled(results);
  assert.equal(settled[1].status, 'rejected'); assert.equal(starts.length, 2); assert.ok(starts[1] - starts[0] >= 28);
});
test('404 is fatal except for optional resources; 429 retries within its attempt limit', async () => {
  let calls = 0;
  const missing = createClient({ rules: fastRules, fetchImpl: async () => { calls++; return response({}, 404); } });
  await assert.rejects(missing.request('https://musicbrainz.org/missing'), /404/); assert.equal(calls, 1);
  assert.equal(await missing.request('https://musicbrainz.org/missing', { allow404: true }), null);
  calls = 0;
  const throttled = createClient({ rules: fastRules, fetchImpl: async () => {
    calls++; return calls === 1 ? { ...response({}, 429), headers: new Headers({ 'Retry-After': '1' }) } : response({ ok: true });
  } });
  assert.deepEqual(await throttled.request('https://musicbrainz.org/retry'), { ok: true }); assert.equal(calls, 2);
});
test('timeouts retry only a bounded number of times; cancelled scope rejects old completions', async () => {
  let attempts = 0;
  const client = createClient({ rules: { ...fastRules, timeoutMs: 5 }, fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => { attempts++; signal.addEventListener('abort', () => reject(new DOMException('timeout', 'AbortError'))); }) });
  await assert.rejects(client.request('https://musicbrainz.org/a'), /超时/); assert.equal(attempts, 2);
  const scope = createRequestScope(); const first = scope.begin(), second = scope.begin(); assert.equal(first.isCurrent(), false); assert.equal(first.signal.aborted, true); assert.equal(second.isCurrent(), true); scope.cancel(); assert.equal(second.isCurrent(), false);
});
test('ECM work-linked tracks stay STANDARD and a medley retains multiple works', () => {
  const raw = structuredClone(fixture.brightRelease);
  const map = new Map(raw.media.flatMap(m => m.tracks.flatMap(t => (t.recording.relations || []).filter(r => r.work).map(r => [r.work.id, r.work]))));
  const result = normalizeRelease(raw, map);
  assert.equal(result.tracks.length, 8); assert.equal(result.works.length, 7); assert.ok(result.tracks.at(-1).musicbrainz.workPaths.length > 1); assert.equal(suggestMode(raw, result.tracks), 'STANDARD');
  assert.equal(suggestMode({ 'release-group': { 'secondary-types': ['Compilation'] } }, result.tracks), 'COMPILATION');
  assert.equal(suggestMode({ tags: [{ name: 'classical' }] }, result.tracks), 'CLASSICAL');
});
test('parent works group movements; all composers and instrument performers survive', () => {
  const result = withNormalized(); assert.equal(result.works.length, 1); assert.equal(result.works[0].tracks.length, 2);
  assert.equal(result.works[0].composer, 'Composer A / Composer B'); assert.ok(result.credits.performers.includes('Isabelle Faust'));
  assert.equal(result.tracks[0].musicbrainz.workPaths[0].length, 2);
});
test('ambiguous works, missing ancestors and cyclic relationships degrade without false merging', () => {
  const raw = makeRelease(); raw.media[0].tracks[0].recording.relations.push({ 'target-type': 'work', work: { id: uuid(77), title: 'Other' } });
  const result = normalizeRelease(raw, new Map([[uuid(77), { id: uuid(77), title: 'Other' }], [uuid(2), movement(2)], [rootWork.id, rootWork]]));
  assert.equal(result.tracks[0]._workId, ''); assert.equal(result.tracks[0].musicbrainz.workPaths.length, 2); assert.ok(result.warnings.length);
  const cycle = { ...rootWork, relations: [{ type: 'parts', direction: 'backward', 'target-type': 'work', work: rootWork }] };
  assert.equal(workPaths(cycle, new Map([[cycle.id, cycle]])).incomplete, true);
});
test('service includes work-rels and resolves/caches ancestors rather than inferring genre', async () => {
  const urls = []; const service = createMusicBrainzService({ request: async url => { urls.push(url); if (url.includes('/release/')) return makeRelease(); const workId = new URL(url).pathname.split('/').at(-1); return workId === rootWork.id ? rootWork : movement(Number(workId.slice(-1))); } });
  const result = await service.getReleaseDetails(uuid(1)); assert.equal(result.works.length, 1); assert.match(urls[0], /work-rels/); assert.match(urls[0], /release-groups/);
  const before = urls.length; await service.getReleaseDetails(uuid(1)); assert.equal(urls.length - before, 1);
});
test('cover chooses edition first, records group fallback, and never returns a remote URL as an image', async () => {
  const requested = []; const source = uuid(7);
  const client = { request: async (url, options) => { requested.push(url); if (options.binary) return new Blob([Uint8Array.from(atob(png.split(',')[1]), c => c.charCodeAt(0))], { type: 'image/png' }); if (url.includes('/release-group/')) return { release: `https://musicbrainz.org/release/${source}`, images: [{ front: true, image: 'https://archive.org/example.png' }] }; return null; } };
  const cover = await createMusicBrainzService(client).getCoverArt(uuid(1), uuid(2));
  assert.ok(requested[0].includes(`/release/${uuid(1)}`)); assert.equal(cover.fallback, true); assert.equal(cover.sourceReleaseId, source); assert.ok(cover.image.startsWith('data:image/png;'));
  await assert.rejects(createMusicBrainzService({ request: async () => { throw new Error('HTTP 503'); } }).getCoverArt(uuid(1), uuid(2)), /503/);
});
test('split retains original A/B labels, balances time without reordering and warns on unknown duration', () => {
  const tracks = [5, 5, 30, 20].map((n, i) => ({ id: String(i), musicbrainz: { trackNumber: `${i < 2 ? 'A' : 'B'}${i % 2 + 1}`, durationMs: n * 60000 } }));
  assert.equal(suggestSplit(tracks, 45, true).index, 2);
  assert.equal(suggestSplit(tracks, 45, false).index, 3);
  const same = tracks.map(t => ({ ...t, _workId: 'whole' })); assert.ok(suggestSplit(same, 30, false).warnings.some(w => w.includes('作品')));
  const missing = [{ musicbrainz: { durationMs: null } }]; assert.ok(suggestSplit(missing).warnings.some(w => w.includes('缺失')));
});
test('import is atomic, clears old covers by default, preserves source and roles through v2 round trip', () => {
  const current = normalizeSnapshot({ data: { title: 'Old', sideA: [], sideB: [] }, coverImage: png, coverImageB: png, recordingData: { recDate: '1994-08-01', equipment: 'Deck' } });
  const before = structuredClone(current); const release = withNormalized();
  const selection = { group: fixture.groups.solo, release, cover: { image: null, status: 'missing', sourceReleaseId: '' }, tracks: release.tracks, splitIndex: 1, capacityMinutes: 45, mode: 'CLASSICAL', artist: 'Isabelle Faust', dateDisplay: 'first', coverAction: 'clear', secondCoverAction: 'clear' };
  const next = createImportSnapshot(current, selection); assert.deepEqual(current, before); assert.equal(next.coverImage, null); assert.equal(next.coverImageB, null);
  assert.equal(next.recordingData.recDate, '1994-08-01'); assert.equal(next.data.artist, 'Isabelle Faust');
  const saved = parseProject(serializeProject(next)); assert.deepEqual(saved, next); assert.equal(saved.data.musicbrainz.artistCredit.at(-1).name, 'Isabelle Faust'); assert.equal(saved.data.sideA[0].musicbrainz.mediumPosition, 1);
  assert.throws(() => createImportSnapshot(current, { ...selection, tracks: [] })); assert.deepEqual(current, before);
  assert.throws(() => createImportSnapshot(current, { ...selection, capacityMinutes: 1 }), /容量/);
  assert.throws(() => createImportSnapshot(current, { ...selection, coverAction: 'replace' }), /封面/);
  assert.throws(() => createImportSnapshot(current, { ...selection, release: { ...release, 'release-group': { id: uuid(100) } } }), /不一致/);
  const keep = createImportSnapshot(current, { ...selection, coverAction: 'keep', secondCoverAction: 'keep' }); assert.equal(keep.coverImage, png); assert.equal(keep.coverImageB, png);
});
test('source metadata excludes credentials and malformed provenance fails validation', () => {
  const release = withNormalized(); const current = normalizeSnapshot({ data: { sideA: [], sideB: [] } });
  const next = createImportSnapshot(current, { group: fixture.groups.solo, release, cover: {}, tracks: release.tracks, splitIndex: 1, capacityMinutes: 45, mode: 'STANDARD', artist: 'Faust', dateDisplay: 'edition', coverAction: 'clear', secondCoverAction: 'clear' });
  next.data.musicbrainz.apiKey = 'secret'; next.data.sideA[0].musicbrainz.token = 'secret'; assert.equal(serializeProject(next).includes('secret'), false);
  next.data.sideA[0].musicbrainz.mediumPosition = 'bad'; assert.throws(() => serializeProject(next));
});
test('multi-disc import preserves disc and track order, and allows a selected disc subset', () => {
  const raw = makeRelease();
  raw.media.push({ position: 2, format: 'CD', title: 'Bonus', 'track-count': 1, tracks: [{ id: uuid(44), position: 1, number: '1', title: 'Bonus track', length: 120000 }] });
  const release = withNormalized(raw);
  assert.deepEqual(release.tracks.map(t => t.musicbrainz.mediumPosition), [1, 1, 2]);
  const selected = release.tracks.filter(t => t.musicbrainz.mediumPosition === 2);
  const current = normalizeSnapshot({ data: { sideA: [], sideB: [] } });
  const next = createImportSnapshot(current, { group: fixture.groups.solo, release, cover: {}, tracks: selected, splitIndex: 1, capacityMinutes: 45, mode: 'STANDARD', artist: 'Faust', dateDisplay: 'edition', coverAction: 'clear', secondCoverAction: 'clear' });
  assert.deepEqual(next.data.musicbrainz.selectedMedia, [2]); assert.equal(next.data.sideA[0].title, 'Bonus track');
  assert.equal(next.data.sideA[0].musicbrainz.trackNumber, '1'); assert.equal(next.data.layout.worksData.length, 0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSnapshot, serializeProject, parseProject, localDate, projectFilename } from '../src/project/projectFormat.mjs';

export const cover = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=';
export const fixture = (mode = 'STANDARD') => ({
  data: { title: '录音作品', artist: 'Artist', spineTitle: '短标题', tapeId: '001', coverBadge: '第一行\n第二行',
    sideA: [{ id: 'a1', title: '第一乐章', artist: 'Artist', duration: '12:30', note: '备注', _workId: 'work', _workTitle: '奏鸣曲', _workComposer: 'Composer' }],
    sideB: [{ id: 'b1', title: '第二乐章', duration: '3:40' }], sideADuration: '99:99',
    layout: { mode, frontStyle: 'REVERSIBLE', shortBackMode: 'TRACKS_COMPACT', noteLower: '版权', spineInverted: false, worksData: [{ id: 'work', title: '奏鸣曲', composer: 'Composer', tracks: ['a1'] }] } },
  recordingData: { equipment: '卡座', source: 'LP', recDate: '1994-08-01', credits: { producers: ['P'], engineers: ['E'], performers: ['C'] } },
  coverImage: cover, coverImageB: cover, fontTheme: 'puhuiti', jCardThemeMode: 'light',
  theme: { background: '#121212', accent: '#abcdef', mood_description: '轻快' }, imagePrompt: '绘画提示'
});

for (const mode of ['STANDARD', 'CLASSICAL', 'COMPILATION']) test(`${mode}: complete portable round trip`, () => {
  const source = fixture(mode);
  const result = parseProject(serializeProject(source));
  assert.deepEqual(result, normalizeSnapshot(source));
  assert.equal(result.recordingData.recDate, '1994-08-01');
  assert.equal(result.theme.accent, '#abcdef');
  assert.equal(result.data.sideADuration, '12:30');
  assert.equal(result.coverImageB, cover);
  assert.equal(result.data.sideA[0].id, 'a1');
  assert.equal(result.data.layout.worksData[0].tracks[0], 'a1');
  assert.equal(serializeProject(result), serializeProject(source));
});
test('credentials and transient/unknown fields never enter project or draft payload', () => {
  const source = fixture();
  source.apiKey = 'secret'; source.data.apiKey = 'secret'; source.data.layout.apiKey = 'secret';
  source.recordingData.credits.apiKey = 'secret'; source.data.sideA[0].apiKey = 'secret'; source.theme.apiKey = 'secret';
  assert.equal(serializeProject(source).includes('secret'), false);
});
test('optional defaults and legacy AUTO respect content mode', () => {
  for (const mode of ['STANDARD', 'CLASSICAL']) {
    const result = normalizeSnapshot({ data: { sideA: [{}], sideB: [], layout: { mode, shortBackMode: 'AUTO' } } });
    assert.equal(result.data.sideA[0].id, 'sideA-1');
    assert.equal(result.data.layout.shortBackMode, mode === 'CLASSICAL' ? 'META_ARCHIVE' : 'TRACKS_COMPACT');
  }
});
test('malformed, unknown version and unsupported images rejected before restoration', () => {
  assert.throws(() => parseProject('{'));
  const envelope = JSON.parse(serializeProject(fixture()));
  envelope.version = 99;
  assert.throws(() => parseProject(JSON.stringify(envelope)), /版本/);
  for (const coverImage of ['https://example.com/a.png', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,YmFk']) {
    assert.throws(() => serializeProject({ ...fixture(), coverImage }));
  }
  const source = fixture(); source.data.sideB[0].id = 'a1';
  assert.throws(() => serializeProject(source), /ID/);
});
test('unsafe structure rejected without mutating input', () => {
  const source = fixture(); const before = structuredClone(source);
  serializeProject(source); assert.deepEqual(source, before);
  source.recordingData.credits.producers = 'not an array';
  assert.throws(() => serializeProject(source));
  assert.throws(() => normalizeSnapshot({ data: { sideA: null, sideB: [] } }));
});
test('local date uses local calendar and filenames cannot introduce directories', () => {
  assert.equal(localDate(new Date(2026, 8, 8, 0, 10)), '2026-09-08');
  assert.equal(projectFilename('a/b:c'), 'a_b_c.jcard');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { PALETTES, contrastRatio, contrastInk, readableAccent, resolvePalette } from '../src/config/design.mjs';
import { normalizeSnapshot, serializeProject, parseProject } from '../src/project/projectFormat.mjs';

const album = { data: { title: '夜色与回声', artist: '陈明 · Quartet', sideA: [{ id: 'a', title: '回声', duration: '3:25' }], sideB: [] } };
test('unified format round-trips without an edition and rejects older formats', () => {
  const current = normalizeSnapshot(album);
  assert.equal(Object.hasOwn(current.data.layout, 'designEdition'), false);
  assert.equal(current.data.layout.texture, false);
  assert.deepEqual(parseProject(serializeProject(current)), current);
  assert.equal(JSON.parse(serializeProject(current)).version, 3);
  for (const version of [1, 2]) {
    assert.throws(() => parseProject(JSON.stringify({ format: 'jcard-project', version, project: album })), /版本/);
  }
});
test('design choices round-trip independently from content, date and custom accent', () => {
  for (const paletteId of Object.keys(PALETTES)) for (const frontStyle of ['STANDARD', 'EDITORIAL', 'REVERSIBLE']) {
    const source = { ...album, data: { ...album.data, layout: { frontStyle, titleSize: 'compact', texture: false } }, theme: { paletteId, accent: '#86512a' }, fontTheme: 'editorial', recordingData: { recDate: '1994-08-01' } };
    const restored = parseProject(serializeProject(source));
    assert.deepEqual(restored, normalizeSnapshot(source));
    assert.equal(restored.theme.accent, '#86512a');
    assert.equal(restored.data.sideA[0].title, '回声');
    assert.equal(restored.recordingData.recDate, '1994-08-01');
  }
});
test('invalid design choices fail closed', () => {
  for (const patch of [{ titleSize: 'giant' }, { frontStyle: 'UNKNOWN' }, { texture: 'yes' }]) {
    assert.throws(() => normalizeSnapshot({ ...album, data: { ...album.data, layout: patch } }));
  }
  assert.throws(() => normalizeSnapshot({ ...album, theme: { paletteId: 'missing' } }));
});
test('preset text roles retain 4.5:1 contrast against their backgrounds', () => {
  for (const palette of Object.values(PALETTES)) for (const role of ['text', 'secondary', 'muted']) {
    assert.ok(contrastRatio(palette.background, palette[role]) >= 4.5, `${palette.name} ${role}`);
  }
});
test('custom accents remain readable on light, dark and vivid backgrounds', () => {
  for (const bg of ['#ffffff', '#000000', '#777777', '#ff0080', '#00d4aa']) for (const accent of ['#ffff00', '#000000', '#eeeeee', '#00ff00']) {
    assert.ok(contrastRatio(readableAccent(accent, bg), bg) >= 4.5);
    assert.ok(contrastRatio(contrastInk(bg), bg) >= 4.5);
  }
});
test('palette resolves its own background regardless of a previous image mode', () => {
  const resolved = resolvePalette({ paletteId: 'paper', accent: '#123456' }, 'cover', '#ff00ff');
  assert.equal(resolved.background, PALETTES.paper.background);
  assert.equal(resolved.accent, '#123456');
});

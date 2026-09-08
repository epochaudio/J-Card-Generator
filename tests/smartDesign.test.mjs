import { designCandidate, panelColors } from './fixtures/panelColors.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSnapshot, parseProject, serializeProject } from '../src/project/projectFormat.mjs';
import { applyDesignFields, buildDesignInput, contentStamp, designChange, designFields, eligibility, parseDesignCandidates, selectDesignCandidates } from '../src/design/smartDesign.mjs';

const album = () => normalizeSnapshot({ data: { title: '夜色与回声', artist: '林间 Quartet', sideA: [{ id: 'a', title: '回声 Echo', duration: '3:25' }], sideB: [] }, theme: { paletteId: 'paper' }, fontTheme: 'modern' });
const candidate = designCandidate;

test('unlocked source input does not contain or depend on current design, image prompt, API settings or current rendering', () => {
  const a = album(), b = applyDesignFields(a, { fontTheme: 'handwritten', paletteId: 'cool', accent: '#abcdef', frontStyle: 'EDITORIAL', titleSize: 'expressive' });
  b.jCardThemeMode = 'cover'; b.theme.background = '#777777'; b.imagePrompt = 'PRIVATE PROMPT'; b.apiKey = 'PRIVATE KEY'; b.currentPreview = 'PRIVATE SCREENSHOT';
  assert.deepEqual(buildDesignInput(a), buildDesignInput(b));
  const encoded = JSON.stringify(buildDesignInput(b));
  for (const excluded of ['PRIVATE', 'fontTheme', 'currentPreview', '#abcdef', 'imagePrompt']) assert.equal(encoded.includes(excluded), false);
  assert.equal(contentStamp(a) === contentStamp(applyDesignFields(a, { frontStyle: 'EDITORIAL' })), true);
});
test('only explicitly locked values enter constraints and matching candidates retain the exact accent', () => {
  const a = album(); a.theme.accent = '#b45122';
  assert.deepEqual(buildDesignInput(a, { font: true }).locked, { fontTheme: a.fontTheme });
  const output = parseDesignCandidates({ candidates: [candidate(), candidate({ fontTheme: a.fontTheme, paletteId: a.theme.paletteId, colors: null })] }, a, { font: true, palette: true });
  assert.equal(output.candidates.length, 1); assert.equal(output.candidates[0].fields.accent, '#b45122'); assert.equal(output.rejected.length, 1);
});
test('invalid, duplicate, unknown or content-changing candidates are rejected without changing source', () => {
  const source = album(), before = JSON.stringify(source);
  const output = parseDesignCandidates({ candidates: [candidate(), candidate(), candidate({ titleSize: 'huge' }), candidate({ title: 'wrong' }), candidate({ fontTheme: '__proto__' })] }, source);
  assert.equal(output.candidates.length, 1); assert.equal(output.rejected.length, 4); assert.equal(JSON.stringify(source), before);
  assert.throws(() => parseDesignCandidates({ candidates: [candidate()], title: 'override' }, source));
  assert.throws(() => applyDesignFields(source, { title: 'override' }));
});
test('apply, save/reopen and field-only undo preserve subsequent content edits', () => {
  const a = album(); const fields = parseDesignCandidates({ candidates: [candidate()] }, a).candidates[0].fields;
  const patch = designChange(designFields(a), fields);
  const before = Object.fromEntries(Object.keys(patch).map(key => [key, designFields(a)[key]]));
  const b = parseProject(serializeProject(applyDesignFields(a, patch)));
  b.data.sideA[0].title = '后续修改';
  const restored = applyDesignFields(b, before);
  assert.deepEqual(designFields(restored), designFields(a)); assert.equal(restored.data.sideA[0].title, '后续修改');
  assert.equal(JSON.parse(serializeProject(restored)).version, 3);
});
test('content summary retains counts and longest material without depending on current wrapping', () => {
  const source = album(); source.data.sideA = Array.from({ length: 40 }, (_, index) => ({ title: index === 39 ? '长'.repeat(260) : `Track ${index}`, duration: '3:00' }));
  const input = buildDesignInput(source);
  assert.equal(input.materials.sideA.count, 40); assert.ok(input.materials.sideA.samples.length <= 12);
  assert.ok(input.materials.sideA.samples.some(track => track.truncated));
  assert.throws(() => buildDesignInput(source, {}, 'x'.repeat(201)));
});
test('selection considers backups to obtain three distinct directions instead of greedy duplicates', () => {
  const measured = [ ['harmony','a'], ['harmony','b'], ['title','a'], ['reading','c'] ].map(([direction, visual]) => ({ direction, visual, metrics: { backFolded: false, bodySize: 24 } }));
  const result = selectDesignCandidates(measured, (a, b) => a.visual !== b.visual);
  assert.equal(result.length, 3); assert.equal(result[0].visual, 'b');
  assert.equal(selectDesignCandidates(measured, () => false).length, 1);
});
test('unsupported layouts and unverifiable locked image backgrounds are explicit', () => {
  const a = album(); assert.match(eligibility(a), /主封面/);
  a.coverImage = 'available'; assert.equal(eligibility(a), '');
  a.data.layout.frontStyle = 'REVERSIBLE'; assert.match(eligibility(a), /双面颠倒/);
  a.data.layout.frontStyle = 'STANDARD'; a.theme.paletteId = 'legacy'; a.jCardThemeMode = 'cover';
  assert.match(eligibility(a, { palette: true }), /对比度/);
});

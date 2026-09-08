import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePanelColors, panelColorFailures, resolvePanelColors } from '../src/config/design.mjs';
import { normalizeSnapshot, serializeProject, parseProject } from '../src/project/projectFormat.mjs';
import { applyDesignFields, buildDesignInput, designFields, parseDesignCandidates } from '../src/design/smartDesign.mjs';
import { generateDesigns } from '../src/design/generateDesigns.mjs';
import { panelColors, designCandidate } from './fixtures/panelColors.mjs';
const source = () => normalizeSnapshot({ data: { title: 'Coast', sideA: [], sideB: [] } });

test('all panel colors survive application and disk roundtrip, independent of image color and old background mode', () => {
  const original = source();
  const fields = parseDesignCandidates({ candidates: [designCandidate()] }, original).candidates[0].fields;
  const applied = applyDesignFields(original, fields);
  const restored = parseProject(serializeProject(applied));
  assert.deepEqual(restored.theme.colors, panelColors());
  assert.deepEqual(resolvePanelColors(restored.theme, 'cover', '#FF0000', true), panelColors());
  assert.deepEqual(panelColorFailures(restored.theme.colors, true), []);
  assert.deepEqual(buildDesignInput(original), buildDesignInput(restored));
  assert.deepEqual(buildDesignInput(restored, { palette: true }).locked.palette.colors, panelColors());
  assert.deepEqual(designFields(restored), fields);
});
test('missing, extra and nonliteral colors cannot enter the renderer or saved project', () => {
  for (const mutate of [c => delete c.spine, c => delete c.back.track, c => c.front.title = 'url(https://example.com)', c => c.back.extra = '#000000', c => c.spine.id = '#123', c => c.front = []]) {
    const colors = panelColors(); mutate(colors);
    assert.throws(() => normalizePanelColors(colors));
    assert.throws(() => normalizeSnapshot({ ...source(), theme: { paletteId: 'custom', colors } }));
    assert.equal(parseDesignCandidates({ candidates: [designCandidate({ colors })] }, source()).candidates.length, 0);
  }
});
test('contrast uses each panel and badge actual background without recoloring', () => {
  for (const [panel, role, background] of [['back', 'note', 'background'], ['spine', 'artist', 'background'], ['shortBack', 'badgeText', 'accent'], ['front', 'badge', 'badgeBackground']]) {
    const colors = panelColors(); colors[panel][role] = colors[panel][background];
    const before = structuredClone(colors);
    assert.ok(panelColorFailures(colors).some(failure => failure.includes(`${panel}.${role}`)));
    assert.deepEqual(colors, before);
  }
});
test('locking a complete color scheme rejects a single altered role', () => {
  const snapshot = normalizeSnapshot({ ...source(), theme: { paletteId: 'custom', colors: panelColors() } });
  const changed = panelColors(); changed.back.note = '#000000';
  const parsed = parseDesignCandidates({ candidates: [designCandidate({ colors: changed }), designCandidate()] }, snapshot, { palette: true });
  assert.equal(parsed.candidates.length, 1);
  assert.deepEqual(parsed.candidates[0].fields.colors, panelColors());
  assert.match(parsed.rejected[0], /锁定/);
});
const fakeRender = async snapshot => ({ failures: panelColorFailures(snapshot.theme.colors), signature: snapshot.data.layout.titleSize, metrics: { bodySize: 24, backFolded: false } });
const run = request => generateDesigns({ snapshot: source(), locks: {}, prompt: 'original prompt', request, render: fakeRender, different: (a,b) => a !== b, active: () => {}, status: () => {} });
const good = () => [designCandidate(), designCandidate({ direction: 'title', titleSize: 'expressive' }), designCandidate({ direction: 'reading', titleSize: 'compact' })];
test('failed colors are sent to AI once for repair; accepted designs retain exact returned colors', async () => {
  const invalid = panelColors(); invalid.back.note = invalid.back.background;
  const prompts = [];
  const result = await run(async prompt => { prompts.push(prompt); return { candidates: prompts.length === 1 ? [designCandidate({ colors: invalid })] : good() }; });
  assert.equal(prompts.length, 2); assert.match(prompts[1], /back.note/);
  assert.equal(result.candidates.length, 3);
  assert.deepEqual(result.candidates[0].fields.colors, panelColors());
});
test('persistent failure stops after one repair and never substitutes presets', async () => {
  let calls = 0;
  const invalid = panelColors(); invalid.spine.title = invalid.spine.background;
  const result = await run(async () => { calls++; return { candidates: [designCandidate({ colors: invalid })] }; });
  assert.equal(calls, 2); assert.equal(result.candidates.length, 0);
});
test('valid designs need one request; repair service failure preserves already accepted results', async () => {
  let calls = 0;
  assert.equal((await run(async () => { calls++; return { candidates: good() }; })).candidates.length, 3);
  assert.equal(calls, 1);
  calls = 0;
  const partial = await run(async () => { if (++calls === 2) throw new Error('服务暂不可用'); return { candidates: [designCandidate()] }; });
  assert.equal(partial.candidates.length, 1); assert.match(partial.rejected.at(-1), /服务暂不可用/);
});

test('cancelled repair cannot return candidates or write a stale result', async () => {
  let calls = 0, cancelled = false;
  await assert.rejects(generateDesigns({ snapshot: source(), locks: {}, prompt: 'original',
    request: async () => { calls++; if (calls === 2) cancelled = true; return { candidates: [designCandidate()] }; },
    render: fakeRender, different: (a,b) => a !== b,
    active: () => { if (cancelled) throw new Error('cancelled'); }, status: () => {} }), /cancelled/);
  assert.equal(calls, 2);
});

test('wrapped artist and subtitle color boundaries survive trimmed whitespace and long mixed text', async () => {
  const { splitWrappedLine } = await import('../src/utils/splitWrappedLine.mjs');
  const full = 'Long title · Artist name';
  const lines = ['Long title', '· Artist', 'name'];
  assert.deepEqual(splitWrappedLine(full, lines, 0, 'Long title'.length), ['Long title', '']);
  assert.deepEqual(splitWrappedLine(full, lines, 1, 'Long title'.length), ['', '· Artist']);
  assert.deepEqual(splitWrappedLine(full, lines, 2, 'Long title'.length), ['', 'name']);
  assert.deepEqual(splitWrappedLine('海岸 · Evening', ['海岸 · Evening'], 0, 2), ['海岸', ' · Evening']);
});

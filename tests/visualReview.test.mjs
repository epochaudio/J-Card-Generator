import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVisualReview, hasPassedReview, reviewPrompt } from '../src/design/visualReview.mjs';
import { generateDesigns } from '../src/design/generateDesigns.mjs';
import { normalizeSnapshot } from '../src/project/projectFormat.mjs';
import { designCandidate, panelColors } from './fixtures/panelColors.mjs';
import { panelColorFailures } from '../src/config/design.mjs';
const pass = c => ({ candidateId: c.id, revision: c.revision, verdict: 'pass', issues: [], summary: '协调清楚' });
const issue = { panel: 'front', role: 'title', type: 'readability', description: '倾斜影响标题辨识', suggestion: '降低标题倾斜角度' };
const good = () => [designCandidate(), designCandidate({ direction: 'title', titleSize: 'expressive' }), designCandidate({ direction: 'reading', titleSize: 'compact' })];
const options = () => ({ snapshot: normalizeSnapshot({ data: { title: 'Coast', sideA: [], sideB: [] } }), locks: {}, prompt: 'design',
 request: async () => ({ candidates: good() }), review: async c => pass(c),
 render: async s => ({ preview: JSON.stringify(s.theme), failures: panelColorFailures(s.theme.colors), warnings: [], signature: s.data.layout.titleSize, metrics: { bodySize: 24 } }),
 different: (a,b) => a !== b, active: () => {}, status: () => {} });

test('review strictly binds candidate version, fields and rendered image', () => {
 const c = { id: 'a', revision: 0, fields: { titleSize: 'compact' }, preview: 'image-a', failures: [] };
 c.review = parseVisualReview(pass(c), c); assert.ok(hasPassedReview(c));
 for (const patch of [{ id: 'b' }, { revision: 1 }, { fields: {} }, { preview: 'image-b' }, { failures: ['overflow'] }]) assert.equal(hasPassedReview({ ...c, ...patch }), false);
 for (const patch of [{ candidateId: 'b' }, { revision: 1 }, { extra: true }, { summary: '' }, { verdict: 'maybe' }, { issues: [issue] }, { verdict: 'revise' }, { issues: null }]) assert.throws(() => parseVisualReview({ ...pass(c), ...patch }, c));
 assert.throws(() => parseVisualReview({ ...pass(c), verdict: 'revise', issues: [{ ...issue, panel: 'unknown' }] }, c));
 assert.match(reviewPrompt(c, {}), /图片2为候选完整展开图/);
});
test('all passes require one generation and one review per candidate', async () => {
 let requests = 0, reviews = 0;
 const result = await generateDesigns({ ...options(), request: async () => { requests++; return { candidates: good() }; }, review: async c => { reviews++; return pass(c); } });
 assert.equal(requests, 1); assert.equal(reviews, 3); assert.equal(result.candidates.length, 3); assert.ok(result.candidates.every(hasPassedReview));
});
test('visual failure repaired once, passes retained and revised candidate reviewed again', async () => {
 const calls = [], prompts = [], images = [];
 const result = await generateDesigns({ ...options(), request: async (p, failedImages) => { images.push(failedImages); prompts.push(p); return { candidates: good() }; }, review: async c => {
  calls.push([c.direction, c.revision]); return c.direction === 'title' && c.revision === 0 ? { ...pass(c), verdict: 'revise', issues: [issue] } : pass(c);
 } });
 assert.equal(images[0].length, 0); assert.equal(images[1].length, 1); assert.equal(images[1][0].direction, 'title');
 assert.equal(prompts.length, 2); assert.match(prompts[1], /倾斜影响/); assert.equal(calls.length, 4);
 assert.deepEqual(calls.at(-1), ['title', 1]); assert.equal(result.candidates.length, 3);
 assert.equal(result.candidates.find(c => c.direction === 'harmony').revision, 0);
});
test('local and visual failures share one repair; persistent failures are excluded', async () => {
 let requests = 0; const reviewed = [];
 const invalid = panelColors(); invalid.back.note = invalid.back.background;
 const result = await generateDesigns({ ...options(), request: async () => { requests++; return { candidates: [designCandidate({ colors: invalid }), ...good().slice(1)] }; }, review: async c => {
 reviewed.push(c.direction); return c.direction === 'title' ? { ...pass(c), verdict: 'uncertain', summary: '无法看清' } : pass(c);
 } });
 assert.equal(requests, 2); assert.ok(!reviewed.includes('harmony')); assert.equal(result.candidates.length, 1); assert.equal(result.candidates[0].direction, 'reading');
});
test('missing, stale and failed review responses cannot pass', async () => {
 for (const review of [async () => null, async c => ({ ...pass(c), revision: -1 }), async () => { throw new Error('timeout'); }]) {
  const result = await generateDesigns({ ...options(), review }); assert.equal(result.candidates.length, 0);
 }
 await assert.rejects(generateDesigns({ ...options(), review: undefined }), /缺少/);
});
test('cancellation during visual review discards the late response', async () => {
 let cancelled = false;
 await assert.rejects(generateDesigns({ ...options(), review: async c => { cancelled = true; return pass(c); }, active: () => { if (cancelled) throw new Error('cancelled'); } }), /cancelled/);
});
test('visually identical passed directions can be replaced during repair', async () => {
 let calls = 0;
 const result = await generateDesigns({ ...options(), request: async () => ({ candidates: ++calls === 1 ? good().map(c => ({ ...c, titleSize: 'balanced' })) : good() }) });
 assert.equal(calls, 2); assert.equal(result.candidates.length, 3);
});

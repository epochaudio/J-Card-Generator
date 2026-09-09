import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultTextStyles, normalizeTextStyles, typographyCapabilities, typographyFont } from '../src/config/textStyles.mjs';
import { getFontConfig, FONT_THEMES } from '../src/config/fonts.js';
import { normalizeSnapshot, serializeProject, parseProject } from '../src/project/projectFormat.mjs';
import { designFields, applyDesignFields, designChange, buildDesignInput, parseDesignCandidates } from '../src/design/smartDesign.mjs';
import { designCandidate } from './fixtures/panelColors.mjs';
const source = () => normalizeSnapshot({ data: { title: '海岸 Coast', sideA: [{ title: '晚风', duration: '3:00' }], sideB: [] }, fontTheme: 'editorial' });

test('only real bundled weights and bounded geometric slants are offered for every theme', () => {
  for (const id of Object.keys(FONT_THEMES)) assert.deepEqual(normalizeTextStyles(defaultTextStyles(id), id), defaultTextStyles(id));
  assert.deepEqual(typographyCapabilities('modern').title.weights, [400,700]);
  assert.deepEqual(typographyCapabilities('handwritten').title.weights, [400]);
  assert.equal(typographyCapabilities('editorial').title.nativeItalic, false);
  assert.throws(() => typographyCapabilities('__proto__'));
  assert.throws(() => typographyCapabilities('unknown'));
});
test('unavailable weights, native italic, extra transforms and unsafe body deformation fail closed', () => {
  for (const mutate of [s=>s.title.weight=900, s=>s.title.italic=true, s=>s.track.width=1.2, s=>s.note.slant=12, s=>s.title.width=NaN, s=>delete s.metadata, s=>s.title.slant='8', s=>s.title.wave=1]) {
    const style=defaultTextStyles('editorial'); mutate(style);
    assert.throws(()=>normalizeTextStyles(style,'editorial'));
    assert.throws(()=>normalizeSnapshot({...source(), theme:{typography:style}}));
  }
  const bold=defaultTextStyles('handwritten');bold.title.weight=700;
  assert.throws(()=>normalizeTextStyles(bold,'handwritten'));
});
test('older works have no new visual defaults; complete styles survive save and content-preserving undo', () => {
  const a=source(); assert.equal(Object.hasOwn(a.theme,'typography'),false);
  assert.equal(typeof typographyFont(getFontConfig('editorial'),'title'),'string');
  const styles=defaultTextStyles('editorial');styles.title={weight:700,slant:8,width:0.9};styles.artist.weight=500;
  const b=applyDesignFields(a,{typography:styles});
  const reopened=parseProject(serializeProject(b));assert.deepEqual(reopened.theme.typography,styles);
  assert.deepEqual(designChange(designFields(b),designFields(reopened)),{});
  reopened.data.sideA[0].title='保留后续编辑';
  const undone=applyDesignFields(reopened,{typography:null});
  assert.equal(undone.theme.typography,null);assert.equal(undone.data.sideA[0].title,'保留后续编辑');
  assert.deepEqual(buildDesignInput(a),buildDesignInput(b));
});
test('font lock includes every style and rejects changing even one role', () => {
  const a=source();a.theme.typography=defaultTextStyles('editorial');
  const changed=structuredClone(a.theme.typography);changed.artist.slant=4;
  const result=parseDesignCandidates({candidates:[designCandidate({typography:changed}),designCandidate()]},a,{font:true});
  assert.equal(result.candidates.length,1);assert.match(result.rejected[0],/样式锁定/);
  assert.deepEqual(buildDesignInput(a,{font:true}).locked.typography,a.theme.typography);
  const old=source();
  assert.equal(parseDesignCandidates({candidates:[designCandidate({typography:null})]},old,{font:true}).candidates.length,1);
  assert.equal(parseDesignCandidates({candidates:[designCandidate({typography:null})]},old).candidates.length,0);
});

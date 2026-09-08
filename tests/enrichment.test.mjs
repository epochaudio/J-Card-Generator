import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCoverRecognition, searchFromCover, uniqueObservedGroup, uniqueObservedVersion } from '../src/enrichment/coverRecognition.mjs';
import { normalizeSnapshot, serializeProject, parseProject } from '../src/project/projectFormat.mjs';
import { applySupplement, supplementRows } from '../src/enrichment/supplement.mjs';
const clues = () => parseCoverRecognition({ observed: { album:'Album',artist:'Artist',label:'',catalogNumber:'' }, inferred:{album:'Guess',artist:''},notes:'' });
test('cover recognition separates observed text and inference and rejects extra material', () => {
 assert.equal(clues().album,'Album');
 assert.throws(() => parseCoverRecognition({...clues(), releaseId:'fake'}));
 const blank=parseCoverRecognition({observed:{album:'',artist:'',label:'',catalogNumber:''},inferred:{album:'Guess',artist:''},notes:'uncertain'});
 assert.equal(blank.album,'Guess'); assert.equal(blank.observed.album,'');
 assert.throws(() => parseCoverRecognition({observed:{album:'x'.repeat(201),artist:'',label:'',catalogNumber:''},inferred:{album:'',artist:''},notes:''}));
});
test('cover lookup broadens only after empty results and is bounded', async () => {
 const calls=[];const service={searchReleaseGroup:async(album,artist,options)=>{calls.push({album,artist,...options});return {items:[],total:0,nextOffset:null};}};
 await searchFromCover(service,clues(),new AbortController().signal,()=>{});
 assert.equal(calls.length,3);assert.equal(calls[0].artist,'Artist');assert.equal(calls[1].artist,'');assert.equal(calls[2].broad,true);
 const controller=new AbortController();controller.abort();await assert.rejects(searchFromCover(service,clues(),controller.signal,()=>{}),{name:'AbortError'});assert.equal(calls.length,3);
});
test('only complete unique observed matches may advance automatically; guesses and versions remain reviewable', () => {
 const group={title:'Album','artist-credit':[{name:'Artist'}]};const page={items:[group],total:1,totalKnown:true,nextOffset:null};
 assert.equal(uniqueObservedGroup(page,clues()),group);assert.equal(uniqueObservedGroup({...page,total:2},clues()),null);assert.equal(uniqueObservedGroup({...page,totalKnown:false},clues()),null);
 assert.equal(uniqueObservedGroup(page,{...clues(),observed:{album:'',artist:''}}),null);
 assert.equal(uniqueObservedVersion(page,{...clues(),observed:{catalogNumber:'CAT-1'}}),null);
 assert.equal(uniqueObservedVersion(page,clues()),group);
});
const current=()=>normalizeSnapshot({data:{title:'Keep title',artist:'Keep artist',releaseDate:'',sideA:[{id:'old',title:'My track',duration:'1:00'}],sideB:[],coverBadge:'Keep badge',layout:{noteUpper:'Keep note'}},imagePrompt:'Keep prompt',theme:{mood_description:'Keep mood'},recordingData:{equipment:'Keep equipment'}});
const candidate=()=>normalizeSnapshot({data:{title:'New title',artist:'New artist',releaseDate:'2026',sideA:[{id:'new',title:'New track',duration:'2:00'}],sideB:[],layout:{mode:'COMPILATION'}}});
test('supplement defaults only empty fields and never clears unknown values', () => {
 const rows=supplementRows(current(),candidate());assert.deepEqual(rows.filter(row=>row.empty&&row.available&&row.different).map(row=>row.key),['releaseDate']);
 assert.throws(()=>applySupplement(current(),candidate(),['title','apiKey']));assert.throws(()=>applySupplement(current(),candidate(),[]));assert.throws(()=>applySupplement(current(),candidate(),['credits']));
});
test('partial supplement preserves content, design and images; reviewed fields survive save/reopen', () => {
 const before=current();const next=parseProject(serializeProject(applySupplement(before,candidate(),['releaseDate'])));
 assert.equal(next.data.releaseDate,'2026');assert.equal(next.data.title,before.data.title);assert.deepEqual(next.data.sideA,before.data.sideA);
 assert.equal(next.imagePrompt,before.imagePrompt);assert.deepEqual(next.theme,before.theme);assert.deepEqual(next.recordingData,before.recordingData);assert.equal(next.data.coverBadge,'Keep badge');
 const imported=applySupplement(before,candidate(),['title','tracks']);assert.equal(imported.data.title,'New title');assert.equal(imported.data.layout.mode,'COMPILATION');assert.equal(imported.data.layout.noteUpper,'Keep note');assert.equal(imported.data.artist,'Keep artist');
});

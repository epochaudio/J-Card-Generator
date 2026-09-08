const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
(async () => {
 const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
 const page = await browser.newPage({ viewport: { width: 1450, height: 1100 } }); page.setDefaultTimeout(30000);
 const errors = [], requests = []; let hold = false, releasePending, multiple = false, blank = false;
 page.on('pageerror', error => errors.push(error.message));
 const id = n => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
 const credit = [{ name: 'Test Artist', artist: { id: id(9), name: 'Test Artist' } }];
 const group = { id: id(1), title: 'Test Album', 'artist-credit': credit, 'first-release-date': '2001' };
 const version = { id: id(2), title: 'Test Album', date: '2002', country: 'JP', status: 'Official', 'artist-credit': credit, 'label-info': [], media: [{ position: 1, format: 'CD', 'track-count': 2 }] };
 const detail = { ...version, 'release-group': group, media: [{ ...version.media[0], tracks: [3,4].map((n,i) => ({ id: id(n), title: `Database Track ${i+1}`, position: i+1, number: String(i+1), length: 180000, recording: { id: id(n+10), title: `Database Track ${i+1}` } })) }] };
 await page.route('https://**/*', async route => {
  const request = route.request(), url = new URL(request.url()); requests.push({ url: url.href, method: request.method(), body: request.postData() });
  const send = value => route.fulfill({ contentType: 'application/json', body: JSON.stringify(value) }).catch(()=>{});
  if (url.hostname === 'api.deepseek.com') {
   if (hold) await new Promise(resolve => { releasePending = resolve; });
   return send({ choices: [{ message: { content: JSON.stringify({ observed: { album: blank ? '' : 'Test Album', artist: blank ? '' : 'Test Artist', label: '', catalogNumber: '' }, inferred: { album: '', artist: '' }, notes: blank ? '封面没有清晰文字' : '' }) } }] });
  }
  if (url.hostname === 'musicbrainz.org') {
   if (url.pathname.endsWith('/release-group')) return send({ count:1,'release-groups':[group] });
   if (url.pathname.endsWith('/release')) return send({ 'release-count':multiple?2:1, releases:multiple?[version,{...version,id:id(5),date:'2010'}]:[version] });
   return send(detail);
  }
  return route.abort();
 });
 const panel = page.getByRole('region',{name:'封面智能补足'});
 const save = async () => { const pending = page.waitForEvent('download'); await page.getByRole('button',{name:'保存作品',exact:true}).click();return JSON.parse(await fs.readFile(await(await pending).path(),'utf8')).project; };
 try {
  await page.goto(process.env.JCARD_TEST_URL || 'http://127.0.0.1:5187'); await page.getByRole('button',{name:'打开作品',exact:true}).waitFor();
  assert.equal(await panel.getByRole('button',{name:'智能补足信息'}).isDisabled(),true);
  await page.evaluate(async () => {
   const {normalizeSnapshot,serializeProject}=await import('/src/project/projectFormat.mjs');const {projectStorage}=await import('/src/project/projectStorage.mjs');const {normalizeAISettings}=await import('/src/ai/providerConfig.mjs');
   const canvas=document.createElement('canvas');canvas.width=canvas.height=300;const ctx=canvas.getContext('2d');ctx.fillStyle='#d9c8a2';ctx.fillRect(0,0,300,300);ctx.fillStyle='#222';ctx.font='24px Arial';ctx.fillText('Test Album',20,80);ctx.fillText('Test Artist',20,140);
   const image=canvas.toDataURL();
   await projectStorage.writeDraft(serializeProject(normalizeSnapshot({data:{title:'PRIVATE CURRENT TITLE',artist:'My Artist',sideA:[{id:'old',title:'Keep Track',duration:'1:00'}],sideB:[],coverBadge:'Keep badge'},coverImage:image,coverImageB:image,imagePrompt:'PRIVATE PROMPT',recordingData:{equipment:'Keep equipment'}})));
   localStorage.setItem('jcard_ai_settings_v1',JSON.stringify(normalizeAISettings({visionProvider:'deepseek',providers:{deepseek:{apiKey:'test-enrichment-key',visionModel:'deepseek-v4.1-flash-expires-on-0910'}}})));
  });
  await page.reload(); await page.getByRole('button',{name:'恢复草稿',exact:true}).click(); const before=await save();
  await panel.getByRole('button',{name:'智能补足信息'}).click();
  await page.getByRole('button',{name:'确认补足信息',exact:true}).waitFor();
  assert.equal(await page.getByLabel('补足专辑标题').isChecked(),false); assert.equal(await page.getByLabel('补足发行日期').isChecked(),true);assert.equal(await page.getByLabel('补足曲目、分面与内容模式').isChecked(),false);
  assert.equal(await page.locator('input[type=text]').first().inputValue(),before.data.title);
  await page.getByRole('dialog',{name:'MusicBrainz 搜索与导入'}).screenshot({path:'/private/tmp/jcard-enrichment-review.png'});
  await page.getByRole('button',{name:'确认补足信息',exact:true}).click();
  const partial=await save();assert.equal(partial.data.releaseDate,'2002');assert.equal(partial.data.title,before.data.title);assert.deepEqual(partial.data.sideA,before.data.sideA);assert.equal(partial.coverImage,before.coverImage);assert.equal(partial.coverImageB,before.coverImageB);assert.equal(partial.imagePrompt,before.imagePrompt);assert.equal(partial.data.coverBadge,before.data.coverBadge);
  const vision=requests.filter(request=>request.method==='POST');assert.equal(vision.length,1);const input=JSON.parse(vision[0].body);assert.equal(input.messages[0].content.filter(part=>part.type==='image_url').length,1);assert.equal(vision[0].body.includes('PRIVATE'),false);assert.equal(requests.some(request=>request.url.includes('coverartarchive')),false);
  console.log('PASS one-image recognition, automatic unique match, empty-only defaults and partial import preservation');
  multiple=true;await panel.getByRole('button',{name:'智能补足信息'}).click();
  await page.getByRole('button',{name:/^2002.*Official/}).waitFor();assert.equal(await page.getByRole('button',{name:'确认补足信息',exact:true}).count(),0);
  await page.getByRole('button',{name:/^2002.*Official/}).click();await page.getByRole('button',{name:'确认补足信息',exact:true}).waitFor();
  for (const label of ['专辑标题','艺术家','曲目、分面与内容模式']) await page.getByLabel(`补足${label}`,{exact:true}).check();
  await page.getByRole('button',{name:'确认补足信息',exact:true}).click();
  const full=await save();assert.equal(full.data.title,'Test Album');assert.equal(full.data.artist,'Test Artist');assert.equal(full.data.sideA.length+full.data.sideB.length,2);assert.equal(full.coverImage,before.coverImage);assert.equal(full.data.musicbrainz.releaseId,id(2));
  console.log('PASS multiple editions require choice; explicitly selected replacements and provenance persist');
  hold=true;await panel.getByRole('button',{name:'智能补足信息'}).click();while(!releasePending)await new Promise(resolve=>setTimeout(resolve,20));
  await page.locator('input[type=text]').first().fill('Edited while identifying');releasePending();hold=false;await page.waitForTimeout(300);assert.equal(await page.getByRole('dialog').count(),0);
  blank=true;const searchCount=requests.filter(request=>request.url.includes('musicbrainz.org')).length;await panel.getByRole('button',{name:'智能补足信息'}).click();await page.getByText('封面没有清晰文字',{exact:true}).waitFor();assert.equal(requests.filter(request=>request.url.includes('musicbrainz.org')).length,searchCount);await page.getByLabel('搜索专辑标题').fill('Manual correction');await page.getByRole('button',{name:'搜索',exact:true}).click();await page.getByRole('button',{name:/^Test Album.*Test Artist/}).waitFor();await page.getByRole('button',{name:'关闭 MusicBrainz'}).click();
  hold=true;releasePending=undefined;await panel.getByRole('button',{name:'智能补足信息'}).click();while(!releasePending)await new Promise(resolve=>setTimeout(resolve,20));
  await panel.getByRole('button',{name:'取消识别'}).click();releasePending();hold=false;await page.waitForTimeout(300);assert.equal(await page.getByRole('dialog').count(),0);
  assert.deepEqual(errors,[]); console.log('PASS stale recognition ignored, blank recognition allows manual correction, explicit cancellation; zero page errors');
 } finally {releasePending?.();await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

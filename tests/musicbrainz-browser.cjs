const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
(async () => {
  const { serializeProject } = await import(pathToFileURL(path.resolve('src/project/projectFormat.mjs')));
  const fixture = JSON.parse(await fs.readFile('tests/fixtures/musicbrainz.json', 'utf8'));
  const id = n => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
  const solo = { ...fixture.groups.solo, 'first-release-date': '2020' };
  const release = { id: id(1), title: 'Solo', date: '2023', 'artist-credit': solo['artist-credit'], 'label-info': [{ label: { name: 'Test Label' }, 'catalog-number': 'TEST-01' }], media: [{ position: 1, format: 'CD', 'track-count': 2, tracks: [2,3].map((n,i) => ({ id: id(n+10), title: `Sonata: ${i+1}. Movement`, number: String(i+1), position: i+1, length: 180000, recording: { id: id(n+20), relations: [{ 'target-type': 'work', type: 'performance', work: { id: id(n), title: 'Movement' } }, { type: 'instrument', attributes: ['violin'], artist: { id: id(88), name: 'Isabelle Faust' } }] } })) }] };
  const works = new Map(fixture.brightRelease.media.flatMap(m=>m.tracks.flatMap(t=>(t.recording.relations||[]).filter(r=>r.work).map(r=>[r.work.id,r.work]))));
  let failDetails = false, delayDetails = false, delaySearch = false;
  const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1450, height: 1000 } });
  const errors=[]; page.on('pageerror', e=>errors.push(e.message));
  await page.route('https://musicbrainz.org/**', async route => {
    const u = new URL(route.request().url());
    const send = (body,status=200) => route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)}).catch(()=>{});
    if (u.pathname.endsWith('/release-group') && delaySearch && u.searchParams.get('query').includes('Solo')) await new Promise(r=>setTimeout(r,700));
    if (u.pathname.endsWith('/release-group')) return send({count:1,'release-groups':[u.searchParams.get('query').includes('Bright')?fixture.groups.bright:solo]});
    if (u.pathname.endsWith('/release')) {
      const bright=u.searchParams.get('release-group')===fixture.groups.bright.id;
      return send({'release-count':1,releases:[{id:bright?fixture.brightRelease.id:id(1),title:bright?'Bright Size Life':'Solo',date:bright?'2016-10-26':'2023',status:'Official',country:'JP',media:[{format:'CD','track-count':bright?8:2}]}]});
    }
    if (u.pathname.includes('/release/')) {
      if(delayDetails) await new Promise(r=>setTimeout(r,700));
      if(failDetails)return send({error:'busy'},503);
      return send(u.pathname.endsWith(id(1))?structuredClone(release):structuredClone(fixture.brightRelease));
    }
    const workId=u.pathname.split('/').at(-1);
    if(works.has(workId))return send(works.get(workId));
    return send(workId===id(10)?{id:id(10),title:'Sonata',relations:[{type:'composer',artist:{id:id(99),name:'Composer'}}]}:{id:workId,title:'Movement',relations:[{'target-type':'work',type:'parts',direction:'backward',work:{id:id(10),title:'Sonata'}}]});
  });
  await page.route('https://coverartarchive.org/**', route=>route.fulfill({status:404,contentType:'application/json',body:'{}'}));
  try {
    await page.goto(process.env.JCARD_TEST_URL || 'http://127.0.0.1:5187');
    await page.getByRole('button',{name:'打开作品',exact:true}).waitFor();
    const png=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=2;canvas.height=2;canvas.getContext('2d').fillRect(0,0,2,2);return canvas.toDataURL();});
    const initial=serializeProject({data:{title:'KEEP ME',sideA:[{id:'old',title:'Old Track',artist:'Old',duration:'1:00'}],sideB:[]},coverImage:png,coverImageB:png,recordingData:{recDate:'1994-08-01'}});
    async function openFile(content){const choose=page.waitForEvent('filechooser');await page.getByRole('button',{name:'打开作品',exact:true}).click();await(await choose).setFiles({name:'test.jcard',mimeType:'application/json',buffer:Buffer.from(content)});}
    await openFile(initial);
    const title=page.locator('input[type=text]').first();await page.waitForFunction(()=>document.querySelector('input[type=text]')?.value==='KEEP ME');
    const open=()=>page.getByRole('button',{name:'搜索 MusicBrainz',exact:true}).click();
    async function findSolo(){await page.getByLabel('搜索专辑标题',{exact:true}).fill('Solo');await page.getByLabel('搜索艺术家',{exact:true}).fill('Isabelle Faust');await page.getByRole('button',{name:'搜索',exact:true}).click();await page.getByRole('button',{name:/^Solo.*Nicola/}).click();}
    const orphanTypes = await page.evaluate(async () => { const { default: engine } = await import('/src/utils/LayoutEngine.js'); return engine.groupTracksNested(['Long Shared Sonata: I. Allegro', 'Long Shared Sonata: II. Adagio'].map(title => ({ title, musicbrainz: {} }))).map(t => t.type); });
    assert.deepEqual(orphanTypes, ['track', 'track']);
    delaySearch=true;await open();await page.getByLabel('搜索专辑标题',{exact:true}).fill('Solo');await page.getByRole('button',{name:'搜索',exact:true}).click();await page.getByLabel('搜索专辑标题',{exact:true}).fill('Bright Size Life');await page.getByRole('button',{name:'搜索',exact:true}).click();await page.getByRole('button',{name:/^Bright Size Life.*Pat Metheny/}).waitFor();assert.equal(await page.getByRole('button',{name:/^Solo.*Nicola/}).count(),0);await page.getByRole('button',{name:'关闭 MusicBrainz'}).click();delaySearch=false;
    console.log('PASS superseded search is isolated; missing MB work relationships never use title-only grouping');
    failDetails=true;await open();await findSolo();await page.getByRole('button',{name:/^2023.*Official/}).click();await page.getByRole('alert').filter({hasText:'503'}).waitFor({timeout:20000});assert.equal(await title.inputValue(),'KEEP ME');await page.getByRole('button',{name:'关闭 MusicBrainz'}).click();
    console.log('PASS HTTP 503 leaves existing project unchanged');
    failDetails=false;delayDetails=true;await open();await findSolo();await page.getByRole('button',{name:/^2023.*Official/}).click();await page.getByRole('button',{name:'关闭 MusicBrainz'}).click();await page.waitForTimeout(1000);assert.equal(await title.inputValue(),'KEEP ME');assert.equal(await page.getByRole('dialog').count(),0);delayDetails=false;
    console.log('PASS closing modal cancels late import');
    await open();await findSolo();await page.getByRole('button',{name:/^2023.*Official/}).click();await page.getByRole('button',{name:'确认导入 2 首曲目'}).waitFor({timeout:20000});
    assert.equal(await title.inputValue(),'KEEP ME');assert.ok((await page.getByLabel('导入显示署名').inputValue()).includes('Isabelle Faust'));
    await page.getByRole('button',{name:'使用明确演奏者'}).click();await page.getByLabel('导入日期类型').selectOption('first');
    await page.getByLabel('每面容量',{exact:true}).fill('1');assert.equal(await page.getByRole('button',{name:'确认导入 2 首曲目'}).isDisabled(),true);await page.getByLabel('每面容量',{exact:true}).fill('45');await page.getByLabel('分面位置',{exact:true}).selectOption('1');
    await page.screenshot({path:'/private/tmp/jcard-musicbrainz-preview.png',fullPage:false});
    await page.getByRole('button',{name:'确认导入 2 首曲目'}).click();await page.waitForFunction(()=>document.querySelector('input[type=text]')?.value==='Solo');
    const download=page.waitForEvent('download');await page.getByRole('button',{name:'保存作品',exact:true}).click();const file=await download;const content=await fs.readFile(await file.path(),'utf8');const saved=JSON.parse(content).project;
    assert.equal(saved.coverImage,null);assert.equal(saved.coverImageB,null);assert.equal(saved.data.artist,'Isabelle Faust');assert.equal(saved.data.releaseDate,'2020');assert.equal(saved.data.musicbrainz.editionDate,'2023');assert.equal(saved.data.musicbrainz.artistCredit.at(-1).name,'Isabelle Faust');assert.equal(saved.data.sideA.length,1);assert.equal(saved.data.sideB.length,1);assert.equal(saved.recordingData.recDate,'1994-08-01');
    await page.getByText('草稿已自动保存', { exact: true }).waitFor();
    await page.reload();await page.getByRole('button',{name:'放弃草稿',exact:true}).click();await openFile(content);await page.waitForFunction(()=>document.querySelector('input[type=text]')?.value==='Solo');
    console.log('PASS reviewed import clears old covers, persists complete credits/source/roles and restores project');
    await open();await page.getByLabel('搜索专辑标题',{exact:true}).fill('Bright Size Life');await page.getByLabel('搜索艺术家',{exact:true}).fill('Pat Metheny');await page.getByRole('button',{name:'搜索',exact:true}).click();await page.getByRole('button',{name:/^Bright Size Life.*Pat Metheny/}).click();await page.getByRole('button',{name:/^2016-10-26.*Official/}).click();await page.getByRole('button',{name:'确认导入 8 首曲目'}).waitFor({timeout:30000});assert.equal(await page.getByLabel('导入内容模式').inputValue(),'STANDARD');assert.equal(await title.inputValue(),'Solo');
    console.log('PASS real ECM fixture with work relationships previews as STANDARD');assert.deepEqual(errors,[]);console.log('PASS zero page errors');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});

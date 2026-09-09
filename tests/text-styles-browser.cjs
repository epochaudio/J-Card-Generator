const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
(async () => {
 const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
 const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
 page.setDefaultTimeout(60000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try {
  await page.goto(process.env.JCARD_TEST_URL || 'http://127.0.0.1:52180');
  const result=await page.evaluate(async()=>{
   const {normalizeSnapshot,serializeProject}=await import('/src/project/projectFormat.mjs');
   const {projectStorage}=await import('/src/project/projectStorage.mjs');
   const {defaultTextStyles,typographyFont}=await import('/src/config/textStyles.mjs');
   const {getFontConfig}=await import('/src/config/fonts.js');
   const {panelColors}=await import('/tests/fixtures/panelColors.mjs');
   const {renderDesign}=await import('/src/design/renderDesign.jsx');
   const {computeFrontLayout}=await import('/src/utils/FrontLayout.js');
   const {default:TypographyService}=await import('/src/services/TypographyService.js');
   const canvas=document.createElement('canvas');canvas.width=canvas.height=500;
   const ctx=canvas.getContext('2d');ctx.fillStyle='#24433F';ctx.fillRect(0,0,500,500);ctx.fillStyle='#C8A66A';ctx.beginPath();ctx.arc(340,160,65,0,Math.PI*2);ctx.fill();
   const typography=defaultTextStyles('editorial');
   typography.title={weight:700,slant:8,width:0.9};typography.artist={weight:500,slant:4,width:1.03};typography.subtitle={weight:400,slant:-4,width:1};typography.badge={weight:500,slant:6,width:1.02};typography.track={weight:600,slant:2,width:1.02};typography.note={weight:400,slant:-2,width:0.98};
   const snapshot=normalizeSnapshot({data:{title:'海岸 Coast',artist:'林间 Quartet',coverBadge:'PRIVATE SESSION',tapeId:'C-042',releaseDate:'2001-01-01',sideA:[{id:'a',title:'潮汐 Tides',duration:'3:20',note:'现场录音'}],sideB:[{id:'b',title:'晚风 Evening wind',duration:'4:10'}],layout:{frontStyle:'EDITORIAL',noteUpper:'ARCHIVE',noteLower:'STEREO'}},theme:{paletteId:'custom',colors:panelColors(),mood_description:'Evening edition',typography},fontTheme:'editorial',coverImage:canvas.toDataURL(),recordingData:{source:'Vinyl',equipment:'Test Deck',recDate:'2026-09-09',labelOverride:'Coast Recordings'}});
   const rendered=await renderDesign(snapshot);
   const config={...getFontConfig('editorial'),typography};
   const baseFont=typographyFont(config,'title');
   const narrow={...baseFont,style:{...baseFont.style,width:0.8}},wide={...baseFont,style:{...baseFont.style,width:1.2}};
   const long='海岸上的夜色与回声 Coast at night';
   const narrowLines=TypographyService.wrapMeasuredText(long,narrow,70,400);
   const wideLines=TypographyService.wrapMeasuredText(long,wide,70,400);
   const narrowWidth=TypographyService.measureWidth(long,narrow,70),wideWidth=TypographyService.measureWidth(long,wide,70);
   const heavy=TypographyService.measureWidth('录音 Album', {...baseFont,style:{weight:700,slant:0,width:1}},70);
   const regular=TypographyService.measureWidth('录音 Album',{...baseFont,style:{weight:400,slant:0,width:1}},70);
   await projectStorage.writeDraft(serializeProject(snapshot));
   window.typographyTestSnapshot=snapshot;window.typographyTestPreview=rendered.preview;
   return {failures:rendered.failures,styles:typography,narrowLines:narrowLines.length,wideLines:wideLines.length,narrowWidth,wideWidth,heavy,regular,blocks:computeFrontLayout(snapshot.data,config,snapshot.theme).blocks.map(b=>b.role)};
  });
  assert.deepEqual(result.failures,[]);assert.ok(result.wideWidth>result.narrowWidth);assert.ok(result.wideLines>result.narrowLines);assert.notEqual(result.heavy,result.regular);assert.ok(result.blocks.includes('subtitle'));
  // Restore through the normal UI; compare it with the independently rendered candidate.
  const preview=await page.evaluate(()=>window.typographyTestPreview);
  await page.reload();await page.getByRole('button',{name:'恢复草稿',exact:true}).click();
  await page.locator('text[data-text-role="title"]').first().waitFor();
  const title=page.locator('[data-typography-panel="front"] text[data-text-role="title"]').first();
  assert.equal(await title.getAttribute('font-weight'),'700');assert.match(await title.getAttribute('transform'),/matrix\(0.9 /);
  assert.equal(await title.getAttribute('font-style'),'normal');
  const save=async()=>{const event=page.waitForEvent('download');await page.getByRole('button',{name:'保存作品',exact:true}).click();return JSON.parse(await fs.readFile(await(await event).path(),'utf8')).project;};
  assert.deepEqual((await save()).theme.typography,result.styles);
  await page.locator('svg').filter({has:page.locator('[data-typography-panel="front"]')}).screenshot({path:'/private/tmp/jcard-text-styles.png'});
  const event=page.waitForEvent('download');await page.getByRole('button',{name:'导出 PNG',exact:true}).click();
  const bytes=await fs.readFile(await(await event).path());
  const delta=await page.evaluate(async([a,b])=>{
   const pixels=async src=>{const i=new Image();i.src=src;await i.decode();const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const x=c.getContext('2d');x.drawImage(i,0,0);return x.getImageData(0,0,c.width,c.height).data;};
   const x=await pixels(a),y=await pixels(b);let sum=0;for(let i=0;i<x.length;i++)sum+=Math.abs(x[i]-y[i]);return sum/x.length;
  },[preview,`data:image/png;base64,${bytes.toString('base64')}`]);
  assert.ok(delta<1,`PNG mismatch ${delta}`);
  // Validate archive typography, then prove overflow and overlap block export.
  await page.getByRole('button',{name:'档案信息',exact:true}).click();
  const archive=await page.evaluate(async()=>{
   const {applyTextTransforms,checkTextTransforms}=await import('/src/services/TextTransform.js');
   const svg=document.querySelector('[data-typography-panel="front"]').ownerSVGElement;
   applyTextTransforms(svg);return checkTextTransforms(svg);
  });assert.deepEqual(archive,[]);
  const blocked=await page.evaluate(async()=>{
   const {default:ExportService}=await import('/src/services/ExportService.js');const {getFontConfig}=await import('/src/config/fonts.js');
   const svg=document.querySelector('[data-typography-panel="front"]').ownerSVGElement;
   const title=svg.querySelector('[data-typography-panel="front"] text');
   title.setAttribute('x','-1000');
   try{await ExportService.serializeSVG(svg,getFontConfig('editorial'));return false;}catch(e){return e.message.includes('超出面板');}
  });assert.equal(blocked,true);
  const collision=await page.evaluate(async()=>{
   const {default:ExportService}=await import('/src/services/ExportService.js');const {getFontConfig}=await import('/src/config/fonts.js');
   const svg=document.querySelector('[data-typography-panel="front"]').ownerSVGElement;
   const title=svg.querySelector('[data-typography-panel="front"] text'); title.setAttribute('x','54');
   const duplicate=title.cloneNode(true);title.parentNode.appendChild(duplicate);
   try{await ExportService.serializeSVG(svg,getFontConfig('editorial'));return false;}catch(e){return e.message.includes('重叠');}finally{duplicate.remove();}
  });assert.equal(collision,true);
  await page.getByRole('button',{name:'恢复默认文字样式',exact:true}).click();
  assert.equal(await page.locator('text[data-text-style]').count(),0);
  assert.equal(await page.locator('[data-typography-panel="front"] text[transform*="matrix"]').count(),0);
  assert.equal(await page.locator('[data-front-role="title"] text').first().getAttribute('font-weight'),'600');
  assert.equal((await save()).theme.typography,undefined);
  assert.deepEqual(errors,[]);
  console.log('PASS weight-aware wrapping, geometric slant/stretch, distinct subtitle, archive bounds, save/restore, SVG/PNG parity, overflow export gate and reset; no page errors');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

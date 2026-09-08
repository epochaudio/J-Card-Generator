const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
(async () => {
 const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
 const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
 page.setDefaultTimeout(60000);
 const errors = [], requests = []; let hold = false, release, badColors = false, persistentFailure = false, holdRepair = false;
 page.on('pageerror', error => errors.push(error.message));
 const { panelColors } = await import('./fixtures/panelColors.mjs');
 const { resolvePanelColors } = await import('../src/config/design.mjs');
 const candidates = [
  { direction: 'harmony', fontTheme: 'editorial', paletteId: 'custom', colors: panelColors(), frontStyle: 'EDITORIAL', titleSize: 'balanced', reason: '暖暗底色呼应画面中的晚霞，衬线标题延续安静气质。' },
  { direction: 'title', fontTheme: 'modern', paletteId: 'custom', colors: resolvePanelColors({ paletteId: 'paper' }), frontStyle: 'STANDARD', titleSize: 'expressive', reason: '浅色背景和醒目标题形成清晰的主次。' },
  { direction: 'reading', fontTheme: 'retro', paletteId: 'custom', colors: resolvePanelColors({ paletteId: 'cool' }), frontStyle: 'EDITORIAL', titleSize: 'compact', reason: '克制标题与冷灰色板使曲目阅读更加平静。' }
 ];
 await page.route('https://**/*', async route => {
  if (route.request().method() !== 'POST') return route.abort();
  const body = JSON.parse(route.request().postData()); requests.push(body);
  const prompt = body.messages[0].content[0].text;
  const repair = prompt.includes('"previous":');
  if (hold || (holdRepair && repair)) await new Promise(resolve => { release = resolve; });
  const locked = prompt.includes('"palette":{"paletteId":"paper"');
  const lockedCustom = prompt.includes('"palette":{"paletteId":"custom"');
  let responseCandidates = locked ? [{ ...candidates[1], fontTheme: 'modern', paletteId: 'paper', colors: null }]
    : lockedCustom ? candidates.map(item => ({ ...item, colors: panelColors() })) : structuredClone(candidates);
  if (badColors && (!repair || persistentFailure)) responseCandidates = responseCandidates.map(item => {
    const colors = structuredClone(item.colors); colors.back.note = colors.back.background;
    return { ...item, colors };
  });
  await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: JSON.stringify({ candidates: responseCandidates }) }, finish_reason: 'stop' }] }) }).catch(() => {});
 });
 const panel = page.getByRole('region', { name: '智能搭配', exact: true });
 const save = async () => {
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: '保存作品', exact: true }).click();
  return JSON.parse(await fs.readFile(await (await pending).path(), 'utf8')).project;
 };
 try {
  await page.goto(process.env.JCARD_TEST_URL || 'http://127.0.0.1:5187');
  await page.getByRole('button', { name: '打开作品', exact: true }).waitFor();
  await page.evaluate(async provider => {
   const { normalizeSnapshot, serializeProject } = await import('/src/project/projectFormat.mjs');
   const { projectStorage } = await import('/src/project/projectStorage.mjs');
   const { normalizeAISettings } = await import('/src/ai/providerConfig.mjs');
   const canvas = document.createElement('canvas'); canvas.width = canvas.height = 500;
   const ctx = canvas.getContext('2d'); const gradient = ctx.createLinearGradient(0, 0, 500, 500);
   gradient.addColorStop(0, '#dea769'); gradient.addColorStop(1, '#273b40'); ctx.fillStyle = gradient; ctx.fillRect(0,0,500,500);
   ctx.fillStyle = '#e9ce99'; ctx.beginPath(); ctx.arc(340,160,65,0,Math.PI*2); ctx.fill();
   const source = normalizeSnapshot({ data: { title: '夜色与回声', artist: '林间 Quartet', sideA: [{ id: 'a', title: '回声 Echo', duration: '3:25' }], sideB: [{ id: 'b', title: '晚风', duration: '4:12' }] }, theme: { paletteId: 'paper' }, fontTheme: 'modern', coverImage: canvas.toDataURL() });
   await projectStorage.writeDraft(serializeProject(source));
   localStorage.setItem('jcard_ai_settings_v1', JSON.stringify(normalizeAISettings({ version: 3, visionProvider: provider, providers: { [provider]: { apiKey: 'test-vision-only', visionModel: provider === 'deepseek' ? 'deepseek-v4.1-flash-expires-on-0910' : 'qwen3-vl-plus' } } })));
  }, process.env.JCARD_VISION_PROVIDER || 'aliyun');
  await page.reload(); await page.getByRole('button', { name: '恢复草稿', exact: true }).click();
  await panel.getByRole('button', { name: '生成三套搭配', exact: true }).waitFor();
  const before = await save();
  await panel.getByRole('button', { name: '生成三套搭配', exact: true }).click();
  await panel.getByText('三套搭配已准备好，预览后选择应用。', { exact: true }).waitFor();
  assert.equal(await page.locator('[data-smart-candidate]').count(), 3);
  const previewSource = await page.locator('[data-smart-candidate="harmony"] img').getAttribute('src');
  const bodyInk = await page.evaluate(async source => {
   const image = new Image(); image.src = source; await image.decode();
   const canvas = document.createElement('canvas'); canvas.width = 1748; canvas.height = 1181; const ctx = canvas.getContext('2d'); ctx.drawImage(image,0,0);
   const pixels = ctx.getImageData(404,1020,300,45).data;
   let ink = 0; for (let i=0;i<pixels.length;i+=4) if (pixels[i]>140 && pixels[i+1]>140) ink++;
   return ink;
  }, previewSource);
  assert.ok(bodyInk > 100, 'artist body text must be painted in the candidate PNG');
  assert.equal(requests.length, 1); assert.equal(requests[0].messages[0].content.filter(x => x.type === 'image_url').length, 3);
  assert.deepEqual(await save(), before);
  await panel.getByRole('button', { name: '放大延续原封面', exact: true }).click();
  await page.getByRole('dialog', { name: '搭配放大预览' }).screenshot({ path: '/private/tmp/jcard-smart-preview.png' });
  await page.getByRole('button', { name: '关闭预览', exact: true }).click();
  await page.locator('[data-smart-candidate="harmony"]').getByRole('button', { name: '应用这套' }).click();
  const applied = await save(); assert.equal(applied.fontTheme, 'editorial'); assert.equal(applied.theme.paletteId, 'custom'); assert.deepEqual(applied.theme.colors, panelColors());
  assert.equal(await page.locator('[data-smart-candidate]').count(), 3);
  for (const [name, colors] of Object.entries(panelColors())) {
    assert.equal(await page.locator(`svg [data-panel-background="${name}"]`).first().getAttribute('fill'), colors.background);
  }
  for (const [name, expected] of [['front.title', panelColors().front.title], ['back.track', panelColors().back.track], ['back.duration', panelColors().back.duration], ['shortBack.badgeText', panelColors().shortBack.badgeText], ['spine.title', panelColors().spine.title]]) {
    assert.equal(await page.locator(`svg [data-color-role="${name}"]`).first().getAttribute('fill'), expected);
  }
  assert.equal(applied.coverImage, before.coverImage);
  const pngPending = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 PNG', exact: true }).click();
  const pngBytes = await fs.readFile(await (await pngPending).path());
  const difference = await page.evaluate(async ([preview, exported]) => {
   const read = async source => { const image = new Image(); image.src = source; await image.decode(); const canvas = document.createElement('canvas'); canvas.width=1748;canvas.height=1181;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);return ctx.getImageData(0,0,1748,1181).data; };
   const a=await read(preview), b=await read(exported);let total=0;for(let i=0;i<a.length;i++)total+=Math.abs(a[i]-b[i]);return total/a.length;
  }, [previewSource, `data:image/png;base64,${pngBytes.toString('base64')}`]);
  assert.ok(difference < 1, 'applied PNG export must match candidate rendering');
  await page.getByPlaceholder('标题', { exact: true }).first().fill('后续曲目修改');
  await panel.getByRole('button', { name: '撤销本次搭配', exact: true }).click();
  const undone = await save(); assert.equal(undone.fontTheme, before.fontTheme); assert.equal(undone.theme.paletteId, before.theme.paletteId); assert.equal(undone.data.sideA[0].title, '后续曲目修改');
  assert.equal(await page.locator('[data-smart-candidate]').count(), 0);
  hold = true; await panel.getByRole('button', { name: '生成三套搭配', exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes('视觉模型正在根据素材设计'));
  while (!release) await new Promise(resolve => setTimeout(resolve, 20));
  await page.getByPlaceholder('标题', { exact: true }).first().fill('请求期间编辑');
  release(); hold = false; await page.waitForTimeout(500);
  assert.equal(await page.locator('[data-smart-candidate]').count(), 0);
  assert.equal(await panel.getByRole('button', { name: '取消生成' }).count(), 0);
  await panel.getByLabel('锁定字体', { exact: true }).check();
  await panel.getByLabel('锁定配色', { exact: true }).check();
  await panel.getByRole('button', { name: '生成三套搭配', exact: true }).click();
  await panel.getByText('仅 1 套通过检查，其他方向未能提供有效且不同的组合。', { exact: true }).waitFor();
  assert.equal(await page.locator('[data-smart-candidate]').count(), 1);
  assert.match(requests.at(-1).messages[0].content[0].text, /"locked":\{"fontTheme":"modern","palette":/);
  // Reopen the saved complete scheme with richer text, checking real SVG role paint.
  const reopened = structuredClone(applied);
  reopened.theme.mood_description = 'Evening edition'; reopened.data.coverBadge = 'PRIVATE COLLECTION';
  reopened.data.layout.mode = 'COMPILATION'; reopened.data.layout.noteUpper = 'ARCHIVE'; reopened.data.layout.noteLower = 'STEREO';
  reopened.data.tapeId = 'C-042'; reopened.data.sideA[0].artist = 'A very long artist name with many repeated words and a final suffix'; reopened.data.sideA[0].note = 'Live session';
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '打开作品', exact: true }).click();
  await (await chooser).setFiles({ name: 'AI-colors.jcard', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ format: 'jcard-project', version: 3, project: reopened })) });
  await page.getByRole('button', { name: '放弃修改', exact: true }).click();
  await page.locator('[data-color-role="front.subtitle"]').waitFor();
  assert.deepEqual((await save()).theme.colors, panelColors());
  for (const [role, expected] of [['front.subtitle', panelColors().front.subtitle], ['front.badge', panelColors().front.badge], ['front.badgeBackground', panelColors().front.badgeBackground], ['back.artist', panelColors().back.artist], ['back.note', panelColors().back.note], ['spine.noteUpper', panelColors().spine.note], ['spine.tapeId', panelColors().spine.id]]) {
    assert.equal(await page.locator(`[data-color-role="${role}"]`).first().getAttribute('fill'), expected);
  }
  await page.locator('svg').filter({ has: page.locator('[data-panel-background="front"]') }).screenshot({ path: '/private/tmp/jcard-ai-colors-rich.png' });
  await panel.getByLabel('锁定配色', { exact: true }).check();
  await panel.getByRole('button', { name: '生成三套搭配', exact: true }).click();
  await page.locator('[data-smart-candidate]').first().waitFor();
  assert.ok(requests.at(-1).messages[0].content[0].text.includes(JSON.stringify(panelColors())));
  await page.locator('[data-smart-candidate="title"]').getByRole('button', { name: '应用这套' }).click();
  assert.deepEqual((await save()).theme.colors, panelColors());
  await panel.getByRole('button', { name: '撤销本次搭配' }).click();
  assert.deepEqual((await save()).theme.colors, panelColors());
  await panel.getByLabel('锁定配色', { exact: true }).uncheck();
  badColors = true; const beforeRepair = requests.length;
  await panel.getByRole('button', { name: '生成三套搭配', exact: true }).click();
  await page.locator('[data-smart-candidate]').first().waitFor();
  assert.equal(requests.length - beforeRepair, 2); assert.match(requests.at(-1).messages[0].content[0].text, /back.note/);
  assert.deepEqual((await save()).theme.colors, panelColors());
  persistentFailure = true;
  await panel.getByRole('button', { name: '生成三套搭配', exact: true }).click();
  await panel.getByRole('status').filter({ hasText: '没有通过检查的方案' }).waitFor();
  assert.equal(await page.locator('[data-smart-candidate]').count(), 0);
  persistentFailure = false; holdRepair = true; release = null;
  await panel.getByRole('button', { name: '生成三套搭配', exact: true }).click();
  await panel.getByRole('status').filter({ hasText: 'AI 正在根据检查结果修订' }).waitFor();
  while (!release) await new Promise(resolve => setTimeout(resolve, 20));
  await panel.getByRole('button', { name: '取消生成' }).click(); release(); holdRepair = false;
  await panel.getByRole('status').filter({ hasText: '已取消智能搭配' }).waitFor();
  assert.equal(await page.locator('[data-smart-candidate]').count(), 0);
  assert.deepEqual((await save()).theme.colors, panelColors());
  assert.deepEqual(errors, []);
  console.log('PASS panel/role colors, original image, PNG parity, save/reopen, complete palette lock/undo, bounded repair, persistent failure, repair cancellation, stale response rejection; zero page errors');
 } finally { release?.(); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

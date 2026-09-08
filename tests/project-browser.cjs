const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true});
 const page=await browser.newPage({viewport:{width:1400,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base=process.env.JCARD_TEST_URL || 'http://127.0.0.1:5187';
 try {
  await page.goto(base);
  await page.waitForFunction(()=>!document.body.innerText.includes('正在检查草稿'));
  const title=page.locator('input[type=text]').first();
  await title.fill('浏览器草稿');
  await page.getByText('草稿已自动保存',{exact:true}).waitFor();
  await page.reload();
  await page.getByRole('button',{name:'恢复草稿',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('input[type=text]').value==='浏览器草稿');
  const pending=page.waitForEvent('download');
  await page.getByRole('button',{name:'保存作品',exact:true}).click();
  const download=await pending;
  const content=JSON.parse(await fs.readFile(await download.path(),'utf8'));
  assert.equal(content.project.data.title,'浏览器草稿');
  assert.equal(download.suggestedFilename(),'浏览器草稿.jcard');
  await page.getByRole('alert').filter({hasText:'草稿继续保留'}).waitFor();
  await page.reload();
  await page.getByRole('button',{name:'放弃草稿',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('input[type=text]').value==='ALBUM TITLE');
  const chooser=page.waitForEvent('filechooser');
  await page.getByRole('button',{name:'打开作品',exact:true}).click();
  await (await chooser).setFiles({name:'浏览器草稿.jcard',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(content))});
  await page.waitForFunction(()=>document.querySelector('input[type=text]').value==='浏览器草稿');
  assert.deepEqual(errors,[]);
  console.log('PASS browser IndexedDB restore/discard, portable download/open; no page errors');
 } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exit(1);});

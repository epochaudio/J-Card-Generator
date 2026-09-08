const { _electron } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const path = require('node:path');
(async () => {
 const root = process.cwd();
 const dir = await fs.mkdtemp('/private/tmp/jcard-ui-');
 const appCopy = path.join(dir, 'Test.app');
 require('node:child_process').execFileSync('cp', ['-cR', process.env.ELECTRON_TEST_SOURCE_APP || path.join(root,'dist_electron_macos_arm64/Tape Cover Generator.app'), appCopy]);
 const resources = path.join(appCopy,'Contents/Resources');
 await fs.rename(path.join(resources,'app.asar'), path.join(dir,'original-app.asar'));
 await fs.mkdir(path.join(resources,'app'));
 await fs.writeFile(path.join(resources,'app/package.json'),JSON.stringify({name:'jcard-test',main:'main.cjs'}));
 const wrapper = path.join(resources, 'app/main.cjs');
 await fs.writeFile(wrapper, `require('electron').app.setPath('userData', ${JSON.stringify(dir)}); require(${JSON.stringify(path.join(root,'electron/main.js'))});`);
 const app = await _electron.launch({ executablePath: path.join(appCopy,'Contents/MacOS/Tape Cover Generator'), args: [], env: {...process.env, ELECTRON_START_URL:'http://127.0.0.1:5187'}, timeout:20000 });
 console.log('Electron', await app.evaluate(() => process.versions.electron));
 try {
 const page = await app.firstWindow();
 const errors = []; page.on('pageerror', e => errors.push(e.message));
 await page.getByRole('button',{name:'保存作品',exact:true}).waitFor();
 await page.waitForFunction(() => !document.body.innerText.includes('正在检查草稿'));
 // Exercise all provider settings with isolated dummy credentials (no network calls).
 await page.getByRole('button',{name:'AI 服务设置',exact:true}).click();
 const providers = [['阿里云百炼','aliyun'],['火山引擎（火山方舟）','volcengine'],['MiniMax','minimax']];
 for (const [name,id] of providers) {
   await page.getByRole('tab',{name,exact:true}).click();
   await page.getByLabel(`${name} API Key`,{exact:true}).fill(`test-${id}-secret`);
   if (id==='volcengine') {
     await page.getByLabel(`${name} 文本模型`,{exact:true}).fill('ep-test-text');
     await page.getByLabel(`${name} 图片模型`,{exact:true}).fill('ep-test-image');
   }
   assert.match(await page.getByRole('dialog').innerText(), /订阅包.*Coding Plan/);
 }
 await page.getByLabel('文本服务商',{exact:true}).selectOption('volcengine');
 await page.getByLabel('图片服务商',{exact:true}).selectOption('minimax');
 await page.getByRole('button',{name:'保存设置',exact:true}).click();
 await page.getByText('设置已保存；密钥是否有效、账户套餐与余额尚未验证。',{exact:true}).waitFor();
 const encrypted = await fs.readFile(path.join(dir,'secure-store.json'),'utf8');
 for (const [,id] of providers) assert.equal(encrypted.includes(`test-${id}-secret`),false);
 await page.screenshot({path:path.join(dir,'settings.png')});
 await page.getByRole('button',{name:'关闭设置',exact:true}).click();
 await page.reload();
 await page.getByRole('button',{name:'AI 服务设置',exact:true}).click();
 assert.equal(await page.getByLabel('文本服务商',{exact:true}).inputValue(),'volcengine');
 assert.equal(await page.getByLabel('图片服务商',{exact:true}).inputValue(),'minimax');
 for (const [name,id] of providers) {
   await page.getByRole('tab',{name,exact:true}).click();
   assert.equal(await page.getByLabel(`${name} API Key`,{exact:true}).inputValue(),`test-${id}-secret`);
 }
 await page.getByLabel('MiniMax API Key',{exact:true}).fill('discard-me');
 await page.getByRole('button',{name:'关闭设置',exact:true}).click();
 await page.getByRole('button',{name:'AI 服务设置',exact:true}).click();
 assert.equal(await page.getByLabel('MiniMax API Key',{exact:true}).inputValue(),'test-minimax-secret');
 await page.getByRole('button',{name:'关闭设置',exact:true}).click();
 console.log('PASS provider settings, encrypted persistence, reload, selectors, cancelled edit, plan explanation');
 console.log('initial', (await page.locator('body').innerText()).slice(0,350));
 page.setDefaultTimeout(15000);
 const title = page.locator('input[type=text]').first();
 await title.fill('桌面作品一');
 await page.getByText('草稿已自动保存',{exact:true}).waitFor();
 const draft = JSON.parse(await fs.readFile(path.join(dir,'current-project.jcard'),'utf8'));
 assert.equal(draft.project.data.title,'桌面作品一');
 await app.evaluate(({dialog}, output) => { dialog.showSaveDialog = async () => ({canceled:false,filePath:output}); }, path.join(dir,'saved.jcard'));
 await page.getByRole('button',{name:'保存作品',exact:true}).click();
 await page.getByText('saved.jcard · 已保存',{exact:true}).waitFor();
 assert.equal(JSON.parse(await fs.readFile(path.join(dir,'saved.jcard'),'utf8')).project.data.title,'桌面作品一');
 await title.fill('还没保存');
 await page.getByTitle('新建/重置项目',{exact:true}).click();
 await page.getByRole('button',{name:'取消',exact:true}).click();
 assert.equal(await title.inputValue(),'还没保存');
 await page.getByTitle('新建/重置项目',{exact:true}).click();
 await page.getByRole('button',{name:'放弃修改',exact:true}).click();
 await page.waitForFunction(() => document.querySelector('input[type=text]').value==='ALBUM TITLE');
 await app.evaluate(({dialog}, input) => { dialog.showOpenDialog = async () => ({canceled:false,filePaths:[input]}); },path.join(dir,'saved.jcard'));
 await page.getByRole('button',{name:'打开作品',exact:true}).click();
 await page.getByText('saved.jcard · 已保存',{exact:true}).waitFor();
 assert.equal(await title.inputValue(),'桌面作品一');
 await title.fill('草稿恢复作品');
 await page.getByText('草稿已自动保存',{exact:true}).waitFor();
 await page.reload();
 await page.getByRole('button',{name:'恢复草稿',exact:true}).click();
 await page.waitForFunction(() => document.querySelector('input[type=text]').value==='草稿恢复作品');
 await page.getByRole('button',{name:'保存作品',exact:true}).click();
 await page.getByText('saved.jcard · 已保存',{exact:true}).waitFor();
 // Open a complete portable fixture, restore image/color/date, then ensure an old AI task cannot replace it.
 const { serializeProject } = await import(path.join(root,'src/project/projectFormat.mjs'));
 const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=';
 const fixture = serializeProject({ data: { title: '双封面古典', sideA: [{id:'a',title:'第一乐章',duration:'12:30',_workId:'w',_workTitle:'奏鸣曲'}], sideB: [], layout: {mode:'CLASSICAL',frontStyle:'REVERSIBLE'} },
  recordingData:{recDate:'1994-08-01'}, coverImage:png,coverImageB:png,theme:{accent:'#abcdef'},fontTheme:'puhuiti' });
 await fs.writeFile(path.join(dir,'fixture.jcard'),fixture);
 await page.evaluate(async () => { const {aiTransport:service}=await import('/src/ai/aiTransport.mjs'); service.text=()=>new Promise(resolve=>window.finishOldAI=resolve); });
 await page.getByRole('button',{name:'AI 创意总监',exact:true}).click();
 await app.evaluate(({dialog}, input) => { dialog.showOpenDialog=async()=>({canceled:false,filePaths:[input]}); },path.join(dir,'fixture.jcard'));
 await page.getByRole('button',{name:'打开作品',exact:true}).click();
 await page.getByText('fixture.jcard · 已保存',{exact:true}).waitFor();
 await page.evaluate(()=>window.finishOldAI({album_title:'旧任务标题'}));
 await page.waitForFunction(()=>document.querySelector('input[type=color]').value==='#abcdef');
 assert.equal(await title.inputValue(),'双封面古典');
 await page.getByRole('button',{name:'保存作品',exact:true}).click();
 await page.getByText('fixture.jcard · 已保存',{exact:true}).waitFor();
 const reopened=JSON.parse(await fs.readFile(path.join(dir,'fixture.jcard'),'utf8')).project;
 assert.equal(reopened.recordingData.recDate,'1994-08-01');
 assert.equal(reopened.coverImageB,png);
 assert.equal(reopened.theme.accent,'#abcdef');
 // Cancel Save As and then fail a write: both must keep unsaved edits.
 await title.fill('保存失败也保留');
 await app.evaluate(({dialog})=>{dialog.showSaveDialog=async()=>({canceled:true});});
 await page.getByRole('button',{name:'另存为',exact:true}).click();
 await page.getByText('fixture.jcard · 未保存修改',{exact:true}).waitFor();
 await app.evaluate(({dialog}, output)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:output});},path.join(dir,'missing','bad.jcard'));
 await page.getByRole('button',{name:'另存为',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'ENOENT'}).waitFor();
 assert.equal(await title.inputValue(),'保存失败也保留');
 // A malformed file leaves the current project intact.
 await fs.writeFile(path.join(dir,'bad.jcard'),'{');
 await app.evaluate(({dialog}, input)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[input]});},path.join(dir,'bad.jcard'));
 await page.getByRole('button',{name:'打开作品',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'JSON'}).waitFor();
 assert.equal(await title.inputValue(),'保存失败也保留');
 // Native close cancel and save-dialog cancel both preserve the window.
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());
 await page.getByRole('button',{name:'取消',exact:true}).click();
 assert.equal(page.isClosed(),false);
 await app.evaluate(({dialog})=>{dialog.showSaveDialog=async()=>({canceled:true});});
 // Save works against the current authorized target even after failed Save As.
 await page.getByRole('button',{name:'保存作品',exact:true}).click();
 await page.getByText('fixture.jcard · 已保存',{exact:true}).waitFor();
 assert.equal(JSON.parse(await fs.readFile(path.join(dir,'fixture.jcard'),'utf8')).project.data.title,'保存失败也保留');
 await page.screenshot({path:path.join(dir,'desktop.png')});
 assert.deepEqual(errors, []);
 console.log('errors',errors);
 console.log('PASS desktop file lifecycle, draft recovery, failed/cancelled writes, images/date/color, stale AI isolation, close cancellation',dir);
 // Clean test process through the same close flow.
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());
 await page.waitForEvent('close');
 await app.close();
 } finally {
   await app.evaluate(({app})=>app.exit(0)).catch(()=>{});
   await app.close().catch(()=>{});
 }
})().catch(error => { console.error(error); process.exit(1); });

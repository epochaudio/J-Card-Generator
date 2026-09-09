// Runs the delivered macOS app with an isolated profile; no live AI requests.
const { _electron } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

(async () => {
  const appPath = process.env.ELECTRON_TEST_SOURCE_APP;
  if (!appPath) throw new Error('ELECTRON_TEST_SOURCE_APP must name the built macOS app.');
  const output = process.env.PACKAGED_TEST_OUTPUT || await fs.mkdtemp('/private/tmp/tapefolio-packaged-results-');
  await fs.mkdir(output, { recursive: true });
  const profile = await fs.mkdtemp('/private/tmp/tapefolio-packaged-profile-');
  const executable = execFileSync('/usr/libexec/PlistBuddy', ['-c', 'Print :CFBundleExecutable', path.join(appPath, 'Contents/Info.plist')], { encoding: 'utf8' }).trim();
  const app = await _electron.launch({ executablePath: path.join(appPath, 'Contents/MacOS', executable), args: [`--user-data-dir=${profile}`], timeout: 30000 });
  const errors = [];
  try {
    const actualProfile = await app.evaluate(({ app }) => app.getPath('userData'));
    assert.equal(actualProfile, profile);
    const versions = await app.evaluate(() => process.versions);
    const pkg = require('../package.json');
    assert.equal(versions.electron, pkg.devDependencies.electron);
    const page = await app.firstWindow();
    page.on('pageerror', error => errors.push(error.message));
    page.setDefaultTimeout(20000);
    await page.getByRole('button', { name: '保存作品', exact: true }).waitFor();
    assert.ok(page.url().startsWith('file:'));
    await page.waitForFunction(() => !document.body.innerText.includes('正在检查草稿'));
    const { serializeProject } = await import('../src/project/projectFormat.mjs');
    const fixture = path.join(output, 'handwritten.jcard');
    await fs.writeFile(fixture, serializeProject({ fontTheme: 'handwritten', theme: { paletteId: 'paper' },
      data: { title: '我的录音手记', artist: '林间四重奏 Quartet', sideA: [{ id: 'a', title: '晨光微明 Morning', duration: '3:25' }], sideB: [{ id: 'b', title: '夜色与回声 Echo', duration: '4:12' }] } }));
    await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, fixture);
    await page.getByRole('button', { name: '打开作品', exact: true }).click();
    const title = page.locator('input[type=text]').first();
    await page.waitForFunction(() => document.querySelector('input[type=text]').value === '我的录音手记');
    const saved = path.join(output, 'saved.jcard');
    await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, saved);
    await page.getByRole('button', { name: '另存为', exact: true }).click();
    await page.getByText('saved.jcard · 已保存', { exact: true }).waitFor();
    assert.equal(JSON.parse(await fs.readFile(saved, 'utf8')).project.data.title, '我的录音手记');
    await title.fill('保存后重新打开');
    await page.getByRole('button', { name: '保存作品', exact: true }).click();
    await page.getByText('saved.jcard · 已保存', { exact: true }).waitFor();
    await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, fixture);
    await page.getByRole('button', { name: '打开作品', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('input[type=text]').value === '我的录音手记');
    await page.evaluate(async () => { await document.fonts.load('24px "Long Cang"', '我的录音手记'); await document.fonts.ready; });
    const platformFonts = await page.context().newCDPSession(page);
    await platformFonts.send('DOM.enable'); await platformFonts.send('CSS.enable');
    const { root } = await platformFonts.send('DOM.getDocument');
    const { nodeId } = await platformFonts.send('DOM.querySelector', { nodeId: root.nodeId, selector: 'svg [data-front-role="title"] text' });
    assert.ok(nodeId, 'Title text must be present.');
    const fonts = await platformFonts.send('CSS.getPlatformFontsForNode', { nodeId });
    assert.ok(fonts.fonts.some(font => font.postScriptName === 'LongCang-Regular' && font.isCustomFont));
    for (const extension of ['svg', 'png']) {
      const file = path.join(output, `handwritten.${extension}`);
      await app.evaluate(({ session }, file) => {
        globalThis.packagedDownload = new Promise(resolve => session.defaultSession.once('will-download', (event, item) => {
          item.setSavePath(file); item.once('done', (event, state) => resolve(state));
        }));
      }, file);
      await page.getByRole('button', { name: `导出 ${extension.toUpperCase()}`, exact: true }).click();
      assert.equal(await app.evaluate(() => globalThis.packagedDownload), 'completed');
    }
    const png = await fs.readFile(path.join(output, 'handwritten.png'));
    assert.equal(png.readUInt32BE(16), 1748); assert.equal(png.readUInt32BE(20), 1181);
    assert.match(await fs.readFile(path.join(output, 'handwritten.svg'), 'utf8'), /font-family:'Long Cang';src:url\('data:/);
    await page.screenshot({ path: path.join(output, 'app.png') });
    assert.deepEqual(errors, []);
    await fs.writeFile(path.join(output, 'packaged-smoke.json'), JSON.stringify({
      appPath, appVersion: pkg.version, electron: versions.electron, chromium: versions.chrome, profileIsolated: true,
      checks: ['packaged-file-startup', 'preload-IPC', 'save-and-reopen', 'actual-LongCang-page-font', 'SVG-embedded-font', 'PNG-export-dimensions'],
      fonts, pageErrors: errors, limitations: ['Font identity in the PNG requires separate visual comparison; dimensions and embedded SVG alone do not prove it.', 'No live AI requests or Windows installation test.']
    }, null, 2));
    console.log(`PASS packaged startup, isolated profile, save/reopen and SVG/PNG downloads: ${output}`);
  } finally {
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
    await app.close().catch(() => {});
  }
})().catch(error => { console.error(error); process.exit(1); });

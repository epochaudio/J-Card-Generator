const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');

// Optional reference URL serves a copy taken immediately before the UI-only change.
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const save = async target => {
    const pending = target.waitForEvent('download');
    await target.getByRole('button', { name: '保存作品', exact: true }).click();
    return JSON.parse(await fs.readFile(await (await pending).path(), 'utf8')).project;
  };
  const seed = async (target, url) => {
    target.on('pageerror', error => errors.push(error.message));
    await target.goto(url);
    await target.waitForFunction(() => !document.body.innerText.includes('正在检查草稿'));
    await target.evaluate(async () => {
      const { normalizeSnapshot, serializeProject } = await import('/src/project/projectFormat.mjs');
      const { projectStorage } = await import('/src/project/projectStorage.mjs');
      const source = normalizeSnapshot({
        data: { title: '声音档案 Echo', artist: '林间 Quartet', releaseDate: '2001', tapeId: 'TEST-01', coverBadge: '慢慢听', spineTitle: 'Echo',
          layout: { frontStyle: 'STANDARD', noteUpper: 'STEREO', noteLower: 'TEST', spineInverted: true },
          sideA: [{ id: 'a', title: '夜色 Night', artist: '林间', duration: '3:25', note: '现场' }],
          sideB: [{ id: 'b', title: '回声 Echo', duration: '4:12' }] },
        theme: { paletteId: 'paper' }, fontTheme: 'modern', recordingData: { equipment: 'Test recorder', source: 'CD', recDate: '2026-09-10' }
      });
      await projectStorage.writeDraft(serializeProject(source));
    });
    await target.reload();
    await target.getByRole('button', { name: '恢复草稿', exact: true }).click();
    await target.evaluate(() => document.fonts.ready);
  };
  const inventory = target => target.evaluate(() => Array.from(document.querySelectorAll('input, textarea, select')).map(node => ({
    tag: node.tagName, type: node.type, value: node.value, checked: node.checked, disabled: node.disabled,
    placeholder: node.placeholder, options: node.options ? Array.from(node.options, option => [option.value, option.text]) : undefined
  })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
  const png = async target => {
    const pending = target.waitForEvent('download');
    await target.getByRole('button', { name: '导出 PNG', exact: true }).click();
    return fs.readFile(await (await pending).path());
  };
  try {
    await seed(page, process.env.JCARD_TEST_URL || 'http://127.0.0.1:5193');
    const before = await save(page);
    const controls = await inventory(page);
    if (process.env.JCARD_REFERENCE_URL) {
      const reference = await browser.newPage();
      await seed(reference, process.env.JCARD_REFERENCE_URL);
      assert.deepEqual(await save(reference), before, 'saved project is identical to pre-change UI');
      assert.deepEqual(await inventory(reference), controls, 'all field values, options and disabled states remain identical');
      assert.deepEqual(await png(page), await png(reference), 'PNG bytes remain identical');
      await page.getByRole('tab', { name: '外观', exact: true }).click();
      await page.locator('#design-panel summary').filter({ hasText: /^封面排版/ }).click();
      for (const layout of ['双面颠倒', '编辑左齐', '经典居中']) {
        await page.getByRole('button', { name: layout, exact: true }).click();
        await reference.getByRole('button', { name: layout, exact: true }).click();
        assert.deepEqual(await inventory(page), await inventory(reference), `conditional controls: ${layout}`);
        assert.deepEqual(await save(page), await save(reference), `layout side effects: ${layout}`);
      }
      await page.getByRole('tab', { name: '内容', exact: true }).click();
      for (const mode of ['古典', '合辑', '标准']) {
        await page.getByRole('button', { name: mode, exact: true }).click();
        await reference.getByRole('button', { name: mode, exact: true }).click();
        assert.deepEqual(await inventory(page), await inventory(reference), `content controls: ${mode}`);
        assert.deepEqual(await save(page), await save(reference), `content side effects: ${mode}`);
      }
      assert.deepEqual(await save(page), before);
      await reference.close();
      console.log('PASS pre-change comparison: complete field inventory, saved project and PNG bytes');
    }
    let apiCalls = 0;
    await page.route('https://**/*', route => { apiCalls++; return route.abort(); });
    await page.getByRole('tab', { name: '外观', exact: true }).click();
    await page.locator('summary').filter({ hasText: /^搭配要求/ }).click();
    await page.getByLabel('搭配风格要求').fill('保留会话输入');
    await page.getByLabel('锁定字体与样式').check();
    await page.locator('summary').filter({ hasText: /^搭配要求/ }).click();
    await page.getByRole('tab', { name: '内容', exact: true }).click();
    await page.locator('summary').filter({ hasText: /^更多专辑信息/ }).click();
    await page.locator('summary').filter({ hasText: /^录音与补充资料/ }).click();
    await page.getByRole('tab', { name: '外观', exact: true }).click();
    await page.locator('summary').filter({ hasText: /^搭配要求/ }).click();
    assert.equal(await page.getByLabel('搭配风格要求').inputValue(), '保留会话输入');
    assert.equal(await page.getByLabel('锁定字体与样式').isChecked(), true);
    assert.deepEqual(await save(page), before, 'navigation and draft design intent do not modify the work');
    assert.equal(apiCalls, 0);
    await page.getByRole('tab', { name: '外观', exact: true }).press('ArrowLeft');
    assert.equal(await page.getByRole('tab', { name: '内容', exact: true }).getAttribute('aria-selected'), 'true');
    await page.locator('summary[aria-label="作品"]').click();
    assert.equal(await page.getByRole('button', { name: '打开作品', exact: true }).isVisible(), true);
    await page.locator('summary[aria-label="作品"]').press('Escape');
    assert.equal(await page.getByRole('button', { name: '打开作品', exact: true }).isVisible(), false);
    await page.locator('summary[aria-label="更多导出格式"]').click();
    assert.equal(await page.getByRole('button', { name: /^导出 SVG/ }).isVisible(), true);
    await page.getByRole('tab', { name: '内容', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: /^导出 SVG/ }).isVisible(), false);
    await page.screenshot({ path: '/private/tmp/tapefolio-content-verified.png' });
    await page.setViewportSize({ width: 800, height: 650 });
    await page.getByRole('tab', { name: '外观', exact: true }).click();
    await page.locator('#spine-size').scrollIntoViewIfNeeded();
    assert.equal(await page.locator('#spine-size').isVisible(), true);
    assert.equal(await page.getByRole('button', { name: '保存作品', exact: true }).isVisible(), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: '/private/tmp/tapefolio-small-verified.png' });
    assert.deepEqual(errors, []);
    console.log('PASS mounted tab state, folded fields, keyboard tabs, menu dismissal, small viewport and zero navigation API calls');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });

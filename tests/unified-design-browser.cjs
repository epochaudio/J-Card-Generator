const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const base = process.env.JCARD_TEST_URL || 'http://127.0.0.1:5187';
  try {
    await page.goto(base);
    const panel = page.getByRole('region', { name: '封面设计', exact: true });
    await panel.waitFor();
    for (const name of ['出版排版', '原版排版']) assert.equal(await page.getByRole('button', { name, exact: true }).count(), 0);
    for (const name of ['经典居中', '编辑左齐', '双面颠倒']) {
      await panel.getByRole('button', { name, exact: true }).click();
      assert.equal(await panel.getByLabel('标题尺寸', { exact: true }).count(), name === '双面颠倒' ? 0 : 1);
      assert.equal(await panel.getByLabel('轻微纸纹').count(), 1);
    }
    await panel.getByLabel('轻微纸纹').check();
    await panel.getByRole('button', { name: '经典居中', exact: true }).click();
    assert.equal(await panel.getByLabel('轻微纸纹').isChecked(), true);
    await page.goto(`${base}/tests/design-preview.html`);
    await page.getByRole('button', { name: '运行全部检查', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#results')?.textContent.includes('超长内容应报警'));
    const results = await page.locator('#results').innerText();
    assert.equal(results.includes('FAIL'), false, results);
    assert.equal(results.split('\n').length, 17);
    await page.getByRole('button', { name: '核对导出图像', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#export-status')?.textContent.startsWith('PASS'));
    assert.deepEqual(errors, []);
    console.log('PASS unified controls, three layouts, paper texture, 17 layout cases and SVG → PNG export; no page errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });

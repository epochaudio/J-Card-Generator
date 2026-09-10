const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 950 } });
  page.setDefaultTimeout(10000);
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    const host = new URL(request.url()).hostname;
    if (host.includes('deepseek.com') || host.includes('aliyuncs.com') || host.includes('volces.com')) requests.push(request.url());
  });
  const open = () => page.getByTitle('配置 DeepSeek 与可选生图服务', { exact: true }).click();
  const close = () => page.getByRole('button', { name: '关闭设置', exact: true }).click();
  try {
    await page.goto(process.env.JCARD_TEST_URL || 'http://127.0.0.1:5187');
    await page.getByRole('button', { name: '保存作品', exact: true }).waitFor();
    await open();
    const dialog = page.getByRole('dialog', { name: 'AI 服务设置' });
    await dialog.getByText('DeepSeek AI', { exact: true }).waitFor();
    assert.equal(await dialog.getByText('推荐', { exact: true }).count(), 1);
    assert.match(await dialog.innerText(), /deepseek-flash.*DeepSeek-V4\.1-Flash/s);
    assert.equal(await dialog.getByRole('tab').count(), 0);
    assert.equal(await dialog.getByRole('button', { name: /获取模型|刷新模型/ }).count(), 0);
    assert.equal(await dialog.getByLabel(/文本模型|视觉模型/).count(), 0);
    assert.equal(await page.getByLabel('启用 AI 生成封面图片').isChecked(), false);
    console.log('PASS DeepSeek is first, recommended and fixed for text plus image understanding');

    await page.getByLabel('DeepSeek API Key', { exact: true }).fill('test-deepseek-secret');
    await page.getByRole('button', { name: '保存设置', exact: true }).click();
    await page.getByText('设置已保存；密钥是否有效、账户套餐与余额尚未验证。', { exact: true }).waitFor();
    await close(); await page.reload(); await open();
    assert.equal(await page.getByLabel('DeepSeek API Key', { exact: true }).inputValue(), 'test-deepseek-secret');
    assert.equal(await page.getByLabel('启用 AI 生成封面图片').isChecked(), false);
    console.log('PASS DeepSeek-only settings persist without enabling image generation');

    await page.getByLabel('启用 AI 生成封面图片').check();
    assert.equal(await page.getByLabel('生图服务商').inputValue(), 'aliyun');
    assert.match(await dialog.innerText(), /wan2\.5-t2i-preview/);
    await page.getByLabel('阿里云百炼 API Key', { exact: true }).fill('test-ali-secret');
    await page.getByLabel('生图服务商').selectOption('volcengine');
    assert.match(await dialog.innerText(), /doubao-seedream-4-0-250828/);
    await page.getByLabel('火山引擎（火山方舟） API Key', { exact: true }).fill('test-volc-secret');
    await page.getByRole('button', { name: '保存设置', exact: true }).click();
    await close(); await page.reload(); await open();
    assert.equal(await page.getByLabel('启用 AI 生成封面图片').isChecked(), true);
    assert.equal(await page.getByLabel('生图服务商').inputValue(), 'volcengine');
    assert.equal(await page.getByLabel('火山引擎（火山方舟） API Key', { exact: true }).inputValue(), 'test-volc-secret');
    console.log('PASS optional image generation remains a collapsed two-provider choice');

    await page.getByLabel('DeepSeek API Key', { exact: true }).fill('discard-me');
    await close(); await open();
    assert.equal(await page.getByLabel('DeepSeek API Key', { exact: true }).inputValue(), 'test-deepseek-secret');
    assert.deepEqual(requests, []);
    assert.deepEqual(errors, []);
    console.log('PASS cancelled edits, zero external requests and zero page errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

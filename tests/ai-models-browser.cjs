const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  page.setDefaultTimeout(10000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const requests = [];
  let fail = false, pending;
  let hold = false;
  await page.route('https://**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    // Tests use dummy keys exclusively; no external request is allowed to leave.
    requests.push({ url: url.href, method: request.method(), key: request.headers().authorization });
    if (hold) await new Promise(resolve => { pending = resolve; });
    const data = url.hostname === 'api.deepseek.com' ? { data: [{ id: 'deepseek-v4-flash' }, { id: 'deepseek-v4-pro' }] }
      : url.hostname.endsWith('.maas.aliyuncs.com') ? { output: { total: 3, page_no: 1, models: [
        { model: 'qwen3-max', capabilities: ['TG'] }, { model: 'wan2.5-t2i-preview', capabilities: ['IG'] }, { model: 'wan2.6-t2i', capabilities: ['IG'] }
      ] } }
      : { data: [{ id: 'doubao-seed-1-6-250615' }, { id: 'doubao-seedream-4-0-250828' }, { id: 'ep-unknown' }] };
    await route.fulfill({ status: fail ? 401 : 200, contentType: 'application/json', body: JSON.stringify(fail ? { error: 'do-not-echo-key' } : data) }).catch(() => {});
  });
  const open = () => page.getByRole('button', { name: 'AI 服务设置', exact: true }).click();
  const close = () => page.getByRole('button', { name: '关闭设置', exact: true }).click();
  const tab = name => page.getByRole('tab', { name, exact: true }).click();
  const fetchModels = () => page.getByRole('button', { name: /^(获取模型|刷新模型)$/ }).click();
  const choose = label => page.getByLabel(`${label} 选择`, { exact: true });
  try {
    await page.goto(process.env.JCARD_TEST_URL || 'http://127.0.0.1:5187');
    await page.getByRole('button', { name: '打开作品', exact: true }).waitFor();
    // Seed a real version 1 payload, then exercise startup migration in the browser.
    await page.evaluate(() => localStorage.setItem('jcard_ai_settings_v1', JSON.stringify({ version: 1, textProvider: 'minimax', imageProvider: 'minimax', providers: {
      aliyun: { apiKey: 'test-ali-key', textModel: 'qwen-plus', imageModel: 'wan2.5-t2i-preview' },
      volcengine: { apiKey: 'test-ark-key', textModel: 'ep-existing-text', imageModel: 'ep-existing-image' },
      minimax: { apiKey: 'remove-me', textModel: 'MiniMax-M2.7', imageModel: 'image-01' }
    } })));
    await page.reload(); await open();
    assert.equal(await page.getByRole('tab', { name: 'MiniMax', exact: true }).count(), 0);
    assert.equal(await page.getByLabel('文本服务商', { exact: true }).inputValue(), '');
    assert.equal(await page.getByLabel('图片服务商', { exact: true }).inputValue(), '');
    const stored = await page.evaluate(() => localStorage.getItem('jcard_ai_settings_v1'));
    assert.equal(stored.includes('remove-me'), false); assert.equal(JSON.parse(stored).version, 3);
    assert.equal(await page.getByLabel('图片服务商', { exact: true }).locator('option[value=deepseek]').count(), 0);
    console.log('PASS old MiniMax migration without implicit provider switching');

    await tab('DeepSeek');
    await page.getByLabel('DeepSeek API Key', { exact: true }).fill('test-deepseek-key');
    await fetchModels(); await page.getByText(/^已获取 2 个已适配模型/).waitFor();
    await page.getByLabel('DeepSeek 文本模型 搜索', { exact: true }).fill('pro');
    await choose('DeepSeek 文本模型').selectOption('deepseek-v4-pro');
    assert.equal(await choose('DeepSeek 文本模型').inputValue(), 'deepseek-v4-pro');
    assert.equal(await page.getByLabel('DeepSeek 图片模型 选择', { exact: true }).count(), 0);
    assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('jcard_ai_settings_v1')))).providers.deepseek.apiKey, '');
    console.log('PASS fetch, search, select, text-only capabilities; fetching does not save');

    await tab('阿里云百炼');
    await page.getByLabel('阿里云业务空间 ID').fill('workspace-test');
    await fetchModels(); await page.getByText(/^已获取 2 个已适配模型，另有 1 项/).waitFor();
    await choose('阿里云百炼 文本模型').selectOption('qwen3-max');
    assert.equal(await choose('阿里云百炼 图片模型').locator('option[value="wan2.6-t2i"]').count(), 0);
    assert.equal(await choose('阿里云百炼 图片模型').locator('option[value="qwen3-max"]').count(), 0);
    assert.equal(await choose('阿里云百炼 文本模型').locator('option[value="wan2.5-t2i-preview"]').count(), 0);
    console.log('PASS Ali workspace, capability filtering and incompatible image protocol exclusion');

    await tab('火山引擎（火山方舟）');
    await fetchModels(); await page.getByText(/^已获取 2 个已适配模型，另有 1 项/).waitFor();
    assert.equal(await choose('火山引擎（火山方舟） 文本模型').inputValue(), 'ep-existing-text');
    await choose('火山引擎（火山方舟） 文本模型').selectOption('doubao-seed-1-6-250615');
    await choose('火山引擎（火山方舟） 图片模型').selectOption('doubao-seedream-4-0-250828');
    await page.getByLabel('视觉分析服务商', { exact: true }).selectOption('volcengine');
    await choose('火山引擎（火山方舟） 视觉模型').selectOption('doubao-seed-1-6-250615');
    await page.getByLabel('文本服务商', { exact: true }).selectOption('deepseek');
    await page.getByLabel('图片服务商', { exact: true }).selectOption('volcengine');
    await page.getByRole('button', { name: '保存设置', exact: true }).click();
    await page.getByText('设置已保存；密钥是否有效、账户套餐与余额尚未验证。', { exact: true }).waitFor();
    await close(); await page.reload(); await open(); await tab('DeepSeek');
    assert.equal(await choose('DeepSeek 文本模型').inputValue(), 'deepseek-v4-pro');
    assert.equal(await page.getByLabel('文本服务商', { exact: true }).inputValue(), 'deepseek');
    assert.equal(await page.getByLabel('图片服务商', { exact: true }).inputValue(), 'volcengine');
    assert.equal(await page.getByLabel('视觉分析服务商', { exact: true }).inputValue(), 'volcengine');
    assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('jcard_ai_settings_v1')))).providers.volcengine.visionModel, 'doubao-seed-1-6-250615');
    console.log('PASS all three providers and independent vision selection; settings survive save and reload');

    fail = true; await fetchModels(); await page.getByText(/HTTP 401/).waitFor();
    assert.equal(await choose('DeepSeek 文本模型').inputValue(), 'deepseek-v4-pro');
    assert.equal((await page.getByRole('dialog').innerText()).includes('do-not-echo-key'), false);
    fail = false;
    // Editing the key or closing invalidates any in-flight response.
    hold = true; await fetchModels();
    await page.waitForFunction(() => document.body.innerText.includes('正在获取…'));
    while (!pending) await new Promise(resolve => setTimeout(resolve, 10));
    await page.getByLabel('DeepSeek API Key', { exact: true }).fill('replacement-key');
    pending(); pending = undefined; hold = false;
    await page.waitForTimeout(100);
    assert.equal(await page.getByText(/^已获取/).count(), 0);
    assert.equal(await page.getByRole('button', { name: '获取模型', exact: true }).count(), 1);
    await close(); await open();
    assert.equal(await page.getByLabel('DeepSeek API Key', { exact: true }).inputValue(), 'test-deepseek-key');

    hold = true; await fetchModels();
    while (!pending) await new Promise(resolve => setTimeout(resolve, 10));
    await close(); await open(); pending(); pending = undefined; hold = false;
    await page.waitForTimeout(100);
    assert.equal(await page.getByText(/^已获取/).count(), 0);
    console.log('PASS refresh failure, key-edit and close/reopen races preserve selections');

    await page.getByLabel('DeepSeek 文本模型', { exact: true }).fill('deepseek-custom-model');
    assert.equal(await choose('DeepSeek 文本模型').inputValue(), 'deepseek-custom-model');
    await close(); await open();
    assert.equal(await choose('DeepSeek 文本模型').inputValue(), 'deepseek-v4-pro');
    await fetchModels(); await page.getByText(/^已获取 2 个已适配模型/).waitFor();
    await page.screenshot({ path: '/private/tmp/jcard-deepseek-settings.png' });
    await page.getByLabel('视觉分析服务商', { exact: true }).selectOption('deepseek');
    await page.getByLabel('DeepSeek 视觉模型 搜索', { exact: true }).fill('deepseek-v4.1-flash-expires-on-0910');
    await page.getByRole('button', { name: '保存设置', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: '尚未填写DeepSeek的视觉模型 ID' }).waitFor();
    assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('jcard_ai_settings_v1')))).visionProvider, 'volcengine');
    await page.getByLabel('DeepSeek 视觉模型', { exact: true }).fill('deepseek-v4.1-flash-expires-on-0910');
    await page.getByLabel('视觉分析服务商', { exact: true }).selectOption('deepseek');
    await page.getByRole('button', { name: '保存设置', exact: true }).click();
    await page.getByText('设置已保存；密钥是否有效、账户套餐与余额尚未验证。', { exact: true }).waitFor();
    await close(); await page.reload(); await open(); await tab('DeepSeek');
    assert.equal(await page.getByLabel('视觉分析服务商', { exact: true }).inputValue(), 'deepseek');
    assert.equal(await choose('DeepSeek 视觉模型').inputValue(), 'deepseek-v4.1-flash-expires-on-0910');
    console.log('PASS DeepSeek beta manual vision selection persists independently');
    assert.ok(requests.every(request => request.method === 'GET'));
    assert.deepEqual(errors, []);
    console.log('PASS manual entry and cancel; only model-list GET requests; zero page errors');
  } finally { pending?.(); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

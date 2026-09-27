const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(process.env.JCARD_TEST_URL || 'http://127.0.0.1:5187');
    await page.getByRole('tab', { name: '外观', exact: true }).click();
    await page.locator('summary').filter({ hasText: /^颜色与背景/ }).click();
    await page.getByRole('button', { name: '封面背景', exact: true }).click();
    const slider = page.getByLabel('背景浓淡', { exact: true });
    await slider.fill('0.2');
    assert.equal(await slider.inputValue(), '0.2');
    await page.getByRole('button', { name: '浅色', exact: true }).click();
    assert.equal(await slider.count(), 0);
    await page.getByRole('button', { name: '封面背景', exact: true }).click();
    assert.equal(await slider.inputValue(), '0.2');
    const result = await page.evaluate(async () => {
      const { default: React } = await import('/node_modules/.vite/deps/react.js');
      const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { default: { flushSync } } = await import('/node_modules/.vite/deps/react-dom.js');
      const { default: JCard } = await import('/src/components/JCardPreview.jsx');
      const { normalizeSnapshot } = await import('/src/project/projectFormat.mjs');
      const { getFontConfig } = await import('/src/config/fonts.js');
      const { default: ExportService } = await import('/src/services/ExportService.js');
      const cover = document.createElement('canvas'); cover.width = cover.height = 400;
      const ctx = cover.getContext('2d');
      const gradient = ctx.createLinearGradient(0, 0, 400, 400);
      gradient.addColorStop(0, '#1682bb'); gradient.addColorStop(0.5, '#eee1b8'); gradient.addColorStop(1, '#122334');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, 400, 400);
      const snapshot = normalizeSnapshot({ data: { title: '纸面与色彩', artist: 'Paper & Colour', sideA: [{ id: 'a', title: '晨光 Morning', duration: '4:30' }], sideB: [{ id: 'b', title: '夜色 Night', duration: '3:50' }] }, theme: { paletteId: 'legacy' }, jCardThemeMode: 'cover', coverImage: cover.toDataURL(), fontTheme: 'modern' });
      const host = document.createElement('div'); document.body.replaceChildren(host); host.style.width = '1200px';
      const root = createRoot(host), config = getFontConfig('modern');
      const samples = [];
      for (const strength of [0, 0.32, 0.4]) {
        snapshot.theme.coverBackgroundStrength = strength;
        flushSync(() => root.render(React.createElement(JCard, { ...snapshot, fontConfig: config })));
        const svg = host.querySelector('svg');
        const serialized = await ExportService.serializeSVG(svg, config);
        const blob = new Blob([serialized], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const img = new Image(); img.src = url; await img.decode();
        const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        const context = canvas.getContext('2d'); context.drawImage(img, 0, 0); URL.revokeObjectURL(url);
        const sample = (x, y) => Array.from(context.getImageData(Math.floor(canvas.width * x), Math.floor(canvas.height * y), 1, 1).data);
        samples.push({ strength, opacity: Number(svg.querySelector('[data-cover-paper="base"]').getAttribute('opacity')), top: sample(0.98, 0.1), bottom: sample(0.98, 0.9) });
      }
      return samples;
    });
    assert.deepEqual(result[0].top, [255, 255, 255, 255]);
    for (const row of result) {
      assert.equal(row.opacity, 1 - row.strength);
      assert.equal(row.bottom[3], 255);
    }
    assert.notDeepEqual(result[1].top, result[1].bottom);
    assert.ok(result[2].bottom[0] < result[1].bottom[0]);
    assert.deepEqual(errors, []);
    if (process.env.JCARD_SCREENSHOT) await page.screenshot({ path: process.env.JCARD_SCREENSHOT });
    console.log('PASS cover slider, mode switching, light paper, cover gradients and opaque SVG rasterization', JSON.stringify(result));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });

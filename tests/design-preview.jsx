// Development-only visual fixtures. No account data, network APIs or project storage.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import JCardPreview from '../src/components/JCardPreview.jsx';
import { getFontConfig } from '../src/config/fonts.js';
import { PALETTES } from '../src/config/design.mjs';
import { normalizeSnapshot, parseProject, serializeProject } from '../src/project/projectFormat.mjs';
import ExportService from '../src/services/ExportService.js';
import '../src/index.css';

const makeImage = (dark = false, vivid = false) => {
  const canvas = document.createElement('canvas'); canvas.width = 800; canvas.height = 800;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = vivid ? '#00d4aa' : dark ? '#1c2932' : '#d9c5a5'; ctx.fillRect(0, 0, 800, 800);
  ctx.fillStyle = vivid ? '#ff0080' : dark ? '#bba36f' : '#7d8a75'; ctx.beginPath(); ctx.arc(490, 300, 165, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = dark ? '#14212a' : '#9ca990'; ctx.beginPath(); ctx.moveTo(0, 650); ctx.lineTo(380, 370); ctx.lineTo(800, 620); ctx.lineTo(800, 800); ctx.lineTo(0, 800); ctx.fill();
  ctx.fillStyle = dark ? '#efe5d0' : '#26382d'; ctx.font = '24px sans-serif'; ctx.fillText('SOUND ARCHIVE / 2026', 55, 70);
  return canvas.toDataURL('image/png');
};
const covers = [makeImage(), makeImage(true), makeImage(false, true)];
const tracks = count => Array.from({ length: count }, (_, index) => ({ id: `track-${index}`, title: ['晨光微明', '海岸线 Coastline', '在遥远的夜色中听见回声', 'After the Rain', '归途'][index % 5], artist: '林间四重奏 Quartet', duration: `${index % 6 + 2}:35`, note: index % 3 === 0 ? '现场录音 · 保留空间与呼吸' : '' }));
const cases = [
  { name: '暖纸 · 中文居中', palette: 'paper', title: '夜色与回声', font: 'editorial' },
  { name: '暖纸 · 编辑左齐', palette: 'paper', title: '夜色与回声', font: 'editorial', front: 'EDITORIAL' },
  { name: '暖暗 · 现代中英混排', palette: 'warm', title: '雨后 AFTER THE RAIN', font: 'modern', image: 1 },
  { name: '冷灰 · 中英混排', palette: 'cool', title: '海岸线 Coastline', font: 'editorial' },
  { name: '长标题与艺术家', palette: 'paper', title: '在遥远的夜色中听见城市与山林的回声', artist: '林间四重奏与远方的朋友们 · Live Ensemble', font: 'editorial', front: 'EDITORIAL' },
  { name: '密集曲目', palette: 'warm', title: '私人现场录音集', font: 'modern', count: 24, image: 1 },
  { name: '古典多乐章', palette: 'paper', title: '四季', font: 'editorial', mode: 'CLASSICAL' },
  { name: '合辑', palette: 'cool', title: '城市声音档案', font: 'sourcehan', mode: 'COMPILATION' },
  { name: '少曲目与鲜艳封面', palette: 'paper', title: 'COLOUR STUDIES', font: 'modern', count: 4, image: 2 },
  { name: '双封面', palette: 'cool', title: '双面声音', font: 'editorial', front: 'REVERSIBLE' },
  { name: '手记与龙藏体', palette: 'paper', title: '我的录音手记', font: 'handwritten' },
  { name: '无图', palette: 'paper', title: '声音档案', font: 'editorial', image: null },
  { name: '自定义深色', palette: 'legacy', title: '夜色与回声', font: 'modern' },
  { name: '胶片字体', palette: 'warm', title: '胶片时光 ANALOG DAYS', font: 'retro', image: 1 },
  { name: '电子字体', palette: 'cool', title: '未来声音 FUTURE SOUND', font: 'digital', image: 2 },
  { name: '普惠体中文', palette: 'paper', title: '声音与建筑', font: 'puhuiti' },
  { name: '超长内容应报警', palette: 'paper', title: '无法在正面容纳的完整长标题'.repeat(40), font: 'editorial', overflow: true },
];
function snapshot(item) {
  const all = tracks(item.count || 10);
  if (item.mode === 'CLASSICAL') all.forEach((track, index) => { track._workId = `work-${Math.floor(index / 5)}`; track._workTitle = index < 5 ? '第一组曲' : '第二组曲'; track._workComposer = '作曲家'; });
  return normalizeSnapshot({ data: { title: item.title, artist: item.artist || '林间四重奏 · Quartet', tapeId: 'ARC—026', coverBadge: item.overflow ? '' : '留住那些值得反复聆听的声音', sideA: all.slice(0, all.length / 2), sideB: all.slice(all.length / 2), layout: { frontStyle: item.front || 'STANDARD', titleSize: 'balanced', texture: false, mode: item.mode || 'STANDARD' } },
    theme: { paletteId: item.palette, accent: PALETTES[item.palette]?.accent || '#cc3300' }, fontTheme: item.font, coverImage: item.image === null ? null : covers[item.image || 0], coverImageB: covers[1], recordingData: { recDate: '2026-09-08' } });
}
const root = createRoot(document.getElementById('root'));
let current = 0;
let results = [];
let exportURL;
const nextPaint = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
async function show(index) {
  current = index;
  const item = cases[index]; const state = snapshot(item);
  const fontConfig = getFontConfig(state.fontTheme);
  await ExportService.ensureFonts(fontConfig);
  flushSync(() => root.render(<main className="p-5 max-w-6xl mx-auto text-stone-800">
    <h1 className="text-xl font-semibold mb-3">磁带封面 · 设计验收</h1>
    <div className="flex flex-wrap gap-2 mb-4"><select aria-label="验收样张" value={index} onChange={event => show(Number(event.target.value))} className="p-2 border rounded">{cases.map((value, i) => <option value={i} key={value.name}>{value.name}</option>)}</select>
      <button className="border rounded px-3" onClick={run}>运行全部检查</button><button className="border rounded px-3" onClick={exportPreview}>核对导出图像</button><button className="border rounded px-3" onClick={exportAllFonts}>检查全部字体导出</button><button className="border rounded px-3" onClick={downloadProject}>下载样张作品</button></div>
    <p className="text-sm mb-3">{item.name} · 图像为本地绘制的排版测试素材</p>
    <div id="fixture"><JCardPreview {...state} fontConfig={fontConfig} /></div>
    <p id="export-status" className="my-3 text-sm" />
    <img id="export-image" className="w-full" alt="" />
    <pre id="results" className="mt-5 text-xs whitespace-pre-wrap">{results.join('\n')}</pre>
  </main>));
  await nextPaint();
}
function check(index) {
  const item = cases[index];
  const svg = document.querySelector('#fixture svg');
  const issues = [];
  const front = svg.querySelector('[data-panel="front"]');
  if (item.front !== 'REVERSIBLE') {
    if ((front.dataset.overflow === 'true') !== !!item.overflow) issues.push('正面溢出状态不符合预期');
    if (!item.overflow) {
      const texts = [...front.querySelectorAll('text')];
      for (const text of texts) {
        const box = text.getBBox();
        if (box.x < 50 || box.x + box.width > 730 || box.y + box.height > 1135) issues.push(`正面越界：${text.textContent}`);
      }
      const groups = [...front.querySelectorAll('[data-front-role]')].map(group => group.getBBox());
      for (let i = 1; i < groups.length; i++) if (groups[i].y < groups[i - 1].y + groups[i - 1].height) issues.push('正面文字块重叠');
    }
  }
  if (svg.querySelector('[data-back-overflow="true"]')) issues.push('背面溢出');
  const rows = [...svg.querySelectorAll('[data-track-row]')];
  for (const row of rows) {
    const texts = [...row.querySelectorAll('text')];
    const duration = texts.find(text => text.getAttribute('text-anchor') === 'end');
    if (!duration) continue;
    const firstTitle = texts[1].getBBox(); const time = duration.getBBox();
    const rowBounds = row.getBoundingClientRect(); const svgBounds = svg.getBoundingClientRect();
    if (rowBounds.bottom > svgBounds.bottom) issues.push('曲目超出面板');
    if (firstTitle.x + firstTitle.width > time.x - 8) issues.push('曲名与时长重叠');
  }
  const state = snapshot(item);
  if (JSON.stringify(parseProject(serializeProject(state))) !== JSON.stringify(state)) issues.push('保存恢复不一致');
  return `${issues.length ? 'FAIL' : 'PASS'} ${item.name}${issues.length ? ': ' + [...new Set(issues)].join('；') : ''}`;
}
async function run() {
  results = [];
  for (let index = 0; index < cases.length; index++) {
    await show(index); results.push(check(index));
  }
  await show(1);
}
async function exportPreview() {
  const state = snapshot(cases[current]);
  const config = getFontConfig(state.fontTheme);
  document.getElementById('export-status').textContent = '正在嵌入字体并解码 SVG…';
  const content = await ExportService.serializeSVG(document.querySelector('#fixture svg'), config);
  if (exportURL) URL.revokeObjectURL(exportURL);
  exportURL = URL.createObjectURL(new Blob([content], { type: 'image/svg+xml' }));
  const image = document.getElementById('export-image');
  image.src = exportURL;
  await image.decode();
  const canvas = document.createElement('canvas'); canvas.width = 1748; canvas.height = 1181;
  canvas.getContext('2d').drawImage(image, 0, 0);
  const png = canvas.toDataURL('image/png');
  image.src = png; await image.decode();
  document.getElementById('export-status').textContent = `PASS 字体已嵌入，SVG → PNG 解码成功，${image.naturalWidth} × ${image.naturalHeight}；下方为导出图像。`;
}
async function exportAllFonts() {
  const checked = new Set();
  for (let index = 0; index < cases.length; index++) {
    const item = cases[index];
    if (checked.has(item.font) || item.overflow) continue;
    checked.add(item.font);
    try {
      await show(index); await exportPreview(); results.push(`PASS ${item.font} 字体嵌入与 SVG → PNG`);
    } catch (error) { results.push(`FAIL ${item.font} 导出: ${error.message}`); }
  }
  await show(1);
}
function downloadProject() {
  const state = snapshot(cases[current]);
  const url = URL.createObjectURL(new Blob([serializeProject(state)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = `${cases[current].name}.jcard`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
show(1).catch(error => { document.body.textContent = error.stack; });

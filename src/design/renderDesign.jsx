import { applyTextTransforms, checkTextTransforms } from '../services/TextTransform.js';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import JCardPreview from '../components/JCardPreview.jsx';
import { getFontConfig } from '../config/fonts.js';
import { resolvePalette, contrastRatio, resolvePanelColors, panelColorFailures, MIN_TEXT_CONTRAST } from '../config/design.mjs';
import { JCARD_DIMENSIONS, getJCardDimensions } from '../constants/app.js';
import { computeFrontLayout } from '../utils/FrontLayout.js';
import SpineLayoutEngine from '../utils/SpineLayoutEngine.js';
import ColorExtractor from '../services/ColorExtractor.js';
import ExportService from '../services/ExportService.js';
import { bounded, checkCancelled } from './designMaterials.js';
import { rasterizeSVG } from '../services/SVGRasterizer.js';

const SIGNATURE_WIDTH = 240;
const MIN_MEAN_COLOR_DIFFERENCE = 0.5; // Reject near-identical rasterizations, not an aesthetic score.

export function visiblyDifferent(a, b) {
  if (a.length !== b.length) return true;
  let difference = 0;
  for (let i = 0; i < a.length; i += 4) difference += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
  return difference / (a.length / 4 * 3) > MIN_MEAN_COLOR_DIFFERENCE;
}

export async function renderDesign(snapshot, signal) {
  const dimensions = getJCardDimensions(snapshot.data.layout);
  const fontConfig = { ...getFontConfig(snapshot.fontTheme), typography: snapshot.theme.typography };
  await bounded(ExportService.ensureFonts(fontConfig), signal);
  const needsImageColor = snapshot.theme.paletteId === 'legacy' && snapshot.jCardThemeMode === 'color';
  const dominantColor = needsImageColor ? await bounded(ColorExtractor.extractColor(snapshot.coverImage, { representative: true }), signal) : '#232629';
  checkCancelled(signal);
  if (!dominantColor) throw new Error('无法读取封面颜色。');
  const palette = resolvePalette(snapshot.theme, snapshot.jCardThemeMode, dominantColor);
  const failures = [], warnings = [];
  if (snapshot.theme.paletteId === 'legacy' && snapshot.jCardThemeMode === 'cover') failures.push('封面背景的局部对比度尚不能可靠验证');
  if (snapshot.theme.paletteId === 'custom') failures.push(...panelColorFailures(resolvePanelColors(snapshot.theme), snapshot.data.layout.texture));
  else for (const role of ['text', 'secondary', 'muted']) if (contrastRatio(palette[role], palette.background) < MIN_TEXT_CONTRAST) failures.push('文字与背景对比度不足');
  const front = computeFrontLayout(snapshot.data, fontConfig, snapshot.theme);
  if (front.overflow) failures.push('正面文字超出可读空间');
  const spine = SpineLayoutEngine.compute({ data: snapshot.data, height: JCARD_DIMENSIONS.height, panelWidth: dimensions.panels.spine, fontConfig });
  if (spine.status.source !== 'full' || !['full', 'compact'].includes(spine.status.metaMode)) warnings.push(`脊背：${spine.status.summary}`);
  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${JCARD_DIMENSIONS.width}px;pointer-events:none;`;
  host.setAttribute('aria-hidden', 'true');
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    flushSync(() => root.render(<JCardPreview {...snapshot} fontConfig={fontConfig} dominantColor={dominantColor} />));
    const svg = host.querySelector('svg');
    if (!svg) throw new Error('候选预览未能生成。');
    applyTextTransforms(svg);
    failures.push(...checkTextTransforms(svg));
    const back = svg.querySelector('[data-back-overflow]');
    if (!back) throw new Error('缺少背面排版结果。');
    if (back.dataset.backOverflow === 'true') failures.push('背面曲目超出可读空间');
    const backFolded = back.dataset.backFolded === 'true';
    if (backFolded) warnings.push('背面采用紧凑显示，部分长曲名、说明或时长可能省略，请放大核对');
    const short = JSON.parse(svg.querySelector('[data-shortback-status]')?.getAttribute('data-shortback-status') || '{}');
    if (short.mode === 'META_ARCHIVE' && (short.truncated || short.level !== 'LEVEL_0_FULL')) warnings.push('折页档案采用压缩显示，部分资料可能省略');
    for (const side of short.sides || []) if (side.hidden || side.truncated) warnings.push(`折页 ${side.side} 面：未展示 ${side.hidden} 首，截短 ${side.truncated} 个曲名`);
    const serialized = await bounded(ExportService.serializeSVG(svg, fontConfig, { allowTypographyOverflow: true }), signal);
    const rendered = await rasterizeSVG(serialized, svg, signal);
    checkCancelled(signal);
    const canvas = document.createElement('canvas');
    canvas.width = JCARD_DIMENSIONS.width; canvas.height = JCARD_DIMENSIONS.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(rendered, 0, 0);
    const preview = canvas.toDataURL('image/png');
    canvas.width = SIGNATURE_WIDTH; canvas.height = Math.round(SIGNATURE_WIDTH * JCARD_DIMENSIONS.height / JCARD_DIMENSIONS.width);
    ctx.drawImage(rendered, 0, 0, canvas.width, canvas.height);
    const signature = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const panels = {};
    let x = 0;
    for (const [name, width] of Object.entries(dimensions.panels)) {
      canvas.width = width; canvas.height = JCARD_DIMENSIONS.height;
      ctx.drawImage(rendered, x, 0, width, canvas.height, 0, 0, width, canvas.height);
      panels[name] = canvas.toDataURL('image/png'); x += width;
    }
    return { preview, panels, signature, failures: [...new Set(failures)], warnings,
      metrics: { titleSize: front.blocks.find(block => block.role === 'title')?.size || 0, titleLines: front.blocks.find(block => block.role === 'title')?.lines.length || 0,
        bodySize: Number(back.dataset.backFontSize), backFolded, backStrategy: back.dataset.backStrategy, spine: spine.status.summary } };
  } finally { root.unmount(); host.remove(); }
}

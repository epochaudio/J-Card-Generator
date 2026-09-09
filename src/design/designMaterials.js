import { FONT_THEMES, getFontConfig } from '../config/fonts.js';
import ExportService from '../services/ExportService.js';

const COVER_LONG_EDGE = 1024;
const SAMPLE_WIDTH = 1200;
const SAMPLE_ROW_HEIGHT = 210;
const FONTS_PER_SHEET = 4;
const IMAGE_TIMEOUT_MS = 15000;
const FONT_TIMEOUT_MS = 30000;

export function checkCancelled(signal) {
  if (signal?.aborted) throw new Error('已取消智能搭配。');
}

export async function bounded(promise, signal, milliseconds = FONT_TIMEOUT_MS) {
  checkCancelled(signal);
  let timer, abort;
  try { return await Promise.race([promise, new Promise((_, reject) => {
    abort = () => reject(new Error('已取消智能搭配。'));
    signal?.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => reject(new Error('设计素材准备超时，请重试。')), milliseconds);
  })]); } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}

export async function loadDesignImage(source, signal) {
  const image = new Image();
  const ready = new Promise((resolve, reject) => { image.onload = () => resolve(image); image.onerror = () => reject(new Error('无法读取设计图片。')); });
  image.src = source;
  try { return await bounded(ready, signal, IMAGE_TIMEOUT_MS); }
  finally { image.onload = null; image.onerror = null; }
}

function drawSample(ctx, text, x, y, maxWidth) {
  let sample = String(text || '').replace(/\s+/g, ' ');
  const glyphs = Array.from(sample);
  while (glyphs.length && ctx.measureText(glyphs.join('')).width > maxWidth) glyphs.pop();
  if (glyphs.length < Array.from(sample).length) sample = glyphs.slice(0, -1).join('') + '…';
  ctx.fillText(sample, x, y);
}

export async function prepareCoverImage(source, signal) {
  const cover = await loadDesignImage(source, signal);
  const scale = Math.min(1, COVER_LONG_EDGE / Math.max(cover.naturalWidth, cover.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(cover.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(cover.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(cover, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

export async function prepareDesignImages(snapshot, signal) {
  const images = [await prepareCoverImage(snapshot.coverImage, signal)];
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const themes = Object.values(FONT_THEMES);
  const representative = [...snapshot.data.sideA, ...snapshot.data.sideB].sort((a, b) => String(b.title).length - String(a.title).length)[0];
  for (let offset = 0; offset < themes.length; offset += FONTS_PER_SHEET) {
    const entries = themes.slice(offset, offset + FONTS_PER_SHEET);
    canvas.width = SAMPLE_WIDTH; canvas.height = entries.length * SAMPLE_ROW_HEIGHT;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const [index, entry] of entries.entries()) {
      const font = getFontConfig(entry.id);
      await bounded(ExportService.ensureFonts(font), signal);
      checkCancelled(signal);
      const y = index * SAMPLE_ROW_HEIGHT;
      ctx.fillStyle = '#555555'; ctx.font = '20px sans-serif'; ctx.fillText(entry.id, 24, y + 28);
      ctx.fillStyle = '#202020'; ctx.font = `600 42px ${font.fonts.title}`;
      drawSample(ctx, snapshot.data.title || '声音档案 Album', 24, y + 86, SAMPLE_WIDTH - 48);
      ctx.font = `400 27px ${font.fonts.body}`;
      drawSample(ctx, `${representative?.title || '曲目 Track'} · ${snapshot.data.artist || '艺术家 Artist'}`, 24, y + 134, SAMPLE_WIDTH - 48);
      ctx.font = `400 24px ${font.fonts.mono}`; ctx.fillText('01  02  12   03:45  12:08', 24, y + 180);
    }
    images.push(canvas.toDataURL('image/png'));
  }
  return images;
}

// Preserve native pixels in the repair contact sheet; labels sit outside the artwork.
const REPAIR_SHEET_COLUMNS = 2;
const REPAIR_LABEL_HEIGHT = 36;
export async function prepareRepairImages(original, candidates, signal) {
  if (!candidates.length) return [original];
  const loaded = [];
  for (const candidate of candidates) loaded.push(await loadDesignImage(candidate.preview, signal));
  const width = Math.max(...loaded.map(image => image.naturalWidth));
  const height = Math.max(...loaded.map(image => image.naturalHeight)) + REPAIR_LABEL_HEIGHT;
  const columns = Math.min(REPAIR_SHEET_COLUMNS, loaded.length);
  const canvas = document.createElement('canvas');
  canvas.width = columns * width; canvas.height = Math.ceil(loaded.length / columns) * height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const [index, image] of loaded.entries()) {
    checkCancelled(signal);
    const x = (index % columns) * width, y = Math.floor(index / columns) * height;
    ctx.fillStyle = '#000000'; ctx.font = '20px sans-serif';
    ctx.fillText(`${candidates[index].id} / ${candidates[index].direction}`, x + 8, y + 25);
    ctx.drawImage(image, x, y + REPAIR_LABEL_HEIGHT);
  }
  return [original, canvas.toDataURL('image/png')];
}

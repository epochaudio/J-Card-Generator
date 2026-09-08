import { JCARD_DIMENSIONS } from '../constants/app.js';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const PROBE_ROW_HEIGHT = 40;
const PROBE_WIDTH = 500;
const PROBE_INK_THRESHOLD = 128;
const POLL_INTERVAL_MS = 50;
const RASTER_TIMEOUT_MS = 8000;

// SVG image onload/decode can precede embedded-font painting in Chromium.
// Put real text probes outside the artwork and wait for ink in every font run.
export async function rasterizeSVG(serialized, sourceSVG, signal) {
  const abortCheck = () => { if (signal?.aborted) throw new Error('已取消图像生成。'); };
  abortCheck();
  const probes = new Map();
  for (const node of sourceSVG.querySelectorAll('text, tspan')) {
    const text = [...node.childNodes].filter(child => child.nodeType === Node.TEXT_NODE).map(child => child.textContent).join('').trim();
    if (!text) continue;
    const style = getComputedStyle(node);
    const font = { family: style.fontFamily, weight: style.fontWeight, style: style.fontStyle };
    const key = JSON.stringify(font);
    if (!probes.has(key)) probes.set(key, { ...font, text: Array.from(text).slice(0, 16).join('') });
  }
  const doc = new DOMParser().parseFromString(serialized, 'image/svg+xml');
  const svg = doc.documentElement;
  const { width, height } = JCARD_DIMENSIONS;
  const totalHeight = height + probes.size * PROBE_ROW_HEIGHT;
  svg.setAttribute('height', totalHeight);
  svg.setAttribute('viewBox', `0 0 ${width} ${totalHeight}`);
  const rect = doc.createElementNS(SVG_NAMESPACE, 'rect');
  for (const [name, value] of Object.entries({ x: 0, y: height, width: PROBE_WIDTH, height: totalHeight - height, fill: '#ffffff' })) rect.setAttribute(name, value);
  svg.appendChild(rect);
  [...probes.values()].forEach((probe, index) => {
    const text = doc.createElementNS(SVG_NAMESPACE, 'text');
    for (const [name, value] of Object.entries({ x: 4, y: height + index * PROBE_ROW_HEIGHT + 29, 'font-family': probe.family, 'font-weight': probe.weight, 'font-style': probe.style, 'font-size': 24, fill: '#000000' })) text.setAttribute(name, value);
    text.textContent = probe.text; svg.appendChild(text);
  });
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }));
  const image = new Image();
  let timer, abort;
  try {
    return await new Promise((resolve, reject) => {
      const deadline = performance.now() + RASTER_TIMEOUT_MS;
      abort = () => reject(new Error('已取消图像生成。'));
      signal?.addEventListener('abort', abort, { once: true });
      const probeCanvas = document.createElement('canvas'); probeCanvas.width = PROBE_WIDTH; probeCanvas.height = Math.max(1, probes.size * PROBE_ROW_HEIGHT);
      const context = probeCanvas.getContext('2d', { willReadFrequently: true });
      let loaded = false;
      image.onload = () => { loaded = true; };
      image.onerror = () => reject(new Error('无法生成预览图像。'));
      const poll = () => {
        try {
          abortCheck();
          if (performance.now() > deadline) throw new Error('图像字体未能完整绘制，请重试。');
          let ready = loaded;
          if (loaded && probes.size) {
            context.clearRect(0, 0, probeCanvas.width, probeCanvas.height);
            context.drawImage(image, 0, height, PROBE_WIDTH, probeCanvas.height, 0, 0, PROBE_WIDTH, probeCanvas.height);
            for (let row = 0; row < probes.size; row += 1) {
              const pixels = context.getImageData(0, row * PROBE_ROW_HEIGHT, PROBE_WIDTH, PROBE_ROW_HEIGHT).data;
              let ink = false;
              for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 3] && pixels[i] < PROBE_INK_THRESHOLD) { ink = true; break; }
              if (!ink) { ready = false; break; }
            }
          }
          if (ready) {
            const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
            canvas.getContext('2d').drawImage(image, 0, 0, width, height, 0, 0, width, height);
            resolve(canvas);
          } else timer = setTimeout(poll, POLL_INTERVAL_MS);
        } catch (error) { reject(error); }
      };
      image.src = url; poll();
    });
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); image.onload = image.onerror = null; URL.revokeObjectURL(url); }
}

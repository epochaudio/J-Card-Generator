import { slantFactor, transformedTextWidth } from '../config/textStyles.mjs';

const BOUNDS_TOLERANCE = 1;
export function applyTextTransforms(svg) {
  const elements = [...svg.querySelectorAll('text[data-text-style]')];
  for (const text of elements) {
    const style = JSON.parse(text.dataset.textStyle);
    const base = text.dataset.baseTransform || '';
    text.setAttribute('transform', base);
    // Existing hardcoded bold spans must not synthesize unsupported weights.
    for (const span of text.querySelectorAll('tspan')) {
      span.setAttribute('font-weight', span.dataset.spanWeight || String(style.weight));
      span.setAttribute('font-style', 'normal');
    }
    const box = text.getBBox();
    if (!box.width || !box.height) continue;
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    const width = transformedTextWidth(box.width, box.height, style);
    const anchor = text.getAttribute('text-anchor') || 'start';
    const align = anchor === 'middle' ? 0 : anchor === 'end' ? -0.5 : 0.5;
    const shear = -slantFactor(style.slant);
    const tx = (1 - style.width) * cx - shear * cy + (width - box.width) * align;
    text.setAttribute('transform', `${base} matrix(${style.width} 0 ${shear} 1 ${tx} 0)`.trim());
  }
  return elements;
}
function svgBox(element, svg) {
  const b = element.getBBox();
  const m = svg.getCTM().inverse().multiply(element.getCTM());
  const points = [[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].map(([x,y]) => new DOMPoint(x,y).matrixTransform(m));
  const x = Math.min(...points.map(p=>p.x)), y = Math.min(...points.map(p=>p.y));
  return { x, y, right: Math.max(...points.map(p=>p.x)), bottom: Math.max(...points.map(p=>p.y)) };
}
export function checkTextTransforms(svg) {
  const failures = [];
  for (const panel of svg.querySelectorAll('[data-typography-panel]')) {
    const bounds = JSON.parse(panel.dataset.typographyBounds);
    const boxes = [...panel.querySelectorAll('text[data-text-style]')].filter(el=>el.textContent.trim()).map(el=>({ el, box: svgBox(el,svg) }));
    for (const { el, box } of boxes) {
      if (box.x < bounds.x - BOUNDS_TOLERANCE || box.right > bounds.x + bounds.width + BOUNDS_TOLERANCE
        || box.y < -BOUNDS_TOLERANCE || box.bottom > bounds.height + BOUNDS_TOLERANCE) failures.push(`${panel.dataset.typographyPanel}.${el.dataset.textRole} 变形后超出面板`);
    }
    for (let i=0;i<boxes.length;i++) for(let j=i+1;j<boxes.length;j++) {
      const a=boxes[i].box,b=boxes[j].box;
      if (Math.min(a.right,b.right)-Math.max(a.x,b.x)>BOUNDS_TOLERANCE && Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>BOUNDS_TOLERANCE)
        failures.push(`${panel.dataset.typographyPanel} 的 ${boxes[i].el.dataset.textRole} 与 ${boxes[j].el.dataset.textRole} 变形后重叠`);
    }
  }
  return [...new Set(failures)];
}

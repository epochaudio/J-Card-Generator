const MIN_TEXT_CONTRAST = 4.5;
const ACCENT_ADJUSTMENT_STEPS = 20;

// Persisted design choices. Missing fields always mean the original appearance.
export const DESIGN_EDITIONS = ['legacy', 'publication'];
export const FRONT_STYLES = ['STANDARD', 'EDITORIAL', 'REVERSIBLE'];
export const TITLE_SIZES = { compact: 64, balanced: 84, expressive: 104 };
export const PALETTES = {
  paper: { name: '暖纸档案', background: '#F2EBDD', text: '#25231F', secondary: '#595349', muted: '#70665A', accent: '#A44732', divider: '#C9BFAF' },
  warm: { name: '暖暗唱片', background: '#1C1917', text: '#EEE9DF', secondary: '#C5BCAF', muted: '#A69A89', accent: '#B99A64', divider: '#51473D' },
  cool: { name: '冷灰编辑', background: '#E9EDEB', text: '#233A35', secondary: '#415A52', muted: '#586B64', accent: '#62786B', divider: '#B8C5BE' },
};

export function luminance(hex) {
  const channels = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
export function contrastRatio(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
export function contrastInk(background) {
  const ink = contrastRatio(background, '#ffffff') >= contrastRatio(background, '#1a1a1a') ? '#ffffff' : '#1a1a1a';
  return contrastRatio(background, ink) >= MIN_TEXT_CONTRAST ? ink : '#000000';
}
export function mixColor(a, b, amount) {
  const channels = [1, 3, 5].map(offset => Math.round(parseInt(a.slice(offset, offset + 2), 16) * (1 - amount) + parseInt(b.slice(offset, offset + 2), 16) * amount));
  return `#${channels.map(value => value.toString(16).padStart(2, '0')).join('')}`;
}
export function readableAccent(accent, background) {
  const ink = contrastInk(background);
  for (let step = 0; step <= ACCENT_ADJUSTMENT_STEPS; step += 1) {
    const candidate = mixColor(accent, ink, step / ACCENT_ADJUSTMENT_STEPS);
    if (contrastRatio(candidate, background) >= MIN_TEXT_CONTRAST) return candidate;
  }
  return ink;
}
export function resolvePalette(theme, mode, dominantColor) {
  const preset = PALETTES[theme.paletteId];
  if (preset) return { ...preset, accent: theme.accent || preset.accent };
  const background = mode === 'light' ? '#ffffff' : mode === 'color' ? dominantColor || '#232629' : '#232629';
  const text = contrastInk(background);
  return { background, text, secondary: readableAccent(mixColor(text, background, 0.16), background), muted: readableAccent(mixColor(text, background, 0.28), background), divider: mixColor(text, background, 0.76), accent: theme.accent || '#cc3300' };
}

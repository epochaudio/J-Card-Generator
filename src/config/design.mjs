export const MIN_TEXT_CONTRAST = 4.5;
const ACCENT_ADJUSTMENT_STEPS = 20;
export const PAPER_TEXTURE = { inkAlpha: 0.15, opacity: 0.12 };

// Persisted choices for the unified cover design.
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
  if (theme.paletteId === 'custom') {
    const colors = normalizePanelColors(theme.colors);
    return { background: colors.front.background, text: colors.front.title, secondary: colors.front.artist, muted: colors.front.artist, accent: colors.front.accent, divider: colors.back.divider };
  }
  const preset = PALETTES[theme.paletteId];
  if (preset) return { ...preset, accent: theme.accent || preset.accent };
  const background = mode === 'light' ? '#ffffff' : mode === 'color' ? dominantColor || '#232629' : '#232629';
  const text = contrastInk(background);
  return { background, text, secondary: readableAccent(mixColor(text, background, 0.16), background), muted: readableAccent(mixColor(text, background, 0.28), background), divider: mixColor(text, background, 0.76), accent: theme.accent || '#cc3300' };
}

// These roles describe actual painted elements, shared by AI, storage and rendering.
export const PANEL_COLOR_ROLES = {
  front: { background: '正面背景', title: '专辑标题', artist: '艺术家', subtitle: '副标题与心情文字', badge: '标语文字', badgeBackground: '标语底色', accent: '无图时的占位装饰色', border: '封面图片边框' },
  back: { background: '背面曲目区背景', heading: '分面与作品标题', track: '曲名', artist: '曲目艺术家', duration: '时长', number: '曲序', note: '曲目备注', metadata: '录音资料正文', label: '资料标签', accent: '强调色块', divider: '分隔线' },
  shortBack: { background: '折页背景', heading: '厂牌与档案标题', track: '折页曲名', duration: '时长', number: '曲序', label: '资料标签', metadata: '录音资料和日期', accent: '分面圆标底色', badgeText: '分面圆标文字', divider: '折页边界线' },
  spine: { background: '脊背背景', title: '专辑标题', artist: '艺术家', id: '磁带编号', note: '脊背上下备注', divider: '脊背边界线' }
};
const DECORATIVE_COLOR_ROLES = new Set(['background', 'badgeBackground', 'accent', 'border', 'divider']);
export function normalizePanelColors(value) {
  const exactKeys = (object, keys) => object && typeof object === 'object' && !Array.isArray(object)
    && Object.keys(object).length === keys.length && keys.every(key => Object.hasOwn(object, key));
  if (!exactKeys(value, Object.keys(PANEL_COLOR_ROLES))) throw new Error('完整配色必须包含正面、背面、折页和脊背。');
  return Object.fromEntries(Object.entries(PANEL_COLOR_ROLES).map(([panel, roles]) => {
    if (!exactKeys(value[panel], Object.keys(roles))) throw new Error(`${panel} 配色字段不完整或包含未知字段。`);
    return [panel, Object.fromEntries(Object.keys(roles).map(role => {
      const color = value[panel][role];
      if (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) throw new Error(`${panel}.${role} 必须是六位十六进制色值。`);
      return [role, color.toUpperCase()];
    }))];
  }));
}
export function panelColorFailures(colors, texture = false) {
  const failures = [];
  for (const [panel, roles] of Object.entries(PANEL_COLOR_ROLES)) {
    for (const role of Object.keys(roles)) {
      if (DECORATIVE_COLOR_ROLES.has(role)) continue;
      const backgroundRole = panel === 'front' && role === 'badge' ? 'badgeBackground'
        : panel === 'shortBack' && role === 'badgeText' ? 'accent' : 'background';
      const background = colors[panel][backgroundRole];
      // SVG paper grain is black, with alpha <= 0.15 and layer opacity 0.12.
      // Spine and badge backgrounds are painted after this layer.
      const texturedBackground = texture && panel !== 'spine' && backgroundRole === 'background'
        ? mixColor(background, '#000000', PAPER_TEXTURE.inkAlpha * PAPER_TEXTURE.opacity) : background;
      const ratio = Math.min(contrastRatio(colors[panel][role], background), contrastRatio(colors[panel][role], texturedBackground));
      if (ratio < MIN_TEXT_CONTRAST) failures.push(`${panel}.${role} (${colors[panel][role]}) 与 ${panel}.${backgroundRole} (${colors[panel][backgroundRole]}) 对比度 ${ratio.toFixed(2)}，须至少 ${MIN_TEXT_CONTRAST}`);
    }
  }
  return failures;
}
export function resolvePanelColors(theme, mode, dominantColor, minimalSpine = false) {
  if (theme.paletteId === 'custom') return normalizePanelColors(theme.colors);
  const p = resolvePalette(theme, mode, dominantColor);
  const imageBackground = theme.paletteId === 'legacy' && mode === 'cover';
  const text = imageBackground ? '#ffffff' : p.text;
  const secondary = imageBackground ? '#e5e5e5' : p.secondary;
  const muted = imageBackground ? '#c9c9c9' : p.muted;
  const accent = readableAccent(p.accent, p.background);
  const spineBackground = minimalSpine ? p.background : p.accent;
  const spineText = minimalSpine ? text : contrastInk(spineBackground);
  return {
    front: { background: p.background, title: text, artist: secondary, subtitle: secondary, badge: secondary, badgeBackground: p.background, accent, border: p.background },
    back: { background: p.background, heading: text, track: text, artist: muted, duration: muted, number: muted, note: muted, metadata: secondary, label: muted, accent, divider: p.divider },
    shortBack: { background: p.background, heading: text, track: secondary, duration: secondary, number: muted, label: muted, metadata: secondary, accent, badgeText: contrastInk(accent), divider: p.divider },
    spine: { background: spineBackground, title: spineText, artist: spineText, id: minimalSpine ? readableAccent(p.accent, spineBackground) : spineText, note: spineText, divider: p.divider }
  };
}

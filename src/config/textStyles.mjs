// Only bundled, real weights are offered. No bundled face currently has native italics.
const VARIABLE_WEIGHTS = [400, 500, 600, 700];
const REGULAR = [400];
const THEME_WEIGHTS = {
  modern: { title: [400, 700], body: VARIABLE_WEIGHTS, serif: VARIABLE_WEIGHTS, mono: REGULAR },
  retro: { title: REGULAR, body: REGULAR, serif: REGULAR, mono: REGULAR },
  handwritten: { title: REGULAR, body: REGULAR, serif: REGULAR, mono: REGULAR },
  digital: { title: REGULAR, body: REGULAR, serif: REGULAR, mono: REGULAR },
  sourcehan: { title: VARIABLE_WEIGHTS, body: VARIABLE_WEIGHTS, serif: VARIABLE_WEIGHTS, mono: VARIABLE_WEIGHTS },
  editorial: { title: VARIABLE_WEIGHTS, body: VARIABLE_WEIGHTS, serif: VARIABLE_WEIGHTS, mono: REGULAR },
  puhuiti: { title: REGULAR, body: REGULAR, serif: REGULAR, mono: REGULAR }
};
export const TEXT_STYLE_ROLES = {
  title: { name: '专辑及作品标题', family: 'title', width: [0.8, 1.2], slant: [-12, 12] },
  artist: { name: '正面和脊背艺术家', family: 'body', width: [0.9, 1.1], slant: [-8, 8] },
  subtitle: { name: '正面副标题', family: 'body', width: [0.9, 1.1], slant: [-8, 8] },
  badge: { name: '标语', family: 'serif', width: [0.85, 1.15], slant: [-10, 10] },
  track: { name: '曲名及行内附属署名', family: 'body', width: [0.95, 1.05], slant: [-4, 4] },
  note: { name: '曲目备注', family: 'body', width: [0.95, 1.05], slant: [-4, 4] },
  metadata: { name: '时长、编号、资料和脊背备注', family: 'mono', width: [0.98, 1.02], slant: [-3, 3] }
};
export function typographyCapabilities(themeId) {
  const theme = Object.hasOwn(THEME_WEIGHTS, themeId) ? THEME_WEIGHTS[themeId] : null;
  if (!theme) throw new Error('未知字体主题。');
  return Object.fromEntries(Object.entries(TEXT_STYLE_ROLES).map(([role, rules]) => [role, { ...rules, weights: theme[rules.family], nativeItalic: false }]));
}
export function defaultTextStyles(themeId) {
  return Object.fromEntries(Object.entries(typographyCapabilities(themeId)).map(([role, cap]) => [role, { weight: cap.weights[0], slant: 0, width: 1 }]));
}
export function normalizeTextStyles(value, themeId) {
  if (value == null) return null; // Older works retain their exact original typography.
  const exact = (o, keys) => o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).length === keys.length && keys.every(k => Object.hasOwn(o, k));
  if (!exact(value, Object.keys(TEXT_STYLE_ROLES))) throw new Error('文字样式必须包含全部文字用途，且不能包含未知字段。');
  const capabilities = typographyCapabilities(themeId);
  return Object.fromEntries(Object.entries(capabilities).map(([role, cap]) => {
    const v = value[role];
    if (!exact(v, ['weight', 'slant', 'width']) || !cap.weights.includes(v.weight)
      || !Number.isFinite(v.slant) || v.slant < cap.slant[0] || v.slant > cap.slant[1]
      || !Number.isFinite(v.width) || v.width < cap.width[0] || v.width > cap.width[1]) throw new Error(`${role} 字重、倾斜或宽度超出当前字体允许范围。`);
    return [role, { weight: v.weight, slant: v.slant, width: v.width }];
  }));
}
export const fontFamilyName = font => typeof font === 'object' ? font.family : font;
export function typographyFont(config, role, family = TEXT_STYLE_ROLES[role].family) {
  const name = config.fonts[family];
  return config.typography ? { family: name, role, style: config.typography[role] } : name;
}
export function resolveTypographyFont(font, options = {}) {
  return typeof font === 'object' ? { family: font.family, options: { ...options, fontWeight: font.style.weight, fontStyle: 'normal' }, style: font.style }
    : { family: font, options, style: null };
}
export const slantFactor = degrees => Math.tan(degrees * Math.PI / 180);
export const transformedTextWidth = (width, height, style) => style ? width * style.width + Math.abs(slantFactor(style.slant)) * height : width;

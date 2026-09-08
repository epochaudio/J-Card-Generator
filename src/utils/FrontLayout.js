import TypographyService from '../services/TypographyService.js';
import { TITLE_SIZES } from '../config/design.mjs';
import { JCARD_DIMENSIONS } from '../constants/app.js';

export const FRONT_RULES = {
  margin: 54, imageGap: 42, bottom: 54,
  titleMin: 40, artistSize: 28, artistMin: 22, badgeSize: 22, badgeMin: 18,
  titleLineHeight: 1.22, bodyLineHeight: 1.45, titleArtistGap: 24, badgeGap: 20,
};
export function computeFrontLayout(data, fontConfig, theme = {}) {
  const rules = FRONT_RULES;
  const width = JCARD_DIMENSIONS.panels.front;
  const editorial = data.layout?.frontStyle === 'EDITORIAL';
  const image = { x: 0, y: 0, size: width };
  const top = image.y + image.size + rules.imageGap;
  const maxHeight = JCARD_DIMENSIONS.height - rules.bottom - top;
  const maxWidth = width - rules.margin * 2;
  const titleMax = TITLE_SIZES[data.layout?.titleSize] || TITLE_SIZES.balanced;
  const artist = [data.artist, theme.mood_description].filter(Boolean).join(' · ');
  const artistTracking = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(artist) || artist.length > 28 ? 0 : 2;
  let result;
  for (let size = titleMax; size >= rules.titleMin; size -= 2) {
    const ratio = size / titleMax;
    const definitions = [
      { role: 'title', text: data.title, font: fontConfig.fonts.title, size, weight: 600, tracking: 0, lineRatio: rules.titleLineHeight, gap: 0 },
      { role: 'artist', text: artist, font: fontConfig.fonts.body, size: Math.max(rules.artistMin, Math.round(rules.artistSize * ratio)), weight: 500, tracking: artistTracking, lineRatio: rules.bodyLineHeight, gap: rules.titleArtistGap },
      { role: 'badge', text: data.coverBadge, font: fontConfig.fonts.serif, size: Math.max(rules.badgeMin, Math.round(rules.badgeSize * ratio)), weight: 400, tracking: 0, lineRatio: rules.bodyLineHeight, gap: rules.badgeGap },
    ];
    const blocks = definitions.filter(block => block.text).map(block => {
      const box = TypographyService.measureFontBox(block.text, block.font, block.size, { fontWeight: block.weight });
      return { ...block, ascent: box.ascent,
        lines: TypographyService.wrapMeasuredText(block.text, block.font, block.size, maxWidth, { fontWeight: block.weight, letterSpacing: block.tracking }),
        lineHeight: Math.max(block.size * block.lineRatio, box.ascent + box.descent),
      };
    });
    const height = blocks.reduce((sum, block, i) => sum + block.lines.length * block.lineHeight + (i ? block.gap : 0), 0);
    let y = top + Math.max(0, (maxHeight - height) / 2);
    for (const [index, block] of blocks.entries()) {
      if (index) y += block.gap;
      block.y = y + block.ascent;
      y += block.lines.length * block.lineHeight;
    }
    const fitsWidth = blocks.every(block => block.lines.every(line => TypographyService.measureWidth(line, block.font, block.size, { fontWeight: block.weight, letterSpacing: block.tracking }) <= maxWidth));
    result = { image, blocks, overflow: height > maxHeight || !fitsWidth, x: editorial ? rules.margin : width / 2, anchor: editorial ? 'start' : 'middle', margin: rules.margin };
    if (!result.overflow) break;
  }
  return result;
}

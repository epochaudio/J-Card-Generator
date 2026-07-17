import TypographyService from '../services/TypographyService.js';

const SPINE_RULES = {
  topMargin: 40,
  bottomMargin: 40,
  panelSidePadding: 18,
  singleLineTitleMin: 42,
  singleLineTitleMax: 84,
  twoLineTitleMin: 30,
  twoLineTitleMax: 56,
  emergencyTitleMin: 38,
  topStackGap: 4,
  bottomLaneGap: 4,
  metaModes: [
    {
      id: 'full',
      titleGap: 48,
      safeGap: 80,
      showNotes: true,
      showTapeId: true,
      topBudget: 220,
      bottomBudget: 320,
      noteUpperMin: 12,
      noteUpperMax: 14,
      noteLowerMin: 12,
      noteLowerMax: 14,
      tapeIdMin: 14,
      tapeIdMax: 18,
      artistMin: 17,
      artistMax: 24,
    },
    {
      id: 'compact',
      titleGap: 40,
      safeGap: 60,
      showNotes: true,
      showTapeId: true,
      topBudget: 180,
      bottomBudget: 260,
      noteUpperMin: 12,
      noteUpperMax: 12,
      noteLowerMin: 12,
      noteLowerMax: 12,
      tapeIdMin: 14,
      tapeIdMax: 16,
      artistMin: 17,
      artistMax: 20,
    },
    {
      id: 'no-notes',
      titleGap: 36,
      safeGap: 0,
      showNotes: false,
      showTapeId: true,
      topBudget: 160,
      bottomBudget: 220,
      tapeIdMin: 13,
      tapeIdMax: 15,
      artistMin: 17,
      artistMax: 20,
    },
    {
      id: 'artist-only',
      titleGap: 28,
      safeGap: 0,
      showNotes: false,
      showTapeId: false,
      topBudget: 0,
      bottomBudget: 180,
      artistMin: 16,
      artistMax: 18,
    },
  ],
};

const ELLIPSIS = '...';

const cleanText = (text) => String(text || '').replace(/\s+/g, ' ').trim();
const hasCjk = (text) => /[\u3400-\u9fff\u3040-\u30ff]/.test(text);

function formatText(text, forceCaps) {
  const normalized = cleanText(text);
  return forceCaps ? normalized.toUpperCase() : normalized;
}

function measure(text, fontFamily, fontSize, options = {}) {
  return TypographyService.measureWidth(text, fontFamily, fontSize, options);
}

function fitSingleLineItem({
  text,
  fontFamily,
  minFontSize,
  maxFontSize,
  maxWidth,
  fontOptions = {},
  allowEllipsis = false,
}) {
  const normalized = cleanText(text);
  if (!normalized || maxWidth <= 0) return null;

  const minWidth = measure(normalized, fontFamily, minFontSize, fontOptions);
  if (minWidth > maxWidth) {
    if (!allowEllipsis) return null;

    const fittedText = ellipsizeToFit(normalized, fontFamily, minFontSize, maxWidth, fontOptions);
    return {
      text: fittedText,
      fontSize: minFontSize,
      width: measure(fittedText, fontFamily, minFontSize, fontOptions),
      truncated: fittedText !== normalized,
    };
  }

  const fontSize = TypographyService.fitFontSizeSingleLine(
    normalized,
    fontFamily,
    maxWidth,
    minFontSize,
    maxFontSize,
    fontOptions
  );

  return {
    text: normalized,
    fontSize,
    width: measure(normalized, fontFamily, fontSize, fontOptions),
    truncated: false,
  };
}

function segmentText(text) {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    return Array.from(segmenter.segment(text), (segment) => segment.segment);
  }

  return Array.from(text);
}

function getBreakIndices(text) {
  const parts = segmentText(text);
  const indices = [];

  for (let i = 1; i < parts.length; i += 1) {
    const left = parts.slice(0, i).join('');
    const right = parts.slice(i).join('');
    if (!left.trim() || !right.trim()) continue;

    const prev = parts[i - 1];
    const next = parts[i];
    const preferred =
      /\s/.test(prev) ||
      /[/:：|·•,\-–—]/.test(prev) ||
      /[、，。！？.!?]/.test(prev) ||
      (hasCjk(prev) && hasCjk(next));

    if (preferred) indices.push(i);
  }

  if (indices.length > 0) return { parts, indices };
  return {
    parts,
    indices: Array.from({ length: Math.max(0, parts.length - 1) }, (_, idx) => idx + 1),
  };
}

function findBestTwoLineSplit(text, fontFamily, fontSize, maxLineWidth, fontOptions = {}) {
  const normalized = cleanText(text);
  if (!normalized) return null;

  const { parts, indices } = getBreakIndices(normalized);
  let best = null;

  indices.forEach((breakIndex) => {
    const first = parts.slice(0, breakIndex).join('').trim();
    const second = parts.slice(breakIndex).join('').trim();
    if (!first || !second) return;

    const firstWidth = measure(first, fontFamily, fontSize, fontOptions);
    const secondWidth = measure(second, fontFamily, fontSize, fontOptions);
    if (firstWidth > maxLineWidth || secondWidth > maxLineWidth) return;

    const score = Math.max(firstWidth, secondWidth) + Math.abs(firstWidth - secondWidth) * 0.35;
    if (!best || score < best.score) {
      best = {
        lines: [first, second],
        widths: [firstWidth, secondWidth],
        score,
      };
    }
  });

  return best;
}

function fitTwoLineTitle(text, fontFamily, maxLineWidth, crossAxisBudget, minFontSize, maxFontSize, fontOptions = {}) {
  const normalized = cleanText(text);
  if (!normalized || maxLineWidth <= 0 || crossAxisBudget <= 0) return null;

  for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize -= 1) {
    const lineGap = Math.max(4, Math.round(fontSize * 0.16));
    const crossAxisSize = fontSize * 2 + lineGap;
    if (crossAxisSize > crossAxisBudget) continue;

    const split = findBestTwoLineSplit(normalized, fontFamily, fontSize, maxLineWidth, fontOptions);
    if (split) {
      return {
        lines: split.lines,
        widths: split.widths,
        fontSize,
        lineGap,
      };
    }
  }

  return null;
}

function ellipsizeToFit(text, fontFamily, fontSize, maxWidth, fontOptions = {}) {
  const normalized = cleanText(text);
  if (!normalized) return '';
  if (measure(normalized, fontFamily, fontSize, fontOptions) <= maxWidth) return normalized;

  const parts = segmentText(normalized);
  let low = 0;
  let high = parts.length;
  let best = '';

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = `${parts.slice(0, mid).join('').trim()}${ELLIPSIS}`;
    const width = measure(candidate, fontFamily, fontSize, fontOptions);

    if (width <= maxWidth) {
      best = candidate;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best || ELLIPSIS;
}

function buildAutoShortTitle(rawTitle) {
  const title = cleanText(rawTitle);
  if (!title) return '';

  const withoutBrackets = title
    .replace(/\s*[\(\（\[\【][^\)\）\]\】]+[\)\）\]\】]\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const separatorParts = withoutBrackets
    .split(/\s*[:：|/·•\-–—]\s*/g)
    .map((part) => part.trim())
    .filter(Boolean);

  if (separatorParts.length > 1) {
    const preferred = separatorParts.find((part) => part.length >= 3) || separatorParts[0];
    if (preferred && preferred !== title) return preferred;
  }

  if (hasCjk(withoutBrackets)) {
    const chars = segmentText(withoutBrackets).filter((part) => !/\s/.test(part));
    if (chars.length > 10) {
      return chars.slice(0, 10).join('');
    }
  }

  const words = withoutBrackets.split(/\s+/).filter(Boolean);
  if (words.length > 4) {
    return words.slice(0, 4).join(' ');
  }

  const graphemes = segmentText(withoutBrackets);
  if (graphemes.length > 14) {
    return graphemes.slice(0, 12).join('');
  }

  return withoutBrackets;
}

function buildTopItems({ noteUpper, tapeId, bodyFont, metaMode }) {
  const items = [];

  const note = metaMode.showNotes
    ? fitSingleLineItem({
        text: noteUpper,
        fontFamily: bodyFont,
        minFontSize: metaMode.noteUpperMin,
        maxFontSize: metaMode.noteUpperMax,
        maxWidth: metaMode.topBudget,
        fontOptions: { letterSpacing: 1 },
        allowEllipsis: true,
      })
    : null;

  const id = metaMode.showTapeId
    ? fitSingleLineItem({
        text: tapeId,
        fontFamily: bodyFont,
        minFontSize: metaMode.tapeIdMin,
        maxFontSize: metaMode.tapeIdMax,
        maxWidth: metaMode.topBudget,
        fontOptions: { fontWeight: 'bold' },
        allowEllipsis: true,
      })
    : null;

  const stackOffset = note && id
    ? Math.max(note.fontSize, id.fontSize) * 0.55 + SPINE_RULES.topStackGap
    : 0;

  if (note) {
    items.push({
      role: 'noteUpper',
      text: note.text,
      width: note.width,
      fontSize: note.fontSize,
      crossOffset: id ? -stackOffset : 0,
      fontOptions: { letterSpacing: 1 },
      fillRole: 'id',
      opacity: 0.8,
    });
  }

  if (id) {
    items.push({
      role: 'tapeId',
      text: id.text,
      width: id.width,
      fontSize: id.fontSize,
      crossOffset: note ? stackOffset : 0,
      fontOptions: { fontWeight: 'bold' },
      fillRole: 'id',
      opacity: 1,
    });
  }

  return {
    items,
    blockLength: Math.max(0, ...items.map((item) => item.width)),
  };
}

function resolveBottomLaneOffset(artistItem, noteItem, crossAxisBudget) {
  if (!artistItem || !noteItem) return 0;

  const laneGap = Math.max(
    SPINE_RULES.bottomLaneGap,
    Math.round(Math.max(artistItem.fontSize, noteItem.fontSize) * 0.18)
  );
  const requiredOffset = artistItem.fontSize / 2 + noteItem.fontSize / 2 + laneGap;
  const maxOffset = Math.max(0, crossAxisBudget / 2 - noteItem.fontSize / 2);

  return Math.min(requiredOffset, maxOffset);
}

function buildBottomItems({ noteLower, artist, bodyFont, metaMode, crossAxisBudget, outerLaneDirection }) {
  const artistItem = fitSingleLineItem({
    text: artist,
    fontFamily: bodyFont,
    minFontSize: metaMode.artistMin,
    maxFontSize: metaMode.artistMax,
    maxWidth: metaMode.bottomBudget,
    allowEllipsis: true,
  });

  const note = metaMode.showNotes
    ? fitSingleLineItem({
        text: noteLower,
        fontFamily: bodyFont,
        minFontSize: metaMode.noteLowerMin,
        maxFontSize: metaMode.noteLowerMax,
        maxWidth: metaMode.bottomBudget,
        fontOptions: { letterSpacing: 1 },
        allowEllipsis: true,
      })
    : null;

  const items = [];
  const noteTrackOffset = resolveBottomLaneOffset(artistItem, note, crossAxisBudget);

  if (note) {
    items.push({
      role: 'noteLower',
      text: note.text,
      width: note.width,
      fontSize: note.fontSize,
      physicalOffset: 0,
      crossOffset: artistItem ? outerLaneDirection * noteTrackOffset : 0,
      fontOptions: { letterSpacing: 1 },
      fillRole: 'title',
      opacity: 0.8,
    });
  }

  if (artistItem) {
    items.push({
      role: 'artist',
      text: artistItem.text,
      width: artistItem.width,
      fontSize: artistItem.fontSize,
      physicalOffset: 0,
      crossOffset: 0,
      fontOptions: {},
      fillRole: 'title',
      opacity: 1,
    });
  }

  const blockLength = Math.max(note?.width || 0, artistItem?.width || 0);

  return {
    items,
    blockLength,
  };
}

function buildTitleStrategies(fullTitle, customShortTitle, autoShortTitle) {
  const strategies = [
    { id: 'full-single', source: 'full', layout: 'single', text: fullTitle },
    { id: 'full-double', source: 'full', layout: 'double', text: fullTitle },
  ];

  if (customShortTitle && customShortTitle !== fullTitle) {
    strategies.push(
      { id: 'custom-single', source: 'custom', layout: 'single', text: customShortTitle },
      { id: 'custom-double', source: 'custom', layout: 'double', text: customShortTitle }
    );
  }

  if (autoShortTitle && autoShortTitle !== fullTitle && autoShortTitle !== customShortTitle) {
    strategies.push(
      { id: 'auto-single', source: 'auto', layout: 'single', text: autoShortTitle },
      { id: 'auto-double', source: 'auto', layout: 'double', text: autoShortTitle }
    );
  }

  return strategies;
}

function describeTitleStrategy(strategy, metaModeId) {
  const sourceLabel = strategy.source === 'full'
    ? '完整标题'
    : strategy.source === 'custom'
      ? '脊部短标题'
      : strategy.source === 'auto'
        ? '自动短标题'
        : '截短标题';

  const layoutLabel = strategy.layout === 'double' ? '双行' : '单行';

  let metaLabel = '';
  if (metaModeId === 'compact') metaLabel = '，备注已压缩';
  if (metaModeId === 'no-notes') metaLabel = '，备注已收起';
  if (metaModeId === 'artist-only') metaLabel = '，仅保留艺术家';

  return `${sourceLabel} / ${layoutLabel}${metaLabel}`;
}

function buildEmergencyTitle(fullTitle, titleFont, titleZoneLength, crossAxisBudget) {
  const fontSize = Math.min(
    TypographyService.fitFontSizeSingleLine(
      fullTitle,
      titleFont,
      titleZoneLength,
      SPINE_RULES.emergencyTitleMin,
      SPINE_RULES.singleLineTitleMax,
      { fontWeight: 'bold' }
    ),
    crossAxisBudget
  );

  const safeFontSize = Math.max(SPINE_RULES.emergencyTitleMin, Math.min(fontSize, SPINE_RULES.singleLineTitleMax));
  const text = ellipsizeToFit(fullTitle, titleFont, safeFontSize, titleZoneLength, { fontWeight: 'bold' });

  return {
    lines: [text],
    fontSize: safeFontSize,
    lineGap: 0,
    source: 'ellipsis',
    layout: 'single',
  };
}

const SpineLayoutEngine = {
  compute({ data, height, panelWidth, fontConfig }) {
    const titleFont = fontConfig?.fonts?.title || 'Arial, sans-serif';
    const bodyFont = fontConfig?.fonts?.body || 'Arial, sans-serif';
    const forceCaps = !!data?.layout?.forceCaps;

    const fullTitle = formatText(data?.title, forceCaps);
    const customShortTitle = formatText(data?.spineTitle, forceCaps);
    const autoShortTitle = formatText(buildAutoShortTitle(data?.title), forceCaps);

    const halfHeight = height / 2;
    const topEdgePos = -halfHeight + SPINE_RULES.topMargin;
    const bottomEdgePos = halfHeight - SPINE_RULES.bottomMargin;
    const crossAxisBudget = Math.max(40, panelWidth - SPINE_RULES.panelSidePadding * 2);
    const outerLaneDirection = data?.layout?.spineInverted === false ? -1 : 1;

    let chosenLayout = null;

    for (const metaMode of SPINE_RULES.metaModes) {
      const topMeta = buildTopItems({
        noteUpper: data?.layout?.noteUpper,
        tapeId: data?.tapeId,
        bodyFont,
        metaMode,
      });

      const bottomMeta = buildBottomItems({
        noteLower: data?.layout?.noteLower,
        artist: formatText(data?.artist, forceCaps),
        bodyFont,
        metaMode,
        crossAxisBudget,
        outerLaneDirection,
      });

      const titleStart = topEdgePos + topMeta.blockLength + (topMeta.blockLength > 0 ? metaMode.titleGap : 0);
      const titleEnd = bottomEdgePos - bottomMeta.blockLength - (bottomMeta.blockLength > 0 ? metaMode.titleGap : 0);
      const titleZoneLength = Math.max(0, titleEnd - titleStart);
      const titleCenterX = titleStart + titleZoneLength / 2;

      if (titleZoneLength <= 0) continue;

      const strategies = buildTitleStrategies(fullTitle, customShortTitle, autoShortTitle);
      let titleLayout = null;
      let chosenStrategy = null;

      for (const strategy of strategies) {
        if (!strategy.text) continue;

        if (strategy.layout === 'single') {
          const fitted = fitSingleLineItem({
            text: strategy.text,
            fontFamily: titleFont,
            minFontSize: SPINE_RULES.singleLineTitleMin,
            maxFontSize: SPINE_RULES.singleLineTitleMax,
            maxWidth: titleZoneLength,
            fontOptions: { fontWeight: 'bold' },
            allowEllipsis: false,
          });

          if (fitted) {
            titleLayout = {
              lines: [fitted.text],
              widths: [fitted.width],
              fontSize: fitted.fontSize,
              lineGap: 0,
            };
            chosenStrategy = strategy;
            break;
          }
        } else {
          const fitted = fitTwoLineTitle(
            strategy.text,
            titleFont,
            titleZoneLength,
            crossAxisBudget,
            SPINE_RULES.twoLineTitleMin,
            SPINE_RULES.twoLineTitleMax,
            { fontWeight: 'bold' }
          );

          if (fitted) {
            titleLayout = fitted;
            chosenStrategy = strategy;
            break;
          }
        }
      }

      if (titleLayout && chosenStrategy) {
        chosenLayout = {
          titleFont,
          bodyFont,
          topMeta,
          bottomMeta,
          titleLayout,
          chosenStrategy,
          titleCenterX,
          titleZoneLength,
          metaMode,
        };
        break;
      }
    }

    if (!chosenLayout) {
      const fallbackMetaMode = SPINE_RULES.metaModes[SPINE_RULES.metaModes.length - 1];
      const bottomMeta = buildBottomItems({
        noteLower: '',
        artist: formatText(data?.artist, forceCaps),
        bodyFont,
        metaMode: fallbackMetaMode,
        crossAxisBudget,
        outerLaneDirection,
      });

      const titleStart = topEdgePos + fallbackMetaMode.titleGap;
      const titleEnd = bottomEdgePos - bottomMeta.blockLength - (bottomMeta.blockLength > 0 ? fallbackMetaMode.titleGap : 0);
      const titleZoneLength = Math.max(80, titleEnd - titleStart);
      const titleCenterX = titleStart + titleZoneLength / 2;
      const emergencyTitle = buildEmergencyTitle(fullTitle, titleFont, titleZoneLength, crossAxisBudget);

      chosenLayout = {
        titleFont,
        bodyFont,
        topMeta: { items: [], blockLength: 0 },
        bottomMeta,
        titleLayout: emergencyTitle,
        chosenStrategy: { source: 'ellipsis', layout: 'single' },
        titleCenterX,
        titleZoneLength,
        metaMode: fallbackMetaMode,
      };
    }

    const titleOffsets = chosenLayout.titleLayout.lines.length === 2
      ? [
          -(chosenLayout.titleLayout.fontSize + chosenLayout.titleLayout.lineGap) / 2,
          (chosenLayout.titleLayout.fontSize + chosenLayout.titleLayout.lineGap) / 2,
        ]
      : [0];

    return {
      titleFont: chosenLayout.titleFont,
      bodyFont: chosenLayout.bodyFont,
      title: {
        lines: chosenLayout.titleLayout.lines,
        fontSize: chosenLayout.titleLayout.fontSize,
        centerX: chosenLayout.titleCenterX,
        crossOffsets: titleOffsets,
      },
      topItems: chosenLayout.topMeta.items.map((item) => ({
        ...item,
        physicalOffset: topEdgePos,
      })),
      bottomItems: chosenLayout.bottomMeta.items.map((item) => ({
        ...item,
        physicalOffset: bottomEdgePos - item.physicalOffset,
      })),
      status: {
        source: chosenLayout.chosenStrategy.source,
        layout: chosenLayout.chosenStrategy.layout,
        metaMode: chosenLayout.metaMode.id,
        summary: describeTitleStrategy(chosenLayout.chosenStrategy, chosenLayout.metaMode.id),
      },
    };
  },
};

export default SpineLayoutEngine;

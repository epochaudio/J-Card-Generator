import { JCARD_DIMENSIONS } from '../constants/app.js';
import TypographyService from '../services/TypographyService.js';

const ARCHIVE_COLUMN_X = {
  label: 50,
  credits: 380,
  equipment: 750,
  meta: JCARD_DIMENSIONS.height - 50
};

const COLUMN_TOP_Y = 36;
const COLUMN_MAX_BOTTOM = 188;
const COLUMN_MAX_HEIGHT = COLUMN_MAX_BOTTOM - COLUMN_TOP_Y;
const HEADER_FONT_SIZE = 12;
const HEADER_LINE_HEIGHT = 16;
const HEADER_BODY_GAP = 8;
const SECTION_GAP = 18;
const LABEL_SOURCE_GAP = 14;

const ARCHIVE_LEVELS = [
  {
    id: 'LEVEL_0_FULL',
    labelMaxLines: 3,
    labelMinFontSize: 24,
    labelMaxFontSize: 32,
    sourceMaxLines: 2,
    sourceMinFontSize: 14,
    sourceMaxFontSize: 16,
    showCredits: true,
    creditsSectionLimit: 2,
    creditsBodyMaxLines: 2,
    creditsMinFontSize: 14,
    creditsMaxFontSize: 16,
    showEquipment: true,
    equipmentMaxLines: 4,
    equipmentMinFontSize: 14,
    equipmentMaxFontSize: 16
  },
  {
    id: 'LEVEL_1_TRIM_CREDITS',
    labelMaxLines: 3,
    labelMinFontSize: 23,
    labelMaxFontSize: 30,
    sourceMaxLines: 1,
    sourceMinFontSize: 13,
    sourceMaxFontSize: 15,
    showCredits: true,
    creditsSectionLimit: 2,
    creditsBodyMaxLines: 1,
    creditsMinFontSize: 13,
    creditsMaxFontSize: 15,
    showEquipment: true,
    equipmentMaxLines: 3,
    equipmentMinFontSize: 13,
    equipmentMaxFontSize: 15
  },
  {
    id: 'LEVEL_2_COMPACT_META',
    labelMaxLines: 2,
    labelMinFontSize: 22,
    labelMaxFontSize: 28,
    sourceMaxLines: 1,
    sourceMinFontSize: 13,
    sourceMaxFontSize: 15,
    showCredits: false,
    creditsSectionLimit: 0,
    creditsBodyMaxLines: 0,
    creditsMinFontSize: 13,
    creditsMaxFontSize: 14,
    showEquipment: true,
    equipmentMaxLines: 2,
    equipmentMinFontSize: 13,
    equipmentMaxFontSize: 14
  },
  {
    id: 'LEVEL_3_META_ONLY',
    labelMaxLines: 2,
    labelMinFontSize: 20,
    labelMaxFontSize: 26,
    sourceMaxLines: 1,
    sourceMinFontSize: 12,
    sourceMaxFontSize: 14,
    showCredits: false,
    creditsSectionLimit: 0,
    creditsBodyMaxLines: 0,
    creditsMinFontSize: 12,
    creditsMaxFontSize: 12,
    showEquipment: false,
    equipmentMaxLines: 0,
    equipmentMinFontSize: 12,
    equipmentMaxFontSize: 12
  }
];

const trimLineToWidth = (line, suffix, maxWidth, fontFamily, fontSize, fontOptions = {}) => {
  const normalizedLine = (line || '').trimEnd();
  const fullCandidate = `${normalizedLine}${suffix}`;

  if (TypographyService.measureWidth(fullCandidate, fontFamily, fontSize, fontOptions) <= maxWidth) {
    return fullCandidate;
  }

  for (let i = normalizedLine.length - 1; i >= 0; i -= 1) {
    const candidate = `${normalizedLine.slice(0, i).trimEnd()}${suffix}`;
    if (TypographyService.measureWidth(candidate, fontFamily, fontSize, fontOptions) <= maxWidth) {
      return candidate;
    }
  }

  return suffix.trim();
};

const clampWrappedLines = (lines, maxLines, maxWidth, fontFamily, fontSize, fontOptions = {}) => {
  if (!maxLines || lines.length <= maxLines) return lines;

  const clamped = lines.slice(0, maxLines);
  clamped[maxLines - 1] = trimLineToWidth(clamped[maxLines - 1], '...', maxWidth, fontFamily, fontSize, fontOptions);
  return clamped;
};

const createTextBlock = (text, {
  fontFamily,
  fontOptions = {},
  maxWidth,
  maxHeight,
  maxLines,
  minFontSize,
  maxFontSize,
  lineHeightRatio = 1.2
}) => {
  const normalized = String(text || '').trim();
  if (!normalized || !maxLines || maxHeight <= 0) {
    return {
      lines: [],
      fontSize: maxFontSize,
      lineHeight: Math.round(maxFontSize * lineHeightRatio),
      height: 0,
      isTruncated: false
    };
  }

  for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize -= 1) {
    const lineHeight = Math.round(fontSize * lineHeightRatio);
    const wrapped = TypographyService.wrapText(normalized, fontFamily, fontSize, maxWidth, fontOptions);
    const clamped = clampWrappedLines(wrapped, maxLines, maxWidth, fontFamily, fontSize, fontOptions);
    const height = clamped.length * lineHeight;

    if (height <= maxHeight) {
      return {
        lines: clamped,
        fontSize,
        lineHeight,
        height,
        isTruncated: wrapped.length > clamped.length || clamped.join('\n') !== wrapped.slice(0, clamped.length).join('\n')
      };
    }
  }

  const fontSize = minFontSize;
  const lineHeight = Math.round(fontSize * lineHeightRatio);
  const maxLinesByHeight = Math.max(1, Math.min(maxLines, Math.floor(maxHeight / lineHeight)));
  const wrapped = TypographyService.wrapText(normalized, fontFamily, fontSize, maxWidth, fontOptions);
  const clamped = clampWrappedLines(wrapped, maxLinesByHeight, maxWidth, fontFamily, fontSize, fontOptions);

  return {
    lines: clamped,
    fontSize,
    lineHeight,
    height: clamped.length * lineHeight,
    isTruncated: true
  };
};

const buildLabeledBodyBlock = ({
  header,
  bodyText,
  bodyFontFamily,
  bodyFontOptions,
  maxWidth,
  totalMaxHeight,
  bodyMaxLines,
  bodyMinFontSize,
  bodyMaxFontSize
}) => {
  const normalizedBody = String(bodyText || '').trim();
  if (!normalizedBody) {
    return {
      header,
      headerFontSize: HEADER_FONT_SIZE,
      headerLineHeight: HEADER_LINE_HEIGHT,
      headerY: 0,
      bodyY: HEADER_LINE_HEIGHT + HEADER_BODY_GAP,
      body: null,
      height: 0
    };
  }

  const bodyMaxHeight = Math.max(0, totalMaxHeight - HEADER_LINE_HEIGHT - HEADER_BODY_GAP);
  if (bodyMaxHeight <= 0) return null;

  const body = createTextBlock(normalizedBody, {
    fontFamily: bodyFontFamily,
    fontOptions: bodyFontOptions,
    maxWidth,
    maxHeight: bodyMaxHeight,
    maxLines: bodyMaxLines,
    minFontSize: bodyMinFontSize,
    maxFontSize: bodyMaxFontSize
  });

  return {
    header,
    headerFontSize: HEADER_FONT_SIZE,
    headerLineHeight: HEADER_LINE_HEIGHT,
    headerY: 0,
    bodyY: HEADER_LINE_HEIGHT + HEADER_BODY_GAP,
    body,
    height: HEADER_LINE_HEIGHT + HEADER_BODY_GAP + body.height
  };
};

const buildArchiveCreditsSections = (recordingData, level, bodyFont) => {
  const credits = recordingData?.credits;
  const entries = [];

  if (credits?.producers?.length) {
    entries.push({ header: 'PRODUCED BY', bodyText: credits.producers.join(', ').toUpperCase() });
  }
  if (credits?.engineers?.length) {
    entries.push({ header: 'ENGINEERED BY', bodyText: credits.engineers.join(', ').toUpperCase() });
  }

  return entries.slice(0, level.creditsSectionLimit).map((entry) => ({
    ...entry,
    bodyFontFamily: bodyFont
  }));
};

const buildLabelColumn = ({ level, labelText, sourceText, monoFont, bodyFont, labelMaxWidth }) => {
  const label = createTextBlock(labelText, {
    fontFamily: monoFont,
    fontOptions: { fontWeight: 'bold' },
    maxWidth: labelMaxWidth,
    maxHeight: COLUMN_MAX_HEIGHT,
    maxLines: level.labelMaxLines,
    minFontSize: level.labelMinFontSize,
    maxFontSize: level.labelMaxFontSize,
    lineHeightRatio: 1.18
  });

  let currentY = label.height;
  let sourceBlock = null;

  if (String(sourceText || '').trim()) {
    const remainingHeight = COLUMN_MAX_HEIGHT - currentY - LABEL_SOURCE_GAP;
    if (remainingHeight <= 0) return null;

    sourceBlock = buildLabeledBodyBlock({
      header: 'SOURCE',
      bodyText: sourceText,
      bodyFontFamily: bodyFont,
      maxWidth: labelMaxWidth,
      totalMaxHeight: remainingHeight,
      bodyMaxLines: level.sourceMaxLines,
      bodyMinFontSize: level.sourceMinFontSize,
      bodyMaxFontSize: level.sourceMaxFontSize
    });

    if (!sourceBlock) return null;
    sourceBlock = {
      ...sourceBlock,
      groupY: currentY + LABEL_SOURCE_GAP
    };
    currentY = sourceBlock.groupY + sourceBlock.height;
  }

  return {
    x: ARCHIVE_COLUMN_X.label,
    topY: COLUMN_TOP_Y,
    height: currentY,
    label,
    source: sourceBlock
  };
};

const buildCreditsColumn = ({ level, recordingData, bodyFont, creditsMaxWidth }) => {
  if (!level.showCredits) {
    return null;
  }

  const sectionsData = buildArchiveCreditsSections(recordingData, level, bodyFont);
  if (sectionsData.length === 0) {
    return null;
  }

  const sections = [];
  let cursorY = 0;

  for (const section of sectionsData) {
    const remainingHeight = COLUMN_MAX_HEIGHT - cursorY;
    if (remainingHeight <= 0) return null;

    const block = buildLabeledBodyBlock({
      header: section.header,
      bodyText: section.bodyText,
      bodyFontFamily: section.bodyFontFamily,
      maxWidth: creditsMaxWidth,
      totalMaxHeight: remainingHeight,
      bodyMaxLines: level.creditsBodyMaxLines,
      bodyMinFontSize: level.creditsMinFontSize,
      bodyMaxFontSize: level.creditsMaxFontSize
    });

    if (!block) return null;

    sections.push({
      ...block,
      groupY: cursorY
    });

    cursorY += block.height + SECTION_GAP;
  }

  if (sections.length > 0) {
    cursorY -= SECTION_GAP;
  }

  return {
    x: ARCHIVE_COLUMN_X.credits,
    topY: COLUMN_TOP_Y,
    height: cursorY,
    sections
  };
};

const buildEquipmentColumn = ({ level, equipmentText, bodyFont, equipmentMaxWidth }) => {
  if (!level.showEquipment || !String(equipmentText || '').trim()) {
    return null;
  }

  const block = buildLabeledBodyBlock({
    header: 'EQUIPMENT',
    bodyText: equipmentText,
    bodyFontFamily: bodyFont,
    maxWidth: equipmentMaxWidth,
    totalMaxHeight: COLUMN_MAX_HEIGHT,
    bodyMaxLines: level.equipmentMaxLines,
    bodyMinFontSize: level.equipmentMinFontSize,
    bodyMaxFontSize: level.equipmentMaxFontSize
  });

  if (!block) return null;

  return {
    x: ARCHIVE_COLUMN_X.equipment,
    topY: COLUMN_TOP_Y,
    height: block.height,
    ...block
  };
};

const buildMetaColumn = ({ releaseYear, recordedDate, titleFont }) => {
  const metaMaxWidth = 150;
  const releaseValue = String(releaseYear || '').trim();
  const recordedValue = String(recordedDate || '').trim();

  const releaseFontSize = releaseValue
    ? TypographyService.fitFontSizeSingleLine(releaseValue, titleFont, metaMaxWidth, 24, 32, { fontWeight: 'bold' })
    : 24;
  const recordedFontSize = recordedValue
    ? TypographyService.fitFontSizeSingleLine(recordedValue, titleFont, metaMaxWidth, 18, 30, { fontWeight: 'bold' })
    : 18;

  return {
    x: ARCHIVE_COLUMN_X.meta,
    topY: COLUMN_TOP_Y,
    release: {
      label: 'RELEASED',
      labelFontSize: HEADER_FONT_SIZE,
      labelY: 0,
      value: releaseValue,
      valueFontSize: releaseFontSize,
      valueY: 28
    },
    recorded: {
      label: 'RECORDED',
      labelFontSize: HEADER_FONT_SIZE,
      groupY: 92,
      labelY: 0,
      value: recordedValue,
      valueFontSize: recordedFontSize,
      valueY: 28
    }
  };
};

const getReleaseYear = (releaseDate = '') => (
  String(releaseDate || '').split(/[-.]/)[0] || ''
);

const buildArchiveLayoutForLevel = ({ level, data, recordingData, fontConfig }) => {
  const bodyFont = fontConfig?.fonts?.body || 'Arial, sans-serif';
  const titleFont = fontConfig?.fonts?.title || 'Arial, sans-serif';
  const monoFont = fontConfig?.fonts?.mono || 'Courier New, monospace';

  const labelText = (recordingData?.labelOverride || data.tapeSubtitle || '').toUpperCase();
  const sourceText = recordingData?.source || '';
  const equipmentText = recordingData?.equipment || '';

  const labelMaxWidth = ARCHIVE_COLUMN_X.credits - ARCHIVE_COLUMN_X.label - 48;
  const creditsMaxWidth = ARCHIVE_COLUMN_X.equipment - ARCHIVE_COLUMN_X.credits - 48;
  const equipmentMaxWidth = ARCHIVE_COLUMN_X.meta - ARCHIVE_COLUMN_X.equipment - 40;

  const labelColumn = buildLabelColumn({
    level,
    labelText,
    sourceText,
    monoFont,
    bodyFont,
    labelMaxWidth
  });

  if (!labelColumn) return null;

  const creditsColumn = buildCreditsColumn({
    level,
    recordingData,
    bodyFont,
    creditsMaxWidth
  });
  const hasCredits = Boolean(recordingData?.credits?.producers?.length || recordingData?.credits?.engineers?.length);
  if (level.showCredits && hasCredits && !creditsColumn) {
    return null;
  }

  const equipmentColumn = buildEquipmentColumn({
    level,
    equipmentText,
    bodyFont,
    equipmentMaxWidth
  });
  if (level.showEquipment && String(equipmentText || '').trim() && !equipmentColumn) {
    return null;
  }

  return {
    level: level.id,
    columns: {
      label: labelColumn,
      credits: creditsColumn,
      equipment: equipmentColumn,
      meta: buildMetaColumn({
        releaseYear: getReleaseYear(data.releaseDate),
        recordedDate: recordingData?.recDate || '',
        titleFont
      })
    }
  };
};

export const resolveShortBackArchiveLayout = ({ data, recordingData, fontConfig }) => {
  for (const level of ARCHIVE_LEVELS) {
    const layout = buildArchiveLayoutForLevel({ level, data, recordingData, fontConfig });
    if (layout) {
      return layout;
    }
  }

  return buildArchiveLayoutForLevel({
    level: ARCHIVE_LEVELS[ARCHIVE_LEVELS.length - 1],
    data,
    recordingData,
    fontConfig
  });
};

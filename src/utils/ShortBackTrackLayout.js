import TypographyService from '../services/TypographyService.js';

const DEFAULT_HORIZONTAL_PADDING = 32;
const TRACK_LIST_TOP_Y = 56;
const TRACK_LIST_BOTTOM_PADDING = 10;
const TRACK_NUMBER_WIDTH = 18;
const TRACK_NUMBER_GAP = 8;
const TRACK_TEXT_INDENT = TRACK_NUMBER_WIDTH + TRACK_NUMBER_GAP;
const MAX_LINES_PER_TRACK = 2;
const MORE_TOP_GAP = 12;

const DENSITY_PRESETS = [
  {
    id: 'AIRY',
    trackFontSize: 15,
    lineHeight: 18,
    trackGap: 8,
    moreFontSize: 13,
    maxTrackCount: 8,
    minAverageRetention: 0.78,
    maxSevereRatio: 0.12
  },
  {
    id: 'BALANCED',
    trackFontSize: 15,
    lineHeight: 18,
    trackGap: 6,
    moreFontSize: 13,
    maxTrackCount: 9,
    minAverageRetention: 0.7,
    maxSevereRatio: 0.3
  },
  {
    id: 'DENSE',
    trackFontSize: 15,
    lineHeight: 17,
    trackGap: 4,
    moreFontSize: 12,
    maxTrackCount: 10,
    minAverageRetention: 0.6,
    maxSevereRatio: 0.5
  }
];

const trimLineToWidth = (line, suffix, maxWidth, fontFamily, fontSize, fontOptions = {}) => {
  const normalizedLine = String(line || '').trimEnd();
  const fullCandidate = `${normalizedLine}${suffix}`;
  if (TypographyService.measureWidth(fullCandidate, fontFamily, fontSize, fontOptions) <= maxWidth) {
    return fullCandidate;
  }

  const glyphs = Array.from(normalizedLine);
  for (let i = glyphs.length - 1; i >= 0; i -= 1) {
    const candidate = `${glyphs.slice(0, i).join('').trimEnd()}${suffix}`;
    if (TypographyService.measureWidth(candidate, fontFamily, fontSize, fontOptions) <= maxWidth) {
      return candidate;
    }
  }

  return suffix.trim();
};

const clampWrappedLinesWithMetrics = (text, lines, maxLines, maxWidth, fontFamily, fontSize, fontOptions = {}) => {
  if (lines.length <= maxLines) {
    return {
      lines,
      retainedRatio: 1,
      isTruncated: false
    };
  }

  const clampedLines = lines.slice(0, maxLines);
  clampedLines[maxLines - 1] = trimLineToWidth(clampedLines[maxLines - 1], '...', maxWidth, fontFamily, fontSize, fontOptions);

  const normalized = Array.from(String(text || '').trim());
  const visibleChars = Array.from(clampedLines.join(' ').replace(/\.\.\.$/, '').trim()).length;

  return {
    lines: clampedLines,
    retainedRatio: normalized.length > 0 ? Math.min(1, visibleChars / normalized.length) : 1,
    isTruncated: true
  };
};

const fitWrappedTrackWithMetrics = (text, fontFamily, fontSize, maxWidth, maxLines, fontOptions = {}) => {
  const normalized = String(text || '').trim();
  if (!normalized) {
    return {
      lines: [''],
      retainedRatio: 1,
      isTruncated: false
    };
  }

  const wrappedLines = TypographyService.wrapText(normalized, fontFamily, fontSize, maxWidth, fontOptions);
  return clampWrappedLinesWithMetrics(normalized, wrappedLines, maxLines, maxWidth, fontFamily, fontSize, fontOptions);
};

const canFitHeight = (contentHeight, blockHeight) => (
  contentHeight === 0
    ? true
    : (TRACK_LIST_TOP_Y + contentHeight + TRACK_LIST_BOTTOM_PADDING) <= blockHeight
);

const layoutVisibleTracks = ({ tracks, bodyFont, trackTextMaxWidth, preset }) => {
  let cursorY = TRACK_LIST_TOP_Y;

  const visibleTracks = tracks.map((track) => {
    const fittedTitle = fitWrappedTrackWithMetrics(
      track.title || '',
      bodyFont,
      preset.trackFontSize,
      trackTextMaxWidth,
      MAX_LINES_PER_TRACK,
      { fontWeight: 'bold' }
    );

    const blockHeight = fittedTitle.lines.length * preset.lineHeight;
    const positionedTrack = {
      ...track,
      fittedLines: fittedTitle.lines,
      titleRetention: fittedTitle.retainedRatio,
      titleWasTruncated: fittedTitle.isTruncated,
      y: cursorY,
      blockHeight
    };

    cursorY += blockHeight + preset.trackGap;
    return positionedTrack;
  });

  return {
    visibleTracks,
    cursorY
  };
};

const resolvePresetCandidate = ({
  tracks,
  trackTextMaxWidth,
  blockHeight,
  bodyFont,
  preset
}) => {
  if (!tracks.length) {
    return {
      densityId: preset.id,
      trackFontSize: preset.trackFontSize,
      trackLineHeight: preset.lineHeight,
      trackTextIndent: TRACK_TEXT_INDENT,
      numberFontSize: Math.max(12, preset.trackFontSize - 1),
      moreFontSize: preset.moreFontSize,
      visibleTracks: [],
      hiddenCount: 0,
      moreY: TRACK_LIST_TOP_Y
    };
  }

  const minVisibleTracks = Math.min(3, tracks.length);
  const initialVisibleCount = Math.min(tracks.length, preset.maxTrackCount);

  for (let visibleCount = initialVisibleCount; visibleCount >= minVisibleTracks; visibleCount -= 1) {
    const hiddenCount = Math.max(0, tracks.length - visibleCount);
    const { visibleTracks, cursorY } = layoutVisibleTracks({
      tracks: tracks.slice(0, visibleCount),
      bodyFont,
      trackTextMaxWidth,
      preset
    });

    const trackContentHeight = visibleTracks.length > 0
      ? cursorY - TRACK_LIST_TOP_Y - preset.trackGap
      : 0;
    const moreTopGap = hiddenCount > 0 && visibleTracks.length > 0 ? MORE_TOP_GAP : 0;
    const moreHeight = hiddenCount > 0 ? Math.round(preset.moreFontSize * 1.2) : 0;
    const moreY = TRACK_LIST_TOP_Y + trackContentHeight + moreTopGap;
    const totalContentHeight = trackContentHeight + moreTopGap + moreHeight;

    if (!canFitHeight(totalContentHeight, blockHeight)) {
      continue;
    }

    const averageRetention = visibleTracks.reduce((sum, track) => sum + track.titleRetention, 0) / visibleTracks.length;
    const severeRatio = visibleTracks.filter(track => track.titleRetention < 0.55).length / visibleTracks.length;
    const isMinimumCandidate = visibleCount === minVisibleTracks;

    if (
      isMinimumCandidate ||
      (averageRetention >= preset.minAverageRetention && severeRatio <= preset.maxSevereRatio)
    ) {
      return {
        densityId: preset.id,
        trackFontSize: preset.trackFontSize,
        trackLineHeight: preset.lineHeight,
        trackTextIndent: TRACK_TEXT_INDENT,
        numberFontSize: Math.max(12, preset.trackFontSize - 1),
        moreFontSize: preset.moreFontSize,
        visibleTracks,
        hiddenCount,
        moreY,
        averageRetention
      };
    }
  }

  const { visibleTracks, cursorY } = layoutVisibleTracks({
    tracks: tracks.slice(0, minVisibleTracks),
    bodyFont,
    trackTextMaxWidth,
    preset
  });
  const hiddenCount = Math.max(0, tracks.length - visibleTracks.length);
  const trackContentHeight = visibleTracks.length > 0
    ? cursorY - TRACK_LIST_TOP_Y - preset.trackGap
    : 0;
  const moreTopGap = hiddenCount > 0 && visibleTracks.length > 0 ? MORE_TOP_GAP : 0;

  return {
    densityId: preset.id,
    trackFontSize: preset.trackFontSize,
    trackLineHeight: preset.lineHeight,
    trackTextIndent: TRACK_TEXT_INDENT,
    numberFontSize: Math.max(12, preset.trackFontSize - 1),
    moreFontSize: preset.moreFontSize,
    visibleTracks,
    hiddenCount,
    moreY: TRACK_LIST_TOP_Y + trackContentHeight + moreTopGap,
    averageRetention: visibleTracks.length
      ? visibleTracks.reduce((sum, track) => sum + track.titleRetention, 0) / visibleTracks.length
      : 1
  };
};

const chooseBestCandidate = (candidates, totalTracks) => {
  const [airyCandidate, balancedCandidate, denseCandidate] = candidates;
  let bestCandidate = airyCandidate || balancedCandidate || denseCandidate;

  if (!bestCandidate) return null;
  if (bestCandidate.visibleTracks.length >= totalTracks) return bestCandidate;

  [balancedCandidate, denseCandidate].forEach((candidate) => {
    if (!candidate) return;
    if (candidate.visibleTracks.length >= totalTracks) {
      bestCandidate = candidate;
      return;
    }

    if (candidate.visibleTracks.length > bestCandidate.visibleTracks.length) {
      bestCandidate = candidate;
      return;
    }

    if (
      candidate.visibleTracks.length === bestCandidate.visibleTracks.length &&
      (candidate.averageRetention || 0) > (bestCandidate.averageRetention || 0)
    ) {
      bestCandidate = candidate;
    }
  });

  return bestCandidate;
};

export const resolveShortBackTrackLayout = ({
  width,
  sideSummaries,
  horizontalPadding = DEFAULT_HORIZONTAL_PADDING,
  fontConfig
}) => {
  const bodyFont = fontConfig?.fonts?.body || 'Arial, sans-serif';
  const trackTextMaxWidth = width - (horizontalPadding * 2) - TRACK_TEXT_INDENT;

  return sideSummaries.map((side) => {
    const candidates = DENSITY_PRESETS.map((preset) => resolvePresetCandidate({
      tracks: side.tracks || [],
      trackTextMaxWidth,
      blockHeight: side.blockHeight,
      bodyFont,
      preset
    }));

    const bestCandidate = chooseBestCandidate(candidates, side.tracks.length) || candidates[candidates.length - 1];

    return {
      ...side,
      ...bestCandidate
    };
  });
};

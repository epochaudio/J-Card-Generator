import React, { useMemo } from 'react';

import { JCARD_DIMENSIONS } from '../constants/app.js';
import { formatDurationMs, parseDurationToMs } from '../utils/formatDuration.js';
import LayoutEngine from '../utils/LayoutEngine.js';
import TypographyService from '../services/TypographyService.js';

const CLASSICAL_LAYOUT_STEPS = [
  {
    id: 'INLINE_FULL',
    groupContent: 'inline',
    inlineLimit: null,
    maxHeaderLines: 3,
    maxContentLines: null,
    maxTrackLines: 3
  },
  {
    id: 'INLINE_TRIM_6',
    groupContent: 'inline',
    inlineLimit: 6,
    maxHeaderLines: 2,
    maxContentLines: 3,
    maxTrackLines: 2
  },
  {
    id: 'INLINE_TRIM_4',
    groupContent: 'inline',
    inlineLimit: 4,
    maxHeaderLines: 2,
    maxContentLines: 2,
    maxTrackLines: 2
  },
  {
    id: 'WORK_SUMMARY',
    groupContent: 'summary',
    inlineLimit: 0,
    maxHeaderLines: 2,
    maxContentLines: 1,
    maxTrackLines: 2
  },
  {
    id: 'WORK_ONLY',
    groupContent: 'title',
    inlineLimit: 0,
    maxHeaderLines: 1,
    maxContentLines: 0,
    maxTrackLines: 1
  }
];

const NON_CLASSICAL_LAYOUT_STEPS = [
  {
    id: 'LEVEL_0_FULL',
    groupContent: 'tracks',
    maxTrackLines: 3,
    noteMaxLines: 2,
    showArtist: 'compilation',
    showDuration: true,
    noteStrategy: 'all'
  },
  {
    id: 'LEVEL_1_NOTE_FIRST',
    groupContent: 'tracks',
    maxTrackLines: 2,
    noteMaxLines: 1,
    showArtist: 'compilation',
    showDuration: true,
    noteStrategy: 'all'
  },
  {
    id: 'LEVEL_2_META_REDUCED',
    groupContent: 'tracks',
    maxTrackLines: 2,
    noteMaxLines: 1,
    showArtist: false,
    showDuration: false,
    noteStrategy: 'all'
  },
  {
    id: 'LEVEL_3_NOTE_SELECTIVE',
    groupContent: 'tracks',
    maxTrackLines: 1,
    noteMaxLines: 1,
    showArtist: false,
    showDuration: false,
    noteStrategy: 'selective',
    maxNotesPerSide: 3
  },
  {
    id: 'LEVEL_4_TITLES_ONLY',
    groupContent: 'tracks',
    maxTrackLines: 1,
    noteMaxLines: 0,
    showArtist: false,
    showDuration: false,
    noteStrategy: 'none',
    maxNotesPerSide: 0
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

const cleanMovementTitle = (title = '') => title.replace(/^[IVX0-9]+\.\s*/, '').trim();

const buildInlineGroupText = (tracks, inlineLimit) => {
  const visibleTracks = typeof inlineLimit === 'number' && inlineLimit > 0
    ? tracks.slice(0, inlineLimit)
    : tracks;
  const parts = visibleTracks
    .map(track => cleanMovementTitle(track.displayTitle || track.title || ''))
    .filter(Boolean);
  const hiddenCount = Math.max(0, tracks.length - visibleTracks.length);

  if (hiddenCount === 0) return parts.join(' / ');

  const suffix = `... (+${hiddenCount})`;
  return parts.length > 0 ? `${parts.join(' / ')} / ${suffix}` : suffix;
};

const buildGroupSummaryText = (tracks) => {
  const trackCount = tracks.length;
  const totalMs = tracks.reduce((sum, track) => sum + parseDurationToMs(track.duration), 0);
  const duration = totalMs > 0 ? formatDurationMs(totalMs) : '';
  const unit = trackCount === 1 ? 'part' : 'parts';
  return duration ? `${trackCount} ${unit} / ${duration}` : `${trackCount} ${unit}`;
};

const shouldShowArtist = (strategy, isCompilation) => {
  if (!strategy) return false;
  if (strategy.showArtist === 'compilation') return isCompilation;
  return Boolean(strategy.showArtist);
};

const buildDisplayTracks = (tracks, strategy, isCompilation) => {
  const noteCandidates = tracks
    .map((track, index) => ({ index, hasNote: Boolean(track.note && track.note.trim()) }))
    .filter(item => item.hasNote)
    .map(item => item.index);

  const visibleNoteSet = (() => {
    if (!strategy || strategy.noteStrategy === 'none' || !strategy.noteMaxLines) {
      return new Set();
    }

    if (strategy.noteStrategy === 'selective') {
      return new Set(noteCandidates.slice(0, strategy.maxNotesPerSide || 0));
    }

    return new Set(noteCandidates);
  })();

  return tracks.map((track, index) => ({
    ...track,
    showArtist: shouldShowArtist(strategy, isCompilation),
    showDuration: Boolean(strategy?.showDuration),
    showNote: visibleNoteSet.has(index)
  }));
};

const buildDisplayGroups = (groups, strategy, isClassical) => {
  if (!isClassical) return groups;

  return groups.map((item) => {
    if (item.type !== 'group') return item;

    if (strategy.groupContent === 'inline') {
      return {
        ...item,
        displayMode: 'inline',
        contentText: buildInlineGroupText(item.tracks, strategy.inlineLimit)
      };
    }

    if (strategy.groupContent === 'summary') {
      return {
        ...item,
        displayMode: 'summary',
        contentText: buildGroupSummaryText(item.tracks)
      };
    }

    return {
      ...item,
      displayMode: 'title',
      contentText: ''
    };
  });
};


const ContentBack = ({ width, data, theme, isCompact, isLight, textColor, subTextColor, dimTextColor, recordingData, fontConfig }) => {
  const contentHeight = JCARD_DIMENSIONS.height;
  const marginY = isCompact ? 60 : 80;
  const footerHeight = isCompact ? 40 : 60;
  const headerHeight = isCompact ? 38 : 72;
  const gapBetweenSides = isCompact ? 20 : 60;
  const verticalPadding = isCompact ? 40 : 40;

  const staticHeight = marginY + headerHeight + gapBetweenSides + headerHeight + footerHeight;
  const availableForTracks = contentHeight - staticHeight;

  const hasNoteUpper = !!data.layout?.noteUpper;
  const hasNoteLower = !!data.layout?.noteLower;
  const isClassical = data.layout.mode === 'CLASSICAL';
  const sideBIndexStart = isClassical ? data.sideA.length : 0;

  // 字号边界：取决于面板是 compact（ShortBack 200px）还是全宽（Back 618px）
  const maxFont = isCompact ? 15 : 25;
  const minFont = isCompact ? 8 : 14;
  const noteFontFloor = isCompact ? 8 : 11;
  const trackTailFontFloor = isCompact ? 10 : 12;
  const trackNumberFontFloor = isCompact ? 10 : 12;
  const sideHeaderTitleFontSize = isCompact ? 14 : 24;
  const sideHeaderDurationFontSize = isCompact ? 11 : 16;
  const sideHeaderTitleTracking = isCompact ? 1.2 : 2.2;
  const sideHeaderLineY = isCompact ? 22 : 40;
  const sideHeaderAccentWidth = isCompact ? 16 : 36;
  const sideHeaderAccentHeight = isCompact ? 2 : 4;
  const sideHeaderRightX = width - verticalPadding * 2 - (hasNoteLower ? 20 : 0) - (hasNoteUpper ? 20 : 0) - (isCompact ? 0 : 20);
  const sideDividerRightX = width - verticalPadding * 2 - (hasNoteLower ? 20 : 0) - (hasNoteUpper ? 20 : 0);

  // 获取当前字体配置（全局可用）
  const bodyFont = fontConfig?.fonts?.body || "Arial, sans-serif";
  const titleFont = fontConfig?.fonts?.title || "Arial, sans-serif";
  const monoFont = fontConfig?.fonts?.mono || "Courier New, monospace";
  const isCompilation = data.layout?.mode === 'COMPILATION';

  const renderStrategy = useMemo(() => {
    if (!isClassical) {
      return {
        id: 'STANDARD',
        groupContent: 'tracks',
        maxHeaderLines: null,
        maxContentLines: null,
        maxTrackLines: null,
        isAutoFolded: false,
        overflowDetected: false
      };
    }

    if (isCompact) {
      return {
        id: 'WORK_ONLY',
        groupContent: 'title',
        maxHeaderLines: 2,
        maxContentLines: 0,
        maxTrackLines: 1,
        isAutoFolded: true,
        overflowDetected: false
      };
    }

    return null;
  }, [isClassical, isCompact]);

  const groupsA = useMemo(() => (
    isClassical
      ? LayoutEngine.groupTracksNested(data.sideA)
      : data.sideA.map(t => ({ type: 'track', ...t, displayTitle: t.title }))
  ), [data.sideA, isClassical]);

  const groupsB = useMemo(() => (
    isClassical
      ? LayoutEngine.groupTracksNested(data.sideB)
      : data.sideB.map(t => ({ type: 'track', ...t, displayTitle: t.title }))
  ), [data.sideB, isClassical]);

  const layoutMetrics = useMemo(() => {
    // 物理可用宽度（左右各 40px 边距）
    const HORIZONTAL_PADDING = 40;
    const usableWidth = width - HORIZONTAL_PADDING * 2;

    // 获取当前字体配置
    // (已提升至全局作用域)

    // 粗略估算总行数，用于决定是否显示曲目备注
    const countRoughLines = (groups) => groups.reduce((acc, item) => {
      if (item.type === 'group') return acc + 1 + item.tracks.length;
      return acc + 1;
    }, 0);
    const roughTotalLines = countRoughLines(groupsA) + countRoughLines(groupsB);
    const roughLH = roughTotalLines > 0 ? availableForTracks / roughTotalLines : 50;
    // 古典模式仍沿用较保守的备注显示逻辑；非古典交给策略层决策。
    const showNotesGlobal = isClassical ? (!isCompact && roughLH > 45) : true;

    // 第一轮估算字号（供 Pretext 测量用）
    const LINE_HEIGHT_TO_FONT_RATIO = 0.55;
    let estFontSize = Math.floor(roughLH * LINE_HEIGHT_TO_FONT_RATIO);
    estFontSize = Math.min(Math.max(estFontSize, minFont), maxFont);

    /**
     * 计算单条普通曲目真正的可用折行宽度
     * 修复史诗级隐藏 Bug：原本 renderer 会在文本前后强行追加 "01. " 和 " (4:20)"。
     * 这导致原本文本完美排满 usableWidth 时，追加部分会直接冲出右边界被裁切。
     */
    const getTrackTitleAvailableWidth = (item, estFontSize, currentIdx, strategyConfig) => {
      let prefixW = 32; // 第二行默认悬挂缩进的宽度
      let suffixW = 0;
      if (!isClassical) {
        // 全新视觉：测量无点的等宽数字前缀 (例如 "01")，字号略小且使用 monoFont
        const numStr = String(currentIdx + 1).padStart(2, '0');
        const numSize = Math.max(estFontSize - 2, trackNumberFontFloor);
        prefixW = TypographyService.measureWidth(numStr, monoFont, numSize, { fontWeight: 'normal' }) + 12; // 12px 为与标题间的空白缓冲
        
        let suffixStr = "";
        if (item.showArtist && !isCompact && item.artist) {
          suffixStr += ` - ${item.artist} `;
        }
        if (item.showDuration && !isCompact && item.duration) {
          suffixStr += `  ${item.duration}`; // 取消括号，仅用空格分隔时间码
        }
        if (suffixStr) {
          const suffixSize = Math.max(estFontSize - 4, trackTailFontFloor);
          suffixW = TypographyService.measureWidth(suffixStr, bodyFont, suffixSize);
        }
      }
      return usableWidth - prefixW - suffixW;
    };

    /**
     * 用 Pretext 精确计算每组曲目的视觉行数
     * 与旧实现的核心区别：
     * - 旧：用字符数 × 魔法系数(0.7/1.1/1.8) 估算宽度
     * - 新：用 Pretext 的物理像素测量，结果与实际字体精确关联
     */
    const wrapAndClamp = (text, fontFamily, fontSize, maxWidth, fontOptions = {}, maxLines = null) => {
      const wrapped = TypographyService.wrapText(text, fontFamily, fontSize, maxWidth, fontOptions);
      return clampWrappedLines(wrapped, maxLines, maxWidth, fontFamily, fontSize, fontOptions);
    };

    const calculateRealVisualLines = (groups, fontSize, startLocalIdx = 0, strategyConfig = renderStrategy) => {
      let currentIdx = startLocalIdx;
      return groups.reduce((acc, item) => {
        if (item.type === 'group') {
          const groupHeaderFontSize = Math.min(fontSize + 2, maxFont + 2);
          const headerLines = wrapAndClamp(
            item.title,
            titleFont,
            groupHeaderFontSize,
            usableWidth,
            { fontWeight: 'bold' },
            strategyConfig.maxHeaderLines
          );
          let groupHeight = headerLines.length * 0.9;

          if (strategyConfig.groupContent === 'inline' && item.contentText) {
            const contentLines = wrapAndClamp(
              item.contentText,
              bodyFont,
              Math.max(fontSize - 1, minFont),
              usableWidth,
              {},
              strategyConfig.maxContentLines
            );
            groupHeight += contentLines.length * 0.85 + 0.3;
            currentIdx += item.tracks.length;
          } else if (strategyConfig.groupContent === 'summary' && item.contentText) {
            const contentLines = wrapAndClamp(
              item.contentText,
              monoFont,
              Math.max(fontSize - 2, minFont),
              usableWidth,
              {},
              strategyConfig.maxContentLines
            );
            groupHeight += contentLines.length * 0.8 + 0.2;
            currentIdx += item.tracks.length;
          } else if (strategyConfig.groupContent === 'title') {
            groupHeight += 0.2;
            currentIdx += item.tracks.length;
          } else {
            groupHeight += item.tracks.length;
            currentIdx += item.tracks.length;
          }
          return acc + groupHeight;
        }

        // 普通曲目 (精确核减前后缀引发的排版溢出空间)
        const safeAvailableW = getTrackTitleAvailableWidth(item, fontSize, currentIdx, strategyConfig);
        const titleLines = wrapAndClamp(
          item.displayTitle,
          bodyFont,
          fontSize,
          safeAvailableW,
          { fontWeight: 'bold' },
          strategyConfig.maxTrackLines
        );
        let noteHeight = 0;
        const noteLineLimit = strategyConfig.noteMaxLines ?? 2;
        if (showNotesGlobal && item.showNote !== false && item.note && noteLineLimit > 0) {
          const noteFontSize = Math.max(fontSize * 0.66, noteFontFloor);
          // 减去 25px 给 note 留出悬挂缩进
          const noteLines = wrapAndClamp(
            item.note,
            bodyFont,
            noteFontSize,
            usableWidth - 25,
            {},
            noteLineLimit
          );
          noteHeight = Math.min(noteLines.length, noteLineLimit) * 0.6;
        }
        currentIdx++;
        return acc + 1 + (titleLines.length - 1) * 0.85 + noteHeight;
      }, 0);
    };

    // 行高边界
    const maxLH = isCompact ? 50 : 110;
    const minLHValue = isCompact ? 16 : 30;

    const evaluateStrategy = (strategyConfig, fontSize) => {
      const displayGroupsA = isClassical
        ? buildDisplayGroups(groupsA, strategyConfig, true)
        : buildDisplayTracks(groupsA, strategyConfig, isCompilation);
      const displayGroupsB = isClassical
        ? buildDisplayGroups(groupsB, strategyConfig, true)
        : buildDisplayTracks(groupsB, strategyConfig, isCompilation);
      const visualLinesA = calculateRealVisualLines(displayGroupsA, fontSize, 0, strategyConfig);
      const visualLinesB = calculateRealVisualLines(displayGroupsB, fontSize, sideBIndexStart, strategyConfig);
      const totalVisualItems = visualLinesA + visualLinesB;
      const naturalLH = totalVisualItems > 0 ? availableForTracks / totalVisualItems : maxLH;

      return {
        strategy: strategyConfig,
        displayGroupsA,
        displayGroupsB,
        visualLinesA,
        visualLinesB,
        totalVisualItems,
        naturalLH
      };
    };

    const candidateStrategies = isClassical
      ? (isCompact ? [renderStrategy] : CLASSICAL_LAYOUT_STEPS)
      : NON_CLASSICAL_LAYOUT_STEPS;
    const firstPassEvaluations = candidateStrategies.map(strategyConfig => evaluateStrategy(strategyConfig, estFontSize));
    let selectedEvaluation = firstPassEvaluations.find(result => result.naturalLH >= minLHValue) || firstPassEvaluations[firstPassEvaluations.length - 1];

    let calculatedLH = Math.min(Math.max(selectedEvaluation.naturalLH, minLHValue), maxLH);

    // 最终字号基于精确的行高计算
    let fontSize = Math.floor(calculatedLH * LINE_HEIGHT_TO_FONT_RATIO);
    fontSize = Math.min(Math.max(fontSize, minFont), maxFont);

    selectedEvaluation = evaluateStrategy(selectedEvaluation.strategy, fontSize);
    calculatedLH = Math.min(Math.max(selectedEvaluation.naturalLH, minLHValue), maxLH);
    fontSize = Math.floor(calculatedLH * LINE_HEIGHT_TO_FONT_RATIO);
    fontSize = Math.min(Math.max(fontSize, minFont), maxFont);
    selectedEvaluation = evaluateStrategy(selectedEvaluation.strategy, fontSize);
    calculatedLH = Math.min(Math.max(selectedEvaluation.naturalLH, minLHValue), maxLH);

    // Y 坐标计算
    const yHeaderA = marginY;
    const yListA = yHeaderA + headerHeight;
    const heightA = selectedEvaluation.visualLinesA * calculatedLH;
    const yHeaderB = yListA + heightA + gapBetweenSides;
    const yDivider = yHeaderB - Math.max(16, gapBetweenSides * 0.42);
    const yListB = yHeaderB + headerHeight;

    return {
      displayGroupsA: selectedEvaluation.displayGroupsA,
      displayGroupsB: selectedEvaluation.displayGroupsB,
      showNotesGlobal,
      usableWidth,
      trackFontSize: fontSize,
      groupHeaderFontSize: Math.min(fontSize + 2, maxFont + 2),
      noteFontSize: Math.max(fontSize * 0.66, noteFontFloor),
      calculatedLH,
      selectedStrategy: {
        ...selectedEvaluation.strategy,
        overflowDetected: selectedEvaluation.naturalLH < minLHValue,
        isAutoFolded: isClassical
          ? selectedEvaluation.strategy.id !== 'INLINE_FULL'
          : selectedEvaluation.strategy.id !== 'LEVEL_0_FULL'
      },
      yHeaderA,
      yListA,
      yDivider,
      yHeaderB,
      yListB
    };
  }, [availableForTracks, bodyFont, gapBetweenSides, groupsA, groupsB, headerHeight, isClassical, isCompact, isCompilation, marginY, maxFont, minFont, monoFont, noteFontFloor, renderStrategy, sideBIndexStart, titleFont, trackNumberFontFloor, trackTailFontFloor, width]);

  const {
    displayGroupsA,
    displayGroupsB,
    showNotesGlobal,
    usableWidth,
    trackFontSize,
    groupHeaderFontSize,
    noteFontSize,
    calculatedLH,
    selectedStrategy,
    yHeaderA,
    yListA,
    yDivider,
    yHeaderB,
    yListB
  } = layoutMetrics;

  // 字体配置（渲染时用）
  // (已提升至全局作用域)

  const renderSideHeader = (sideLabel, duration) => (
    <g>
      <text
        x="0"
        y="0"
        fontFamily={monoFont}
        fontSize={sideHeaderTitleFontSize}
        fontWeight="bold"
        fill={textColor}
        letterSpacing={sideHeaderTitleTracking}
        dominantBaseline="hanging"
      >
        {sideLabel}
      </text>
      <text
        x={sideHeaderRightX}
        y="3"
        fontFamily={monoFont}
        fontSize={sideHeaderDurationFontSize}
        fontWeight="bold"
        fill={subTextColor}
        letterSpacing="1.2"
        textAnchor="end"
        dominantBaseline="hanging"
      >
        {duration}
      </text>
      <line x1="0" y1={sideHeaderLineY} x2={sideHeaderRightX} y2={sideHeaderLineY} stroke={dimTextColor} strokeWidth="1" opacity="0.42" />
      <rect x="0" y={sideHeaderLineY - sideHeaderAccentHeight} width={sideHeaderAccentWidth} height={sideHeaderAccentHeight} rx={sideHeaderAccentHeight / 2} fill={theme.accent} />
    </g>
  );

  const renderGroupList = (groups, startLocalIdx) => {
    let yCursor = 0;
    let localIdx = startLocalIdx;
    const wrapAndClamp = (text, fontFamily, fontSize, maxWidth, fontOptions = {}, maxLines = null) => {
      const wrapped = TypographyService.wrapText(text, fontFamily, fontSize, maxWidth, fontOptions);
      return clampWrappedLines(wrapped, maxLines, maxWidth, fontFamily, fontSize, fontOptions);
    };

    return groups.map((item, i) => {
      if (item.type === 'group') {
        const headerLines = wrapAndClamp(
          item.title,
          titleFont,
          groupHeaderFontSize,
          usableWidth,
          { fontWeight: 'bold' },
          selectedStrategy.maxHeaderLines
        );

        const headerNode = headerLines.map((line, lineIdx) => (
          <text key={`h-${i}-${lineIdx}`} x="-5" y={yCursor + calculatedLH * 0.6 + (lineIdx * calculatedLH * 0.85)} fill={textColor} fontSize={groupHeaderFontSize} fontWeight="bold" dominantBaseline="middle" fontFamily={fontConfig?.fonts?.title || "Arial, sans-serif"}>
            {line}
          </text>
        ));

        yCursor += calculatedLH + (headerLines.length - 1) * calculatedLH * 0.85;

        let contentNode = null;

        if (selectedStrategy.groupContent === 'inline' && item.contentText) {
          const contentLines = wrapAndClamp(
            item.contentText,
            bodyFont,
            Math.max(trackFontSize - 1, minFont),
            usableWidth,
            {},
            selectedStrategy.maxContentLines
          );
          contentNode = contentLines.map((line, lIdx) => (
            <text key={`c-${i}-${lIdx}`} x="0" y={yCursor + calculatedLH * 0.5 + (lIdx * calculatedLH * 0.85)} fill={dimTextColor} fontSize={trackFontSize - 1} dominantBaseline="middle">
              {line}
            </text>
          ));
          yCursor += contentLines.length * calculatedLH * 0.85 + calculatedLH * 0.3;
          localIdx += item.tracks.length;
        } else if (selectedStrategy.groupContent === 'summary' && item.contentText) {
          const summaryFontSize = Math.max(trackFontSize - 2, minFont);
          const contentLines = wrapAndClamp(
            item.contentText,
            monoFont,
            summaryFontSize,
            usableWidth,
            {},
            selectedStrategy.maxContentLines
          );
          contentNode = contentLines.map((line, lIdx) => (
            <text key={`s-${i}-${lIdx}`} x="0" y={yCursor + calculatedLH * 0.48 + (lIdx * calculatedLH * 0.8)} fill={dimTextColor} fontSize={summaryFontSize} fontFamily={monoFont} letterSpacing="0.5" dominantBaseline="middle">
              {line}
            </text>
          ));
          yCursor += contentLines.length * calculatedLH * 0.8 + calculatedLH * 0.2;
          localIdx += item.tracks.length;
        } else if (selectedStrategy.groupContent === 'title') {
          yCursor += calculatedLH * 0.2;
          localIdx += item.tracks.length;
        } else {
          contentNode = item.tracks.map((t, tidx) => {
            const thisY = yCursor;
            yCursor += calculatedLH;
            localIdx++;
            return (
              <text key={`st-${i}-${tidx}`} x="15" y={thisY + calculatedLH * 0.5} fill={subTextColor} fontSize={trackFontSize} dominantBaseline="middle">
                <tspan fill={dimTextColor}>•</tspan> <tspan dx={5}>{t.displayTitle}</tspan>
              </text>
            );
          });
        }

        return <g key={i}>{headerNode}{contentNode}</g>;
      }

      const thisY = yCursor;
      localIdx++;

      const noteLineLimit = selectedStrategy.noteMaxLines ?? 2;
      const hasNote = showNotesGlobal && item.showNote !== false && item.note && noteLineLimit > 0;
      const noteLines = hasNote
        ? wrapAndClamp(item.note, bodyFont, noteFontSize, usableWidth - 25, {}, noteLineLimit)
        : [];
      
      // 复用安全测量逻辑，在渲染阶段实行严酷的带边框安全折行
      let prefixW = 32;
      let suffixW = 0;
      if (!isClassical) {
        const numStr = String(localIdx + 1).padStart(2, '0');
        const numSize = Math.max(trackFontSize - 2, trackNumberFontFloor);
        prefixW = TypographyService.measureWidth(numStr, monoFont, numSize, { fontWeight: 'normal' }) + 12;
        let suffixStr = "";
        if (item.showArtist && !isCompact && item.artist) suffixStr += ` - ${item.artist} `;
        if (item.showDuration && !isCompact && item.duration) suffixStr += `  ${item.duration}`;
        if (suffixStr) suffixW = TypographyService.measureWidth(suffixStr, bodyFont, Math.max(trackFontSize - 4, trackTailFontFloor));
      }
      const safeAvailableW = usableWidth - prefixW - suffixW;
      
      const titleLines = wrapAndClamp(
        item.displayTitle,
        bodyFont,
        trackFontSize,
        safeAvailableW,
        { fontWeight: 'bold' },
        selectedStrategy.maxTrackLines
      );

      const trackNode = titleLines.map((line, lineIdx) => {
        const isFirstLine = lineIdx === 0;
        const numSize = Math.max(trackFontSize - 2, trackNumberFontFloor);
        return (
          <text key={`t-${i}-${lineIdx}`} x="0" y={thisY + calculatedLH * (hasNote ? 0.35 : 0.5) + (lineIdx * calculatedLH * 0.85)} fill={subTextColor} fontSize={trackFontSize} dominantBaseline="middle">
            {isFirstLine && !isClassical && <tspan fontWeight="normal" fontFamily={monoFont} fontSize={numSize} fill={dimTextColor}>{String(localIdx).padStart(2, '0')}</tspan>}
            <tspan fontWeight="bold" dx={isFirstLine ? 12 : 32}>{line}</tspan>
            {isFirstLine && item.showArtist && !isCompact && <tspan fill={dimTextColor}> - {item.artist}</tspan>}
            {isFirstLine && item.showDuration && !isCompact && !isClassical && <tspan fontSize={Math.max(trackFontSize - 4, trackTailFontFloor)} fontFamily={monoFont} fill={dimTextColor}>  {item.duration}</tspan>}
          </text>
        );
      });

      yCursor += calculatedLH + (titleLines.length - 1) * calculatedLH * 0.85;
      if (hasNote && noteLines.length > 0) {
        yCursor += Math.min(noteLines.length, noteLineLimit) * noteFontSize * 1.2;
      }

      const noteNode = hasNote && noteLines.slice(0, 2).map((line, lineIdx) => (
        <text key={`n-${i}-${lineIdx}`} x="25" y={thisY + calculatedLH * 0.7 + (titleLines.length - 1) * calculatedLH * 0.85 + (lineIdx * noteFontSize * 1.2)} fontSize={noteFontSize} fill={dimTextColor} dominantBaseline="hanging" opacity="0.8">
          {line}
        </text>
      ));

      return <g key={`t-grp-${i}`}>{trackNode}{noteNode}</g>;
    });
  };

  return (
    <g>
      {(isClassical && isCompact) ? (
        <g transform={`translate(${width}, 0) rotate(90)`} fontFamily={fontConfig?.fonts?.mono || "Courier New, monospace"}>
          {(() => {
            const labelText = (recordingData?.labelOverride || data.tapeSubtitle || "").toUpperCase();
            // compact 古典模式旋转 90° 后，“宽”其实是原来的高度方向，标签区域约 300px
            const LABEL_MAX_WIDTH = 300;
            const LABEL_FONT_SIZE = 32;
            const labelLines = TypographyService.wrapText(labelText, monoFont, LABEL_FONT_SIZE, LABEL_MAX_WIDTH, { fontWeight: 'bold' });
            const labelY = 40;
            const lineHeight = 38;
            const sourceY = labelY + (labelLines.length * lineHeight) + 24;

            return (
              <g>
                {labelLines.map((line, i) => (
                  <text key={`l-${i}`} x="50" y={labelY + (i * lineHeight)} fontSize="32" fontWeight="bold" fill={textColor} letterSpacing="2" dominantBaseline="hanging">
                    {line}
                  </text>
                ))}
                <g transform={`translate(50, ${sourceY})`}>
                  <text x="0" y="0" fontSize="12" fill={dimTextColor} letterSpacing="4">SOURCE</text>
                  <text x="0" y="22" fontSize="16" fill={subTextColor} fontWeight="bold" textAnchor="start">{recordingData?.source || ""}</text>
                </g>
              </g>
            );
          })()}

          <g transform={`translate(380, 40)`}>
            {(() => {
              const lines = [];
              const credits = recordingData?.credits;

              if (credits) {
                if (credits.producers?.length) {
                  lines.push({ type: 'header', text: 'PRODUCED BY' });
                  lines.push({ type: 'body', text: credits.producers.slice(0, 2).join(', ').toUpperCase() });
                }
                if (credits.engineers?.length) {
                  lines.push({ type: 'header', text: 'ENGINEERED BY' });
                  lines.push({ type: 'body', text: credits.engineers.slice(0, 2).join(', ').toUpperCase() });
                }
              }

              let cursorY = 0;
              return lines.map((item, idx) => {
                if (item.type === 'header') {
                  const node = <text key={idx} x="0" y={cursorY} fontSize="12" fill={dimTextColor} letterSpacing="4">{item.text}</text>;
                  cursorY += 22;
                  return node;
                }

                const CREDITS_MAX_WIDTH = 350;
                const CREDITS_FONT_SIZE = 16;
                const wrapped = TypographyService.wrapText(item.text, bodyFont, CREDITS_FONT_SIZE, CREDITS_MAX_WIDTH);
                const nodes = wrapped.map((w, wIdx) => (
                  <text key={`${idx}-${wIdx}`} x="0" y={cursorY + (wIdx * 20)} fontSize="16" fill={subTextColor} fontFamily={fontConfig?.fonts?.body || "Arial, sans-serif"}>
                    {w}
                  </text>
                ));
                cursorY += wrapped.length * 20 + 28;
                return nodes;
              });
            })()}
          </g>

          <g transform={`translate(750, 40)`}>
            <text x="0" y="0" fontSize="12" fill={dimTextColor} letterSpacing="4">EQUIPMENT</text>
            {(() => {
              const eqText = recordingData?.equipment || "";
              // 绝对坐标防撞机制：动态测算底部 RELEASED 的反向占地面积
              const dateStr = (data.releaseDate || "").split(/[-.]/)[0] || "";
              const dateWidth = TypographyService.measureWidth(dateStr, titleFont, 32, { fontWeight: 'bold' });
              const releasedBoxWidth = Math.max(dateWidth, 75); // RELEASED 的宽度约为 70
              
              const totalLimit = contentHeight - 50; 
              const absoluteRightLimit = totalLimit - releasedBoxWidth - 30; // 30px 为追尾缓冲距离
              const dynamic_EQ_MAX_WIDTH = Math.max(120, absoluteRightLimit - 750);
              
              const EQ_FONT_SIZE = 16;
              const eqLines = TypographyService.wrapText(eqText, bodyFont, EQ_FONT_SIZE, dynamic_EQ_MAX_WIDTH);
              return eqLines.map((line, i) => (
                <text key={i} x="0" y={22 + (i * 20)} fontSize="16" fill={subTextColor} fontFamily={fontConfig?.fonts?.body || "Arial, sans-serif"}>
                  {line}
                </text>
              ));
            })()}
          </g>

          <g transform={`translate(${contentHeight - 50}, 40)`}>
            <g>
              <text x="0" y="0" fontSize="12" fill={dimTextColor} letterSpacing="4" textAnchor="end">RELEASED</text>
              <text x="0" y="32" fontSize="32" fill={textColor} fontWeight="bold" letterSpacing="1" textAnchor="end">
                {(data.releaseDate || "").split(/[-.]/)[0]}
              </text>
            </g>

            <g transform={`translate(0, 96)`}>
              <text x="0" y="0" fontSize="12" fill={dimTextColor} letterSpacing="4" textAnchor="end">RECORDED</text>
              <text x="0" y="32" fontSize="32" fill={theme.accent} fontWeight="bold" letterSpacing="1" textAnchor="end">
                {recordingData?.recDate || ""}
              </text>
            </g>
          </g>
        </g>
      ) : (
        <g transform={`translate(0, 0)`}>
          <g transform={`translate(${verticalPadding}, ${yHeaderA})`}>
            {renderSideHeader('SIDE A', data.sideADuration)}
          </g>

          <g transform={`translate(${verticalPadding}, ${yListA})`} fontFamily={fontConfig?.fonts?.body || "Arial, sans-serif"}>
            {renderGroupList(displayGroupsA, 0)}
          </g>

          <line x1={verticalPadding} y1={yDivider} x2={sideDividerRightX} y2={yDivider} stroke={dimTextColor} strokeWidth="1" opacity="0.28" />

          <g transform={`translate(${verticalPadding}, ${yHeaderB})`}>
            {renderSideHeader('SIDE B', data.sideBDuration)}
          </g>

          <g transform={`translate(${verticalPadding}, ${yListB})`} fontFamily={fontConfig?.fonts?.body || "Arial, sans-serif"}>
            {renderGroupList(displayGroupsB, sideBIndexStart)}
          </g>
        </g>
      )}
    </g>
  );
};

export default ContentBack;

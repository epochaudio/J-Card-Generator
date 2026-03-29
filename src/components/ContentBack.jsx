import React, { useMemo } from 'react';

import { JCARD_DIMENSIONS } from '../constants/app.js';
import LayoutEngine from '../utils/LayoutEngine.js';
import TypographyService from '../services/TypographyService.js';


const ContentBack = ({ width, data, theme, isCompact, isLight, textColor, subTextColor, dimTextColor, recordingData, fontConfig }) => {
  const contentHeight = JCARD_DIMENSIONS.height;
  const marginY = isCompact ? 60 : 80;
  const footerHeight = isCompact ? 40 : 60;
  const headerHeight = isCompact ? 25 : 50;
  const gapBetweenSides = isCompact ? 20 : 60;
  const verticalPadding = isCompact ? 40 : 40;

  const staticHeight = marginY + headerHeight + gapBetweenSides + headerHeight + footerHeight;
  const availableForTracks = contentHeight - staticHeight;

  const hasNoteUpper = !!data.layout?.noteUpper;
  const hasNoteLower = !!data.layout?.noteLower;
  const isClassical = data.layout.mode === 'CLASSICAL';

  // 字号边界：取决于面板是 compact（ShortBack 200px）还是全宽（Back 618px）
  const maxFont = isCompact ? 15 : 25;
  const minFont = isCompact ? 8 : 12;

  // 获取当前字体配置（全局可用）
  const bodyFont = fontConfig?.fonts?.body || "Arial, sans-serif";
  const titleFont = fontConfig?.fonts?.title || "Arial, sans-serif";
  const monoFont = fontConfig?.fonts?.mono || "Courier New, monospace";

  const renderStrategy = useMemo(() => {
    if (!isClassical) return 'STANDARD';
    return isCompact ? 'WORK_ONLY' : 'INLINE_COMPACT';
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
    // 只有行高足够宽裕时才显示备注，避免拥挤
    const showNotesGlobal = !isCompact && roughLH > 45;

    // 第一轮估算字号（供 Pretext 测量用）
    const LINE_HEIGHT_TO_FONT_RATIO = 0.55;
    let estFontSize = Math.floor(roughLH * LINE_HEIGHT_TO_FONT_RATIO);
    estFontSize = Math.min(Math.max(estFontSize, minFont), maxFont);

    /**
     * 计算单条普通曲目真正的可用折行宽度
     * 修复史诗级隐藏 Bug：原本 renderer 会在文本前后强行追加 "01. " 和 " (4:20)"。
     * 这导致原本文本完美排满 usableWidth 时，追加部分会直接冲出右边界被裁切。
     */
    const getTrackTitleAvailableWidth = (item, estFontSize, currentIdx) => {
      let prefixW = 32; // 第二行默认悬挂缩进的宽度
      let suffixW = 0;
      if (!isClassical) {
        // 全新视觉：测量无点的等宽数字前缀 (例如 "01")，字号略小且使用 monoFont
        const numStr = String(currentIdx + 1).padStart(2, '0');
        const numSize = Math.max(estFontSize - 2, 10);
        prefixW = TypographyService.measureWidth(numStr, monoFont, numSize, { fontWeight: 'normal' }) + 12; // 12px 为与标题间的空白缓冲
        
        let suffixStr = "";
        if (data.layout?.mode === 'COMPILATION' && !isCompact && item.artist) {
          suffixStr += ` - ${item.artist} `;
        }
        if (!isCompact && item.duration) {
          suffixStr += `  ${item.duration}`; // 取消括号，仅用空格分隔时间码
        }
        if (suffixStr) {
          const suffixSize = Math.max(estFontSize - 4, 10);
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
    const calculateRealVisualLines = (groups, fontSize, startGlobalIdx = 0) => {
      let currentIdx = startGlobalIdx;
      return groups.reduce((acc, item) => {
        if (item.type === 'group') {
          const groupHeaderFontSize = Math.min(fontSize + 2, maxFont + 2);
          const headerLines = TypographyService.wrapText(
            item.title, titleFont, groupHeaderFontSize, usableWidth, { fontWeight: 'bold' }
          );
          let groupHeight = headerLines.length * 0.9;

          if (renderStrategy === 'INLINE_COMPACT') {
            const joinedText = item.tracks.map((t, tidx) => {
              const roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"][tidx] || (tidx + 1);
              const cleanTitle = t.displayTitle.replace(/^[IVX]+\.\s*/, '');
              return `${roman}. ${cleanTitle}`;
            }).join(" / ");

            const contentLines = TypographyService.wrapText(
              joinedText, bodyFont, fontSize - 1, usableWidth
            );
            groupHeight += contentLines.length * 0.85 + 0.3;
            currentIdx += item.tracks.length;
          } else if (renderStrategy === 'WORK_ONLY') {
            groupHeight += 0.2;
            currentIdx += item.tracks.length;
          } else {
            groupHeight += item.tracks.length;
            currentIdx += item.tracks.length;
          }
          return acc + groupHeight;
        }

        // 普通曲目 (精确核减前后缀引发的排版溢出空间)
        const safeAvailableW = getTrackTitleAvailableWidth(item, fontSize, currentIdx);
        const titleLines = TypographyService.wrapText(
          item.displayTitle, bodyFont, fontSize, safeAvailableW, { fontWeight: 'bold' }
        );
        let noteHeight = 0;
        if (showNotesGlobal && item.note) {
          const noteFontSize = Math.max(fontSize * 0.6, 8);
          // 减去 25px 给 note 留出悬挂缩进
          const noteLines = TypographyService.wrapText(
            item.note, bodyFont, noteFontSize, usableWidth - 25
          );
          noteHeight = Math.min(noteLines.length, 2) * 0.6;
        }
        currentIdx++;
        return acc + 1 + (titleLines.length - 1) * 0.85 + noteHeight;
      }, 0);
    };

    const visualLinesA = calculateRealVisualLines(groupsA, estFontSize, 0);
    const visualLinesB = calculateRealVisualLines(groupsB, estFontSize, data.sideA.length);
    const totalVisualItems = visualLinesA + visualLinesB;

    // 行高边界
    const maxLH = isCompact ? 50 : 110;
    const minLHValue = isCompact ? 16 : 30;
    let calculatedLH = totalVisualItems > 0 ? availableForTracks / totalVisualItems : maxLH;
    calculatedLH = Math.min(Math.max(calculatedLH, minLHValue), maxLH);

    // 最终字号基于精确的行高计算
    let fontSize = Math.floor(calculatedLH * LINE_HEIGHT_TO_FONT_RATIO);
    fontSize = Math.min(Math.max(fontSize, minFont), maxFont);

    // Y 坐标计算
    const yHeaderA = marginY;
    const yListA = yHeaderA + headerHeight;
    const heightA = visualLinesA * calculatedLH;
    const yDivider = yListA + heightA + (gapBetweenSides / 2);
    const yHeaderB = yDivider + (gapBetweenSides / 2);
    const yListB = yHeaderB + headerHeight;

    return {
      showNotesGlobal,
      usableWidth,
      trackFontSize: fontSize,
      groupHeaderFontSize: Math.min(fontSize + 2, maxFont + 2),
      noteFontSize: Math.max(fontSize * 0.6, 8),
      calculatedLH,
      yHeaderA,
      yListA,
      yDivider,
      yHeaderB,
      yListB
    };
  }, [availableForTracks, gapBetweenSides, groupsA, groupsB, headerHeight, isCompact, marginY, maxFont, minFont, renderStrategy, width, fontConfig]);

  const {
    showNotesGlobal,
    usableWidth,
    trackFontSize,
    groupHeaderFontSize,
    noteFontSize,
    calculatedLH,
    yHeaderA,
    yListA,
    yDivider,
    yHeaderB,
    yListB
  } = layoutMetrics;

  // 徽章视觉等比膨胀系统：防止字体涨大时，固定尺寸的徽章被压制
  const badgeRadius = Math.max(14, Math.floor(trackFontSize * 0.65)); 
  const badgeFontSize = Math.max(14, Math.floor(trackFontSize * 0.6));

  // 字体配置（渲染时用）
  // (已提升至全局作用域)

  const renderGroupList = (groups, startGlobalIdx) => {
    let yCursor = 0;
    let localIdx = startGlobalIdx;

    return groups.map((item, i) => {
      if (item.type === 'group') {
        const headerLines = TypographyService.wrapText(item.title, titleFont, groupHeaderFontSize, usableWidth, { fontWeight: 'bold' });

        const headerNode = headerLines.map((line, lineIdx) => (
          <text key={`h-${i}-${lineIdx}`} x="-5" y={yCursor + calculatedLH * 0.6 + (lineIdx * calculatedLH * 0.85)} fill={textColor} fontSize={groupHeaderFontSize} fontWeight="bold" dominantBaseline="middle" fontFamily={fontConfig?.fonts?.title || "Arial, sans-serif"}>
            {line}
          </text>
        ));

        yCursor += calculatedLH + (headerLines.length - 1) * calculatedLH * 0.85;

        let contentNode = null;

        if (renderStrategy === 'INLINE_COMPACT') {
          const joinedText = item.tracks.map((t, tidx) => {
            const roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"][tidx] || (tidx + 1);
            let cleanTitle = t.displayTitle.replace(/^[IVX0-9]+\.\s*/, '');
            if (isClassical) return cleanTitle;
            return `${roman}. ${cleanTitle}`;
          }).join(" / ");

          const contentLines = TypographyService.wrapText(joinedText, bodyFont, trackFontSize - 1, usableWidth);
          contentNode = contentLines.map((line, lIdx) => (
            <text key={`c-${i}-${lIdx}`} x="0" y={yCursor + calculatedLH * 0.5 + (lIdx * calculatedLH * 0.85)} fill={dimTextColor} fontSize={trackFontSize - 1} dominantBaseline="middle">
              {line}
            </text>
          ));
          yCursor += contentLines.length * calculatedLH * 0.85 + calculatedLH * 0.3;
          localIdx += item.tracks.length;
        } else if (renderStrategy === 'WORK_ONLY') {
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

      const hasNote = showNotesGlobal && item.note;
      const noteLines = hasNote ? TypographyService.wrapText(item.note, bodyFont, noteFontSize, usableWidth - 25) : [];
      
      // 复用安全测量逻辑，在渲染阶段实行严酷的带边框安全折行
      let prefixW = 32;
      let suffixW = 0;
      if (!isClassical) {
        const numStr = String(localIdx + 1).padStart(2, '0');
        const numSize = Math.max(trackFontSize - 2, 10);
        prefixW = TypographyService.measureWidth(numStr, monoFont, numSize, { fontWeight: 'normal' }) + 12;
        let suffixStr = "";
        if (data.layout?.mode === 'COMPILATION' && !isCompact && item.artist) suffixStr += ` - ${item.artist} `;
        if (!isCompact && item.duration) suffixStr += `  ${item.duration}`;
        if (suffixStr) suffixW = TypographyService.measureWidth(suffixStr, bodyFont, Math.max(trackFontSize - 4, 10));
      }
      const safeAvailableW = usableWidth - prefixW - suffixW;
      
      const titleLines = TypographyService.wrapText(item.displayTitle, bodyFont, trackFontSize, safeAvailableW, { fontWeight: 'bold' });

      const trackNode = titleLines.map((line, lineIdx) => {
        const isFirstLine = lineIdx === 0;
        const numSize = Math.max(trackFontSize - 2, 10);
        return (
          <text key={`t-${i}-${lineIdx}`} x="0" y={thisY + calculatedLH * (hasNote ? 0.35 : 0.5) + (lineIdx * calculatedLH * 0.85)} fill={subTextColor} fontSize={trackFontSize} dominantBaseline="middle">
            {isFirstLine && !isClassical && <tspan fontWeight="normal" fontFamily={monoFont} fontSize={numSize} fill={dimTextColor}>{String(localIdx).padStart(2, '0')}</tspan>}
            <tspan fontWeight="bold" dx={isFirstLine ? 12 : 32}>{line}</tspan>
            {isFirstLine && (data.layout?.mode === 'COMPILATION') && !isCompact && <tspan fill={dimTextColor}> - {item.artist}</tspan>}
            {isFirstLine && !isCompact && !isClassical && <tspan fontSize={Math.max(trackFontSize - 4, 10)} fontFamily={monoFont} fill={dimTextColor}>  {item.duration}</tspan>}
          </text>
        );
      });

      yCursor += calculatedLH + (titleLines.length - 1) * calculatedLH * 0.85;
      if (hasNote && noteLines.length > 0) {
        yCursor += Math.min(noteLines.length, 2) * noteFontSize * 1.2;
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
            const labelText = (recordingData?.labelOverride || data.tapeSubtitle || "LABEL INFO").toUpperCase();
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
                  <text x="0" y="22" fontSize="16" fill={subTextColor} fontWeight="bold" textAnchor="start">{recordingData?.source || "N/A"}</text>
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
              const eqText = recordingData?.equipment || "N/A";
              // 绝对坐标防撞机制：动态测算底部 RELEASED 的反向占地面积
              const dateStr = (data.releaseDate || "").split(/[-.]/)[0] || "2000";
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
                {recordingData?.recDate || "2025.01.01"}
              </text>
            </g>
          </g>
        </g>
      ) : (
        <g transform={`translate(0, 0)`}>
          <g transform={`translate(${verticalPadding}, ${yHeaderA})`}>
            <circle cx={badgeRadius} cy="0" r={badgeRadius} fill={theme.accent} />
            <text x={badgeRadius} y="1" fontFamily={titleFont} fontWeight="bold" fontSize={badgeFontSize} fill={isLight ? "#fff" : "#121212"} textAnchor="middle" dominantBaseline="middle">A</text>
            <text x={width - verticalPadding * 2 - (hasNoteLower ? 20 : 0) - (hasNoteUpper ? 20 : 0) - (isCompact ? 0 : 20)} y="1" fontFamily={monoFont} fontSize={12} letterSpacing="2" fill={dimTextColor} textAnchor="end" dominantBaseline="middle">{data.sideADuration}</text>
          </g>

          <g transform={`translate(${verticalPadding}, ${yListA})`} fontFamily={fontConfig?.fonts?.body || "Arial, sans-serif"}>
            {renderGroupList(groupsA, 0)}
          </g>

          <line x1={verticalPadding} y1={yDivider} x2={width - verticalPadding * 2 - (hasNoteLower ? 20 : 0) - (hasNoteUpper ? 20 : 0)} y2={yDivider} stroke={dimTextColor} strokeWidth="1" opacity="0.5" />

          <g transform={`translate(${verticalPadding}, ${yHeaderB})`}>
            <circle cx={badgeRadius} cy="0" r={badgeRadius} fill={theme.accent} />
            <text x={badgeRadius} y="1" fontFamily={titleFont} fontWeight="bold" fontSize={badgeFontSize} fill={isLight ? "#fff" : "#121212"} textAnchor="middle" dominantBaseline="middle">B</text>
            <text x={width - verticalPadding * 2 - (hasNoteLower ? 20 : 0) - (hasNoteUpper ? 20 : 0) - (isCompact ? 0 : 20)} y="1" fontFamily={monoFont} fontSize={12} letterSpacing="2" fill={dimTextColor} textAnchor="end" dominantBaseline="middle">{data.sideBDuration}</text>
          </g>

          <g transform={`translate(${verticalPadding}, ${yListB})`} fontFamily={fontConfig?.fonts?.body || "Arial, sans-serif"}>
            {renderGroupList(groupsB, data.sideA.length)}
          </g>
        </g>
      )}
    </g>
  );
};

export default ContentBack;

import React, { useMemo } from 'react';

import { JCARD_DIMENSIONS } from '../constants/app.js';
import LayoutEngine from '../utils/LayoutEngine.js';
import TextUtils from '../utils/TextUtils.js';

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

  const fontRatio = 0.55;
  const maxFont = isCompact ? 15 : 25;
  const minFont = isCompact ? 8 : 12;

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
    const countRoughLines = (groups) => groups.reduce((acc, item) => {
      if (item.type === 'group') return acc + 1 + item.tracks.length;
      return acc + 1;
    }, 0);

    const roughTotalLines = countRoughLines(groupsA) + countRoughLines(groupsB);
    const roughLH = roughTotalLines > 0 ? availableForTracks / roughTotalLines : 50;
    const showNotesGlobal = !isCompact && roughLH > 45;

    let estFontSize = Math.floor(roughLH * fontRatio);
    estFontSize = Math.min(Math.max(estFontSize, minFont), maxFont);

    const usableWidth = width - 80;
    const safeTextWidthConst = 0.7;
    const dynamicWrapLimit = Math.max(10, Math.floor(usableWidth / (estFontSize * safeTextWidthConst)));
    const wrapCharsHeader = Math.floor(dynamicWrapLimit * 0.9);
    const wrapCharsContent = Math.floor(dynamicWrapLimit * 1.5);

    const calculateRealVisualLines = (groups) => groups.reduce((acc, item) => {
      if (item.type === 'group') {
        const headerLinesCount = TextUtils.getWrappedLines(item.title, wrapCharsHeader).length;
        let groupHeight = headerLinesCount * 0.9;

        if (renderStrategy === 'INLINE_COMPACT') {
          const joinedText = item.tracks.map((t, tidx) => {
            const roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"][tidx] || (tidx + 1);
            const cleanTitle = t.displayTitle.replace(/^[IVX]+\.\s*/, '');
            return `${roman}. ${cleanTitle}`;
          }).join(" / ");

          const contentLinesCount = TextUtils.getWrappedLines(joinedText, wrapCharsContent).length;
          groupHeight += contentLinesCount * 0.85 + 0.3;
        } else if (renderStrategy === 'WORK_ONLY') {
          groupHeight += 0.2;
        } else {
          groupHeight += item.tracks.length;
        }
        return acc + groupHeight;
      }

      const lines = TextUtils.getWrappedLines(item.displayTitle, wrapCharsHeader).length;
      let noteHeight = 0;
      if (showNotesGlobal && item.note) {
        const noteLines = TextUtils.getWrappedLines(item.note, wrapCharsContent).length;
        noteHeight = Math.min(noteLines, 2) * 0.6;
      }
      return acc + 1 + (lines - 1) * 0.85 + noteHeight;
    }, 0);

    const visualLinesA = calculateRealVisualLines(groupsA);
    const visualLinesB = calculateRealVisualLines(groupsB);
    const totalVisualItems = visualLinesA + visualLinesB;
    const maxLH = isCompact ? 50 : 110;
    const minLHValue = isCompact ? 16 : 30;
    let calculatedLH = totalVisualItems > 0 ? availableForTracks / totalVisualItems : maxLH;
    calculatedLH = Math.min(Math.max(calculatedLH, minLHValue), maxLH);

    let fontSize = Math.floor(calculatedLH * fontRatio);
    fontSize = Math.min(Math.max(fontSize, minFont), maxFont);

    const yHeaderA = marginY;
    const yListA = yHeaderA + headerHeight;
    const heightA = visualLinesA * calculatedLH;
    const yDivider = yListA + heightA + (gapBetweenSides / 2);
    const yHeaderB = yDivider + (gapBetweenSides / 2);
    const yListB = yHeaderB + headerHeight;

    return {
      showNotesGlobal,
      wrapCharsHeader,
      wrapCharsContent,
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
  }, [availableForTracks, fontRatio, gapBetweenSides, groupsA, groupsB, headerHeight, isCompact, marginY, maxFont, minFont, renderStrategy, width]);

  const {
    showNotesGlobal,
    wrapCharsHeader,
    wrapCharsContent,
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

  const showSideLabel = !isCompact;

  const renderGroupList = (groups, startGlobalIdx) => {
    let yCursor = 0;
    let localIdx = startGlobalIdx;

    return groups.map((item, i) => {
      if (item.type === 'group') {
        const headerLines = TextUtils.getWrappedLines(item.title, wrapCharsHeader);

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

          const contentLines = TextUtils.getWrappedLines(joinedText, wrapCharsContent);
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

      const noteWrapLimit = wrapCharsContent;
      const hasNote = showNotesGlobal && item.note;
      const noteLines = hasNote ? TextUtils.getWrappedLines(item.note, noteWrapLimit) : [];
      const titleLines = TextUtils.getWrappedLines(item.displayTitle, wrapCharsHeader);

      const trackNode = titleLines.map((line, lineIdx) => {
        const isFirstLine = lineIdx === 0;
        return (
          <text key={`t-${i}-${lineIdx}`} x="0" y={thisY + calculatedLH * (hasNote ? 0.35 : 0.5) + (lineIdx * calculatedLH * 0.85)} fill={subTextColor} fontSize={trackFontSize} dominantBaseline="middle">
            {isFirstLine && !isClassical && <tspan fontWeight="bold" fill={theme.accent}>{String(localIdx).padStart(2, '0')}.</tspan>}
            <tspan fontWeight="bold" dx={isFirstLine ? 5 : 28}>{line}</tspan>
            {isFirstLine && (data.layout?.mode === 'COMPILATION') && !isCompact && <tspan fill={dimTextColor}> - {item.artist}</tspan>}
            {isFirstLine && !isCompact && !isClassical && <tspan fontSize={Math.max(trackFontSize - 4, 10)} fill={dimTextColor}> ({item.duration})</tspan>}
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
            const labelLines = TextUtils.getWrappedLines(labelText, 20);
            const labelY = 40;
            const lineHeight = 28;
            const sourceY = labelY + (labelLines.length * lineHeight) + 20;

            return (
              <g>
                {labelLines.map((line, i) => (
                  <text key={`l-${i}`} x="50" y={labelY + (i * lineHeight)} fontSize="24" fontWeight="bold" fill={textColor} letterSpacing="2" dominantBaseline="hanging">
                    {line}
                  </text>
                ))}
                <g transform={`translate(50, ${sourceY})`}>
                  <text x="0" y="0" fontSize="14" fill={dimTextColor} letterSpacing="3">SOURCE</text>
                  <text x="0" y="25" fontSize="18" fill={subTextColor} fontWeight="bold" textAnchor="start">{recordingData?.source || "N/A"}</text>
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
                  const node = <text key={idx} x="0" y={cursorY} fontSize="14" fill={dimTextColor} letterSpacing="3">{item.text}</text>;
                  cursorY += 24;
                  return node;
                }

                const wrapped = TextUtils.getWrappedLines(item.text, 30);
                const nodes = wrapped.map((w, wIdx) => (
                  <text key={`${idx}-${wIdx}`} x="0" y={cursorY + (wIdx * 20)} fontSize="18" fill={subTextColor} fontFamily={fontConfig?.fonts?.body || "Arial, sans-serif"} fontWeight="bold">
                    {w}
                  </text>
                ));
                cursorY += wrapped.length * 20 + 25;
                return nodes;
              });
            })()}
          </g>

          <g transform={`translate(750, 40)`}>
            <text x="0" y="0" fontSize="14" fill={dimTextColor} letterSpacing="3">EQUIPMENT</text>
            {(() => {
              const eqText = recordingData?.equipment || "N/A";
              const eqLines = TextUtils.getWrappedLines(eqText.toUpperCase(), 30);
              return eqLines.map((line, i) => (
                <text key={i} x="0" y={30 + (i * 20)} fontSize="18" fill={subTextColor} fontFamily={fontConfig?.fonts?.body || "Arial, sans-serif"} fontWeight="bold">
                  {line}
                </text>
              ));
            })()}
          </g>

          <g transform={`translate(${contentHeight - 50}, 40)`}>
            <g>
              <text x="0" y="0" fontSize="14" fill={dimTextColor} letterSpacing="3" textAnchor="end">RELEASED</text>
              <text x="0" y="30" fontSize="24" fill={textColor} fontWeight="bold" textAnchor="end">
                {(data.releaseDate || "").split(/[-.]/)[0]}
              </text>
            </g>

            <g transform={`translate(0, 80)`}>
              <text x="0" y="0" fontSize="14" fill={dimTextColor} letterSpacing="3" textAnchor="end">RECORDED</text>
              <text x="0" y="30" fontSize="24" fill={theme.accent} fontWeight="bold" textAnchor="end">
                {recordingData?.recDate || "2025.01.01"}
              </text>
            </g>
          </g>
        </g>
      ) : (
        <g transform={`translate(0, 0)`}>
          <g transform={`translate(${verticalPadding}, ${yHeaderA})`}>
            <rect x="0" y="-15" width="40" height="20" fill={textColor} rx="4" />
            <text x="20" y="0" fontFamily={fontConfig?.fonts?.body || "Arial, sans-serif"} fontWeight="bold" fontSize="14" fill={isLight ? "#fff" : "#121212"} textAnchor="middle" dominantBaseline="middle">A</text>
            {showSideLabel && <text x="50" y="0" fontFamily={fontConfig?.fonts?.body || "Arial, sans-serif"} fontWeight="bold" fontSize="14" fill={theme.accent} letterSpacing="1" dominantBaseline="middle">SIDE A</text>}
            <text x={width - verticalPadding * 2 - (hasNoteLower ? 20 : 0) - (hasNoteUpper ? 20 : 0) - (isCompact ? 0 : 20)} y="0" fontFamily={fontConfig?.fonts?.body || "Arial, sans-serif"} fontSize={12} fill={dimTextColor} textAnchor="end" dominantBaseline="middle">{data.sideADuration}</text>
          </g>

          <g transform={`translate(${verticalPadding}, ${yListA})`} fontFamily={fontConfig?.fonts?.body || "Arial, sans-serif"}>
            {renderGroupList(groupsA, 0)}
          </g>

          <line x1={verticalPadding} y1={yDivider} x2={width - verticalPadding * 2 - (hasNoteLower ? 20 : 0) - (hasNoteUpper ? 20 : 0)} y2={yDivider} stroke={dimTextColor} strokeWidth="1" opacity="0.5" />

          <g transform={`translate(${verticalPadding}, ${yHeaderB})`}>
            <rect x="0" y="-15" width="40" height="20" fill={textColor} rx="4" />
            <text x="20" y="0" fontFamily={fontConfig?.fonts?.body || "Arial, sans-serif"} fontWeight="bold" fontSize="14" fill={isLight ? "#fff" : "#121212"} textAnchor="middle" dominantBaseline="middle">B</text>
            {showSideLabel && <text x="50" y="0" fontFamily={fontConfig?.fonts?.body || "Arial, sans-serif"} fontWeight="bold" fontSize="14" fill={theme.accent} letterSpacing="1" dominantBaseline="middle">SIDE B</text>}
            <text x={width - verticalPadding * 2 - (hasNoteLower ? 20 : 0) - (hasNoteUpper ? 20 : 0) - (isCompact ? 0 : 20)} y="0" fontFamily={fontConfig?.fonts?.body || "Arial, sans-serif"} fontSize={12} fill={dimTextColor} textAnchor="end" dominantBaseline="middle">{data.sideBDuration}</text>
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

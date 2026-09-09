import { StyledText, StyledSpan } from './StyledText.jsx';
import { typographyFont, fontFamilyName } from '../config/textStyles.mjs';
import React, { useMemo } from 'react';
import { contrastInk } from '../config/design.mjs';

import { resolveShortBackArchiveLayout } from '../utils/ShortBackArchiveLayout.js';
import { resolveShortBackTrackLayout } from '../utils/ShortBackTrackLayout.js';

const SHORT_BACK_PADDING_X = 32;

const ShortBackContent = ({
  width,
  data,
  theme,
  isLight,
  textColor,
  subTextColor,
  dimTextColor,
  recordingData,
  fontConfig
}) => {
  const colors = theme.panelColors || {};
  const bodyFont = typographyFont(fontConfig, 'metadata', 'body');
  const titleFont = typographyFont(fontConfig, 'metadata', 'title');
  const monoFont = typographyFont(fontConfig, 'metadata', 'mono');

  const trackFont = typographyFont(fontConfig, 'track');
  const resolvedMode = data.layout?.shortBackMode || 'TRACKS_COMPACT';

  const archiveLayout = useMemo(() => {
    if (resolvedMode !== 'META_ARCHIVE') return null;
    return resolveShortBackArchiveLayout({
      data,
      recordingData,
      fontConfig
    });
  }, [resolvedMode, data, recordingData, fontConfig]);

  const sideSummaryData = useMemo(() => ([
    {
      key: 'A',
      label: 'SIDE A',
      duration: data.sideADuration || '0:00',
      tracks: data.sideA || [],
      startY: 132,
      blockHeight: 420
    },
    {
      key: 'B',
      label: 'SIDE B',
      duration: data.sideBDuration || '0:00',
      tracks: data.sideB || [],
      startY: 592,
      blockHeight: 460
    }
  ]), [data.sideA, data.sideADuration, data.sideB, data.sideBDuration]);

  const compactTrackLayout = useMemo(() => {
    if (resolvedMode !== 'TRACKS_COMPACT') return [];
    return resolveShortBackTrackLayout({
      width,
      sideSummaries: sideSummaryData,
      horizontalPadding: SHORT_BACK_PADDING_X,
      fontConfig
    });
  }, [resolvedMode, width, sideSummaryData, fontConfig]);

  const renderArchiveMode = () => {
    if (!archiveLayout) return null;

    const { label, credits, equipment, meta } = archiveLayout.columns;

    return (
      <g transform={`translate(${width}, 0) rotate(90)`} fontFamily={fontFamilyName(monoFont)}>
        <g transform={`translate(${label.x}, ${label.topY})`}>
          {label.label.lines.map((line, index) => (
            <StyledText fontFamily={monoFont}
              key={`label-${index}`}
              x="0"
              y={index * label.label.lineHeight}
              fontSize={label.label.fontSize}
              fontWeight="bold"
              fill={textColor}
              letterSpacing="2"
              dominantBaseline="hanging"
            >
              {line}
            </StyledText>
          ))}

          {label.source && label.source.body && (
            <g transform={`translate(0, ${label.source.groupY})`}>
              <StyledText fontFamily={monoFont} x="0" y="0" fontSize={label.source.headerFontSize} fill={dimTextColor} letterSpacing="4" dominantBaseline="hanging">
                {label.source.header}
              </StyledText>
              {label.source.body.lines.map((line, index) => (
                <StyledText
                  key={`source-${index}`}
                  x="0"
                  y={label.source.bodyY + (index * label.source.body.lineHeight)}
                  fontSize={label.source.body.fontSize}
                  fill={subTextColor}
                  fontFamily={bodyFont}
                  fontWeight="bold"
                  dominantBaseline="hanging"
                >
                  {line}
                </StyledText>
              ))}
            </g>
          )}
        </g>

        {credits && (
          <g transform={`translate(${credits.x}, ${credits.topY})`}>
            {credits.sections.map((section, sectionIndex) => (
              <g key={`credit-section-${sectionIndex}`} transform={`translate(0, ${section.groupY})`}>
                <StyledText fontFamily={monoFont} x="0" y="0" fontSize={section.headerFontSize} fill={dimTextColor} letterSpacing="4" dominantBaseline="hanging">
                  {section.header}
                </StyledText>
                {section.body?.lines.map((line, lineIndex) => (
                  <StyledText
                    key={`credit-line-${sectionIndex}-${lineIndex}`}
                    x="0"
                    y={section.bodyY + (lineIndex * section.body.lineHeight)}
                    fontSize={section.body.fontSize}
                    fill={subTextColor}
                    fontFamily={bodyFont}
                    dominantBaseline="hanging"
                  >
                    {line}
                  </StyledText>
                ))}
              </g>
            ))}
          </g>
        )}

        {equipment && equipment.body && (
          <g transform={`translate(${equipment.x}, ${equipment.topY})`}>
            <StyledText fontFamily={monoFont} x="0" y="0" fontSize={equipment.headerFontSize} fill={dimTextColor} letterSpacing="4" dominantBaseline="hanging">
              {equipment.header}
            </StyledText>
            {equipment.body.lines.map((line, index) => (
              <StyledText
                key={`equipment-${index}`}
                x="0"
                y={equipment.bodyY + (index * equipment.body.lineHeight)}
                fontSize={equipment.body.fontSize}
                fill={subTextColor}
                fontFamily={bodyFont}
                dominantBaseline="hanging"
              >
                {line}
              </StyledText>
            ))}
          </g>
        )}

        <g transform={`translate(${meta.x}, ${meta.topY})`}>
          <g>
            <StyledText fontFamily={monoFont} x="0" y={meta.release.labelY} fontSize={meta.release.labelFontSize} fill={dimTextColor} letterSpacing="4" textAnchor="end" dominantBaseline="hanging">
              {meta.release.label}
            </StyledText>
            <StyledText fontFamily={monoFont} x="0" y={meta.release.valueY} fontSize={meta.release.valueFontSize} data-color-role="shortBack.metadata" fill={colors.metadata || textColor} fontWeight="bold" letterSpacing="1" textAnchor="end" dominantBaseline="hanging">
              {meta.release.value}
            </StyledText>
          </g>

          <g transform={`translate(0, ${meta.recorded.groupY})`}>
            <StyledText fontFamily={monoFont} x="0" y={meta.recorded.labelY} fontSize={meta.recorded.labelFontSize} fill={dimTextColor} letterSpacing="4" textAnchor="end" dominantBaseline="hanging">
              {meta.recorded.label}
            </StyledText>
            <StyledText fontFamily={monoFont} x="0" y={meta.recorded.valueY} fontSize={meta.recorded.valueFontSize} fill={colors.metadata || theme.accent} fontWeight="bold" letterSpacing="1" textAnchor="end" dominantBaseline="hanging">
              {meta.recorded.value}
            </StyledText>
          </g>
        </g>
      </g>
    );
  };

  const renderTracksCompactMode = () => {
    return (
      <g>
        <StyledText x={SHORT_BACK_PADDING_X} y="56" fontFamily={monoFont} fontSize="13" fill={dimTextColor} letterSpacing="4">TRACK INDEX</StyledText>
        {compactTrackLayout.map((side) => (
          <g key={side.key} transform={`translate(${SHORT_BACK_PADDING_X}, ${side.startY})`}>
            <circle cx="18" cy="0" r="18" fill={theme.accent} />
            <StyledText x="18" y="1" fontFamily={monoFont} fontWeight="bold" fontSize="20" data-color-role="shortBack.badgeText" fill={colors.badgeText || contrastInk(theme.accent)} textAnchor="middle" dominantBaseline="middle">{side.key}</StyledText>
            <StyledText x={width - SHORT_BACK_PADDING_X * 2} y="1" fontFamily={monoFont} fontSize="14" fontWeight="bold" data-color-role="shortBack.duration" fill={colors.duration || subTextColor} textAnchor="end" dominantBaseline="middle">
              {side.duration}
            </StyledText>

            {side.visibleTracks.map((track, index) => (
              <StyledText
                key={`${side.key}-${track.id || index}`}
                x="0"
                y={track.y - 12}
                fontFamily={trackFont}
                fontSize={side.trackFontSize}
                data-color-role="shortBack.track" fill={colors.track || subTextColor}
                dominantBaseline="hanging"
              >
                <StyledSpan x="0" dy="0">
                  <StyledSpan fontFamily={monoFont} fontSize={side.numberFontSize} fill={colors.number || dimTextColor}>
                    {String(index + 1).padStart(2, '0')}
                  </StyledSpan>
                  <StyledSpan dx="8" fontWeight="bold">
                    {track.fittedLines?.[0] || track.title || ''}
                  </StyledSpan>
                </StyledSpan>
                {track.fittedLines?.slice(1).map((line, lineIndex) => (
                  <StyledSpan
                    key={`${side.key}-${track.id || index}-line-${lineIndex}`}
                    x={side.trackTextIndent}
                    dy={side.trackLineHeight}
                    fontWeight="bold"
                  >
                    {line}
                  </StyledSpan>
                ))}
              </StyledText>
            ))}

            {side.hiddenCount > 0 && (
              <StyledText x="0" y={side.moreY - 12} fontFamily={monoFont} fontSize={side.moreFontSize} fill={dimTextColor} letterSpacing="2">
                +{side.hiddenCount} MORE
              </StyledText>
            )}
          </g>
        ))}
      </g>
    );
  };

  if (resolvedMode === 'META_ARCHIVE') {
    return <g data-shortback-status={JSON.stringify({ mode: resolvedMode, level: archiveLayout?.level, truncated: JSON.stringify(archiveLayout).includes('"isTruncated":true') })}>{renderArchiveMode()}</g>;
  }

  return <g data-shortback-status={JSON.stringify({ mode: resolvedMode, sides: compactTrackLayout.map(side => ({ side: side.key, hidden: side.hiddenCount, truncated: side.visibleTracks.filter(track => track.titleWasTruncated).length })) })}>{renderTracksCompactMode()}</g>;
};

export default ShortBackContent;

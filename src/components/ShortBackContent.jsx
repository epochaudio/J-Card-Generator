import React, { useMemo } from 'react';

import TypographyService from '../services/TypographyService.js';
import { resolveShortBackArchiveLayout } from '../utils/ShortBackArchiveLayout.js';
import { resolveShortBackMode } from '../utils/ShortBackModeResolver.js';

const SHORT_BACK_PADDING_X = 24;

const fitSingleLine = (text, fontFamily, fontSize, maxWidth, fontOptions = {}) => {
  const normalized = String(text || '').trim();
  if (!normalized) return '';

  if (TypographyService.measureWidth(normalized, fontFamily, fontSize, fontOptions) <= maxWidth) {
    return normalized;
  }

  const suffix = '...';
  for (let i = normalized.length - 1; i > 0; i -= 1) {
    const candidate = `${normalized.slice(0, i).trimEnd()}${suffix}`;
    if (TypographyService.measureWidth(candidate, fontFamily, fontSize, fontOptions) <= maxWidth) {
      return candidate;
    }
  }

  return suffix;
};

const formatTrackCountLabel = (count) => `${count} ${count === 1 ? 'TRACK' : 'TRACKS'}`;

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
  const bodyFont = fontConfig?.fonts?.body || 'Arial, sans-serif';
  const titleFont = fontConfig?.fonts?.title || 'Arial, sans-serif';
  const monoFont = fontConfig?.fonts?.mono || 'Courier New, monospace';

  const resolvedMode = useMemo(
    () => resolveShortBackMode(data.layout?.mode, data.layout?.shortBackMode),
    [data.layout?.mode, data.layout?.shortBackMode]
  );

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
      startY: 132
    },
    {
      key: 'B',
      label: 'SIDE B',
      duration: data.sideBDuration || '0:00',
      tracks: data.sideB || [],
      startY: 640
    }
  ]), [data.sideA, data.sideADuration, data.sideB, data.sideBDuration]);

  const renderArchiveMode = () => {
    if (!archiveLayout) return null;

    const { label, credits, equipment, meta } = archiveLayout.columns;

    return (
      <g transform={`translate(${width}, 0) rotate(90)`} fontFamily={monoFont}>
        <g transform={`translate(${label.x}, ${label.topY})`}>
          {label.label.lines.map((line, index) => (
            <text
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
            </text>
          ))}

          {label.source && label.source.body && (
            <g transform={`translate(0, ${label.source.groupY})`}>
              <text x="0" y="0" fontSize={label.source.headerFontSize} fill={dimTextColor} letterSpacing="4" dominantBaseline="hanging">
                {label.source.header}
              </text>
              {label.source.body.lines.map((line, index) => (
                <text
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
                </text>
              ))}
            </g>
          )}
        </g>

        {credits && (
          <g transform={`translate(${credits.x}, ${credits.topY})`}>
            {credits.sections.map((section, sectionIndex) => (
              <g key={`credit-section-${sectionIndex}`} transform={`translate(0, ${section.groupY})`}>
                <text x="0" y="0" fontSize={section.headerFontSize} fill={dimTextColor} letterSpacing="4" dominantBaseline="hanging">
                  {section.header}
                </text>
                {section.body?.lines.map((line, lineIndex) => (
                  <text
                    key={`credit-line-${sectionIndex}-${lineIndex}`}
                    x="0"
                    y={section.bodyY + (lineIndex * section.body.lineHeight)}
                    fontSize={section.body.fontSize}
                    fill={subTextColor}
                    fontFamily={bodyFont}
                    dominantBaseline="hanging"
                  >
                    {line}
                  </text>
                ))}
              </g>
            ))}
          </g>
        )}

        {equipment && equipment.body && (
          <g transform={`translate(${equipment.x}, ${equipment.topY})`}>
            <text x="0" y="0" fontSize={equipment.headerFontSize} fill={dimTextColor} letterSpacing="4" dominantBaseline="hanging">
              {equipment.header}
            </text>
            {equipment.body.lines.map((line, index) => (
              <text
                key={`equipment-${index}`}
                x="0"
                y={equipment.bodyY + (index * equipment.body.lineHeight)}
                fontSize={equipment.body.fontSize}
                fill={subTextColor}
                fontFamily={bodyFont}
                dominantBaseline="hanging"
              >
                {line}
              </text>
            ))}
          </g>
        )}

        <g transform={`translate(${meta.x}, ${meta.topY})`}>
          <g>
            <text x="0" y={meta.release.labelY} fontSize={meta.release.labelFontSize} fill={dimTextColor} letterSpacing="4" textAnchor="end" dominantBaseline="hanging">
              {meta.release.label}
            </text>
            <text x="0" y={meta.release.valueY} fontSize={meta.release.valueFontSize} fill={textColor} fontWeight="bold" letterSpacing="1" textAnchor="end" dominantBaseline="hanging">
              {meta.release.value}
            </text>
          </g>

          <g transform={`translate(0, ${meta.recorded.groupY})`}>
            <text x="0" y={meta.recorded.labelY} fontSize={meta.recorded.labelFontSize} fill={dimTextColor} letterSpacing="4" textAnchor="end" dominantBaseline="hanging">
              {meta.recorded.label}
            </text>
            <text x="0" y={meta.recorded.valueY} fontSize={meta.recorded.valueFontSize} fill={theme.accent} fontWeight="bold" letterSpacing="1" textAnchor="end" dominantBaseline="hanging">
              {meta.recorded.value}
            </text>
          </g>
        </g>
      </g>
    );
  };

  const renderTracksCompactMode = () => {
    const maxVisibleTracksPerSide = 5;
    const trackTextMaxWidth = width - SHORT_BACK_PADDING_X * 2 - 34;

    return (
      <g>
        <text x={SHORT_BACK_PADDING_X} y="56" fontFamily={monoFont} fontSize="11" fill={dimTextColor} letterSpacing="4">TRACK INDEX</text>
        {sideSummaryData.map((side) => {
          const visibleTracks = side.tracks.slice(0, maxVisibleTracksPerSide);
          const hiddenCount = Math.max(0, side.tracks.length - visibleTracks.length);

          return (
            <g key={side.key} transform={`translate(${SHORT_BACK_PADDING_X}, ${side.startY})`}>
              <circle cx="16" cy="0" r="16" fill={theme.accent} />
              <text x="16" y="1" fontFamily={titleFont} fontWeight="bold" fontSize="16" fill={isLight ? '#fff' : '#121212'} textAnchor="middle" dominantBaseline="middle">{side.key}</text>
              <text x={width - SHORT_BACK_PADDING_X * 2} y="1" fontFamily={monoFont} fontSize="12" fill={dimTextColor} textAnchor="end" dominantBaseline="middle">
                {side.duration}
              </text>
              <text x="0" y="38" fontFamily={monoFont} fontSize="11" fill={dimTextColor} letterSpacing="2">{formatTrackCountLabel(side.tracks.length)}</text>

              {visibleTracks.map((track, index) => (
                <text key={`${side.key}-${track.id || index}`} x="0" y={76 + (index * 28)} fontFamily={bodyFont} fontSize="13" fill={subTextColor} dominantBaseline="middle">
                  <tspan fontFamily={monoFont} fill={dimTextColor}>{String(index + 1).padStart(2, '0')}</tspan>
                  <tspan dx="8" fontWeight="bold">
                    {fitSingleLine(track.title || '', bodyFont, 13, trackTextMaxWidth, { fontWeight: 'bold' })}
                  </tspan>
                </text>
              ))}

              {hiddenCount > 0 && (
                <text x="0" y={76 + (visibleTracks.length * 28)} fontFamily={monoFont} fontSize="11" fill={dimTextColor} letterSpacing="2">
                  +{hiddenCount} MORE
                </text>
              )}
            </g>
          );
        })}
      </g>
    );
  };

  if (resolvedMode === 'META_ARCHIVE') {
    return renderArchiveMode();
  }

  return renderTracksCompactMode();
};

export default ShortBackContent;

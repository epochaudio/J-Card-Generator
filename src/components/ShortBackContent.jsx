import React, { useMemo } from 'react';

import { JCARD_DIMENSIONS } from '../constants/app.js';
import TypographyService from '../services/TypographyService.js';
import { resolveShortBackMode } from '../utils/ShortBackModeResolver.js';

const SHORT_BACK_PADDING_X = 24;
const PANEL_HEIGHT = JCARD_DIMENSIONS.height;

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

const getReleaseYear = (releaseDate = '') => (
  String(releaseDate || '').split(/[-.]/)[0] || ''
);

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
    const labelText = (recordingData?.labelOverride || data.tapeSubtitle || '').toUpperCase();
    const labelMaxWidth = 300;
    const labelFontSize = 32;
    const labelLines = TypographyService.wrapText(labelText, monoFont, labelFontSize, labelMaxWidth, { fontWeight: 'bold' });
    const labelY = 40;
    const lineHeight = 38;
    const sourceY = labelY + (labelLines.length * lineHeight) + 24;

    const creditsLines = [];
    const credits = recordingData?.credits;

    if (credits) {
      if (credits.producers?.length) {
        creditsLines.push({ type: 'header', text: 'PRODUCED BY' });
        creditsLines.push({ type: 'body', text: credits.producers.slice(0, 2).join(', ').toUpperCase() });
      }
      if (credits.engineers?.length) {
        creditsLines.push({ type: 'header', text: 'ENGINEERED BY' });
        creditsLines.push({ type: 'body', text: credits.engineers.slice(0, 2).join(', ').toUpperCase() });
      }
    }

    const releaseYear = getReleaseYear(data.releaseDate);
    const dateWidth = TypographyService.measureWidth(releaseYear, titleFont, 32, { fontWeight: 'bold' });
    const releasedBoxWidth = Math.max(dateWidth, 75);
    const totalLimit = PANEL_HEIGHT - 50;
    const absoluteRightLimit = totalLimit - releasedBoxWidth - 30;
    const equipmentMaxWidth = Math.max(120, absoluteRightLimit - 750);
    const equipmentLines = TypographyService.wrapText(
      recordingData?.equipment || '',
      bodyFont,
      16,
      equipmentMaxWidth
    );

    return (
      <g transform={`translate(${width}, 0) rotate(90)`} fontFamily={monoFont}>
        <g>
          {labelLines.map((line, index) => (
            <text key={`label-${index}`} x="50" y={labelY + (index * lineHeight)} fontSize="32" fontWeight="bold" fill={textColor} letterSpacing="2" dominantBaseline="hanging">
              {line}
            </text>
          ))}
          <g transform={`translate(50, ${sourceY})`}>
            <text x="0" y="0" fontSize="12" fill={dimTextColor} letterSpacing="4">SOURCE</text>
            <text x="0" y="22" fontSize="16" fill={subTextColor} fontWeight="bold" textAnchor="start">{recordingData?.source || ''}</text>
          </g>
        </g>

        <g transform="translate(380, 40)">
          {(() => {
            let cursorY = 0;
            return creditsLines.map((item, index) => {
              if (item.type === 'header') {
                const node = <text key={`credit-header-${index}`} x="0" y={cursorY} fontSize="12" fill={dimTextColor} letterSpacing="4">{item.text}</text>;
                cursorY += 22;
                return node;
              }

              const wrapped = TypographyService.wrapText(item.text, bodyFont, 16, 350);
              const nodes = wrapped.map((line, wrappedIndex) => (
                <text key={`credit-body-${index}-${wrappedIndex}`} x="0" y={cursorY + (wrappedIndex * 20)} fontSize="16" fill={subTextColor} fontFamily={bodyFont}>
                  {line}
                </text>
              ));
              cursorY += wrapped.length * 20 + 28;
              return nodes;
            });
          })()}
        </g>

        <g transform="translate(750, 40)">
          <text x="0" y="0" fontSize="12" fill={dimTextColor} letterSpacing="4">EQUIPMENT</text>
          {equipmentLines.map((line, index) => (
            <text key={`equipment-${index}`} x="0" y={22 + (index * 20)} fontSize="16" fill={subTextColor} fontFamily={bodyFont}>
              {line}
            </text>
          ))}
        </g>

        <g transform={`translate(${PANEL_HEIGHT - 50}, 40)`}>
          <g>
            <text x="0" y="0" fontSize="12" fill={dimTextColor} letterSpacing="4" textAnchor="end">RELEASED</text>
            <text x="0" y="32" fontSize="32" fill={textColor} fontWeight="bold" letterSpacing="1" textAnchor="end">
              {releaseYear}
            </text>
          </g>

          <g transform="translate(0, 96)">
            <text x="0" y="0" fontSize="12" fill={dimTextColor} letterSpacing="4" textAnchor="end">RECORDED</text>
            <text x="0" y="32" fontSize="32" fill={theme.accent} fontWeight="bold" letterSpacing="1" textAnchor="end">
              {recordingData?.recDate || ''}
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

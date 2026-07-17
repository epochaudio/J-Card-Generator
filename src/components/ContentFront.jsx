import React from 'react';

import { JCARD_DIMENSIONS } from '../constants/app.js';
import TypographyService from '../services/TypographyService.js';

const ContentFront = ({ xOffset, width, data, theme, coverImage, coverImageB, frontStyle, isLight, textColor, subTextColor, titleLayout, titleStartY, badgeY, artistY, fontConfig }) => {
  const badgeText = data.coverBadge || "";
  const badgeAlign = data.layout?.coverBadgeAlign === 'left' ? 'left' : 'center';
  // 标语折行参数需与 JCardPreview.jsx 中的 previewLayout 一致
  const BADGE_FONT_SIZE = 20;
  const badgeFont = fontConfig?.fonts?.serif || "Georgia, serif";
  const badgeHorizontalPadding = JCARD_DIMENSIONS.front.badgeHorizontalPadding;
  const badgeMaxWidth = width - (badgeHorizontalPadding * 2);
  const badgeLines = badgeText
    ? TypographyService.wrapText(badgeText, badgeFont, BADGE_FONT_SIZE, badgeMaxWidth, { fontStyle: 'italic', fontWeight: 'bold' })
    : [''];
  const badgeLineHeight = 26;
  const panelHeight = JCARD_DIMENSIONS.height;
  const titleCenterX = 750;
  const badgeLeftX = titleCenterX - (width / 2 - badgeHorizontalPadding);
  const badgeX = badgeAlign === 'left' ? badgeLeftX : titleCenterX;
  const badgeTextAnchor = badgeAlign === 'left' ? 'start' : 'middle';

  if (frontStyle === 'REVERSIBLE') {
    const midPoint = panelHeight / 2;
    const imgSize = JCARD_DIMENSIONS.front.reversibleImageSize;
    const marginY = (midPoint - imgSize) / 2;

    return (
      <g transform={`translate(${xOffset}, 0)`}>
        <rect x="0" y="0" width={width} height={panelHeight} fill="url(#grid)" opacity="0.2" />

        {coverImage && (
          <image href={coverImage} x="-50%" y="-20%" width="200%" height={midPoint + 200} preserveAspectRatio="xMidYMid slice" filter="url(#bg-blur)" opacity="0.4" />
        )}
        {coverImageB && (
          <image href={coverImageB} x="-50%" y={midPoint - 100} width="200%" height={midPoint + 200} preserveAspectRatio="xMidYMid slice" filter="url(#bg-blur)" opacity="0.4" />
        )}

        <line x1="80" y1={midPoint} x2={width - 80} y2={midPoint} stroke={textColor} strokeWidth="1.2" opacity="0.38" />
        <text x={width / 2} y={midPoint - 12} textAnchor="middle" fontSize="14" fill={textColor} opacity="0.78" letterSpacing="3" fontFamily="Arial, sans-serif" fontWeight="bold">SIDE A ▲</text>
        <text x={width / 2} y={midPoint + 20} textAnchor="middle" fontSize="14" fill={textColor} opacity="0.78" letterSpacing="3" fontFamily="Arial, sans-serif" fontWeight="bold">SIDE B ▼</text>

        {coverImage ? (
          <image href={coverImage} x={(width - imgSize) / 2} y={marginY} width={imgSize} height={imgSize} preserveAspectRatio="xMidYMid meet" />
        ) : (
          <path d={`M ${width / 2} ${marginY + 50} Q ${width / 2 - 100} ${marginY + imgSize / 2} ${width / 2} ${marginY + imgSize - 50}`} stroke={theme.accent} strokeWidth="2" fill="none" opacity="0.5" />
        )}

        <g transform={`rotate(180, ${width / 2}, ${midPoint + marginY + imgSize / 2})`}>
          {coverImageB ? (
            <image href={coverImageB} x={(width - imgSize) / 2} y={midPoint + marginY} width={imgSize} height={imgSize} preserveAspectRatio="xMidYMid meet" />
          ) : (
            <g opacity="0.3">
              <rect x={(width - imgSize) / 2} y={midPoint + marginY} width={imgSize} height={imgSize} fill="none" stroke={textColor} strokeWidth="2" strokeDasharray="5,5" />
              <text x={width / 2} y={midPoint + marginY + imgSize / 2} textAnchor="middle" fill={textColor} fontSize="20" dominantBaseline="middle">UPLOAD SIDE B</text>
            </g>
          )}
        </g>
      </g>
    );
  }

  return (
    <g transform={`translate(${xOffset}, 0)`}>
      <rect x="0" y="0" width={width} height={panelHeight} fill="url(#grid)" opacity="0.2" />
      {coverImage ? (
        <>
          <svg x="0" y="0" width={width} height={width} viewBox={`0 0 ${JCARD_DIMENSIONS.front.standardCoverViewBox} ${JCARD_DIMENSIONS.front.standardCoverViewBox}`} preserveAspectRatio="xMidYMid slice">
            <image href={coverImage} width={JCARD_DIMENSIONS.front.standardCoverViewBox} height={JCARD_DIMENSIONS.front.standardCoverViewBox} preserveAspectRatio="xMidYMid slice" filter="url(#bg-blur)" transform="scale(1.1)" transform-origin="center" />
            <image href={coverImage} width={JCARD_DIMENSIONS.front.standardCoverViewBox} height={JCARD_DIMENSIONS.front.standardCoverViewBox} preserveAspectRatio="xMidYMid meet" transform="scale(1)" transform-origin="center" />
          </svg>
        </>
      ) : (
        <path d={`M ${width / 2 - 200} 400 Q ${width / 2} 100 ${width / 2 + 200} 400`} stroke={theme.accent} strokeWidth="4" fill="none" opacity="0.8" />
      )}
      <g transform={`translate(${width / 2 - 750}, 0)`}>
        {titleLayout.lines.map((line, index) => (
          <text key={index} x="750" y={titleStartY + (index * titleLayout.lineHeight)} fontFamily={fontConfig?.fonts?.title || "Arial Black, sans-serif"} fontSize={titleLayout.fontSize} fill={textColor} textAnchor="middle" letterSpacing="-1" style={{ textShadow: isLight ? "none" : "0 4px 12px rgba(0,0,0,0.5)" }}>
            {line}
          </text>
        ))}

        {badgeText && (
          <g>
            {badgeLines.map((line, i) => (
              <text
                key={i}
                x={badgeX}
                y={badgeY + (i * badgeLineHeight)}
                fontFamily={fontConfig?.fonts?.serif || "Georgia, serif"}
                fontStyle="italic"
                fontWeight="bold"
                fontSize="20"
                fill={textColor}
                textAnchor={badgeTextAnchor}
                letterSpacing="0.5"
                style={{
                  textShadow: isLight ? "0 0 10px rgba(255,255,255,0.8)" : "0 0 10px rgba(0,0,0,0.8)",
                  opacity: 0.9
                }}
              >
                {line}
              </text>
            ))}
          </g>
        )}

        <text x="750" y={artistY} fontFamily={fontConfig?.fonts?.body || "Arial, sans-serif"} fontSize="32" fontWeight="bold" fill={subTextColor} textAnchor="middle" letterSpacing="6" style={{ textShadow: isLight ? "none" : "0 2px 4px rgba(0,0,0,0.8)" }}>
          {data.artist}{theme.mood_description ? ` · ${theme.mood_description}` : ""}
        </text>
      </g>
    </g>
  );
};

export default ContentFront;

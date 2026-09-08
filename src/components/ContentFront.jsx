import React from 'react';
import { splitWrappedLine } from '../utils/splitWrappedLine.mjs';

import { JCARD_DIMENSIONS } from '../constants/app.js';

const ContentFront = ({ resourceId, xOffset, width, data, theme, coverImage, coverImageB, frontStyle, textColor, subTextColor, frontLayout }) => {
  const colors = theme.panelColors;
  const blockText = (block, index) => {
    const line = block.lines[index];
    if (!theme.exactColors || block.role !== 'artist' || !theme.mood_description) return line;
    const [artist, subtitle] = splitWrappedLine(block.text, block.lines, index, String(data.artist || '').length);
    return <>{artist}<tspan data-color-role="front.subtitle" fill={colors.subtitle}>{subtitle}</tspan></>;
  };
  const panelHeight = JCARD_DIMENSIONS.height;

  if (frontStyle === 'REVERSIBLE') {
    const midPoint = panelHeight / 2;
    const imgSize = JCARD_DIMENSIONS.front.reversibleImageSize;
    const marginY = (midPoint - imgSize) / 2;

    return (
      <g transform={`translate(${xOffset}, 0)`}>
        <rect x="0" y="0" width={width} height={panelHeight} fill={`url(#${resourceId('grid')})`} opacity="0.2" />

        {coverImage && (
          <image href={coverImage} x="-50%" y="-20%" width="200%" height={midPoint + 200} preserveAspectRatio="xMidYMid slice" filter={`url(#${resourceId('bg-blur')})`} opacity="0.4" />
        )}
        {coverImageB && (
          <image href={coverImageB} x="-50%" y={midPoint - 100} width="200%" height={midPoint + 200} preserveAspectRatio="xMidYMid slice" filter={`url(#${resourceId('bg-blur')})`} opacity="0.4" />
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

  const { image, blocks, x, anchor, margin } = frontLayout;
  return (
    <g transform={`translate(${xOffset}, 0)`} data-panel="front" data-overflow={frontLayout.overflow}>
      {coverImage ? <image href={coverImage} x={image.x} y={image.y} width={image.size} height={image.size} preserveAspectRatio="xMidYMid meet" /> : (
        <g fill="none" stroke={theme.accent} opacity="0.5">
          <circle cx={width / 2} cy={image.y + image.size / 2} r={image.size * 0.18} strokeWidth="2" />
          <circle cx={width / 2} cy={image.y + image.size / 2} r={image.size * 0.025} strokeWidth="2" />
        </g>
      )}
      {theme.exactColors && <rect data-color-role="front.border" x={image.x} y={image.y} width={image.size} height={image.size} fill="none" stroke={colors.border} />}
      {blocks.map(block => {
        const badgeLeft = block.role === 'badge' && data.layout?.coverBadgeAlign === 'left';
        return <g key={block.role} data-front-role={block.role}>
          {theme.exactColors && block.role === 'badge' && <rect data-color-role="front.badgeBackground" x={margin} y={block.y - block.ascent} width={width - margin * 2} height={block.lines.length * block.lineHeight} fill={colors.badgeBackground} />}
          {block.lines.map((line, index) => <text key={index} x={badgeLeft ? margin : x} y={block.y + index * block.lineHeight}
            textAnchor={badgeLeft ? 'start' : anchor} fontFamily={block.font} fontWeight={block.weight} fontSize={block.size}
            letterSpacing={block.tracking} data-color-role={`front.${block.role}`} fill={colors?.[block.role] || (block.role === 'title' ? textColor : subTextColor)}>{blockText(block, index)}</text>)}
        </g>;
      })}
    </g>
  );
};

export default ContentFront;

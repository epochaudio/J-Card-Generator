import { StyledText, StyledSpan } from './StyledText.jsx';
import { typographyFont, fontFamilyName } from '../config/textStyles.mjs';
import React, { useMemo } from 'react';
import SpineLayoutEngine from '../utils/SpineLayoutEngine.js';

const SpineContent = ({ data, height, panelWidth, fontConfig, themeColors, exactColors, inverted }) => {
  const metadataFont = typographyFont(fontConfig, 'metadata', 'body');
  const artistFont = typographyFont(fontConfig, 'artist');
  const titleColor = themeColors.title || themeColors.titleColor;
  const idColor = themeColors.id || themeColors.idColor;
  const itemColor = item => (exactColors && themeColors[item.role === 'tapeId' ? 'id' : item.role === 'artist' ? 'artist' : 'note']) || (item.fillRole === 'id' ? idColor : titleColor);

  const isInverted = inverted !== undefined ? inverted : true;
  const rotation = isInverted ? 90 : -90;

  const getX = (physicalOffsetFromCenter) => (
    isInverted ? physicalOffsetFromCenter : -physicalOffsetFromCenter
  );

  const getAnchor = (type) => {
    if (isInverted) return type;
    return type === 'start' ? 'end' : 'start';
  };

  const spineLayout = useMemo(
    () => SpineLayoutEngine.compute({
      data,
      height,
      panelWidth,
      fontConfig,
    }),
    [data, height, panelWidth, fontConfig]
  );

  return (
    <g>
      {spineLayout.title.lines.map((line, index) => (
        <StyledText
          key={`sp-title-${line}-${index}`}
          x={getX(spineLayout.title.centerX)}
          y={spineLayout.title.crossOffsets[index] || 0}
          fontFamily={spineLayout.titleFont}
          fontWeight="bold"
          fontSize={spineLayout.title.fontSize}
          data-color-role="spine.title" fill={titleColor}
          textAnchor="middle"
          dominantBaseline="middle"
          transform={`rotate(${rotation})`}
        >
          {line}
        </StyledText>
      ))}

      {spineLayout.topItems.map((item) => (
        <StyledText
          key={`sp-top-${item.role}`}
          x={getX(item.physicalOffset)}
          y={item.crossOffset}
          fontFamily={item.role === 'artist' ? artistFont : metadataFont}
          fontSize={item.fontSize}
          fontWeight={item.fontOptions.fontWeight}
          data-color-role={`spine.${item.role}`} fill={itemColor(item)}
          textAnchor={getAnchor('start')}
          dominantBaseline="middle"
          transform={`rotate(${rotation})`}
          letterSpacing={item.fontOptions.letterSpacing}
          opacity={exactColors ? 1 : item.opacity}
        >
          {item.text}
        </StyledText>
      ))}

      {spineLayout.bottomItems.map((item) => (
        <StyledText
          key={`sp-bottom-${item.role}`}
          x={getX(item.physicalOffset)}
          y={item.crossOffset}
          fontFamily={item.role === 'artist' ? artistFont : metadataFont}
          fontSize={item.fontSize}
          fontWeight={item.fontOptions.fontWeight}
          data-color-role={`spine.${item.role}`} fill={itemColor(item)}
          textAnchor={getAnchor('end')}
          dominantBaseline="middle"
          transform={`rotate(${rotation})`}
          letterSpacing={item.fontOptions.letterSpacing}
          opacity={exactColors ? 1 : item.opacity}
        >
          {item.text}
        </StyledText>
      ))}
    </g>
  );
};

export default SpineContent;

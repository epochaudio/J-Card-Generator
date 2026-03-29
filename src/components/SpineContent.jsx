import React, { useMemo } from 'react';
import SpineLayoutEngine from '../utils/SpineLayoutEngine.js';

const SpineContent = ({ data, height, panelWidth, fontConfig, themeColors, inverted }) => {
  const { titleColor, idColor } = themeColors;

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
        <text
          key={`sp-title-${line}-${index}`}
          x={getX(spineLayout.title.centerX)}
          y={spineLayout.title.crossOffsets[index] || 0}
          fontFamily={spineLayout.titleFont}
          fontWeight="bold"
          fontSize={spineLayout.title.fontSize}
          fill={titleColor}
          textAnchor="middle"
          dominantBaseline="middle"
          transform={`rotate(${rotation})`}
        >
          {line}
        </text>
      ))}

      {spineLayout.topItems.map((item) => (
        <text
          key={`sp-top-${item.role}`}
          x={getX(item.physicalOffset)}
          y={item.crossOffset}
          fontFamily={spineLayout.bodyFont}
          fontSize={item.fontSize}
          fontWeight={item.fontOptions.fontWeight}
          fill={item.fillRole === 'id' ? idColor : titleColor}
          textAnchor={getAnchor('start')}
          dominantBaseline="middle"
          transform={`rotate(${rotation})`}
          letterSpacing={item.fontOptions.letterSpacing}
          opacity={item.opacity}
        >
          {item.text}
        </text>
      ))}

      {spineLayout.bottomItems.map((item) => (
        <text
          key={`sp-bottom-${item.role}`}
          x={getX(item.physicalOffset)}
          y={item.crossOffset}
          fontFamily={spineLayout.bodyFont}
          fontSize={item.fontSize}
          fontWeight={item.fontOptions.fontWeight}
          fill={item.fillRole === 'id' ? idColor : titleColor}
          textAnchor={getAnchor('end')}
          dominantBaseline="middle"
          transform={`rotate(${rotation})`}
          letterSpacing={item.fontOptions.letterSpacing}
          opacity={item.opacity}
        >
          {item.text}
        </text>
      ))}
    </g>
  );
};

export default SpineContent;

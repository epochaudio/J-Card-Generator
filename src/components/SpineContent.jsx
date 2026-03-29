import React, { useMemo } from 'react';
import TypographyService from '../services/TypographyService.js';

const SpineContent = ({ data, height, fontConfig, themeColors, inverted }) => {
  const { title, artist, tapeId, layout } = data;
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

  const formatText = (text) => layout?.forceCaps ? String(text).toUpperCase() : String(text);

  // 脊部布局常量（像素值基于 JCARD_DIMENSIONS.height = 1181）
  const topMargin = 40;
  const bottomMargin = 40;
  const safeGap = 80;      // ID/note 与标题之间的安全间隙
  const halfH = height / 2;
  const topEdgePos = -halfH + topMargin;
  const bottomEdgePos = halfH - bottomMargin;

  /**
   * 用 Pretext 精确计算脊部标题字号
   *
   * 为什么可用宽度 = height - margins - 安全间歇？
   * 脊部文字旋转了 90°，所以 SVG 的 y 维度对应的是文字的"水平"方向。
   * 这里不再用硬编码的间隙，而是实时测量首尾元数据占用的真实物理长度。
   */
  const spineTitleSize = useMemo(() => {
    const titleFont = fontConfig?.fonts?.title || "Arial, sans-serif";
    const bodyFont = fontConfig?.fonts?.body || "Arial, sans-serif";

    // --- 动态测量顶部元数据的物理长度 ---
    const tapeIdW = tapeId ? TypographyService.measureWidth(tapeId, bodyFont, 18, { fontWeight: 'bold' }) : 0;
    const noteUpW = layout?.noteUpper ? TypographyService.measureWidth(formatText(layout.noteUpper), bodyFont, 14) * 1.05 : 0; // *1.05 粗略补偿 letter-spacing
    const topBlockLen = Math.max(tapeIdW, noteUpW);

    // --- 动态测量底部元数据的物理长度 ---
    const artistW = artist ? TypographyService.measureWidth(formatText(artist), bodyFont, 24) : 0;
    const noteLowW = layout?.noteLower ? TypographyService.measureWidth(formatText(layout.noteLower), bodyFont, 14) * 1.05 : 0;
    const bottomBlockLen = layout?.noteLower ? Math.max(noteLowW, safeGap + artistW) : artistW;

    // 绝对安全可用长度 = 总高 - 两端外边距 - 首尾区块占用长度 - 标题与前后的呼吸间隙(60px)
    const paddingAroundTitle = 60;
    const availableLength = height - topMargin - bottomMargin - topBlockLen - bottomBlockLen - paddingAroundTitle;

    const MIN_SPINE_FONT = 32;
    const MAX_SPINE_FONT = 84;

    return TypographyService.fitFontSize(
      formatText(title),
      titleFont,
      availableLength,
      MIN_SPINE_FONT,
      MAX_SPINE_FONT,
      { fontWeight: 'bold' }
    );
  }, [title, height, fontConfig, layout?.forceCaps]);

  return (
    <g>
      <text
        x="0"
        y="0"
        fontFamily={fontConfig?.fonts?.title || "Arial, sans-serif"}
        fontWeight="bold"
        fontSize={spineTitleSize}
        fill={titleColor}
        textAnchor="middle"
        dominantBaseline="middle"
        transform={`rotate(${rotation})`}
      >
        {formatText(title)}
      </text>

      {(() => {
        const hasNote = !!layout?.noteUpper;
        const hasId = !!tapeId;
        const anchor = getAnchor('start');
        const xPos = getX(topEdgePos);

        const noteUpperNode = hasNote ? (
          <text
            key="sp-note-up"
            x={xPos}
            y={hasId ? -12 : 0}
            fontFamily={fontConfig?.fonts?.body || "Arial, sans-serif"}
            fontSize="14"
            fill={idColor}
            textAnchor={anchor}
            dominantBaseline="middle"
            transform={`rotate(${rotation})`}
            letterSpacing="1"
            opacity="0.8"
          >
            {formatText(layout.noteUpper)}
          </text>
        ) : null;

        const idNode = hasId ? (
          <text
            key="sp-id"
            x={xPos}
            y={hasNote ? 12 : 0}
            fontFamily={fontConfig?.fonts?.body || "Arial, sans-serif"}
            fontWeight="bold"
            fontSize="18"
            fill={idColor}
            textAnchor={anchor}
            dominantBaseline="middle"
            transform={`rotate(${rotation})`}
          >
            {tapeId}
          </text>
        ) : null;

        return <>{noteUpperNode}{idNode}</>;
      })()}

      {(() => {
        const anchor = getAnchor('end');
        const xPos = getX(bottomEdgePos);
        const inwardDir = isInverted ? -1 : 1;
        let currentX = xPos;
        const nodes = [];

        if (layout?.noteLower) {
          nodes.push(
            <text
              key="sp-note-low"
              x={currentX}
              y="0"
              fontFamily={fontConfig?.fonts?.body || "Arial, sans-serif"}
              fontSize="14"
              fill={titleColor}
              textAnchor={anchor}
              dominantBaseline="middle"
              transform={`rotate(${rotation})`}
              letterSpacing="1"
              opacity="0.8"
            >
              {formatText(layout.noteLower)}
            </text>
          );
          currentX += safeGap * inwardDir;
        }

        nodes.push(
          <text
            key="sp-artist"
            x={currentX}
            y="0"
            fontFamily={fontConfig?.fonts?.body || "Arial, sans-serif"}
            fontSize="24"
            fill={titleColor}
            textAnchor={anchor}
            dominantBaseline="middle"
            transform={`rotate(${rotation})`}
          >
            {formatText(artist)}
          </text>
        );

        return nodes;
      })()}
    </g>
  );
};

export default SpineContent;

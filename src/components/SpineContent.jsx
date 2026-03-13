import React from 'react';

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

  const getSpineTitleSize = (text) => {
    const len = text ? text.length : 0;
    if (len > 30) return 32;
    if (len > 20) return 36;
    return 42;
  };

  const topMargin = 40;
  const bottomMargin = 40;
  const safeGap = 80;
  const halfH = height / 2;
  const topEdgePos = -halfH + topMargin;
  const bottomEdgePos = halfH - bottomMargin;

  return (
    <g>
      <text
        x="0"
        y="0"
        fontFamily={fontConfig?.fonts?.title || "Arial, sans-serif"}
        fontWeight="bold"
        fontSize={getSpineTitleSize(title)}
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

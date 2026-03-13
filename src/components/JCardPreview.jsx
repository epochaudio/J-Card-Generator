import React, { useMemo } from 'react';

import ContentBack from './ContentBack.jsx';
import ContentFront from './ContentFront.jsx';
import SpineContent from './SpineContent.jsx';
import { JCARD_DIMENSIONS } from '../constants/app.js';
import TextUtils from '../utils/TextUtils.js';

const JCardPreview = ({ data, theme, coverImage, coverImageB, svgRef, recordingData, jCardThemeMode, dominantColor, contrastTextType, fontConfig }) => {
  const curThemeMode = jCardThemeMode || 'dark';
  const curDominantColor = dominantColor || '#232629';
  const curContrastType = contrastTextType || 'light';

  const { title } = data;
  const width = JCARD_DIMENSIONS.width;
  const height = JCARD_DIMENSIONS.height;

  let bgFill = "#232629";
  let textColor = "#eff0f1";
  let subTextColor = "#b0b3b8";
  let dimTextColor = "#7d8187";
  let spineFill = theme.accent;
  let spineTitleColor = "#ffffff";
  let spineIdColor = "rgba(255,255,255,0.9)";
  let coverMaskColor = "#000000";
  let coverMaskOpacity = 0.4;

  const isMinimalSpine = !!data.layout?.minimalSpine;
  const isLightModeLogic = (curThemeMode === 'light') ||
    (curThemeMode === 'color' && curContrastType === 'dark') ||
    (curThemeMode === 'cover' && curContrastType === 'dark');

  if (curThemeMode === 'cover') {
    if (curContrastType === 'dark') {
      textColor = "#1a1a1a";
      subTextColor = "#4a4a4a";
      dimTextColor = "#666666";
      coverMaskColor = "#ffffff";
      coverMaskOpacity = 0.6;
    } else {
      textColor = "#ffffff";
      subTextColor = "rgba(255,255,255,0.9)";
      dimTextColor = "rgba(255,255,255,0.7)";
      coverMaskColor = "#000000";
      coverMaskOpacity = 0.4;
    }
  } else if (curThemeMode === 'light') {
    bgFill = "#ffffff";
    textColor = "#1a1a1a";
    subTextColor = "#4a4a4a";
    dimTextColor = "#666666";
    spineTitleColor = "#1a1a1a";
    spineIdColor = theme.accent;
  } else if (curThemeMode === 'color') {
    bgFill = curDominantColor;
    if (curContrastType === 'dark') {
      textColor = "#1a1a1a";
      subTextColor = "#4a4a4a";
      dimTextColor = "#666666";
      spineTitleColor = "#1a1a1a";
      spineIdColor = theme.accent;
    } else {
      textColor = "#ffffff";
      subTextColor = "#e0e0e0";
      dimTextColor = "#888888";
    }
  }

  const isLight = isLightModeLogic;

  if (isMinimalSpine) {
    spineFill = isLight ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)";
    spineTitleColor = textColor;
    spineIdColor = theme.accent;
  }

  const titleLayout = useMemo(() => {
    if (!title) return { lines: [], fontSize: 64, lineHeight: 72, totalHeight: 0 };
    const words = title.split(/\s+/);
    const charCount = title.length;
    let fontSize = 72;
    let lineHeight = 80;
    let maxCharsPerLine = 12;

    if (charCount > 40) {
      fontSize = 42;
      lineHeight = 48;
      maxCharsPerLine = 24;
    } else if (charCount > 20) {
      fontSize = 56;
      lineHeight = 64;
      maxCharsPerLine = 16;
    }

    const lines = [];
    let currentLine = [];
    let currentLineLength = 0;
    words.forEach(word => {
      if (currentLineLength + word.length + (currentLine.length > 0 ? 1 : 0) > maxCharsPerLine) {
        if (currentLine.length > 0) {
          lines.push(currentLine.join(" "));
          currentLine = [];
          currentLineLength = 0;
        }
      }
      currentLine.push(word);
      currentLineLength += word.length + 1;
    });
    if (currentLine.length > 0) lines.push(currentLine.join(" "));

    return { lines: lines.slice(0, 4), fontSize, lineHeight, totalHeight: lines.length * lineHeight };
  }, [title]);

  const previewLayout = useMemo(() => {
    const imgBottom = JCARD_DIMENSIONS.front.previewImageBottom;
    const fixedArtistY = JCARD_DIMENSIONS.front.artistBaseline;
    const titleLineH = titleLayout.lineHeight;
    const titleTotalH = titleLayout.lines.length * titleLineH;
    const badgeTextStr = data.coverBadge || "";
    const badgeLines = TextUtils.getWrappedLines(badgeTextStr, 42);
    const badgeLineH = 26;
    const badgeTotalH = badgeLines.length > 0 ? badgeLines.length * badgeLineH : 0;
    const gapTitleToSlogan = 32;

    let totalContentBlockH = titleTotalH;
    if (badgeTotalH > 0) {
      totalContentBlockH += gapTitleToSlogan + badgeTotalH;
    }

    const availableZoneCenterY = imgBottom + (fixedArtistY - imgBottom) / 2;
    const blockTopY = availableZoneCenterY - (totalContentBlockH / 2);
    const titleStartY = blockTopY + (titleLineH * 0.8);
    const badgeBlockTopY = blockTopY + titleTotalH + gapTitleToSlogan;
    const badgeY = badgeBlockTopY + (badgeLineH * 0.8);
    let artistY = fixedArtistY;
    const contentBottomY = badgeBlockTopY + badgeTotalH;
    if (contentBottomY > artistY - 20) {
      artistY = contentBottomY + 30;
    }

    return {
      titleStartY,
      badgeY,
      artistY
    };
  }, [data.coverBadge, titleLayout]);

  const { titleStartY, badgeY, artistY } = previewLayout;

  const wShort = JCARD_DIMENSIONS.panels.shortBack;
  const wSpine = JCARD_DIMENSIONS.panels.spine;
  const wFront = JCARD_DIMENSIONS.panels.front;
  const wBack = JCARD_DIMENSIONS.panels.back;
  const xShort = 0;
  const xSpine = 200;
  const xFront = 350;
  const xBack = 1130;

  return (
    <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" viewBox={`0 0 ${width} ${height}`} className="w-full h-auto shadow-2xl rounded-sm transition-all duration-500" style={{ aspectRatio: `${width}/${height}` }}>
      <defs>
        <filter id="noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.15 0" />
        </filter>
        <filter id="bg-blur">
          <feGaussianBlur in="SourceGraphic" stdDeviation={30} />
          <feColorMatrix type="saturate" values={isLight ? "1.5" : "1.2"} />
          {isLight && <feComponentTransfer>
            <feFuncR type="linear" slope="1.2" intercept="0.1" />
            <feFuncG type="linear" slope="1.2" intercept="0.1" />
            <feFuncB type="linear" slope="1.2" intercept="0.1" />
          </feComponentTransfer>}
        </filter>
        <clipPath id="panel-short-back"><rect x="0" y="0" width={wShort} height={height} /></clipPath>
        <clipPath id="panel-spine"><rect x={xSpine} y="0" width={wSpine} height={height} /></clipPath>
        <clipPath id="panel-front"><rect x={xFront} y="0" width={wFront} height={height} /></clipPath>
        <clipPath id="panel-flap"><rect x="0" y="0" width={wBack} height={height} /></clipPath>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke={isLight ? "#000" : "#333"} strokeWidth="1" opacity="0.1" />
        </pattern>
      </defs>

      {curThemeMode === 'cover' && coverImage ? (
        <>
          <image href={coverImage} x="-10%" y="-10%" width="120%" height="120%" preserveAspectRatio="xMidYMid slice" filter="url(#bg-blur)" />
          <rect x="0" y="0" width={width} height={height} fill={coverMaskColor} opacity={coverMaskOpacity} />
        </>
      ) : (
        <rect x="0" y="0" width={width} height={height} fill={bgFill} />
      )}
      <rect x="0" y="0" width={width} height={height} fill="transparent" filter="url(#noise)" opacity={isLight ? 0.2 : 0.4} />

      <rect x={xShort} y="0" width={wShort} height={height} fill="#000000" opacity="0.2" style={{ mixBlendMode: 'multiply' }} />
      <rect x={xSpine} y="0" width={wSpine} height={height} fill="#000000" opacity="0.3" style={{ mixBlendMode: 'multiply' }} />
      <rect x={xSpine} y="0" width={wSpine} height={height} fill={spineFill} opacity={coverImage && !isMinimalSpine ? 0.8 : 1} style={{ mixBlendMode: isMinimalSpine ? 'normal' : 'multiply' }} />
      <rect x={xBack} y="0" width={wBack} height={height} fill="#000000" opacity="0.2" style={{ mixBlendMode: 'multiply' }} />

      <line x1={xSpine} y1="0" x2={xSpine} y2={height} stroke={textColor} strokeWidth="2" strokeDasharray="4,4" opacity="0.2" />
      <line x1={xFront} y1="0" x2={xFront} y2={height} stroke={textColor} strokeWidth="2" strokeDasharray="4,4" opacity="0.2" />
      <line x1={xBack} y1="0" x2={xBack} y2={height} stroke={textColor} strokeWidth="2" strokeDasharray="4,4" opacity="0.3" />

      <g clipPath="url(#panel-short-back)">
        <ContentBack width={wShort} data={data} theme={theme} isCompact={true} isLight={isLight} textColor={textColor} subTextColor={subTextColor} dimTextColor={dimTextColor} recordingData={recordingData} />
      </g>

      <g transform={`translate(${xSpine + wSpine / 2}, ${height / 2})`}>
        <SpineContent
          data={data}
          height={height}
          fontConfig={fontConfig}
          themeColors={{ titleColor: spineTitleColor, idColor: spineIdColor }}
          inverted={!!data.layout?.spineInverted}
        />
      </g>

      <g clipPath="url(#panel-front)">
        <ContentFront xOffset={xFront} width={wFront} data={data} theme={theme} coverImage={coverImage} coverImageB={coverImageB} frontStyle={data.layout?.frontStyle || 'STANDARD'} isLight={isLight} textColor={textColor} subTextColor={subTextColor} titleLayout={titleLayout} titleStartY={titleStartY} badgeY={badgeY} artistY={artistY} fontConfig={fontConfig} />
      </g>

      <g clipPath="url(#panel-flap)" transform={`translate(${xBack}, 0)`}>
        <ContentBack width={wBack} data={data} theme={theme} isLight={isLight} textColor={textColor} subTextColor={subTextColor} dimTextColor={dimTextColor} recordingData={recordingData} fontConfig={fontConfig} />
      </g>
    </svg>
  );
};

export default JCardPreview;

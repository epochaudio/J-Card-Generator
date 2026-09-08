import React, { useMemo, useId } from 'react';

import ContentBack from './ContentBack.jsx';
import ContentFront from './ContentFront.jsx';
import ShortBackContent from './ShortBackContent.jsx';
import SpineContent from './SpineContent.jsx';
import { JCARD_DIMENSIONS } from '../constants/app.js';
import { resolvePalette, contrastInk, readableAccent } from '../config/design.mjs';
import { computeFrontLayout } from '../utils/FrontLayout.js';

const JCardPreview = ({ data, theme, coverImage, coverImageB, svgRef, recordingData, jCardThemeMode, dominantColor, fontConfig, onBackStatus }) => {
  const resourcePrefix = `jcard-${useId().replace(/:/g, '')}`;
  const resourceId = name => `${resourcePrefix}-${name}`;
  const palette = resolvePalette(theme, jCardThemeMode, dominantColor);
  const curThemeMode = theme.paletteId && theme.paletteId !== 'legacy' ? 'palette' : jCardThemeMode || 'dark';
  const width = JCARD_DIMENSIONS.width;
  const height = JCARD_DIMENSIONS.height;
  const bgFill = palette.background;
  const isLight = contrastInk(bgFill) !== '#ffffff';
  // A strong neutral mask makes local image brightness less disruptive.
  const coverMaskColor = '#000000';
  const coverMaskOpacity = 0.86;
  const textColor = curThemeMode === 'cover' ? '#ffffff' : palette.text;
  const subTextColor = curThemeMode === 'cover' ? '#e5e5e5' : palette.secondary;
  const dimTextColor = curThemeMode === 'cover' ? '#c9c9c9' : palette.muted;
  const isMinimalSpine = !!data.layout?.minimalSpine;
  const spineFill = isMinimalSpine ? bgFill : palette.accent;
  const spineTitleColor = isMinimalSpine ? textColor : contrastInk(spineFill);
  const spineIdColor = isMinimalSpine ? readableAccent(theme.accent, spineFill) : spineTitleColor;
  const effectiveTheme = { ...theme, accent: readableAccent(theme.accent, curThemeMode === 'cover' ? '#232629' : bgFill), divider: palette.divider };
  const frontLayout = useMemo(() => computeFrontLayout(data, fontConfig, theme), [data, fontConfig, theme]);

  const wShort = JCARD_DIMENSIONS.panels.shortBack;
  const wSpine = JCARD_DIMENSIONS.panels.spine;
  const wFront = JCARD_DIMENSIONS.panels.front;
  const wBack = JCARD_DIMENSIONS.panels.back;
  const xSpine = 200;
  const xFront = 350;
  const xBack = 1130;

  return (
    <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" viewBox={`0 0 ${width} ${height}`} className="w-full h-auto shadow-2xl rounded-sm transition-all duration-500" style={{ aspectRatio: `${width}/${height}` }}>
      <defs>
        <filter id={resourceId('noise')}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.15 0" />
        </filter>
        <filter id={resourceId('bg-blur')}>
          <feGaussianBlur in="SourceGraphic" stdDeviation={30} />
          <feColorMatrix type="saturate" values={isLight ? "1.5" : "1.2"} />
          {isLight && <feComponentTransfer>
            <feFuncR type="linear" slope="1.2" intercept="0.1" />
            <feFuncG type="linear" slope="1.2" intercept="0.1" />
            <feFuncB type="linear" slope="1.2" intercept="0.1" />
          </feComponentTransfer>}
        </filter>
        <clipPath id={resourceId('panel-short-back')}><rect x="0" y="0" width={wShort} height={height} /></clipPath>
        <clipPath id={resourceId('panel-spine')}><rect x={xSpine} y="0" width={wSpine} height={height} /></clipPath>
        <clipPath id={resourceId('panel-front')}><rect x={xFront} y="0" width={wFront} height={height} /></clipPath>
        <clipPath id={resourceId('panel-flap')}><rect x="0" y="0" width={wBack} height={height} /></clipPath>
        <pattern id={resourceId('grid')} width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke={isLight ? "#000" : "#333"} strokeWidth="1" opacity="0.1" />
        </pattern>
      </defs>

      {curThemeMode === 'cover' && coverImage ? (
        <>
          <image href={coverImage} x="-10%" y="-10%" width="120%" height="120%" preserveAspectRatio="xMidYMid slice" filter={`url(#${resourceId('bg-blur')})`} />
          <rect x="0" y="0" width={width} height={height} fill={coverMaskColor} opacity={coverMaskOpacity} />
        </>
      ) : (
        <rect x="0" y="0" width={width} height={height} fill={bgFill} />
      )}
      {data.layout?.texture && <rect x="0" y="0" width={width} height={height} fill="transparent" filter={`url(#${resourceId('noise')})`} opacity="0.12" />}

      <rect x={xSpine} y="0" width={wSpine} height={height} fill={spineFill}  />

      <line x1={xSpine} y1="0" x2={xSpine} y2={height} stroke={textColor} strokeWidth="2" strokeDasharray="4,4" opacity="0.2" />
      <line x1={xFront} y1="0" x2={xFront} y2={height} stroke={textColor} strokeWidth="2" strokeDasharray="4,4" opacity="0.2" />
      <line x1={xBack} y1="0" x2={xBack} y2={height} stroke={textColor} strokeWidth="2" strokeDasharray="4,4" opacity="0.3" />

      <g clipPath={`url(#${resourceId('panel-short-back')})`}>
        <ShortBackContent width={wShort} data={data} theme={effectiveTheme} isLight={isLight} textColor={textColor} subTextColor={subTextColor} dimTextColor={dimTextColor} recordingData={recordingData} fontConfig={fontConfig} />
      </g>

      <g clipPath={`url(#${resourceId('panel-spine')})`}>
        <g transform={`translate(${xSpine + wSpine / 2}, ${height / 2})`}>
          <SpineContent
            data={data}
            height={height}
            panelWidth={wSpine}
            fontConfig={fontConfig}
            themeColors={{ titleColor: spineTitleColor, idColor: spineIdColor }}
            inverted={!!data.layout?.spineInverted}
          />
        </g>
      </g>

      <g clipPath={`url(#${resourceId('panel-front')})`}>
        <ContentFront resourceId={resourceId} xOffset={xFront} width={wFront} data={data} theme={effectiveTheme} coverImage={coverImage} coverImageB={coverImageB} frontStyle={data.layout?.frontStyle || 'STANDARD'} textColor={textColor} subTextColor={subTextColor} frontLayout={frontLayout} />
      </g>

      <g clipPath={`url(#${resourceId('panel-flap')})`} transform={`translate(${xBack}, 0)`}>
        <ContentBack onLayoutStatus={onBackStatus} width={wBack} data={data} theme={effectiveTheme} isLight={isLight} textColor={textColor} subTextColor={subTextColor} dimTextColor={dimTextColor} recordingData={recordingData} fontConfig={fontConfig} />
      </g>
    </svg>
  );
};

export default JCardPreview;

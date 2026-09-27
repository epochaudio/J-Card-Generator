import { applyTextTransforms, checkTextTransforms } from '../services/TextTransform.js';
import React, { useMemo, useId, useRef, useLayoutEffect, useState } from 'react';

import ContentBack from './ContentBack.jsx';
import ContentFront from './ContentFront.jsx';
import ShortBackContent from './ShortBackContent.jsx';
import SpineContent from './SpineContent.jsx';
import { getJCardDimensions } from '../constants/app.js';
import { resolvePanelColors, contrastInk, PAPER_TEXTURE, COVER_BACKGROUND, normalizeCoverStrength } from '../config/design.mjs';
import { computeFrontLayout } from '../utils/FrontLayout.js';

const JCardPreview = ({ data, theme, coverImage, coverImageB, svgRef, recordingData, jCardThemeMode, dominantColor, fontConfig: baseFontConfig, onBackStatus }) => {
  const fontConfig = useMemo(() => ({ ...baseFontConfig, typography: theme.typography || baseFontConfig.typography }), [baseFontConfig, theme.typography]);
  const localSvg = useRef(null);
  const [typographyError, setTypographyError] = useState('');
  useLayoutEffect(() => {
    let active = true;
    const update = () => {
      if (!active || !localSvg.current) return;
      applyTextTransforms(localSvg.current);
      setTypographyError(checkTextTransforms(localSvg.current).join('；'));
    };
    update();
    void document.fonts.ready.then(update);
    return () => { active = false; };
  });
  const resourcePrefix = `jcard-${useId().replace(/:/g, '')}`;
  const resourceId = name => `${resourcePrefix}-${name}`;
  const colors = resolvePanelColors(theme, jCardThemeMode, dominantColor, !!data.layout?.minimalSpine);
  const customColors = theme.paletteId === 'custom';
  const curThemeMode = theme.paletteId && theme.paletteId !== 'legacy' ? 'palette' : jCardThemeMode || 'dark';
  const dimensions = getJCardDimensions(data.layout);
  const width = dimensions.width;
  const height = dimensions.height;
  const bgFill = colors.front.background;
  const isLight = contrastInk(bgFill) !== '#ffffff';
  const coverStrength = normalizeCoverStrength(theme.coverBackgroundStrength);
  const textColor = colors.front.title;
  const panelTheme = panel => ({ ...theme, accent: colors[panel].accent, divider: colors[panel].divider, panelColors: customColors ? colors[panel] : undefined, exactColors: customColors });
  const frontLayout = useMemo(() => computeFrontLayout(data, fontConfig, theme), [data, fontConfig, theme]);

  const wShort = dimensions.panels.shortBack;
  const wSpine = dimensions.panels.spine;
  const wFront = dimensions.panels.front;
  const wBack = dimensions.panels.back;
  const xSpine = wShort;
  const xFront = xSpine + wSpine;
  const xBack = xFront + wFront;

  return (
    <><svg ref={node => { localSvg.current = node; if (svgRef) svgRef.current = node; }} xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" viewBox={`0 0 ${width} ${height}`} className="w-full h-auto shadow-2xl rounded-sm transition-all duration-500" style={{ aspectRatio: `${width}/${height}` }}>
      <defs>
        <filter id={resourceId('noise')}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="matrix" values={`0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${PAPER_TEXTURE.inkAlpha} 0`} />
        </filter>
        <filter id={resourceId('cover-paper-blur')}><feGaussianBlur stdDeviation={COVER_BACKGROUND.blur} /></filter>
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
          <rect width={width} height={height} fill={COVER_BACKGROUND.paper} />
          <image href={coverImage} x="-10%" y="-10%" width="120%" height="120%" preserveAspectRatio="xMidYMid slice" filter={`url(#${resourceId('cover-paper-blur')})`} />
          <rect data-cover-paper="base" width={width} height={height} fill={COVER_BACKGROUND.paper} opacity={1 - coverStrength} />
          <rect data-cover-paper="front" x={xFront} width={wFront} height={height} fill={COVER_BACKGROUND.paper} opacity={COVER_BACKGROUND.frontPaperOpacity} />
        </>
      ) : (
        <rect x="0" y="0" width={width} height={height} data-panel-background="front" fill={bgFill} />
      )}
      {customColors && <>
        <rect data-panel-background="shortBack" x="0" y="0" width={wShort} height={height} fill={colors.shortBack.background} />
        <rect data-panel-background="back" x={xBack} y="0" width={wBack} height={height} fill={colors.back.background} />
      </>}
      {data.layout?.texture && <rect x="0" y="0" width={width} height={height} fill="transparent" filter={`url(#${resourceId('noise')})`} opacity={PAPER_TEXTURE.opacity} />}

      <rect x={xSpine} y="0" width={wSpine} height={height} data-panel-background="spine" fill={colors.spine.background}  />

      <line x1={xSpine} y1="0" x2={xSpine} y2={height} stroke={customColors ? colors.shortBack.divider : textColor} strokeWidth="2" strokeDasharray="4,4" opacity={customColors ? 1 : 0.2} />
      <line x1={xFront} y1="0" x2={xFront} y2={height} stroke={customColors ? colors.spine.divider : textColor} strokeWidth="2" strokeDasharray="4,4" opacity={customColors ? 1 : 0.2} />
      <line x1={xBack} y1="0" x2={xBack} y2={height} stroke={customColors ? colors.back.divider : textColor} strokeWidth="2" strokeDasharray="4,4" opacity={customColors ? 1 : 0.3} />

      <g clipPath={`url(#${resourceId('panel-short-back')})`} data-typography-panel="shortBack" data-typography-bounds={JSON.stringify({ x: 0, width: wShort, height })}>
        <ShortBackContent width={wShort} data={data} theme={panelTheme('shortBack')} isLight={isLight} textColor={colors.shortBack.heading} subTextColor={colors.shortBack.metadata} dimTextColor={colors.shortBack.label} recordingData={recordingData} fontConfig={fontConfig} />
      </g>

      <g clipPath={`url(#${resourceId('panel-spine')})`} data-typography-panel="spine" data-typography-bounds={JSON.stringify({ x: xSpine, width: wSpine, height })}>
        <g transform={`translate(${xSpine + wSpine / 2}, ${height / 2})`}>
          <SpineContent
            data={data}
            height={height}
            panelWidth={wSpine}
            fontConfig={fontConfig}
            themeColors={colors.spine} exactColors={customColors}
            inverted={!!data.layout?.spineInverted}
          />
        </g>
      </g>

      <g clipPath={`url(#${resourceId('panel-front')})`} data-typography-panel="front" data-typography-bounds={JSON.stringify({ x: xFront, width: wFront, height })}>
        <ContentFront resourceId={resourceId} xOffset={xFront} width={wFront} data={data} theme={panelTheme('front')} coverImage={coverImage} coverImageB={coverImageB} frontStyle={data.layout?.frontStyle || 'STANDARD'} textColor={colors.front.title} subTextColor={colors.front.artist} frontLayout={frontLayout} />
      </g>

      <g clipPath={`url(#${resourceId('panel-flap')})`} data-typography-panel="back" data-typography-bounds={JSON.stringify({ x: xBack, width: wBack, height })} transform={`translate(${xBack}, 0)`}>
        <ContentBack onLayoutStatus={onBackStatus} width={wBack} data={data} theme={panelTheme('back')} isLight={isLight} textColor={colors.back.heading} subTextColor={colors.back.metadata} dimTextColor={colors.back.label} recordingData={recordingData} fontConfig={fontConfig} />
      </g>
    </svg>{typographyError && <p role="alert" className="mt-3 text-sm text-red-700">{typographyError}。请重新搭配或恢复默认文字样式。</p>}</>
  );
};

export default JCardPreview;

import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Download, Disc, Music, Type, Palette, Wand2, Search, X, Settings, Key, Image as ImageIcon, Trash2, Database, Globe, Loader2, Printer, Eye, Sun, Moon, Droplet, LayoutTemplate, FileText, ImageDown, Upload, ListTree, RotateCcw } from 'lucide-react';

import DashScopeService from './src/services/DashScopeService.js';

// --- Color Extraction Service ---
const ColorExtractor = {
  extractColor: (imageSrc) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.src = imageSrc;

      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 50;
        canvas.height = 50;
        ctx.drawImage(img, 0, 0, 50, 50);

        try {
          const data = ctx.getImageData(0, 0, 50, 50).data;
          let r = 0, g = 0, b = 0, count = 0;
          let maxSaturation = -1;
          let bestColor = { r: 0, g: 0, b: 0 };

          for (let i = 0; i < data.length; i += 16) {
            const tr = data[i], tg = data[i + 1], tb = data[i + 2];
            const max = Math.max(tr, tg, tb), min = Math.min(tr, tg, tb);
            const l = (max + min) / 2 / 255;
            const d = (max - min) / 255;
            let s = 0;
            if (max !== min) s = l > 0.5 ? d / (2 - 2 * l) : d / (2 * l);

            if (l > 0.15 && l < 0.85 && s > 0.2) {
              if (s > maxSaturation) {
                maxSaturation = s;
                bestColor = { r: tr, g: tg, b: tb };
              }
              r += tr; g += tg; b += tb; count++;
            }
          }

          if (maxSaturation > 0.3) resolve(rgbToHex(bestColor.r, bestColor.g, bestColor.b));
          else if (count > 0) resolve(rgbToHex(Math.round(r / count), Math.round(g / count), Math.round(b / count)));
          else resolve("#cc3300");
        } catch (e) {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
    });
  }
};

function rgbToHex(r, g, b) {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// --- Text Utils (Shared) ---
const TextUtils = {
  getCharWeight: (char) => {
    if (/[\u4e00-\u9fa5\u3000-\u30ff\uff00-\uff60]/.test(char)) return 1.8;
    if (/[A-Z]/.test(char)) return 1.1;
    return 0.7;
  },
  getWrappedLines: (text, maxWidthUnits) => {
    if (!text) return [""];
    const lines = [];
    let currentLine = "";
    let currentWidth = 0;
    // Keep explicit newlines
    const paragraphs = text.split('\n');

    paragraphs.forEach(paragraph => {
      const words = paragraph.split(' ');
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        let wordWidth = 0;
        for (const char of word) wordWidth += TextUtils.getCharWeight(char);

        const spaceWidth = (currentLine.length > 0) ? 0.5 : 0;

        if (currentWidth + spaceWidth + wordWidth <= maxWidthUnits) {
          currentLine += (currentLine.length > 0 ? " " : "") + word;
          currentWidth += spaceWidth + wordWidth;
        } else {
          if (wordWidth > maxWidthUnits) {
            if (currentLine.length > 0) { lines.push(currentLine); currentLine = ""; currentWidth = 0; }
            let remaining = word;
            while (remaining.length > 0) {
              let chunk = ""; let chunkWidth = 0; let k = 0;
              for (; k < remaining.length; k++) {
                const cw = TextUtils.getCharWeight(remaining[k]);
                if (chunkWidth + cw > maxWidthUnits) break;
                chunkWidth += cw; chunk += remaining[k];
              }
              if (chunk.length === 0 && k === 0) { chunk = remaining[0]; k = 1; }
              lines.push(chunk); remaining = remaining.slice(k);
            }
          } else {
            lines.push(currentLine); currentLine = word; currentWidth = wordWidth;
          }
        }
      }
      if (currentLine) { lines.push(currentLine); currentLine = ""; currentWidth = 0; }
    });
    return lines.length > 0 ? lines : [""];
  }
};

// --- Image Utils ---
const urlToBase64 = async (url) => {
  if (!url) return null;
  if (url.startsWith('data:')) return url;

  try {
    const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!response.ok) throw new Error('Network response was not ok');
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn("Image to Base64 failed, using raw URL.", e);
    return url;
  }
};

// --- MusicBrainz Service ---
const MusicBrainzService = {
  userAgent: "JCardGenesis/2.0 ( contact@example.com )",

  searchReleaseGroup: async (album, artist) => {
    const cleanAlbum = album.trim();
    const cleanArtist = artist.trim();

    if (!cleanAlbum && !cleanArtist) return [];

    let queryParts = ["primarytype:Album"];

    if (cleanAlbum) {
      const safeAlbum = cleanAlbum.replace(/[:"()]/g, " ");
      queryParts.push(`release:(${safeAlbum})`);
    }

    if (cleanArtist) {
      const safeArtist = cleanArtist.replace(/[:"()]/g, " ");
      queryParts.push(`artist:(${safeArtist})`);
    }

    const query = queryParts.join(" AND ");
    const url = `https://musicbrainz.org/ws/2/release-group/?query=${encodeURIComponent(query)}&fmt=json`;

    const res = await fetch(url, { headers: { 'User-Agent': MusicBrainzService.userAgent } });
    if (!res.ok) throw new Error("MusicBrainz Search Failed");
    const data = await res.json();
    return data['release-groups'] || [];
  },

  getBestReleaseId: async (rgId) => {
    const url = `https://musicbrainz.org/ws/2/release?release-group=${rgId}&fmt=json&limit=100`;
    const res = await fetch(url, { headers: { 'User-Agent': MusicBrainzService.userAgent } });
    const data = await res.json();
    const releases = data.releases || [];
    const scored = releases.map(r => {
      let score = 0;
      if (r.status === 'Official') score += 10;
      if (['JP', 'US', 'GB'].includes(r.country)) score += 5;
      if (r.date) score += 1;
      return { ...r, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.id;
  },

  getReleaseDetails: async (releaseId) => {
    const url = `https://musicbrainz.org/ws/2/release/${releaseId}?inc=recordings+artist-credits+labels&fmt=json`;
    const res = await fetch(url, { headers: { 'User-Agent': MusicBrainzService.userAgent } });
    return await res.json();
  },

  getCoverArt: async (rgId) => {
    try {
      const url = `https://coverartarchive.org/release-group/${rgId}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      const front = data.images.find(img => img.front);
      if (!front) return null;
      return front.thumbnails['1200'] || front.image;
    } catch (e) { return null; }
  },

  formatDuration: (ms) => {
    if (!ms) return "0:00";
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}:${seconds.padStart(2, '0')}`;
  }
};

// --- Layout Engine (Hierarchy Logic) ---
const LayoutEngine = {
  detectMode: (releaseData, tracks) => {
    const primaryType = releaseData['release-group']?.['primary-type'];
    const secondaryTypes = releaseData['release-group']?.['secondary-types'] || [];
    const albumArtist = releaseData['artist-credit']?.[0]?.name;

    if (albumArtist === 'Various Artists' || secondaryTypes.includes('Compilation')) {
      return 'COMPILATION';
    }

    let classicalScore = 0;
    const classicalKeywords = [/Op\./, /No\./, /Major/, /Minor/, /Sonata/, /Concerto/, /Symphony/, /BWV/, /HWV/, /KV/];
    const trackTitles = tracks.map(t => t.title);
    trackTitles.forEach(title => {
      if (classicalKeywords.some(regex => regex.test(title))) {
        classicalScore += 1;
      }
    });

    let groupingCount = 0;
    for (let i = 0; i < trackTitles.length - 1; i++) {
      const prefix = LayoutEngine.getCommonPrefix(trackTitles[i], trackTitles[i + 1]);
      if (prefix.length > 15) {
        groupingCount++;
        i++;
      }
    }

    if ((classicalScore / tracks.length > 0.3) || groupingCount >= 2) {
      return 'CLASSICAL';
    }
    return 'STANDARD';
  },

  getCommonPrefix: (s1, s2) => {
    if (!s1 || !s2) return "";
    let i = 0;
    while (i < s1.length && i < s2.length && s1[i] === s2[i]) i++;
    return s1.substring(0, i);
  },

  // 核心重构：返回嵌套结构而不是扁平结构
  groupTracksNested: (tracks) => {
    const result = [];
    let i = 0;
    while (i < tracks.length) {
      const current = tracks[i];
      let j = i + 1;
      let bestPrefix = "";
      let matchCount = 0;

      if (j < tracks.length) {
        const prefix = LayoutEngine.getCommonPrefix(current.title, tracks[j].title);
        const cleanPrefixMatch = prefix.match(/^(.*)[:\-]\s/);

        if (prefix.length > 15 && cleanPrefixMatch) {
          bestPrefix = cleanPrefixMatch[1];
          matchCount = 1;
          while (j < tracks.length) {
            if (tracks[j].title.startsWith(bestPrefix)) {
              matchCount++;
              j++;
            } else {
              break;
            }
          }
        }
      }

      if (matchCount > 0) {
        // 创建一个分组节点
        const groupTitle = bestPrefix.trim().replace(/[:\-]$/, '');
        const subTracks = [];
        for (let k = i; k < j; k++) {
          const t = tracks[k];
          let suffix = t.title.replace(bestPrefix, '').trim();
          suffix = suffix.replace(/^[:\-]\s+/, '').replace(/^\.\s+/, '');
          subTracks.push({ ...t, displayTitle: suffix });
        }
        result.push({ type: 'group', title: groupTitle, tracks: subTracks });
        i = j;
      } else {
        result.push({ type: 'track', ...current, displayTitle: current.title });
        i++;
      }
    }
    return result;
  }
};

// --- Sub Components ---

const ContentFront = ({ xOffset, width, data, theme, coverImage, isLight, textColor, subTextColor, titleLayout, titleStartY, badgeY, artistY }) => {

  // --- UPDATED Badge Rendering Logic ---
  const badgeText = data.coverBadge || "";
  // Relaxed width: Use ~80% of the front panel width (780px * 0.8 = 624px)
  // 620px / ~16px per char avg ~= 38 chars wrapping limit
  const badgeLines = TextUtils.getWrappedLines(badgeText, 38);
  const badgeLineHeight = 26;

  return (
    <g transform={`translate(${xOffset}, 0)`}>
      <rect x="0" y="0" width={width} height="1181" fill="url(#grid)" opacity="0.2" />
      {coverImage ? (
        <>
          <svg x="0" y="0" width={width} height={width} viewBox="0 0 1200 1200" preserveAspectRatio="xMidYMid slice">
            {/* Layer 1: Blurred Background (Bleed Protection) - Fills the gaps */}
            <image href={coverImage} width="1200" height="1200" preserveAspectRatio="xMidYMid slice" filter="url(#bg-blur)" transform="scale(1.1)" transform-origin="center" />
            {/* Layer 2: Main Image (No Crop) - Fits entirely within the box */}
            {/* Modified: Scale set to 1 to remove artificial gaps and maximize fill (was 0.96) */}
            <image href={coverImage} width="1200" height="1200" preserveAspectRatio="xMidYMid meet" transform="scale(1)" transform-origin="center" />
          </svg>
          <rect x="0" y={width} width={width} height="2" fill={textColor} opacity="0.5" />
        </>
      ) : (
        <path d={`M ${width / 2 - 200} 400 Q ${width / 2} 100 ${width / 2 + 200} 400`} stroke={theme.accent} strokeWidth="4" fill="none" opacity="0.8" />
      )}
      <g transform={`translate(${width / 2 - 750}, 0)`}>
        {titleLayout.lines.map((line, index) => (
          <text key={index} x="750" y={titleStartY + (index * titleLayout.lineHeight)} fontFamily="Arial Black, sans-serif" fontSize={titleLayout.fontSize} fill={textColor} textAnchor="middle" letterSpacing="-1" style={{ textShadow: isLight ? "none" : "0 4px 12px rgba(0,0,0,0.5)" }}>
            {line}
          </text>
        ))}

        {/* --- New Integrated Blurb/Badge (No Box, Relaxed Width) --- */}
        {badgeText && (
          <g>
            {/* Render Lines Directly without Rect Background */}
            {badgeLines.map((line, i) => (
              <text
                key={i}
                x="750"
                y={badgeY + (i * badgeLineHeight)}
                fontFamily="Georgia, serif"
                fontStyle="italic"
                fontWeight="bold"
                fontSize="20"
                fill={textColor}
                textAnchor="middle"
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

        <text x="750" y={artistY} fontFamily="Arial, sans-serif" fontSize="24" fill={subTextColor} textAnchor="middle" style={{ textShadow: isLight ? "none" : "0 2px 4px rgba(0,0,0,0.8)" }}>
          {data.artist}{theme.mood_description ? ` · ${theme.mood_description}` : ""}
        </text>
      </g>
    </g>
  )
}

const ContentBack = ({ width, data, theme, isCompact, isLight, textColor, subTextColor, dimTextColor, recordingData }) => {
  // 动态布局引擎配置
  const contentHeight = 1181; // Adjusted for Canon 4x6 height (100mm)
  const marginY = isCompact ? 60 : 80;
  const footerHeight = isCompact ? 40 : 60;
  const headerHeight = isCompact ? 25 : 50;
  const gapBetweenSides = isCompact ? 20 : 60;
  const verticalPadding = isCompact ? 40 : 40;

  // Early definition of critical height values to avoid TDZ
  const staticHeight = marginY + headerHeight + gapBetweenSides + headerHeight + footerHeight;
  const availableForTracks = contentHeight - staticHeight;

  const hasNoteUpper = !!data.layout?.noteUpper;
  const hasNoteLower = !!data.layout?.noteLower;

  // 数据预处理：获取嵌套分组
  const isClassical = data.layout.mode === 'CLASSICAL';

  // 决定排版策略 (Render Strategy)
  let renderStrategy = 'STANDARD';
  if (isClassical) {
    if (isCompact) {
      renderStrategy = 'WORK_ONLY';
    } else {
      renderStrategy = 'INLINE_COMPACT';
    }
  }

  const groupsA = isClassical ? LayoutEngine.groupTracksNested(data.sideA) : data.sideA.map(t => ({ type: 'track', ...t, displayTitle: t.title }));
  const groupsB = isClassical ? LayoutEngine.groupTracksNested(data.sideB) : data.sideB.map(t => ({ type: 'track', ...t, displayTitle: t.title }));

  // --- 核心修复：预计算逻辑 (解决 ReferenceError) ---
  // 1. 粗略估算行数，用于决定是否显示 Note
  const countRoughLines = (groups) => groups.reduce((acc, item) => {
    if (item.type === 'group') return acc + 1 + item.tracks.length;
    return acc + 1;
  }, 0);

  const roughTotalLines = countRoughLines(groupsA) + countRoughLines(groupsB);
  const roughLH = roughTotalLines > 0 ? availableForTracks / roughTotalLines : 50;
  const showNotesGlobal = !isCompact && roughLH > 45; // 使用粗略估算来决定开关

  const wrapCharsHeader = isCompact ? 18 : 55; // 标题换行阈值 (Compact 调小)
  const wrapCharsContent = isCompact ? 28 : 95; // 正文换行阈值 (Inline模式)

  const calculateRealVisualLines = (groups) => {
    return groups.reduce((acc, item) => {
      if (item.type === 'group') {
        const headerLinesCount = TextUtils.getWrappedLines(item.title, wrapCharsHeader).length;
        let groupHeight = headerLinesCount * 0.9;

        if (renderStrategy === 'INLINE_COMPACT') {
          const joinedText = item.tracks.map((t, tidx) => {
            const roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"][tidx] || (tidx + 1);
            let cleanTitle = t.displayTitle.replace(/^[IVX]+\.\s*/, '');
            return `${roman}. ${cleanTitle}`;
          }).join(" / ");

          const contentLinesCount = TextUtils.getWrappedLines(joinedText, wrapCharsContent).length;
          groupHeight += contentLinesCount * 0.85 + 0.3;
        } else if (renderStrategy === 'WORK_ONLY') {
          groupHeight += 0.2;
        } else {
          groupHeight += item.tracks.length;
        }
        return acc + groupHeight;
      } else {
        // 普通单轨也计算换行
        const lines = TextUtils.getWrappedLines(item.displayTitle, wrapCharsHeader).length;

        // Note 也占空间 - 使用 showNotesGlobal 来判断
        let noteHeight = 0;
        if (showNotesGlobal && item.note) {
          const noteLines = TextUtils.getWrappedLines(item.note, 60).length;
          noteHeight = Math.min(noteLines, 2) * 0.6; // Note 较小
        }

        return acc + 1 + (lines - 1) * 0.85 + noteHeight;
      }
    }, 0);
  };

  const visualLinesA = calculateRealVisualLines(groupsA);
  const visualLinesB = calculateRealVisualLines(groupsB);
  const totalVisualItems = visualLinesA + visualLinesB;

  // --- UPDATED: Significantly relaxed constraints for larger fonts ---
  const maxLH = isCompact ? 50 : 110;
  const minLH = isCompact ? 16 : 30;

  let calculatedLH = totalVisualItems > 0 ? availableForTracks / totalVisualItems : maxLH;
  calculatedLH = Math.min(Math.max(calculatedLH, minLH), maxLH);

  // --- UPDATED: Increased Font Ratio and Max Caps ---
  const fontRatio = 0.55;
  const maxFont = isCompact ? 15 : 25;
  const minFont = isCompact ? 8 : 12;

  let fontSize = Math.floor(calculatedLH * fontRatio);
  fontSize = Math.min(Math.max(fontSize, minFont), maxFont);

  const trackFontSize = fontSize;
  const groupHeaderFontSize = Math.min(trackFontSize + 2, maxFont + 2);
  const noteFontSize = Math.max(fontSize * 0.6, 8);

  const yHeaderA = marginY;
  const yListA = yHeaderA + headerHeight;
  // 使用精确计算后的行数来推算 B 面的起始位置
  const heightA = visualLinesA * calculatedLH;
  const yDivider = yListA + heightA + (gapBetweenSides / 2);
  // 增加一点缓冲，防止 A 面末尾如果有个大的 g 字母下沉导致重叠
  const yHeaderB = yDivider + (gapBetweenSides / 2);
  const yListB = yHeaderB + headerHeight;

  const noteLowerLen = (data.layout.noteLower || "").length;
  const noteLowerHeight = noteLowerLen * 10 + 20;
  const titleStartYAnchor = hasNoteLower ? (contentHeight - 100 - noteLowerHeight - 30) : (contentHeight - 120);
  const showSideLabel = !isCompact;

  const formatVerticalText = (text) => {
    if (!text) return "";
    return data.layout?.forceCaps ? String(text).toUpperCase() : String(text);
  };

  // 渲染列表逻辑
  const renderGroupList = (groups, startGlobalIdx) => {
    let yCursor = 0;
    let localIdx = startGlobalIdx;

    return groups.map((item, i) => {
      if (item.type === 'group') {
        const headerLines = TextUtils.getWrappedLines(item.title, wrapCharsHeader);

        const headerNode = headerLines.map((line, lineIdx) => (
          <text key={`h-${i}-${lineIdx}`} x="-5" y={yCursor + calculatedLH * 0.6 + (lineIdx * calculatedLH * 0.85)} fill={textColor} fontSize={groupHeaderFontSize} fontWeight="bold" dominantBaseline="middle">
            {line}
          </text>
        ));

        yCursor += calculatedLH + (headerLines.length - 1) * calculatedLH * 0.85;

        let contentNode = null;

        if (renderStrategy === 'INLINE_COMPACT') {
          // --- 方案 A: 行内紧凑模式 ---
          const joinedText = item.tracks.map((t, tidx) => {
            const roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"][tidx] || (tidx + 1);
            let cleanTitle = t.displayTitle.replace(/^[IVX0-9]+\.\s*/, '');
            if (isClassical) return cleanTitle;
            return `${roman}. ${cleanTitle}`;
          }).join(" / ");

          const contentLines = TextUtils.getWrappedLines(joinedText, wrapCharsContent);

          contentNode = contentLines.map((line, lIdx) => (
            <text key={`c-${i}-${lIdx}`} x="0" y={yCursor + calculatedLH * 0.5 + (lIdx * calculatedLH * 0.85)} fill={dimTextColor} fontSize={trackFontSize - 1} dominantBaseline="middle">
              {line}
            </text>
          ));
          yCursor += contentLines.length * calculatedLH * 0.85 + calculatedLH * 0.3;
          localIdx += item.tracks.length;

        } else if (renderStrategy === 'WORK_ONLY') {
          // --- 方案 B: 仅作品模式 ---
          yCursor += calculatedLH * 0.2;
          localIdx += item.tracks.length;

        } else {
          // --- 标准模式 ---
          contentNode = item.tracks.map((t, tidx) => {
            const thisY = yCursor;
            yCursor += calculatedLH;
            localIdx++;
            return (
              <text key={`st-${i}-${tidx}`} x="15" y={thisY + calculatedLH * 0.5} fill={subTextColor} fontSize={trackFontSize} dominantBaseline="middle">
                <tspan fill={dimTextColor}>•</tspan> <tspan dx={5}>{t.displayTitle}</tspan>
              </text>
            );
          });
        }

        return <g key={i}>{headerNode}{contentNode}</g>;

      } else {
        // 普通单轨 (Standard / Compilation 模式主要走这里)
        const thisY = yCursor;
        localIdx++;

        // Note 显示逻辑 - 使用 showNotesGlobal
        const noteWrapLimit = isCompact ? 40 : 60;
        const hasNote = showNotesGlobal && item.note;
        const noteLines = hasNote ? TextUtils.getWrappedLines(item.note, noteWrapLimit) : [];

        // --- NEW: 普通轨道标题自动换行 ---
        const titleLines = TextUtils.getWrappedLines(item.displayTitle, wrapCharsHeader);

        const trackNode = titleLines.map((line, lineIdx) => {
          const isFirstLine = lineIdx === 0;
          return (
            <text key={`t-${i}-${lineIdx}`} x="0" y={thisY + calculatedLH * (hasNote ? 0.35 : 0.5) + (lineIdx * calculatedLH * 0.85)} fill={subTextColor} fontSize={trackFontSize} dominantBaseline="middle">
              {/* 序号只在第一行显示 */}
              {isFirstLine && <tspan fontWeight="bold" fill={theme.accent}>{String(localIdx).padStart(2, '0')}.</tspan>}

              {/* 歌名：如果有缩进(第二行)，手动加空格或dx */}
              <tspan fontWeight="bold" dx={isFirstLine ? 5 : 28}>{line}</tspan>

              {/* 艺术家/时间：只在第一行(或最后一行? 暂时第一行更整齐) 且 非Compact模式 */}
              {isFirstLine && (data.layout?.mode === 'COMPILATION') && !isCompact && <tspan fill={dimTextColor}> - {item.artist}</tspan>}
              {isFirstLine && !isCompact && <tspan fontSize={Math.max(trackFontSize - 4, 10)} fill={dimTextColor}> ({item.duration})</tspan>}
            </text>
          )
        });

        // 更新 yCursor: 标题占用高度 + Note 占用高度
        yCursor += calculatedLH + (titleLines.length - 1) * calculatedLH * 0.85;
        if (hasNote && noteLines.length > 0) {
          yCursor += Math.min(noteLines.length, 2) * noteFontSize * 1.2;
        }

        const noteNode = hasNote && noteLines.slice(0, 2).map((line, lineIdx) => (
          <text key={`n-${i}-${lineIdx}`} x="25" y={thisY + calculatedLH * 0.7 + (titleLines.length - 1) * calculatedLH * 0.85 + (lineIdx * noteFontSize * 1.2)} fontSize={noteFontSize} fill={dimTextColor} dominantBaseline="hanging" opacity="0.8">
            {line}
          </text>
        ));

        return <g key={`t-grp-${i}`}>{trackNode}{noteNode}</g>;
      }
    });
  };

  return (
    <g>
      {/* Note Upper/Lower REMOVED from Side Panels (Moved to Spine) per request */}

      {/* Short Back Title REMOVED per user request */}

      {/* --- Tracklist Container OR Tech Specs (Classical Swap) --- */}
      {/* Case 1: Classical Mode + Short Back (Compact) -> TECH SPECS (Rotated) */}
      {(isClassical && isCompact) ? (
        <g transform={`translate(${width}, 0) rotate(90)`} fontFamily="Courier New, monospace">
          {/* Tech Specs Layout (Long edge is X axis 0..1181, Short edge is Y axis 0..width) */}

          {/* 1. Label / Header (Top/Left) */}
          <text x="50" y="40" fontSize="24" fontWeight="bold" fill={textColor} letterSpacing="2" dominantBaseline="hanging">
            {(recordingData?.labelOverride || data.tapeSubtitle || "LABEL INFO").toUpperCase()}
          </text>

          {/* SOURCE (New Field) - Below Label */}
          <g transform={`translate(50, 90)`}>
            <text x="0" y="0" fontSize="14" fill={dimTextColor} letterSpacing="3" uppercase="true">SOURCE</text>
            <text x="90" y="0" fontSize="18" fill={subTextColor} fontWeight="bold" textAnchor="start" dominantBaseline="middle" dy="1">{recordingData?.source || "N/A"}</text>
          </g>

          <line x1="50" y1="130" x2={contentHeight - 50} y2="130" stroke={textColor} strokeWidth="2" />

          {/* 2. Equipment (Middle - Adjusted X) */}
          <g transform={`translate(380, 40)`}>
            <text x="0" y="0" fontSize="14" fill={dimTextColor} letterSpacing="3" uppercase="true">EQUIPMENT</text>
            {(() => {
              // Increased width for equipment description (approx 600px available space now)
              // 600px / ~11px per char ~= 54 chars
              const eqLines = TextUtils.getWrappedLines(recordingData?.equipment || "N/A", 54);
              return eqLines.map((line, i) => (
                <text key={i} x="0" y={30 + (i * 24)} fontSize="18" fill={subTextColor} fontFamily="Arial, sans-serif" fontWeight="bold">
                  {line}
                </text>
              ));
            })()}
          </g>

          {/* 4. Dates Zone (Right - Stacked or Side-by-Side) */}
          <g transform={`translate(${contentHeight - 50}, 40)`}>
            {/* RELEASED */}
            <g transform={`translate(0, 0)`}>
              <text x="0" y="0" fontSize="14" fill={dimTextColor} letterSpacing="3" textAnchor="end">RELEASED</text>
              <text x="0" y="30" fontSize="24" fill={textColor} fontWeight="bold" textAnchor="end">{data.layout.noteUpper || "2024"}</text>
            </g>

            {/* RECORDED (New Field) - Stacked above Released or to the left? 
                Let's put it to the left of Released to form a "Timestamp Block" 
                x offset = -140 (approx width of a date block)
            */}
            <g transform={`translate(-140, 0)`}>
              <text x="0" y="0" fontSize="14" fill={dimTextColor} letterSpacing="3" textAnchor="end">RECORDED</text>
              <text x="0" y="30" fontSize="24" fill={theme.accent} fontWeight="bold" textAnchor="end">{recordingData?.recDate || "2025.01.01"}</text>
            </g>
          </g>
        </g>
      ) : (
        // Case 2: Everything else (Standard Modes OR Classical Main Panel) -> TRACKLIST
        <g transform={`translate(0, 0)`}>
          {/* Side A Header */}
          <g transform={`translate(${verticalPadding}, ${yHeaderA})`}>
            <rect x="0" y="-15" width="40" height="20" fill={textColor} rx="4" />
            <text x="20" y="0" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="14" fill={isLight ? "#fff" : "#121212"} textAnchor="middle" dominantBaseline="middle">A</text>
            {showSideLabel && <text x="50" y="0" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="14" fill={theme.accent} letterSpacing="1" dominantBaseline="middle">SIDE A</text>}
            <text x={width - verticalPadding * 2 - (hasNoteLower ? 20 : 0) - (hasNoteUpper ? 20 : 0) - (isCompact ? 0 : 20)} y="0" fontFamily="Arial, sans-serif" fontSize={12} fill={dimTextColor} textAnchor="end" dominantBaseline="middle">{data.sideADuration}</text>
          </g>

          {/* Side A List */}
          <g transform={`translate(${verticalPadding}, ${yListA})`} fontFamily="Arial, sans-serif">
            {renderGroupList(groupsA, 0)}
          </g>

          {/* Divider */}
          <line x1={verticalPadding} y1={yDivider} x2={width - verticalPadding * 2 - (hasNoteLower ? 20 : 0) - (hasNoteUpper ? 20 : 0)} y2={yDivider} stroke={dimTextColor} strokeWidth="1" opacity="0.5" />

          {/* Side B Header */}
          <g transform={`translate(${verticalPadding}, ${yHeaderB})`}>
            <rect x="0" y="-15" width="40" height="20" fill={textColor} rx="4" />
            <text x="20" y="0" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="14" fill={isLight ? "#fff" : "#121212"} textAnchor="middle" dominantBaseline="middle">B</text>
            {showSideLabel && <text x="50" y="0" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="14" fill={theme.accent} letterSpacing="1" dominantBaseline="middle">SIDE B</text>}
            <text x={width - verticalPadding * 2 - (hasNoteLower ? 20 : 0) - (hasNoteUpper ? 20 : 0) - (isCompact ? 0 : 20)} y="0" fontFamily="Arial, sans-serif" fontSize={12} fill={dimTextColor} textAnchor="end" dominantBaseline="middle">{data.sideBDuration}</text>
          </g>

          {/* Side B List */}
          <g transform={`translate(${verticalPadding}, ${yListB})`} fontFamily="Arial, sans-serif">
            {renderGroupList(groupsB, data.sideA.length)}
          </g>
        </g>
      )}
    </g>
  )
}

const JCardPreview = ({ data, theme, coverImage, svgRef, appearanceMode, recordingData }) => {
  const { title, artist, sideA, sideB, sideADuration, sideBDuration, tapeId, tapeSubtitle, coverBadge } = data;
  const width = 1748; // Adjusted for Canon 4x6 (148mm)
  const height = 1181; // Adjusted for Canon 4x6 (100mm)
  const isLight = appearanceMode === 'light';
  const textColor = isLight ? "#1a1a1a" : "#ffffff";
  const subTextColor = isLight ? "#4a4a4a" : "#e0e0e0";
  const dimTextColor = isLight ? "#666666" : "#888888";
  const maskOpacity = isLight ? 0.3 : 0.75;
  const maskColor = isLight ? "#ffffff" : "#050505";

  const isMinimalSpine = !!data.layout?.minimalSpine;
  const spineFill = isMinimalSpine
    ? (isLight ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)")
    : theme.accent;

  const spineTitleColor = isMinimalSpine ? textColor : "#ffffff";
  const spineIdColor = isMinimalSpine ? theme.accent : "rgba(255,255,255,0.9)";

  const getTitleLayout = (text) => {
    if (!text) return { lines: [], fontSize: 64, lineHeight: 72, totalHeight: 0 };
    const words = text.split(/\s+/);
    const charCount = text.length;
    let fontSize = 72;
    let lineHeight = 80;
    let maxCharsPerLine = 12;
    if (charCount > 40) { fontSize = 42; lineHeight = 48; maxCharsPerLine = 24; }
    else if (charCount > 20) { fontSize = 56; lineHeight = 64; maxCharsPerLine = 16; }
    let lines = [], currentLine = [], currentLineLength = 0;
    words.forEach(word => {
      if (currentLineLength + word.length + (currentLine.length > 0 ? 1 : 0) > maxCharsPerLine) {
        if (currentLine.length > 0) { lines.push(currentLine.join(" ")); currentLine = []; currentLineLength = 0; }
      }
      currentLine.push(word); currentLineLength += word.length + 1;
    });
    if (currentLine.length > 0) lines.push(currentLine.join(" "));
    return { lines: lines.slice(0, 4), fontSize, lineHeight, totalHeight: lines.length * lineHeight };
  };

  const titleLayout = getTitleLayout(title);

  // Dynamic Layout Calculation
  const imgBottom = 780; // Cover ends at y=780
  const footerMargin = 40;
  const contentHeight = 1181;
  const safeBottom = contentHeight - footerMargin;

  // Calculate heights
  const titleH = titleLayout.totalHeight;
  const badgeTextStr = data.coverBadge || "";
  const badgeLines = TextUtils.getWrappedLines(badgeTextStr, 38);
  const badgeH = badgeLines.length > 0 ? (badgeLines.length * 26 + 10) : 0; // 26px line height + padding
  const artistH = 30; // approx height for artist line

  // Define gaps
  const gapTitleBadge = 20;
  const gapBadgeArtist = 30;

  // Calculate positions (Top-Down approach)
  // Start title slightly below image
  // Increased gap to 110 to prevent title from being too close to image (accounting for baseline)
  let currentY = imgBottom + 110;

  // Title Position (First line baseline)
  const titleStartY = currentY;
  currentY += titleH + gapTitleBadge;

  // Badge Position (First line baseline)
  // Badge is optional, so it might take 0 height
  const badgeY = currentY + 20; // +20 for visual baseline adjustment
  if (badgeH > 0) {
    currentY += badgeH + gapBadgeArtist;
  } else {
    currentY += gapBadgeArtist; // Minimum gap if no badge
  }

  // Artist Position
  // Ensure artist is pushed down if needed, but closer to bottom if space allows
  // But strictly, let's just stack it to avoid overlap. 
  // We can clamp it to be at least at a certain "nice" position if the stack is short.
  let artistY = currentY + 10;

  const minArtistY = 1120;
  // If our stack is short, push artist down to the aesthetic default.
  // If stack is tall (long title/badge), use the calculated stack position.
  if (artistY < minArtistY) {
    artistY = minArtistY;
  }

  const formatText = (text) => data.layout?.forceCaps ? String(text).toUpperCase() : String(text);

  const getSpineTitleSize = (text) => {
    const len = text ? text.length : 0;
    if (len > 30) return 24;
    if (len > 20) return 28;
    return 34;
  }

  // Panel Dimensions for 1748px Width (148mm)
  const wShort = 200; // ~17mm
  const wSpine = 150; // ~12.7mm
  const wFront = 780; // ~66mm
  const wBack = 618;  // ~52.3mm (Remaining)

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
        {/* Corrected ClipPaths for 4-panel Full Bleed Layout */}
        <clipPath id="panel-short-back"><rect x="0" y="0" width={wShort} height={height} /></clipPath>
        <clipPath id="panel-spine"><rect x={xSpine} y="0" width={wSpine} height={height} /></clipPath>
        <clipPath id="panel-front"><rect x={xFront} y="0" width={wFront} height={height} /></clipPath>
        {/* Fix: Coordinate system for translated group needs to start at 0 */}
        <clipPath id="panel-flap"><rect x="0" y="0" width={wBack} height={height} /></clipPath>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke={isLight ? "#000" : "#333"} strokeWidth="1" opacity="0.1" />
        </pattern>
      </defs>

      {coverImage ? (
        <>
          <image href={coverImage} x="-10%" y="-10%" width="120%" height="120%" preserveAspectRatio="xMidYMid slice" filter="url(#bg-blur)" />
          <rect x="0" y="0" width={width} height={height} fill={maskColor} opacity={maskOpacity} />
        </>
      ) : (
        <rect x="0" y="0" width={width} height={height} fill={isLight ? "#f0f0f0" : theme.background} />
      )}
      <rect x="0" y="0" width={width} height={height} fill="transparent" filter="url(#noise)" opacity={isLight ? 0.2 : 0.4} />

      {/* Unified Full Bleed Layout */}
      {/* Short Back */}
      <rect x={xShort} y="0" width={wShort} height={height} fill={maskColor} opacity={0.65} />
      {/* Spine */}
      <rect x={xSpine} y="0" width={wSpine} height={height} fill={maskColor} opacity={0.85} />
      <rect x={xSpine} y="0" width={wSpine} height={height} fill={spineFill} opacity={coverImage && !isMinimalSpine ? 0.6 : 1} style={{ mixBlendMode: isLight && !isMinimalSpine ? 'multiply' : 'normal' }} />
      {/* Front */}
      <rect x={xFront} y="0" width={wFront} height={height} fill={maskColor} opacity={0.85} />
      {/* Back */}
      <rect x={xBack} y="0" width={wBack} height={height} fill={maskColor} opacity={0.65} />

      {/* Fold Lines */}
      <line x1={xSpine} y1="0" x2={xSpine} y2={height} stroke={textColor} strokeWidth="2" strokeDasharray="4,4" opacity="0.2" />
      <line x1={xFront} y1="0" x2={xFront} y2={height} stroke={textColor} strokeWidth="2" strokeDasharray="4,4" opacity="0.2" />
      <line x1={xBack} y1="0" x2={xBack} y2={height} stroke={textColor} strokeWidth="2" strokeDasharray="4,4" opacity="0.3" />

      {/* Short Back Content (Flap/Inner) */}
      <g clipPath="url(#panel-short-back)">
        <ContentBack width={wShort} data={data} theme={theme} isCompact={true} isLight={isLight} textColor={textColor} subTextColor={subTextColor} dimTextColor={dimTextColor} recordingData={recordingData} />
      </g>

      {/* Spine Content */}
      <g transform={`translate(${xSpine + wSpine / 2}, ${height / 2})`}>
        <text x="0" y="0" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize={getSpineTitleSize(title)} fill={spineTitleColor} textAnchor="middle" dominantBaseline="middle" transform="rotate(-90)" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>{formatText(title)}</text>
        <text x={(height / 2) - 100} y="0" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="14" fill={spineIdColor} textAnchor="middle" dominantBaseline="middle" transform="rotate(-90)" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>{tapeId}</text>
        {/* Note Upper (Spine Top) */}
        {data.layout?.noteUpper && (
          <text x={(height / 2) - 50} y="0" fontFamily="Arial, sans-serif" fontSize="10" fill={spineIdColor} textAnchor="middle" dominantBaseline="middle" transform="rotate(-90)" letterSpacing="1" opacity="0.8">
            {formatText(data.layout.noteUpper)}
          </text>
        )}

        <text x={-((height / 2) - 150)} y="0" fontFamily="Arial, sans-serif" fontSize="18" fill={spineTitleColor} textAnchor="middle" dominantBaseline="middle" transform="rotate(-90)" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>{formatText(artist)}</text>
        {/* Note Lower (Spine Bottom) */}
        {data.layout?.noteLower && (
          <text x={-((height / 2) - 50)} y="0" fontFamily="Arial, sans-serif" fontSize="10" fill={spineTitleColor} textAnchor="middle" dominantBaseline="middle" transform="rotate(-90)" letterSpacing="1" opacity="0.8">
            {formatText(data.layout.noteLower)}
          </text>
        )}
      </g>

      {/* Front Content */}
      <g clipPath="url(#panel-front)">
        <ContentFront xOffset={xFront} width={wFront} data={data} theme={theme} coverImage={coverImage} isLight={isLight} textColor={textColor} subTextColor={subTextColor} titleLayout={titleLayout} titleStartY={titleStartY} badgeY={badgeY} artistY={artistY} />
      </g>

      {/* Back Content (Tracklist) */}
      <g clipPath="url(#panel-flap)" transform={`translate(${xBack}, 0)`}>
        <ContentBack width={wBack} data={data} theme={theme} isLight={isLight} textColor={textColor} subTextColor={subTextColor} dimTextColor={dimTextColor} recordingData={recordingData} />
      </g>
    </svg>
  );
};

export default function App() {
  const [apiKey, setApiKey] = useState("");
  const svgRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [loadingTitle, setLoadingTitle] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingImport, setLoadingImport] = useState(false);
  const [loadingImage, setLoadingImage] = useState(false);
  const [loadingSlogan, setLoadingSlogan] = useState(false);
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const [coverImage, setCoverImage] = useState(null);
  // 修改默认主题为 'light'
  const [appearanceMode, setAppearanceMode] = useState('light');
  const [imagePrompt, setImagePrompt] = useState("");
  const [searchQuery, setSearchQuery] = useState({ album: '', artist: '' });
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');

  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) setApiKey(savedKey);
  }, []);

  const saveApiKey = (key) => {
    setApiKey(key);
    localStorage.setItem('gemini_api_key', key);
  };

  const [data, setData] = useState({
    title: "ALBUM TITLE",
    artist: "ARTIST NAME",
    tapeId: "ID-001",
    tapeSubtitle: "STEREO",
    coverBadge: "",
    sideADuration: "20:00",
    sideBDuration: "20:00",
    layout: {
      noteUpper: "",  // Cleared defaults
      noteLower: "",  // Cleared defaults
      forceCaps: true,
      minimalSpine: false,
      mode: 'STANDARD' // 'STANDARD' | 'CLASSICAL' | 'COMPILATION'
    },
    sideA: [
      { title: "Track Name 1", artist: "Artist Name", duration: "3:45", note: "" },
      { title: "Track Name 2", artist: "Artist Name", duration: "4:20", note: "" },
      { title: "Track Name 3", artist: "Artist Name", duration: "3:15", note: "" },
      { title: "Track Name 4", artist: "Artist Name", duration: "5:10", note: "" },
      { title: "Track Name 5", artist: "Artist Name", duration: "4:05", note: "" }
    ],
    sideB: [
      { title: "Track Name 6", artist: "Artist Name", duration: "3:50", note: "" },
      { title: "Track Name 7", artist: "Artist Name", duration: "4:15", note: "" },
      { title: "Track Name 8", artist: "Artist Name", duration: "3:30", note: "" },
      { title: "Track Name 9", artist: "Artist Name", duration: "4:45", note: "" },
      { title: "Track Name 10", artist: "Artist Name", duration: "3:55", note: "" }
    ]
  });

  // --- NEW: Custom Recording Metadata State with Persistence ---
  const [recordingData, setRecordingData] = useState({
    equipment: "",
    mode: "AAA",
    labelOverride: "",
    source: "",
    recDate: ""
  });

  // Load recording data from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('jcard_recording_data');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Merge saved data but FORCE recDate to be Today
        const today = new Date().toISOString().split('T')[0];
        setRecordingData({
          ...parsed,
          recDate: today
        });
      } catch (e) {
        console.error("Failed to parse saved recording data", e);
      }
    } else {
      // Init default date if no save found
      setRecordingData(prev => ({
        ...prev,
        recDate: new Date().toISOString().split('T')[0]
      }));
    }
  }, []);

  // Save recording data to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('jcard_recording_data', JSON.stringify(recordingData));
  }, [recordingData]);

  const updateRecordingData = (field, value) => {
    setRecordingData(prev => ({ ...prev, [field]: value }));
  };

  const [theme, setTheme] = useState({
    background: "#121212",
    accent: "#cc3300",
    mood_description: ""
  });

  // Set default prompt when data changes
  // Removed automatic prompt generation useEffect per user request

  const getApiKeyOrWarn = () => {
    return apiKey || "";
  };

  const handleSearch = async () => {
    if (!searchQuery.album.trim() && !searchQuery.artist.trim()) return;

    setLoadingSearch(true);
    setSearchResults([]);
    setError('');
    try {
      const results = await MusicBrainzService.searchReleaseGroup(searchQuery.album, searchQuery.artist);
      setSearchResults(results);
    } catch (e) { setError(e.message || "Search failed"); } finally { setLoadingSearch(false); }
  };

  const handleSelectReleaseGroup = async (rg) => {
    setLoadingSearch(true);
    setError('');
    try {
      const bestReleaseId = await MusicBrainzService.getBestReleaseId(rg.id);
      if (!bestReleaseId) throw new Error("No valid release found for this album.");
      const releaseData = await MusicBrainzService.getReleaseDetails(bestReleaseId);
      const coverUrlOriginal = await MusicBrainzService.getCoverArt(rg.id);
      const coverUrl = await urlToBase64(coverUrlOriginal);

      const labelInfo = releaseData['label-info']?.[0];
      const catalogNumber = labelInfo?.['catalog-number'];
      const labelName = labelInfo?.label?.name;
      const date = releaseData.date;

      const rawTracks = (releaseData.media || []).flatMap(m => m.tracks || []).map(t => ({
        title: t.title,
        artist: t['artist-credit']?.[0]?.name || rg['artist-credit']?.[0]?.name || "Unknown",
        durationMs: t.length || 0,
        duration: MusicBrainzService.formatDuration(t.length)
      }));
      const totalMs = rawTracks.reduce((sum, t) => sum + t.durationMs, 0);
      const halfMs = totalMs / 2;
      let currentMs = 0; let splitIndex = 0;
      if (releaseData.media && releaseData.media.length >= 2) { splitIndex = releaseData.media[0]['track-count']; }
      else { for (let i = 0; i < rawTracks.length; i++) { currentMs += rawTracks[i].durationMs; if (currentMs >= halfMs) { splitIndex = i + 1; break; } } }
      const sideA = rawTracks.slice(0, splitIndex).map(t => ({ ...t, note: '' }));
      const sideB = rawTracks.slice(splitIndex).map(t => ({ ...t, note: '' }));

      // 自动检测布局模式
      const detectedMode = LayoutEngine.detectMode(releaseData, rawTracks);

      setData({
        ...data,
        title: rg.title.toUpperCase(),
        artist: (rg['artist-credit']?.[0]?.name || "").toUpperCase(),
        tapeId: catalogNumber ? catalogNumber.toUpperCase() : "MB-" + rg.id.slice(0, 4).toUpperCase(),
        tapeSubtitle: labelName ? labelName.toUpperCase() : "STEREO",
        coverBadge: date ? date.slice(0, 4) : "",
        sideADuration: MusicBrainzService.formatDuration(sideA.reduce((sum, t) => sum + t.durationMs, 0)),
        sideBDuration: MusicBrainzService.formatDuration(sideB.reduce((sum, t) => sum + t.durationMs, 0)),
        layout: {
          ...data.layout,
          noteUpper: date ? date.slice(0, 4) : "RECORDED",
          noteLower: "STEREO",
          mode: detectedMode
        },
        sideA, sideB
      });
      if (coverUrl) setCoverImage(coverUrl);
      setShowSearch(false);
    } catch (e) { setError("Import failed: " + e.message); } finally { setLoadingSearch(false); }
  };

  const handleSmartImport = async () => {
    if (!importText.trim()) return;
    const key = getApiKeyOrWarn();
    setLoadingImport(true);
    setError('');
    try {
      const parsed = await DashScopeService.parseImportData(importText, key);
      const updates = {};

      // Helper: Parse "MM:SS" string to milliseconds for calculation
      const parseDurationToMs = (durationStr) => {
        if (!durationStr || !durationStr.includes(':')) return 0;
        const parts = durationStr.split(':').map(Number);
        if (parts.length === 2) {
          return (parts[0] * 60 + parts[1]) * 1000;
        }
        return 0;
      };

      if (parsed.sideA || parsed.sideB) {
        updates.sideA = parsed.sideA || [];
        updates.sideB = parsed.sideB || [];

        // Auto-calculate Total Duration for Side A
        if (updates.sideA.length > 0) {
          const totalMsA = updates.sideA.reduce((acc, t) => acc + parseDurationToMs(t.duration), 0);
          updates.sideADuration = MusicBrainzService.formatDuration(totalMsA);
        }

        // Auto-calculate Total Duration for Side B
        if (updates.sideB.length > 0) {
          const totalMsB = updates.sideB.reduce((acc, t) => acc + parseDurationToMs(t.duration), 0);
          updates.sideBDuration = MusicBrainzService.formatDuration(totalMsB);
        }
      }

      if (parsed.album_title) updates.title = parsed.album_title.toUpperCase();
      if (parsed.album_artist) updates.artist = parsed.album_artist.toUpperCase();
      if (parsed.cover_url) {
        const base64Cover = await urlToBase64(parsed.cover_url);
        setCoverImage(base64Cover);
      }

      // 自动检测布局模式
      // Merge new tracks with structure for detection
      const testTracksA = updates.sideA || data.sideA;
      const testTracksB = updates.sideB || data.sideB;
      const allTestTracks = [...testTracksA, ...testTracksB];

      // Mock release data for detection (since we don't have full MB data here)
      const mockReleaseData = {
        'artist-credit': [{ name: updates.artist || data.artist }],
        'release-group': { 'secondary-types': [] }
      };
      const detectedMode = LayoutEngine.detectMode(mockReleaseData, allTestTracks);

      updates.layout = {
        ...data.layout,
        mode: detectedMode
      };

      // Ensure notes field exists
      if (updates.sideA) updates.sideA = updates.sideA.map(t => ({ ...t, note: t.note || '' }));
      if (updates.sideB) updates.sideB = updates.sideB.map(t => ({ ...t, note: t.note || '' }));

      setData(prev => ({ ...prev, ...updates }));
      setShowImport(false);
      setImportText('');
    } catch (err) {
      setError(err.message || "Failed to parse text.");
      if (!apiKey && (err.message.includes("API Key") || err.message.includes("403"))) {
        setShowSettings(true);
      }
    } finally {
      setLoadingImport(false);
    }
  };

  const handleAIEnhance = async () => {
    const key = getApiKeyOrWarn();
    setLoading(true); setError('');
    try {
      const parsed = await DashScopeService.enhanceContent(data, key);

      const updates = {};
      if (parsed.album_title) updates.title = parsed.album_title.toUpperCase();
      if (parsed.album_copy) updates.coverBadge = parsed.album_copy;

      // Update data state
      setData(prev => ({ ...prev, ...updates }));

      // Update Image Prompt State (so user can see it and click generation)
      if (parsed.cover_prompt) {
        setImagePrompt(parsed.cover_prompt + (parsed.negative_prompt ? `\n\nNegative: ${parsed.negative_prompt}` : ""));
      }

    } catch (err) { setError(err.message); if (!apiKey) setShowSettings(true); } finally { setLoading(false); }
  };

  const handleTitleMagic = async () => {
    const key = getApiKeyOrWarn();
    setLoadingTitle(true);
    try {
      const allTracks = [...data.sideA, ...data.sideB];
      const result = await DashScopeService.suggestTitle(allTracks, key);
      if (result.suggested_title) setData(prev => ({ ...prev, title: result.suggested_title.toUpperCase() }));
    } catch (err) { setError(err.message); } finally { setLoadingTitle(false); }
  };

  const handleGenerateCover = async () => {
    // Validation: Prompt must not be empty
    if (!imagePrompt.trim()) {
      alert("请先在下方【AI 图片提示词】框中输入描述，再点击生成。");
      return;
    }

    const key = getApiKeyOrWarn();
    setLoadingImage(true); setError('');
    try {
      const finalPrompt = imagePrompt.trim();
      const imgDataUrl = await DashScopeService.generateImage(finalPrompt, key);
      setCoverImage(imgDataUrl);
    } catch (err) { setError(err.message); } finally { setLoadingImage(false); }
  };

  const handleGenerateCoverPrompt = async () => {
    const key = getApiKeyOrWarn();
    setLoadingPrompt(true); setError('');
    try {
      const allTracks = [...data.sideA, ...data.sideB];
      // Check if dark mode is active for theme context
      const isDark = appearanceMode === 'dark'; // Or derive from actual theme.background if complex
      // Collect notes
      const notes = allTracks.map(t => t.note).join(' ');

      const result = await DashScopeService.generateImagePrompt(isDark, allTracks, notes, key);

      if (result.cover_prompt) {
        let fullPrompt = result.cover_prompt;
        if (result.negative_prompt) {
          fullPrompt += `\n\nNegative: ${result.negative_prompt}`;
        }
        setImagePrompt(fullPrompt);
      }
    } catch (err) { setError(err.message); if (!apiKey) setShowSettings(true); } finally { setLoadingPrompt(false); }
  };

  const handleGenerateSlogan = async () => {
    const key = getApiKeyOrWarn();
    setLoadingSlogan(true); setError('');
    try {
      const allTracks = [...data.sideA, ...data.sideB];
      const result = await DashScopeService.generateSlogan(allTracks, key);
      if (result.slogan) {
        // Ensure it respects the newline format
        const formattedSlogan = Array.isArray(result.slogan) ? result.slogan.join('\n') : result.slogan;
        setData(prev => ({ ...prev, coverBadge: formattedSlogan }));
      }
    } catch (err) { setError(err.message); if (!apiKey) setShowSettings(true); } finally { setLoadingSlogan(false); }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const downloadSVG = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${data.title.replace(/\s+/g, '_')}_JCard.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadPNG = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);

    const canvas = document.createElement("canvas");
    canvas.width = 1748;
    canvas.height = 1181;
    const ctx = canvas.getContext("2d");

    const img = new Image();
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      setTimeout(() => {
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);

        const pngUrl = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.href = pngUrl;
        link.download = `${data.title.replace(/\s+/g, '_')}_JCard.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, 100);
    };
    img.src = url;
  };

  const updateTrack = (side, index, field, value) => {
    const newData = { ...data };
    newData[side][index][field] = value;
    setData(newData);
  };

  const handleAutoColor = async () => {
    if (!coverImage) return;
    const color = await ColorExtractor.extractColor(coverImage);
    if (color) setTheme(prev => ({ ...prev, accent: color }));
  };

  useEffect(() => { if (coverImage) handleAutoColor(); }, [coverImage]);

  const handleReset = () => {
    if (window.confirm("确定要清空当前所有内容并开始新项目吗？\n（将保留API Key、录音设备和媒体来源设置）")) {
      // 1. Reset Data to Defaults
      setData({
        title: "ALBUM TITLE",
        artist: "ARTIST NAME",
        tapeId: "ID-001",
        tapeSubtitle: "STEREO",
        coverBadge: "",
        sideADuration: "20:00",
        sideBDuration: "20:00",
        layout: {
          noteUpper: "",
          noteLower: "",
          forceCaps: true,
          minimalSpine: false,
          mode: 'STANDARD'
        },
        sideA: [
          { title: "Track Name 1", artist: "Artist Name", duration: "3:45", note: "" },
          { title: "Track Name 2", artist: "Artist Name", duration: "4:20", note: "" },
          { title: "Track Name 3", artist: "Artist Name", duration: "3:15", note: "" },
          { title: "Track Name 4", artist: "Artist Name", duration: "5:10", note: "" },
          { title: "Track Name 5", artist: "Artist Name", duration: "4:05", note: "" }
        ],
        sideB: [
          { title: "Track Name 6", artist: "Artist Name", duration: "3:50", note: "" },
          { title: "Track Name 7", artist: "Artist Name", duration: "4:15", note: "" },
          { title: "Track Name 8", artist: "Artist Name", duration: "3:30", note: "" },
          { title: "Track Name 9", artist: "Artist Name", duration: "4:45", note: "" },
          { title: "Track Name 10", artist: "Artist Name", duration: "3:55", note: "" }
        ]
      });

      // 2. Clear Images & Search
      setCoverImage(null);
      setSearchResults([]);
      setImportText("");
      setImagePrompt("");
      setError("");

      // 3. Update Rec Date to Today
      const today = new Date().toISOString().split('T')[0];
      setRecordingData(prev => ({
        ...prev,
        recDate: today
      }));
    }
  };

  return (
    <div className={`flex flex-col h-screen overflow-hidden font-sans relative ${appearanceMode === 'light' ? 'bg-gray-100 text-gray-900' : 'bg-gray-900 text-gray-100'}`}>

      {/* Settings Modal */}
      {showSettings && (
        <div className="absolute inset-0 z-[60] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-md border border-gray-700 text-white">
            <div className="flex justify-between items-center p-4 border-b border-gray-700">
              <h3 className="text-lg font-bold flex items-center gap-2"><Settings size={20} className="text-gray-400" /> 设置</h3>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                  <Key size={16} className="text-orange-500" />
                  DashScope API Key (阿里云)
                </label>
                <input type="password" value={apiKey || ''} onChange={(e) => saveApiKey(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded p-3 text-white focus:ring-2 focus:ring-orange-500 outline-none font-mono text-sm" placeholder="sk-..." />
                <p className="mt-2 text-xs text-gray-400">
                  <a href="https://help.aliyun.com/zh/model-studio/get-started-with-models/" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline flex items-center gap-1">
                    如何获取 API Key? <Globe size={10} />
                  </a>
                </p>
              </div>
            </div>
            <div className="p-4 border-t border-gray-700 flex justify-end">
              <button onClick={() => setShowSettings(false)} className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded font-medium">完成</button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImport && (
        <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg border border-gray-700 flex flex-col max-h-[90vh] text-white">
            <div className="flex justify-between items-center p-4 border-b border-gray-700">
              <h3 className="text-lg font-bold flex items-center gap-2"><FileText size={20} className="text-orange-500" /> 粘贴曲目列表</h3>
              <button onClick={() => setShowImport(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-4 flex-1 overflow-hidden flex flex-col">
              <p className="text-sm text-gray-400 mb-2">在下方粘贴原始文本、HTML 或 JSON。AI 将自动提取信息。</p>
              <textarea
                className="w-full flex-1 bg-gray-900 p-4 rounded text-sm font-mono border border-gray-700 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none resize-none"
                placeholder={`1. Song A - Artist (3:20)\n2. Song B - Artist\n...`}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
              />
            </div>
            <div className="p-4 border-t border-gray-700 flex justify-end gap-3">
              <button onClick={() => setShowImport(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">取消</button>
              <button
                onClick={handleSmartImport}
                disabled={loadingImport || !importText}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded text-sm font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingImport ? <span className="animate-spin">⏳</span> : <Sparkles size={16} />}
                {loadingImport ? '分析中...' : '解析并导入'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search Modal */}
      {showSearch && (
        <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl border border-gray-700 flex flex-col max-h-[85vh] text-white">
            <div className="flex justify-between items-center p-4 border-b border-gray-700">
              <h3 className="text-lg font-bold flex items-center gap-2"><Database size={20} className="text-orange-500" /> MusicBrainz 搜索</h3>
              <button onClick={() => setShowSearch(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-4 bg-gray-900/50 space-y-3 border-b border-gray-700">
              <div className="flex gap-3">
                <input className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm focus:border-orange-500 outline-none" placeholder="专辑标题 (例如：Abbey Road)" value={searchQuery.album} onChange={(e) => setSearchQuery({ ...searchQuery, album: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
                <input className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm focus:border-orange-500 outline-none" placeholder="艺术家 (例如：The Beatles)" value={searchQuery.artist} onChange={(e) => setSearchQuery({ ...searchQuery, artist: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
                <button onClick={handleSearch} disabled={loadingSearch} className="px-4 bg-orange-600 hover:bg-orange-500 text-white rounded font-bold text-sm flex items-center gap-2">{loadingSearch ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />} 搜索</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
              {error && <div className="p-4 text-red-400 bg-red-900/20 text-center rounded">{error}</div>}
              {searchResults.map((rg) => (
                <div key={rg.id} className="bg-gray-700/50 hover:bg-gray-700 p-3 rounded flex justify-between items-center cursor-pointer transition-colors border border-transparent hover:border-orange-500/50" onClick={() => handleSelectReleaseGroup(rg)}>
                  <div><h4 className="font-bold text-white">{rg.title}</h4><p className="text-sm text-gray-400">{rg['artist-credit']?.[0]?.name} · {rg['first-release-date']?.slice(0, 4)} · {rg['primary-type']}</p></div>
                  <button className="px-3 py-1 bg-gray-600 hover:bg-orange-600 text-xs rounded text-white transition-colors">选择</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className={`flex items-center justify-between px-6 py-4 border-b shrink-0 ${appearanceMode === 'light' ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700'}`}>
        <div className="flex items-center gap-2"><Disc className="text-orange-500 w-6 h-6" /><h1 className="text-xl font-bold tracking-wider">磁带封面生成器 <span className="text-orange-500 text-sm">(J-CARD GENESIS)</span></h1></div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1 p-1 rounded-lg ${appearanceMode === 'light' ? 'bg-gray-200' : 'bg-gray-700'}`}>
            <button onClick={() => setAppearanceMode('dark')} className={`p-1.5 rounded-md transition-colors ${appearanceMode === 'dark' ? 'bg-gray-600 text-white shadow' : 'text-gray-400 hover:text-gray-500'}`}><Moon size={16} /></button>
            <button onClick={() => setAppearanceMode('light')} className={`p-1.5 rounded-md transition-colors ${appearanceMode === 'light' ? 'bg-white text-orange-600 shadow' : 'text-gray-400 hover:text-gray-300'}`}><Sun size={16} /></button>
          </div>
          <div className="h-6 w-px bg-gray-600 mx-1 opacity-20"></div>
          <button onClick={() => setShowSettings(true)} className={`p-2 rounded-full transition-colors ${!apiKey ? 'text-gray-400 hover:text-gray-500 hover:bg-gray-200' : 'text-orange-400 hover:text-orange-300'}`}><Settings size={20} /></button>
          <div className="h-6 w-px bg-gray-600 mx-1 opacity-20"></div>
          <button onClick={handleReset} className={`p-2 rounded-full transition-colors ${appearanceMode === 'light' ? 'text-gray-500 hover:bg-gray-200 hover:text-red-500' : 'text-gray-400 hover:bg-gray-700 hover:text-red-400'}`} title="新建/重置项目"><RotateCcw size={20} /></button>
          <div className="h-6 w-px bg-gray-600 mx-1 opacity-20"></div>
          <button onClick={handleAIEnhance} disabled={loading} className={`flex items-center gap-2 px-4 py-2 rounded-md font-semibold transition-all ${loading ? 'bg-gray-600 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white shadow-lg hover:shadow-indigo-500/20'}`}>{loading ? <span className="animate-spin">✨</span> : <Sparkles size={18} />}{loading ? 'AI 策划中...' : 'AI 创意总监'}</button>

          {/* Export Buttons */}
          <button onClick={downloadSVG} className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${appearanceMode === 'light' ? 'bg-gray-200 hover:bg-gray-300 text-gray-800' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}><Download size={18} />导出 SVG</button>
          <button onClick={downloadPNG} className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${appearanceMode === 'light' ? 'bg-gray-200 hover:bg-gray-300 text-gray-800' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}><ImageDown size={18} />导出 PNG</button>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        {/* Left Panel */}
        <div className={`w-1/3 min-w-[350px] overflow-y-auto border-r p-6 space-y-8 custom-scrollbar ${appearanceMode === 'light' ? 'bg-gray-50 border-gray-200' : 'bg-gray-800/50 border-gray-700'}`}>
          <section className="space-y-4">
            <h2 className="text-sm uppercase tracking-widest text-gray-500 font-bold flex items-center gap-2"><Type size={14} /> 专辑信息</h2>
            <div className="space-y-3">
              <div><label className="block text-xs text-gray-400 mb-1">专辑标题</label><div className="flex gap-2"><input type="text" value={data.title || ''} onChange={(e) => setData({ ...data, title: e.target.value })} className={`w-full border rounded p-2 focus:ring-2 focus:ring-orange-500 outline-none ${appearanceMode === 'light' ? 'bg-white border-gray-300 text-gray-900' : 'bg-gray-700 border-gray-600 text-white'}`} /><button onClick={handleTitleMagic} disabled={loadingTitle} className={`px-3 border rounded transition-colors ${appearanceMode === 'light' ? 'bg-white border-gray-300 text-orange-600 hover:bg-gray-50' : 'bg-gray-700 border-gray-600 text-orange-400 hover:text-orange-300'}`}>{loadingTitle ? <span className="animate-spin text-xs">⏳</span> : <Wand2 size={16} />}</button></div></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-400 mb-1">艺术家</label><input type="text" value={data.artist || ''} onChange={(e) => setData({ ...data, artist: e.target.value })} className={`w-full border rounded p-2 focus:ring-2 focus:ring-orange-500 outline-none ${appearanceMode === 'light' ? 'bg-white border-gray-300 text-gray-900' : 'bg-gray-700 border-gray-600 text-white'}`} /></div>
                <div><label className="block text-xs text-gray-400 mb-1">目录编号</label><input type="text" value={data.tapeId || ''} onChange={(e) => setData({ ...data, tapeId: e.target.value })} className={`w-full border rounded p-2 focus:ring-2 focus:ring-orange-500 outline-none ${appearanceMode === 'light' ? 'bg-white border-gray-300 text-gray-900' : 'bg-gray-700 border-gray-600 text-white'}`} /></div>
              </div>
              <div><label className="block text-xs text-gray-400 mb-1">封面标语</label><div className="flex gap-2"><textarea rows={3} maxLength={200} value={data.coverBadge || ''} onChange={(e) => setData({ ...data, coverBadge: e.target.value })} className={`flex-1 border rounded p-2 focus:ring-2 focus:ring-orange-500 outline-none placeholder-gray-500 resize-none ${appearanceMode === 'light' ? 'bg-white border-gray-300 text-gray-900' : 'bg-gray-700 border-gray-600 text-white'}`} placeholder="例如：永恒的经典..." /><button onClick={handleGenerateSlogan} disabled={loadingSlogan} className={`px-2 border rounded self-start transition-colors h-20 flex items-center justify-center ${appearanceMode === 'light' ? 'bg-white border-gray-300 text-purple-600 hover:bg-purple-50' : 'bg-gray-700 border-gray-600 text-purple-400 hover:text-purple-300'}`}>{loadingSlogan ? <span className="animate-spin text-xs">⏳</span> : <Sparkles size={16} />}</button></div></div>
            </div>
          </section>

          {/* Layout Options */}
          <section className="space-y-4">
            <h2 className="text-sm uppercase tracking-widest text-gray-500 font-bold flex items-center gap-2"><LayoutTemplate size={14} /> 布局选项</h2>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs text-gray-400 mb-1">顶部备注 (Note Upper)</label><input type="text" value={data.layout.noteUpper || ''} onChange={(e) => setData({ ...data, layout: { ...data.layout, noteUpper: e.target.value } })} className={`w-full border rounded p-2 text-xs focus:ring-2 focus:ring-orange-500 outline-none ${appearanceMode === 'light' ? 'bg-white border-gray-300' : 'bg-gray-700 border-gray-600 text-white'}`} placeholder="例如：STEREO / 录音日期" /></div>
              <div><label className="block text-xs text-gray-400 mb-1">底部备注 (Note Lower)</label><input type="text" value={data.layout.noteLower || ''} onChange={(e) => setData({ ...data, layout: { ...data.layout, noteLower: e.target.value } })} className={`w-full border rounded p-2 text-xs focus:ring-2 focus:ring-orange-500 outline-none ${appearanceMode === 'light' ? 'bg-white border-gray-300' : 'bg-gray-700 border-gray-600 text-white'}`} placeholder="例如：2023 发行" /></div>
            </div>
            {/* 布局模式选择器 */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">布局模式 (Layout Mode)</label>
              <div className="flex gap-2 text-xs">
                {['STANDARD', 'CLASSICAL', 'COMPILATION'].map(mode => (
                  <button
                    key={mode}
                    onClick={() => setData({ ...data, layout: { ...data.layout, mode } })}
                    className={`flex-1 py-1 rounded border transition-colors ${data.layout.mode === mode
                      ? 'bg-orange-600 text-white border-orange-600'
                      : (appearanceMode === 'light' ? 'bg-white border-gray-300 text-gray-600' : 'bg-gray-700 border-gray-600 text-gray-300')}`}
                  >
                    {mode === 'STANDARD' ? '标准' : mode === 'CLASSICAL' ? '古典' : '合辑'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                <input type="checkbox" checked={data.layout.forceCaps} onChange={(e) => setData({ ...data, layout: { ...data.layout, forceCaps: e.target.checked } })} className="rounded text-orange-500 focus:ring-orange-500 bg-gray-700 border-gray-600" /> 强制大写
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                <input type="checkbox" checked={data.layout.minimalSpine} onChange={(e) => setData({ ...data, layout: { ...data.layout, minimalSpine: e.target.checked } })} className="rounded text-orange-500 focus:ring-orange-500 bg-gray-700 border-gray-600" /> 极简脊部
              </label>
            </div>
          </section>

          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider border-b border-gray-700 pb-2">Custom Metadata</h3>

            {/* Equipment Input */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Recording Equipment</label>
              <div className="relative">
                <textarea
                  value={recordingData.equipment || ""}
                  onChange={(e) => updateRecordingData('equipment', e.target.value)}
                  rows={4}
                  className={`w-full bg-transparent border rounded p-2 text-sm focus:border-red-500 outline-none transition-colors resize-none ${appearanceMode === 'light' ? 'border-gray-300 text-gray-800' : 'border-gray-700 text-gray-200'}`}
                  placeholder="e.g. Neumann U47 / Studer A80..."
                />
              </div>
            </div>



            {/* Label Override */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Label Override</label>
              <div className="relative">
                <input
                  type="text"
                  value={recordingData.labelOverride || ""}
                  onChange={(e) => updateRecordingData('labelOverride', e.target.value)}
                  className={`w-full bg-transparent border-b ${appearanceMode === 'light' ? 'border-gray-300 text-gray-800' : 'border-gray-700 text-gray-200'} py-1 text-sm focus:border-red-500 outline-none transition-colors`}
                  placeholder="Overrides standard label info"
                />
                <Type size={14} className="absolute right-0 top-1.5 text-gray-500" />
              </div>
            </div>

            {/* NEW: Media Source */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Media Source</label>
              <div className="relative">
                <input
                  type="text"
                  value={recordingData.source || ""}
                  onChange={(e) => updateRecordingData('source', e.target.value)}
                  className={`w-full bg-transparent border-b ${appearanceMode === 'light' ? 'border-gray-300 text-gray-800' : 'border-gray-700 text-gray-200'} py-1 text-sm focus:border-red-500 outline-none transition-colors`}
                  placeholder="e.g. Vinyl / SACD ISO"
                />
                <Database size={14} className="absolute right-0 top-1.5 text-gray-500" />
              </div>
            </div>

            {/* NEW: Tape Rec. Date */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tape Rec. Date</label>
              <div className="relative">
                <input
                  type="text"
                  value={recordingData.recDate || ""}
                  onChange={(e) => updateRecordingData('recDate', e.target.value)}
                  className={`w-full bg-transparent border-b ${appearanceMode === 'light' ? 'border-gray-300 text-gray-800' : 'border-gray-700 text-gray-200'} py-1 text-sm focus:border-red-500 outline-none transition-colors`}
                  placeholder="YYYY-MM-DD"
                />
                <Disc size={14} className="absolute right-0 top-1.5 text-gray-500" />
              </div>
            </div>
          </div>

          {/* Advanced Settings */}
          <div className="space-y-4">

            {/* Style Section */}
            <section className="space-y-4">
              <h2 className="text-sm uppercase tracking-widest text-gray-500 font-bold flex items-center gap-2"><Palette size={14} /> 样式覆盖</h2>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs text-gray-400 mb-1">强调色 (Accent)</label><div className="flex items-center gap-2"><input type="color" value={theme.accent || '#000000'} onChange={(e) => setTheme({ ...theme, accent: e.target.value })} className="h-8 w-8 rounded cursor-pointer bg-transparent border-none" /><button onClick={handleAutoColor} disabled={!coverImage} className={`p-1.5 rounded hover:bg-gray-600 transition-colors ${!coverImage ? 'opacity-30 cursor-not-allowed' : 'text-orange-400 hover:text-white'}`}><Droplet size={16} /></button></div></div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1 flex justify-between items-center">
                    AI 图片提示词
                    <button onClick={handleGenerateCoverPrompt} disabled={loadingPrompt} className="text-[10px] bg-purple-600 hover:bg-purple-500 text-white px-2 py-0.5 rounded flex items-center gap-1">
                      {loadingPrompt ? <span className="animate-spin">⏳</span> : <Wand2 size={10} />}
                      {loadingPrompt ? '生成中...' : 'AI 生成提示词'}
                    </button>
                  </label>
                  <textarea
                    className={`w-full border rounded p-2 text-xs h-20 focus:ring-2 focus:ring-orange-500 outline-none resize-none ${appearanceMode === 'light' ? 'bg-white border-gray-300 text-gray-900' : 'bg-gray-700 border-gray-600 text-white'}`}
                    placeholder="描述你想要的封面画面..."
                    value={imagePrompt}
                    onChange={(e) => setImagePrompt(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">封面图片</label>
                <div className="flex gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <button onClick={() => fileInputRef.current?.click()} className={`flex-1 rounded text-xs py-2 flex items-center justify-center gap-1 transition-colors ${appearanceMode === 'light' ? 'bg-white border border-gray-300 hover:bg-gray-50 text-gray-700' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}><Upload size={14} /> 上传图片</button>
                  <button onClick={handleGenerateCover} disabled={loadingImage} className={`flex-1 rounded text-xs py-2 flex items-center justify-center gap-1 transition-colors ${appearanceMode === 'light' ? 'bg-white border border-gray-300 hover:bg-gray-50 text-gray-700' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}>{loadingImage ? <span className="animate-spin">⏳</span> : <ImageIcon size={14} />} {loadingImage ? '生成中...' : 'AI 生成'}</button>
                  {coverImage && (<button onClick={() => setCoverImage(null)} className="w-8 bg-red-900/50 hover:bg-red-800 rounded flex items-center justify-center text-red-200"><Trash2 size={14} /></button>)}
                </div>
              </div>
            </section>

            {/* Tracks Section */}
            <div className={`flex items-center justify-between border-b pb-2 ${appearanceMode === 'light' ? 'border-gray-200' : 'border-gray-700'}`}>
              <h2 className="text-sm uppercase tracking-widest text-gray-500 font-bold flex items-center gap-2"><Music size={14} /> 曲目列表</h2>
              <div className="flex gap-2">
                <button onClick={() => setShowImport(true)} className={`text-xs flex items-center gap-1 px-2 py-1 rounded transition-colors ${appearanceMode === 'light' ? 'bg-white border border-gray-300 hover:bg-gray-50 text-orange-600' : 'bg-gray-700 hover:bg-gray-600 text-orange-400'}`}><FileText size={12} /> 粘贴文本</button>
                <button onClick={() => setShowSearch(true)} className={`text-xs flex items-center gap-1 px-2 py-1 rounded transition-colors ${appearanceMode === 'light' ? 'bg-white border border-gray-300 hover:bg-gray-50 text-orange-600' : 'bg-gray-700 hover:bg-gray-600 text-orange-400'}`}><Globe size={12} /> 搜索 MusicBrainz</button>
              </div>
            </div>
            <section className="space-y-4">
              <h3 className="text-xs font-bold text-gray-500 pl-1">A 面 (SIDE A)</h3>
              {data.sideA.map((track, i) => (
                <div key={i} className={`p-3 rounded border space-y-2 group ${appearanceMode === 'light' ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700'}`}>
                  <div className="flex gap-2"><div className="w-6 text-gray-500 text-sm font-mono flex items-center justify-center">{i + 1}</div><input className={`flex-1 border-none rounded px-2 py-1 text-sm focus:ring-1 focus:ring-orange-500 ${appearanceMode === 'light' ? 'bg-gray-50 text-gray-900 placeholder-gray-400' : 'bg-gray-900 text-white placeholder-gray-600'}`} placeholder="标题" value={track.title || ''} onChange={(e) => updateTrack('sideA', i, 'title', e.target.value)} /><input className={`w-16 border-none rounded px-2 py-1 text-sm text-center focus:ring-1 focus:ring-orange-500 ${appearanceMode === 'light' ? 'bg-gray-50 text-gray-600' : 'bg-gray-900 text-gray-400'}`} placeholder="0:00" value={track.duration || ''} onChange={(e) => updateTrack('sideA', i, 'duration', e.target.value)} /></div>
                  <div className="flex gap-2 pl-8"><input className={`flex-1 border-none rounded px-2 py-1 text-xs focus:ring-1 focus:ring-orange-500 ${appearanceMode === 'light' ? 'bg-gray-50 text-gray-600 placeholder-gray-400' : 'bg-gray-900 text-gray-300 placeholder-gray-500'}`} placeholder="艺术家" value={track.artist || ''} onChange={(e) => updateTrack('sideA', i, 'artist', e.target.value)} /></div>
                  <input className={`w-full border-none rounded px-2 py-1 text-xs italic focus:ring-1 focus:ring-orange-500 ${appearanceMode === 'light' ? 'bg-gray-50 text-gray-500 placeholder-gray-400' : 'bg-gray-900 text-gray-400 placeholder-gray-700'}`} placeholder="备注/心情..." value={track.note || ''} onChange={(e) => updateTrack('sideA', i, 'note', e.target.value)} />
                </div>
              ))}
            </section>
            <section className="space-y-4">
              <h3 className="text-xs font-bold text-gray-500 pl-1">B 面 (SIDE B)</h3>
              {data.sideB.map((track, i) => (
                <div key={i} className={`p-3 rounded border space-y-2 group ${appearanceMode === 'light' ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700'}`}>
                  <div className="flex gap-2"><div className="w-6 text-gray-500 text-sm font-mono flex items-center justify-center">{i + 1}</div><input className={`flex-1 border-none rounded px-2 py-1 text-sm focus:ring-1 focus:ring-orange-500 ${appearanceMode === 'light' ? 'bg-gray-50 text-gray-900 placeholder-gray-400' : 'bg-gray-900 text-white placeholder-gray-600'}`} placeholder="标题" value={track.title || ''} onChange={(e) => updateTrack('sideB', i, 'title', e.target.value)} /><input className={`w-16 border-none rounded px-2 py-1 text-sm text-center focus:ring-1 focus:ring-orange-500 ${appearanceMode === 'light' ? 'bg-gray-50 text-gray-600' : 'bg-gray-900 text-gray-400'}`} placeholder="0:00" value={track.duration || ''} onChange={(e) => updateTrack('sideB', i, 'duration', e.target.value)} /></div>
                  <div className="flex gap-2 pl-8"><input className={`flex-1 border-none rounded px-2 py-1 text-xs focus:ring-1 focus:ring-orange-500 ${appearanceMode === 'light' ? 'bg-gray-50 text-gray-600 placeholder-gray-400' : 'bg-gray-900 text-gray-300 placeholder-gray-500'}`} placeholder="艺术家" value={track.artist || ''} onChange={(e) => updateTrack('sideB', i, 'artist', e.target.value)} /></div>
                  <input className={`w-full border-none rounded px-2 py-1 text-xs italic focus:ring-1 focus:ring-orange-500 ${appearanceMode === 'light' ? 'bg-gray-50 text-gray-500 placeholder-gray-400' : 'bg-gray-900 text-gray-400 placeholder-gray-700'}`} placeholder="备注/心情..." value={track.note || ''} onChange={(e) => updateTrack('sideB', i, 'note', e.target.value)} />
                </div>
              ))}
            </section>
          </div>

        </div>

        {/* Right Panel */}
        <div className={`flex-1 flex flex-col items-center justify-center relative p-8 ${appearanceMode === 'light' ? 'bg-gray-200' : 'bg-black'}`}>
          <div className={`w-full transition-all duration-500 max-w-5xl`}>
            <JCardPreview
              data={data}
              theme={theme}
              coverImage={coverImage}
              svgRef={svgRef}
              appearanceMode={appearanceMode}
              recordingData={recordingData}
            />
          </div>
          <p className={`mt-6 text-sm font-mono ${appearanceMode === 'light' ? 'text-gray-500' : 'text-gray-600'}`}>预览：J-CARD 四折页布局 (U-CARD 风格)</p>
          <div className={`mt-4 text-xs font-mono flex flex-col items-center gap-1 opacity-60 ${appearanceMode === 'light' ? 'text-gray-400' : 'text-gray-600'}`}>
            {/* 
              * Update: Version is now injected via Vite's `define` config
              * sourced from package.json.
              */}
            <span>{__APP_VERSION__}</span>
            <span>@ 门耳朵制作</span>
            <span>加入群聊【磁带封面生成器】(QQ群: 140785966)</span>
          </div>
        </div>
      </main>
    </div>
  );
}
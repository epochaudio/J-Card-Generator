import React, { useState, useRef, useEffect } from 'react';
import {
    Sparkles, Download, Disc, Music, Type, Palette, Wand2, Search, X,
    Image as ImageIcon, Trash2, Database, Globe, Loader2,
    ImageDown, Upload, RotateCcw, Moon, Sun, Droplet, LayoutTemplate,
    FileText
} from 'lucide-react';

// --- GLOBAL API KEY (Provided by Environment) ---
// The execution environment provides the key at runtime.
const apiKey = "";

// --- MOCK CONFIGURATION & SERVICES (Originally external files) ---

// 1. Font Configuration
const FONT_THEMES = {
    modern: { id: 'modern', name: 'Modern Sans', description: 'Clean and minimal', fonts: { title: 'Inter, sans-serif', body: 'Inter, sans-serif', mono: 'monospace' } },
    serif: { id: 'serif', name: 'Classic Serif', description: 'Elegant and traditional', fonts: { title: 'Georgia, serif', body: 'Times New Roman, serif', mono: 'Courier New, monospace' } },
    retro: { id: 'retro', name: 'Retro 80s', description: 'Bold and nostalgic', fonts: { title: 'Impact, sans-serif', body: 'Arial, sans-serif', mono: 'Courier New, monospace' } },
    hand: { id: 'hand', name: 'Handwritten', description: 'Personal and casual', fonts: { title: 'Comic Sans MS, cursive', body: 'Segoe Print, cursive', mono: 'Consolas, monospace' } }
};

const getFontConfig = (themeId) => {
    return FONT_THEMES[themeId] || FONT_THEMES.modern;
};

// 2. Gemini Service (Direct Environment Call)
const GeminiService = {
    // Helper for text generation
    _generateText: async (prompt, jsonMode = false) => {
        // Directly use the global apiKey injected by the environment
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

        const body = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.7,
            }
        };

        if (jsonMode) {
            body.generationConfig.responseMimeType = "application/json";
        }

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const err = await response.json();
                // Friendly error message mapping
                const errorMsg = err.error?.message || "Text generation failed";
                if (errorMsg.includes("API key")) {
                    throw new Error("Environment API Key invalid or missing.");
                }
                throw new Error(errorMsg);
            }

            const data = await response.json();
            return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        } catch (e) {
            console.error("Gemini Text API Error:", e);
            throw e;
        }
    },

    parseImportData: async (text) => {
        const prompt = `Parse the following tracklist text into a JSON object with keys: 'album_title', 'album_artist', 'sideA' (array of {title, artist, duration, note}), 'sideB' (same structure). Text: \n${text}`;
        const jsonStr = await GeminiService._generateText(prompt, true);
        return JSON.parse(jsonStr);
    },

    enhanceContent: async (data) => {
        const prompt = `Analyze this album data: ${JSON.stringify(data)}. Return a JSON object with enhanced 'album_title' (uppercase), 'album_copy' (short catchy slogan), 'cover_prompt' (for image gen), and 'negative_prompt'.`;
        const jsonStr = await GeminiService._generateText(prompt, true);
        return JSON.parse(jsonStr);
    },

    suggestTitle: async (tracks) => {
        const prompt = `Suggest a creative album title based on these tracks: ${JSON.stringify(tracks)}. Return JSON with key 'suggested_title'.`;
        const jsonStr = await GeminiService._generateText(prompt, true);
        return JSON.parse(jsonStr);
    },

    generateImage: async (prompt) => {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`;
        const body = {
            instances: [{ prompt: prompt }],
            // UPDATED: Added aspectRatio "3:4" for vertical album covers
            parameters: {
                sampleCount: 1,
                aspectRatio: "3:4"
            }
        };

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error?.message || "Image generation failed.");
            }

            const data = await response.json();
            const base64 = data.predictions?.[0]?.bytesBase64Encoded;
            if (!base64) throw new Error("No image data returned from API.");

            return `data:image/png;base64,${base64}`;
        } catch (e) {
            console.error("Gemini Image API Error:", e);
            throw e;
        }
    },

    generateImagePrompt: async (isDark, tracks, notes, title, artist) => {
        const prompt = `Create a detailed image generation prompt for a VERTICAL (Portrait) album cover art.
    Album: "${title}" by "${artist}". 
    Vibe: ${isDark ? 'Dark, moody' : 'Light, airy'}. 
    Tracks context: ${JSON.stringify(tracks.slice(0, 5))}. 
    IMPORTANT INSTRUCTION: 
    1. Vertical composition (aspect ratio 3:4).
    2. The image MUST incorporate the text "${title}" (Album Title) and "${artist}" (Artist Name) artistically into the scene. 
    3. The typography should be integrated into the artwork (e.g., on a neon sign, a poster on a wall, carved in stone, or stylized floating text). 
    4. Ensure correct spelling.
    Return JSON with 'cover_prompt' and 'negative_prompt'.`;

        const jsonStr = await GeminiService._generateText(prompt, true);
        return JSON.parse(jsonStr);
    },

    generateSlogan: async (tracks) => {
        const prompt = `Write a short, poetic slogan (2 lines max) for this album tracklist. Return JSON with key 'slogan'.`;
        const jsonStr = await GeminiService._generateText(prompt, true);
        return JSON.parse(jsonStr);
    }
};

// 3. Export Service (Mock Implementation)
const ExportService = {
    getEmbeddableFontStyles: async (theme) => {
        return ""; // In a real app, this would fetch base64 fonts
    }
};

const __APP_VERSION__ = "v1.7.0-canvas-full-fill";

// --- Color Extraction Service ---
const ColorExtractor = {
    extractColor(imageSrc) {
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
    },
    getContrastYIQ(hexcolor) {
        if (!hexcolor) return 'light';
        hexcolor = hexcolor.replace("#", "");
        var r = parseInt(hexcolor.substr(0, 2), 16);
        var g = parseInt(hexcolor.substr(2, 2), 16);
        var b = parseInt(hexcolor.substr(4, 2), 16);
        var yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return (yiq >= 128) ? 'dark' : 'light';
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
        // Note: CORS issues are common with direct fetches in browser. 
        // In a production app, this usually requires a proxy.
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
        const url = `https://musicbrainz.org/ws/2/release/${releaseId}?inc=recordings+artist-credits+labels+recording-level-rels+work-level-rels+artist-rels&fmt=json`;
        const res = await fetch(url, { headers: { 'User-Agent': MusicBrainzService.userAgent } });
        const data = await res.json();

        // Parse Advanced Credits
        data.credits = MusicBrainzService.parseCredits(data);
        // Parse Classical Works
        data.works = MusicBrainzService.parseWorks(data);

        return data;
    },

    parseCredits: (data) => {
        const credits = { producers: [], engineers: [], performers: [] };
        const add = (arr, name) => { if (!arr.includes(name)) arr.push(name); };

        // 1. Release Level
        if (data.relations) {
            data.relations.forEach(r => {
                const name = r.artist?.name;
                if (!name) return;
                if (r.type === 'producer') add(credits.producers, name);
                if (['mix', 'engineer', 'mastering'].some(k => r.type.includes(k))) add(credits.engineers, name);
            });
        }

        // 2. Track Level (Sample all tracks for comprehensive credits)
        if (data.media) {
            data.media.forEach(m => {
                m.tracks?.forEach(t => {
                    t.recording?.relations?.forEach(r => {
                        const name = r.artist?.name;
                        if (!name) return;
                        if (r.type === 'producer') add(credits.producers, name);
                        if (['mix', 'engineer', 'recording'].some(k => r.type.includes(k))) add(credits.engineers, name);
                        if (['conductor'].some(k => r.type.includes(k))) add(credits.performers, `${name} (Conductor)`);
                    });
                });
            });
        }
        return credits;
    },

    parseWorks: (data) => {
        const workMap = {};
        if (!data.media) return null;

        data.media.forEach(m => {
            m.tracks?.forEach(t => {
                const workRel = t.recording?.relations?.find(r => r['target-type'] === 'work');
                if (workRel && workRel.work) {
                    const w = workRel.work;
                    if (!workMap[w.id]) {
                        const composerRel = w.relations?.find(r => r.type === 'composer');
                        workMap[w.id] = {
                            id: w.id,
                            title: w.title,
                            composer: composerRel?.artist?.name,
                            tracks: []
                        };
                    }
                    workMap[w.id].tracks.push(t.id);
                    t._workId = w.id;
                    t._workTitle = w.title;
                    t._workComposer = composerRel?.artist?.name;
                }
            });
        });

        const works = Object.values(workMap);
        return works.length > 0 ? works : null;
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
        if (releaseData.works && releaseData.works.length > 0) return 'CLASSICAL';

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

    groupTracksNested: (tracks) => {
        // Strategy A: Work ID Based Grouping
        const hasWorkData = tracks.some(t => t._workId);
        if (hasWorkData) {
            const result = [];
            let i = 0;
            while (i < tracks.length) {
                const current = tracks[i];
                if (current._workId) {
                    let j = i + 1;
                    while (j < tracks.length && tracks[j]._workId === current._workId) {
                        j++;
                    }
                    const groupTitle = current._workComposer
                        ? `${current._workComposer}: ${current._workTitle}`
                        : current._workTitle;

                    const subTracks = tracks.slice(i, j).map(t => {
                        let suffix = t.title.replace(groupTitle, '').trim();
                        suffix = suffix.replace(/^[:\-,\s]+/, '').replace(/^I+\.\s+/, '');
                        if (!suffix) suffix = t.title;
                        return { ...t, displayTitle: suffix };
                    });
                    result.push({ type: 'group', title: groupTitle, tracks: subTracks });
                    i = j;
                } else {
                    result.push({ type: 'track', ...current, displayTitle: current.title });
                    i++;
                }
            }
            return result;
        }

        // Strategy B: Legacy Prefix Matching
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

const ContentFront = ({ xOffset, width, data, theme, coverImage, isLight, textColor, subTextColor, titleLayout, titleStartY, badgeY, artistY, fontConfig, hideFrontText }) => {
    const badgeText = data.coverBadge || "";
    const badgeLines = TextUtils.getWrappedLines(badgeText, 38);
    const badgeLineHeight = 26;

    return (
        <g transform={`translate(${xOffset}, 0)`}>
            <rect x="0" y="0" width={width} height="1181" fill="url(#grid)" opacity="0.2" />
            {coverImage ? (
                <>
                    {/* UPDATED: Full Height Fill Logic */}
                    <svg x="0" y="0" width={width} height="1181" viewBox="0 0 1200 1600" preserveAspectRatio="xMidYMid slice">
                        <image href={coverImage} width="1200" height="1600" preserveAspectRatio="xMidYMid slice" filter="url(#bg-blur)" transform="scale(1.1)" transform-origin="center" />
                        <image href={coverImage} width="1200" height="1600" preserveAspectRatio="xMidYMid slice" transform-origin="center" />
                    </svg>
                    <rect x="0" y="1179" width={width} height="2" fill={textColor} opacity="0.5" />
                </>
            ) : (
                <path d={`M ${width / 2 - 200} 400 Q ${width / 2} 100 ${width / 2 + 200} 400`} stroke={theme.accent} strokeWidth="4" fill="none" opacity="0.8" />
            )}

            {/* Conditionally render Overlay Text based on hideFrontText prop */}
            {!hideFrontText && (
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
                                    x="750"
                                    y={badgeY + (i * badgeLineHeight)}
                                    fontFamily={fontConfig?.fonts?.serif || "Georgia, serif"}
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

                    <text x="750" y={artistY} fontFamily={fontConfig?.fonts?.body || "Arial, sans-serif"} fontSize="24" fill={subTextColor} textAnchor="middle" style={{ textShadow: isLight ? "none" : "0 2px 4px rgba(0,0,0,0.8)" }}>
                        {data.artist}{theme.mood_description ? ` · ${theme.mood_description}` : ""}
                    </text>
                </g>
            )}
        </g>
    )
}

const ContentBack = ({ width, data, theme, isCompact, isLight, textColor, subTextColor, dimTextColor, recordingData, fontConfig }) => {
    const contentHeight = 1181;
    const marginY = isCompact ? 60 : 80;
    const footerHeight = isCompact ? 40 : 60;
    const headerHeight = isCompact ? 25 : 50;
    const gapBetweenSides = isCompact ? 20 : 60;
    const verticalPadding = isCompact ? 40 : 40;

    const staticHeight = marginY + headerHeight + gapBetweenSides + headerHeight + footerHeight;
    const availableForTracks = contentHeight - staticHeight;

    const hasNoteUpper = !!data.layout?.noteUpper;
    const hasNoteLower = !!data.layout?.noteLower;

    const isClassical = data.layout.mode === 'CLASSICAL';

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

    const countRoughLines = (groups) => groups.reduce((acc, item) => {
        if (item.type === 'group') return acc + 1 + item.tracks.length;
        return acc + 1;
    }, 0);

    const roughTotalLines = countRoughLines(groupsA) + countRoughLines(groupsB);
    const roughLH = roughTotalLines > 0 ? availableForTracks / roughTotalLines : 50;
    const showNotesGlobal = !isCompact && roughLH > 45;

    const fontRatio = 0.55;
    const maxFont = isCompact ? 15 : 25;
    const minFont = isCompact ? 8 : 12;

    let estFontSize = Math.floor(roughLH * fontRatio);
    estFontSize = Math.min(Math.max(estFontSize, minFont), maxFont);

    const usableWidth = width - 80;
    const safeTextWidthConst = 0.7;

    const dynamicWrapLimit = Math.max(10, Math.floor(usableWidth / (estFontSize * safeTextWidthConst)));

    const wrapCharsHeader = Math.floor(dynamicWrapLimit * 0.9);
    const wrapCharsContent = Math.floor(dynamicWrapLimit * 1.5);

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
                const lines = TextUtils.getWrappedLines(item.displayTitle, wrapCharsHeader).length;
                let noteHeight = 0;
                if (showNotesGlobal && item.note) {
                    const noteLines = TextUtils.getWrappedLines(item.note, wrapCharsContent).length;
                    noteHeight = Math.min(noteLines, 2) * 0.6;
                }
                return acc + 1 + (lines - 1) * 0.85 + noteHeight;
            }
        }, 0);
    };

    const visualLinesA = calculateRealVisualLines(groupsA);
    const visualLinesB = calculateRealVisualLines(groupsB);
    const totalVisualItems = visualLinesA + visualLinesB;

    const maxLH = isCompact ? 50 : 110;
    const minLH = isCompact ? 16 : 30;

    let calculatedLH = totalVisualItems > 0 ? availableForTracks / totalVisualItems : maxLH;
    calculatedLH = Math.min(Math.max(calculatedLH, minLH), maxLH);

    let fontSize = Math.floor(calculatedLH * fontRatio);
    fontSize = Math.min(Math.max(fontSize, minFont), maxFont);

    const trackFontSize = fontSize;
    const groupHeaderFontSize = Math.min(trackFontSize + 2, maxFont + 2);
    const noteFontSize = Math.max(fontSize * 0.6, 8);

    const yHeaderA = marginY;
    const yListA = yHeaderA + headerHeight;
    const heightA = visualLinesA * calculatedLH;
    const yDivider = yListA + heightA + (gapBetweenSides / 2);
    const yHeaderB = yDivider + (gapBetweenSides / 2);
    const yListB = yHeaderB + headerHeight;

    const showSideLabel = !isCompact;

    const renderGroupList = (groups, startGlobalIdx) => {
        let yCursor = 0;
        let localIdx = startGlobalIdx;

        return groups.map((item, i) => {
            if (item.type === 'group') {
                const headerLines = TextUtils.getWrappedLines(item.title, wrapCharsHeader);

                const headerNode = headerLines.map((line, lineIdx) => (
                    <text key={`h-${i}-${lineIdx}`} x="-5" y={yCursor + calculatedLH * 0.6 + (lineIdx * calculatedLH * 0.85)} fill={textColor} fontSize={groupHeaderFontSize} fontWeight="bold" dominantBaseline="middle" fontFamily={fontConfig?.fonts?.title || "Arial, sans-serif"}>
                        {line}
                    </text>
                ));

                yCursor += calculatedLH + (headerLines.length - 1) * calculatedLH * 0.85;

                let contentNode = null;

                if (renderStrategy === 'INLINE_COMPACT') {
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
                    yCursor += calculatedLH * 0.2;
                    localIdx += item.tracks.length;

                } else {
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
                const thisY = yCursor;
                localIdx++;

                const noteWrapLimit = wrapCharsContent;
                const hasNote = showNotesGlobal && item.note;
                const noteLines = hasNote ? TextUtils.getWrappedLines(item.note, noteWrapLimit) : [];

                const titleLines = TextUtils.getWrappedLines(item.displayTitle, wrapCharsHeader);

                const trackNode = titleLines.map((line, lineIdx) => {
                    const isFirstLine = lineIdx === 0;
                    return (
                        <text key={`t-${i}-${lineIdx}`} x="0" y={thisY + calculatedLH * (hasNote ? 0.35 : 0.5) + (lineIdx * calculatedLH * 0.85)} fill={subTextColor} fontSize={trackFontSize} dominantBaseline="middle">
                            {isFirstLine && !isClassical && <tspan fontWeight="bold" fill={theme.accent}>{String(localIdx).padStart(2, '0')}.</tspan>}
                            <tspan fontWeight="bold" dx={isFirstLine ? 5 : 28}>{line}</tspan>
                            {isFirstLine && (data.layout?.mode === 'COMPILATION') && !isCompact && <tspan fill={dimTextColor}> - {item.artist}</tspan>}
                            {isFirstLine && !isCompact && !isClassical && <tspan fontSize={Math.max(trackFontSize - 4, 10)} fill={dimTextColor}> ({item.duration})</tspan>}
                        </text>
                    )
                });

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
            {(isClassical && isCompact) ? (
                <g transform={`translate(${width}, 0) rotate(90)`} fontFamily={fontConfig?.fonts?.mono || "Courier New, monospace"}>
                    {(() => {
                        const labelText = (recordingData?.labelOverride || data.tapeSubtitle || "LABEL INFO").toUpperCase();
                        const labelLines = TextUtils.getWrappedLines(labelText, 20);
                        const labelY = 40;
                        const lineHeight = 28;
                        const sourceY = labelY + (labelLines.length * lineHeight) + 20;

                        return (
                            <g>
                                {labelLines.map((line, i) => (
                                    <text key={`l-${i}`} x="50" y={labelY + (i * lineHeight)} fontSize="24" fontWeight="bold" fill={textColor} letterSpacing="2" dominantBaseline="hanging">
                                        {line}
                                    </text>
                                ))}
                                <g transform={`translate(50, ${sourceY})`}>
                                    <text x="0" y="0" fontSize="14" fill={dimTextColor} letterSpacing="3" uppercase="true">SOURCE</text>
                                    <text x="0" y="25" fontSize="18" fill={subTextColor} fontWeight="bold" textAnchor="start">{recordingData?.source || "N/A"}</text>
                                </g>
                            </g>
                        )
                    })()}

                    <g transform={`translate(380, 40)`}>
                        {(() => {
                            const lines = [];
                            const credits = recordingData?.credits;

                            if (credits) {
                                if (credits.producers?.length) {
                                    lines.push({ type: 'header', text: 'PRODUCED BY' });
                                    lines.push({ type: 'body', text: credits.producers.slice(0, 2).join(', ').toUpperCase() });
                                }
                                if (credits.engineers?.length) {
                                    lines.push({ type: 'header', text: 'ENGINEERED BY' });
                                    lines.push({ type: 'body', text: credits.engineers.slice(0, 2).join(', ').toUpperCase() });
                                }
                            }

                            let cursorY = 0;
                            return lines.map((item, idx) => {
                                if (item.type === 'header') {
                                    const node = <text key={idx} x="0" y={cursorY} fontSize="14" fill={dimTextColor} letterSpacing="3">{item.text}</text>;
                                    cursorY += 24;
                                    return node;
                                } else {
                                    const wrapped = TextUtils.getWrappedLines(item.text, 30);
                                    const nodes = wrapped.map((w, wIdx) => (
                                        <text key={`${idx}-${wIdx}`} x="0" y={cursorY + (wIdx * 20)} fontSize="18" fill={subTextColor} fontFamily={fontConfig?.fonts?.body || "Arial, sans-serif"} fontWeight="bold">
                                            {w}
                                        </text>
                                    ));
                                    cursorY += wrapped.length * 20 + 25;
                                    return nodes;
                                }
                            });
                        })()}
                    </g>

                    <g transform={`translate(750, 40)`}>
                        <text x="0" y="0" fontSize="14" fill={dimTextColor} letterSpacing="3" uppercase="true">EQUIPMENT</text>
                        {(() => {
                            const eqText = recordingData?.equipment || "N/A";
                            const eqLines = TextUtils.getWrappedLines(eqText.toUpperCase(), 30);
                            return eqLines.map((line, i) => (
                                <text key={i} x="0" y={30 + (i * 20)} fontSize="18" fill={subTextColor} fontFamily={fontConfig?.fonts?.body || "Arial, sans-serif"} fontWeight="bold">
                                    {line}
                                </text>
                            ));
                        })()}
                    </g>

                    <g transform={`translate(${contentHeight - 50}, 40)`}>
                        <g>
                            <text x="0" y="0" fontSize="14" fill={dimTextColor} letterSpacing="3" textAnchor="end">RELEASED</text>
                            <text x="0" y="30" fontSize="24" fill={textColor} fontWeight="bold" textAnchor="end">
                                {(data.releaseDate || "").split(/[-.]/)[0]}
                            </text>
                        </g>
                        <g transform={`translate(0, 80)`}>
                            <text x="0" y="0" fontSize="14" fill={dimTextColor} letterSpacing="3" textAnchor="end">RECORDED</text>
                            <text x="0" y="30" fontSize="24" fill={theme.accent} fontWeight="bold" textAnchor="end">
                                {recordingData?.recDate || "2025.01.01"}
                            </text>
                        </g>
                    </g>
                </g>
            ) : (
                <g transform={`translate(0, 0)`}>
                    <g transform={`translate(${verticalPadding}, ${yHeaderA})`}>
                        <rect x="0" y="-15" width="40" height="20" fill={textColor} rx="4" />
                        <text x="20" y="0" fontFamily={fontConfig?.fonts?.body || "Arial, sans-serif"} fontWeight="bold" fontSize="14" fill={isLight ? "#fff" : "#121212"} textAnchor="middle" dominantBaseline="middle">A</text>
                        {showSideLabel && <text x="50" y="0" fontFamily={fontConfig?.fonts?.body || "Arial, sans-serif"} fontWeight="bold" fontSize="14" fill={theme.accent} letterSpacing="1" dominantBaseline="middle">SIDE A</text>}
                        <text x={width - verticalPadding * 2 - (hasNoteLower ? 20 : 0) - (hasNoteUpper ? 20 : 0) - (isCompact ? 0 : 20)} y="0" fontFamily={fontConfig?.fonts?.body || "Arial, sans-serif"} fontSize={12} fill={dimTextColor} textAnchor="end" dominantBaseline="middle">{data.sideADuration}</text>
                    </g>

                    <g transform={`translate(${verticalPadding}, ${yListA})`} fontFamily={fontConfig?.fonts?.body || "Arial, sans-serif"}>
                        {renderGroupList(groupsA, 0)}
                    </g>

                    <line x1={verticalPadding} y1={yDivider} x2={width - verticalPadding * 2 - (hasNoteLower ? 20 : 0) - (hasNoteUpper ? 20 : 0)} y2={yDivider} stroke={dimTextColor} strokeWidth="1" opacity="0.5" />

                    <g transform={`translate(${verticalPadding}, ${yHeaderB})`}>
                        <rect x="0" y="-15" width="40" height="20" fill={textColor} rx="4" />
                        <text x="20" y="0" fontFamily={fontConfig?.fonts?.body || "Arial, sans-serif"} fontWeight="bold" fontSize="14" fill={isLight ? "#fff" : "#121212"} textAnchor="middle" dominantBaseline="middle">B</text>
                        {showSideLabel && <text x="50" y="0" fontFamily={fontConfig?.fonts?.body || "Arial, sans-serif"} fontWeight="bold" fontSize="14" fill={theme.accent} letterSpacing="1" dominantBaseline="middle">SIDE B</text>}
                        <text x={width - verticalPadding * 2 - (hasNoteLower ? 20 : 0) - (hasNoteUpper ? 20 : 0) - (isCompact ? 0 : 20)} y="0" fontFamily={fontConfig?.fonts?.body || "Arial, sans-serif"} fontSize={12} fill={dimTextColor} textAnchor="end" dominantBaseline="middle">{data.sideBDuration}</text>
                    </g>

                    <g transform={`translate(${verticalPadding}, ${yListB})`} fontFamily={fontConfig?.fonts?.body || "Arial, sans-serif"}>
                        {renderGroupList(groupsB, data.sideA.length)}
                    </g>
                </g>
            )}
        </g>
    )
}

const JCardPreview = ({ data, theme, coverImage, svgRef, recordingData, jCardThemeMode, dominantColor, contrastTextType, fontConfig }) => {
    const curThemeMode = jCardThemeMode || 'dark';
    const curDominantColor = dominantColor || '#232629';
    const curContrastType = contrastTextType || 'light';

    const { title, artist, sideA, sideB, sideADuration, sideBDuration, tapeId, tapeSubtitle, coverBadge, layout } = data;
    const width = 1748;
    const height = 1181;
    const hideFrontText = layout?.hideFrontText || false;

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
    } else {
        bgFill = "#232629";
        textColor = "#eff0f1";
        subTextColor = "#b0b3b8";
        dimTextColor = "#7d8187";
    }

    const isLight = isLightModeLogic;

    if (isMinimalSpine) {
        spineFill = isLight ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)";
        spineTitleColor = textColor;
        spineIdColor = theme.accent;
    }

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

    const imgBottom = 780;
    const fixedArtistY = 1125;
    const titleLineH = titleLayout.lineHeight;
    const titleTotalH = titleLayout.lines.length * titleLineH;
    const badgeTextStr = data.coverBadge || "";
    const badgeLines = TextUtils.getWrappedLines(badgeTextStr, 42);
    const badgeLineH = 26;
    const badgeTotalH = badgeLines.length > 0 ? (badgeLines.length * badgeLineH) : 0;
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

    const formatText = (text) => data.layout?.forceCaps ? String(text).toUpperCase() : String(text);

    const getSpineTitleSize = (text) => {
        const len = text ? text.length : 0;
        if (len > 30) return 32;
        if (len > 20) return 36;
        return 42;
    }

    const wShort = 200;
    const wSpine = 150;
    const wFront = 780;
    const wBack = 618;

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
                <text x="0" y="0" fontFamily={fontConfig?.fonts?.title || "Arial, sans-serif"} fontWeight="bold" fontSize={getSpineTitleSize(title)} fill={spineTitleColor} textAnchor="middle" dominantBaseline="middle" transform="rotate(-90)">{formatText(title)}</text>

                {(() => {
                    const topEdge = (height / 2) - 40;
                    const hasNote = !!data.layout?.noteUpper;
                    const hasId = !!tapeId;

                    const noteUpperNode = hasNote ? (
                        <text key="sp-note-up" x={topEdge} y={hasId ? -12 : 0} fontFamily={fontConfig?.fonts?.body || "Arial, sans-serif"} fontSize="14" fill={spineIdColor} textAnchor="end" dominantBaseline="middle" transform="rotate(-90)" letterSpacing="1" opacity="0.8">
                            {formatText(data.layout.noteUpper)}
                        </text>
                    ) : null;

                    const idNode = hasId ? (
                        <text key="sp-id" x={topEdge} y={hasNote ? 12 : 0} fontFamily={fontConfig?.fonts?.body || "Arial, sans-serif"} fontWeight="bold" fontSize="18" fill={spineIdColor} textAnchor="end" dominantBaseline="middle" transform="rotate(-90)">
                            {tapeId}
                        </text>
                    ) : null;

                    return <>{noteUpperNode}{idNode}</>;
                })()}

                {(() => {
                    const bottomEdge = -((height / 2) - 40);
                    let currentX = bottomEdge;
                    const safeGap = 80;

                    const noteLowerNode = data.layout?.noteLower ? (
                        <text key="sp-note-low" x={currentX} y="0" fontFamily={fontConfig?.fonts?.body || "Arial, sans-serif"} fontSize="14" fill={spineTitleColor} textAnchor="start" dominantBaseline="middle" transform="rotate(-90)" letterSpacing="1" opacity="0.8">
                            {formatText(data.layout.noteLower)}
                        </text>
                    ) : null;

                    if (data.layout?.noteLower) currentX += safeGap;

                    const artistNode = (
                        <text key="sp-artist" x={currentX} y="0" fontFamily={fontConfig?.fonts?.body || "Arial, sans-serif"} fontSize="24" fill={spineTitleColor} textAnchor="start" dominantBaseline="middle" transform="rotate(-90)">
                            {formatText(artist)}
                        </text>
                    );

                    return <>{noteLowerNode}{artistNode}</>;
                })()}
            </g>

            <g clipPath="url(#panel-front)">
                <ContentFront xOffset={xFront} width={wFront} data={data} theme={theme} coverImage={coverImage} isLight={isLight} textColor={textColor} subTextColor={subTextColor} titleLayout={titleLayout} titleStartY={titleStartY} badgeY={badgeY} artistY={artistY} fontConfig={fontConfig} hideFrontText={hideFrontText} />
            </g>

            <g clipPath="url(#panel-flap)" transform={`translate(${xBack}, 0)`}>
                <ContentBack width={wBack} data={data} theme={theme} isLight={isLight} textColor={textColor} subTextColor={subTextColor} dimTextColor={dimTextColor} recordingData={recordingData} fontConfig={fontConfig} />
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

    const [jCardThemeMode, setJCardThemeMode] = useState('dark');
    const [dominantColor, setDominantColor] = useState('#232629');
    const [contrastTextType, setContrastTextType] = useState('light');

    useEffect(() => {
        const savedTheme = localStorage.getItem('jcard_theme_mode');
        if (savedTheme) setJCardThemeMode(savedTheme);
    }, []);

    useEffect(() => {
        localStorage.setItem('jcard_theme_mode', jCardThemeMode);
    }, [jCardThemeMode]);

    const [fontTheme, setFontTheme] = useState('modern');

    useEffect(() => {
        const savedFontTheme = localStorage.getItem('jcard_font_theme');
        if (savedFontTheme && FONT_THEMES[savedFontTheme]) {
            setFontTheme(savedFontTheme);
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('jcard_font_theme', fontTheme);
    }, [fontTheme]);

    const currentFontConfig = getFontConfig(fontTheme);

    useEffect(() => {
        if (coverImage) {
            ColorExtractor.extractColor(coverImage).then(color => {
                setDominantColor(color);
                const contrast = ColorExtractor.getContrastYIQ(color);
                setContrastTextType(contrast === 'dark' ? 'dark' : 'light');
            });
        } else {
            setDominantColor('#232629');
            setContrastTextType('light');
        }
    }, [coverImage]);

    const toggleTheme = () => {
        const modes = ['dark', 'light', 'cover', 'color'];
        const nextIndex = (modes.indexOf(jCardThemeMode) + 1) % modes.length;
        setJCardThemeMode(modes[nextIndex]);
    };

    const [imagePrompt, setImagePrompt] = useState("");
    const [searchQuery, setSearchQuery] = useState({ album: '', artist: '' });
    const [searchResults, setSearchResults] = useState([]);
    const [showSearch, setShowSearch] = useState(false);
    const [showImport, setShowImport] = useState(false);
    const [importText, setImportText] = useState('');

    // Removed manual API key loading logic

    const [data, setData] = useState({
        title: "ALBUM TITLE",
        artist: "ARTIST NAME",
        tapeId: "ID-001",
        tapeSubtitle: "STEREO",
        releaseDate: "",
        coverBadge: "",
        sideADuration: "20:00",
        sideBDuration: "20:00",
        layout: {
            noteUpper: "",
            noteLower: "",
            forceCaps: true,
            minimalSpine: false,
            mode: 'STANDARD',
            hideFrontText: false
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

    const [recordingData, setRecordingData] = useState({
        equipment: "",
        mode: "AAA",
        labelOverride: "",
        source: "",
        recDate: ""
    });

    useEffect(() => {
        const saved = localStorage.getItem('jcard_recording_data');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                const today = new Date().toISOString().split('T')[0];
                setRecordingData({
                    ...parsed,
                    recDate: today
                });
            } catch (e) {
                console.error("Failed to parse saved recording data", e);
            }
        } else {
            setRecordingData(prev => ({
                ...prev,
                recDate: new Date().toISOString().split('T')[0]
            }));
        }
    }, []);

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

            if (releaseData.credits) {
                setRecordingData(prev => ({
                    ...prev,
                    credits: releaseData.credits
                }));
            }

            const rawTracks = (releaseData.media || []).flatMap(m => m.tracks || []).map(t => ({
                title: t.title,
                artist: t['artist-credit']?.[0]?.name || rg['artist-credit']?.[0]?.name || "Unknown",
                duration: MusicBrainzService.formatDuration(t.length),
                note: "",
                _workId: t._workId,
                _workTitle: t._workTitle,
                _workComposer: t._workComposer
            }));

            const sumDur = (tracks) => {
                const parseDurationToMs = (durationStr) => {
                    if (!durationStr || !durationStr.includes(':')) return 0;
                    const parts = durationStr.split(':').map(Number);
                    if (parts.length === 2) {
                        return (parts[0] * 60 + parts[1]) * 1000;
                    }
                    return 0;
                };
                const ms = tracks.reduce((acc, t) => acc + parseDurationToMs(t.duration), 0);
                return MusicBrainzService.formatDuration(ms);
            };

            const half = Math.ceil(rawTracks.length / 2);
            const sideA = rawTracks.slice(0, half);
            const sideB = rawTracks.slice(half);

            setData({
                title: rg.title,
                artist: rg['artist-credit']?.[0]?.name,
                releaseDate: date || "",
                tapeSubtitle: (labelName && catalogNumber) ? `${labelName} ${catalogNumber}` : (labelName || catalogNumber || ""),
                coverBadge: "",
                sideA: sideA,
                sideB: sideB,
                sideADuration: sumDur(sideA),
                sideBDuration: sumDur(sideB),
                layout: {
                    ...data.layout,
                    mode: LayoutEngine.detectMode(releaseData, rawTracks),
                    noteUpper: "",
                    noteLower: "STEREO",
                    forceCaps: false,
                    worksData: releaseData.works
                }
            });
            if (coverUrl) setCoverImage(coverUrl);
            setShowSearch(false);
        } catch (e) { setError("Import failed: " + e.message); } finally { setLoadingSearch(false); }
    };

    const handleSmartImport = async () => {
        if (!importText.trim()) return;
        setLoadingImport(true);
        setError('');
        try {
            const parsed = await GeminiService.parseImportData(importText);
            const updates = {};

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

                if (updates.sideA.length > 0) {
                    const totalMsA = updates.sideA.reduce((acc, t) => acc + parseDurationToMs(t.duration), 0);
                    updates.sideADuration = MusicBrainzService.formatDuration(totalMsA);
                }

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

            const testTracksA = updates.sideA || data.sideA;
            const testTracksB = updates.sideB || data.sideB;
            const allTestTracks = [...testTracksA, ...testTracksB];

            const mockReleaseData = {
                'artist-credit': [{ name: updates.artist || data.artist }],
                'release-group': { 'secondary-types': [] }
            };
            const detectedMode = LayoutEngine.detectMode(mockReleaseData, allTestTracks);

            updates.layout = {
                ...data.layout,
                mode: detectedMode
            };

            if (updates.sideA) updates.sideA = updates.sideA.map(t => ({ ...t, note: t.note || '' }));
            if (updates.sideB) updates.sideB = updates.sideB.map(t => ({ ...t, note: t.note || '' }));

            setData(prev => ({ ...prev, ...updates }));
            setShowImport(false);
            setImportText('');
        } catch (err) {
            setError(err.message || "Failed to parse text.");
        } finally {
            setLoadingImport(false);
        }
    };

    const handleAIEnhance = async () => {
        setLoading(true); setError('');
        try {
            const parsed = await GeminiService.enhanceContent(data);

            const updates = {};
            if (parsed.album_title) updates.title = parsed.album_title.toUpperCase();
            if (parsed.album_copy) updates.coverBadge = parsed.album_copy;

            setData(prev => ({ ...prev, ...updates }));

            if (parsed.cover_prompt) {
                setImagePrompt(parsed.cover_prompt + (parsed.negative_prompt ? `\n\nNegative: ${parsed.negative_prompt}` : ""));
            }

        } catch (err) { setError(err.message); } finally { setLoading(false); }
    };

    const handleTitleMagic = async () => {
        setLoadingTitle(true);
        try {
            const allTracks = [...data.sideA, ...data.sideB];
            const result = await GeminiService.suggestTitle(allTracks);
            if (result.suggested_title) setData(prev => ({ ...prev, title: result.suggested_title.toUpperCase() }));
        } catch (err) { setError(err.message); } finally { setLoadingTitle(false); }
    };

    const handleGenerateCover = async () => {
        if (!imagePrompt.trim()) {
            alert("Please enter a description in the 'AI Image Prompt' box first.");
            return;
        }

        setLoadingImage(true); setError('');
        try {
            // FORCE INJECT TEXT INSTRUCTION
            // Even if user wrote a custom prompt, we append the text requirement to ensure it happens.
            const textInstruction = ` IMPORTANT: The image MUST incorporate the text "${data.title}" and "${data.artist}" artistically into the scene.`;
            const finalPrompt = imagePrompt.trim() + textInstruction;

            const imgDataUrl = await GeminiService.generateImage(finalPrompt);
            setCoverImage(imgDataUrl);

            // AUTO-HIDE OVERLAY TEXT
            // Because the image now contains the text baked in.
            setData(prev => ({
                ...prev,
                layout: { ...prev.layout, hideFrontText: true }
            }));

        } catch (err) { setError(err.message); } finally { setLoadingImage(false); }
    };

    const handleGenerateCoverPrompt = async () => {
        setLoadingPrompt(true); setError('');
        try {
            const allTracks = [...data.sideA, ...data.sideB];
            const isDark = jCardThemeMode === 'dark';
            const notes = allTracks.map(t => t.note).join(' ');

            // Pass title and artist to the prompt generator
            const result = await GeminiService.generateImagePrompt(isDark, allTracks, notes, data.title, data.artist);

            if (result.cover_prompt) {
                let fullPrompt = result.cover_prompt;
                if (result.negative_prompt) {
                    fullPrompt += `\n\nNegative: ${result.negative_prompt}`;
                }
                setImagePrompt(fullPrompt);
            }
        } catch (err) { setError(err.message); } finally { setLoadingPrompt(false); }
    };

    const handleGenerateSlogan = async () => {
        setLoadingSlogan(true); setError('');
        try {
            const allTracks = [...data.sideA, ...data.sideB];
            const result = await GeminiService.generateSlogan(allTracks);
            if (result.slogan) {
                const formattedSlogan = Array.isArray(result.slogan) ? result.slogan.join('\n') : result.slogan;
                setData(prev => ({ ...prev, coverBadge: formattedSlogan }));
            }
        } catch (err) { setError(err.message); } finally { setLoadingSlogan(false); }
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

    const downloadPNG = async () => {
        if (!svgRef.current) return;

        let svgData = new XMLSerializer().serializeToString(svgRef.current);

        try {
            const fontStyles = await ExportService.getEmbeddableFontStyles(fontTheme);
            if (fontStyles) {
                if (svgData.includes('<defs>')) {
                    svgData = svgData.replace('<defs>', `<defs><style>${fontStyles}</style>`);
                } else {
                    svgData = svgData.replace(/<svg[^>]*>/, match => `${match}<defs><style>${fontStyles}</style></defs>`);
                }
            }
        } catch (e) {
            console.error("Font embedding failed:", e);
        }

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
        if (window.confirm("Are you sure you want to clear everything and start a new project?\n(API Key and settings will be preserved)")) {
            setData({
                title: "ALBUM TITLE",
                artist: "ARTIST NAME",
                tapeId: "ID-001",
                tapeSubtitle: "STEREO",
                releaseDate: "",
                coverBadge: "",
                sideADuration: "20:00",
                sideBDuration: "20:00",
                layout: {
                    noteUpper: "",
                    noteLower: "",
                    forceCaps: true,
                    minimalSpine: false,
                    mode: 'STANDARD',
                    hideFrontText: false
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

            setCoverImage(null);
            setSearchResults([]);
            setImportText("");
            setImagePrompt("");
            setError("");

            const today = new Date().toISOString().split('T')[0];
            setRecordingData(prev => ({
                ...prev,
                recDate: today
            }));
        }
    };

    return (
        <div className="flex flex-col h-screen overflow-hidden font-sans relative bg-gray-50 text-gray-900">

            {showImport && (
                <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg border border-gray-700 flex flex-col max-h-[90vh] text-white">
                        <div className="flex justify-between items-center p-4 border-b border-gray-700">
                            <h3 className="text-lg font-bold flex items-center gap-2"><FileText size={20} className="text-orange-500" /> Paste Tracklist</h3>
                            <button onClick={() => setShowImport(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
                        </div>
                        <div className="p-4 flex-1 overflow-hidden flex flex-col">
                            <p className="text-sm text-gray-400 mb-2">Paste raw text, HTML or JSON below. AI will extract the info.</p>
                            <textarea
                                className="w-full flex-1 bg-gray-900 p-4 rounded text-sm font-mono border border-gray-700 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none resize-none"
                                placeholder={`1. Song A - Artist (3:20)\n2. Song B - Artist\n...`}
                                value={importText}
                                onChange={(e) => setImportText(e.target.value)}
                            />
                        </div>
                        <div className="p-4 border-t border-gray-700 flex justify-end gap-3">
                            <button onClick={() => setShowImport(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
                            <button
                                onClick={handleSmartImport}
                                disabled={loadingImport || !importText}
                                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded text-sm font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loadingImport ? <span className="animate-spin">⏳</span> : <Sparkles size={16} />}
                                {loadingImport ? 'Analyzing...' : 'Parse & Import'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showSearch && (
                <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl border border-gray-700 flex flex-col max-h-[85vh] text-white">
                        <div className="flex justify-between items-center p-4 border-b border-gray-700">
                            <h3 className="text-lg font-bold flex items-center gap-2"><Database size={20} className="text-orange-500" /> Search MusicBrainz</h3>
                            <button onClick={() => setShowSearch(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
                        </div>
                        <div className="p-4 bg-gray-900/50 space-y-3 border-b border-gray-700">
                            <div className="flex gap-3">
                                <input className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm focus:border-orange-500 outline-none" placeholder="Album Title (e.g., Abbey Road)" value={searchQuery.album} onChange={(e) => setSearchQuery({ ...searchQuery, album: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
                                <input className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm focus:border-orange-500 outline-none" placeholder="Artist (e.g., The Beatles)" value={searchQuery.artist} onChange={(e) => setSearchQuery({ ...searchQuery, artist: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
                                <button onClick={handleSearch} disabled={loadingSearch} className="px-4 bg-orange-600 hover:bg-orange-500 text-white rounded font-bold text-sm flex items-center gap-2">{loadingSearch ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />} Search</button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                            {error && <div className="p-4 text-red-400 bg-red-900/20 text-center rounded">{error}</div>}
                            {searchResults.map((rg) => (
                                <div key={rg.id} className="bg-gray-700/50 hover:bg-gray-700 p-3 rounded flex justify-between items-center cursor-pointer transition-colors border border-transparent hover:border-orange-500/50" onClick={() => handleSelectReleaseGroup(rg)}>
                                    <div><h4 className="font-bold text-white">{rg.title}</h4><p className="text-sm text-gray-400">{rg['artist-credit']?.[0]?.name} · {rg['first-release-date']?.slice(0, 4)} · {rg['primary-type']}</p></div>
                                    <button className="px-3 py-1 bg-gray-600 hover:bg-orange-600 text-xs rounded text-white transition-colors">Select</button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <header className="flex items-center justify-between px-6 py-4 border-b shrink-0 bg-white border-gray-200 shadow-sm relative z-10">
                <div className="flex items-center gap-2"><Disc className="text-orange-500 w-6 h-6" /><h1 className="text-xl font-bold tracking-wider">J-CARD GENERATOR <span className="text-orange-500 text-sm">(GENESIS)</span></h1></div>
                <div className="flex items-center gap-3">

                    <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                        {Object.values(FONT_THEMES).map(theme => (
                            <button
                                key={theme.id}
                                onClick={() => setFontTheme(theme.id)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold uppercase transition-all ${fontTheme === theme.id
                                    ? 'bg-white text-gray-900 shadow-sm ring-1 ring-black/5'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                                    }`}
                                title={theme.description}
                            >
                                <Type size={14} />
                                <span className="hidden xl:inline">{theme.name.split(' ')[0]}</span>
                            </button>
                        ))}
                    </div>

                    <div className="h-6 w-px bg-gray-300 mx-1"></div>

                    <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                        {['dark', 'light', 'cover', 'color'].map(mode => (
                            <button
                                key={mode}
                                onClick={() => setJCardThemeMode(mode)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold uppercase transition-all ${jCardThemeMode === mode
                                    ? 'bg-white text-gray-900 shadow-sm ring-1 ring-black/5'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                                    }`}
                                title={`Switch to ${mode} mode`}
                            >
                                {mode === 'dark' && <Moon size={14} />}
                                {mode === 'light' && <Sun size={14} />}
                                {mode === 'cover' && <ImageIcon size={14} />}
                                {mode === 'color' && <Palette size={14} />}
                                <span className="hidden xl:inline">{mode}</span>
                            </button>
                        ))}
                    </div>

                    <div className="h-6 w-px bg-gray-300 mx-2"></div>
                    <button onClick={handleReset} className="p-2 rounded-full transition-colors text-gray-400 hover:bg-gray-100 hover:text-red-500" title="New Project / Reset"><RotateCcw size={20} /></button>
                    <div className="h-6 w-px bg-gray-600 mx-1 opacity-20"></div>
                    <button onClick={handleAIEnhance} disabled={loading} className={`flex items-center gap-2 px-4 py-2 rounded-md font-semibold transition-all ${loading ? 'bg-gray-600 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white shadow-lg hover:shadow-indigo-500/20'}`}>{loading ? <span className="animate-spin">✨</span> : <Sparkles size={18} />}{loading ? 'Planning...' : 'AI Creative Director'}</button>

                    <button onClick={downloadSVG} className="flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 shadow-sm"><Download size={18} />Export SVG</button>
                    <button onClick={downloadPNG} className="flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors bg-gray-900 hover:bg-gray-800 text-white shadow-sm"><ImageDown size={18} />Export PNG</button>
                </div>
            </header>

            <main className="flex flex-1 overflow-hidden">
                <div className="flex flex-col lg:flex-row gap-8 w-full h-full">
                    <div className="w-full lg:w-2/3 flex flex-col items-center justify-center relative p-8">
                        <div className={`w-full transition-all duration-500 max-w-5xl`}>
                            <JCardPreview
                                data={data}
                                theme={theme}
                                coverImage={coverImage}
                                svgRef={svgRef}
                                jCardThemeMode={jCardThemeMode}
                                dominantColor={dominantColor}
                                contrastTextType={contrastTextType}
                                recordingData={recordingData}
                                fontConfig={currentFontConfig}
                            />
                        </div>
                        <p className="mt-6 text-sm font-mono text-gray-500">Preview: J-Card 4-Panel Layout (U-Card Style)</p>
                        <div className="mt-4 text-xs font-mono flex flex-col items-center gap-1 opacity-60 text-gray-400">
                            <span>{__APP_VERSION__}</span>
                            <span>@ Epoch Audio</span>
                            <span>This software is open source and free for non-commercial use.</span>
                        </div>
                    </div>

                    <div className="w-full lg:w-1/3 min-w-[350px] overflow-y-auto border-l border-gray-200 bg-white p-6 space-y-8 custom-scrollbar">
                        <section className="space-y-4">
                            <h2 className="text-sm uppercase tracking-widest text-gray-500 font-bold flex items-center gap-2"><Type size={14} /> Album Info</h2>
                            <div className="space-y-3">
                                <div><label className="block text-xs text-gray-400 mb-1">Album Title</label><div className="flex gap-2"><input type="text" value={data.title || ''} onChange={(e) => setData({ ...data, title: e.target.value })} className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-orange-500 outline-none bg-white text-gray-900" /><button onClick={handleTitleMagic} disabled={loadingTitle} className="px-3 border border-gray-300 rounded transition-colors bg-white text-orange-600 hover:bg-gray-50">{loadingTitle ? <span className="animate-spin text-xs">⏳</span> : <Wand2 size={16} />}</button></div></div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div><label className="block text-xs text-gray-400 mb-1">Artist</label><input type="text" value={data.artist || ''} onChange={(e) => setData({ ...data, artist: e.target.value })} className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-orange-500 outline-none bg-white text-gray-900" /></div>
                                    <div><label className="block text-xs text-gray-400 mb-1">Release Date</label><input type="text" value={data.releaseDate || ''} onChange={(e) => setData({ ...data, releaseDate: e.target.value })} className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-orange-500 outline-none bg-white text-gray-900" placeholder="YYYY" /></div>
                                    <div><label className="block text-xs text-gray-400 mb-1">Catalog ID</label><input type="text" value={data.tapeId || ''} onChange={(e) => setData({ ...data, tapeId: e.target.value })} className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-orange-500 outline-none bg-white text-gray-900" /></div>
                                </div>
                                <div><label className="block text-xs text-gray-400 mb-1">Cover Slogan</label><div className="flex gap-2"><textarea rows={3} maxLength={200} value={data.coverBadge || ''} onChange={(e) => setData({ ...data, coverBadge: e.target.value })} className="flex-1 border border-gray-300 rounded p-2 focus:ring-2 focus:ring-orange-500 outline-none placeholder-gray-500 resize-none bg-white text-gray-900" placeholder="e.g. A timeless classic..." /><button onClick={handleGenerateSlogan} disabled={loadingSlogan} className="px-2 border border-gray-300 rounded self-start transition-colors h-20 flex items-center justify-center bg-white text-purple-600 hover:bg-purple-50">{loadingSlogan ? <span className="animate-spin text-xs">⏳</span> : <Sparkles size={16} />}</button></div></div>
                            </div>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-sm uppercase tracking-widest text-gray-500 font-bold flex items-center gap-2"><LayoutTemplate size={14} /> Layout Options</h2>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className="block text-xs text-gray-400 mb-1">Top Note</label><input type="text" value={data.layout.noteUpper || ''} onChange={(e) => setData({ ...data, layout: { ...data.layout, noteUpper: e.target.value } })} className="w-full border border-gray-300 rounded p-2 text-xs focus:ring-2 focus:ring-orange-500 outline-none bg-white text-gray-900" placeholder="e.g. STEREO / Date" /></div>
                                <div><label className="block text-xs text-gray-400 mb-1">Bottom Note</label><input type="text" value={data.layout.noteLower || ''} onChange={(e) => setData({ ...data, layout: { ...data.layout, noteLower: e.target.value } })} className="w-full border border-gray-300 rounded p-2 text-xs focus:ring-2 focus:ring-orange-500 outline-none bg-white text-gray-900" placeholder="e.g. 2023 Release" /></div>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Layout Mode</label>
                                <div className="flex gap-2 text-xs">
                                    {['STANDARD', 'CLASSICAL', 'COMPILATION'].map(mode => (
                                        <button
                                            key={mode}
                                            onClick={() => setData({ ...data, layout: { ...data.layout, mode } })}
                                            className={`flex-1 py-1 rounded border transition-colors ${data.layout.mode === mode
                                                ? 'bg-orange-600 text-white border-orange-600'
                                                : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                                        >
                                            {mode === 'STANDARD' ? 'Standard' : mode === 'CLASSICAL' ? 'Classical' : 'Compilation'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                                    <input type="checkbox" checked={data.layout.forceCaps} onChange={(e) => setData({ ...data, layout: { ...data.layout, forceCaps: e.target.checked } })} className="rounded text-orange-500 focus:ring-orange-500 bg-white border-gray-300" /> Force Caps
                                </label>
                                <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                                    <input type="checkbox" checked={data.layout.minimalSpine} onChange={(e) => setData({ ...data, layout: { ...data.layout, minimalSpine: e.target.checked } })} className="rounded text-orange-500 focus:ring-orange-500 bg-white border-gray-300" /> Minimal Spine
                                </label>
                            </div>
                        </section>

                        <section className="space-y-4">
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider border-b border-gray-700 pb-2">Metadata</h3>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Recording Equipment</label>
                                <div className="relative">
                                    <textarea
                                        value={recordingData.equipment || ""}
                                        onChange={(e) => updateRecordingData('equipment', e.target.value)}
                                        rows={4}
                                        className="w-full bg-transparent border border-gray-300 rounded p-2 text-sm focus:border-red-500 outline-none transition-colors resize-none text-gray-800"
                                        placeholder="e.g. Neumann U47 / Studer A80..."
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Label Override</label>
                                <input
                                    type="text"
                                    value={recordingData.labelOverride || ""}
                                    onChange={(e) => updateRecordingData('labelOverride', e.target.value)}
                                    className="w-full bg-transparent border-b border-gray-300 py-1 text-sm focus:border-red-500 outline-none transition-colors text-gray-800"
                                    placeholder="Overrides standard label info"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Source</label>
                                <input
                                    type="text"
                                    value={recordingData.source || ""}
                                    onChange={(e) => updateRecordingData('source', e.target.value)}
                                    className="w-full bg-transparent border-b border-gray-300 py-1 text-sm focus:border-red-500 outline-none transition-colors text-gray-800"
                                    placeholder="e.g. Vinyl / SACD ISO"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Rec Date</label>
                                <input
                                    type="text"
                                    value={recordingData.recDate || ""}
                                    onChange={(e) => updateRecordingData('recDate', e.target.value)}
                                    className="w-full bg-transparent border-b border-gray-300 py-1 text-sm focus:border-red-500 outline-none transition-colors text-gray-800"
                                    placeholder="YYYY-MM-DD"
                                />
                            </div>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-sm uppercase tracking-widest text-gray-500 font-bold flex items-center gap-2"><Palette size={14} /> Cover Design</h2>

                            <div><label className="block text-xs text-gray-400 mb-1">Accent Color</label><div className="flex items-center gap-2"><input type="color" value={theme.accent || '#000000'} onChange={(e) => setTheme({ ...theme, accent: e.target.value })} className="h-8 w-8 rounded cursor-pointer bg-transparent border-none" /><button onClick={handleAutoColor} disabled={!coverImage} className={`p-1.5 rounded hover:bg-gray-600 transition-colors ${!coverImage ? 'opacity-30 cursor-not-allowed' : 'text-orange-400 hover:text-white'}`}><Droplet size={16} /></button></div></div>

                            <div>
                                <label className="block text-xs text-gray-400 mb-1 flex justify-between items-center">
                                    AI Image Prompt
                                    <button onClick={handleGenerateCoverPrompt} disabled={loadingPrompt} className="text-[10px] bg-purple-600 hover:bg-purple-500 text-white px-2 py-0.5 rounded flex items-center gap-1">
                                        {loadingPrompt ? <span className="animate-spin">⏳</span> : <Wand2 size={10} />}
                                        {loadingPrompt ? 'Generating...' : 'Generate Prompt'}
                                    </button>
                                </label>
                                <textarea
                                    className="w-full border border-gray-300 rounded p-2 text-xs h-20 focus:ring-2 focus:ring-orange-500 outline-none resize-none bg-white text-gray-900"
                                    placeholder="Describe your desired cover..."
                                    value={imagePrompt}
                                    onChange={(e) => setImagePrompt(e.target.value)}
                                />
                            </div>

                            {/* NEW: Toggle for AI Text Mode */}
                            <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer mb-2">
                                <input
                                    type="checkbox"
                                    checked={data.layout.hideFrontText}
                                    onChange={(e) => setData({ ...data, layout: { ...data.layout, hideFrontText: e.target.checked } })}
                                    className="rounded text-orange-500 focus:ring-orange-500 bg-white border-gray-300"
                                />
                                Hide Overlay Text (Use AI-Generated Text)
                            </label>

                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Cover Image</label>
                                <div className="flex gap-2">
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileUpload}
                                        accept="image/*"
                                        className="hidden"
                                    />
                                    <button onClick={() => fileInputRef.current?.click()} className="flex-1 rounded text-xs py-2 flex items-center justify-center gap-1 transition-colors bg-white border border-gray-300 hover:bg-gray-50 text-gray-700"><Upload size={14} /> Upload Image</button>
                                    <button onClick={handleGenerateCover} disabled={loadingImage} className="flex-1 rounded text-xs py-2 flex items-center justify-center gap-1 transition-colors bg-white border border-gray-300 hover:bg-gray-50 text-gray-700">{loadingImage ? <span className="animate-spin">⏳</span> : <ImageIcon size={14} />} {loadingImage ? 'Generating...' : 'AI Generate'}</button>
                                    {coverImage && (<button onClick={() => setCoverImage(null)} className="w-8 bg-red-900/50 hover:bg-red-800 rounded flex items-center justify-center text-red-200"><Trash2 size={14} /></button>)}
                                </div>
                            </div>
                        </section>

                        <div className="flex items-center justify-between border-b pb-2 border-gray-200">
                            <h2 className="text-sm uppercase tracking-widest text-gray-500 font-bold flex items-center gap-2"><Music size={14} /> Tracklist</h2>
                            <div className="flex gap-2">
                                <button onClick={() => setShowImport(true)} className="text-xs flex items-center gap-1 px-2 py-1 rounded transition-colors bg-white border border-gray-300 hover:bg-gray-50 text-orange-600"><FileText size={12} /> Paste Text</button>
                                <button onClick={() => setShowSearch(true)} className="text-xs flex items-center gap-1 px-2 py-1 rounded transition-colors bg-white border border-gray-300 hover:bg-gray-50 text-orange-600"><Globe size={12} /> Search MusicBrainz</button>
                            </div>
                        </div>
                        <section className="space-y-4">
                            <h3 className="text-xs font-bold text-gray-500 pl-1">Side A</h3>
                            {data.sideA.map((track, i) => (
                                <div key={i} className="p-3 rounded border space-y-2 group bg-white border-gray-200">
                                    <div className="flex gap-2"><div className="w-6 text-gray-500 text-sm font-mono flex items-center justify-center">{i + 1}</div><input className="flex-1 border-none rounded px-2 py-1 text-sm focus:ring-1 focus:ring-orange-500 bg-gray-50 text-gray-900 placeholder-gray-400" placeholder="Title" value={track.title || ''} onChange={(e) => updateTrack('sideA', i, 'title', e.target.value)} /><input className="w-16 border-none rounded px-2 py-1 text-sm text-center focus:ring-1 focus:ring-orange-500 bg-gray-50 text-gray-600" placeholder="0:00" value={track.duration || ''} onChange={(e) => updateTrack('sideA', i, 'duration', e.target.value)} /></div>
                                    <div className="flex gap-2 pl-8"><input className="flex-1 border-none rounded px-2 py-1 text-xs focus:ring-1 focus:ring-orange-500 bg-gray-50 text-gray-600 placeholder-gray-400" placeholder="Artist" value={track.artist || ''} onChange={(e) => updateTrack('sideA', i, 'artist', e.target.value)} /></div>
                                    <input className="w-full border-none rounded px-2 py-1 text-xs italic focus:ring-1 focus:ring-orange-500 bg-gray-50 text-gray-500 placeholder-gray-400" placeholder="Note/Mood..." value={track.note || ''} onChange={(e) => updateTrack('sideA', i, 'note', e.target.value)} />
                                </div>
                            ))}
                        </section>
                        <section className="space-y-4">
                            <h3 className="text-xs font-bold text-gray-500 pl-1">Side B</h3>
                            {data.sideB.map((track, i) => (
                                <div key={i} className="p-3 rounded border space-y-2 group bg-white border-gray-200">
                                    <div className="flex gap-2"><div className="w-6 text-gray-500 text-sm font-mono flex items-center justify-center">{i + 1}</div><input className="flex-1 border-none rounded px-2 py-1 text-sm focus:ring-1 focus:ring-orange-500 bg-gray-50 text-gray-900 placeholder-gray-400" placeholder="Title" value={track.title || ''} onChange={(e) => updateTrack('sideB', i, 'title', e.target.value)} /><input className="w-16 border-none rounded px-2 py-1 text-sm text-center focus:ring-1 focus:ring-orange-500 bg-gray-50 text-gray-600" placeholder="0:00" value={track.duration || ''} onChange={(e) => updateTrack('sideB', i, 'duration', e.target.value)} /></div>
                                    <div className="flex gap-2 pl-8"><input className="flex-1 border-none rounded px-2 py-1 text-xs focus:ring-1 focus:ring-orange-500 bg-gray-50 text-gray-600 placeholder-gray-400" placeholder="Artist" value={track.artist || ''} onChange={(e) => updateTrack('sideB', i, 'artist', e.target.value)} /></div>
                                    <input className="w-full border-none rounded px-2 py-1 text-xs italic focus:ring-1 focus:ring-orange-500 bg-gray-50 text-gray-500 placeholder-gray-400" placeholder="Note/Mood..." value={track.note || ''} onChange={(e) => updateTrack('sideB', i, 'note', e.target.value)} />
                                </div>
                            ))}
                        </section>

                    </div>

                </div >
            </main >
        </div >
    );
}
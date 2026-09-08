import React, { useEffect, useMemo, useRef, useState } from 'react';
import brandIcon from './src/assets/branding/tapefolio-icon.png';
import { flushSync } from 'react-dom';
import { Sparkles, Download, Music, Type, Palette, Wand2, Settings, Image as ImageIcon, Trash2, Globe, Printer, Eye, Sun, Moon, Droplet, LayoutTemplate, FileText, ImageDown, Upload, ListTree, RotateCcw, Plus, GripVertical } from 'lucide-react';

import { JCARD_DIMENSIONS, STORAGE_KEYS } from './src/constants/app.js';
import ImportModal from './src/components/ImportModal.jsx';
import JCardPreview from './src/components/JCardPreview.jsx';
import DesignPanel from './src/components/DesignPanel.jsx';
import { rasterizeSVG } from './src/services/SVGRasterizer.js';
import CoverInfoPanel from './src/enrichment/CoverInfoPanel.jsx';
import SmartDesignPanel from './src/design/SmartDesignPanel.jsx';
import { applyDesignFields } from './src/design/smartDesign.mjs';
import { computeFrontLayout } from './src/utils/FrontLayout.js';
import { PALETTES } from './src/config/design.mjs';
import SearchModal from './src/components/SearchModal.jsx';
import SettingsModal from './src/components/SettingsModal.jsx';
import ColorExtractor from './src/services/ColorExtractor.js';
import { createAIContentService } from './src/services/AIContentService.js';
import useAISettings from './src/ai/useAISettings.jsx';
import { PROVIDERS } from './src/ai/providerConfig.mjs';
import ExportService from './src/services/ExportService.js';
import MusicBrainzService from './src/services/MusicBrainzService.js';
import { createImportSnapshot } from './src/musicbrainz/importProject.mjs';
import { getFontConfig, FONT_THEMES } from './src/config/fonts.js';
import { parseDurationToMs } from './src/utils/formatDuration.mjs';
import { urlToBase64 } from './src/utils/imageUtils.js';
import LayoutEngine from './src/utils/LayoutEngine.js';
import { normalizeShortBackMode } from './src/utils/ShortBackModeResolver.js';
import SpineLayoutEngine from './src/utils/SpineLayoutEngine.js';
import { localDate, normalizeSnapshot } from './src/project/projectFormat.mjs';
import useProjectFiles from './src/project/useProjectFiles.jsx';
import ProjectControls from './src/project/ProjectControls.jsx';

let trackIdCounter = 0;
const NOTE_LOWER_MAX_VISIBLE_CHARS = 16;
const NOTE_LOWER_RECOMMENDED_VISIBLE_CHARS = 12;

const segmentVisibleChars = (text = '') => {
  const normalized = String(text || '');

  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    return Array.from(segmenter.segment(normalized), (segment) => segment.segment);
  }

  return Array.from(normalized);
};

const truncateVisibleChars = (text = '', maxVisibleChars = Infinity) => (
  segmentVisibleChars(text).slice(0, maxVisibleChars).join('')
);

const createTrackId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  trackIdCounter += 1;
  return `track-${Date.now()}-${trackIdCounter}`;
};

const formatTrackDurationTotal = (tracks) => (
  MusicBrainzService.formatDuration(
    tracks.reduce((acc, track) => acc + parseDurationToMs(track.duration), 0)
  )
);

const createTrack = ({
  id,
  title = '',
  artist = 'Artist Name',
  duration = '0:00',
  note = '',
  ...rest
} = {}) => ({
  id: id || createTrackId(),
  title,
  artist,
  duration,
  note,
  ...rest
});

const normalizeTrack = (track = {}, fallbackArtist = 'Artist Name') => ({
  ...track,
  id: track.id || createTrackId(),
  artist: track.artist || fallbackArtist,
  note: track.note || ''
});

const normalizeTrackList = (tracks = [], fallbackArtist = 'Artist Name') => (
  tracks.map(track => normalizeTrack(track, fallbackArtist))
);

const normalizeLayoutSettings = (layout = {}) => {
  const normalizedLayout = {
    noteUpper: "",
    noteLower: "",
    coverBadgeAlign: 'center',
    forceCaps: true,
    minimalSpine: false,
    mode: 'STANDARD',
    frontStyle: 'STANDARD',
    spineInverted: true,
    ...layout,
  };

  return {
    ...normalizedLayout,
    noteLower: truncateVisibleChars(normalizedLayout.noteLower, NOTE_LOWER_MAX_VISIBLE_CHARS),
    shortBackMode: normalizeShortBackMode(normalizedLayout.mode, normalizedLayout.shortBackMode)
  };
};

const normalizeProjectData = (projectData) => {
  const fallbackArtist = projectData?.artist || 'Artist Name';
  const sideA = normalizeTrackList(projectData?.sideA || [], fallbackArtist);
  const sideB = normalizeTrackList(projectData?.sideB || [], fallbackArtist);

  return {
    ...projectData,
    layout: normalizeLayoutSettings(projectData?.layout),
    sideA,
    sideB,
    sideADuration: formatTrackDurationTotal(sideA),
    sideBDuration: formatTrackDurationTotal(sideB)
  };
};

const arrayMove = (items, fromIndex, toIndex) => {
  if (fromIndex === toIndex) return items;

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, movedItem);
  return nextItems;
};

const createDefaultData = () => ({
  title: "ALBUM TITLE",
  spineTitle: "",
  artist: "ARTIST NAME",
  tapeId: "",
  tapeSubtitle: "STEREO",
  releaseDate: "",
  coverBadge: "",
  sideADuration: "20:00",
  sideBDuration: "20:00",
  layout: normalizeLayoutSettings({ titleSize: 'balanced', texture: false }),
  sideA: [
    createTrack({ title: "Track Name 1", artist: "Artist Name", duration: "3:45", note: "" }),
    createTrack({ title: "Track Name 2", artist: "Artist Name", duration: "4:20", note: "" }),
    createTrack({ title: "Track Name 3", artist: "Artist Name", duration: "3:15", note: "" }),
    createTrack({ title: "Track Name 4", artist: "Artist Name", duration: "5:10", note: "" }),
    createTrack({ title: "Track Name 5", artist: "Artist Name", duration: "4:05", note: "" })
  ],
  sideB: [
    createTrack({ title: "Track Name 6", artist: "Artist Name", duration: "3:50", note: "" }),
    createTrack({ title: "Track Name 7", artist: "Artist Name", duration: "4:15", note: "" }),
    createTrack({ title: "Track Name 8", artist: "Artist Name", duration: "3:30", note: "" }),
    createTrack({ title: "Track Name 9", artist: "Artist Name", duration: "4:45", note: "" }),
    createTrack({ title: "Track Name 10", artist: "Artist Name", duration: "3:55", note: "" })
  ]
});

const createDefaultRecordingData = () => ({
  equipment: "",
  mode: "AAA",
  labelOverride: "",
  source: "",
  recDate: ""
});

const createEmptyTrack = (trackNumber = 1, artist = "Artist Name") => ({
  ...createTrack({
    title: `Track Name ${trackNumber}`,
    artist,
    duration: "0:00",
    note: ""
  })
});

const SHORT_BACK_MODE_OPTIONS = [
  { value: 'META_ARCHIVE', label: '档案信息' },
  { value: 'TRACKS_COMPACT', label: '紧凑曲目' }
];

const COVER_BADGE_ALIGN_OPTIONS = [
  { value: 'center', label: '居中' },
  { value: 'left', label: '靠左' }
];

const readPreference = (key, fallback) => {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
};
const initialRecordingData = () => {
  let previous = {};
  try { previous = JSON.parse(readPreference(STORAGE_KEYS.recordingData, '{}')); } catch { /* Keep defaults for damaged preferences. */ }
  return { ...createDefaultRecordingData(), equipment: previous?.equipment || '', source: previous?.source || '', recDate: localDate() };
};

export default function App() {
  const projectEpoch = useRef(0);
  const restoredCover = useRef(undefined);
  const aiSettings = useAISettings();
  const aiService = useMemo(() => createAIContentService(aiSettings.settings), [aiSettings.settings]);
  const textProviderName = PROVIDERS[aiSettings.settings.textProvider]?.name || '请选择文本服务商';
  const imageProviderName = PROVIDERS[aiSettings.settings.imageProvider]?.name || '请选择图片服务商';
  const textKeyConfigured = Boolean(aiSettings.settings.providers[aiSettings.settings.textProvider]?.apiKey);
  const imageKeyConfigured = Boolean(aiSettings.settings.providers[aiSettings.settings.imageProvider]?.apiKey);
  const svgRef = useRef(null);
  const [loadingStates, setLoadingStates] = useState({
    title: false,
    search: false,
    import: false,
    image: false,
    slogan: false,
    prompt: false
  });
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const fileInputRefB = useRef(null); // [NEW] Ref for Cover B input

  const [coverImage, setCoverImage] = useState(null);
  const [coverImageB, setCoverImageB] = useState(null); // [NEW] Side B Cover

  const [data, setData] = useState(() => createDefaultData());
  // --- Theme System ---
  // modes: 'dark' (default #232629), 'cover' (blurred image), 'color' (dominant color)
  const [jCardThemeMode, setJCardThemeMode] = useState(() => readPreference(STORAGE_KEYS.themeMode, 'dark'));
  const [dominantColor, setDominantColor] = useState('#232629');

  const [fontTheme, setFontTheme] = useState(() => {
    const saved = readPreference(STORAGE_KEYS.fontTheme, 'modern');
    return FONT_THEMES[saved] ? saved : 'modern';
  });

  // Refresh measured layout after the selected fonts finish loading.
  const [fontMetricsVersion, setFontMetricsVersion] = useState(0);
  const [backStatus, setBackStatus] = useState({ folded: false, overflow: false });

  useEffect(() => {
    if (typeof document === 'undefined' || !document.fonts?.ready) return undefined;

    let active = true;
    ExportService.ensureFonts(getFontConfig(fontTheme)).then(() => {
      if (active) setFontMetricsVersion(prev => prev + 1);
    }).catch(error => { if (active) setError(error.message); });

    return () => {
      active = false;
    };
  }, [fontTheme]);

  // Extract color when cover image changes
  useEffect(() => {
    let cancelled = false;
    if (coverImage) {
      ColorExtractor.extractColor(coverImage, { representative: true }).then(color => {
        if (cancelled) return;
        setDominantColor(color);
      });
    } else {
      // Reset if no cover
      setDominantColor('#232629');
    }
    return () => { cancelled = true; };
  }, [coverImage]);

  const [imagePrompt, setImagePrompt] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');

  const setLoadingState = (key, value) => {
    setLoadingStates(prev => ({ ...prev, [key]: value }));
  };

  const saveAISettings = async next => {
    const result = await aiSettings.save(next);
    // Results from requests using the previous configuration cannot update the current editor.
    projectEpoch.current += 1;
    setLoadingStates({});
    return result;
  };

  const currentFontConfig = useMemo(() => getFontConfig(fontTheme), [fontTheme]);
  const [previewData, setPreviewData] = useState(() => createDefaultData());
  const [dragState, setDragState] = useState(null);

  // --- NEW: Custom Recording Metadata State with Persistence ---
  const [recordingData, setRecordingData] = useState(initialRecordingData);
  const [previewRecordingData, setPreviewRecordingData] = useState(initialRecordingData);

  const updateRecordingData = (field, value) => {
    setRecordingData(prev => ({ ...prev, [field]: value }));
  };

  const [theme, setTheme] = useState({
    background: "#121212",
    accent: PALETTES.paper.accent,
    paletteId: 'paper',
    mood_description: ""
  });

  const projectSnapshot = useMemo(() => ({ data, recordingData, coverImage, coverImageB, theme, fontTheme, jCardThemeMode, imagePrompt }),
    [data, recordingData, coverImage, coverImageB, theme, fontTheme, jCardThemeMode, imagePrompt]);

  const applyProject = (snapshot) => {
    const next = normalizeSnapshot(snapshot);
    projectEpoch.current += 1;
    restoredCover.current = next.coverImage;
    flushSync(() => {
      setData(next.data); setPreviewData(next.data);
      setRecordingData(next.recordingData); setPreviewRecordingData(next.recordingData);
      setCoverImage(next.coverImage); setCoverImageB(next.coverImageB);
      setTheme(next.theme); setFontTheme(next.fontTheme); setJCardThemeMode(next.jCardThemeMode);
      setImagePrompt(next.imagePrompt);
      setLoadingStates({}); setError('');
      setImportText(''); setDragState(null); setShowImport(false); setShowSearch(false);
    });
  };
  const newProject = () => normalizeSnapshot({
    ...projectSnapshot, data: createDefaultData(), coverImage: null, coverImageB: null, imagePrompt: '',
    recordingData: { ...createDefaultRecordingData(), equipment: recordingData.equipment, source: recordingData.source, recDate: localDate() }
  });
  const projectFiles = useProjectFiles(projectSnapshot, applyProject, newProject);

  const applySmartDesign = patch => {
    const next = applyDesignFields(projectSnapshot, patch);
    flushSync(() => {
      setData(next.data); setPreviewData(next.data);
      setTheme(next.theme); setFontTheme(next.fontTheme);
    });
  };

  useEffect(() => {
    if (!projectFiles.ready) return;
    try {
      localStorage.setItem(STORAGE_KEYS.themeMode, jCardThemeMode);
      localStorage.setItem(STORAGE_KEYS.fontTheme, fontTheme);
      localStorage.setItem(STORAGE_KEYS.recordingData, JSON.stringify({ equipment: recordingData.equipment, source: recordingData.source }));
    } catch { /* Project files and drafts do not depend on preference storage. */ }
  }, [projectFiles.ready, jCardThemeMode, fontTheme, recordingData.equipment, recordingData.source]);

  const spineLayoutStatus = useMemo(
    () => SpineLayoutEngine.compute({
      data,
      height: JCARD_DIMENSIONS.height,
      panelWidth: JCARD_DIMENSIONS.panels.spine,
      fontConfig: currentFontConfig,
    }).status,
    [data, currentFontConfig, fontMetricsVersion]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPreviewData(data);
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [data]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPreviewRecordingData(recordingData);
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [recordingData]);

  useEffect(() => {
    setData(prev => normalizeProjectData(prev));
    setPreviewData(prev => normalizeProjectData(prev));
  }, []);

  const waitForPreviewPaint = () => new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(resolve);
    });
  });

  const syncPreviewNow = async () => {
    flushSync(() => {
      setPreviewData(data);
      setPreviewRecordingData(recordingData);
    });
    await ExportService.ensureFonts(currentFontConfig);
    flushSync(() => setFontMetricsVersion(prev => prev + 1));
    await waitForPreviewPaint();
    if (svgRef.current?.querySelector('[data-back-overflow="true"]')) {
      throw new Error('背面曲目超出可读空间，请调整内容后再导出。');
    }
    if (data.layout.frontStyle !== 'REVERSIBLE' && computeFrontLayout(data, currentFontConfig, theme).overflow) {
      throw new Error('正面文字超出可读空间，请缩短标题或标语，或选择编辑左齐布局后再导出。');
    }
  };

  const calculateTotalDuration = (tracks) => formatTrackDurationTotal(tracks);

  // Set default prompt when data changes
  // Removed automatic prompt generation useEffect per user request

  const handleMusicBrainzImport = selection => {
    const next = createImportSnapshot(projectSnapshot, selection);
    applyProject(next);
  };

  const handleSmartImport = async () => {
    const epoch = projectEpoch.current;
    if (!importText.trim()) return;
    setLoadingState('import', true);
    setError('');
    try {
      const parsed = await aiService.parseImportData(importText);
      if (epoch !== projectEpoch.current) return;
      const updates = {};

      if (parsed.sideA || parsed.sideB) {
        // Map AI keys to Internal Keys for LayoutEngine
        const mapWorkFields = (tracks) => tracks.map(t => {
          if (t.work_title) {
            return createTrack({
              ...t,
              _workTitle: t.work_title,
              _workComposer: t.work_composer,
              // Use title as ID for grouping logic
              _workId: t.work_title
            });
          }
          return createTrack(t);
        });

        updates.sideA = parsed.sideA ? mapWorkFields(parsed.sideA) : [];
        updates.sideB = parsed.sideB ? mapWorkFields(parsed.sideB) : [];

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

      if (parsed.album_title) {
        updates.title = parsed.album_title.toUpperCase();
        updates.spineTitle = "";
      }
      if (parsed.album_artist) updates.artist = parsed.album_artist.toUpperCase();
      if (parsed.cover_url) {
        const base64Cover = await urlToBase64(parsed.cover_url);
        if (epoch !== projectEpoch.current) return;
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
      if (updates.sideA) updates.sideA = normalizeTrackList(updates.sideA, updates.artist || data.artist);
      if (updates.sideB) updates.sideB = normalizeTrackList(updates.sideB, updates.artist || data.artist);

      setData(prev => normalizeProjectData({ ...prev, ...updates }));
      setShowImport(false);
      setImportText('');
    } catch (err) { if (epoch !== projectEpoch.current) return;
      setError(err.message || "Failed to parse text.");
      if (!textKeyConfigured && (err.message.includes("API Key") || err.message.includes("403"))) {
        setShowSettings(true);
      }
    } finally {
      if (epoch === projectEpoch.current) setLoadingState('import', false);
    }
  };

  const handleTitleMagic = async () => {
    const epoch = projectEpoch.current;
    setLoadingState('title', true);
    try {
      const allTracks = [...data.sideA, ...data.sideB];
      const result = await aiService.suggestTitle(allTracks);
      if (epoch !== projectEpoch.current) return;
      if (result.suggested_title) {
        setData(prev => ({ ...prev, title: result.suggested_title.toUpperCase(), spineTitle: "" }));
      }
    } catch (err) { if (epoch !== projectEpoch.current) return; setError(err.message); } finally { if (epoch === projectEpoch.current) setLoadingState('title', false); }
  };

  const handleGenerateCover = async () => {
    const epoch = projectEpoch.current;
    // Validation: Prompt must not be empty
    if (!imagePrompt.trim()) {
      alert("请先在下方【AI 图片提示词】框中输入描述，再点击生成。");
      return;
    }

    setLoadingState('image', true); setError('');
    try {
      const finalPrompt = imagePrompt.trim();
      const imgDataUrl = await aiService.generateImage(finalPrompt);
      if (epoch !== projectEpoch.current) return;
      setCoverImage(imgDataUrl);
    } catch (err) { if (epoch !== projectEpoch.current) return; setError(err.message); } finally { if (epoch === projectEpoch.current) setLoadingState('image', false); }
  };

  const handleGenerateCoverPrompt = async () => {
    const epoch = projectEpoch.current;
    setLoadingState('prompt', true); setError('');
    try {
      const allTracks = [...data.sideA, ...data.sideB];
      // Check if dark mode is active for theme context
      const isDark = jCardThemeMode === 'dark'; // Or derive from actual theme.background if complex
      // Collect notes
      const notes = allTracks.map(t => t.note).join(' ');

      const result = await aiService.generateImagePrompt(isDark, allTracks, notes);
      if (epoch !== projectEpoch.current) return;

      if (result.cover_prompt) {
        let fullPrompt = result.cover_prompt;
        if (result.negative_prompt) {
          fullPrompt += `\n\nNegative: ${result.negative_prompt}`;
        }
        setImagePrompt(fullPrompt);
      }
    } catch (err) { if (epoch !== projectEpoch.current) return; setError(err.message); if (!textKeyConfigured) setShowSettings(true); } finally { if (epoch === projectEpoch.current) setLoadingState('prompt', false); }
  };

  const handleGenerateSlogan = async () => {
    const epoch = projectEpoch.current;
    setLoadingState('slogan', true); setError('');
    try {
      const allTracks = [...data.sideA, ...data.sideB];
      const result = await aiService.generateSlogan(allTracks);
      if (epoch !== projectEpoch.current) return;
      if (result.slogan) {
        // Ensure it respects the newline format
        const formattedSlogan = Array.isArray(result.slogan) ? result.slogan.join('\n') : result.slogan;
        setData(prev => ({ ...prev, coverBadge: formattedSlogan }));
      }
    } catch (err) { if (epoch !== projectEpoch.current) return; setError(err.message); if (!textKeyConfigured) setShowSettings(true); } finally { if (epoch === projectEpoch.current) setLoadingState('slogan', false); }
  };

  const handleFileUpload = (event, target = 'A') => {
    const epoch = projectEpoch.current;
    const file = event.target.files[0];
    if (file) {
      if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) { setError('请上传 PNG、JPEG、WebP 或 GIF 图片。'); return; }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (epoch !== projectEpoch.current) return;
        if (target === 'B') {
          setCoverImageB(reader.result);
        } else {
          setCoverImage(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const downloadSVG = async () => {
    if (!svgRef.current) return;
    try {
      await syncPreviewNow();
      const svgData = await ExportService.serializeSVG(svgRef.current, currentFontConfig);
      const url = URL.createObjectURL(new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url; link.download = `${data.title.replace(/\s+/g, '_')}_JCard.svg`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setError(error.message); }
  };

  const downloadPNG = async () => {
    if (!svgRef.current) return;
    setError('');
    let svgData;
    try {
      await syncPreviewNow();
      svgData = await ExportService.serializeSVG(svgRef.current, currentFontConfig);
    } catch (error) { setError(error.message); return; }

    try {
      const canvas = await rasterizeSVG(svgData, svgRef.current);
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `${data.title.replace(/\s+/g, '_')}_JCard.png`;
      link.click();
    } catch (error) { setError(error.message); }
  };

  const updateTrack = (side, index, field, value) => {
    setData(prev => ({
      ...prev,
      [side]: prev[side].map((track, trackIndex) =>
        trackIndex === index ? { ...track, [field]: value } : track
      ),
      ...(field === 'duration' ? {
        [side === 'sideA' ? 'sideADuration' : 'sideBDuration']: calculateTotalDuration(
          prev[side].map((track, trackIndex) =>
            trackIndex === index ? { ...track, [field]: value } : track
          )
        )
      } : {})
    }));
  };

  const addTrack = (side) => {
    setData(prev => {
      const nextTrackNumber = prev.sideA.length + prev.sideB.length + 1;
      const nextTracks = [
        ...prev[side],
        createEmptyTrack(nextTrackNumber, prev.artist || "Artist Name")
      ];

      return {
        ...prev,
        [side]: nextTracks,
        [side === 'sideA' ? 'sideADuration' : 'sideBDuration']: calculateTotalDuration(nextTracks)
      };
    });
  };

  const reorderTracks = (side, fromIndex, toIndex) => {
    setData(prev => {
      const currentTracks = prev[side];
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= currentTracks.length ||
        toIndex >= currentTracks.length ||
        fromIndex === toIndex
      ) {
        return prev;
      }

      const nextTracks = arrayMove(currentTracks, fromIndex, toIndex);
      return {
        ...prev,
        [side]: nextTracks,
        [side === 'sideA' ? 'sideADuration' : 'sideBDuration']: calculateTotalDuration(nextTracks)
      };
    });
  };

  const moveTrack = (fromSide, toSide, fromIndex, toIndex) => {
    setData(prev => {
      const fromTracks = [...prev[fromSide]];
      const toTracks = fromSide === toSide ? fromTracks : [...prev[toSide]];
      if (fromIndex < 0 || fromIndex >= fromTracks.length) return prev;

      const [movedTrack] = fromTracks.splice(fromIndex, 1);
      if (!movedTrack) return prev;

      const safeInsertIndex = Math.max(0, Math.min(toIndex, toTracks.length));
      toTracks.splice(safeInsertIndex, 0, movedTrack);

      if (fromSide === toSide) {
        return prev;
      }

      return {
        ...prev,
        [fromSide]: fromTracks,
        [toSide]: toTracks,
        [fromSide === 'sideA' ? 'sideADuration' : 'sideBDuration']: calculateTotalDuration(fromTracks),
        [toSide === 'sideA' ? 'sideADuration' : 'sideBDuration']: calculateTotalDuration(toTracks)
      };
    });
  };

  const removeTrack = (side, index) => {
    setData(prev => {
      const nextTracks = prev[side].filter((_, trackIndex) => trackIndex !== index);
      return {
        ...prev,
        [side]: nextTracks,
        [side === 'sideA' ? 'sideADuration' : 'sideBDuration']: calculateTotalDuration(nextTracks)
      };
    });
  };

  const isTrackDragEnabled = data.layout.mode !== 'CLASSICAL';

  const handleTrackDragStart = (event, side, index, trackId) => {
    if (!isTrackDragEnabled) return;

    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', trackId);
    setDragState({ fromSide: side, fromIndex: index, trackId });
  };

  const handleTrackDragOver = (event) => {
    if (!isTrackDragEnabled) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const resetDragState = () => {
    setDragState(null);
  };

  const handleTrackDrop = (event, targetSide, targetIndex) => {
    if (!dragState || !isTrackDragEnabled) return;

    event.preventDefault();
    event.stopPropagation();

    const { fromSide, fromIndex } = dragState;

    if (fromSide === targetSide) {
      const insertionIndex = fromIndex < targetIndex ? targetIndex - 1 : targetIndex;
      if (insertionIndex !== fromIndex) {
        reorderTracks(targetSide, fromIndex, insertionIndex);
      }
    } else {
      moveTrack(fromSide, targetSide, fromIndex, targetIndex);
    }

    resetDragState();
  };

  const renderTrackCard = (side, track, index) => (
    <div
      key={track.id}
      onDragOver={isTrackDragEnabled ? handleTrackDragOver : undefined}
      onDrop={isTrackDragEnabled ? (event) => handleTrackDrop(event, side, index) : undefined}
      className={`p-3 rounded border space-y-2 group transition-all ${
        dragState?.trackId === track.id
          ? 'bg-orange-50 border-orange-300 opacity-60'
          : 'bg-white border-gray-200'
      }`}
    >
      <div className="flex gap-2 items-start">
        {isTrackDragEnabled ? (
          <button
            type="button"
            draggable
            onDragStart={(event) => handleTrackDragStart(event, side, index, track.id)}
            onDragEnd={resetDragState}
            className="w-6 h-8 rounded flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-grab active:cursor-grabbing shrink-0"
            title="拖拽排序"
          >
            <GripVertical size={14} />
          </button>
        ) : (
          <div className="w-6 h-8 shrink-0" />
        )}
        <div className="w-6 text-gray-500 text-sm font-mono flex items-center justify-center h-8 shrink-0">{index + 1}</div>
        <input className="flex-1 border-none rounded px-2 py-1 text-sm focus:ring-1 focus:ring-orange-500 bg-gray-50 text-gray-900 placeholder-gray-400" placeholder="标题" value={track.title || ''} onChange={(e) => updateTrack(side, index, 'title', e.target.value)} />
        <input className="w-16 border-none rounded px-2 py-1 text-sm text-center focus:ring-1 focus:ring-orange-500 bg-gray-50 text-gray-600" placeholder="0:00" value={track.duration || ''} onChange={(e) => updateTrack(side, index, 'duration', e.target.value)} />
        <button onClick={() => removeTrack(side, index)} className="w-8 h-8 rounded flex items-center justify-center transition-colors bg-red-50 text-red-500 hover:bg-red-100 shrink-0" title="删除曲目"><Trash2 size={14} /></button>
      </div>
      <div className="flex gap-2 pl-14">
        <input className="flex-1 border-none rounded px-2 py-1 text-xs focus:ring-1 focus:ring-orange-500 bg-gray-50 text-gray-600 placeholder-gray-400" placeholder="艺术家" value={track.artist || ''} onChange={(e) => updateTrack(side, index, 'artist', e.target.value)} />
      </div>
      <input className="w-full border-none rounded px-2 py-1 text-xs italic focus:ring-1 focus:ring-orange-500 bg-gray-50 text-gray-500 placeholder-gray-400" placeholder="备注/心情..." value={track.note || ''} onChange={(e) => updateTrack(side, index, 'note', e.target.value)} />
    </div>
  );

  const renderDropZone = (side) => {
    if (!isTrackDragEnabled) return null;

    return (
      <div
        onDragOver={handleTrackDragOver}
        onDrop={(event) => handleTrackDrop(event, side, data[side].length)}
        className={`rounded border border-dashed px-3 py-3 text-xs text-center transition-colors ${
          dragState ? 'border-orange-300 bg-orange-50 text-orange-600' : 'border-gray-200 text-gray-400'
        }`}
      >
        {data[side].length === 0 ? '拖到这里添加到这一面' : '拖到这里放到末尾'}
      </div>
    );
  };

  const handleAutoColor = async () => {
    if (!coverImage) return;
    const epoch = projectEpoch.current;
    const color = await ColorExtractor.extractColor(coverImage, { representative: true });
    if (color && epoch === projectEpoch.current) setTheme(prev => ({ ...prev, accent: color }));
  };

  useEffect(() => {
    if (!coverImage || coverImage === restoredCover.current || (theme.paletteId && theme.paletteId !== 'legacy')) return;
    let cancelled = false;
    const epoch = projectEpoch.current;
    void ColorExtractor.extractColor(coverImage, { representative: true }).then(color => {
      if (!cancelled && epoch === projectEpoch.current && color) setTheme(prev => ({ ...prev, accent: color }));
    });
    return () => { cancelled = true; };
  }, [coverImage]);

  const handleReset = projectFiles.createNew;

  return (
    <div className="flex flex-col h-screen overflow-hidden font-sans relative bg-gray-50 text-gray-900">
      <SettingsModal
        isOpen={showSettings}
        aiSettings={aiSettings.settings}
        ready={aiSettings.ready}
        loadError={aiSettings.error}
        onRetry={aiSettings.retry}
        onClose={() => setShowSettings(false)}
        onSave={saveAISettings}
      />

      <ImportModal
        isOpen={showImport}
        importText={importText}
        isLoading={loadingStates.import}
        onClose={() => setShowImport(false)}
        onImportTextChange={setImportText}
        onSubmit={handleSmartImport}
      />

      <SearchModal
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
        onImport={handleMusicBrainzImport}
        hasCover={!!coverImage}
        hasSecondCover={!!coverImageB}
      />

      {/* Header */}
      <header className="flex flex-wrap gap-3 items-center justify-between px-6 py-4 border-b shrink-0 bg-white border-gray-200 shadow-sm relative z-10">
        <div className="flex items-center gap-2 shrink-0 whitespace-nowrap"><img src={brandIcon} alt="" className="w-10 h-10" /><h1 className="text-xl font-bold tracking-wider">带藏 <span className="text-orange-500 text-sm">TapeFolio</span></h1></div>
        <div className="flex flex-wrap items-center gap-3 whitespace-nowrap">

          <button onClick={() => document.getElementById('design-panel')?.scrollIntoView({ behavior: 'smooth' })} className="flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 text-sm hover:bg-gray-50"><Palette size={16} />设计</button>
          <button aria-label="AI 服务设置" title="配置密钥、模型与套餐说明" onClick={() => setShowSettings(true)} className={`p-2 rounded-full transition-colors ${!textKeyConfigured ? 'text-gray-400 hover:text-gray-500 hover:bg-gray-100' : 'text-orange-600 hover:bg-orange-50'}`}><Settings size={20} /></button>
          <div className="h-6 w-px bg-gray-300 mx-1"></div>
          <button onClick={handleReset} className="p-2 rounded-full transition-colors text-gray-400 hover:bg-gray-100 hover:text-red-500" title="新建/重置项目"><RotateCcw size={20} /></button>
          <div className="h-6 w-px bg-gray-600 mx-1 opacity-20"></div>

          {/* Export Buttons */}
          <button onClick={downloadSVG} className="flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 shadow-sm"><Download size={18} />导出 SVG</button>
          <button onClick={downloadPNG} className="flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors bg-gray-900 hover:bg-gray-800 text-white shadow-sm"><ImageDown size={18} />导出 PNG</button>
        </div>
      </header>

      <ProjectControls project={projectFiles} />
      <div className="px-6 py-1 text-xs text-gray-500 bg-gray-50 border-b shrink-0">
        文本：{textProviderName}{textKeyConfigured ? '' : '（未配置密钥）'} · 图片：{imageProviderName}{imageKeyConfigured ? '' : '（未配置密钥）'} · 普通 API 按量计费
        {aiSettings.error && <span role="alert" className="ml-2 text-red-700">{aiSettings.error}</span>}
      </div>

      {error && <div role="alert" className="px-6 py-2 text-xs text-red-800 bg-red-50 flex items-center justify-between gap-3">
        <span>{error}</span><button onClick={() => setError('')} className="underline shrink-0">关闭提示</button>
      </div>}

      <main className="flex flex-1 overflow-hidden">
        <div className="flex flex-col lg:flex-row gap-8 w-full h-full">
          {/* Left Column: Preview */}
          <div className="w-full lg:w-2/3 flex flex-col items-center justify-start overflow-y-auto relative p-8">
            <div className={`w-full transition-all duration-500 max-w-5xl`}>
              <JCardPreview
                onBackStatus={setBackStatus}
                key={fontMetricsVersion}
                data={previewData}
                theme={theme}
                coverImage={coverImage}
                coverImageB={coverImageB} // [NEW]
                svgRef={svgRef}
                jCardThemeMode={jCardThemeMode}
                dominantColor={dominantColor}
                recordingData={previewRecordingData}
                fontConfig={currentFontConfig}
              />
            </div>
            {data.layout.frontStyle !== 'REVERSIBLE' && computeFrontLayout(data, currentFontConfig, theme).overflow && <p role="alert" className="mt-4 text-sm text-red-700">正面文字超出可读空间，请缩短标题或标语，或选择编辑左齐布局；当前内容暂不能导出。</p>}
            {backStatus.overflow && <p role="alert" className="mt-3 text-sm text-red-700">背面曲目超出可读空间，请调整内容后再导出。</p>}
            {backStatus.folded && <p className="mt-3 text-sm text-amber-800">背面已启用紧凑显示，部分说明、时长或长曲名可能已省略；请检查成品，作品文件仍保留完整内容。</p>}
            <p className="mt-6 text-sm font-mono text-gray-500">预览：J-CARD 四折页布局 (U-CARD 风格)</p>
            <div className="mt-4 text-xs font-mono flex flex-col items-center gap-1 opacity-60 text-gray-400">
              {/* 
                * Update: Version is now injected via Vite's `define` config
                * sourced from package.json.
                */}
              <span>{__APP_VERSION__}</span>
              <span>@ 门耳朵制作</span>
              <span>加入群聊【磁带封面生成器】(QQ群: 140785966) 免费下载</span>
              <span>官网：http://www.epochaudio.cn/</span>
              <span>本软件为开源软件，允许个人在非商业目的下免费使用、学习与研究。</span>
              <span>🚫 禁止商业化用途：禁止售卖、会员付费下载或提供有偿代制作服务。</span>
              <span>本软件按“现状”提供，作者不对使用后果承担责任。商业授权请另行取得书面许可。</span>
            </div>
          </div>

          {/* Right Column: Controls */}
          <div className="w-full lg:w-1/3 min-w-[350px] overflow-y-auto border-l border-gray-200 bg-white p-6 space-y-8 custom-scrollbar">
            <SmartDesignPanel snapshot={projectSnapshot} settings={aiSettings.settings} projectIdentity={projectEpoch.current}
              ready={projectFiles.ready && !projectFiles.busy && aiSettings.ready} onApply={applySmartDesign} onSettings={() => setShowSettings(true)} />
            <DesignPanel data={data} theme={theme} fontTheme={fontTheme} mode={jCardThemeMode}
              onLayout={patch => setData(prev => ({ ...prev, layout: { ...prev.layout, ...patch } }))}
              onTheme={setTheme} onFont={setFontTheme} onMode={setJCardThemeMode} onAutoColor={handleAutoColor} hasImage={!!coverImage} />
            <section className="space-y-4">
              <h2 className="text-sm uppercase tracking-widest text-gray-500 font-bold flex items-center gap-2"><Type size={14} /> 专辑信息</h2>
              <div className="space-y-3">
                <div><label className="block text-xs text-gray-400 mb-1">专辑标题</label><div className="flex gap-2"><input type="text" value={data.title || ''} onChange={(e) => setData({ ...data, title: e.target.value })} className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-orange-500 outline-none bg-white text-gray-900" /><button aria-label="生成专辑标题" title="根据曲目生成专辑标题" onClick={handleTitleMagic} disabled={loadingStates.title} className="px-3 border border-gray-300 rounded transition-colors bg-white text-orange-600 hover:bg-gray-50">{loadingStates.title ? <span className="animate-spin text-xs">⏳</span> : <Wand2 size={16} />}</button></div></div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">脊部短标题</label>
                  <input
                    type="text"
                    value={data.spineTitle || ''}
                    onChange={(e) => setData({ ...data, spineTitle: e.target.value })}
                    className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-orange-500 outline-none bg-white text-gray-900"
                    placeholder="可选。仅在完整标题过长时启用；留空则自动生成短标题"
                  />
                  <p className="mt-1 text-[11px] text-gray-500">当前脊部策略：{spineLayoutStatus.summary}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs text-gray-400 mb-1">艺术家</label><input type="text" value={data.artist || ''} onChange={(e) => setData({ ...data, artist: e.target.value })} className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-orange-500 outline-none bg-white text-gray-900" /></div>
                  <div><label className="block text-xs text-gray-400 mb-1">发行日期</label><input type="text" value={data.releaseDate || ''} onChange={(e) => setData({ ...data, releaseDate: e.target.value })} className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-orange-500 outline-none bg-white text-gray-900" placeholder="YYYY" /></div>
                  <div><label className="block text-xs text-gray-400 mb-1">目录编号</label><input type="text" value={data.tapeId || ''} onChange={(e) => setData({ ...data, tapeId: e.target.value })} className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-orange-500 outline-none bg-white text-gray-900" /></div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">封面标语</label>
                  <div className="flex gap-2">
                    <textarea rows={3} maxLength={200} value={data.coverBadge || ''} onChange={(e) => setData({ ...data, coverBadge: e.target.value })} className="flex-1 border border-gray-300 rounded p-2 focus:ring-2 focus:ring-orange-500 outline-none placeholder-gray-500 resize-none bg-white text-gray-900" placeholder="例如：永恒的经典..." />
                    <button onClick={handleGenerateSlogan} disabled={loadingStates.slogan} className="px-2 border border-gray-300 rounded self-start transition-colors h-20 flex items-center justify-center bg-white text-purple-600 hover:bg-purple-50">{loadingStates.slogan ? <span className="animate-spin text-xs">⏳</span> : <Sparkles size={16} />}</button>
                  </div>
                  <div className="mt-3">
                    <label className="block text-xs text-gray-400 mb-1">标语对齐</label>
                    <div className="flex gap-2 text-xs">
                      {COVER_BADGE_ALIGN_OPTIONS.map(option => (
                        <button
                          key={option.value}
                          onClick={() => setData({ ...data, layout: { ...data.layout, coverBadgeAlign: option.value } })}
                          className={`flex-1 py-1 rounded border transition-colors ${data.layout.coverBadgeAlign === option.value
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Layout Options */}
            <section className="space-y-4">
              <h2 className="text-sm uppercase tracking-widest text-gray-500 font-bold flex items-center gap-2"><LayoutTemplate size={14} /> 布局选项</h2>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-400 mb-1">顶部备注</label><input type="text" value={data.layout.noteUpper || ''} onChange={(e) => setData({ ...data, layout: { ...data.layout, noteUpper: e.target.value } })} className="w-full border border-gray-300 rounded p-2 text-xs focus:ring-2 focus:ring-orange-500 outline-none bg-white text-gray-900" placeholder="例如：STEREO / MONO / 年份 / 录音日期" /></div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">底部备注</label>
                  <input
                    type="text"
                    value={data.layout.noteLower || ''}
                    onChange={(e) => setData({
                      ...data,
                      layout: {
                        ...data.layout,
                        noteLower: truncateVisibleChars(e.target.value, NOTE_LOWER_MAX_VISIBLE_CHARS)
                      }
                    })}
                    className="w-full border border-gray-300 rounded p-2 text-xs focus:ring-2 focus:ring-orange-500 outline-none bg-white text-gray-900"
                    placeholder="例如：版权 / 版本信息 / 自定义说明"
                  />
                  <p className="mt-1 text-[11px] text-gray-500">
                    建议 {NOTE_LOWER_RECOMMENDED_VISIBLE_CHARS} 字内，最多 {NOTE_LOWER_MAX_VISIBLE_CHARS} 个可见字符
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">布局模式</label>
                <div className="flex gap-2 text-xs">
                  {['STANDARD', 'CLASSICAL', 'COMPILATION'].map(mode => (
                    <button
                      key={mode}
                      onClick={() => setData({ ...data, layout: { ...data.layout, mode } })}
                      className={`flex-1 py-1 rounded border transition-colors ${data.layout.mode === mode
                        ? 'bg-orange-600 text-white border-orange-600'
                        : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                    >
                      {mode === 'STANDARD' ? '标准' : mode === 'CLASSICAL' ? '古典' : '合辑'}
                    </button>
                  ))}
                </div>
                <div className="mt-3">
                  <label className="block text-xs text-gray-400 mb-1">Short Back 模式</label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {SHORT_BACK_MODE_OPTIONS.map(option => (
                      <button
                        key={option.value}
                        onClick={() => setData({ ...data, layout: { ...data.layout, shortBackMode: option.value } })}
                        className={`py-1.5 rounded border transition-colors ${data.layout.shortBackMode === option.value
                          ? 'bg-teal-600 text-white border-teal-600'
                          : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-gray-400">控制最左侧折页的显示内容，不影响主封底曲目顺序。紧凑曲目会根据标题长度与可用空间自动调整显示密度。</p>
                </div>

              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                  <input type="checkbox" checked={data.layout.forceCaps} onChange={(e) => setData({ ...data, layout: { ...data.layout, forceCaps: e.target.checked } })} className="rounded text-orange-500 focus:ring-orange-500 bg-white border-gray-300" /> 强制大写
                </label>
                <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                  <input type="checkbox" disabled={theme.paletteId === 'custom'} title={theme.paletteId === 'custom' ? 'AI 完整配色已指定脊背颜色；切换预设后可使用极简脊部' : undefined} checked={data.layout.minimalSpine} onChange={(e) => setData({ ...data, layout: { ...data.layout, minimalSpine: e.target.checked } })} className="rounded text-orange-500 focus:ring-orange-500 bg-white border-gray-300" /> {theme.paletteId === 'custom' ? '脊背采用 AI 配色' : '极简脊部'}
                </label>
                {/* [NEW] Spine Orientation Toggle */}
                <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                  <input type="checkbox" checked={!!data.layout.spineInverted} onChange={(e) => setData({ ...data, layout: { ...data.layout, spineInverted: e.target.checked } })} className="rounded text-orange-500 focus:ring-orange-500 bg-white border-gray-300" /> 翻转脊部
                </label>
              </div>
            </section>

            {/* Custom Metadata (Technical Specs) */}
            <section className="space-y-4">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 pb-2">元数据</h3>
              <div>
                <label className="block text-xs text-gray-400 mb-1">录音设备 (Recording Equipment)</label>
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
                <label className="block text-xs text-gray-500 mb-1">厂牌/Label Override</label>
                <input
                  type="text"
                  value={recordingData.labelOverride || ""}
                  onChange={(e) => updateRecordingData('labelOverride', e.target.value)}
                  className="w-full bg-transparent border-b border-gray-300 py-1 text-sm focus:border-red-500 outline-none transition-colors text-gray-800"
                  placeholder="Overrides standard label info"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">音源 (Media Source)</label>
                <input
                  type="text"
                  value={recordingData.source || ""}
                  onChange={(e) => updateRecordingData('source', e.target.value)}
                  className="w-full bg-transparent border-b border-gray-300 py-1 text-sm focus:border-red-500 outline-none transition-colors text-gray-800"
                  placeholder="e.g. Vinyl / SACD ISO"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">录音日期 (Tape Rec. Date)</label>
                <input
                  type="text"
                  value={recordingData.recDate || ""}
                  onChange={(e) => updateRecordingData('recDate', e.target.value)}
                  className="w-full bg-transparent border-b border-gray-300 py-1 text-sm focus:border-red-500 outline-none transition-colors text-gray-800"
                  placeholder="YYYY-MM-DD"
                />
              </div>
            </section>

            {/* AI Art & Style Options */}
            <section className="space-y-4">
              <h2 className="text-sm uppercase tracking-widest text-gray-500 font-bold flex items-center gap-2"><ImageIcon size={14} /> 封面图片</h2>

              {/* Prompt Input */}
              <div>
                <label className="block text-xs text-gray-400 mb-1 flex justify-between items-center">
                  AI 图片提示词
                  <button onClick={handleGenerateCoverPrompt} disabled={loadingStates.prompt} className="text-[10px] bg-purple-600 hover:bg-purple-500 text-white px-2 py-0.5 rounded flex items-center gap-1">
                    {loadingStates.prompt ? <span className="animate-spin">⏳</span> : <Wand2 size={10} />}
                    {loadingStates.prompt ? '生成中...' : '生成提示词'}
                  </button>
                </label>
                <textarea
                  className="w-full border border-gray-300 rounded p-2 text-xs h-20 focus:ring-2 focus:ring-orange-500 outline-none resize-none bg-white text-gray-900"
                  placeholder="描述你想要的封面画面..."
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                />
              </div>

              {/* Image Upload/Generate */}
              {/* Image Upload/Generate */}
              <div className="space-y-3">
                {/* Cover A */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    {data.layout.frontStyle === 'REVERSIBLE' ? '封面 A (上半部 Top / 正向 Upright)' : '封面图片'}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={(e) => handleFileUpload(e, 'A')}
                      accept="image/*"
                      className="hidden"
                    />
                    <button onClick={() => fileInputRef.current?.click()} className="flex-1 rounded text-xs py-2 flex items-center justify-center gap-1 transition-colors bg-white border border-gray-300 hover:bg-gray-50 text-gray-700"><Upload size={14} /> 上传图片</button>
                    <button onClick={handleGenerateCover} disabled={loadingStates.image} className="flex-1 rounded text-xs py-2 flex items-center justify-center gap-1 transition-colors bg-white border border-gray-300 hover:bg-gray-50 text-gray-700">{loadingStates.image ? <span className="animate-spin">⏳</span> : <ImageIcon size={14} />} {loadingStates.image ? '生成中...' : 'AI 生成'}</button>
                    {coverImage && (<button onClick={() => setCoverImage(null)} className="w-8 bg-red-900/50 hover:bg-red-800 rounded flex items-center justify-center text-red-200"><Trash2 size={14} /></button>)}
                  </div>
                  <CoverInfoPanel snapshot={projectSnapshot} settings={aiSettings.settings} projectIdentity={projectEpoch.current}
                    ready={projectFiles.ready && !projectFiles.busy && aiSettings.ready} onApply={applyProject} onSettings={() => setShowSettings(true)} />
                </div>

                {/* Cover B (Conditional) */}
                {data.layout.frontStyle === 'REVERSIBLE' && (
                  <div className="pt-2 border-t border-gray-100">
                    <label className="block text-xs text-gray-400 mb-1">封面 B (下半部 Bottom / 颠倒 Rotated 180°)</label>
                    <div className="flex gap-2">
                      <input
                        type="file"
                        ref={fileInputRefB}
                        onChange={(e) => handleFileUpload(e, 'B')}
                        accept="image/*"
                        className="hidden"
                      />
                      <button onClick={() => fileInputRefB.current?.click()} className="flex-1 rounded text-xs py-2 flex items-center justify-center gap-1 transition-colors bg-white border border-gray-300 hover:bg-gray-50 text-gray-700">
                        <Upload size={14} /> 上传封面 B
                      </button>
                      {coverImageB && (<button onClick={() => setCoverImageB(null)} className="w-8 bg-red-900/50 hover:bg-red-800 rounded flex items-center justify-center text-red-200"><Trash2 size={14} /></button>)}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Tracks Section */}
            <div className="flex items-center justify-between border-b pb-2 border-gray-200">
              <h2 className="text-sm uppercase tracking-widest text-gray-500 font-bold flex items-center gap-2"><Music size={14} /> 曲目列表</h2>
              <div className="flex gap-2">
                <button onClick={() => setShowImport(true)} className="text-xs flex items-center gap-1 px-2 py-1 rounded transition-colors bg-white border border-gray-300 hover:bg-gray-50 text-orange-600"><FileText size={12} /> 粘贴文本</button>
                <button onClick={() => setShowSearch(true)} className="text-xs flex items-center gap-1 px-2 py-1 rounded transition-colors bg-white border border-gray-300 hover:bg-gray-50 text-orange-600"><Globe size={12} /> 搜索 MusicBrainz</button>
              </div>
            </div>
            <section className="space-y-4">
              <div className="flex items-center justify-between pl-1">
                <h3 className="text-xs font-bold text-gray-500">A 面 (SIDE A)</h3>
                <button onClick={() => addTrack('sideA')} className="text-xs flex items-center gap-1 px-2 py-1 rounded transition-colors bg-white border border-gray-300 hover:bg-gray-50 text-orange-600">
                  <Plus size={12} /> 添加曲目
                </button>
              </div>
              {!isTrackDragEnabled && data.layout.mode === 'CLASSICAL' && (
                <p className="text-xs text-gray-400 pl-1">古典模式暂不支持拖拽排序。</p>
              )}
              {data.sideA.map((track, i) => renderTrackCard('sideA', track, i))}
              {renderDropZone('sideA')}
            </section>
            <section className="space-y-4">
              <div className="flex items-center justify-between pl-1">
                <h3 className="text-xs font-bold text-gray-500">B 面 (SIDE B)</h3>
                <button onClick={() => addTrack('sideB')} className="text-xs flex items-center gap-1 px-2 py-1 rounded transition-colors bg-white border border-gray-300 hover:bg-gray-50 text-orange-600">
                  <Plus size={12} /> 添加曲目
                </button>
              </div>
              {data.sideB.map((track, i) => renderTrackCard('sideB', track, i))}
              {renderDropZone('sideB')}
            </section>

          </div>

        </div >


      </main >
    </div >
  );
}

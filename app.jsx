import React, { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Sparkles, Download, Disc, Music, Type, Palette, Wand2, Settings, Image as ImageIcon, Trash2, Globe, Printer, Eye, Sun, Moon, Droplet, LayoutTemplate, FileText, ImageDown, Upload, ListTree, RotateCcw, Plus } from 'lucide-react';

import { JCARD_DIMENSIONS, STORAGE_KEYS } from './src/constants/app.js';
import ImportModal from './src/components/ImportModal.jsx';
import JCardPreview from './src/components/JCardPreview.jsx';
import SearchModal from './src/components/SearchModal.jsx';
import SettingsModal from './src/components/SettingsModal.jsx';
import ColorExtractor from './src/services/ColorExtractor.js';
import DashScopeService from './src/services/DashScopeService.js';
import ExportService from './src/services/ExportService.js';
import MusicBrainzService from './src/services/MusicBrainzService.js';
import { getFontConfig, FONT_THEMES } from './src/config/fonts.js';
import { parseDurationToMs } from './src/utils/formatDuration.js';
import { urlToBase64 } from './src/utils/imageUtils.js';
import LayoutEngine from './src/utils/LayoutEngine.js';

const createDefaultData = () => ({
  title: "ALBUM TITLE",
  artist: "ARTIST NAME",
  tapeId: "",
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
    frontStyle: 'STANDARD',
    spineInverted: true
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

const createDefaultRecordingData = () => ({
  equipment: "",
  mode: "AAA",
  labelOverride: "",
  source: "",
  recDate: ""
});

const createEmptyTrack = (trackNumber = 1, artist = "Artist Name") => ({
  title: `Track Name ${trackNumber}`,
  artist,
  duration: "0:00",
  note: ""
});

const getElectronSecureStore = () => {
  if (typeof window === 'undefined') return null;
  return window.electronAPI?.secureStore || null;
};

const loadStoredApiKey = async () => {
  const secureStore = getElectronSecureStore();
  const localStorageKeys = [
    STORAGE_KEYS.dashscopeApiKey,
    STORAGE_KEYS.legacyDashscopeApiKey,
    STORAGE_KEYS.legacyGeminiApiKey
  ];
  const localKey = localStorageKeys.map((key) => localStorage.getItem(key)).find(Boolean) || "";

  if (secureStore) {
    const secureStorageKeys = [
      STORAGE_KEYS.dashscopeApiKey,
      STORAGE_KEYS.legacyDashscopeApiKey,
      STORAGE_KEYS.legacyGeminiApiKey
    ];
    const secureValues = await Promise.all(
      secureStorageKeys.map((key) => secureStore.getItem(key))
    );
    const secureKeyIndex = secureValues.findIndex(Boolean);
    const secureKey = secureKeyIndex >= 0 ? secureValues[secureKeyIndex] : "";
    const resolvedKey = secureKey || localKey;

    if (!secureKey && localKey) {
      await secureStore.setItem(STORAGE_KEYS.dashscopeApiKey, localKey);
    }

    if (secureKey && secureKeyIndex > 0) {
      await secureStore.setItem(STORAGE_KEYS.dashscopeApiKey, secureKey);
      await Promise.all(
        secureStorageKeys
          .filter((key) => key !== STORAGE_KEYS.dashscopeApiKey)
          .map((key) => secureStore.removeItem(key))
      );
    }

    localStorageKeys.forEach((key) => localStorage.removeItem(key));

    return resolvedKey;
  }

  if (localKey) {
    localStorage.setItem(STORAGE_KEYS.dashscopeApiKey, localKey);
  }
  localStorage.removeItem(STORAGE_KEYS.legacyDashscopeApiKey);
  localStorage.removeItem(STORAGE_KEYS.legacyGeminiApiKey);

  return localKey;
};

const persistApiKey = async (key) => {
  const secureStore = getElectronSecureStore();
  const removableKeys = [
    STORAGE_KEYS.dashscopeApiKey,
    STORAGE_KEYS.legacyDashscopeApiKey,
    STORAGE_KEYS.legacyGeminiApiKey
  ];

  if (secureStore) {
    if (key) {
      await secureStore.setItem(STORAGE_KEYS.dashscopeApiKey, key);
    } else {
      await secureStore.removeItem(STORAGE_KEYS.dashscopeApiKey);
    }
    removableKeys.forEach((storageKey) => localStorage.removeItem(storageKey));
    return;
  }

  if (key) {
    localStorage.setItem(STORAGE_KEYS.dashscopeApiKey, key);
  } else {
    localStorage.removeItem(STORAGE_KEYS.dashscopeApiKey);
  }
  localStorage.removeItem(STORAGE_KEYS.legacyDashscopeApiKey);
  localStorage.removeItem(STORAGE_KEYS.legacyGeminiApiKey);
};

export default function App() {
  const [apiKey, setApiKey] = useState("");
  const svgRef = useRef(null);
  const [loadingStates, setLoadingStates] = useState({
    enhance: false,
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

  // --- Theme System ---
  // modes: 'dark' (default #232629), 'cover' (blurred image), 'color' (dominant color)
  const [jCardThemeMode, setJCardThemeMode] = useState('dark');
  const [dominantColor, setDominantColor] = useState('#232629');
  const [contrastTextType, setContrastTextType] = useState('light'); // 'light' means text should be white, 'dark' means black

  // Load theme from local storage
  useEffect(() => {
    const savedTheme = localStorage.getItem(STORAGE_KEYS.themeMode);
    if (savedTheme) setJCardThemeMode(savedTheme);
  }, []);

  // Save theme to local storage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.themeMode, jCardThemeMode);
  }, [jCardThemeMode]);

  // --- Font Theme State ---
  const [fontTheme, setFontTheme] = useState('modern');

  useEffect(() => {
    const savedFontTheme = localStorage.getItem(STORAGE_KEYS.fontTheme);
    if (savedFontTheme && FONT_THEMES[savedFontTheme]) {
      setFontTheme(savedFontTheme);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.fontTheme, fontTheme);
  }, [fontTheme]);

  const currentFontConfig = getFontConfig(fontTheme);

  // Extract color when cover image changes
  useEffect(() => {
    if (coverImage) {
      ColorExtractor.extractColor(coverImage).then(color => {
        setDominantColor(color);
        // Check contrast for 'color' mode usage
        const contrast = ColorExtractor.getContrastYIQ(color);
        setContrastTextType(contrast === 'dark' ? 'dark' : 'light');
      });
    } else {
      // Reset if no cover
      setDominantColor('#232629');
      setContrastTextType('light');
    }
  }, [coverImage]);

  const [imagePrompt, setImagePrompt] = useState("");
  const [searchQuery, setSearchQuery] = useState({ album: '', artist: '' });
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');

  const setLoadingState = (key, value) => {
    setLoadingStates(prev => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    let cancelled = false;

    const loadApiKey = async () => {
      try {
        const savedKey = await loadStoredApiKey();
        if (!cancelled && savedKey) {
          setApiKey(savedKey);
        }
      } catch (e) {
        console.error("Failed to load stored DashScope API key", e);
      }
    };

    void loadApiKey();

    return () => {
      cancelled = true;
    };
  }, []);

  const saveApiKey = (key) => {
    setApiKey(key);
    void persistApiKey(key).catch((error) => {
      console.error("Failed to persist DashScope API key", error);
    });
  };

  const [data, setData] = useState(() => createDefaultData());
  const [previewData, setPreviewData] = useState(() => createDefaultData());

  // --- NEW: Custom Recording Metadata State with Persistence ---
  const [recordingData, setRecordingData] = useState(() => createDefaultRecordingData());
  const [previewRecordingData, setPreviewRecordingData] = useState(() => createDefaultRecordingData());

  // Load recording data from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.recordingData);
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
    localStorage.setItem(STORAGE_KEYS.recordingData, JSON.stringify(recordingData));
  }, [recordingData]);

  const updateRecordingData = (field, value) => {
    setRecordingData(prev => ({ ...prev, [field]: value }));
  };

  const [theme, setTheme] = useState({
    background: "#121212",
    accent: "#cc3300",
    mood_description: ""
  });

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
    await waitForPreviewPaint();
  };

  const calculateTotalDuration = (tracks) => (
    MusicBrainzService.formatDuration(
      tracks.reduce((acc, track) => acc + parseDurationToMs(track.duration), 0)
    )
  );

  // Set default prompt when data changes
  // Removed automatic prompt generation useEffect per user request

  const getApiKeyOrWarn = () => {
    return apiKey || "";
  };

  const handleSearch = async () => {
    if (!searchQuery.album.trim() && !searchQuery.artist.trim()) return;

    setLoadingState('search', true);
    setSearchResults([]);
    setError('');
    try {
      const results = await MusicBrainzService.searchReleaseGroup(searchQuery.album, searchQuery.artist);
      setSearchResults(results);
    } catch (e) { setError(e.message || "Search failed"); } finally { setLoadingState('search', false); }
  };

  const handleSelectReleaseGroup = async (rg) => {
    setLoadingState('search', true);
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

      // Update Recording Data with Extended Credits
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
        _workId: t._workId, // Persist internal ID for grouping
        _workTitle: t._workTitle,
        _workComposer: t._workComposer
      }));

      // Calculate Sides with updated logic
      const half = Math.ceil(rawTracks.length / 2);
      const sideA = rawTracks.slice(0, half);
      const sideB = rawTracks.slice(half);

      setData({
        title: rg.title,
        artist: rg['artist-credit']?.[0]?.name,
        releaseDate: date || "", // Set decoupled Release Date
        tapeSubtitle: (labelName && catalogNumber) ? `${labelName} ${catalogNumber}` : (labelName || catalogNumber || ""),
        coverBadge: "",
        sideA: sideA,
        sideB: sideB,
        sideADuration: calculateTotalDuration(sideA),
        sideBDuration: calculateTotalDuration(sideB),
        layout: {
          ...data.layout,
          mode: LayoutEngine.detectMode(releaseData, rawTracks),
          noteUpper: "",
          noteLower: "STEREO",
          forceCaps: false,
          worksData: releaseData.works // Store Works hierarchy
        }
      });
      if (coverUrl) setCoverImage(coverUrl);
      setShowSearch(false);
    } catch (e) { setError("Import failed: " + e.message); } finally { setLoadingState('search', false); }
  };

  const handleSmartImport = async () => {
    if (!importText.trim()) return;
    const key = getApiKeyOrWarn();
    setLoadingState('import', true);
    setError('');
    try {
      const parsed = await DashScopeService.parseImportData(importText, key);
      const updates = {};

      if (parsed.sideA || parsed.sideB) {
        // Map AI keys to Internal Keys for LayoutEngine
        const mapWorkFields = (tracks) => tracks.map(t => {
          if (t.work_title) {
            return {
              ...t,
              _workTitle: t.work_title,
              _workComposer: t.work_composer,
              // Use title as ID for grouping logic
              _workId: t.work_title
            };
          }
          return t;
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
      setLoadingState('import', false);
    }
  };

  const handleAIEnhance = async () => {
    const key = getApiKeyOrWarn();
    setLoadingState('enhance', true); setError('');
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

    } catch (err) { setError(err.message); if (!apiKey) setShowSettings(true); } finally { setLoadingState('enhance', false); }
  };

  const handleTitleMagic = async () => {
    const key = getApiKeyOrWarn();
    setLoadingState('title', true);
    try {
      const allTracks = [...data.sideA, ...data.sideB];
      const result = await DashScopeService.suggestTitle(allTracks, key);
      if (result.suggested_title) setData(prev => ({ ...prev, title: result.suggested_title.toUpperCase() }));
    } catch (err) { setError(err.message); } finally { setLoadingState('title', false); }
  };

  const handleGenerateCover = async () => {
    // Validation: Prompt must not be empty
    if (!imagePrompt.trim()) {
      alert("请先在下方【AI 图片提示词】框中输入描述，再点击生成。");
      return;
    }

    const key = getApiKeyOrWarn();
    setLoadingState('image', true); setError('');
    try {
      const finalPrompt = imagePrompt.trim();
      const imgDataUrl = await DashScopeService.generateImage(finalPrompt, key);
      setCoverImage(imgDataUrl);
    } catch (err) { setError(err.message); } finally { setLoadingState('image', false); }
  };

  const handleGenerateCoverPrompt = async () => {
    const key = getApiKeyOrWarn();
    setLoadingState('prompt', true); setError('');
    try {
      const allTracks = [...data.sideA, ...data.sideB];
      // Check if dark mode is active for theme context
      const isDark = jCardThemeMode === 'dark'; // Or derive from actual theme.background if complex
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
    } catch (err) { setError(err.message); if (!apiKey) setShowSettings(true); } finally { setLoadingState('prompt', false); }
  };

  const handleGenerateSlogan = async () => {
    const key = getApiKeyOrWarn();
    setLoadingState('slogan', true); setError('');
    try {
      const allTracks = [...data.sideA, ...data.sideB];
      const result = await DashScopeService.generateSlogan(allTracks, key);
      if (result.slogan) {
        // Ensure it respects the newline format
        const formattedSlogan = Array.isArray(result.slogan) ? result.slogan.join('\n') : result.slogan;
        setData(prev => ({ ...prev, coverBadge: formattedSlogan }));
      }
    } catch (err) { setError(err.message); if (!apiKey) setShowSettings(true); } finally { setLoadingState('slogan', false); }
  };

  const handleFileUpload = (event, target = 'A') => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
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
    await syncPreviewNow();
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
    await syncPreviewNow();

    // Serialize current SVG
    let svgData = new XMLSerializer().serializeToString(svgRef.current);

    // Embed Fonts for stability
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
    canvas.width = JCARD_DIMENSIONS.width;
    canvas.height = JCARD_DIMENSIONS.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("PNG 导出失败：无法创建画布上下文。");
      return;
    }

    const img = new Image();
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      // Small delay to ensure immediate render stability
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
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setError("PNG 导出失败，请重试。");
    };
    img.src = url;
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

  const handleAutoColor = async () => {
    if (!coverImage) return;
    const color = await ColorExtractor.extractColor(coverImage);
    if (color) setTheme(prev => ({ ...prev, accent: color }));
  };

  useEffect(() => { if (coverImage) handleAutoColor(); }, [coverImage]);

  const handleReset = () => {
    if (window.confirm("确定要清空当前所有内容并开始新项目吗？\n（将保留API Key、录音设备和媒体来源设置）")) {
      // 1. Reset Data to Defaults
      setData(createDefaultData());

      // 2. Clear Images & Search
      setCoverImage(null);
      setCoverImageB(null);
      setSearchResults([]);
      setImportText("");
      setImagePrompt("");
      setError("");

      const today = new Date().toISOString().split('T')[0];
      setRecordingData(prev => ({
        equipment: prev.equipment || "",
        source: prev.source || "",
        mode: "AAA",
        labelOverride: "",
        recDate: today
        // implicitly clears 'credits' by exclusion
      }));
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden font-sans relative bg-gray-50 text-gray-900">
      <SettingsModal
        isOpen={showSettings}
        apiKey={apiKey}
        onClose={() => setShowSettings(false)}
        onApiKeyChange={saveApiKey}
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
        error={error}
        isLoading={loadingStates.search}
        searchQuery={searchQuery}
        searchResults={searchResults}
        onClose={() => setShowSearch(false)}
        onSearch={handleSearch}
        onSearchQueryChange={setSearchQuery}
        onSelectResult={handleSelectReleaseGroup}
      />

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b shrink-0 bg-white border-gray-200 shadow-sm relative z-10">
        <div className="flex items-center gap-2"><Disc className="text-orange-500 w-6 h-6" /><h1 className="text-xl font-bold tracking-wider">磁带封面生成器 <span className="text-orange-500 text-sm">(J-CARD GENESIS)</span></h1></div>
        <div className="flex items-center gap-3">

          {/* Font Theme Switcher (Header) */}
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

          {/* Theme Switcher: Segmented Control */}
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
          <button onClick={() => setShowSettings(true)} className={`p-2 rounded-full transition-colors ${!apiKey ? 'text-gray-400 hover:text-gray-500 hover:bg-gray-100' : 'text-orange-600 hover:bg-orange-50'}`}><Settings size={20} /></button>
          <div className="h-6 w-px bg-gray-300 mx-1"></div>
          <button onClick={handleReset} className="p-2 rounded-full transition-colors text-gray-400 hover:bg-gray-100 hover:text-red-500" title="新建/重置项目"><RotateCcw size={20} /></button>
          <div className="h-6 w-px bg-gray-600 mx-1 opacity-20"></div>
          <button onClick={handleAIEnhance} disabled={loadingStates.enhance} className={`flex items-center gap-2 px-4 py-2 rounded-md font-semibold transition-all ${loadingStates.enhance ? 'bg-gray-600 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white shadow-lg hover:shadow-indigo-500/20'}`}>{loadingStates.enhance ? <span className="animate-spin">✨</span> : <Sparkles size={18} />}{loadingStates.enhance ? 'AI 策划中...' : 'AI 创意总监'}</button>

          {/* Export Buttons */}
          <button onClick={downloadSVG} className="flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 shadow-sm"><Download size={18} />导出 SVG</button>
          <button onClick={downloadPNG} className="flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors bg-gray-900 hover:bg-gray-800 text-white shadow-sm"><ImageDown size={18} />导出 PNG</button>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        <div className="flex flex-col lg:flex-row gap-8 w-full h-full">
          {/* Left Column: Preview */}
          <div className="w-full lg:w-2/3 flex flex-col items-center justify-center relative p-8">
            <div className={`w-full transition-all duration-500 max-w-5xl`}>
              <JCardPreview
                data={previewData}
                theme={theme}
                coverImage={coverImage}
                coverImageB={coverImageB} // [NEW]
                svgRef={svgRef}
                jCardThemeMode={jCardThemeMode}
                dominantColor={dominantColor}
                contrastTextType={contrastTextType}
                recordingData={previewRecordingData}
                fontConfig={currentFontConfig}
              />
            </div>
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
            <section className="space-y-4">
              <h2 className="text-sm uppercase tracking-widest text-gray-500 font-bold flex items-center gap-2"><Type size={14} /> 专辑信息</h2>
              <div className="space-y-3">
                <div><label className="block text-xs text-gray-400 mb-1">专辑标题</label><div className="flex gap-2"><input type="text" value={data.title || ''} onChange={(e) => setData({ ...data, title: e.target.value })} className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-orange-500 outline-none bg-white text-gray-900" /><button onClick={handleTitleMagic} disabled={loadingStates.title} className="px-3 border border-gray-300 rounded transition-colors bg-white text-orange-600 hover:bg-gray-50">{loadingStates.title ? <span className="animate-spin text-xs">⏳</span> : <Wand2 size={16} />}</button></div></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs text-gray-400 mb-1">艺术家</label><input type="text" value={data.artist || ''} onChange={(e) => setData({ ...data, artist: e.target.value })} className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-orange-500 outline-none bg-white text-gray-900" /></div>
                  <div><label className="block text-xs text-gray-400 mb-1">发行日期</label><input type="text" value={data.releaseDate || ''} onChange={(e) => setData({ ...data, releaseDate: e.target.value })} className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-orange-500 outline-none bg-white text-gray-900" placeholder="YYYY" /></div>
                  <div><label className="block text-xs text-gray-400 mb-1">目录编号</label><input type="text" value={data.tapeId || ''} onChange={(e) => setData({ ...data, tapeId: e.target.value })} className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-orange-500 outline-none bg-white text-gray-900" /></div>
                </div>
                <div><label className="block text-xs text-gray-400 mb-1">封面标语</label><div className="flex gap-2"><textarea rows={3} maxLength={200} value={data.coverBadge || ''} onChange={(e) => setData({ ...data, coverBadge: e.target.value })} className="flex-1 border border-gray-300 rounded p-2 focus:ring-2 focus:ring-orange-500 outline-none placeholder-gray-500 resize-none bg-white text-gray-900" placeholder="例如：永恒的经典..." /><button onClick={handleGenerateSlogan} disabled={loadingStates.slogan} className="px-2 border border-gray-300 rounded self-start transition-colors h-20 flex items-center justify-center bg-white text-purple-600 hover:bg-purple-50">{loadingStates.slogan ? <span className="animate-spin text-xs">⏳</span> : <Sparkles size={16} />}</button></div></div>
              </div>
            </section>

            {/* Layout Options */}
            <section className="space-y-4">
              <h2 className="text-sm uppercase tracking-widest text-gray-500 font-bold flex items-center gap-2"><LayoutTemplate size={14} /> 布局选项</h2>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-400 mb-1">顶部备注</label><input type="text" value={data.layout.noteUpper || ''} onChange={(e) => setData({ ...data, layout: { ...data.layout, noteUpper: e.target.value } })} className="w-full border border-gray-300 rounded p-2 text-xs focus:ring-2 focus:ring-orange-500 outline-none bg-white text-gray-900" placeholder="例如：STEREO / 录音日期" /></div>
                <div><label className="block text-xs text-gray-400 mb-1">底部备注</label><input type="text" value={data.layout.noteLower || ''} onChange={(e) => setData({ ...data, layout: { ...data.layout, noteLower: e.target.value } })} className="w-full border border-gray-300 rounded p-2 text-xs focus:ring-2 focus:ring-orange-500 outline-none bg-white text-gray-900" placeholder="例如：2023 发行" /></div>
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
                <div className="mt-2">
                  <label className="block text-xs text-gray-400 mb-1">封面模式 (Front Layout)</label>
                  <div className="flex gap-2 text-xs">
                    {['STANDARD', 'REVERSIBLE'].map(style => (
                      <button
                        key={style}
                        onClick={() => setData({ ...data, layout: { ...data.layout, frontStyle: style } })}
                        className={`flex-1 py-1 rounded border transition-colors ${data.layout.frontStyle === style
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                      >
                        {style === 'STANDARD' ? '标准单页' : '双拼颠倒 (Reversible)'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                  <input type="checkbox" checked={data.layout.forceCaps} onChange={(e) => setData({ ...data, layout: { ...data.layout, forceCaps: e.target.checked } })} className="rounded text-orange-500 focus:ring-orange-500 bg-white border-gray-300" /> 强制大写
                </label>
                <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                  <input type="checkbox" checked={data.layout.minimalSpine} onChange={(e) => setData({ ...data, layout: { ...data.layout, minimalSpine: e.target.checked } })} className="rounded text-orange-500 focus:ring-orange-500 bg-white border-gray-300" /> 极简脊部
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
              <h2 className="text-sm uppercase tracking-widest text-gray-500 font-bold flex items-center gap-2"><Palette size={14} /> 封面设计</h2>

              {/* Emphasis Color */}
              <div><label className="block text-xs text-gray-400 mb-1">强调色 (Accent)</label><div className="flex items-center gap-2"><input type="color" value={theme.accent || '#000000'} onChange={(e) => setTheme({ ...theme, accent: e.target.value })} className="h-8 w-8 rounded cursor-pointer bg-transparent border-none" /><button onClick={handleAutoColor} disabled={!coverImage} className={`p-1.5 rounded hover:bg-gray-600 transition-colors ${!coverImage ? 'opacity-30 cursor-not-allowed' : 'text-orange-400 hover:text-white'}`}><Droplet size={16} /></button></div></div>

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
              {data.sideA.map((track, i) => (
                <div key={i} className="p-3 rounded border space-y-2 group bg-white border-gray-200">
                  <div className="flex gap-2"><div className="w-6 text-gray-500 text-sm font-mono flex items-center justify-center">{i + 1}</div><input className="flex-1 border-none rounded px-2 py-1 text-sm focus:ring-1 focus:ring-orange-500 bg-gray-50 text-gray-900 placeholder-gray-400" placeholder="标题" value={track.title || ''} onChange={(e) => updateTrack('sideA', i, 'title', e.target.value)} /><input className="w-16 border-none rounded px-2 py-1 text-sm text-center focus:ring-1 focus:ring-orange-500 bg-gray-50 text-gray-600" placeholder="0:00" value={track.duration || ''} onChange={(e) => updateTrack('sideA', i, 'duration', e.target.value)} /><button onClick={() => removeTrack('sideA', i)} className="w-8 rounded flex items-center justify-center transition-colors bg-red-50 text-red-500 hover:bg-red-100" title="删除曲目"><Trash2 size={14} /></button></div>
                  <div className="flex gap-2 pl-8"><input className="flex-1 border-none rounded px-2 py-1 text-xs focus:ring-1 focus:ring-orange-500 bg-gray-50 text-gray-600 placeholder-gray-400" placeholder="艺术家" value={track.artist || ''} onChange={(e) => updateTrack('sideA', i, 'artist', e.target.value)} /></div>
                  <input className="w-full border-none rounded px-2 py-1 text-xs italic focus:ring-1 focus:ring-orange-500 bg-gray-50 text-gray-500 placeholder-gray-400" placeholder="备注/心情..." value={track.note || ''} onChange={(e) => updateTrack('sideA', i, 'note', e.target.value)} />
                </div>
              ))}
            </section>
            <section className="space-y-4">
              <div className="flex items-center justify-between pl-1">
                <h3 className="text-xs font-bold text-gray-500">B 面 (SIDE B)</h3>
                <button onClick={() => addTrack('sideB')} className="text-xs flex items-center gap-1 px-2 py-1 rounded transition-colors bg-white border border-gray-300 hover:bg-gray-50 text-orange-600">
                  <Plus size={12} /> 添加曲目
                </button>
              </div>
              {data.sideB.map((track, i) => (
                <div key={i} className="p-3 rounded border space-y-2 group bg-white border-gray-200">
                  <div className="flex gap-2"><div className="w-6 text-gray-500 text-sm font-mono flex items-center justify-center">{i + 1}</div><input className="flex-1 border-none rounded px-2 py-1 text-sm focus:ring-1 focus:ring-orange-500 bg-gray-50 text-gray-900 placeholder-gray-400" placeholder="标题" value={track.title || ''} onChange={(e) => updateTrack('sideB', i, 'title', e.target.value)} /><input className="w-16 border-none rounded px-2 py-1 text-sm text-center focus:ring-1 focus:ring-orange-500 bg-gray-50 text-gray-600" placeholder="0:00" value={track.duration || ''} onChange={(e) => updateTrack('sideB', i, 'duration', e.target.value)} /><button onClick={() => removeTrack('sideB', i)} className="w-8 rounded flex items-center justify-center transition-colors bg-red-50 text-red-500 hover:bg-red-100" title="删除曲目"><Trash2 size={14} /></button></div>
                  <div className="flex gap-2 pl-8"><input className="flex-1 border-none rounded px-2 py-1 text-xs focus:ring-1 focus:ring-orange-500 bg-gray-50 text-gray-600 placeholder-gray-400" placeholder="艺术家" value={track.artist || ''} onChange={(e) => updateTrack('sideB', i, 'artist', e.target.value)} /></div>
                  <input className="w-full border-none rounded px-2 py-1 text-xs italic focus:ring-1 focus:ring-orange-500 bg-gray-50 text-gray-500 placeholder-gray-400" placeholder="备注/心情..." value={track.note || ''} onChange={(e) => updateTrack('sideB', i, 'note', e.target.value)} />
                </div>
              ))}
            </section>

          </div>

        </div >


      </main >
    </div >
  );
}

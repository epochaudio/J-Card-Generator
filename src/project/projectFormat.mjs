import { normalizeAlbumSource, normalizeTrackSource } from '../musicbrainz/projectMetadata.mjs';
import { formatDurationMs, parseDurationToMs } from '../utils/formatDuration.mjs';
import { FRONT_STYLES, TITLE_SIZES, PALETTES, normalizePanelColors } from '../config/design.mjs';

export const PROJECT_VERSION = 3;
export const PROJECT_FORMAT = 'jcard-project';
// Two embedded covers plus text; also checked before parsing files on disk.
export const MAX_PROJECT_BYTES = 64 * 1024 * 1024;
export const DRAFT_DELAY_MS = 800;
const FONT_THEMES = ['modern', 'retro', 'handwritten', 'digital', 'sourcehan', 'puhuiti', 'editorial'];
const fail = (field) => { throw new Error(`作品文件中的“${field}”无效。`); };
const object = (value, field) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(field);
  return value;
};
const string = (value, field, fallback = '') => {
  if (value == null) return fallback;
  if (typeof value !== 'string') fail(field);
  return value;
};
const strings = (source, fields) => Object.fromEntries(fields.map(field => [field, string(source[field], field)]));
const choice = (value, values, fallback, field) => {
  if (value == null) return fallback;
  if (!values.includes(value)) fail(field);
  return value;
};
const boolean = (value, fallback, field) => {
  if (value == null) return fallback;
  if (typeof value !== 'boolean') fail(field);
  return value;
};
const list = (value, field) => {
  if (!Array.isArray(value)) fail(field);
  return value;
};
const image = (value) => {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new Error('封面必须是内嵌的 PNG、JPEG、WebP 或 GIF 图片。请重新上传图片。');
  }
  const [header, payload] = value.split(',');
  let prefix;
  try { prefix = atob(payload.slice(0, 32)); } catch { fail('图片编码'); }
  const valid = header.includes('/png;') ? prefix.startsWith('\x89PNG\r\n\x1a\n')
    : header.includes('/jpeg;') ? prefix.startsWith('\xff\xd8\xff')
    : header.includes('/gif;') ? /^GIF8[79]a/.test(prefix)
    : prefix.startsWith('RIFF') && prefix.slice(8, 12) === 'WEBP';
  if (!valid || payload.length % 4 !== 0) fail('图片内容');
  return value;
};
const color = (value, fallback) => {
  const result = string(value, '配色', fallback);
  if (!/^#[0-9a-f]{6}$/i.test(result)) fail('配色');
  return result;
};

export const localDate = (date = new Date()) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');

// Explicit allowlists prevent transient UI state and credentials from entering files.
export function normalizeSnapshot(input) {
  object(input, '作品');
  const data = object(input.data, '专辑');
  const usedIds = new Set();
  const tracks = (value, side) => list(value, side).map((raw, index) => {
    object(raw, '曲目');
    const track = strings(raw, ['title', 'artist', 'duration', 'note', '_workId', '_workTitle', '_workComposer']);
    track.id = string(raw.id, '曲目 ID', `${side}-${index + 1}`);
    if (!track.id || usedIds.has(track.id)) fail('重复或空曲目 ID');
    usedIds.add(track.id);
    if (raw.musicbrainz != null) track.musicbrainz = normalizeTrackSource(raw.musicbrainz);
    return track;
  });
  const sideA = tracks(data.sideA, 'sideA');
  const sideB = tracks(data.sideB, 'sideB');
  const layout = object(data.layout ?? {}, '布局');
  const mode = choice(layout.mode, ['STANDARD', 'CLASSICAL', 'COMPILATION'], 'STANDARD', '布局模式');
  const shortBackMode = layout.shortBackMode === 'AUTO' ? undefined : layout.shortBackMode;
  const recording = object(input.recordingData ?? {}, '录音资料');
  const credits = object(recording.credits ?? {}, '演职员');
  const theme = object(input.theme ?? {}, '主题');
  const worksData = layout.worksData == null ? null : list(layout.worksData, '作品分组').map(work => {
    object(work, '作品分组');
    return { ...strings(work, ['id', 'title', 'composer']), tracks: list(work.tracks ?? [], '分组曲目').map(id => string(id, '分组曲目 ID')) };
  });
  const total = tracks => formatDurationMs(tracks.reduce((sum, track) => {
    const duration = parseDurationToMs(track.duration);
    if (!Number.isFinite(duration) || duration < 0) fail('曲目时长');
    return sum + duration;
  }, 0));
  return {
    data: {
      ...(data.musicbrainz != null ? { musicbrainz: normalizeAlbumSource(data.musicbrainz) } : {}),
      ...strings(data, ['title', 'artist', 'spineTitle', 'tapeId', 'tapeSubtitle', 'releaseDate', 'coverBadge']),
      sideA, sideB, sideADuration: total(sideA), sideBDuration: total(sideB),
      layout: {
        ...strings(layout, ['noteUpper', 'noteLower']), mode,
        frontStyle: choice(layout.frontStyle, FRONT_STYLES, 'STANDARD', '封面布局'),
        titleSize: choice(layout.titleSize, Object.keys(TITLE_SIZES), 'balanced', '标题尺寸'),
        texture: boolean(layout.texture, false, '纸纹'),
        shortBackMode: choice(shortBackMode, ['META_ARCHIVE', 'TRACKS_COMPACT'], mode === 'CLASSICAL' ? 'META_ARCHIVE' : 'TRACKS_COMPACT', '折页模式'),
        coverBadgeAlign: choice(layout.coverBadgeAlign, ['center', 'left'], 'center', '标语对齐'),
        forceCaps: boolean(layout.forceCaps, true, '大写'),
        minimalSpine: boolean(layout.minimalSpine, false, '极简脊部'),
        spineInverted: boolean(layout.spineInverted, true, '翻转脊部'),
        worksData
      }
    },
    recordingData: {
      ...strings(recording, ['equipment', 'mode', 'labelOverride', 'source', 'recDate']),
      credits: Object.fromEntries(['producers', 'engineers', 'performers'].map(field => [field, list(credits[field] ?? [], field).map(value => string(value, field))]))
    },
    coverImage: image(input.coverImage), coverImageB: image(input.coverImageB),
    theme: { background: color(theme.background, '#121212'), accent: color(theme.accent, '#cc3300'), mood_description: string(theme.mood_description, '心情'), ...(theme.paletteId === 'custom' ? { colors: normalizePanelColors(theme.colors) } : {}), paletteId: choice(theme.paletteId, ['legacy', 'custom', ...Object.keys(PALETTES)], 'legacy', '配色方案') },
    fontTheme: choice(input.fontTheme, FONT_THEMES, 'modern', '字体主题'),
    jCardThemeMode: choice(input.jCardThemeMode, ['dark', 'light', 'cover', 'color'], 'dark', '背景主题'),
    imagePrompt: string(input.imagePrompt, '图片提示词')
  };
}

export function serializeProject(snapshot) {
  const content = JSON.stringify({ format: PROJECT_FORMAT, version: PROJECT_VERSION, project: normalizeSnapshot(snapshot) });
  if (new TextEncoder().encode(content).length > MAX_PROJECT_BYTES) throw new Error('作品超过 64 MB，请缩小封面图片后重试。');
  return content;
}

export function parseProject(content) {
  if (typeof content !== 'string' || new TextEncoder().encode(content).length > MAX_PROJECT_BYTES) throw new Error('作品文件过大或无法读取。');
  let envelope;
  try { envelope = JSON.parse(content); } catch { throw new Error('作品文件不是有效的 JSON，当前作品未改变。'); }
  object(envelope, '文件');
  if (envelope.format !== PROJECT_FORMAT) throw new Error('这不是 J-Card 作品文件。');
  if (envelope.version !== PROJECT_VERSION) throw new Error('不支持此作品格式版本，请使用对应版本的应用打开。');
  return normalizeSnapshot(envelope.project);
}

export function projectFilename(title) {
  return `${(title || '未命名作品').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim().slice(0, 100) || '未命名作品'}.jcard`;
}

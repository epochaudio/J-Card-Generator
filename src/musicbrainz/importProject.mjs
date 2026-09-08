import { normalizeSnapshot, serializeProject } from '../project/projectFormat.mjs';
import { creditList, creditText, SPLIT_RULES } from './model.mjs';
export function createImportSnapshot(current, { group, release, cover, tracks, splitIndex, capacityMinutes, mode, artist, dateDisplay, coverAction, secondCoverAction }) {
  if (!tracks.length || !Number.isInteger(splitIndex) || splitIndex < 0 || splitIndex > tracks.length) throw new Error('请选择有效曲目及分面位置。');
  if (!Number.isFinite(capacityMinutes) || capacityMinutes < SPLIT_RULES.minCapacityMinutes || capacityMinutes > SPLIT_RULES.maxCapacityMinutes) throw new Error('每面容量应在 1 至 120 分钟之间。');
  if (tracks.slice(0, splitIndex).reduce((sum, t) => sum + (t.musicbrainz.durationMs || 0), 0) > capacityMinutes * SPLIT_RULES.millisecondsPerMinute || tracks.slice(splitIndex).reduce((sum, t) => sum + (t.musicbrainz.durationMs || 0), 0) > capacityMinutes * SPLIT_RULES.millisecondsPerMinute) throw new Error('曲目超出每面容量，请重新分面。');
  if (release['release-group']?.id && release['release-group'].id !== group.id) throw new Error('发行版本与所选专辑不一致，请重新选择。');
  if (!['keep', 'replace', 'clear'].includes(coverAction) || !['keep', 'clear'].includes(secondCoverAction) || (coverAction === 'replace' && !cover.image)) throw new Error('请选择有效的封面处理方式。');
  const label = (release['label-info'] || []).map(l => [l.label?.name, l['catalog-number']].filter(Boolean).join(' ')).filter(Boolean).join(' / ');
  const date = dateDisplay === 'first' ? group['first-release-date'] || '' : release.date || '';
  const source = { schemaVersion: 1, releaseGroupId: group.id, releaseId: release.id, firstReleaseDate: group['first-release-date'] || '', editionDate: release.date || '', dateDisplay,
    coverReleaseId: coverAction === 'replace' ? cover.sourceReleaseId : '', coverStatus: coverAction === 'keep' ? 'retained-user-cover' : coverAction === 'replace' ? cover.fallback ? 'group-fallback' : 'release' : 'missing',
    artistCredit: creditList(release['artist-credit']), roles: release.credits.roles, capacityMinutes, splitStrategy: 'reviewed-contiguous', selectedMedia: [...new Set(tracks.map(t => t.musicbrainz.mediumPosition))],
    media: release.media.map((m, i) => ({ position: m.position || i + 1, title: m.title || '', format: m.format || '', trackCount: m.tracks.length })) };
  const snapshot = normalizeSnapshot({ ...current,
    data: { ...current.data, title: release.title || group.title, artist: artist.trim() || creditText(release['artist-credit']), spineTitle: '', tapeId: '', tapeSubtitle: label, releaseDate: date, coverBadge: '', musicbrainz: source,
      sideA: tracks.slice(0, splitIndex), sideB: tracks.slice(splitIndex), layout: { ...current.data.layout, mode, noteUpper: '', noteLower: '', forceCaps: false, worksData: release.works.map(w => ({ ...w, tracks: w.tracks.filter(id => tracks.some(t => t.id === id)) })).filter(w => w.tracks.length) } },
    recordingData: { ...current.recordingData, labelOverride: '', credits: release.credits },
    coverImage: coverAction === 'keep' ? current.coverImage : coverAction === 'replace' ? cover.image : null,
    coverImageB: secondCoverAction === 'keep' ? current.coverImageB : null,
    imagePrompt: '', theme: { ...current.theme, mood_description: '' },
  });
  serializeProject(snapshot); // Includes image signature and size gates before any editor state changes.
  return snapshot;
}

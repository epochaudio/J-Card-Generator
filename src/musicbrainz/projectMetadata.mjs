// Optional v2 extension: older readers ignore it; v1/v2 without it remain valid.
const fail = () => { throw new Error('作品中的 MusicBrainz 来源信息无效。'); };
const obj = value => { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(); return value; };
const text = (v = '') => { if (typeof v !== 'string') fail(); return v; };
const array = (v = []) => { if (!Array.isArray(v)) fail(); return v; };
const num = (v, nullable = false) => { if (v == null && nullable) return null; if (!Number.isFinite(v) || v < 0) fail(); return v; };
const fields = (value, keys) => Object.fromEntries(keys.map(key => [key, text(value[key])]));
const artist = value => fields(obj(value), ['id', 'name']);
const credit = value => fields(obj(value), ['id', 'name', 'joinphrase']);
export function normalizeTrackSource(value) {
  if (value == null) return undefined;
  const v = obj(value);
  return { ...fields(v, ['trackId', 'recordingId', 'mediumTitle', 'mediumFormat', 'trackNumber']), mediumPosition: num(v.mediumPosition), trackPosition: num(v.trackPosition), durationMs: num(v.durationMs, true), artistCredit: array(v.artistCredit).map(credit),
    workPaths: array(v.workPaths).map(p => array(p).map(w => ({ ...fields(obj(w), ['id', 'title']), composers: array(w.composers).map(artist) }))) };
}
export function normalizeAlbumSource(value) {
  if (value == null) return undefined;
  const v = obj(value);
  if (v.schemaVersion !== 1) fail();
  return { schemaVersion: 1, ...fields(v, ['releaseGroupId', 'releaseId', 'firstReleaseDate', 'editionDate', 'dateDisplay', 'coverReleaseId', 'coverStatus', 'splitStrategy']),
    artistCredit: array(v.artistCredit).map(credit),
    roles: array(v.roles).map(r => ({ ...fields(obj(r), ['id', 'name', 'role']), attributes: array(r.attributes).map(a => text(a)) })),
    media: array(v.media).map(m => ({ ...fields(obj(m), ['title', 'format']), position: num(m.position), trackCount: num(m.trackCount) })),
    selectedMedia: array(v.selectedMedia).map(n => num(n)), capacityMinutes: num(v.capacityMinutes),
  };
}

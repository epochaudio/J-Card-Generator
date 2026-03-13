import { formatDurationMs } from '../utils/formatDuration.js';

const MusicBrainzService = {
  userAgent: "JCardGenesis/2.0 ( https://www.epochaudio.cn/ )",

  searchReleaseGroup: async (album, artist) => {
    const cleanAlbum = album.trim();
    const cleanArtist = artist.trim();

    if (!cleanAlbum && !cleanArtist) return [];

    const queryParts = ["primarytype:Album"];

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

    data.credits = MusicBrainzService.parseCredits(data);
    data.works = MusicBrainzService.parseWorks(data);

    return data;
  },

  parseCredits: (data) => {
    const credits = { producers: [], engineers: [], performers: [] };
    const add = (arr, name) => {
      if (!arr.includes(name)) arr.push(name);
    };

    if (data.relations) {
      data.relations.forEach(r => {
        const name = r.artist?.name;
        if (!name) return;
        if (r.type === 'producer') add(credits.producers, name);
        if (['mix', 'engineer', 'mastering'].some(k => r.type.includes(k))) add(credits.engineers, name);
      });
    }

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
          t._workComposer = workMap[w.id].composer;
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
    } catch (error) {
      return null;
    }
  },

  formatDuration: (ms) => formatDurationMs(ms)
};

export default MusicBrainzService;

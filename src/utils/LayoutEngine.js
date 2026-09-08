import { suggestMode } from '../musicbrainz/model.mjs';
const LayoutEngine = {
  detectMode: suggestMode,

  getCommonPrefix: (s1, s2) => {
    if (!s1 || !s2) return "";
    let i = 0;
    while (i < s1.length && i < s2.length && s1[i] === s2[i]) i++;
    return s1.substring(0, i);
  },

  groupTracksNested: (tracks) => {
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
            let suffix = t.title;
            if (suffix.startsWith(groupTitle)) suffix = suffix.slice(groupTitle.length);
            else if (current._workTitle && suffix.startsWith(current._workTitle)) suffix = suffix.slice(current._workTitle.length);
            suffix = suffix.replace(/^[:\-,\s]+/, '');
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

    // Imported tracks require explicit work relationships, even when none were supplied.
    if (tracks.some(t => t.musicbrainz)) return tracks.map(t => ({ type: 'track', ...t, displayTitle: t.title }));

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

export default LayoutEngine;

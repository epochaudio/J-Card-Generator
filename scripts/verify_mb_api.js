
const USER_AGENT = "JCardGenesis/2.0 ( contact@example.com )";

async function searchRelease(query) {
    const url = `https://musicbrainz.org/ws/2/release/?query=${encodeURIComponent(query)}&fmt=json&limit=1`;
    try {
        const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
        const data = await res.json();
        return data.releases && data.releases.length > 0 ? data.releases[0] : null;
    } catch (e) {
        console.error("Search failed:", e);
        return null;
    }
}

async function fetchReleaseDetails(releaseId) {
    // Adding new inc parameters: work-level-rels, recording-level-rels, artist-rels
    // Also include 'labels' and 'recordings' which are standard.
    const url = `https://musicbrainz.org/ws/2/release/${releaseId}?inc=recordings+artist-credits+labels+recording-level-rels+work-level-rels+artist-rels&fmt=json`;
    console.log(`Fetching details for ${releaseId}...`);

    try {
        const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
        const data = await res.json();
        return data;
    } catch (e) {
        console.error("Fetch failed:", e);
        return null;
    }
}

async function analyze(query, type) {
    console.log(`\n--- Analyzing ${type} Release: "${query}" ---`);
    const release = await searchRelease(query);
    if (!release) {
        console.log("Release not found.");
        return;
    }
    console.log(`Found Release: ${release.title} (ID: ${release.id})`);

    const data = await fetchReleaseDetails(release.id);
    if (!data) return;

    if (type === 'Classical') {
        if (data.media && data.media[0] && data.media[0].tracks) {
            console.log("Looking for WORKS structure...");
            const tracks = data.media[0].tracks.slice(0, 5); // Check first 5 tracks
            tracks.forEach((t, i) => {
                let msg = `Track ${i + 1}: ${t.title}`;
                if (t.recording && t.recording.relations) {
                    const workRel = t.recording.relations.find(r => r['target-type'] === 'work');
                    if (workRel) {
                        const work = workRel.work;
                        msg += ` \n      -> Work: ${work.title} (ID: ${work.id})`;
                        if (work.relations) {
                            const composer = work.relations.find(r => r.type === 'composer');
                            if (composer) msg += `\n      -> Composer: ${composer.artist.name}`;
                        }
                    } else {
                        // Debug if no work found
                        msg += ` \n      -> [DEBUG] No work relation found. Relations found: ${t.recording.relations ? t.recording.relations.map(r => r.type).join(', ') : 'None'}`;
                    }
                } else {
                    msg += ` \n      -> [DEBUG] No relations array on recording.`;
                }
                console.log(msg);
            });
        }
    } else {
        // Pop/Rock - Check Credits
        // Debug raw relations count
        console.log(`Debug: Release Relations count: ${data.relations?.length || 0}`);

        console.log("Looking for CREDITS...");
        // Check Release Level Relations
        if (data.relations) {
            data.relations.forEach(r => {
                if (['producer', 'engineer', 'mastering', 'mix'].some(k => r.type.includes(k))) {
                    console.log(` [Release Credit] ${r.type}: ${r.artist?.name}`);
                }
            });
        }
        // Check Track Level Relations (first track)
        if (data.media && data.media[0] && data.media[0].tracks) {
            const t = data.media[0].tracks[0];
            if (t.recording && t.recording.relations) {
                t.recording.relations.forEach(r => {
                    if (['producer', 'mix', 'engineer', 'instrument'].some(k => r.type.includes(k))) {
                        console.log(` [Track Credit] ${r.type}: ${r.artist?.name} (${r.attributes?.join(', ')})`);
                    }
                });
            }
        }
    }
}

// Run
(async () => {
    // Wait a bit to avoid rate limit if previous run was recent
    await new Promise(r => setTimeout(r, 1000));
    // Search specifically for a release known to have works (Karajan 1963)
    await analyze("Beethoven Symphony 5 Karajan 1963", "Classical");

    await new Promise(r => setTimeout(r, 2000));
    // Stricter search for Daft Punk
    await analyze('artist:"Daft Punk" AND release:"Random Access Memories"', "Pop");
})();

// Helper to debug one track if needed
async function debugTrack(data) {
    if (data.media && data.media[0] && data.media[0].tracks) {
        const t = data.media[0].tracks[0];
        console.log("DEBUG TRACK 0 RECORDING:", JSON.stringify(t.recording, null, 2));
    }
}

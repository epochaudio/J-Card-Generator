
const USER_AGENT = "JCardGenesis/2.0 ( contact@example.com )";

async function fetchMB(url) {
    console.log(`Fetching: ${url}`);
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
    return await res.json();
}

async function test() {
    // 1. Search for a famous work (Beethoven 9)
    console.log("\n--- Searching for Work: Beethoven Symphony 9 ---");
    const searchWorkRes = await fetchMB(`https://musicbrainz.org/ws/2/work/?query=work:"Symphony No. 9" AND artist:Beethoven&fmt=json&limit=1`);
    const work = searchWorkRes.works[0];
    if (!work) {
        console.log("Work not found.");
    } else {
        const workId = work.id;
        console.log("\n--- Testing Work Annotation & URLs ---");
        const workData = await fetchMB(`https://musicbrainz.org/ws/2/work/${workId}?inc=annotation+url-rels+artist-rels&fmt=json`);

        console.log("Work Title:", workData.title);
        console.log("Annotation:", workData.annotation ? workData.annotation.text : "NONE");

        const wikiRel = workData.relations?.find(r => r.type === 'wikipedia');
        console.log("Wikipedia Link:", wikiRel ? wikiRel.url.resource : "NONE");
    }

    // 2. Search for a famous Release Group
    console.log("\n--- Searching for Release Group: Random Access Memories ---");
    const searchRgRes = await fetchMB(`https://musicbrainz.org/ws/2/release-group/?query=releasegroup:"Random Access Memories" AND artist:"Daft Punk"&fmt=json&limit=1`);
    const rg = searchRgRes['release-groups'][0];
    if (!rg) {
        console.log("Release Group not found.");
    } else {
        console.log("\n--- Testing Release Group Annotation & URLs ---");
        const rgData = await fetchMB(`https://musicbrainz.org/ws/2/release-group/${rg.id}?inc=annotation+url-rels&fmt=json`);
        console.log("RG Title:", rgData.title);
        console.log("Annotation:", rgData.annotation ? rgData.annotation.text : "NONE");
        const wikiRel = rgData.relations?.find(r => r.type === 'wikipedia');
        console.log("Wikipedia Link:", wikiRel ? wikiRel.url.resource : "NONE");
    }
}

test().catch(console.error);

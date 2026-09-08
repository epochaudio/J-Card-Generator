import { aiTransport } from '../ai/aiTransport.mjs';

export function createAIContentService(settings) {
  const service = {
    callJSON: (prompt, configuration, systemPrompt, model = 'qwen-plus') => aiTransport.text(configuration, prompt, systemPrompt, model),
    generateImage: (prompt) => aiTransport.image(settings, prompt),
    suggestTitle: async (tracks) => {
        const systemPrompt = "You are a creative naming expert. Output JSON.";
        const userPrompt = `Suggest a short, cool, abstract audiophile mixtape title (max 3 words).
    Tracks: ${tracks.map(t => t.title).join(', ')}

    Respond with JSON: { "suggested_title": "string" }
    `;
        return service.callJSON(userPrompt, settings, systemPrompt);
    },

    parseImportData: async (rawText) => {
        const systemPrompt = "You are a music data extraction expert. Output JSON.";
        const userPrompt = `
      Analyze the text. Extract album info and tracklist. Split into Side A/B.

      [Logic 1: Classical Music (Priority)]
      If the text contains "Works", "Sonatas", "Symphony" or logical groupings:
      - Extract "work_title" (e.g. "Sonata Accademiche Op.2")
      - Extract "work_composer" (e.g. "Veracini")

      [Logic 2: Pop/Jazz/Folk/Other]
      For standard albums, ignore grouping headers.
      - Leave "work_title" and "work_composer" EMPTY/NULL.
      - Just extract individual tracks.

      Default duration: "0:00".

      Raw Input:
      ${rawText.substring(0, 10000)}

      Respond with JSON:
      {
        "album_title": "string",
        "album_artist": "string",
        "cover_url": "string",
        "sideA": [
          {
            "title": "string (Movement Name if Classical, e.g. 'I. Allegro')",
            "artist": "string",
            "duration": "string",
            "note": "string",
            "work_title": "string (Optional, for Classical Grouping)",
            "work_composer": "string (Optional)"
          }
        ],
        "sideB": [
          {
            "title": "string",
            "artist": "string",
            "duration": "string",
            "note": "string",
            "work_title": "string (Optional)",
            "work_composer": "string (Optional)"
          }
        ]
      }
    `;
        return service.callJSON(userPrompt, settings, systemPrompt, "qwen3-max");
    },

    // --- New Granular AI Methods ---

    generateSlogan: async (tracks) => {
        const tracksListText = tracks.map(t => `${t.title} ${t.artist ? `by ${t.artist}` : ''}`).join('\n');

        const systemPrompt = `You are a poetic copywriter for an indie music label.
        You specialize in "haiku-like" short, atmospheric descriptions.
        NO marketing speak. NO clichés. NO "Best of".
        Writing style: Intimate, Abstract, Visual, Nostalgic.`;

        const userPrompt = `
        Based on these tracks, generate a short album cover slogan (copy).

        Constraints:
        1. Output MUST be 1 to 3 sentences/phrases.
        2. EACH sentence must be UNDER 20 Chinese characters (including punctuation).
        3. Tone: Like a diary entry, a whisper, or a line of poetry.
        4. ABSOLUTELY NO adjectives like "Shocking", "Perfect", "Ultimate".
        5. It should feel like a "Subtitle" for a memory.

        Tracklist context:
        ${tracksListText.substring(0, 2000)}

        Respond with JSON:
        { "slogan": "Line 1.\\nLine 2.\\nLine 3" }
        `;

        return service.callJSON(userPrompt, settings, systemPrompt, "qwen3-max");
    },

    generateImagePrompt: async (isDark, tracks, notes) => {
        // Consolidate context
        const contextText = `
        Tracks: ${tracks.map(t => t.title).join(', ')}
        Notes/Mood: ${notes || "No specific notes"}
        Theme: ${isDark ? "Dark/Night" : "Light/Day"}
        `;

        const systemPrompt = `You are a Visual Director. You strictly follow brand guidelines to output illustration prompts.`;

        const userPrompt = `
        Task: Create an AI Image Prompt for a Cassette Cover (Illustration Style).

        [Input Context]
        ${contextText.substring(0, 2000)}

        [Strict Process]

        1. DECIDE VIBE: Analyze the tracks/notes to determine the dominant music style/atmosphere.

        2. CHOOSE STYLE (Pick EXACTLY ONE from A, B, C, D):
             A) Watercolor/Gouache (Flowing emotion, dreamy, echo, lyrical)
             B) 90s Magazine Illustration (Strong composition, negative space, retro-pop/rock)
             C) Hand-drawn Diary (Pencil/Pen doodle, paper texture, intimate, solitude)
             D) Flat Design/Risograph (Geometric, blocky, screenprint, electronic/minimal)

             * Note: If needs mix, keep one as DOMINANT.
             * STYLE MUST BE ILLUSTRATION/GRAPHIC.
             * DENY: Photography, Realistic, DSLR.

        3. CONSTRUCT SCENE (Be Concrete):
             * Main Subject + Objects + Light/Color + Texture + 90s Design Language.
             * Live Music -> Stage lights, silhouette, noise, soundwaves.
             * Lyrical -> Negative space, soft dim light, low saturation, still life metaphors.
             * Visuals must align with the "Three-Axis" logic (Light->Dark, Sparse->Full).

        4. GENERATE OUTPUT:
           Return JSON:
           {
             "cover_prompt": "Your generated prompt here (150-250 words, mixed English/Chinese). MUST mention the Style (A/B/C/D) and visual details.",
             "negative_prompt": "photorealistic, photo, camera, dslr, 3d render, watermark, text, blurry, distorted"
           }
        `;

        return service.callJSON(userPrompt, settings, systemPrompt, "qwen3-max");
    }
  };
  // Validate task-specific shapes before editor mutations (JSON syntax alone is insufficient).
  for (const task of ['suggestTitle', 'parseImportData', 'generateSlogan', 'generateImagePrompt']) {
    const run = service[task];
    service[task] = async (...args) => {
      const result = await run(...args);
      const fields = ['album_title', 'album_artist', 'cover_prompt', 'negative_prompt', 'suggested_title', 'cover_url'];
      if (fields.some(field => result[field] != null && typeof result[field] !== 'string')) throw new Error('模型返回的文本字段类型无效，当前作品未改变。');
      if (result.slogan != null && typeof result.slogan !== 'string' && !(Array.isArray(result.slogan) && result.slogan.every(line => typeof line === 'string'))) throw new Error('标语格式无效。');
      for (const side of ['sideA', 'sideB']) {
        if (result[side] != null && (!Array.isArray(result[side]) || result[side].some(track => !track || typeof track !== 'object' || Array.isArray(track) ||
          ['title', 'artist', 'duration', 'note', 'work_title', 'work_composer'].some(field => track[field] != null && typeof track[field] !== 'string')))) throw new Error('模型返回的曲目格式无效，当前作品未改变。');
      }
      const present = task === 'parseImportData' ? Array.isArray(result.sideA) || Array.isArray(result.sideB)
        : task === 'suggestTitle' ? Boolean(result.suggested_title?.trim())
        : task === 'generateSlogan' ? Boolean(result.slogan?.length)
        : Boolean(result.cover_prompt?.trim());
      if (!present) throw new Error('模型没有返回本次操作所需的内容，当前作品未改变。');
      return result;
    };
  }
  return service;
}

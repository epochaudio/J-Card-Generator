
// --- DashScope Service (Alibaba Cloud) ---

const DashScopeService = {
    // Use the OpenAI-compatible endpoint for Qwen for easier JSON handling
    // Doc: https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions
    callQwen: async (prompt, userApiKey, systemPrompt = "You are a helpful assistant.", modelName = "qwen-plus") => {
        const apiKey = userApiKey || "";
        if (!apiKey) throw new Error("API Key is required");

        try {
            const response = await fetch(
                "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: modelName,
                        messages: [
                            { role: "system", content: systemPrompt },
                            { role: "user", content: prompt }
                        ],
                        response_format: { type: "json_object" }
                    })
                }
            );

            if (!response.ok) {
                const err = await response.json();
                throw new Error(`Qwen API Failed: ${err.message || response.statusText}`);
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;

            try {
                return JSON.parse(content);
            } catch (e) {
                console.error("Failed to parse JSON from Qwen:", content);
                throw new Error("Invalid JSON response from Qwen");
            }
        } catch (error) {
            console.error("DashScope Qwen Error:", error);
            throw error;
        }
    },

    // --- Wanx Image Generation (Async) ---
    generateImage: async (prompt, userApiKey) => {
        const apiKey = userApiKey || "";
        if (!apiKey) throw new Error("API Key is required");

        // 1. Create Task
        const createUrl = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis";

        // Using wan2.5-t2i-preview as requested
        const body = {
            model: "wan2.5-t2i-preview",
            input: {
                prompt: prompt
            },
            parameters: {
                size: "1024*1024",
                n: 1
            }
        };

        let taskId = null;
        try {
            const response = await fetch(createUrl, {
                method: "POST",
                headers: {
                    "X-DashScope-Async": "enable",
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(`Wanx Creation Failed: ${err.message || response.statusText}`);
            }

            const data = await response.json();
            taskId = data.output?.task_id;
        } catch (e) {
            throw e;
        }

        if (!taskId) throw new Error("No Task ID returned from Wanx");

        // 2. Poll for Results
        const taskUrl = `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`;
        const maxRetries = 60; // 60 * 2s = 120s max wait

        for (let i = 0; i < maxRetries; i++) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s

            try {
                const res = await fetch(taskUrl, {
                    headers: { "Authorization": `Bearer ${apiKey}` }
                });

                if (!res.ok) continue; // Retry on network blip

                const data = await res.json();
                const status = data.output?.task_status;

                if (status === "SUCCEEDED") {
                    const imageUrl = data.output?.results?.[0]?.url;
                    if (!imageUrl) throw new Error("Task Succeeded but no URL found");
                    // Convert to Base64 to avoid CORS/Hotlink issues in canvas
                    return await DashScopeService.urlToBase64(imageUrl);
                } else if (status === "FAILED" || status === "CANCELED" || status === "UNKNOWN") {
                    throw new Error(`Wanx Task Failed: ${data.output?.message || status}`);
                }
                // If PENDING or RUNNING, continue loop
            } catch (e) {
                console.warn("Polling error:", e);
                // Verify if we should abort or continue. For now continue.
            }
        }

        throw new Error("Wanx Timeout: Image generation took too long");
    },

    urlToBase64: async (url) => {
        try {
            // Use a CORS proxy if needed, but for now try direct.
            // DashScope OSS URLs usually allow Get, but might restrict CORS?
            // Let's try fetching.
            const response = await fetch(url);
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            console.warn("Failed to convert DashScope URL to Base64, returning raw URL", e);
            return url;
        }
    },

    // Wrapper for App Specific Logic
    enhanceContent: async (data, apiKey) => {
        const tracksListText = `A-Side:\n${data.sideA.map(t => `${t.title} ${t.artist ? `by ${t.artist}` : ''}`).join('\n')}\nB-Side:\n${data.sideB.map(t => `${t.title} ${t.artist ? `by ${t.artist}` : ''}`).join('\n')}`;

        const systemPrompt = `You are a legendary Art Director for an indie music label. 
    Your taste is impeccable, avant-garde, and visually evocative. 
    You DO NOT write marketing copy. You create "vibes" and "narratives".`;

        const userPrompt = `
      Analyze the tracklist below. Capture the core mood/atmosphere.
      
      Tasks:
      
      1. [Album Title]
         - Extract 3-6 keyword clusters (Chinese mainly, some English allowed).
         - Generate ONE final Album Title. 
         - Must be distinct, avoiding generic words like "Collection/Best of/Classic".
         - Format: Chinese 2-8 chars OR English 2-5 words. Optional subtitle (max 12 chars).
         - The title must reflect the keyword clusters (e.g. Night/Stage/Echo/Road/Solitude).
      
      2. [Album Copy (Artsy)]
         - Generate 1-3 sentences.
         - STRICT LIMIT: Max 20 Chinese characters per sentence (including punctuation).
         - Style: Poetic, diaristic, cinematic. Like a short poem or inscription.
         - NO marketing slogans (e.g. "Shocking", "Must Listen", "Epic").
      
      3. [Cover Art Prompt] 
          Strictly follow these rules to generate the prompt:
          
          STEP 1: Analyze Main Genre/Vibe from tracks.
          
          STEP 2: Select "The Most Matching" Art Style (CHOOSE EXACTLY ONE):
             A) Watercolor/Gouache (Fluid emotion, dreamy, echo, lyrical)
             B) 90s Magazine Illustration (Bold composition, negative space, retro-pop/rock/city)
             C) Hand-drawn Diary (Pencil/Pen doodle, paper texture, intimate narrative, solitude)
             D) Flat Design/Risograph (Geometric, blocky, screenprint, electronic/indie/minimal)
             * Must be an ILLUSTRATION / GRAPHIC POSTER style. 
             * STRICTLY FORBIDDEN: photo, photorealistic, DSLR, film photo, realistic portrait.

          STEP 3: Concretize the Scene (Visual details):
             * Main Scene + Key Objects + Light/Color + Stroke/Texture + Era Design (90s-00s).
             * Rules:
               - Live tracks: Stage lights, silhouette, noise particles, soundwaves.
               - Lyrical: Negative space, slow light, low saturation, still life metaphors.
               - "Three-Axis Correspondence": detailed light/shadow changes based on album flow.

          STEP 4: Output Requirements:
             - "cover_prompt": 150-250 words, Mixed English/Chinese. 
               * Explicitly state the chosen style (A/B/C/D).
               * Describe the scene in detail.
             - "negative_prompt": One line of negative constraints.
      
      Tracklist:
      ${tracksListText}

      Respond with this JSON structure ONLY:
      {
        "model_used": "qwen3-max", 
        "album_title": "string",
        "album_copy": "string (multiline joined with \\n)",
        "cover_prompt": "string",
        "negative_prompt": "string"
      }
    `;

        // User requested strict model usage: qwen3-max
        // Note: We need to override the default "qwen-plus" in callQwen if possible, 
        // or just pass it as an argument if callQwen supports it. 
        // Since callQwen hardcodes "qwen-plus", we need to modify callQwen or create a new call.
        // Let's modify callQwen to accept model name.
        return DashScopeService.callQwen(userPrompt, apiKey, systemPrompt, "qwen3-max");
    },

    suggestTitle: async (tracks, apiKey) => {
        const systemPrompt = "You are a creative naming expert. Output JSON.";
        const userPrompt = `Suggest a short, cool, abstract audiophile mixtape title (max 3 words). 
    Tracks: ${tracks.map(t => t.title).join(', ')}
    
    Respond with JSON: { "suggested_title": "string" }
    `;
        return DashScopeService.callQwen(userPrompt, apiKey, systemPrompt);
    },

    parseImportData: async (rawText, apiKey) => {
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
        return DashScopeService.callQwen(userPrompt, apiKey, systemPrompt, "qwen3-max");
    },

    // --- New Granular AI Methods ---

    generateSlogan: async (tracks, apiKey) => {
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

        return DashScopeService.callQwen(userPrompt, apiKey, systemPrompt, "qwen3-max");
    },

    generateImagePrompt: async (isDark, tracks, notes, apiKey) => {
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

        return DashScopeService.callQwen(userPrompt, apiKey, systemPrompt, "qwen3-max");
    }
};

export default DashScopeService;

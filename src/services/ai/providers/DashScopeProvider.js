
// src/services/ai/providers/DashScopeProvider.js

const DashScopeProvider = {
    name: "DashScope",
    defaultModel: "qwen-plus",
    
    // --- Core API Calls ---

    callQwen: async (prompt, apiKey, systemPrompt = "You are a helpful assistant.", modelName = "qwen-plus") => {
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

    // --- Image Generation (Wanx) ---
    generateImage: async (prompt, apiKey, options = {}) => {
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
                    return await DashScopeProvider.urlToBase64(imageUrl);
                } else if (status === "FAILED" || status === "CANCELED" || status === "UNKNOWN") {
                    throw new Error(`Wanx Task Failed: ${data.output?.message || status}`);
                }
            } catch (e) {
                console.warn("Polling error:", e);
            }
        }

        throw new Error("Wanx Timeout: Image generation took too long");
    },

    urlToBase64: async (url) => {
        try {
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

    // --- Business Logic Methods ---

    enhanceContent: async (data, apiKey, options = {}) => {
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
         - First, determine the dominant genre/vibe.
         - Select EXACTLY ONE art style from:
           A) Watercolor/Gouache (Fluid emotion, dreamy, echo)
           B) 90s Magazine Illustration (Oversized composition, negative space, retro-pop/city vibe)
           C) Hand-drawn Diary (Pencil/Pen doodle, paper texture, intimate, solitude)
           D) Flat Design/Risograph (Geometric, blocky, screenprint texture, electronic/minimal)
         - Rules: 
           * ABSOLUTELY NO PHOTOGRAPHIC TERMS (No "photo", "realistic", "8k", "DSLR").
           * Must be concrete: Scene + Objects + Lighting + Colors + Texture/Stroke.
           * Live tracks -> Stage lights, silhouettes, noise particles, soundwaves.
           * Lyrical tracks -> Negative space, soft light, heavy texture, still life metaphors.
         - Output: 
           * "cover_prompt": 150-250 words, mixed English/Chinese. Explicitly state the chosen style (A/B/C/D).
           * "negative_prompt": One line of negative constraints.
      
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

        const model = options.model || "qwen3-max";
        return DashScopeProvider.callQwen(userPrompt, apiKey, systemPrompt, model);
    },

    suggestTitle: async (tracks, apiKey, options = {}) => {
        const systemPrompt = "You are a creative naming expert. Output JSON.";
        const userPrompt = `Suggest a short, cool, abstract audiophile mixtape title (max 3 words). 
    Tracks: ${tracks.map(t => t.title).join(', ')}
    
    Respond with JSON: { "suggested_title": "string" }
    `;
        return DashScopeProvider.callQwen(userPrompt, apiKey, systemPrompt, options.model);
    },

    generateSlogan: async (tracks, apiKey, options = {}) => {
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
        
        const model = options.model || "qwen3-max";
        return DashScopeProvider.callQwen(userPrompt, apiKey, systemPrompt, model);
    },

    generateImagePrompt: async (isDark, tracks, notes, apiKey, options = {}) => {
         const contextText = `
        Tracks: ${tracks.map(t => t.title).join(', ')}
        Notes/Mood: ${notes || "No specific notes"}
        Theme: ${isDark ? "Dark/Night" : "Light/Day"}
        `;

        const systemPrompt = `You are an Art Director. You convert music vibes into visual illustration prompts.
        You NEVER ask for "Photorealistic" images. You ONLY ask for stylistic illustrations.`;

        const userPrompt = `
        Analyze the mood of this playlist and create an illustration prompt for a music album cover.

        STEP 1: Determine the dominant vibe.
        STEP 2: Select ONE style from the list below that matches the vibe best:
           A) Watercolor/Gouache (Fluid emotion, dreamy, echo, soft edges)
           B) 90s Magazine Illustration (Bold composition, retro-pop, city vibe, vector-like)
           C) Hand-drawn Diary (Pencil/Pen doodle, paper texture, intimate, rough sketch)
           D) Flat Design/Risograph (Geometric, blocky, screenprint texture, noise, minimal)

        STEP 3: Write the prompt.
           - START with the Style Name (e.g. "Style A: Watercolor...").
           - Describe specific SCENES or OBJECTS (e.g. "An empty chair in rain", "A glowing neon phone").
           - Add details about Lighting, Texture, and Color Palette.
           - Rules:
             * NO "Photo", "Realistic", "4k", "Octane Render".
             * MUST look like an ARTWORK (Illustration/Drawing/Painting).
        
        Input Context:
        ${contextText.substring(0, 2000)}

        Respond with JSON:
        {
          "cover_prompt": "string (150-250 words, mixed English/Chinese key phrases)",
          "negative_prompt": "string (low quality, photo, 3d render, watermark, text)"
        }
        `;

        const model = options.model || "qwen3-max";
        return DashScopeProvider.callQwen(userPrompt, apiKey, systemPrompt, model);
    }
};

export default DashScopeProvider;

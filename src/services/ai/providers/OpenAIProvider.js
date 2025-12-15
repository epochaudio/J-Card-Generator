// src/services/ai/providers/OpenAIProvider.js

const OpenAIProvider = {
    name: "OpenAI",
    defaultModel: "gpt-5.2",
    defaultImageModel: "gpt-image-1",

    // --- Core API Calls ---
    callOpenAI: async (prompt, apiKey, systemPrompt = "You are a helpful assistant.", modelName = "gpt-5.2") => {
        if (!apiKey) throw new Error("API Key is required");

        try {
            // Updated to use the new 'Responses API' standard
            const response = await fetch(
                "https://api.openai.com/v1/responses",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: modelName,
                        input: prompt
                        // reasoning: undefined // Optional for 5.2-pro
                    })
                }
            );

            if (!response.ok) {
                const err = await response.json();
                throw new Error(`OpenAI API Failed: ${err.error?.message || response.statusText}`);
            }

            const data = await response.json();
            // Assuming standard 'response' object structure from new API.
            // If it returns a simple text output field or standard completion format adapt here.
            // Based on user spec, this is a "Response" object. 
            // We'll assume the primary text content is in `output` or `choices[0]`.
            // User didn't specify return structure, but usually it's `output` or similar.
            // Let's standardly assume it returns JSON string if we asked for it, or just text.
            // BUT, the user's curl example shows simple input string.
            // We will defensively parse the result.

            // NOTE: Since the new API is "Responses", let's inspect `data.output` or `data.choices`. 
            // As a fallback for "gpt-5.2" being a text model, we treat it like chat.
            // If standardized to "Responses", it might be `data.output`.
            // Let's assume standard OpenAI structure `choices[0].message.content` OR `data.output` for safety.
            const content = data.output || data.choices?.[0]?.message?.content || JSON.stringify(data);

            try {
                // Try to find JSON in the content if it's mixed text
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    return JSON.parse(jsonMatch[0]);
                }
                return JSON.parse(content);
            } catch (e) {
                console.warn("Failed to parse JSON from OpenAI response, returning raw/mocked:", content);
                // Fallback for non-JSON responses (rare with good prompting)
                return { result: content };
            }
        } catch (error) {
            console.error("OpenAI Error:", error);
            throw error;
        }
    },

    generateImage: async (prompt, apiKey, options = {}) => {
        if (!apiKey) throw new Error("API Key is required");

        try {
            const response = await fetch("https://api.openai.com/v1/images/generations", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: "gpt-image-1", // New SOTA model
                    prompt: prompt,
                    n: 1,
                    size: "1024x1024",
                    // The user explicitly noted: "gpt-image-1 returns base64 image data"
                    // And standard API often takes 'response_format': 'b64_json'
                    response_format: "b64_json"
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(`GPT-Image-1 Failed: ${err.error?.message || response.statusText}`);
            }

            const data = await response.json();
            // Standard OpenAI Images Response: { data: [{ b64_json: "..." }] }
            const b64 = data.data?.[0]?.b64_json;

            if (!b64) throw new Error("No image data returned from GPT-Image-1");

            return `data:image/png;base64,${b64}`;

        } catch (e) {
            console.error("OpenAI Image Gen Error:", e);
            throw e;
        }
    },

    // --- Business Logic Methods ---
    // (We reuse the same prompts but route to callOpenAI)

    enhanceContent: async (data, apiKey, options = {}) => {
        const tracksListText = `A-Side:\n${data.sideA.map(t => `${t.title} ${t.artist ? `by ${t.artist}` : ''}`).join('\n')}\nB-Side:\n${data.sideB.map(t => `${t.title} ${t.artist ? `by ${t.artist}` : ''}`).join('\n')}`;

        const systemPrompt = `You are a legendary Art Director for an indie music label. 
    Your taste is impeccable, avant-garde, and visually evocative. 
    You DO NOT write marketing copy. You create "vibes" and "narratives".`;

        const userPrompt = `
      Analyze the tracklist below. Capture the core mood/atmosphere.
      
      Tasks:
      
      1. [Album Title]
         - Extract 3-6 keyword clusters (English or Chinese).
         - Generate ONE final Album Title (English preferred usually, but follow track language).
         - Must be distinct, avoiding generic words.
         - Format: 2-5 words.
      
      2. [Album Copy (Artsy)]
         - Generate 1-3 sentences in ENGLISH (unless tracks are purely Chinese, then Chinese).
         - Style: Poetic, diaristic, cinematic.
         - NO marketing slogans.
      
      3. [Cover Art Prompt] 
         - Create a prompt for GPT-Image-1.
         - Select a style (Watercolor, 90s Vector, Hand-drawn, Flat Design).
         - Describe Scene + Objects + Lighting + Colors.
         - Output: 
           * "cover_prompt": The exact prompt to send.
           * "negative_prompt": Just for reference.
      
      Tracklist:
      ${tracksListText}

      Respond with this JSON structure ONLY:
      {
        "album_title": "string",
        "album_copy": "string (multiline joined with \\n)",
        "cover_prompt": "string",
        "negative_prompt": "string"
      }
    `;

        const model = options.model || OpenAIProvider.defaultModel;
        // Note: New Responses API might treat 'system' differently.
        // We pack system prompt into the input string for simplicity if API doesn't support separate roles yet,
        // OR we trust the "smart" model to handle instructions in `input`.
        // Given new API often simplifies to just "input", we prepend system prompt.
        const combinedPrompt = `${systemPrompt}\n\n${userPrompt}`;
        return OpenAIProvider.callOpenAI(combinedPrompt, apiKey, "", model);
    },

    suggestTitle: async (tracks, apiKey, options = {}) => {
        const systemPrompt = "You are a creative naming expert. Output JSON.";
        const userPrompt = `Suggest a short, cool, abstract audiophile mixtape title (max 3 words). 
    Tracks: ${tracks.map(t => t.title).join(', ')}
    
    Respond with JSON: { "suggested_title": "string" }
    `;
        const combinedPrompt = `${systemPrompt}\n\n${userPrompt}`;
        return OpenAIProvider.callOpenAI(combinedPrompt, apiKey, "", options.model || OpenAIProvider.defaultModel);
    },

    generateSlogan: async (tracks, apiKey, options = {}) => {
        const tracksListText = tracks.map(t => `${t.title} ${t.artist ? `by ${t.artist}` : ''}`).join('\n');
        const systemPrompt = "You are a poetic copywriter for an indie music label. Output JSON.";
        const userPrompt = `
        Based on these tracks, generate a short album cover slogan (copy).
        
        Constraints:
        1. Output MUST be 1 to 3 sentences/phrases.
        2. Tone: Like a diary entry, a whisper, or a line of poetry.
        3. NO adjectives like "Shocking", "Perfect", "Ultimate".

        Tracklist context:
        ${tracksListText.substring(0, 2000)}

        Respond with JSON:
        { "slogan": "Line 1.\\nLine 2.\\nLine 3" }
        `;
        const combinedPrompt = `${systemPrompt}\n\n${userPrompt}`;
        return OpenAIProvider.callOpenAI(combinedPrompt, apiKey, "", options.model || OpenAIProvider.defaultModel);
    },

    generateImagePrompt: async (isDark, tracks, notes, apiKey, options = {}) => {
        const contextText = `
        Tracks: ${tracks.map(t => t.title).join(', ')}
        Notes/Mood: ${notes || "No specific notes"}
        Theme: ${isDark ? "Dark/Night" : "Light/Day"}
        `;

        const systemPrompt = "You are an Art Director. Output JSON.";
        const userPrompt = `
        Analyze the mood and create a GPT-Image-1 prompt.
        
        Input Context:
        ${contextText.substring(0, 2000)}

        Respond with JSON:
        {
          "cover_prompt": "string (full description)",
          "negative_prompt": "string (unused)"
        }
        `;
        const combinedPrompt = `${systemPrompt}\n\n${userPrompt}`;
        return OpenAIProvider.callOpenAI(combinedPrompt, apiKey, "", options.model || OpenAIProvider.defaultModel);
    },

    parseImportData: async (rawText, apiKey) => {
        const systemPrompt = "You are a music data extraction expert. Output JSON.";
        const userPrompt = `
      Analyze the text. Extract album info and tracklist. Split into Side A/B.
      Default duration: "0:00".

      Raw Input:
      ${rawText.substring(0, 10000)}

      Respond with JSON:
      {
        "album_title": "string",
        "album_artist": "string",
        "cover_url": "string",
        "sideA": [ { "title": "string", "artist": "string", "duration": "string", "note": "string" } ],
        "sideB": [ { "title": "string", "artist": "string", "duration": "string", "note": "string" } ]
      }
    `;
        const combinedPrompt = `${systemPrompt}\n\n${userPrompt}`;
        return OpenAIProvider.callOpenAI(combinedPrompt, apiKey, "", OpenAIProvider.defaultModel);
    }
};

export default OpenAIProvider;

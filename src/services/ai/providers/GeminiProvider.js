// src/services/ai/providers/GeminiProvider.js

const GeminiProvider = {
    name: "Gemini",
    defaultModel: "gemini-2.5-flash-preview-09-2025",

    // --- Core API Calls ---
    callGemini: async (prompt, apiKey, systemPrompt = "You are a helpful assistant.", modelName = "gemini-2.5-flash-preview-09-2025") => {
        if (!apiKey) throw new Error("API Key is required");

        try {
            // Updated Endpoint for v2.5 preview
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

            const body = {
                systemInstruction: {
                    parts: [{ text: systemPrompt }]
                },
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    responseMimeType: "application/json"
                }
            };

            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(`Gemini API Failed: ${err.error?.message || response.statusText}`);
            }

            const data = await response.json();
            const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

            try {
                return JSON.parse(content);
            } catch (e) {
                console.error("Failed to parse JSON from Gemini:", content);
                throw new Error("Invalid JSON response from Gemini");
            }
        } catch (error) {
            console.error("Gemini Error:", error);
            throw error;
        }
    },

    generateImage: async (prompt, apiKey) => {
        if (!apiKey) throw new Error("API Key is required");

        // Imagen 3 Endpoint (v4.0-generate-001) via Generative Language API
        // https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict
        const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`;

        const body = {
            instances: [
                { prompt: prompt }
            ],
            parameters: {
                sampleCount: 1,
                // strictCount: true, // Optional
                // aspectRatio: "1:1", // Optional
            }
        };

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(`Imagen API Failed: ${err.error?.message || response.statusText}`);
            }

            const data = await response.json();
            // Response format for Predict API: { predictions: [ { bytesBase64Encoded: "..." } ] }
            const b64 = data.predictions?.[0]?.bytesBase64Encoded;
            // Or sometimes it's under 'bytes' depending on exact endpoint version, but usually bytesBase64Encoded for this API.

            if (!b64) throw new Error("No image data returned from Imagen");

            return `data:image/png;base64,${b64}`;

        } catch (error) {
            console.error("Gemini Image Gen Error:", error);
            throw error;
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
         - Extract 3-6 keyword clusters.
         - Generate ONE final Album Title (English or Chinese).
         - Format: 2-5 words.
      
      2. [Album Copy (Artsy)]
         - Generate 1-3 sentences.
         - Style: Poetic, diaristic, cinematic.
         - NO marketing slogans.
      
      3. [Cover Art Prompt] 
         - Create a prompt for an illustrator.
         - Output: 
           * "cover_prompt": Description of visual.
           * "negative_prompt": Unused but required for schema.
      
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

        const model = options.model || GeminiProvider.defaultModel;
        return GeminiProvider.callGemini(userPrompt, apiKey, systemPrompt, model);
    },

    suggestTitle: async (tracks, apiKey, options = {}) => {
        const systemPrompt = "You are a creative naming expert. Output JSON.";
        const userPrompt = `Suggest a short, cool, abstract audiophile mixtape title (max 3 words). 
    Tracks: ${tracks.map(t => t.title).join(', ')}
    
    Respond with JSON: { "suggested_title": "string" }
    `;
        return GeminiProvider.callGemini(userPrompt, apiKey, systemPrompt, options.model || GeminiProvider.defaultModel);
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
        return GeminiProvider.callGemini(userPrompt, apiKey, systemPrompt, options.model || GeminiProvider.defaultModel);
    },

    generateImagePrompt: async (isDark, tracks, notes, apiKey, options = {}) => {
        const contextText = `
        Tracks: ${tracks.map(t => t.title).join(', ')}
        Notes/Mood: ${notes || "No specific notes"}
        Theme: ${isDark ? "Dark/Night" : "Light/Day"}
        `;

        const systemPrompt = "You are an Art Director. Output JSON.";
        const userPrompt = `
        Analyze the mood and create an illustration prompt.
        
        Input Context:
        ${contextText.substring(0, 2000)}

        Respond with JSON:
{
    "cover_prompt": "string (full description)",
        "negative_prompt": "string (unused)"
}
`;
        return GeminiProvider.callGemini(userPrompt, apiKey, systemPrompt, options.model || GeminiProvider.defaultModel);
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
        return GeminiProvider.callGemini(userPrompt, apiKey, systemPrompt);
    }
};

export default GeminiProvider;

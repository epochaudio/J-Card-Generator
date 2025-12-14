
// --- DashScope Service (Alibaba Cloud) ---

const DashScopeService = {
    // Use the OpenAI-compatible endpoint for Qwen for easier JSON handling
    // Doc: https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions
    callQwen: async (prompt, userApiKey, systemPrompt = "You are a helpful assistant.") => {
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
                        model: "qwen-plus",
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
        const tracksListText = `Title: ${data.title}\nSide A:\n${data.sideA.map(t => `${t.title} by ${t.artist}`).join('\n')}\nSide B:\n${data.sideB.map(t => `${t.title} by ${t.artist}`).join('\n')}`;

        const systemPrompt = `You are a high-end audiophile graphic designer. Analyze the mixtape tracklist.
    Output MUST be a valid JSON object.
    `;

        const userPrompt = `
      1. Suggest a 2-color theme (background hex, accent hex).
      2. Write a short 'mood_description' (e.g. "NEON SYNTHWAVE SELECTION").
      3. For EACH track, write a very short (max 20 characters) audiophile listening note strictly in Simplified Chinese. 
      
      Tracklist:
      ${tracksListText}

      Respond with this JSON structure:
      {
        "theme": { "background": "#hex", "accent": "#hex", "mood_description": "string" },
        "tracks_enhanced": [ { "note": "string" }, ... ] // Order must match input tracks
      }
    `;

        return DashScopeService.callQwen(userPrompt, apiKey, systemPrompt);
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
        return DashScopeService.callQwen(userPrompt, apiKey, systemPrompt);
    }
};

export default DashScopeService;

export default {
    async fetch(request, env) {
        // Handle CORS (so your website can talk to this worker)
        if (request.method === "OPTIONS") {
            return new Response(null, {
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type",
                }
            });
        }

        if (request.method !== "POST") {
            return new Response("Method not allowed", { status: 405 });
        }

        try {
            const { imageData, prompt, mimeType } = await request.json();
            const base64Data = imageData.split(',')[1];
            const apiKey = env.GEMINI_API_KEY;

            if (!apiKey) {
                return new Response(JSON.stringify({ error: { message: "GEMINI_API_KEY secret is not set in this worker." } }), {
                    status: 500,
                    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
                });
            }

            // AI Extraction Logic
            const models = ['gemini-2.0-flash', 'gemini-flash-latest', 'gemini-1.5-flash'];
            let lastError = null;

            for (const model of models) {
                const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                { text: prompt },
                                { inline_data: { mime_type: mimeType, data: base64Data } }
                            ]
                        }]
                    })
                });

                if (resp.ok) {
                    const data = await resp.json();
                    return new Response(JSON.stringify(data), {
                        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
                    });
                } else {
                    lastError = await resp.json().catch(() => ({ error: { message: "Unknown API Error" } }));
                }
            }

            return new Response(JSON.stringify({ error: { message: lastError?.error?.message || "AI failed to respond. Check API key." } }), {
                status: 502,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
            });

        } catch (err) {
            return new Response(JSON.stringify({ error: { message: err.message } }), {
                status: 500,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
            });
        }
    }
};

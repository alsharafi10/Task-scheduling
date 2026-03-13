// aiEngine.js
// Handles task extraction using Gemini AI with retry logic and model fallback

class AIEngine {
    constructor() {
        // Model fallback chain: try each in order if quota is exceeded
        this.models = [
            'gemini-2.0-flash',
            'gemini-2.0-flash-lite',
            'gemini-1.5-flash'
        ];
        this.maxRetries = 2;
        this.baseDelay = 2000;
    }

    getEndpoint(model) {
        return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${window.CONFIG.API_KEY}`;
    }

    /**
     * Detect hard quota exhaustion (limit: 0 = free tier fully used up)
     */
    isHardQuotaExhausted(errorObj) {
        const msg = (errorObj?.error?.message || '');
        // "limit: 0" means the free tier is completely used up — no point retrying
        return msg.includes('limit: 0') || msg.includes('limit:0');
    }

    /**
     * Detect retryable rate limit (temporary, not hard quota)
     */
    isRateLimitError(status, errorObj) {
        if (status === 429) return true;
        const msg = (errorObj?.error?.message || '').toLowerCase();
        return (msg.includes('rate limit') || msg.includes('resource exhausted'))
            && !this.isHardQuotaExhausted(errorObj);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Try a single model with retry for soft rate-limits only
     */
    async callModel(model, requestBody, onStatus) {
        const endpoint = this.getEndpoint(model);

        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody)
                });

                if (response.ok) {
                    return { success: true, data: await response.json(), model };
                }

                const err = await response.json();
                console.warn(`[${model}] attempt ${attempt + 1} error:`, err);

                // Hard quota (limit: 0) → skip to next model immediately
                if (this.isHardQuotaExhausted(err)) {
                    console.warn(`[${model}] Hard quota exhausted (limit: 0), skipping model`);
                    return { success: false, hardQuota: true, error: err };
                }

                // Soft rate limit → wait and retry
                if (this.isRateLimitError(response.status, err) && attempt < this.maxRetries) {
                    let delay = this.baseDelay * Math.pow(2, attempt);
                    const match = (err?.error?.message || '').match(/retry in ([\d.]+)s/i);
                    if (match) delay = Math.ceil(parseFloat(match[1]) * 1000) + 500;
                    
                    if (onStatus) onStatus(`Retrying in ${Math.ceil(delay / 1000)}s...`);
                    await this.sleep(delay);
                    continue;
                }

                // Other error → stop
                return { success: false, hardQuota: false, error: err };

            } catch (netErr) {
                if (attempt < this.maxRetries) {
                    await this.sleep(this.baseDelay);
                    continue;
                }
                return { success: false, hardQuota: false, error: { error: { message: netErr.message } } };
            }
        }
        return { success: false, hardQuota: false, error: { error: { message: 'Max retries' } } };
    }

    /**
     * Extract tasks from text, with model fallback chain
     * @param {string} text
     * @param {function} onStatus - callback for UI status updates
     * @returns {Promise<Array>}
     */
    async extractTasks(text, onStatus) {
        if (!text || text.trim() === '') return [];

        const systemPrompt = `
You are an AI assistant for a productivity app. Your job is to convert voice notes into structured JSON tasks.
Analyze the user's spoken sentence, remove unnecessary words, summarize the idea, and find actionable tasks.
Detect deadlines, time references, and assign a project category (options: Work, Personal, Business, Travel, or None).
Translate time references to dates if possible (YYYY-MM-DD), assume today is ${new Date().toISOString().split('T')[0]}.

Output ONLY a JSON array of objects. No markdown, no backticks.
Schema for each object:
{
  "title": "Short actionable task title",
  "description": "Full details if any",
  "date": "YYYY-MM-DD (or empty string)",
  "projectName": "One of: Work, Personal, Business, Travel, or None"
}

Example input: "Next week travel to Shanghai to meet supplier"
Output: [{"title": "Travel to Shanghai to meet supplier", "description": "", "date": "2026-03-20", "projectName": "Business"}]
        `;

        const requestBody = {
            contents: [{
                role: "user",
                parts: [
                    { text: systemPrompt },
                    { text: `\n\nUser Voice Note:\n"${text}"` }
                ]
            }],
            generationConfig: {
                temperature: 0.1,
                responseMimeType: "application/json"
            }
        };

        // Try each model in the fallback chain
        for (let i = 0; i < this.models.length; i++) {
            const model = this.models[i];
            if (i > 0 && onStatus) onStatus(`Trying backup model: ${model}...`);

            const result = await this.callModel(model, requestBody, onStatus);

            if (result.success) {
                const resultText = result.data.candidates[0].content.parts[0].text;
                try {
                    const cleaned = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
                    return JSON.parse(cleaned);
                } catch (e) {
                    console.error("JSON parse failed:", resultText);
                    throw new Error("AI returned invalid format");
                }
            }

            if (result.hardQuota) continue; // Try next model
            
            // Non-quota error → give up
            throw new Error(result.error?.error?.message || 'AI failed');
        }

        // All models exhausted
        throw new Error("API quota exhausted for all models. Task will be saved locally.");
    }
}

// Global instance
window.AIService = new AIEngine();

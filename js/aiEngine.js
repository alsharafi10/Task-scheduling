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
        this.maxRetries = 3;
        this.baseDelay = 2000; // 2 seconds base delay for backoff
    }

    /**
     * Build endpoint URL for a given model
     */
    getEndpoint(model) {
        return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${window.CONFIG.API_KEY}`;
    }

    /**
     * Check if an error is a quota/rate-limit error
     */
    isQuotaError(errorObj) {
        const msg = (errorObj?.error?.message || '').toLowerCase();
        return errorObj?.error?.status === 'RESOURCE_EXHAUSTED'
            || msg.includes('quota')
            || msg.includes('rate limit')
            || msg.includes('resource exhausted');
    }

    /**
     * Check if the error suggests retrying after a delay (rate limit vs hard quota)
     */
    isRetryableError(errorObj) {
        const msg = (errorObj?.error?.message || '').toLowerCase();
        return msg.includes('retry') || msg.includes('rate limit');
    }

    /**
     * Sleep helper
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Try a single API call with retry logic for rate-limit errors
     */
    async callWithRetry(model, requestBody, onStatus) {
        const endpoint = this.getEndpoint(model);

        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody)
                });

                if (response.ok) {
                    const data = await response.json();
                    return { success: true, data, model };
                }

                const err = await response.json();
                console.warn(`Gemini API error (model: ${model}, attempt ${attempt + 1}):`, err);

                // If it's a quota error (limit: 0), no point retrying this model
                if (this.isQuotaError(err) && !this.isRetryableError(err)) {
                    return { success: false, quotaExceeded: true, error: err };
                }

                // If it's a rate-limit error (retryable), wait and retry
                if (response.status === 429 || this.isRetryableError(err)) {
                    // Extract retry delay from error message if available
                    let delay = this.baseDelay * Math.pow(2, attempt);
                    const retryMatch = (err?.error?.message || '').match(/retry in ([\d.]+)s/i);
                    if (retryMatch) {
                        delay = Math.ceil(parseFloat(retryMatch[1]) * 1000) + 500;
                    }

                    if (onStatus) onStatus(`Rate limited. Retrying in ${Math.ceil(delay / 1000)}s... (attempt ${attempt + 1}/${this.maxRetries})`);
                    await this.sleep(delay);
                    continue;
                }

                // Other API error - don't retry
                return { success: false, quotaExceeded: false, error: err };

            } catch (networkError) {
                console.error(`Network error (model: ${model}, attempt ${attempt + 1}):`, networkError);
                if (attempt < this.maxRetries - 1) {
                    const delay = this.baseDelay * Math.pow(2, attempt);
                    if (onStatus) onStatus(`Network error. Retrying in ${Math.ceil(delay / 1000)}s...`);
                    await this.sleep(delay);
                } else {
                    return { success: false, quotaExceeded: false, error: { error: { message: networkError.message } } };
                }
            }
        }
        return { success: false, quotaExceeded: false, error: { error: { message: 'Max retries reached' } } };
    }

    /**
     * Extracts tasks from transcribed text
     * @param {string} text - Transcribed voice note
     * @param {function} onStatus - Optional callback for status updates
     * @returns {Promise<Array>} - Array of task objects
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
        let lastError = null;
        for (let i = 0; i < this.models.length; i++) {
            const model = this.models[i];

            if (i > 0 && onStatus) {
                onStatus(`Switching to backup model: ${model}...`);
            }

            console.log(`Trying model: ${model}${i > 0 ? ' (fallback)' : ''}`);

            const result = await this.callWithRetry(model, requestBody, onStatus);

            if (result.success) {
                if (i > 0) {
                    console.log(`Successfully used fallback model: ${model}`);
                }

                const resultText = result.data.candidates[0].content.parts[0].text;

                // Parse JSON cleanly
                try {
                    const cleanedText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
                    return JSON.parse(cleanedText);
                } catch (e) {
                    console.error("Failed to parse JSON from AI", resultText);
                    throw new Error("AI returned invalid format");
                }
            }

            // If quota exceeded, try next model
            if (result.quotaExceeded) {
                console.warn(`Quota exceeded for ${model}, trying next model...`);
                lastError = result.error;
                continue;
            }

            // Other error, stop trying
            lastError = result.error;
            break;
        }

        // All models failed
        const errMsg = lastError?.error?.message || 'AI processing failed';
        if (errMsg.toLowerCase().includes('quota')) {
            throw new Error("All AI models quota exceeded. Please wait a few minutes and try again, or check your API key billing at https://ai.google.dev/rate-limit");
        }
        throw new Error(errMsg);
    }
}

// Global instance
window.AIService = new AIEngine();

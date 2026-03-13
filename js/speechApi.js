// speechApi.js
// Handles Google Cloud Speech-to-Text API

class SpeechAPI {
    constructor() {
        this.apiKey = window.CONFIG.API_KEY;
        this.endpoint = `https://speech.googleapis.com/v1/speech:recognize?key=${this.apiKey}`;
    }

    /**
     * Converts audio base64 to text using Google Speech-to-Text
     * @param {string} audioBase64 - Base64 encoded audio content (no data URI prefix)
     * @param {number} sampleRate - Sample rate of the audio (e.g. 48000)
     * @returns {Promise<string>} - Transcribed text
     */
    async transcribe(audioBase64, sampleRate = 48000) {
        // Request body for Speech API
        // Using OGG_OPUS or WEBM_OPUS for web recordings, but often browser recordings
        // are best handled by letting the API auto-detect or using WEBM_OPUS

        const requestBody = {
            config: {
                encoding: "WEBM_OPUS",
                sampleRateHertz: sampleRate,
                languageCode: "en-US",
                alternativeLanguageCodes: ["ar-SA", "zh-CN", "ar-AE"], // Auto-detect English, Arabic, Chinese
                enableAutomaticPunctuation: true
            },
            audio: {
                content: audioBase64
            }
        };

        try {
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const err = await response.json();
                console.error("Speech API Error:", err);
                throw new Error(err.error?.message || "Speech API request failed");
            }

            const data = await response.json();

            // Extract transcription
            if (data.results && data.results.length > 0) {
                const transcription = data.results
                    .map(r => r.alternatives[0].transcript)
                    .join(' ');

                // Also get the language detected
                const detectedLang = data.results[0].languageCode || "auto";
                console.log(`Detected Language: ${detectedLang}`);

                return {
                    text: transcription,
                    language: detectedLang
                };
            } else {
                return { text: "", language: "" };
            }

        } catch (error) {
            console.error("Transcription error:", error);
            throw error;
        }
    }
}

// Global instance
window.SpeechService = new SpeechAPI();

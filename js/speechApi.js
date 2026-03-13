// speechApi.js
// Uses FREE browser-native Web Speech API (no Google Cloud needed, no API key needed)

class SpeechAPI {
    constructor() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.error("Web Speech API not supported in this browser.");
            this.supported = false;
            return;
        }
        this.supported = true;
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.maxAlternatives = 1;

        // Support multiple languages
        // The browser will auto-detect among these
        this.recognition.lang = 'zh-CN'; // Primary language
    }

    /**
     * Start listening and return a promise with the transcribed text
     * @param {string} lang - Language code (e.g. 'en-US', 'ar-SA', 'zh-CN')
     * @returns {Promise<{text: string, language: string}>}
     */
    listen(lang) {
        return new Promise((resolve, reject) => {
            if (!this.supported) {
                reject(new Error("Speech recognition not supported in this browser."));
                return;
            }

            if (lang) {
                this.recognition.lang = lang;
            }

            let resultReceived = false;

            this.recognition.onresult = (event) => {
                resultReceived = true;
                const result = event.results[0][0];
                const text = result.transcript;
                const confidence = result.confidence;
                console.log(`Speech recognized: "${text}" (confidence: ${confidence})`);

                // Try to detect what language was actually used
                let detectedLang = this.recognition.lang;
                
                // Simple heuristic: check if text contains Arabic or Chinese characters
                if (/[\u0600-\u06FF]/.test(text)) {
                    detectedLang = 'AR-X-GULF';
                } else if (/[\u4e00-\u9fff]/.test(text)) {
                    detectedLang = 'CMN-HANS-CN';
                } else if (/[a-zA-Z]/.test(text)) {
                    detectedLang = 'EN-US';
                }

                resolve({
                    text: text,
                    language: detectedLang
                });
            };

            this.recognition.onerror = (event) => {
                console.error("Speech recognition error:", event.error);
                if (event.error === 'no-speech') {
                    resolve({ text: "", language: "" });
                } else {
                    reject(new Error(`Speech recognition error: ${event.error}`));
                }
            };

            this.recognition.onend = () => {
                if (!resultReceived) {
                    resolve({ text: "", language: "" });
                }
            };

            this.recognition.start();
        });
    }

    /**
     * Stop listening
     */
    stop() {
        if (this.supported && this.recognition) {
            this.recognition.stop();
        }
    }
}

// Global instance
window.SpeechService = new SpeechAPI();

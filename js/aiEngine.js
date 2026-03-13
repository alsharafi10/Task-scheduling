// aiEngine.js
// Handles task extraction using Gemini AI

class AIEngine {
    constructor() {
        this.apiKey = window.CONFIG.API_KEY;
        this.endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`;
    }

    /**
     * Extracts tasks from transcribed text
     * @param {string} text - Transcribed voice note
     * @returns {Promise<Array>} - Array of task objects
     */
    async extractTasks(text) {
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
                temperature: 0.1, // Low temp for structured reliable output
                responseMimeType: "application/json"
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
                console.error("Gemini API Error:", err);
                throw new Error(err.error?.message || "AI processing failed");
            }

            const data = await response.json();
            const resultText = data.candidates[0].content.parts[0].text;

            // Parse JSON cleanly
            let tasks = [];
            try {
                // Sometime models return markdown JSON blocks despite instructions
                const cleanedText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
                tasks = JSON.parse(cleanedText);
            } catch (e) {
                console.error("Failed to parse JSON from AI", resultText);
                throw new Error("AI returned invalid format");
            }

            return tasks;

        } catch (error) {
            console.error("AI Engine error:", error);
            throw error;
        }
    }
}

// Global instance
window.AIService = new AIEngine();

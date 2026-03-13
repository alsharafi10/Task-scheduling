// recorder.js
// Handles voice capture using browser Web Speech API + AI task extraction

class VoiceRecorder {
    constructor() {
        this.isRecording = false;

        // UI Elements
        this.btnRecord = document.getElementById('btn-record');
        this.statusIndicator = document.getElementById('recording-status');
        this.statusText = document.querySelector('.status-text');
        this.pulseDot = document.querySelector('.pulse-dot');

        this.transcriptionArea = document.getElementById('transcription-area');
        this.transcriptionText = document.getElementById('transcription-text');
        this.langIndicator = document.getElementById('lang-indicator');

        this.aiStatusArea = document.getElementById('ai-status-area');

        this.init();
    }

    init() {
        if (!this.btnRecord) return;

        this.btnRecord.addEventListener('click', () => {
            if (this.isRecording) {
                this.stopRecording();
            } else {
                this.startRecording();
            }
        });
    }

    async startRecording() {
        // Check if API key is set
        if (!window.CONFIG.API_KEY) {
            alert("Please set your API Key first. Click the ⚙️ settings icon.");
            if (window.App && window.App.openSettings) {
                window.App.openSettings();
            }
            return;
        }

        // Check if speech recognition is supported
        if (!window.SpeechService || !window.SpeechService.supported) {
            alert("Speech recognition is not supported in this browser. Please use Chrome or Safari.");
            return;
        }

        this.isRecording = true;

        // Update UI to recording state
        this.btnRecord.classList.add('recording');
        this.pulseDot.classList.add('active');
        this.statusText.textContent = "Listening...";

        this.transcriptionArea.classList.add('hidden');
        this.aiStatusArea.classList.add('hidden');

        try {
            // Use browser's free speech recognition
            const speechResult = await window.SpeechService.listen('zh-CN');

            // Recording is done
            this.isRecording = false;
            this.btnRecord.classList.remove('recording');
            this.pulseDot.classList.remove('active');

            if (!speechResult.text) {
                this.statusText.textContent = "Tap to talk";
                alert("Could not hear anything clearly. Please try again.");
                return;
            }

            // Show transcription
            this.transcriptionText.textContent = speechResult.text;
            this.langIndicator.textContent = speechResult.language.toUpperCase();
            this.transcriptionArea.classList.remove('hidden');

            // Send to AI Engine for task extraction
            this.statusText.textContent = "Analyzing tasks...";
            this.aiStatusArea.classList.remove('hidden');

            const extractedTasks = await window.AIService.extractTasks(speechResult.text);

            // Process Results
            if (extractedTasks.length > 0) {
                this.saveExtractedTasks(extractedTasks);
                this.addRecentExtraction(speechResult.text, extractedTasks.length);
                this.statusText.textContent = `Saved ${extractedTasks.length} task(s)!`;
            } else {
                this.statusText.textContent = "No tasks detected.";
            }

        } catch (err) {
            console.error("Processing pipeline failed:", err);
            this.isRecording = false;
            this.btnRecord.classList.remove('recording');
            this.pulseDot.classList.remove('active');
            this.statusText.textContent = "Error occurred.";
            alert("Failed to process voice note: " + err.message);
        } finally {
            this.aiStatusArea.classList.add('hidden');
            setTimeout(() => {
                if (!this.isRecording) this.statusText.textContent = "Tap to talk";
            }, 3000);
        }
    }

    stopRecording() {
        if (this.isRecording) {
            this.isRecording = false;
            // Stop the speech recognition
            if (window.SpeechService) {
                window.SpeechService.stop();
            }
            this.btnRecord.classList.remove('recording');
            this.pulseDot.classList.remove('active');
            this.statusText.textContent = "Processing...";
        }
    }

    saveExtractedTasks(tasksArray) {
        const projects = window.ProjectsDB.getAll();

        tasksArray.forEach(t => {
            // Find project ID matching the name, or default to none
            let projectId = "";
            if (t.projectName && t.projectName !== "None") {
                const proj = projects.find(p => p.name.toLowerCase() === t.projectName.toLowerCase());
                if (proj) projectId = proj.id;
            }

            window.TaskDB.add({
                title: t.title,
                description: t.description || "",
                date: t.date || "",
                projectId: projectId
            });
        });
    }

    addRecentExtraction(text, count) {
        const container = document.getElementById('recent-extractions');
        if (!container) return;

        // Remove empty state if present
        const emptyState = container.querySelector('.empty-state');
        if (emptyState) emptyState.remove();

        const el = document.createElement('div');
        el.className = 'card';
        el.style.marginTop = '0';
        el.innerHTML = `
            <div style="font-size: 14px; margin-bottom: 8px; font-style: italic;">"${text}"</div>
            <div class="badge" style="display:inline-block">${count} task(s) created</div>
        `;

        container.prepend(el);

        // Keep only top 5
        if (container.children.length > 5) {
            container.lastElementChild.remove();
        }
    }
}

// Global instance created when DOM loads
document.addEventListener('DOMContentLoaded', () => {
    window.RecorderService = new VoiceRecorder();
});

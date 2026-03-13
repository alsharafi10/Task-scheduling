// recorder.js
// Handles Web Audio API and MediaRecorder for voice capture

class VoiceRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
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
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Set up MediaRecorder
            // Prioritize WEBM format for Google Speech API compatibility
            let options = { mimeType: 'audio/webm' };
            if (!MediaRecorder.isTypeSupported('audio/webm')) {
                // Fallback for Safari which often uses audio/mp4
                options = { mimeType: 'audio/mp4' };
            }

            this.mediaRecorder = new MediaRecorder(stream, options);
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => this.processRecording();

            // Start recording
            this.mediaRecorder.start();
            this.isRecording = true;

            // Update UI
            this.btnRecord.classList.add('recording');
            this.pulseDot.classList.add('active');
            this.statusText.textContent = "Listening...";

            this.transcriptionArea.classList.add('hidden');
            this.aiStatusArea.classList.add('hidden');

        } catch (err) {
            console.error("Recording failed:", err);
            alert("Could not access microphone. Please check permissions.");
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;

            // Stop all tracks to release mic
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());

            // Update UI
            this.btnRecord.classList.remove('recording');
            this.pulseDot.classList.remove('active');
            this.statusText.textContent = "Processing audio...";
        }
    }

    async processRecording() {
        try {
            const audioBlob = new Blob(this.audioChunks, { type: this.mediaRecorder.mimeType });

            // Convert to Base64
            const base64Audio = await this.blobToBase64(audioBlob);

            // 1. Send to Speech API
            this.statusText.textContent = "Transcribing...";
            const speechResult = await window.SpeechService.transcribe(base64Audio);

            if (!speechResult.text) {
                this.statusText.textContent = "Tap to talk";
                alert("Could not hear anything clearly. Please try again.");
                return;
            }

            // Show transcription
            this.transcriptionText.textContent = speechResult.text;
            this.langIndicator.textContent = speechResult.language.toUpperCase();
            this.transcriptionArea.classList.remove('hidden');

            // 2. Send to AI Engine
            this.statusText.textContent = "Analyzing tasks...";
            this.aiStatusArea.classList.remove('hidden');

            const extractedTasks = await window.AIService.extractTasks(speechResult.text);

            // 3. Process Results
            if (extractedTasks.length > 0) {
                this.saveExtractedTasks(extractedTasks);
                this.addRecentExtraction(speechResult.text, extractedTasks.length);
                this.statusText.textContent = `Saved ${extractedTasks.length} task(s)!`;
            } else {
                this.statusText.textContent = "No tasks detected.";
            }

        } catch (err) {
            console.error("Processing pipeline failed:", err);
            this.statusText.textContent = "Error occurred.";
            alert("Failed to process voice note: " + err.message);
        } finally {
            this.aiStatusArea.classList.add('hidden');
            setTimeout(() => {
                if (!this.isRecording) this.statusText.textContent = "Tap to talk";
            }, 3000);
        }
    }

    blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                // Remove data URL prefix (e.g. data:audio/webm;base64,)
                const base64String = reader.result.split(',')[1];
                resolve(base64String);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
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

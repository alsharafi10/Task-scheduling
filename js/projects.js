// projects.js
// Handles project CRUD and persistence

const ProjectsDB = {
    key: 'voice_tasks_projects',
    data: [],

    init() {
        const stored = localStorage.getItem(this.key);
        if (stored) {
            this.data = JSON.parse(stored);
        } else {
            // Default projects
            this.data = [
                { id: '1', name: 'Work', color: '#6366f1' },
                { id: '2', name: 'Personal', color: '#ec4899' },
                { id: '3', name: 'Business', color: '#10b981' },
                { id: '4', name: 'Travel', color: '#f59e0b' }
            ];
            this.save();
        }
    },

    save() {
        localStorage.setItem(this.key, JSON.stringify(this.data));
    },

    getAll() {
        return this.data;
    },

    get(id) {
        return this.data.find(p => p.id === id);
    },

    add(name, color = '#6366f1') {
        const id = Date.now().toString();
        this.data.push({ id, name, color });
        this.save();
        return id;
    },

    delete(id) {
        this.data = this.data.filter(p => p.id !== id);
        this.save();
    }
};

// Initialize immediately
ProjectsDB.init();

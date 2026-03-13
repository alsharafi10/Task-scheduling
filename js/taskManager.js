// taskManager.js
// Handles task CRUD and persistence

const TaskDB = {
    key: 'voice_tasks_data',
    data: [],

    init() {
        const stored = localStorage.getItem(this.key);
        if (stored) {
            this.data = JSON.parse(stored);
        } else {
            this.data = [];
            this.save();
        }
    },

    save() {
        localStorage.setItem(this.key, JSON.stringify(this.data));
        // Dispatch event for UI updates
        window.dispatchEvent(new Event('tasks_updated'));
    },

    getAll() {
        // Sort: pending first, then by date (newest first)
        return [...this.data].sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            return new Date(b.createdAt) - new Date(a.createdAt);
        });
    },

    get(id) {
        return this.data.find(t => t.id === id);
    },

    getForDate(dateStr) {
        // dateStr format: YYYY-MM-DD
        return this.getAll().filter(t => t.date === dateStr);
    },

    getDatesWithTasks() {
        const dates = new Set();
        this.data.forEach(t => {
            if (t.date) dates.add(t.date);
        });
        return Array.from(dates);
    },

    add(taskData) {
        const task = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            title: taskData.title || 'Untitled Task',
            description: taskData.description || '',
            date: taskData.date || '', // YYYY-MM-DD
            projectId: taskData.projectId || '',
            completed: false,
            createdAt: new Date().toISOString()
        };
        this.data.push(task);
        this.save();
        return task;
    },

    update(id, updates) {
        const index = this.data.findIndex(t => t.id === id);
        if (index !== -1) {
            this.data[index] = { ...this.data[index], ...updates };
            this.save();
            return this.data[index];
        }
        return null;
    },

    toggleStatus(id) {
        const task = this.get(id);
        if (task) {
            return this.update(id, { completed: !task.completed });
        }
    },

    delete(id) {
        this.data = this.data.filter(t => t.id !== id);
        this.save();
    }
};

// Initialize immediately
TaskDB.init();

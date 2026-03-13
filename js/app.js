// app.js
// Main application logic, routing, and UI rendering

const App = {
    currentScreen: 'screen-home',
    calendar: null,

    init() {
        this.bindNavigation();
        this.bindModals();

        this.calendar = new Calendar();

        // Global access for other modules
        window.App = this;

        this.renderTasks();
        this.renderProjects();

        // Listen to task updates
        window.addEventListener('tasks_updated', () => {
            this.renderTasks();
        });

        console.log("Voice Tasks AI Initialized");
    },

    // --- Navigation ---
    bindNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const target = item.dataset.target;
                this.navigateTo(target);

                // Update active state
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
            });
        });
    },

    navigateTo(screenId) {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });

        // Show target
        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            targetScreen.classList.add('active');
            this.currentScreen = screenId;

            // Screen specific logic
            if (screenId === 'screen-calendar' && this.calendar) {
                this.calendar.render();
            }
        }
    },

    // --- UI Renderers ---

    // Renders a list of tasks into a container
    renderTaskList(tasks, container) {
        container.innerHTML = '';

        if (tasks.length === 0) {
            container.innerHTML = '<div class="empty-state">No tasks found.</div>';
            return;
        }

        tasks.forEach(task => {
            const project = task.projectId ? ProjectsDB.get(task.projectId) : null;

            const el = document.createElement('div');
            el.className = `task-item ${task.completed ? 'completed' : ''}`;
            el.dataset.id = task.id;

            // Checkbox
            const checkbox = document.createElement('div');
            checkbox.className = `task-checkbox ${task.completed ? 'checked' : ''}`;
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
                TaskDB.toggleStatus(task.id);
            });

            // Content
            const content = document.createElement('div');
            content.className = 'task-content';

            const title = document.createElement('div');
            title.className = 'task-title';
            title.textContent = task.title;

            const meta = document.createElement('div');
            meta.className = 'task-meta';

            if (project) {
                const pTag = document.createElement('span');
                pTag.className = 'project-tag';
                pTag.style.color = project.color;
                pTag.style.backgroundColor = `${project.color}1a`; // 10% opacity
                pTag.textContent = project.name;
                meta.appendChild(pTag);
            }

            if (task.date) {
                const dTag = document.createElement('span');
                dTag.className = 'task-meta-item';
                dTag.innerHTML = `<span class="material-symbols-outlined">calendar_today</span> ${task.date}`;
                meta.appendChild(dTag);
            }

            content.appendChild(title);
            if (meta.children.length > 0) content.appendChild(meta);

            el.appendChild(checkbox);
            el.appendChild(content);

            // Click to edit
            el.addEventListener('click', () => {
                this.openTaskModal(task);
            });

            container.appendChild(el);
        });
    },

    // Renders tasks on the Main Tasks screen
    renderTasks(filter = 'all') {
        const container = document.getElementById('tasks-list');
        if (!container) return;

        let tasks = TaskDB.getAll();

        if (filter === 'pending') tasks = tasks.filter(t => !t.completed);
        if (filter === 'completed') tasks = tasks.filter(t => t.completed);

        this.renderTaskList(tasks, container);
    },

    // Renders projects list
    renderProjects() {
        const container = document.getElementById('projects-list');
        if (!container) return;

        const projects = ProjectsDB.getAll();
        container.innerHTML = '';

        projects.forEach(project => {
            const tasksCount = TaskDB.getAll().filter(t => t.projectId === project.id && !t.completed).length;

            const el = document.createElement('div');
            el.className = 'card';
            el.style.display = 'flex';
            el.style.justifyContent = 'space-between';
            el.style.alignItems = 'center';
            el.style.cursor = 'pointer';

            el.innerHTML = `
                <div style="display:flex; align-items:center; gap:12px;">
                    <div style="width:16px; height:16px; border-radius:50%; background-color:${project.color}"></div>
                    <span style="font-weight:600">${project.name}</span>
                </div>
                <div class="badge">${tasksCount} task(s)</div>
            `;

            el.addEventListener('click', () => {
                // Future: open project details
                alert(`Project: ${project.name}`);
            });

            container.appendChild(el);
        });

        // Update project select in modal
        const select = document.getElementById('task-project');
        if (select) {
            select.innerHTML = '<option value="">None</option>';
            projects.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = p.name;
                select.appendChild(opt);
            });
        }
    },

    // --- Modals ---
    bindModals() {
        const overlay = document.getElementById('modal-overlay');
        const modal = document.getElementById('task-modal');
        const closeBtns = document.querySelectorAll('.close-modal');

        // Add Task Btn
        const addBtn = document.getElementById('btn-add-task');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.openTaskModal());
        }

        // Close modal
        closeBtns.forEach(btn => {
            btn.addEventListener('click', () => this.closeModal());
        });
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.closeModal();
        });

        // Form submit
        const form = document.getElementById('task-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveTaskFromForm();
            });
        }

        // Delete button
        const deleteBtn = document.getElementById('btn-delete-task');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                const id = document.getElementById('task-id').value;
                if (id) {
                    TaskDB.delete(id);
                    this.closeModal();
                }
            });
        }

        // Task filters
        document.querySelectorAll('.filter-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this.renderTasks(chip.dataset.filter);
            });
        });
    },

    openTaskModal(task = null) {
        const overlay = document.getElementById('modal-overlay');
        const titleEl = document.getElementById('modal-title');
        const deleteBtn = document.getElementById('btn-delete-task');

        // Reset form
        document.getElementById('task-form').reset();

        if (task) {
            titleEl.textContent = 'Edit Task';
            deleteBtn.classList.remove('hidden');

            document.getElementById('task-id').value = task.id;
            document.getElementById('task-title').value = task.title;
            document.getElementById('task-desc').value = task.description || '';
            document.getElementById('task-date').value = task.date || '';
            document.getElementById('task-project').value = task.projectId || '';
            document.getElementById('task-completed').checked = task.completed;
        } else {
            titleEl.textContent = 'New Task';
            deleteBtn.classList.add('hidden');
            document.getElementById('task-id').value = '';
        }

        overlay.classList.remove('hidden');
    },

    closeModal() {
        const overlay = document.getElementById('modal-overlay');
        overlay.classList.add('hidden');
    },

    saveTaskFromForm() {
        const id = document.getElementById('task-id').value;
        const taskData = {
            title: document.getElementById('task-title').value,
            description: document.getElementById('task-desc').value,
            date: document.getElementById('task-date').value,
            projectId: document.getElementById('task-project').value,
            completed: document.getElementById('task-completed').checked
        };

        if (id) {
            TaskDB.update(id, taskData);
        } else {
            TaskDB.add(taskData);
        }

        this.closeModal();
    }
};

// Start application
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

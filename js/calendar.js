// calendar.js
// Handles calendar rendering and interactions

class Calendar {
    constructor() {
        this.currentDate = new Date();
        this.selectedDate = new Date();

        // Element refs
        this.monthYearEl = document.getElementById('calendar-month-year');
        this.gridEl = document.getElementById('calendar-grid');
        this.selectedDateLabel = document.getElementById('selected-date-label');
        this.tasksListEl = document.getElementById('calendar-tasks-list');

        this.init();
    }

    init() {
        if (!this.monthYearEl || !this.gridEl) return;
        this.render();

        // Listen for task updates to refresh dots
        window.addEventListener('tasks_updated', () => {
            this.render();
        });
    }

    render() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();

        // Month name
        const monthNames = ["January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"];
        this.monthYearEl.textContent = `${monthNames[month]} ${year}`;

        // Clear grid
        this.gridEl.innerHTML = '';

        // Get first day of month and total days
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Get dates with tasks
        const taskDates = TaskDB.getDatesWithTasks();

        // Add empty cells for days before start of month
        for (let i = 0; i < firstDay; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'calendar-day empty';
            this.gridEl.appendChild(emptyCell);
        }

        const today = new Date();

        // Add days
        for (let day = 1; day <= daysInMonth; day++) {
            const cellDate = new Date(year, month, day);
            const dateStr = this.formatDate(cellDate);

            const cell = document.createElement('div');
            cell.className = 'calendar-day';
            cell.textContent = day;
            cell.dataset.date = dateStr;

            // Check if today
            if (cellDate.toDateString() === today.toDateString()) {
                cell.classList.add('today');
            }

            // Check if selected
            if (cellDate.toDateString() === this.selectedDate.toDateString()) {
                cell.classList.add('selected');
            }

            // Check if has tasks
            if (taskDates.includes(dateStr)) {
                cell.classList.add('has-tasks');
            }

            cell.addEventListener('click', () => {
                this.selectDate(cellDate, dateStr);
            });

            this.gridEl.appendChild(cell);
        }

        // Initial load of tasks for selected date
        this.loadTasksForDate(this.formatDate(this.selectedDate));
    }

    selectDate(date, dateStr) {
        this.selectedDate = date;

        // Update UI selection
        const cells = this.gridEl.querySelectorAll('.calendar-day');
        cells.forEach(c => c.classList.remove('selected'));

        const selectedCell = Array.from(cells).find(c => c.dataset.date === dateStr);
        if (selectedCell) {
            selectedCell.classList.add('selected');
        }

        // Update label
        const today = new Date();
        if (date.toDateString() === today.toDateString()) {
            this.selectedDateLabel.textContent = "Today";
        } else {
            this.selectedDateLabel.textContent = dateStr;
        }

        this.loadTasksForDate(dateStr);
    }

    loadTasksForDate(dateStr) {
        const tasks = TaskDB.getForDate(dateStr);
        this.tasksListEl.innerHTML = '';

        if (tasks.length === 0) {
            this.tasksListEl.innerHTML = '<div class="empty-state">No scheduled tasks for this date.</div>';
            return;
        }

        // Reuse task rendering from app.js (we'll define a global renderer)
        if (window.App && window.App.renderTaskList) {
            window.App.renderTaskList(tasks, this.tasksListEl);
        }
    }

    formatDate(date) {
        const d = new Date(date);
        const month = '' + (d.getMonth() + 1);
        const day = '' + d.getDate();
        const year = d.getFullYear();

        return [year, month.padStart(2, '0'), day.padStart(2, '0')].join('-');
    }
}

// Global instance created in app.js

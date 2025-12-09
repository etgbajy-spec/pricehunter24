/**
 * 오늘 할 일 리스트 컴포넌트
 */

export class TodoList {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
    }

    render(todos) {
        if (!this.container) return;

        if (todos.length === 0) {
            this.container.innerHTML = `
                <div class="p-8 text-center text-gray-500">
                    오늘 할 일이 없습니다. 🎉
                </div>
            `;
            return;
        }

        this.container.innerHTML = todos.map(todo => `
            <div class="p-4 hover:bg-gray-50 cursor-pointer transition-colors border-l-4 ${this.getBorderColor(todo.type)}" 
                 data-id="${todo.id}" 
                 data-type="${todo.type}">
                <div class="flex items-start justify-between">
                    <div class="flex-1">
                        <div class="flex items-center space-x-2 mb-1">
                            <span class="text-lg">${todo.icon}</span>
                            <span class="font-semibold text-gray-800">${todo.title}</span>
                            <span class="px-2 py-0.5 text-xs rounded ${this.getBadgeColor(todo.priority)}">
                                ${todo.priority}
                            </span>
                        </div>
                        <p class="text-sm text-gray-600 ml-7">${todo.description}</p>
                        <div class="text-xs text-gray-500 ml-7 mt-1">
                            ${this.formatTime(todo.createdAt)}
                        </div>
                    </div>
                    <button class="ml-4 p-2 hover:bg-gray-200 rounded-lg transition-colors" 
                            onclick="window.adminApp.handleTodoClick('${todo.type}', '${todo.id}')">
                        <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `).join('');
    }

    getBorderColor(type) {
        const colors = {
            request: 'border-pink-500',
            inquiry: 'border-blue-500',
            review: 'border-yellow-500',
            default: 'border-gray-300'
        };
        return colors[type] || colors.default;
    }

    getBadgeColor(priority) {
        const colors = {
            높음: 'bg-red-100 text-red-700',
            중간: 'bg-yellow-100 text-yellow-700',
            낮음: 'bg-green-100 text-green-700',
            default: 'bg-gray-100 text-gray-700'
        };
        return colors[priority] || colors.default;
    }

    formatTime(timestamp) {
        if (!timestamp) return '';
        
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return '방금 전';
        if (minutes < 60) return `${minutes}분 전`;
        if (hours < 24) return `${hours}시간 전`;
        if (days < 7) return `${days}일 전`;
        return date.toLocaleDateString('ko-KR');
    }
}


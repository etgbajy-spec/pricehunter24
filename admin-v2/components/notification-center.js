/**
 * 알림 센터 컴포넌트
 */

export class NotificationCenter {
    constructor() {
        this.notifications = [];
        this.badgeElement = document.getElementById('notification-badge');
        this.listElement = document.getElementById('notification-list');
        this.dropdownElement = document.getElementById('notification-dropdown');
        this.setupEventListeners();
    }

    setupEventListeners() {
        const btn = document.getElementById('notification-btn');
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDropdown();
            });
        }

        // 외부 클릭 시 닫기
        document.addEventListener('click', (e) => {
            if (this.dropdownElement && !this.dropdownElement.contains(e.target) && 
                !btn.contains(e.target)) {
                this.hideDropdown();
            }
        });
    }

    addNotification(notification) {
        this.notifications.unshift({
            ...notification,
            id: Date.now().toString(),
            read: false,
            timestamp: new Date()
        });

        // 최대 50개까지만 유지
        if (this.notifications.length > 50) {
            this.notifications = this.notifications.slice(0, 50);
        }

        this.updateBadge();
        this.render();
    }

    markAsRead(id) {
        const notification = this.notifications.find(n => n.id === id);
        if (notification) {
            notification.read = true;
            this.updateBadge();
            this.render();
        }
    }

    markAllAsRead() {
        this.notifications.forEach(n => n.read = true);
        this.updateBadge();
        this.render();
    }

    updateBadge() {
        if (!this.badgeElement) return;

        const unreadCount = this.notifications.filter(n => !n.read).length;
        if (unreadCount > 0) {
            this.badgeElement.textContent = unreadCount > 99 ? '99+' : unreadCount;
            this.badgeElement.classList.remove('hidden');
        } else {
            this.badgeElement.classList.add('hidden');
        }
    }

    render() {
        if (!this.listElement) return;

        if (this.notifications.length === 0) {
            this.listElement.innerHTML = `
                <div class="p-8 text-center text-gray-500">
                    알림이 없습니다.
                </div>
            `;
            return;
        }

        this.listElement.innerHTML = `
            <div class="p-2 border-b border-gray-200 flex items-center justify-between">
                <span class="text-sm font-medium text-gray-700">알림 ${this.notifications.length}개</span>
                <button 
                    onclick="window.adminApp.notificationCenter.markAllAsRead()"
                    class="text-xs text-pink-500 hover:text-pink-600"
                >
                    모두 읽음
                </button>
            </div>
            ${this.notifications.map(notif => `
                <div 
                    class="p-4 hover:bg-gray-50 cursor-pointer ${!notif.read ? 'bg-blue-50' : ''}"
                    onclick="window.adminApp.handleNotificationClick('${notif.id}', '${notif.type}', '${notif.targetId}')"
                >
                    <div class="flex items-start space-x-3">
                        <div class="text-2xl">${notif.icon || '🔔'}</div>
                        <div class="flex-1">
                            <p class="font-medium text-gray-800 text-sm">${notif.title}</p>
                            <p class="text-xs text-gray-600 mt-1">${notif.message}</p>
                            <p class="text-xs text-gray-400 mt-1">${this.formatTime(notif.timestamp)}</p>
                        </div>
                        ${!notif.read ? '<div class="w-2 h-2 bg-blue-500 rounded-full"></div>' : ''}
                    </div>
                </div>
            `).join('')}
        `;
    }

    toggleDropdown() {
        if (!this.dropdownElement) return;
        
        if (this.dropdownElement.classList.contains('hidden')) {
            this.showDropdown();
        } else {
            this.hideDropdown();
        }
    }

    showDropdown() {
        if (!this.dropdownElement) return;
        this.dropdownElement.classList.remove('hidden');
        this.render();
    }

    hideDropdown() {
        if (!this.dropdownElement) return;
        this.dropdownElement.classList.add('hidden');
    }

    formatTime(date) {
        if (!date) return '';
        
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


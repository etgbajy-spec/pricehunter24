/**
 * 데이터 테이블 컴포넌트
 */

export class DataTable {
    constructor(containerId, config) {
        this.container = document.getElementById(containerId);
        this.config = config;
        this.selectedItems = new Set();
    }

    render(items) {
        if (!this.container) return;

        if (items.length === 0) {
            this.container.innerHTML = `
                <div class="p-8 text-center text-gray-500">
                    데이터가 없습니다.
                </div>
            `;
            return;
        }

        this.container.innerHTML = items.map(item => {
            const row = this.config.renderRow(item);
            return `
                <div class="item-row p-4 bg-white rounded-lg border border-gray-200 hover:border-pink-300 hover:shadow-md transition-all cursor-pointer mb-2"
                     data-id="${item.id}"
                     onclick="window.adminApp.handleItemClick('${this.config.type}', '${item.id}')">
                    ${row}
                </div>
            `;
        }).join('');
    }

    getSelectedItems() {
        return Array.from(this.selectedItems);
    }

    clearSelection() {
        this.selectedItems.clear();
    }
}


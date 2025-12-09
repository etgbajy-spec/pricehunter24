/**
 * 필터 바 컴포넌트
 */

export class FilterBar {
    constructor(containerId, config) {
        this.container = document.getElementById(containerId);
        this.config = config;
        this.filters = {};
        this.savedFilters = this.loadSavedFilters();
    }

    render() {
        if (!this.container) return;

        const filterHTML = this.config.fields.map(field => {
            if (field.type === 'select') {
                return `
                    <select 
                        id="filter-${field.name}"
                        class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500"
                        onchange="window.adminApp.applyFilter('${this.config.type}')"
                    >
                        <option value="">${field.label} 전체</option>
                        ${field.options.map(opt => `
                            <option value="${opt.value}">${opt.label}</option>
                        `).join('')}
                    </select>
                `;
            } else if (field.type === 'input') {
                return `
                    <input 
                        type="text"
                        id="filter-${field.name}"
                        placeholder="${field.label}"
                        class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500"
                        onkeyup="window.adminApp.applyFilter('${this.config.type}')"
                    >
                `;
            }
        }).join('');

        const savedFiltersHTML = this.savedFilters.length > 0 ? `
            <div class="flex items-center space-x-2">
                <span class="text-sm text-gray-600">저장된 필터:</span>
                ${this.savedFilters.map((filter, index) => `
                    <button 
                        onclick="window.adminApp.loadSavedFilter('${this.config.type}', ${index})"
                        class="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
                    >
                        ${filter.name}
                    </button>
                `).join('')}
            </div>
        ` : '';

        this.container.innerHTML = `
            <div class="flex items-center space-x-2 flex-wrap">
                ${filterHTML}
                <button 
                    onclick="window.adminApp.clearFilter('${this.config.type}')"
                    class="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
                >
                    초기화
                </button>
            </div>
            ${savedFiltersHTML}
        `;
    }

    getFilters() {
        const filters = {};
        this.config.fields.forEach(field => {
            const element = document.getElementById(`filter-${field.name}`);
            if (element && element.value) {
                filters[field.name] = element.value;
            }
        });
        return filters;
    }

    saveFilter(name) {
        const filters = this.getFilters();
        this.savedFilters.push({ name, filters });
        this.saveSavedFilters();
        return true;
    }

    loadSavedFilter(index) {
        if (this.savedFilters[index]) {
            const saved = this.savedFilters[index];
            this.config.fields.forEach(field => {
                const element = document.getElementById(`filter-${field.name}`);
                if (element && saved.filters[field.name]) {
                    element.value = saved.filters[field.name];
                }
            });
            return saved.filters;
        }
        return {};
    }

    clearFilters() {
        this.config.fields.forEach(field => {
            const element = document.getElementById(`filter-${field.name}`);
            if (element) {
                element.value = '';
            }
        });
    }

    loadSavedFilters() {
        const key = `saved_filters_${this.config.type}`;
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : [];
    }

    saveSavedFilters() {
        const key = `saved_filters_${this.config.type}`;
        localStorage.setItem(key, JSON.stringify(this.savedFilters));
    }
}


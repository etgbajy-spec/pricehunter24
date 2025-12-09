/**
 * PriceHunter Admin v2 메인 애플리케이션
 */

import { firebaseWrapper } from './utils/firebase-wrapper.js';
import { requestsService } from './services/requests-service.js';
import { inquiriesService } from './services/inquiries-service.js';
import { usersService } from './services/users-service.js';
import { reviewsService } from './services/reviews-service.js';
import { visitorsService } from './services/visitors-service.js';
import { TodoList } from './components/todo-list.js';
import { DataTable } from './components/data-table.js';
import { DetailPanel } from './components/detail-panel.js';
import { FilterBar } from './components/filter-bar.js';
import { NotificationCenter } from './components/notification-center.js';

// FilterBar를 전역에서도 사용할 수 있도록
window.FilterBar = FilterBar;

class AdminApp {
    constructor() {
        this.currentUser = null;
        this.currentSection = 'dashboard';
        this.currentFilters = {};
        
        // 컴포넌트 초기화
        this.todoList = new TodoList('todo-list');
        this.detailPanel = new DetailPanel('detail-panel');
        this.notificationCenter = new NotificationCenter();
        
        // 데이터 캐시
        this.dataCache = {
            requests: [],
            inquiries: [],
            users: [],
            reviews: [],
            visits: []
        };
        
        // 방문자 리포트 차트
        this.visitorChart = null;
        this.currentVisitorPeriod = 'daily';
    }

    async init() {
        console.log('🚀 Admin v2 초기화 시작...');
        
        // Firebase 초기화
        await firebaseWrapper.init();
        
        // 인증 상태 확인
        firebaseWrapper.onAuthStateChanged((user) => {
            if (user) {
                this.currentUser = user;
                this.showDashboard();
                this.startSubscriptions();
            } else {
                this.showLogin();
            }
        });

        // 이벤트 리스너 설정
        this.setupEventListeners();
        
        console.log('✅ Admin v2 초기화 완료');
    }

    setupEventListeners() {
        // 로그인 폼
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleLogin();
            });
        }

        // 로그아웃 버튼
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.handleLogout();
            });
        }

        // 섹션 전환
        document.querySelectorAll('.section-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const section = e.target.dataset.section;
                this.switchSection(section);
            });
        });

        // 상세 패널 닫기
        const closeBtn = document.getElementById('close-detail-panel');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.detailPanel.hide();
            });
        }

        // 전역 검색
        const globalSearch = document.getElementById('global-search');
        if (globalSearch) {
            globalSearch.addEventListener('input', (e) => {
                this.handleGlobalSearch(e.target.value);
            });
        }

        // 필터 저장 버튼
        document.getElementById('save-filter-requests')?.addEventListener('click', () => {
            this.saveFilter('requests');
        });
        document.getElementById('save-filter-inquiries')?.addEventListener('click', () => {
            this.saveFilter('inquiries');
        });
    }

    async handleLogin() {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const errorDiv = document.getElementById('login-error');

        try {
            await firebaseWrapper.signIn(email, password);
            // onAuthStateChanged에서 자동으로 처리됨
        } catch (error) {
            console.error('로그인 실패:', error);
            if (errorDiv) {
                errorDiv.textContent = '로그인에 실패했습니다. 이메일과 비밀번호를 확인해주세요.';
                errorDiv.classList.remove('hidden');
            }
        }
    }

    async handleLogout() {
        await firebaseWrapper.signOut();
        this.showLogin();
    }

    showLogin() {
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('dashboard').classList.add('hidden');
    }

    showDashboard() {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('dashboard').classList.remove('hidden');
        
        const userEmail = this.currentUser?.email || '';
        const emailElement = document.getElementById('current-user-email');
        if (emailElement) {
            emailElement.textContent = userEmail;
        }
    }

    startSubscriptions() {
        // 의뢰 구독
        requestsService.subscribe((requests) => {
            this.dataCache.requests = requests;
            this.updateDashboard();
            this.renderRequestsList();
        });

        // 문의 구독
        inquiriesService.subscribe((inquiries) => {
            this.dataCache.inquiries = inquiries;
            this.updateDashboard();
            this.renderInquiriesList();
        });

        // 회원 구독
        usersService.subscribe((users) => {
            this.dataCache.users = users;
            this.renderUsersList();
        });

        // 후기 구독
        reviewsService.subscribe((reviews) => {
            this.dataCache.reviews = reviews;
            this.updateDashboard();
            this.renderReviewsList();
        });
    }

    async updateDashboard() {
        // 통계 업데이트
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const newRequests = this.dataCache.requests.filter(req => {
            const createdAt = req.createdAt?.toDate ? req.createdAt.toDate() : new Date(req.createdAt);
            return createdAt >= today;
        }).length;

        const unansweredInquiries = this.dataCache.inquiries.filter(inq => !inq.answered).length;
        const pendingReviews = this.dataCache.reviews.filter(rev => !rev.approved && !rev.rejected).length;
        const todayCompleted = this.dataCache.requests.filter(req => {
            const updatedAt = req.updatedAt?.toDate ? req.updatedAt.toDate() : new Date(req.updatedAt || 0);
            return updatedAt >= today && req.status === '완료';
        }).length;

        document.getElementById('stat-new-requests').textContent = newRequests;
        document.getElementById('stat-unanswered-inquiries').textContent = unansweredInquiries;
        document.getElementById('stat-pending-reviews').textContent = pendingReviews;
        document.getElementById('stat-today-completed').textContent = todayCompleted;

        // 할 일 리스트 생성
        const todos = [];
        
        // 신규 의뢰
        this.dataCache.requests
            .filter(req => {
                const createdAt = req.createdAt?.toDate ? req.createdAt.toDate() : new Date(req.createdAt);
                return createdAt >= today && req.status === '대기';
            })
            .slice(0, 5)
            .forEach(req => {
                todos.push({
                    id: req.id,
                    type: 'request',
                    icon: '📝',
                    title: `신규 의뢰: ${req.productName || '상품명 없음'}`,
                    description: `${req.email || req.userEmail || '이메일 없음'}`,
                    priority: '높음',
                    createdAt: req.createdAt
                });
            });

        // 미답변 문의
        this.dataCache.inquiries
            .filter(inq => !inq.answered)
            .slice(0, 5)
            .forEach(inq => {
                todos.push({
                    id: inq.id,
                    type: 'inquiry',
                    icon: '💬',
                    title: `미답변 문의: ${inq.title || '제목 없음'}`,
                    description: `${inq.userEmail || inq.email || '이메일 없음'}`,
                    priority: '중간',
                    createdAt: inq.createdAt
                });
            });

        // 승인 대기 후기
        this.dataCache.reviews
            .filter(rev => !rev.approved && !rev.rejected)
            .slice(0, 5)
            .forEach(rev => {
                todos.push({
                    id: rev.id,
                    type: 'review',
                    icon: '⭐',
                    title: `승인 대기 후기`,
                    description: `평점: ${rev.rating || 0}점`,
                    priority: '낮음',
                    createdAt: rev.createdAt
                });
            });

        // 정렬 (생성일 최신순)
        todos.sort((a, b) => {
            const aTime = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
            const bTime = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
            return bTime - aTime;
        });

        this.todoList.render(todos.slice(0, 10));
    }

    switchSection(section) {
        // 모든 섹션 숨기기
        document.querySelectorAll('.section-content').forEach(el => {
            el.classList.add('hidden');
        });

        // 활성 섹션 표시
        const sectionElement = document.getElementById(`section-${section}`);
        if (sectionElement) {
            sectionElement.classList.remove('hidden');
        }

        // 버튼 활성화 상태 업데이트
        document.querySelectorAll('.section-btn').forEach(btn => {
            btn.classList.remove('active-section', 'bg-pink-100', 'text-pink-700');
        });

        const activeBtn = document.querySelector(`[data-section="${section}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active-section', 'bg-pink-100', 'text-pink-700');
        }

        this.currentSection = section;

        // 섹션별 필터 바 초기화
        this.initFilterBars(section);

        // 섹션별 데이터 렌더링
        switch(section) {
            case 'requests':
                this.renderRequestsList();
                break;
            case 'inquiries':
                this.renderInquiriesList();
                break;
            case 'users':
                this.renderUsersList();
                break;
            case 'reviews':
                this.renderReviewsList();
                break;
        }
    }

    initFilterBars(section) {
        switch(section) {
            case 'requests':
                if (!this.requestsFilterBar) {
                    this.requestsFilterBar = new FilterBar('filter-bar-requests', {
                        type: 'requests',
                        fields: [
                            {
                                name: 'status',
                                label: '상태',
                                type: 'select',
                                options: [
                                    { value: '대기', label: '대기' },
                                    { value: '진행중', label: '진행중' },
                                    { value: '완료', label: '완료' },
                                    { value: '취소', label: '취소' }
                                ]
                            },
                            {
                                name: 'email',
                                label: '이메일',
                                type: 'input'
                            }
                        ]
                    });
                }
                this.requestsFilterBar.render();
                break;
            case 'inquiries':
                if (!this.inquiriesFilterBar) {
                    this.inquiriesFilterBar = new FilterBar('filter-bar-inquiries', {
                        type: 'inquiries',
                        fields: [
                            {
                                name: 'status',
                                label: '상태',
                                type: 'select',
                                options: [
                                    { value: 'answered', label: '답변 완료' },
                                    { value: 'unanswered', label: '답변 대기' }
                                ]
                            }
                        ]
                    });
                }
                this.inquiriesFilterBar.render();
                break;
            case 'reviews':
                if (!this.reviewsFilterBar) {
                    this.reviewsFilterBar = new FilterBar('filter-bar-reviews', {
                        type: 'reviews',
                        fields: [
                            {
                                name: 'approved',
                                label: '승인 상태',
                                type: 'select',
                                options: [
                                    { value: 'true', label: '승인됨' },
                                    { value: 'false', label: '대기중' }
                                ]
                            }
                        ]
                    });
                }
                this.reviewsFilterBar.render();
                break;
        }
    }

    applyFilter(section) {
        let filters = {};
        
        switch(section) {
            case 'requests':
                if (this.requestsFilterBar) {
                    filters = this.requestsFilterBar.getFilters();
                }
                break;
            case 'inquiries':
                if (this.inquiriesFilterBar) {
                    filters = this.inquiriesFilterBar.getFilters();
                }
                break;
            case 'reviews':
                if (this.reviewsFilterBar) {
                    filters = this.reviewsFilterBar.getFilters();
                }
                break;
        }

        this.currentFilters[section] = filters;
        
        // 리스트 다시 렌더링
        switch(section) {
            case 'requests':
                this.renderRequestsList();
                break;
            case 'inquiries':
                this.renderInquiriesList();
                break;
            case 'reviews':
                this.renderReviewsList();
                break;
        }
    }

    clearFilter(section) {
        switch(section) {
            case 'requests':
                if (this.requestsFilterBar) {
                    this.requestsFilterBar.clearFilters();
                }
                break;
            case 'inquiries':
                if (this.inquiriesFilterBar) {
                    this.inquiriesFilterBar.clearFilters();
                }
                break;
            case 'reviews':
                if (this.reviewsFilterBar) {
                    this.reviewsFilterBar.clearFilters();
                }
                break;
        }

        this.currentFilters[section] = {};
        this.applyFilter(section);
    }

    saveFilter(section) {
        const name = prompt('필터 이름을 입력하세요:');
        if (!name) return;

        let filterBar = null;
        switch(section) {
            case 'requests':
                filterBar = this.requestsFilterBar;
                break;
            case 'inquiries':
                filterBar = this.inquiriesFilterBar;
                break;
            case 'reviews':
                filterBar = this.reviewsFilterBar;
                break;
        }

        if (filterBar) {
            filterBar.saveFilter(name);
            filterBar.render();
            alert('필터가 저장되었습니다.');
        }
    }

    loadSavedFilter(section, index) {
        let filterBar = null;
        switch(section) {
            case 'requests':
                filterBar = this.requestsFilterBar;
                break;
            case 'inquiries':
                filterBar = this.inquiriesFilterBar;
                break;
            case 'reviews':
                filterBar = this.reviewsFilterBar;
                break;
        }

        if (filterBar) {
            const filters = filterBar.loadSavedFilter(index);
            this.currentFilters[section] = filters;
            this.applyFilter(section);
        }
    }

    renderRequestsList() {
        const container = document.getElementById('requests-list');
        if (!container) return;

        let requests = this.dataCache.requests;

        // 필터 적용
        if (this.currentFilters.requests) {
            const filters = this.currentFilters.requests;
            if (filters.status) {
                requests = requests.filter(r => r.status === filters.status);
            }
            if (filters.email) {
                requests = requests.filter(r => 
                    (r.email && r.email.includes(filters.email)) ||
                    (r.userEmail && r.userEmail.includes(filters.email))
                );
            }
        }

        if (requests.length === 0) {
            container.innerHTML = '<div class="p-8 text-center text-gray-500">의뢰가 없습니다.</div>';
            return;
        }

        container.innerHTML = requests.map(req => {
            const createdAt = req.createdAt?.toDate ? req.createdAt.toDate() : new Date(req.createdAt);
            return `
                <div class="p-4 bg-white rounded-lg border border-gray-200 hover:border-pink-300 hover:shadow-md transition-all cursor-pointer mb-2"
                     onclick="window.adminApp.handleItemClick('request', '${req.id}')">
                    <div class="flex items-center justify-between">
                        <div class="flex-1">
                            <div class="flex items-center space-x-2 mb-1">
                                <span class="font-semibold text-gray-800">${req.productName || '상품명 없음'}</span>
                                <span class="px-2 py-0.5 text-xs rounded ${this.getStatusColor(req.status)}">
                                    ${req.status || '대기'}
                                </span>
                            </div>
                            <p class="text-sm text-gray-600">${req.email || req.userEmail || '이메일 없음'}</p>
                            <p class="text-xs text-gray-500">${createdAt.toLocaleString('ko-KR')}</p>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderInquiriesList() {
        const container = document.getElementById('inquiries-list');
        if (!container) return;

        let inquiries = this.dataCache.inquiries;

        // 필터 적용
        if (this.currentFilters.inquiries) {
            const filters = this.currentFilters.inquiries;
            if (filters.status) {
                inquiries = inquiries.filter(i => 
                    (filters.status === 'answered' && i.answered) ||
                    (filters.status === 'unanswered' && !i.answered)
                );
            }
        }

        if (inquiries.length === 0) {
            container.innerHTML = '<div class="p-8 text-center text-gray-500">문의가 없습니다.</div>';
            return;
        }

        container.innerHTML = inquiries.map(inq => {
            const createdAt = inq.createdAt?.toDate ? inq.createdAt.toDate() : new Date(inq.createdAt);
            return `
                <div class="p-4 bg-white rounded-lg border border-gray-200 hover:border-pink-300 hover:shadow-md transition-all cursor-pointer mb-2"
                     onclick="window.adminApp.handleItemClick('inquiry', '${inq.id}')">
                    <div class="flex items-center justify-between">
                        <div class="flex-1">
                            <div class="flex items-center space-x-2 mb-1">
                                <span class="font-semibold text-gray-800">${inq.title || '제목 없음'}</span>
                                <span class="px-2 py-0.5 text-xs rounded ${inq.answered ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}">
                                    ${inq.answered ? '답변 완료' : '답변 대기'}
                                </span>
                            </div>
                            <p class="text-sm text-gray-600">${inq.userEmail || inq.email || '이메일 없음'}</p>
                            <p class="text-xs text-gray-500">${createdAt.toLocaleString('ko-KR')}</p>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderUsersList() {
        const container = document.getElementById('users-list');
        if (!container) return;

        const users = this.dataCache.users;

        if (users.length === 0) {
            container.innerHTML = '<div class="p-8 text-center text-gray-500">회원이 없습니다.</div>';
            return;
        }

        container.innerHTML = users.map(user => {
            const createdAt = user.createdAt?.toDate ? user.createdAt.toDate() : new Date(user.createdAt);
            return `
                <div class="p-4 bg-white rounded-lg border border-gray-200 hover:border-pink-300 hover:shadow-md transition-all cursor-pointer mb-2"
                     onclick="window.adminApp.handleItemClick('user', '${user.id}')">
                    <div class="flex items-center justify-between">
                        <div class="flex-1">
                            <div class="flex items-center space-x-2 mb-1">
                                <span class="font-semibold text-gray-800">${user.name || user.email || '이름 없음'}</span>
                            </div>
                            <p class="text-sm text-gray-600">${user.email || '이메일 없음'}</p>
                            <p class="text-xs text-gray-500">${createdAt.toLocaleString('ko-KR')}</p>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderReviewsList() {
        const container = document.getElementById('reviews-list');
        if (!container) return;

        let reviews = this.dataCache.reviews;

        // 필터 적용
        if (this.currentFilters.reviews) {
            const filters = this.currentFilters.reviews;
            if (filters.approved !== undefined) {
                reviews = reviews.filter(r => r.approved === (filters.approved === 'true'));
            }
        }

        if (reviews.length === 0) {
            container.innerHTML = '<div class="p-8 text-center text-gray-500">후기가 없습니다.</div>';
            return;
        }

        container.innerHTML = reviews.map(rev => {
            const createdAt = rev.createdAt?.toDate ? rev.createdAt.toDate() : new Date(rev.createdAt);
            return `
                <div class="p-4 bg-white rounded-lg border border-gray-200 hover:border-pink-300 hover:shadow-md transition-all cursor-pointer mb-2"
                     onclick="window.adminApp.handleItemClick('review', '${rev.id}')">
                    <div class="flex items-center justify-between">
                        <div class="flex-1">
                            <div class="flex items-center space-x-2 mb-1">
                                <span class="font-semibold text-gray-800">평점: ${'⭐'.repeat(rev.rating || 0)}</span>
                                <span class="px-2 py-0.5 text-xs rounded ${rev.approved ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}">
                                    ${rev.approved ? '승인됨' : '대기중'}
                                </span>
                            </div>
                            <p class="text-sm text-gray-600 line-clamp-2">${rev.content || '내용 없음'}</p>
                            <p class="text-xs text-gray-500">${createdAt.toLocaleString('ko-KR')}</p>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    async handleItemClick(type, id) {
        let item = null;
        let title = '';

        switch(type) {
            case 'request':
                item = await requestsService.getRequestById(id);
                title = '의뢰 상세';
                if (item) {
                    this.detailPanel.show(title, this.detailPanel.renderRequestDetail(item));
                }
                break;
            case 'inquiry':
                item = await inquiriesService.getInquiryById(id);
                title = '문의 상세';
                if (item) {
                    this.detailPanel.show(title, this.detailPanel.renderInquiryDetail(item));
                }
                break;
            case 'user':
                item = await usersService.getUserById(id);
                title = '회원 상세';
                if (item) {
                    this.detailPanel.show(title, this.detailPanel.renderUserDetail(item));
                }
                break;
            case 'review':
                item = await reviewsService.getReviewById(id);
                title = '후기 상세';
                if (item) {
                    this.detailPanel.show(title, this.detailPanel.renderReviewDetail(item));
                }
                break;
        }
    }

    handleTodoClick(type, id) {
        this.switchSection(type === 'request' ? 'requests' : type === 'inquiry' ? 'inquiries' : 'reviews');
        setTimeout(() => {
            this.handleItemClick(type, id);
        }, 100);
    }

    async addMemo(type, id) {
        const input = document.getElementById(`memo-input-${id}`);
        if (!input || !input.value.trim()) return;

        const memo = input.value.trim();
        const author = this.currentUser?.email || '관리자';

        try {
            switch(type) {
                case 'request':
                    await requestsService.addInternalMemo(id, memo, author);
                    break;
                case 'inquiry':
                    await inquiriesService.addInternalMemo(id, memo, author);
                    break;
                case 'user':
                    await usersService.addInternalMemo(id, memo, author);
                    break;
                case 'review':
                    await reviewsService.addInternalMemo(id, memo, author);
                    break;
            }
            input.value = '';
            
            // 상세 정보 다시 로드
            this.handleItemClick(type, id);
        } catch (error) {
            console.error('메모 추가 실패:', error);
            alert('메모 추가에 실패했습니다.');
        }
    }

    async approveReview(id) {
        const author = this.currentUser?.email || '관리자';
        try {
            await reviewsService.approveReview(id, author);
            this.handleItemClick('review', id);
            this.notificationCenter.addNotification({
                icon: '✅',
                title: '후기 승인',
                message: '후기가 승인되었습니다.',
                type: 'review',
                targetId: id
            });
        } catch (error) {
            console.error('후기 승인 실패:', error);
            alert('후기 승인에 실패했습니다.');
        }
    }

    async rejectReview(id) {
        const reason = prompt('거부 사유를 입력하세요:');
        if (!reason) return;

        const author = this.currentUser?.email || '관리자';
        try {
            await reviewsService.rejectReview(id, reason, author);
            this.handleItemClick('review', id);
            this.notificationCenter.addNotification({
                icon: '❌',
                title: '후기 거부',
                message: '후기가 거부되었습니다.',
                type: 'review',
                targetId: id
            });
        } catch (error) {
            console.error('후기 거부 실패:', error);
            alert('후기 거부에 실패했습니다.');
        }
    }

    async saveRequestResponse(requestId) {
        const formData = {
            lowestPrice: document.getElementById(`response-lowest-price-${requestId}`)?.value.trim() || '',
            seller: document.getElementById(`response-seller-${requestId}`)?.value.trim() || '',
            sellerLink: document.getElementById(`response-seller-link-${requestId}`)?.value.trim() || '',
            shippingCost: document.getElementById(`response-shipping-cost-${requestId}`)?.value.trim() || '',
            shippingTime: document.getElementById(`response-shipping-time-${requestId}`)?.value.trim() || '',
            totalCost: document.getElementById(`response-total-cost-${requestId}`)?.value.trim() || '',
            additionalInfo: document.getElementById(`response-additional-info-${requestId}`)?.value.trim() || ''
        };

        if (!formData.lowestPrice && !formData.seller && !formData.additionalInfo) {
            alert('최소한 하나의 정보는 입력해주세요.');
            return;
        }

        try {
            await firebaseWrapper.init();
            const docRef = firebaseWrapper.doc('requests', requestId);
            await firebaseWrapper.updateDoc(docRef, {
                adminResponse: formData,
                responseDate: firebaseWrapper.serverTimestamp(),
                status: '답변완료',
                updatedAt: firebaseWrapper.serverTimestamp()
            });

            await requestsService.addHistory(requestId, '답변 완료', '관리자가 답변을 작성했습니다.', this.currentUser?.email || '관리자');

            alert('답변이 성공적으로 저장되었습니다.');
            
            // 상세 정보 다시 로드
            this.handleItemClick('request', requestId);
            
            // 알림 추가
            this.notificationCenter.addNotification({
                icon: '✅',
                title: '의뢰 답변 완료',
                message: '의뢰에 답변을 등록했습니다.',
                type: 'request',
                targetId: requestId
            });
        } catch (error) {
            console.error('답변 저장 실패:', error);
            alert('답변 저장에 실패했습니다.');
        }
    }

    clearResponseForm(requestId) {
        document.getElementById(`response-lowest-price-${requestId}`).value = '';
        document.getElementById(`response-seller-${requestId}`).value = '';
        document.getElementById(`response-seller-link-${requestId}`).value = '';
        document.getElementById(`response-shipping-cost-${requestId}`).value = '';
        document.getElementById(`response-shipping-time-${requestId}`).value = '';
        document.getElementById(`response-total-cost-${requestId}`).value = '';
        document.getElementById(`response-additional-info-${requestId}`).value = '';
    }

    openImageModal(imageSrc) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4';
        modal.innerHTML = `
            <div class="relative max-w-4xl max-h-full">
                <img 
                    src="${imageSrc}" 
                    alt="확대된 이미지" 
                    class="max-w-full max-h-full object-contain rounded-lg"
                >
                <button 
                    onclick="this.parentElement.parentElement.remove()" 
                    class="absolute top-4 right-4 text-white text-3xl font-bold hover:text-gray-300 transition-colors"
                >
                    &times;
                </button>
            </div>
        `;
        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';
        
        // 배경 클릭 시 닫기
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
                document.body.style.overflow = 'auto';
            }
        });
        
        // ESC 키로 닫기
        const closeOnEscape = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.body.style.overflow = 'auto';
                document.removeEventListener('keydown', closeOnEscape);
            }
        };
        document.addEventListener('keydown', closeOnEscape);
    }

    async addAnswer(inquiryId) {
        const input = document.getElementById(`answer-input-${inquiryId}`);
        if (!input || !input.value.trim()) return;

        const answer = input.value.trim();
        const author = this.currentUser?.email || '관리자';

        try {
            await inquiriesService.addAnswer(inquiryId, answer, author);
            input.value = '';
            
            // 상세 정보 다시 로드
            this.handleItemClick('inquiry', inquiryId);
            
            // 알림 추가
            this.notificationCenter.addNotification({
                icon: '✅',
                title: '답변 완료',
                message: '문의에 답변을 등록했습니다.',
                type: 'inquiry',
                targetId: inquiryId
            });
        } catch (error) {
            console.error('답변 추가 실패:', error);
            alert('답변 등록에 실패했습니다.');
        }
    }

    async updateStatus(type, id, status) {
        const author = this.currentUser?.email || '관리자';

        try {
            switch(type) {
                case 'request':
                    await requestsService.updateStatus(id, status, '');
                    await requestsService.addHistory(id, '상태 변경', `상태: ${status}`, author);
                    break;
            }
            
            // 상세 정보 다시 로드
            this.handleItemClick(type, id);
        } catch (error) {
            console.error('상태 변경 실패:', error);
            alert('상태 변경에 실패했습니다.');
        }
    }

    async handleGlobalSearch(keyword) {
        if (!keyword.trim()) {
            // 검색어가 없으면 현재 섹션의 필터 초기화
            this.currentFilters[this.currentSection] = {};
            this.switchSection(this.currentSection);
            return;
        }

        // 전역 검색 - 모든 도메인에서 검색
        const lowerKeyword = keyword.toLowerCase();
        const results = [];

        // 의뢰 검색
        const requests = this.dataCache.requests.filter(req => 
            req.email?.toLowerCase().includes(lowerKeyword) ||
            req.userEmail?.toLowerCase().includes(lowerKeyword) ||
            req.productName?.toLowerCase().includes(lowerKeyword) ||
            req.id?.toLowerCase().includes(lowerKeyword)
        );
        results.push(...requests.map(r => ({ type: 'request', item: r })));

        // 문의 검색
        const inquiries = this.dataCache.inquiries.filter(inq => 
            inq.userEmail?.toLowerCase().includes(lowerKeyword) ||
            inq.email?.toLowerCase().includes(lowerKeyword) ||
            inq.title?.toLowerCase().includes(lowerKeyword) ||
            inq.content?.toLowerCase().includes(lowerKeyword) ||
            inq.id?.toLowerCase().includes(lowerKeyword)
        );
        results.push(...inquiries.map(i => ({ type: 'inquiry', item: i })));

        // 회원 검색
        const users = this.dataCache.users.filter(user => 
            user.email?.toLowerCase().includes(lowerKeyword) ||
            user.name?.toLowerCase().includes(lowerKeyword) ||
            user.id?.toLowerCase().includes(lowerKeyword)
        );
        results.push(...users.map(u => ({ type: 'user', item: u })));

        // 후기 검색
        const reviews = this.dataCache.reviews.filter(rev => 
            rev.userEmail?.toLowerCase().includes(lowerKeyword) ||
            rev.content?.toLowerCase().includes(lowerKeyword) ||
            rev.id?.toLowerCase().includes(lowerKeyword)
        );
        results.push(...reviews.map(r => ({ type: 'review', item: r })));

        // 검색 결과가 있으면 첫 번째 결과로 이동
        if (results.length > 0) {
            const firstResult = results[0];
            const sectionMap = {
                'request': 'requests',
                'inquiry': 'inquiries',
                'user': 'users',
                'review': 'reviews'
            };
            const section = sectionMap[firstResult.type];
            if (section) {
                this.switchSection(section);
                setTimeout(() => {
                    this.handleItemClick(firstResult.type, firstResult.item.id);
                }, 100);
            }
        }
    }

    handleNotificationClick(notificationId, type, targetId) {
        this.notificationCenter.markAsRead(notificationId);
        this.notificationCenter.hideDropdown();
        
        // 해당 항목으로 이동
        if (type === 'request') {
            this.switchSection('requests');
            setTimeout(() => this.handleItemClick('request', targetId), 100);
        } else if (type === 'inquiry') {
            this.switchSection('inquiries');
            setTimeout(() => this.handleItemClick('inquiry', targetId), 100);
        }
    }

    getStatusColor(status) {
        const colors = {
            '대기': 'bg-gray-100 text-gray-700',
            '진행중': 'bg-blue-100 text-blue-700',
            '완료': 'bg-green-100 text-green-700',
            '취소': 'bg-red-100 text-red-700'
        };
        return colors[status] || colors['대기'];
    }
}

// 전역 인스턴스 생성 및 초기화
window.adminApp = new AdminApp();
window.adminApp.init();


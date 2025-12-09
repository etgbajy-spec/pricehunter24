/**
 * 상세 패널 컴포넌트
 */

export class DetailPanel {
    constructor(panelId) {
        this.panel = document.getElementById(panelId);
        this.titleElement = document.getElementById('detail-panel-title');
        this.contentElement = document.getElementById('detail-panel-content');
    }

    show(title, content) {
        if (!this.panel || !this.titleElement || !this.contentElement) return;

        this.titleElement.textContent = title;
        this.contentElement.innerHTML = content;
        this.panel.classList.remove('hidden');
        this.panel.classList.add('slide-in');
    }

    hide() {
        if (!this.panel) return;
        this.panel.classList.add('hidden');
        this.panel.classList.remove('slide-in');
    }

    renderUserDetail(user) {
        const createdAt = user.createdAt?.toDate ? user.createdAt.toDate() : new Date(user.createdAt);
        const updatedAt = user.updatedAt?.toDate ? user.updatedAt.toDate() : new Date(user.updatedAt || Date.now());

        return `
            <div class="space-y-6">
                <!-- 기본 정보 -->
                <div class="bg-white rounded-lg p-6 shadow-sm">
                    <h4 class="font-semibold text-gray-800 mb-4">기본 정보</h4>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="text-sm text-gray-500">회원 ID</label>
                            <p class="font-medium">${user.id}</p>
                        </div>
                        <div>
                            <label class="text-sm text-gray-500">이름</label>
                            <p class="font-medium">${user.name || '-'}</p>
                        </div>
                        <div>
                            <label class="text-sm text-gray-500">이메일</label>
                            <p class="font-medium">${user.email || '-'}</p>
                        </div>
                        <div>
                            <label class="text-sm text-gray-500">생성일</label>
                            <p class="font-medium">${createdAt.toLocaleString('ko-KR')}</p>
                        </div>
                    </div>
                </div>

                <!-- 내부 메모 -->
                <div class="bg-white rounded-lg p-6 shadow-sm">
                    <h4 class="font-semibold text-gray-800 mb-4">내부 메모</h4>
                    <div id="internal-memos-${user.id}" class="space-y-2 mb-4">
                        ${this.renderMemos(user.internalMemos || [])}
                    </div>
                    <div class="flex space-x-2">
                        <input 
                            type="text" 
                            id="memo-input-${user.id}"
                            placeholder="메모를 입력하세요..."
                            class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                        >
                        <button 
                            onclick="window.adminApp.addMemo('user', '${user.id}')"
                            class="px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600"
                        >
                            추가
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    renderReviewDetail(review) {
        const createdAt = review.createdAt?.toDate ? review.createdAt.toDate() : new Date(review.createdAt);
        const approvedAt = review.approvedAt?.toDate ? review.approvedAt.toDate() : null;

        return `
            <div class="space-y-6">
                <!-- 기본 정보 -->
                <div class="bg-white rounded-lg p-6 shadow-sm">
                    <h4 class="font-semibold text-gray-800 mb-4">기본 정보</h4>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="text-sm text-gray-500">후기 ID</label>
                            <p class="font-medium">${review.id}</p>
                        </div>
                        <div>
                            <label class="text-sm text-gray-500">평점</label>
                            <p class="font-medium">${'⭐'.repeat(review.rating || 0)}</p>
                        </div>
                        <div>
                            <label class="text-sm text-gray-500">상태</label>
                            <p class="font-medium">
                                <span class="px-2 py-1 rounded text-sm ${review.approved ? 'bg-green-100 text-green-700' : review.rejected ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}">
                                    ${review.approved ? '승인됨' : review.rejected ? '거부됨' : '대기중'}
                                </span>
                            </p>
                        </div>
                        <div>
                            <label class="text-sm text-gray-500">생성일</label>
                            <p class="font-medium">${createdAt.toLocaleString('ko-KR')}</p>
                        </div>
                    </div>
                </div>

                <!-- 후기 내용 -->
                <div class="bg-white rounded-lg p-6 shadow-sm">
                    <h4 class="font-semibold text-gray-800 mb-4">후기 내용</h4>
                    <p class="text-gray-700 whitespace-pre-wrap">${review.content || '-'}</p>
                </div>

                <!-- 승인/거부 액션 -->
                ${!review.approved && !review.rejected ? `
                <div class="bg-white rounded-lg p-6 shadow-sm">
                    <h4 class="font-semibold text-gray-800 mb-4">승인/거부</h4>
                    <div class="flex space-x-2">
                        <button 
                            onclick="window.adminApp.approveReview('${review.id}')"
                            class="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                        >
                            승인
                        </button>
                        <button 
                            onclick="window.adminApp.rejectReview('${review.id}')"
                            class="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                        >
                            거부
                        </button>
                    </div>
                </div>
                ` : ''}

                <!-- 내부 메모 -->
                <div class="bg-white rounded-lg p-6 shadow-sm">
                    <h4 class="font-semibold text-gray-800 mb-4">내부 메모</h4>
                    <div id="internal-memos-${review.id}" class="space-y-2 mb-4">
                        ${this.renderMemos(review.internalMemos || [])}
                    </div>
                    <div class="flex space-x-2">
                        <input 
                            type="text" 
                            id="memo-input-${review.id}"
                            placeholder="메모를 입력하세요..."
                            class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                        >
                        <button 
                            onclick="window.adminApp.addMemo('review', '${review.id}')"
                            class="px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600"
                        >
                            추가
                        </button>
                    </div>
                </div>

                <!-- 이력 타임라인 -->
                <div class="bg-white rounded-lg p-6 shadow-sm">
                    <h4 class="font-semibold text-gray-800 mb-4">이력</h4>
                    <div class="space-y-4">
                        ${this.renderHistory(review.history || [])}
                    </div>
                </div>
            </div>
        `;
    }

    renderRequestDetail(request) {
        const createdAt = request.createdAt?.toDate ? request.createdAt.toDate() : new Date(request.createdAt);
        const updatedAt = request.updatedAt?.toDate ? request.updatedAt.toDate() : new Date(request.updatedAt || Date.now());

        return `
            <div class="space-y-6">
                <!-- 기본 정보 -->
                <div class="bg-white rounded-lg p-6 shadow-sm">
                    <h4 class="font-semibold text-gray-800 mb-4">기본 정보</h4>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="text-sm text-gray-500">의뢰 ID</label>
                            <p class="font-medium">${request.id}</p>
                        </div>
                        <div>
                            <label class="text-sm text-gray-500">상태</label>
                            <p class="font-medium">
                                <span class="px-2 py-1 rounded text-sm ${this.getStatusColor(request.status)}">
                                    ${request.status || '대기'}
                                </span>
                            </p>
                        </div>
                        <div>
                            <label class="text-sm text-gray-500">이메일</label>
                            <p class="font-medium">${request.email || request.userEmail || '-'}</p>
                        </div>
                        <div>
                            <label class="text-sm text-gray-500">상품명</label>
                            <p class="font-medium">${request.productName || '-'}</p>
                        </div>
                        <div>
                            <label class="text-sm text-gray-500">생성일</label>
                            <p class="font-medium">${createdAt.toLocaleString('ko-KR')}</p>
                        </div>
                        <div>
                            <label class="text-sm text-gray-500">수정일</label>
                            <p class="font-medium">${updatedAt.toLocaleString('ko-KR')}</p>
                        </div>
                    </div>
                </div>

                <!-- 상세 내용 -->
                ${request.description ? `
                <div class="bg-white rounded-lg p-6 shadow-sm">
                    <h4 class="font-semibold text-gray-800 mb-4">의뢰 내용</h4>
                    <p class="text-gray-700 whitespace-pre-wrap">${request.description}</p>
                </div>
                ` : ''}

                <!-- 내부 메모 -->
                <div class="bg-white rounded-lg p-6 shadow-sm">
                    <h4 class="font-semibold text-gray-800 mb-4">내부 메모</h4>
                    <div id="internal-memos-${request.id}" class="space-y-2 mb-4">
                        ${this.renderMemos(request.internalMemos || [])}
                    </div>
                    <div class="flex space-x-2">
                        <input 
                            type="text" 
                            id="memo-input-${request.id}"
                            placeholder="메모를 입력하세요..."
                            class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                        >
                        <button 
                            onclick="window.adminApp.addMemo('request', '${request.id}')"
                            class="px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600"
                        >
                            추가
                        </button>
                    </div>
                </div>

                <!-- 이력 타임라인 -->
                <div class="bg-white rounded-lg p-6 shadow-sm">
                    <h4 class="font-semibold text-gray-800 mb-4">이력</h4>
                    <div class="space-y-4">
                        ${this.renderHistory(request.history || [])}
                    </div>
                </div>

                <!-- 액션 버튼 -->
                <div class="flex space-x-2">
                    <button 
                        onclick="window.adminApp.updateStatus('request', '${request.id}', '진행중')"
                        class="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                    >
                        진행중으로 변경
                    </button>
                    <button 
                        onclick="window.adminApp.updateStatus('request', '${request.id}', '완료')"
                        class="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                    >
                        완료로 변경
                    </button>
                </div>
            </div>
        `;
    }

    renderInquiryDetail(inquiry) {
        const createdAt = inquiry.createdAt?.toDate ? inquiry.createdAt.toDate() : new Date(inquiry.createdAt);
        const answeredAt = inquiry.answeredAt?.toDate ? inquiry.answeredAt.toDate() : null;

        return `
            <div class="space-y-6">
                <!-- 기본 정보 -->
                <div class="bg-white rounded-lg p-6 shadow-sm">
                    <h4 class="font-semibold text-gray-800 mb-4">기본 정보</h4>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="text-sm text-gray-500">문의 ID</label>
                            <p class="font-medium">${inquiry.id}</p>
                        </div>
                        <div>
                            <label class="text-sm text-gray-500">상태</label>
                            <p class="font-medium">
                                <span class="px-2 py-1 rounded text-sm ${inquiry.answered ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}">
                                    ${inquiry.answered ? '답변 완료' : '답변 대기'}
                                </span>
                            </p>
                        </div>
                        <div>
                            <label class="text-sm text-gray-500">이메일</label>
                            <p class="font-medium">${inquiry.userEmail || inquiry.email || '-'}</p>
                        </div>
                        <div>
                            <label class="text-sm text-gray-500">생성일</label>
                            <p class="font-medium">${createdAt.toLocaleString('ko-KR')}</p>
                        </div>
                    </div>
                </div>

                <!-- 문의 내용 -->
                <div class="bg-white rounded-lg p-6 shadow-sm">
                    <h4 class="font-semibold text-gray-800 mb-4">문의 내용</h4>
                    <p class="text-gray-700 whitespace-pre-wrap">${inquiry.content || inquiry.message || '-'}</p>
                </div>

                <!-- 답변 -->
                ${inquiry.answered ? `
                <div class="bg-white rounded-lg p-6 shadow-sm">
                    <h4 class="font-semibold text-gray-800 mb-4">답변</h4>
                    <p class="text-gray-700 whitespace-pre-wrap">${inquiry.answer || '-'}</p>
                    ${answeredAt ? `<p class="text-sm text-gray-500 mt-2">답변일: ${answeredAt.toLocaleString('ko-KR')}</p>` : ''}
                </div>
                ` : `
                <div class="bg-white rounded-lg p-6 shadow-sm">
                    <h4 class="font-semibold text-gray-800 mb-4">답변 작성</h4>
                    <textarea 
                        id="answer-input-${inquiry.id}"
                        rows="5"
                        class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 mb-4"
                        placeholder="답변을 입력하세요..."
                    ></textarea>
                    <button 
                        onclick="window.adminApp.addAnswer('${inquiry.id}')"
                        class="px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600"
                    >
                        답변 등록
                    </button>
                </div>
                `}

                <!-- 내부 메모 -->
                <div class="bg-white rounded-lg p-6 shadow-sm">
                    <h4 class="font-semibold text-gray-800 mb-4">내부 메모</h4>
                    <div id="internal-memos-${inquiry.id}" class="space-y-2 mb-4">
                        ${this.renderMemos(inquiry.internalMemos || [])}
                    </div>
                    <div class="flex space-x-2">
                        <input 
                            type="text" 
                            id="memo-input-${inquiry.id}"
                            placeholder="메모를 입력하세요..."
                            class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                        >
                        <button 
                            onclick="window.adminApp.addMemo('inquiry', '${inquiry.id}')"
                            class="px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600"
                        >
                            추가
                        </button>
                    </div>
                </div>

                <!-- 이력 타임라인 -->
                <div class="bg-white rounded-lg p-6 shadow-sm">
                    <h4 class="font-semibold text-gray-800 mb-4">이력</h4>
                    <div class="space-y-4">
                        ${this.renderHistory(inquiry.history || [])}
                    </div>
                </div>
            </div>
        `;
    }

    renderMemos(memos) {
        if (!memos || memos.length === 0) {
            return '<p class="text-sm text-gray-500">메모가 없습니다.</p>';
        }

        return memos.map((memo, index) => {
            const date = memo.createdAt?.toDate ? memo.createdAt.toDate() : new Date(memo.createdAt);
            return `
                <div class="p-3 bg-gray-50 rounded-lg">
                    <div class="flex items-start justify-between">
                        <p class="text-sm text-gray-700 flex-1">${memo.memo}</p>
                        <div class="text-xs text-gray-500 ml-2">
                            ${memo.author}<br>
                            ${date.toLocaleString('ko-KR')}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderHistory(history) {
        if (!history || history.length === 0) {
            return '<p class="text-sm text-gray-500">이력이 없습니다.</p>';
        }

        return history.map((item, index) => {
            const date = item.timestamp?.toDate ? item.timestamp.toDate() : new Date(item.timestamp);
            return `
                <div class="flex items-start space-x-3">
                    <div class="flex-shrink-0 w-2 h-2 bg-pink-500 rounded-full mt-2"></div>
                    <div class="flex-1">
                        <div class="flex items-center justify-between">
                            <p class="font-medium text-gray-800">${item.action}</p>
                            <p class="text-xs text-gray-500">${date.toLocaleString('ko-KR')}</p>
                        </div>
                        <p class="text-sm text-gray-600 mt-1">${item.details}</p>
                        ${item.author ? `<p class="text-xs text-gray-500 mt-1">작성자: ${item.author}</p>` : ''}
                    </div>
                </div>
            `;
        }).join('');
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


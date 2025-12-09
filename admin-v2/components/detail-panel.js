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
        const reqDate = request.reqDate ? new Date(request.reqDate) : createdAt;

        return `
            <div class="space-y-6">
                <!-- 기본 정보 -->
                <div class="bg-blue-50 rounded-lg p-6 border-l-4 border-blue-500">
                    <h4 class="font-semibold text-gray-800 mb-4 flex items-center">
                        📝 의뢰 기본 정보
                    </h4>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div><span class="font-semibold text-gray-700">의뢰번호:</span> <span class="text-blue-600">${request.reqNum || request.requestNumber || request.id || '-'}</span></div>
                        <div><span class="font-semibold text-gray-700">의뢰일시:</span> <span class="text-blue-600">${reqDate.toLocaleString('ko-KR')}</span></div>
                        <div><span class="font-semibold text-gray-700">제품명:</span> <span class="text-blue-600">${request.productName || request.name || '-'}</span></div>
                        <div><span class="font-semibold text-gray-700">요청가:</span> <span class="text-blue-600">${this.formatPrice(request.originalPrice || request.price)}</span></div>
                        <div><span class="font-semibold text-gray-700">상태:</span> 
                            <span class="px-2 py-1 rounded-full text-xs font-bold text-white ${this.getStatusBgClass(request.status)}">
                                ${request.status || '대기'}
                            </span>
                        </div>
                        <div><span class="font-semibold text-gray-700">진행률:</span> <span class="text-blue-600">${request.progress || '0%'}</span></div>
                    </div>
                </div>

                <!-- 제품 상세 정보 -->
                <div class="bg-green-50 rounded-lg p-6 border-l-4 border-green-500">
                    <h4 class="font-semibold text-gray-800 mb-4 flex items-center">
                        🛍️ 제품 상세 정보
                    </h4>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div><span class="font-semibold text-gray-700">브랜드:</span> <span class="text-green-600">${request.brand || '-'}</span></div>
                        <div><span class="font-semibold text-gray-700">모델명:</span> <span class="text-green-600">${request.model || '-'}</span></div>
                        <div><span class="font-semibold text-gray-700">카테고리:</span> <span class="text-green-600">${request.category || '-'}</span></div>
                        <div><span class="font-semibold text-gray-700">수량:</span> <span class="text-green-600">${request.quantity || '1'}</span></div>
                        <div class="col-span-2"><span class="font-semibold text-gray-700">제품 설명:</span> <span class="text-green-600">${request.description || request.productDescription || '-'}</span></div>
                        <div class="col-span-2"><span class="font-semibold text-gray-700">참고 URL:</span> 
                            <div class="text-green-600 mt-1">
                                ${this.renderUrls(request.urls || [])}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 첨부 이미지 -->
                ${(request.images || request.attachedImages || []).length > 0 ? `
                <div class="bg-white rounded-lg p-6 shadow-sm">
                    <h4 class="font-semibold text-gray-800 mb-4 flex items-center">
                        📸 첨부 이미지
                    </h4>
                    <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                        ${this.renderImages(request.images || request.attachedImages || [])}
                    </div>
                </div>
                ` : ''}

                <!-- 회원 정보 -->
                <div class="bg-yellow-50 rounded-lg p-6 border-l-4 border-yellow-500">
                    <h4 class="font-semibold text-gray-800 mb-4 flex items-center">
                        👤 회원 정보
                    </h4>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div><span class="font-semibold text-gray-700">이름:</span> <span class="text-yellow-600">${request.userName || request.name || '-'}</span></div>
                        <div><span class="font-semibold text-gray-700">이메일:</span> <span class="text-yellow-600">${request.email || request.userEmail || '-'}</span></div>
                        <div><span class="font-semibold text-gray-700">휴대폰:</span> <span class="text-yellow-600">${request.userPhone || request.phone || '-'}</span></div>
                        <div><span class="font-semibold text-gray-700">카카오ID:</span> <span class="text-yellow-600">${request.userKakao || request.kakao || '-'}</span></div>
                    </div>
                </div>

                <!-- 추가 요청사항 -->
                ${request.specialRequest || request.additionalRequest ? `
                <div class="bg-purple-50 rounded-lg p-6 border-l-4 border-purple-500">
                    <h4 class="font-semibold text-gray-800 mb-4 flex items-center">
                        💬 추가 요청사항
                    </h4>
                    <div class="text-sm">
                        <span class="font-semibold text-gray-700">특별 요청:</span> <span class="text-purple-600">${request.specialRequest || request.additionalRequest || '-'}</span>
                    </div>
                </div>
                ` : ''}

                <!-- 관리자 답변 작성 -->
                <div class="bg-indigo-50 rounded-lg p-6 border-l-4 border-indigo-500">
                    <h4 class="font-semibold text-gray-800 mb-4 flex items-center">
                        💬 관리자 답변 작성
                    </h4>
                    <form id="admin-response-form-${request.id}" class="space-y-4" onsubmit="event.preventDefault(); window.adminApp.saveRequestResponse('${request.id}')">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">💰 찾은 최저가</label>
                                <input type="text" id="response-lowest-price-${request.id}" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="예: 15,000원" value="${request.adminResponse?.lowestPrice || ''}">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">🏪 판매업체</label>
                                <input type="text" id="response-seller-${request.id}" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="예: 쿠팡, 네이버쇼핑" value="${request.adminResponse?.seller || ''}">
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">🔗 판매 링크</label>
                            <input type="url" id="response-seller-link-${request.id}" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="https://..." value="${request.adminResponse?.sellerLink || ''}">
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">🚚 배송비</label>
                                <input type="text" id="response-shipping-cost-${request.id}" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="예: 2,500원 (무료배송)" value="${request.adminResponse?.shippingCost || ''}">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">⏰ 배송기간</label>
                                <input type="text" id="response-shipping-time-${request.id}" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="예: 1-2일" value="${request.adminResponse?.shippingTime || ''}">
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">💳 총 구매비용</label>
                            <input type="text" id="response-total-cost-${request.id}" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="예: 17,500원" value="${request.adminResponse?.totalCost || ''}">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">📝 추가 정보 및 추천사유</label>
                            <textarea id="response-additional-info-${request.id}" rows="3" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="추가로 알려드릴 정보나 추천 사유를 입력해주세요...">${request.adminResponse?.additionalInfo || ''}</textarea>
                        </div>
                        <div class="flex gap-3">
                            <button type="submit" class="px-6 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 font-medium">
                                답변 저장
                            </button>
                            <button type="button" onclick="window.adminApp.clearResponseForm('${request.id}')" class="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-medium">
                                내용 지우기
                            </button>
                        </div>
                    </form>
                </div>

                <!-- 관리자 답변 (있는 경우) -->
                ${request.adminResponse || request.response ? `
                <div class="bg-gray-50 rounded-lg p-6 border-l-4 border-gray-500">
                    <h4 class="font-semibold text-gray-800 mb-4 flex items-center">
                        💼 관리자 답변
                    </h4>
                    <div class="text-sm">
                        <div class="mb-2"><span class="font-semibold text-gray-700">답변일시:</span> <span class="text-gray-600">${request.responseDate ? new Date(request.responseDate).toLocaleString('ko-KR') : updatedAt.toLocaleString('ko-KR')}</span></div>
                        <div>${this.formatResponseForDisplay(request.adminResponse || request.response)}</div>
                    </div>
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
        const inquiryDate = inquiry.date ? new Date(inquiry.date) : createdAt;

        return `
            <div class="space-y-6">
                <!-- 기본 정보 -->
                <div class="bg-blue-50 rounded-lg p-6 border-l-4 border-blue-500">
                    <h4 class="font-semibold text-gray-800 mb-4 flex items-center">
                        💬 문의 기본 정보
                    </h4>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div><span class="font-semibold text-gray-700">문의 ID:</span> <span class="text-blue-600">${inquiry.id || '-'}</span></div>
                        <div><span class="font-semibold text-gray-700">문의일시:</span> <span class="text-blue-600">${inquiryDate.toLocaleString('ko-KR')}</span></div>
                        <div><span class="font-semibold text-gray-700">제목:</span> <span class="text-blue-600">${inquiry.subject || inquiry.title || '-'}</span></div>
                        <div><span class="font-semibold text-gray-700">상태:</span> 
                            <span class="px-2 py-1 rounded-full text-xs font-bold text-white ${inquiry.answered || inquiry.status === '답변완료' ? 'bg-green-500' : 'bg-yellow-500'}">
                                ${inquiry.answered || inquiry.status === '답변완료' ? '답변 완료' : '답변 대기'}
                            </span>
                        </div>
                    </div>
                </div>

                <!-- 문의 내용 -->
                <div class="bg-white rounded-lg p-6 shadow-sm">
                    <h4 class="font-semibold text-gray-800 mb-4">문의 내용</h4>
                    <p class="text-gray-700 whitespace-pre-wrap">${inquiry.content || inquiry.message || '-'}</p>
                </div>

                <!-- 첨부 파일 -->
                ${inquiry.file ? `
                <div class="bg-white rounded-lg p-6 shadow-sm">
                    <h4 class="font-semibold text-gray-800 mb-4">첨부 파일</h4>
                    <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                        ${this.renderInquiryAttachments(inquiry.file)}
                    </div>
                </div>
                ` : ''}

                <!-- 회원 정보 -->
                <div class="bg-yellow-50 rounded-lg p-6 border-l-4 border-yellow-500">
                    <h4 class="font-semibold text-gray-800 mb-4 flex items-center">
                        👤 회원 정보
                    </h4>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div><span class="font-semibold text-gray-700">이름:</span> <span class="text-yellow-600">${inquiry.name || inquiry.userName || '-'}</span></div>
                        <div><span class="font-semibold text-gray-700">이메일:</span> <span class="text-yellow-600">${inquiry.email || inquiry.userEmail || '-'}</span></div>
                        <div><span class="font-semibold text-gray-700">휴대폰:</span> <span class="text-yellow-600">${inquiry.phone || inquiry.userPhone || '-'}</span></div>
                        <div><span class="font-semibold text-gray-700">카카오ID:</span> <span class="text-yellow-600">${inquiry.kakao || inquiry.userKakao || '-'}</span></div>
                    </div>
                </div>

                <!-- 답변 -->
                ${inquiry.answered || inquiry.status === '답변완료' ? `
                <div class="bg-green-50 rounded-lg p-6 border-l-4 border-green-500">
                    <h4 class="font-semibold text-gray-800 mb-4">답변</h4>
                    <div class="text-gray-700 whitespace-pre-wrap">${inquiry.answer || inquiry.adminResponse || '-'}</div>
                    ${answeredAt ? `<p class="text-sm text-gray-500 mt-2">답변일: ${answeredAt.toLocaleString('ko-KR')}</p>` : ''}
                </div>
                ` : `
                <div class="bg-indigo-50 rounded-lg p-6 border-l-4 border-indigo-500">
                    <h4 class="font-semibold text-gray-800 mb-4">답변 작성</h4>
                    <textarea 
                        id="answer-input-${inquiry.id}"
                        rows="5"
                        class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 mb-4"
                        placeholder="답변을 입력하세요..."
                    ></textarea>
                    <button 
                        onclick="window.adminApp.addAnswer('${inquiry.id}')"
                        class="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600"
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

    renderInquiryAttachments(file) {
        if (!file) return '';
        
        if (typeof file === 'string' && file.startsWith('data:image/')) {
            return `
                <div class="relative group cursor-pointer">
                    <div class="bg-white rounded-lg border-2 border-orange-200 p-3 hover:border-orange-400 transition-all shadow-sm hover:shadow-md">
                        <div class="aspect-square rounded-lg overflow-hidden bg-gray-100 mb-2">
                            <img 
                                src="${file}" 
                                alt="첨부 이미지" 
                                class="w-full h-full object-cover hover:scale-105 transition-transform"
                                onclick="window.adminApp.openImageModal('${file}')"
                            >
                        </div>
                        <div class="text-center">
                            <p class="text-xs font-medium text-gray-700">첨부 이미지</p>
                            <p class="text-xs text-gray-500 mt-1">클릭하여 확대</p>
                        </div>
                    </div>
                </div>
            `;
        }
        
        if (Array.isArray(file)) {
            return file.map((fileData, index) => {
                if (fileData && fileData.startsWith('data:image/')) {
                    return `
                        <div class="relative group cursor-pointer">
                            <div class="bg-white rounded-lg border-2 border-orange-200 p-3 hover:border-orange-400 transition-all shadow-sm hover:shadow-md">
                                <div class="aspect-square rounded-lg overflow-hidden bg-gray-100 mb-2">
                                    <img 
                                        src="${fileData}" 
                                        alt="첨부 이미지 ${index + 1}" 
                                        class="w-full h-full object-cover hover:scale-105 transition-transform"
                                        onclick="window.adminApp.openImageModal('${fileData}')"
                                    >
                                </div>
                                <div class="text-center">
                                    <p class="text-xs font-medium text-gray-700">첨부 이미지 ${index + 1}</p>
                                    <p class="text-xs text-gray-500 mt-1">클릭하여 확대</p>
                                </div>
                            </div>
                        </div>
                    `;
                }
                return '';
            }).join('');
        }
        
        return '';
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

    getStatusBgClass(status) {
        switch(status) {
            case '답변완료': return 'bg-green-500';
            case '완료': return 'bg-green-500';
            case '처리중': return 'bg-yellow-500';
            case '대기': return 'bg-gray-500';
            case '취소': return 'bg-red-500';
            default: return 'bg-blue-500';
        }
    }

    formatPrice(price) {
        if (!price) return '-';
        if (typeof price === 'number') {
            return price.toLocaleString('ko-KR') + '원';
        }
        if (typeof price === 'string') {
            return price.includes('원') ? price : price + '원';
        }
        return price;
    }

    renderUrls(urls) {
        if (!urls || urls.length === 0) return '-';
        if (typeof urls === 'string') {
            return `<a href="${urls}" target="_blank" class="text-blue-600 hover:underline break-all">${urls}</a>`;
        }
        return urls.map(url => 
            `<a href="${url}" target="_blank" class="text-blue-600 hover:underline break-all block">${url}</a>`
        ).join('');
    }

    renderImages(images) {
        if (!images || images.length === 0) return '';
        return images.map((image, index) => {
            const imageSrc = typeof image === 'string' ? image : (image.url || image);
            const imageName = typeof image === 'object' && image.name ? image.name : `이미지 ${index + 1}`;
            return `
                <div class="relative group cursor-pointer">
                    <img 
                        src="${imageSrc}" 
                        alt="${imageName}" 
                        class="w-full h-48 object-cover rounded-lg shadow-md hover:shadow-lg transition-shadow"
                        onclick="window.adminApp.openImageModal('${imageSrc}')"
                    >
                    <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded-lg flex items-center justify-center">
                        <span class="text-white opacity-0 group-hover:opacity-100 transition-opacity text-sm font-semibold">클릭하여 확대</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    formatResponseForDisplay(response) {
        if (!response) return '-';
        if (typeof response === 'string') return response;
        
        let html = '<div class="space-y-4">';
        
        if (response.lowestPrice) {
            html += `
                <div class="flex items-center p-3 bg-green-50 rounded-lg border-l-4 border-green-500">
                    <span class="text-2xl mr-3">💰</span>
                    <div>
                        <div class="font-semibold text-green-800">찾은 최저가</div>
                        <div class="text-green-600 text-lg font-bold">${response.lowestPrice}</div>
                    </div>
                </div>
            `;
        }
        
        if (response.seller) {
            html += `
                <div class="flex items-center p-3 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                    <span class="text-2xl mr-3">🏪</span>
                    <div>
                        <div class="font-semibold text-blue-800">판매업체</div>
                        <div class="text-blue-600">${response.seller}</div>
                    </div>
                </div>
            `;
        }
        
        if (response.sellerLink) {
            html += `
                <div class="flex items-center p-3 bg-purple-50 rounded-lg border-l-4 border-purple-500">
                    <span class="text-2xl mr-3">🔗</span>
                    <div>
                        <div class="font-semibold text-purple-800">판매 링크</div>
                        <a href="${response.sellerLink}" target="_blank" class="text-purple-600 hover:underline break-all">${response.sellerLink}</a>
                    </div>
                </div>
            `;
        }
        
        if (response.shippingCost || response.shippingTime) {
            html += `
                <div class="flex items-center p-3 bg-orange-50 rounded-lg border-l-4 border-orange-500">
                    <span class="text-2xl mr-3">🚚</span>
                    <div>
                        <div class="font-semibold text-orange-800">배송 정보</div>
                        <div class="text-orange-600">
                            ${response.shippingCost ? `배송비: ${response.shippingCost}` : ''}
                            ${response.shippingTime ? `배송기간: ${response.shippingTime}` : ''}
                        </div>
                    </div>
                </div>
            `;
        }
        
        if (response.totalCost) {
            html += `
                <div class="flex items-center p-3 bg-red-50 rounded-lg border-l-4 border-red-500">
                    <span class="text-2xl mr-3">💳</span>
                    <div>
                        <div class="font-semibold text-red-800">총 구매비용</div>
                        <div class="text-red-600 text-lg font-bold">${response.totalCost}</div>
                    </div>
                </div>
            `;
        }
        
        if (response.additionalInfo) {
            html += `
                <div class="p-3 bg-gray-50 rounded-lg border-l-4 border-gray-500">
                    <div class="font-semibold text-gray-800 mb-2">📝 추가 정보 및 추천사유</div>
                    <div class="text-gray-600 whitespace-pre-wrap">${response.additionalInfo}</div>
                </div>
            `;
        }
        
        html += '</div>';
        return html;
    }
}


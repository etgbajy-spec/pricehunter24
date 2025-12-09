/**
 * 의뢰(Requests) 도메인 서비스
 * 의뢰 관련 비즈니스 로직 처리
 */

import { firebaseWrapper } from '../utils/firebase-wrapper.js';

class RequestsService {
    constructor() {
        this.unsubscribe = null;
        this.listeners = [];
    }

    async init() {
        await firebaseWrapper.init();
    }

    // 실시간 구독 시작
    subscribe(callback) {
        if (this.unsubscribe) {
            this.unsubscribe();
        }

        const requestsRef = firebaseWrapper.collection('requests');
        const q = firebaseWrapper.query(
            requestsRef,
            firebaseWrapper.orderBy('createdAt', 'desc')
        );

        this.unsubscribe = firebaseWrapper.onSnapshot(
            q,
            (snapshot) => {
                const requests = [];
                snapshot.forEach((doc) => {
                    requests.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });
                callback(requests);
            },
            (error) => {
                console.error('의뢰 구독 오류:', error);
                callback([]);
            }
        );

        return this.unsubscribe;
    }

    // 의뢰 목록 가져오기 (필터 적용)
    async getRequests(filters = {}) {
        await this.init();
        
        const requestsRef = firebaseWrapper.collection('requests');
        let q = firebaseWrapper.query(requestsRef);

        // 필터 적용
        if (filters.status) {
            q = firebaseWrapper.query(q, firebaseWrapper.where('status', '==', filters.status));
        }
        if (filters.email) {
            q = firebaseWrapper.query(q, firebaseWrapper.where('email', '==', filters.email));
        }
        if (filters.userEmail) {
            q = firebaseWrapper.query(q, firebaseWrapper.where('userEmail', '==', filters.userEmail));
        }

        // 정렬
        q = firebaseWrapper.query(q, firebaseWrapper.orderBy('createdAt', 'desc'));

        // limit
        if (filters.limit) {
            q = firebaseWrapper.query(q, firebaseWrapper.limit(filters.limit));
        }

        const snapshot = await firebaseWrapper.getDocs(q);
        const requests = [];
        snapshot.forEach((doc) => {
            requests.push({
                id: doc.id,
                ...doc.data()
            });
        });

        return requests;
    }

    // 의뢰 상세 가져오기
    async getRequestById(id) {
        await this.init();
        
        const docRef = firebaseWrapper.doc('requests', id);
        const docSnap = await firebaseWrapper.getDoc(docRef);
        
        if (docSnap.exists()) {
            return {
                id: docSnap.id,
                ...docSnap.data()
            };
        }
        return null;
    }

    // 의뢰 상태 변경
    async updateStatus(id, status, memo = '') {
        await this.init();
        
        const docRef = firebaseWrapper.doc('requests', id);
        const updateData = {
            status,
            updatedAt: firebaseWrapper.serverTimestamp()
        };

        if (memo) {
            updateData.adminMemo = memo;
        }

        await firebaseWrapper.updateDoc(docRef, updateData);
        return true;
    }

    // 의뢰 업데이트
    async updateRequest(id, data) {
        await this.init();
        
        const docRef = firebaseWrapper.doc('requests', id);
        await firebaseWrapper.updateDoc(docRef, {
            ...data,
            updatedAt: firebaseWrapper.serverTimestamp()
        });
        return true;
    }

    // 내부 메모 추가
    async addInternalMemo(id, memo, author) {
        await this.init();
        
        const docRef = firebaseWrapper.doc('requests', id);
        const docSnap = await firebaseWrapper.getDoc(docRef);
        
        if (!docSnap.exists()) {
            throw new Error('의뢰를 찾을 수 없습니다.');
        }

        const currentData = docSnap.data();
        const memos = currentData.internalMemos || [];
        
        memos.push({
            memo,
            author,
            createdAt: firebaseWrapper.serverTimestamp()
        });

        await firebaseWrapper.updateDoc(docRef, {
            internalMemos: memos,
            updatedAt: firebaseWrapper.serverTimestamp()
        });

        return true;
    }

    // 이력 추가
    async addHistory(id, action, details, author) {
        await this.init();
        
        const docRef = firebaseWrapper.doc('requests', id);
        const docSnap = await firebaseWrapper.getDoc(docRef);
        
        if (!docSnap.exists()) {
            throw new Error('의뢰를 찾을 수 없습니다.');
        }

        const currentData = docSnap.data();
        const history = currentData.history || [];
        
        history.push({
            action,
            details,
            author,
            timestamp: firebaseWrapper.serverTimestamp()
        });

        await firebaseWrapper.updateDoc(docRef, {
            history,
            updatedAt: firebaseWrapper.serverTimestamp()
        });

        return true;
    }

    // 오늘 신규 의뢰 수
    async getTodayNewRequestsCount() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const requests = await this.getRequests();
        return requests.filter(req => {
            const createdAt = req.createdAt?.toDate ? req.createdAt.toDate() : new Date(req.createdAt);
            return createdAt >= today;
        }).length;
    }

    // 검색
    async searchRequests(keyword) {
        const requests = await this.getRequests();
        const lowerKeyword = keyword.toLowerCase();
        
        return requests.filter(req => {
            return (
                req.email?.toLowerCase().includes(lowerKeyword) ||
                req.userEmail?.toLowerCase().includes(lowerKeyword) ||
                req.productName?.toLowerCase().includes(lowerKeyword) ||
                req.id?.toLowerCase().includes(lowerKeyword) ||
                req.status?.toLowerCase().includes(lowerKeyword)
            );
        });
    }

    // 구독 해제
    unsubscribe() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }
}

export const requestsService = new RequestsService();


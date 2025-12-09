/**
 * 문의(Inquiries) 도메인 서비스
 */

import { firebaseWrapper } from '../utils/firebase-wrapper.js';

class InquiriesService {
    constructor() {
        this.unsubscribe = null;
    }

    async init() {
        await firebaseWrapper.init();
    }

    // 실시간 구독
    subscribe(callback) {
        if (this.unsubscribe) {
            this.unsubscribe();
        }

        const inquiriesRef = firebaseWrapper.collection('inquiries');
        const q = firebaseWrapper.query(
            inquiriesRef,
            firebaseWrapper.orderBy('createdAt', 'desc')
        );

        this.unsubscribe = firebaseWrapper.onSnapshot(
            q,
            (snapshot) => {
                const inquiries = [];
                snapshot.forEach((doc) => {
                    inquiries.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });
                callback(inquiries);
            },
            (error) => {
                console.error('문의 구독 오류:', error);
                callback([]);
            }
        );

        return this.unsubscribe;
    }

    // 문의 목록 가져오기
    async getInquiries(filters = {}) {
        await this.init();
        
        const inquiriesRef = firebaseWrapper.collection('inquiries');
        let q = firebaseWrapper.query(inquiriesRef);

        if (filters.status) {
            q = firebaseWrapper.query(q, firebaseWrapper.where('status', '==', filters.status));
        }
        if (filters.userEmail) {
            q = firebaseWrapper.query(q, firebaseWrapper.where('userEmail', '==', filters.userEmail));
        }
        if (filters.answered === false) {
            q = firebaseWrapper.query(q, firebaseWrapper.where('answered', '==', false));
        }

        q = firebaseWrapper.query(q, firebaseWrapper.orderBy('createdAt', 'desc'));

        if (filters.limit) {
            q = firebaseWrapper.query(q, firebaseWrapper.limit(filters.limit));
        }

        const snapshot = await firebaseWrapper.getDocs(q);
        const inquiries = [];
        snapshot.forEach((doc) => {
            inquiries.push({
                id: doc.id,
                ...doc.data()
            });
        });

        return inquiries;
    }

    // 문의 상세 가져오기
    async getInquiryById(id) {
        await this.init();
        
        const docRef = firebaseWrapper.doc('inquiries', id);
        const docSnap = await firebaseWrapper.getDoc(docRef);
        
        if (docSnap.exists()) {
            return {
                id: docSnap.id,
                ...docSnap.data()
            };
        }
        return null;
    }

    // 답변 추가
    async addAnswer(id, answer, author) {
        await this.init();
        
        const docRef = firebaseWrapper.doc('inquiries', id);
        await firebaseWrapper.updateDoc(docRef, {
            answer,
            answered: true,
            answeredAt: firebaseWrapper.serverTimestamp(),
            answeredBy: author,
            updatedAt: firebaseWrapper.serverTimestamp()
        });

        // 이력 추가
        await this.addHistory(id, '답변 완료', `답변자: ${author}`, author);

        return true;
    }

    // 내부 메모 추가
    async addInternalMemo(id, memo, author) {
        await this.init();
        
        const docRef = firebaseWrapper.doc('inquiries', id);
        const docSnap = await firebaseWrapper.getDoc(docRef);
        
        if (!docSnap.exists()) {
            throw new Error('문의를 찾을 수 없습니다.');
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
        
        const docRef = firebaseWrapper.doc('inquiries', id);
        const docSnap = await firebaseWrapper.getDoc(docRef);
        
        if (!docSnap.exists()) {
            throw new Error('문의를 찾을 수 없습니다.');
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

    // 미답변 문의 수
    async getUnansweredCount() {
        const inquiries = await this.getInquiries({ answered: false });
        return inquiries.length;
    }

    // 검색
    async searchInquiries(keyword) {
        const inquiries = await this.getInquiries();
        const lowerKeyword = keyword.toLowerCase();
        
        return inquiries.filter(inq => {
            return (
                inq.userEmail?.toLowerCase().includes(lowerKeyword) ||
                inq.email?.toLowerCase().includes(lowerKeyword) ||
                inq.title?.toLowerCase().includes(lowerKeyword) ||
                inq.content?.toLowerCase().includes(lowerKeyword) ||
                inq.id?.toLowerCase().includes(lowerKeyword)
            );
        });
    }

    unsubscribe() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }
}

export const inquiriesService = new InquiriesService();


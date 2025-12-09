/**
 * 후기(Reviews) 도메인 서비스
 */

import { firebaseWrapper } from '../utils/firebase-wrapper.js';

class ReviewsService {
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

        const reviewsRef = firebaseWrapper.collection('reviews');
        const q = firebaseWrapper.query(
            reviewsRef,
            firebaseWrapper.orderBy('createdAt', 'desc')
        );

        this.unsubscribe = firebaseWrapper.onSnapshot(
            q,
            (snapshot) => {
                const reviews = [];
                snapshot.forEach((doc) => {
                    reviews.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });
                callback(reviews);
            },
            (error) => {
                console.error('후기 구독 오류:', error);
                callback([]);
            }
        );

        return this.unsubscribe;
    }

    // 후기 목록 가져오기
    async getReviews(filters = {}) {
        await this.init();
        
        const reviewsRef = firebaseWrapper.collection('reviews');
        let q = firebaseWrapper.query(reviewsRef);

        if (filters.status) {
            q = firebaseWrapper.query(q, firebaseWrapper.where('status', '==', filters.status));
        }
        if (filters.approved !== undefined) {
            q = firebaseWrapper.query(q, firebaseWrapper.where('approved', '==', filters.approved));
        }
        if (filters.rating) {
            q = firebaseWrapper.query(q, firebaseWrapper.where('rating', '<=', filters.rating));
        }

        q = firebaseWrapper.query(q, firebaseWrapper.orderBy('createdAt', 'desc'));

        if (filters.limit) {
            q = firebaseWrapper.query(q, firebaseWrapper.limit(filters.limit));
        }

        const snapshot = await firebaseWrapper.getDocs(q);
        const reviews = [];
        snapshot.forEach((doc) => {
            reviews.push({
                id: doc.id,
                ...doc.data()
            });
        });

        return reviews;
    }

    // 후기 상세 가져오기
    async getReviewById(id) {
        await this.init();
        
        const docRef = firebaseWrapper.doc('reviews', id);
        const docSnap = await firebaseWrapper.getDoc(docRef);
        
        if (docSnap.exists()) {
            return {
                id: docSnap.id,
                ...docSnap.data()
            };
        }
        return null;
    }

    // 후기 승인
    async approveReview(id, author) {
        await this.init();
        
        const docRef = firebaseWrapper.doc('reviews', id);
        await firebaseWrapper.updateDoc(docRef, {
            approved: true,
            approvedAt: firebaseWrapper.serverTimestamp(),
            approvedBy: author,
            updatedAt: firebaseWrapper.serverTimestamp()
        });

        await this.addHistory(id, '승인 완료', `승인자: ${author}`, author);

        return true;
    }

    // 후기 거부
    async rejectReview(id, reason, author) {
        await this.init();
        
        const docRef = firebaseWrapper.doc('reviews', id);
        await firebaseWrapper.updateDoc(docRef, {
            approved: false,
            rejected: true,
            rejectReason: reason,
            rejectedAt: firebaseWrapper.serverTimestamp(),
            rejectedBy: author,
            updatedAt: firebaseWrapper.serverTimestamp()
        });

        await this.addHistory(id, '거부', `사유: ${reason}`, author);

        return true;
    }

    // 내부 메모 추가
    async addInternalMemo(id, memo, author) {
        await this.init();
        
        const docRef = firebaseWrapper.doc('reviews', id);
        const docSnap = await firebaseWrapper.getDoc(docRef);
        
        if (!docSnap.exists()) {
            throw new Error('후기를 찾을 수 없습니다.');
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
        
        const docRef = firebaseWrapper.doc('reviews', id);
        const docSnap = await firebaseWrapper.getDoc(docRef);
        
        if (!docSnap.exists()) {
            throw new Error('후기를 찾을 수 없습니다.');
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

    // 승인 대기 후기 수
    async getPendingCount() {
        const reviews = await this.getReviews({ approved: false });
        return reviews.filter(r => !r.rejected).length;
    }

    // 검색
    async searchReviews(keyword) {
        const reviews = await this.getReviews();
        const lowerKeyword = keyword.toLowerCase();
        
        return reviews.filter(review => {
            return (
                review.userEmail?.toLowerCase().includes(lowerKeyword) ||
                review.content?.toLowerCase().includes(lowerKeyword) ||
                review.id?.toLowerCase().includes(lowerKeyword)
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

export const reviewsService = new ReviewsService();


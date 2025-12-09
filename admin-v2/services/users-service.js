/**
 * 회원(Users) 도메인 서비스
 */

import { firebaseWrapper } from '../utils/firebase-wrapper.js';

class UsersService {
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

        const usersRef = firebaseWrapper.collection('users');
        const q = firebaseWrapper.query(
            usersRef,
            firebaseWrapper.orderBy('createdAt', 'desc')
        );

        this.unsubscribe = firebaseWrapper.onSnapshot(
            q,
            (snapshot) => {
                const users = [];
                snapshot.forEach((doc) => {
                    users.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });
                callback(users);
            },
            (error) => {
                console.error('회원 구독 오류:', error);
                callback([]);
            }
        );

        return this.unsubscribe;
    }

    // 회원 목록 가져오기
    async getUsers(filters = {}) {
        await this.init();
        
        const usersRef = firebaseWrapper.collection('users');
        let q = firebaseWrapper.query(usersRef);

        if (filters.email) {
            q = firebaseWrapper.query(q, firebaseWrapper.where('email', '==', filters.email));
        }

        q = firebaseWrapper.query(q, firebaseWrapper.orderBy('createdAt', 'desc'));

        if (filters.limit) {
            q = firebaseWrapper.query(q, firebaseWrapper.limit(filters.limit));
        }

        const snapshot = await firebaseWrapper.getDocs(q);
        const users = [];
        snapshot.forEach((doc) => {
            users.push({
                id: doc.id,
                ...doc.data()
            });
        });

        return users;
    }

    // 회원 상세 가져오기
    async getUserById(id) {
        await this.init();
        
        const docRef = firebaseWrapper.doc('users', id);
        const docSnap = await firebaseWrapper.getDoc(docRef);
        
        if (docSnap.exists()) {
            return {
                id: docSnap.id,
                ...docSnap.data()
            };
        }
        return null;
    }

    // 회원 업데이트
    async updateUser(id, data) {
        await this.init();
        
        const docRef = firebaseWrapper.doc('users', id);
        await firebaseWrapper.updateDoc(docRef, {
            ...data,
            updatedAt: firebaseWrapper.serverTimestamp()
        });
        return true;
    }

    // 내부 메모 추가
    async addInternalMemo(id, memo, author) {
        await this.init();
        
        const docRef = firebaseWrapper.doc('users', id);
        const docSnap = await firebaseWrapper.getDoc(docRef);
        
        if (!docSnap.exists()) {
            throw new Error('회원을 찾을 수 없습니다.');
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

    // 검색
    async searchUsers(keyword) {
        const users = await this.getUsers();
        const lowerKeyword = keyword.toLowerCase();
        
        return users.filter(user => {
            return (
                user.email?.toLowerCase().includes(lowerKeyword) ||
                user.name?.toLowerCase().includes(lowerKeyword) ||
                user.id?.toLowerCase().includes(lowerKeyword)
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

export const usersService = new UsersService();


/**
 * Firebase 레이어 추상화
 * Admin에서 Firebase를 직접 사용하지 않고 이 래퍼를 통해 접근
 */

class FirebaseWrapper {
    constructor() {
        this.db = null;
        this.auth = null;
        this.ready = false;
        this.initPromise = null;
    }

    async init() {
        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = new Promise((resolve, reject) => {
            const checkFirebase = () => {
                if (window.firebaseDb && window.firebaseAuth) {
                    this.db = window.firebaseDb;
                    this.auth = window.firebaseAuth;
                    this.ready = true;
                    console.log('✅ Firebase Wrapper 초기화 완료');
                    resolve(true);
                } else {
                    setTimeout(checkFirebase, 100);
                }
            };
            checkFirebase();
        });

        return this.initPromise;
    }

    getFirestoreFunctions() {
        return window.firebaseFirestoreFunctions || {};
    }

    getAuthFunctions() {
        return window.firebaseAuthFunctions || {};
    }

    // 컬렉션 참조 가져오기
    collection(name) {
        if (!this.ready) {
            throw new Error('Firebase가 아직 초기화되지 않았습니다.');
        }
        const { collection } = this.getFirestoreFunctions();
        return collection(this.db, name);
    }

    // 문서 참조 가져오기
    doc(collectionName, docId) {
        if (!this.ready) {
            throw new Error('Firebase가 아직 초기화되지 않았습니다.');
        }
        const { doc } = this.getFirestoreFunctions();
        return doc(this.db, collectionName, docId);
    }

    // 쿼리 빌더
    query(...args) {
        const { query } = this.getFirestoreFunctions();
        return query(...args);
    }

    // where 조건
    where(field, operator, value) {
        const { where } = this.getFirestoreFunctions();
        return where(field, operator, value);
    }

    // orderBy
    orderBy(field, direction = 'desc') {
        const { orderBy } = this.getFirestoreFunctions();
        return orderBy(field, direction);
    }

    // limit
    limit(count) {
        const { limit } = this.getFirestoreFunctions();
        return limit(count);
    }

    // serverTimestamp
    serverTimestamp() {
        const { serverTimestamp } = this.getFirestoreFunctions();
        return serverTimestamp();
    }

    // Timestamp
    Timestamp(seconds, nanoseconds) {
        const { Timestamp } = this.getFirestoreFunctions();
        return Timestamp(seconds, nanoseconds);
    }

    // 실시간 구독
    onSnapshot(query, callback, errorCallback) {
        const { onSnapshot } = this.getFirestoreFunctions();
        return onSnapshot(query, callback, errorCallback);
    }

    // 문서 가져오기
    async getDoc(docRef) {
        const { getDoc } = this.getFirestoreFunctions();
        return await getDoc(docRef);
    }

    // 쿼리 결과 가져오기
    async getDocs(query) {
        const { getDocs } = this.getFirestoreFunctions();
        return await getDocs(query);
    }

    // 문서 추가
    async addDoc(collectionRef, data) {
        const { addDoc } = this.getFirestoreFunctions();
        return await addDoc(collectionRef, data);
    }

    // 문서 업데이트
    async updateDoc(docRef, data) {
        const { updateDoc } = this.getFirestoreFunctions();
        return await updateDoc(docRef, data);
    }

    // 문서 삭제
    async deleteDoc(docRef) {
        const { deleteDoc } = this.getFirestoreFunctions();
        return await deleteDoc(docRef);
    }

    // 인증 상태 구독
    onAuthStateChanged(callback) {
        const { onAuthStateChanged } = this.getAuthFunctions();
        return onAuthStateChanged(this.auth, callback);
    }

    // 로그인
    async signIn(email, password) {
        const { signInWithEmailAndPassword } = this.getAuthFunctions();
        return await signInWithEmailAndPassword(this.auth, email, password);
    }

    // 로그아웃
    async signOut() {
        const { signOut } = this.getAuthFunctions();
        return await signOut(this.auth);
    }

    // 현재 사용자
    getCurrentUser() {
        return this.auth?.currentUser;
    }
}

// 싱글톤 인스턴스
export const firebaseWrapper = new FirebaseWrapper();


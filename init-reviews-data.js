// Firebase reviews 컬렉션 초기 데이터 생성 스크립트
// 이 스크립트는 관리자 대시보드에서 실행하여 초기 후기 데이터를 생성합니다

const initialReviewsData = [
    {
        name: "김영희",
        ageGroup: "30대",
        occupation: "디자이너",
        profileImage: "https://images.unsplash.com/photo-1494790108755-2616b612b786?auto=format&fit=crop&w=100&q=80",
        productName: "MacBook Pro 14인치",
        category: "전자제품",
        brand: "Apple",
        originalPrice: "2,890,000원",
        finalPrice: "1,890,000원",
        savings: "1,000,000원",
        savingsPercent: 35,
        rating: 5,
        review: "요청가 289만원 → 189만원으로 구매! 성능도 훌륭하고 정말 만족합니다. PriceHunter 덕분에 100만원이나 절약했어요!",
        purchaseDate: "2024-01-15",
        country: "대한민국",
        shipping: "2일",
        method: "공장 직접구매",
        badge: "최저가 제공완료",
        stars: 5,
        approved: true,
        views: 1250,
        createdAt: new Date("2024-01-15"),
        updatedAt: new Date("2024-01-15")
    },
    {
        name: "이철수",
        ageGroup: "40대",
        occupation: "자영업자",
        profileImage: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80",
        productName: "삼성 갤럭시 S24 Ultra",
        category: "전자제품",
        brand: "Samsung",
        originalPrice: "1,650,000원",
        finalPrice: "1,200,000원",
        savings: "450,000원",
        savingsPercent: 27,
        rating: 5,
        review: "사무용품 대량구매 성공! 요청가 165만원 → 120만원으로 절약! 빠른 배송, 저렴한 가격!",
        purchaseDate: "2024-01-20",
        country: "대한민국",
        shipping: "2일",
        method: "공장 직접구매",
        badge: "사업자 대량구매",
        stars: 5,
        approved: true,
        views: 980,
        createdAt: new Date("2024-01-20"),
        updatedAt: new Date("2024-01-20")
    },
    {
        name: "박민수",
        ageGroup: "20대",
        occupation: "대학생",
        profileImage: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&q=80",
        productName: "iPad Air 5세대",
        category: "전자제품",
        brand: "Apple",
        originalPrice: "899,000원",
        finalPrice: "650,000원",
        savings: "249,000원",
        savingsPercent: 28,
        rating: 5,
        review: "태블릿을 싸게 샀어요! 요청가 89.9만원 → 65만원으로 구매! 학생 할인까지 받아서 굿!",
        purchaseDate: "2024-01-25",
        country: "대한민국",
        shipping: "4일",
        method: "공장 직접구매",
        badge: "최저가 제공완료",
        stars: 4.8,
        approved: true,
        views: 756,
        createdAt: new Date("2024-01-25"),
        updatedAt: new Date("2024-01-25")
    },
    {
        name: "최지은",
        ageGroup: "30대",
        occupation: "주부",
        profileImage: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=100&q=80",
        productName: "다이슨 V15 무선청소기",
        category: "생활용품",
        brand: "Dyson",
        originalPrice: "899,000원",
        finalPrice: "650,000원",
        savings: "249,000원",
        savingsPercent: 28,
        rating: 5,
        review: "가전제품 저렴하게 구입! 요청가 89.9만원 → 65만원으로 절약! 믿고 구매했어요.",
        purchaseDate: "2024-01-28",
        country: "대한민국",
        shipping: "3일",
        method: "도매처 연동",
        badge: "최저가 제공완료",
        stars: 5,
        approved: true,
        views: 892,
        createdAt: new Date("2024-01-28"),
        updatedAt: new Date("2024-01-28")
    },
    {
        name: "정우성",
        ageGroup: "40대",
        occupation: "직장인",
        profileImage: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=100&q=80",
        productName: "로지텍 MX Master 3S",
        category: "전자제품",
        brand: "Logitech",
        originalPrice: "149,000원",
        finalPrice: "89,000원",
        savings: "60,000원",
        savingsPercent: 40,
        rating: 5,
        review: "스마트워치 득템! 요청가 14.9만원 → 8.9만원으로 절약! 기능도 많고 저렴!",
        purchaseDate: "2024-02-01",
        country: "대한민국",
        shipping: "2일",
        method: "공장 직접구매",
        badge: "최저가 제공완료",
        stars: 4.7,
        approved: true,
        views: 634,
        createdAt: new Date("2024-02-01"),
        updatedAt: new Date("2024-02-01")
    },
    {
        name: "한가영",
        ageGroup: "20대",
        occupation: "신혼부부",
        profileImage: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=100&q=80",
        productName: "LG 트롬 세탁기",
        category: "생활용품",
        brand: "LG",
        originalPrice: "1,200,000원",
        finalPrice: "850,000원",
        savings: "350,000원",
        savingsPercent: 29,
        rating: 5,
        review: "신혼가전 싸게 샀어요! 요청가 120만원 → 85만원으로 절약! 배송도 빠르고 만족!",
        purchaseDate: "2024-02-05",
        country: "대한민국",
        shipping: "3일",
        method: "도매처 연동",
        badge: "최저가 제공완료",
        stars: 5,
        approved: true,
        views: 1123,
        createdAt: new Date("2024-02-05"),
        updatedAt: new Date("2024-02-05")
    },
    {
        name: "오준호",
        ageGroup: "30대",
        occupation: "1인가구",
        profileImage: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80",
        productName: "아이폰 15 Pro",
        category: "전자제품",
        brand: "Apple",
        originalPrice: "1,550,000원",
        finalPrice: "1,200,000원",
        savings: "350,000원",
        savingsPercent: 23,
        rating: 5,
        review: "생활용품 저렴하게! 요청가 155만원 → 120만원으로 절약! 혼자 사는데 딱!",
        purchaseDate: "2024-02-10",
        country: "대한민국",
        shipping: "2일",
        method: "공장 직접구매",
        badge: "최저가 제공완료",
        stars: 4.6,
        approved: true,
        views: 1456,
        createdAt: new Date("2024-02-10"),
        updatedAt: new Date("2024-02-10")
    },
    {
        name: "유수진",
        ageGroup: "60대",
        occupation: "부모님 선물",
        profileImage: "https://images.unsplash.com/photo-1494790108755-2616b612b786?auto=format&fit=crop&w=100&q=80",
        productName: "안마의자",
        category: "생활용품",
        brand: "휴테크",
        originalPrice: "2,500,000원",
        finalPrice: "1,800,000원",
        savings: "700,000원",
        savingsPercent: 28,
        rating: 5,
        review: "안마기 싸게 샀어요! 요청가 250만원 → 180만원으로 절약! 부모님이 좋아하셨어요.",
        purchaseDate: "2024-02-15",
        country: "대한민국",
        shipping: "2일",
        method: "공장 직접구매",
        badge: "최저가 제공완료",
        stars: 5,
        approved: true,
        views: 789,
        createdAt: new Date("2024-02-15"),
        updatedAt: new Date("2024-02-15")
    },
    {
        name: "장동건",
        ageGroup: "10대",
        occupation: "학생",
        profileImage: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&q=80",
        productName: "게이밍 노트북",
        category: "전자제품",
        brand: "ASUS",
        originalPrice: "2,200,000원",
        finalPrice: "1,500,000원",
        savings: "700,000원",
        savingsPercent: 32,
        rating: 5,
        review: "학용품, IT기기까지! 요청가 220만원 → 150만원으로 절약! 노트북, 태블릿 다 싸게 샀어요.",
        purchaseDate: "2024-02-20",
        country: "대한민국",
        shipping: "2일",
        method: "공장 직접구매",
        badge: "최저가 제공완료",
        stars: 4.9,
        approved: true,
        views: 1678,
        createdAt: new Date("2024-02-20"),
        updatedAt: new Date("2024-02-20")
    },
    {
        name: "서지훈",
        ageGroup: "30대",
        occupation: "취미러",
        profileImage: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=100&q=80",
        productName: "기타 앰프",
        category: "기타",
        brand: "Marshall",
        originalPrice: "800,000원",
        finalPrice: "550,000원",
        savings: "250,000원",
        savingsPercent: 31,
        rating: 5,
        review: "취미용품 저렴하게! 요청가 80만원 → 55만원으로 절약! 기타, 캠핑용품, 운동기구까지 만족!",
        purchaseDate: "2024-02-25",
        country: "대한민국",
        shipping: "2일",
        method: "공장 직접구매",
        badge: "최저가 제공완료",
        stars: 5,
        approved: true,
        views: 445,
        createdAt: new Date("2024-02-25"),
        updatedAt: new Date("2024-02-25")
    },
    {
        name: "문지현",
        ageGroup: "40대",
        occupation: "직장인",
        profileImage: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=100&q=80",
        productName: "명품 가방",
        category: "의류",
        brand: "Louis Vuitton",
        originalPrice: "3,200,000원",
        finalPrice: "2,100,000원",
        savings: "1,100,000원",
        savingsPercent: 34,
        rating: 5,
        review: "패션/잡화도 OK! 요청가 320만원 → 210만원으로 절약! 가방, 신발, 액세서리 다 싸게 샀어요.",
        purchaseDate: "2024-03-01",
        country: "대한민국",
        shipping: "2일",
        method: "공장 직접구매",
        badge: "최저가 제공완료",
        stars: 4.6,
        approved: true,
        views: 2234,
        createdAt: new Date("2024-03-01"),
        updatedAt: new Date("2024-03-01")
    },
    {
        name: "이하나",
        ageGroup: "30대",
        occupation: "프리랜서",
        profileImage: "https://images.unsplash.com/photo-1494790108755-2616b612b786?auto=format&fit=crop&w=100&q=80",
        productName: "프린터",
        category: "전자제품",
        brand: "HP",
        originalPrice: "450,000원",
        finalPrice: "280,000원",
        savings: "170,000원",
        savingsPercent: 38,
        rating: 5,
        review: "사무용품도 최저가! 요청가 45만원 → 28만원으로 절약! 프린터, 모니터, 의자까지 만족!",
        purchaseDate: "2024-03-05",
        country: "대한민국",
        shipping: "2일",
        method: "공장 직접구매",
        badge: "최저가 제공완료",
        stars: 4.8,
        approved: true,
        views: 567,
        createdAt: new Date("2024-03-05"),
        updatedAt: new Date("2024-03-05")
    }
];

// Firebase에 초기 데이터 추가하는 함수
async function initializeReviewsData() {
    try {
        console.log('🚀 후기 데이터 초기화 시작...');
        
        // Firebase 초기화 (관리자 대시보드에서 실행)
        const { collection, addDoc, serverTimestamp } = window.firebaseFirestoreFunctions;
        const db = window.firebaseDb;
        
        if (!db) {
            throw new Error('Firebase가 초기화되지 않았습니다.');
        }
        
        const reviewsRef = collection(db, 'reviews');
        let successCount = 0;
        
        for (const reviewData of initialReviewsData) {
            try {
                const docData = {
                    ...reviewData,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                };
                
                await addDoc(reviewsRef, docData);
                successCount++;
                console.log(`✅ 후기 추가 완료: ${reviewData.name} - ${reviewData.productName}`);
                
            } catch (error) {
                console.error(`❌ 후기 추가 실패: ${reviewData.name}`, error);
            }
        }
        
        console.log(`🎉 후기 데이터 초기화 완료! 총 ${successCount}개 후기 추가됨`);
        alert(`후기 데이터 초기화가 완료되었습니다!\n총 ${successCount}개의 후기가 추가되었습니다.`);
        
        return successCount;
        
    } catch (error) {
        console.error('❌ 후기 데이터 초기화 실패:', error);
        alert('후기 데이터 초기화에 실패했습니다: ' + error.message);
        return 0;
    }
}

// 전역 함수로 등록 (관리자 대시보드에서 호출 가능)
window.initializeReviewsData = initializeReviewsData;

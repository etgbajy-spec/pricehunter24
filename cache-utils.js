/**
 * PriceHunter 캐싱 유틸리티
 * Firestore 읽기 횟수를 70-80% 감소시켜 무료 한도 내에서 더 많은 트래픽 처리 가능
 */

// 캐시 설정
const CACHE_CONFIG = {
  // 일반 데이터 캐시 시간 (5분)
  DEFAULT: 5 * 60 * 1000,
  // 자주 변경되지 않는 데이터 (30분)
  LONG: 30 * 60 * 1000,
  // 자주 변경되는 데이터 (1분)
  SHORT: 1 * 60 * 1000,
  // 실시간 데이터는 캐시하지 않음
  REALTIME: 0
};

/**
 * 캐시 키 생성
 */
function getCacheKey(collection, filters = {}) {
  const filterStr = JSON.stringify(filters);
  return `ph_cache_${collection}_${btoa(filterStr)}`;
}

/**
 * 캐시된 데이터 가져오기
 */
function getCachedData(key) {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) {
      return null;
    }

    const { data, timestamp, version } = JSON.parse(cached);
    const now = Date.now();
    const cacheDuration = CACHE_CONFIG[version] || CACHE_CONFIG.DEFAULT;

    // 캐시 만료 확인
    if (now - timestamp > cacheDuration) {
      localStorage.removeItem(key);
      return null;
    }

    console.log(`✅ 캐시에서 데이터 로드: ${key} (${Math.round((now - timestamp) / 1000)}초 전 캐시)`);
    return data;
  } catch (error) {
    console.warn('⚠️ 캐시 읽기 오류:', error);
    localStorage.removeItem(key);
    return null;
  }
}

/**
 * 데이터를 캐시에 저장
 */
function setCachedData(key, data, version = 'DEFAULT') {
  try {
    const cacheData = {
      data,
      timestamp: Date.now(),
      version
    };
    localStorage.setItem(key, JSON.stringify(cacheData));
    console.log(`💾 데이터 캐시 저장: ${key}`);
  } catch (error) {
    // localStorage 용량 초과 시 오래된 캐시 삭제
    if (error.name === 'QuotaExceededError') {
      console.warn('⚠️ 캐시 용량 초과, 오래된 캐시 정리 중...');
      clearOldCache();
      // 다시 시도
      try {
        localStorage.setItem(key, JSON.stringify({
          data,
          timestamp: Date.now(),
          version
        }));
      } catch (e) {
        console.error('❌ 캐시 저장 실패:', e);
      }
    } else {
      console.error('❌ 캐시 저장 오류:', error);
    }
  }
}

/**
 * 오래된 캐시 정리 (localStorage 용량 절약)
 */
function clearOldCache() {
  try {
    const now = Date.now();
    const keysToRemove = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('ph_cache_')) {
        try {
          const cached = JSON.parse(localStorage.getItem(key));
          const cacheDuration = CACHE_CONFIG[cached.version] || CACHE_CONFIG.DEFAULT;
          if (now - cached.timestamp > cacheDuration) {
            keysToRemove.push(key);
          }
        } catch (e) {
          // 파싱 실패한 캐시도 삭제
          keysToRemove.push(key);
        }
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`🗑️ 오래된 캐시 ${keysToRemove.length}개 삭제됨`);
  } catch (error) {
    console.error('❌ 캐시 정리 오류:', error);
  }
}

/**
 * 특정 컬렉션의 캐시 무효화
 */
function invalidateCache(collection) {
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`ph_cache_${collection}_`)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`🔄 ${collection} 컬렉션 캐시 무효화: ${keysToRemove.length}개 삭제`);
  } catch (error) {
    console.error('❌ 캐시 무효화 오류:', error);
  }
}

/**
 * 모든 캐시 삭제
 */
function clearAllCache() {
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('ph_cache_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`🗑️ 모든 캐시 삭제: ${keysToRemove.length}개`);
  } catch (error) {
    console.error('❌ 캐시 삭제 오류:', error);
  }
}

/**
 * Firestore 쿼리 결과를 캐싱과 함께 가져오기
 * @param {Function} queryFn - Firestore 쿼리 함수
 * @param {string} collection - 컬렉션 이름
 * @param {object} filters - 필터 옵션 (캐시 키 생성용)
 * @param {string} version - 캐시 버전 ('DEFAULT', 'LONG', 'SHORT', 'REALTIME')
 * @returns {Promise} 쿼리 결과
 */
async function getCachedQuery(queryFn, collection, filters = {}, version = 'DEFAULT') {
  // 실시간 데이터는 캐시하지 않음
  if (version === 'REALTIME') {
    return await queryFn();
  }

  const cacheKey = getCacheKey(collection, filters);
  
  // 캐시에서 데이터 확인
  const cached = getCachedData(cacheKey);
  if (cached !== null) {
    return cached;
  }

  // 캐시에 없으면 Firestore에서 가져오기
  console.log(`📡 Firestore에서 데이터 가져오기: ${collection}`);
  const data = await queryFn();
  
  // 캐시에 저장
  setCachedData(cacheKey, data, version);
  
  return data;
}

/**
 * Firestore 문서를 배열로 변환 (캐싱 호환)
 */
function snapshotToArray(snapshot) {
  const array = [];
  snapshot.forEach((doc) => {
    const data = doc.data();
    // Timestamp 객체를 일반 객체로 변환 (캐싱 호환)
    const processedData = { id: doc.id };
    for (const key in data) {
      if (data[key] && typeof data[key] === 'object' && data[key].toDate) {
        processedData[key] = data[key].toDate().toISOString();
      } else {
        processedData[key] = data[key];
      }
    }
    array.push(processedData);
  });
  return array;
}

// 전역으로 노출
window.cacheUtils = {
  getCachedData,
  setCachedData,
  getCachedQuery,
  invalidateCache,
  clearAllCache,
  clearOldCache,
  getCacheKey,
  snapshotToArray,
  CACHE_CONFIG
};

// 페이지 로드 시 오래된 캐시 정리
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    clearOldCache();
  });
}

console.log('✅ 캐싱 유틸리티 로드 완료');


/**
 * 방문자(Visitors) 도메인 서비스
 */

import { firebaseWrapper } from '../utils/firebase-wrapper.js';

class VisitorsService {
    constructor() {
        this.unsubscribe = null;
    }

    async init() {
        await firebaseWrapper.init();
    }

    // 방문 데이터 가져오기
    async getVisits(filters = {}) {
        await this.init();
        
        const visitsRef = firebaseWrapper.collection('visits');
        let q = firebaseWrapper.query(visitsRef);

        // 정렬 시도
        try {
            q = firebaseWrapper.query(q, firebaseWrapper.orderBy('timestamp', 'desc'));
        } catch (e) {
            try {
                q = firebaseWrapper.query(q, firebaseWrapper.orderBy('date', 'desc'));
            } catch (e2) {
                // 정렬 없이 가져오기
                q = firebaseWrapper.query(visitsRef);
            }
        }

        const snapshot = await firebaseWrapper.getDocs(q);
        const visits = [];
        snapshot.forEach((doc) => {
            visits.push({
                id: doc.id,
                ...doc.data()
            });
        });

        return visits;
    }

    // 방문 데이터 집계
    aggregateVisits(visits, period, startDate = null, endDate = null) {
        const dataMap = new Map();
        const totalUniqueVisitors = new Set();
        let totalVisits = 0;

        visits.forEach(visit => {
            // 날짜 추출
            let date = visit.date;
            if (!date && visit.timestamp) {
                const timestamp = visit.timestamp.toDate ? visit.timestamp.toDate() : new Date(visit.timestamp);
                date = this.formatDate(timestamp);
            }
            
            if (!date) return;

            // 날짜 범위 필터링
            if (period !== 'all') {
                if (period === 'custom' && startDate && endDate) {
                    const startStr = this.formatDate(new Date(startDate));
                    const endStr = this.formatDate(new Date(endDate));
                    if (date < startStr || date > endStr) return;
                } else if (startDate && endDate) {
                    const startStr = this.formatDate(startDate);
                    const endStr = this.formatDate(endDate);
                    if (date < startStr || date > endStr) return;
                }
            }

            const userId = visit.userId || visit.sessionId || 'anonymous';
            totalVisits++;
            totalUniqueVisitors.add(userId);

            // 기간별 그룹핑
            let key;
            if (period === 'all') {
                const dateObj = new Date(date + 'T00:00:00');
                key = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
            } else if (period === 'custom') {
                key = date;
            } else if (period === 'daily') {
                key = date;
            } else if (period === 'weekly') {
                const dateObj = new Date(date + 'T00:00:00');
                const dayOfWeek = dateObj.getDay();
                const monday = new Date(dateObj);
                monday.setDate(dateObj.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
                key = this.formatDate(monday) + ' 주';
            } else if (period === 'monthly') {
                const dateObj = new Date(date + 'T00:00:00');
                key = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
            } else {
                key = date;
            }

            if (!dataMap.has(key)) {
                dataMap.set(key, { visits: 0, uniqueVisitors: new Set() });
            }

            const periodData = dataMap.get(key);
            periodData.visits++;
            periodData.uniqueVisitors.add(userId);
        });

        // 데이터 정렬 및 변환
        const sortedKeys = Array.from(dataMap.keys()).sort();
        const chartData = {
            labels: [],
            visitors: [],
            visits: [],
            uniqueVisitors: []
        };

        let maxVisitors = 0;
        let totalPeriodVisitors = 0;

        sortedKeys.forEach(key => {
            const periodData = dataMap.get(key);
            const uniqueCount = periodData.uniqueVisitors.size;

            chartData.labels.push(key);
            chartData.visitors.push(uniqueCount);
            chartData.visits.push(periodData.visits);
            chartData.uniqueVisitors.push(uniqueCount);

            totalPeriodVisitors += uniqueCount;
            if (uniqueCount > maxVisitors) {
                maxVisitors = uniqueCount;
            }
        });

        return {
            chartData,
            sortedKeys,
            dataMap,
            totalUniqueVisitors: totalUniqueVisitors.size,
            totalVisits,
            maxVisitors,
            avgVisitors: sortedKeys.length > 0 ? Math.round(totalPeriodVisitors / sortedKeys.length) : 0
        };
    }

    formatDate(date) {
        if (!date) return '';
        const d = date instanceof Date ? date : new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    getPeriodDateRange(period) {
        const today = new Date();
        let startDate, endDate;

        if (period === 'daily') {
            startDate = new Date(today);
            startDate.setDate(today.getDate() - 30);
            endDate = today;
        } else if (period === 'weekly') {
            startDate = new Date(today);
            startDate.setDate(today.getDate() - 84);
            endDate = today;
        } else if (period === 'monthly') {
            startDate = new Date(today);
            startDate.setMonth(today.getMonth() - 12);
            endDate = today;
        } else {
            startDate = null;
            endDate = null;
        }

        return { startDate, endDate };
    }
}

export const visitorsService = new VisitorsService();


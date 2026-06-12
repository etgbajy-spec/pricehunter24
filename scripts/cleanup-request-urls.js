/**
 * 의뢰(requests) 데이터 정리:
 * - description·productDescription·evidenceNotes 에서 "참고 URL:" 줄 제거
 * - adminResponse.additionalInfo 통일
 * - 상품 링크(url/urls/customerProductUrl)는 유지
 *
 * 실행: node scripts/cleanup-request-urls.js
 */
'use strict';

const admin = require('firebase-admin');
const path = require('path');

const UNIFIED_ADDITIONAL_INFO =
  'PriceHunter 검증팀이 의뢰하신 제품의 가격과 구매 조건을 검토한 결과입니다.\n\n' +
  '최저가·제품·배송·판매처·주의사항을 리포트에서 확인하신 뒤 구매를 검토해 주세요. ' +
  '동일 제품·동일 조건 여부와 배송·구성품은 최종 구매 전 판매처 페이지에서 한 번 더 확인하시는 것을 권장합니다.';

const serviceAccountPath = path.join(__dirname, '..', 'pricehunter-99a1b-firebase-adminsdk-fbsvc-61241fe6ae.json');
const serviceAccount = require(serviceAccountPath);

function stripReferenceUrlLines(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .split('\n')
    .filter((line) => !/^\s*참고\s*URL\s*:/i.test(line.trim()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'pricehunter-99a1b',
});

async function main() {
  const db = admin.firestore();
  const snap = await db.collection('requests').get();
  console.log(`총 ${snap.size}건 조회`);

  let updated = 0;
  let batch = db.batch();
  let batchCount = 0;

  async function commitBatch() {
    if (batchCount === 0) return;
    await batch.commit();
    batch = db.batch();
    batchCount = 0;
  }

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const updates = {};
    let changed = false;

    ['description', 'productDescription'].forEach((field) => {
      if (!data[field]) return;
      const cleaned = stripReferenceUrlLines(data[field]);
      if (cleaned !== data[field]) {
        updates[field] = cleaned || '—';
        changed = true;
      }
    });

    if (data.adminResponse && typeof data.adminResponse === 'object') {
      const next = { ...data.adminResponse, additionalInfo: UNIFIED_ADDITIONAL_INFO };
      if (JSON.stringify(next) !== JSON.stringify(data.adminResponse)) {
        updates.adminResponse = next;
        changed = true;
      }
    }

    if (data.purchaseReport && typeof data.purchaseReport === 'object') {
      const pr = { ...data.purchaseReport };
      let prChanged = false;
      if (pr.evidenceNotes) {
        const cleanedNotes = stripReferenceUrlLines(pr.evidenceNotes);
        if (cleanedNotes !== pr.evidenceNotes) {
          pr.evidenceNotes = cleanedNotes;
          prChanged = true;
        }
      }
      if (pr.summary && /참고\s*URL\s*:/i.test(pr.summary)) {
        pr.summary = stripReferenceUrlLines(
          String(pr.summary).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
        );
        prChanged = true;
      }
      if (prChanged) {
        updates.purchaseReport = pr;
        changed = true;
      }
    }

    if (!changed) continue;

    batch.update(docSnap.ref, updates);
    batchCount += 1;
    updated += 1;

    if (batchCount >= 400) {
      await commitBatch();
      console.log(`  ... ${updated}건 처리 중`);
    }
  }

  await commitBatch();
  console.log(`완료: ${updated}건 업데이트 / 전체 ${snap.size}건`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

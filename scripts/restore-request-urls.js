/**
 * Firestore 의뢰 상품 링크 일괄 복구
 * 실행: node scripts/restore-request-urls.js
 */
'use strict';

const admin = require('firebase-admin');
const path = require('path');
const RequestUrlUtils = require('../request-url-utils');

const serviceAccountPath = path.join(__dirname, '..', 'pricehunter-99a1b-firebase-adminsdk-fbsvc-61241fe6ae.json');
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'pricehunter-99a1b'
});

async function main() {
  const db = admin.firestore();
  const snap = await db.collection('requests').get();
  console.log(`총 ${snap.size}건 조회`);

  let restored = 0;
  let skipped = 0;
  let notFound = 0;
  let batch = db.batch();
  let batchCount = 0;

  async function commitBatch() {
    if (batchCount === 0) return;
    await batch.commit();
    batch = db.batch();
    batchCount = 0;
  }

  for (const docSnap of snap.docs) {
    const data = docSnap.data() || {};
    if (RequestUrlUtils.hasStoredRequestUrls(data)) {
      skipped += 1;
      continue;
    }
    const patch = RequestUrlUtils.buildUrlRestorePatch(data);
    if (!patch) {
      notFound += 1;
      continue;
    }
    batch.update(docSnap.ref, Object.assign({}, patch, {
      urlRestoredAt: admin.firestore.FieldValue.serverTimestamp(),
      urlRestoredFrom: 'derived'
    }));
    batchCount += 1;
    restored += 1;
    if (batchCount >= 400) {
      await commitBatch();
      console.log(`  ... ${restored}건 복구 중`);
    }
  }

  await commitBatch();
  console.log(`완료: 복구 ${restored}건 / 기존유지 ${skipped}건 / 복구불가 ${notFound}건 / 전체 ${snap.size}건`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

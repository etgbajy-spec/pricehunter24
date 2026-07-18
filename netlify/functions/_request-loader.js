/**
 * 의뢰 문서 조회 (reqId / requestNumber / reqNum 호환)
 */
'use strict';

function normalizeReqId(input) {
  let reqId = (input || '').toString().trim();
  if (reqId) reqId = reqId.replace(/^#+/, '');
  if (!reqId || reqId.length > 80) return '';
  return reqId;
}

async function loadRequestByReqId(db, reqId) {
  const id = normalizeReqId(reqId);
  if (!id) return null;

  const docSnap = await db.collection('requests').doc(id).get();
  if (docSnap.exists) return { id: docSnap.id, data: docSnap.data() || {} };

  const withHash = id.startsWith('PH-') ? '#' + id : id;
  let q = await db.collection('requests').where('requestNumber', '==', id).limit(1).get();
  if (!q.empty) return { id: q.docs[0].id, data: q.docs[0].data() || {} };
  q = await db.collection('requests').where('requestNumber', '==', withHash).limit(1).get();
  if (!q.empty) return { id: q.docs[0].id, data: q.docs[0].data() || {} };
  q = await db.collection('requests').where('reqNum', '==', id).limit(1).get();
  if (!q.empty) return { id: q.docs[0].id, data: q.docs[0].data() || {} };
  q = await db.collection('requests').where('reqNum', '==', withHash).limit(1).get();
  if (!q.empty) return { id: q.docs[0].id, data: q.docs[0].data() || {} };
  return null;
}

module.exports = { normalizeReqId, loadRequestByReqId };

/**
 * Firestore 의뢰 문서 → 알림 파라미터 로드
 */
'use strict';

const notificationDispatch = require('./notification-dispatch');
const customerEmail = require('./customer-notify-email');

async function resolveRecipientEmail(db, data) {
  let toEmail = data.email || data.userEmail;
  if ((!toEmail || !customerEmail.isValidEmail(toEmail)) && (data.uid || data.userId)) {
    const uid = data.uid || data.userId;
    const userSnap = await db.collection('users').doc(uid).get();
    if (userSnap.exists) {
      const userData = userSnap.data() || {};
      toEmail = userData.email || userData.userEmail;
    }
  }
  return customerEmail.isValidEmail(toEmail) ? String(toEmail).trim() : null;
}

async function resolveRecipientPhone(db, data) {
  let phone = data.phone || data.userPhone || data.phoneNumber || '';
  if (!phone && (data.uid || data.userId)) {
    const uid = data.uid || data.userId;
    const userSnap = await db.collection('users').doc(uid).get();
    if (userSnap.exists) {
      const userData = userSnap.data() || {};
      phone = userData.phone || userData.userPhone || '';
    }
  }
  return notificationDispatch.resolvePhoneFromData(data, { phone });
}

async function loadRequestDoc(db, requestId) {
  if (!requestId) return null;
  const docSnap = await db.collection('requests').doc(String(requestId)).get();
  if (docSnap.exists) {
    return { id: docSnap.id, data: docSnap.data() || {} };
  }
  const reqNum = String(requestId).replace(/^#+/, '');
  const withHash = reqNum.startsWith('PH-') ? '#' + reqNum : reqNum;
  let q = await db.collection('requests').where('requestNumber', '==', reqNum).limit(1).get();
  if (!q.empty) return { id: q.docs[0].id, data: q.docs[0].data() || {} };
  q = await db.collection('requests').where('requestNumber', '==', withHash).limit(1).get();
  if (!q.empty) return { id: q.docs[0].id, data: q.docs[0].data() || {} };
  return null;
}

async function buildNotifyParamsFromRequestId(db, requestId) {
  const loaded = await loadRequestDoc(db, requestId);
  if (!loaded) return null;
  const data = loaded.data;
  const toEmail = await resolveRecipientEmail(db, data);
  const toPhone = await resolveRecipientPhone(db, data);
  if (!toEmail) return null;
  return notificationDispatch.buildNotifyParamsFromRequestData(data, {
    toEmail,
    toPhone,
    requestId: loaded.id
  });
}

module.exports = {
  loadRequestDoc,
  resolveRecipientEmail,
  resolveRecipientPhone,
  buildNotifyParamsFromRequestId
};

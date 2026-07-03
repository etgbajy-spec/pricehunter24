/**
 * 관리자 회원 삭제 (Firebase Admin SDK)
 */
'use strict';

async function deleteUserByAdmin(admin, { userId, email }) {
  const db = admin.firestore();
  let found = null;

  if (userId) {
    const snap = await db.collection('users').doc(String(userId)).get();
    if (snap.exists) found = { id: snap.id, data: snap.data() };
  }
  if (!found && email) {
    const q = await db.collection('users').where('email', '==', String(email).trim().toLowerCase()).limit(1).get();
    if (!q.empty) {
      const doc = q.docs[0];
      found = { id: doc.id, data: doc.data() };
    }
  }
  if (!found) {
    const err = new Error('사용자를 찾을 수 없습니다.');
    err.status = 404;
    throw err;
  }

  const userEmail = (found.data.email || email || '').toLowerCase();
  if (userEmail === 'admin@pricehunter.com') {
    const err = new Error('관리자 계정은 삭제할 수 없습니다.');
    err.status = 403;
    throw err;
  }

  const docId = found.id;
  const authUid = found.data.uid || found.data.userId || docId;

  await db.collection('users').doc(docId).delete();

  let authDeleted = false;
  let authDeleteError = null;
  if (authUid) {
    try {
      await admin.auth().deleteUser(String(authUid));
      authDeleted = true;
    } catch (e) {
      authDeleteError = e.message || String(e);
    }
  }

  return {
    success: true,
    deletedUserId: docId,
    email: found.data.email || email,
    authDeleted,
    authDeleteError
  };
}

module.exports = { deleteUserByAdmin };

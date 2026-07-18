/**
 * Netlify Functions 공통 관리자 인증 (Bearer Firebase ID token)
 */
'use strict';

const { admin, initAdmin } = require('./_firebase-admin');

async function verifyAdminBearer(event) {
  if (!initAdmin()) {
    return { ok: false, status: 503, error: 'Firebase Admin SDK 초기화 실패' };
  }
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const m = String(authHeader).match(/^Bearer\s+(.+)$/i);
  if (!m) return { ok: false, status: 401, error: '인증이 필요합니다.' };
  try {
    const decoded = await admin.auth().verifyIdToken(m[1].trim());
    const adminSnap = await admin.firestore().collection('admins').doc(decoded.uid).get();
    if (!adminSnap.exists) return { ok: false, status: 403, error: '관리자 권한이 없습니다.' };
    const adminData = adminSnap.data() || {};
    const ok =
      adminData.role === 'admin' ||
      (Array.isArray(adminData.permissions) && adminData.permissions.includes('admin'));
    if (!ok) return { ok: false, status: 403, error: '관리자 권한이 없습니다.' };
    return { ok: true, uid: decoded.uid, email: decoded.email || '' };
  } catch (e) {
    return { ok: false, status: 401, error: '인증에 실패했습니다.' };
  }
}

async function verifyUserBearer(event) {
  if (!initAdmin()) {
    return { ok: false, status: 503, error: 'Firebase Admin SDK 초기화 실패' };
  }
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const m = String(authHeader).match(/^Bearer\s+(.+)$/i);
  if (!m) return { ok: false, status: 401, error: '인증이 필요합니다.' };
  try {
    const decoded = await admin.auth().verifyIdToken(m[1].trim());
    return { ok: true, uid: decoded.uid, email: decoded.email || '' };
  } catch (e) {
    return { ok: false, status: 401, error: '인증에 실패했습니다.' };
  }
}

function jsonHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-api-key',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };
}

module.exports = {
  admin,
  initAdmin,
  verifyAdminBearer,
  verifyUserBearer,
  jsonHeaders
};

/**
 * Netlify Function: POST /api/admin/delete-user
 */
const { admin, initAdmin } = require('./_firebase-admin');
const { deleteUserByAdmin } = require('../../admin-delete-user-core');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-api-key, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

function verifyAdminApiKey(event) {
  const apiKey = (event.headers['x-admin-api-key'] || event.headers['X-Admin-Api-Key'] || '').trim();
  const expected = process.env.ADMIN_API_SECRET || '';
  if (!expected) return { ok: false, status: 503, error: 'ADMIN_API_SECRET이 설정되지 않았습니다.' };
  if (apiKey !== expected) return { ok: false, status: 401, error: '관리자 API 키가 올바르지 않습니다.' };
  return { ok: true };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const auth = verifyAdminApiKey(event);
  if (!auth.ok) {
    return { statusCode: auth.status, headers, body: JSON.stringify({ error: auth.error }) };
  }
  if (!initAdmin()) {
    return { statusCode: 503, headers, body: JSON.stringify({ error: 'Firebase Admin SDK 초기화 실패' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: '잘못된 요청 형식입니다.' }) };
  }

  try {
    const result = await deleteUserByAdmin(admin, {
      userId: body.userId || body.uid || '',
      email: body.email || ''
    });
    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (error) {
    const status = error.status || 500;
    console.error('admin-delete-user error:', error);
    return { statusCode: status, headers, body: JSON.stringify({ error: error.message || '사용자 삭제 실패' }) };
  }
};

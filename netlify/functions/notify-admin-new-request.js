/**
 * Netlify Function: POST /api/notify-admin-new-request
 */
const { sendAdminNewRequestEmail } = require('../../admin-notify-email');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: '잘못된 요청 형식입니다.' }) };
  }

  if (!body.requestNumber) {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'requestNumber가 필요합니다.' }) };
  }

  try {
    const result = await sendAdminNewRequestEmail({
      requestNumber: body.requestNumber,
      requestType: body.requestType || '의뢰',
      customerEmail: body.customerEmail || '',
      productUrl: body.productUrl || '',
      productName: body.productName || '',
      productOption: body.productOption || '',
      productPrice: body.productPrice
    });
    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (error) {
    console.error('notify-admin-new-request error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message || '알림 발송 실패' })
    };
  }
};

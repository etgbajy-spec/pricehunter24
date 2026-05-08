/**
 * Netlify Function: PortOne 결제 상태 조회 (디버깅/실패 원인 노출용)
 * - payment-fail.html에서 /api/portone/status?imp_uid=... 호출
 *
 * 필요 환경변수:
 * - PORTONE_IMP_KEY / PORTONE_IMP_SECRET
 */
async function portOneGetToken(impKey, impSecret) {
  const res = await fetch('https://api.iamport.kr/users/getToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imp_key: impKey, imp_secret: impSecret }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.response?.access_token) {
    const msg = data?.message || '포트원 토큰 발급 실패';
    const code = data?.code || res.status;
    throw new Error(`${msg} (code=${code})`);
  }
  return data.response.access_token;
}

async function portOneGetPayment(accessToken, impUid) {
  const res = await fetch(`https://api.iamport.kr/payments/${encodeURIComponent(impUid)}`, {
    method: 'GET',
    headers: { 'Authorization': accessToken },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.response) {
    const msg = data?.message || '포트원 결제 조회 실패';
    const code = data?.code || res.status;
    throw new Error(`${msg} (code=${code})`);
  }
  return data.response;
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  const impUid = String(event.queryStringParameters?.imp_uid || '').trim();
  if (!impUid) return { statusCode: 400, headers, body: JSON.stringify({ error: 'imp_uid가 필요합니다.' }) };

  const impKey = String(process.env.PORTONE_IMP_KEY || '').trim();
  const impSecret = String(process.env.PORTONE_IMP_SECRET || '').trim();
  if (!impKey || !impSecret) {
    return { statusCode: 503, headers, body: JSON.stringify({ error: '서버 결제 설정이 완료되지 않았습니다. (PORTONE_IMP_KEY/PORTONE_IMP_SECRET)' }) };
  }

  try {
    const token = await portOneGetToken(impKey, impSecret);
    const pay = await portOneGetPayment(token, impUid);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        imp_uid: pay.imp_uid,
        merchant_uid: pay.merchant_uid,
        status: pay.status,
        amount: pay.amount,
        paid_at: pay.paid_at || null,
        failed_at: pay.failed_at || null,
        fail_reason: pay.fail_reason || null,
        cancel_reason: pay.cancel_reason || null,
        pg_provider: pay.pg_provider || null,
        pay_method: pay.pay_method || null,
        card_name: pay.card_name || null,
        card_number: pay.card_number ? String(pay.card_number).slice(0, 6) + '****' : null,
      }),
    };
  } catch (e) {
    console.error('❌ portone-status error:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: '결제 상태 조회 중 오류가 발생했습니다.' }) };
  }
};


/**
 * Netlify Function: 결제 금액 검증
 * Express 서버의 /api/validate-payment 엔드포인트를 서버리스 함수로 변환
 */

exports.handler = async (event, context) => {
  // CORS 헤더 설정
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // OPTIONS 요청 처리 (CORS preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // POST 요청만 허용
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // 요청 본문 파싱
    const body = JSON.parse(event.body || '{}');
    const { productName, amount, orderId } = body;

    // 입력 데이터 검증
    if (!productName || !amount || !orderId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '필수 결제 정보가 누락되었습니다.' }),
      };
    }

    // 금액 검증
    const numericAmount = parseInt(amount);
    if (isNaN(numericAmount) || numericAmount <= 0 || numericAmount > 10000000) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '유효하지 않은 결제 금액입니다.' }),
      };
    }

    // 상품명 검증
    if (typeof productName !== 'string' || productName.length > 100) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '유효하지 않은 상품명입니다.' }),
      };
    }

    // 주문번호 검증
    if (typeof orderId !== 'string' || orderId.length > 50) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '유효하지 않은 주문번호입니다.' }),
      };
    }

    // 결제 검증 성공
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        valid: true,
        amount: numericAmount,
        message: '결제 정보가 유효합니다.',
      }),
    };
  } catch (error) {
    console.error('❌ 결제 검증 실패:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: '결제 검증 중 오류가 발생했습니다.' }),
    };
  }
};


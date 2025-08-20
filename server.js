const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

const app = express();

// 미들웨어 설정
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://pricehunt24.com', 'https://www.pricehunt24.com'],
  credentials: true
}));
app.use(express.json());
app.use(express.static('.'));

// 로깅 미들웨어
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// SMS 발송 API
app.post('/api/send-sms', async (req, res) => {
  try {
    const { phone, message, serviceId, accessKey, secretKey } = req.body;
    
    // 네이버 클라우드 SMS API 호출
    const timestamp = Date.now().toString();
    const signature = generateSignature(secretKey, timestamp, 'POST', '/sms/v2/services/' + serviceId + '/messages');
    
    const response = await axios.post(
      `https://sens.apigw.ntruss.com/sms/v2/services/${serviceId}/messages`,
      {
        type: 'SMS',
        from: process.env.SMS_FROM_NUMBER || '발신번호',
        content: message,
        messages: [{ to: phone }]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-ncp-apigw-timestamp': timestamp,
          'x-ncp-iam-access-key': accessKey,
          'x-ncp-apigw-signature-v2': signature
        }
      }
    );
    
    console.log('SMS 발송 성공:', phone);
    res.json({ success: true, data: response.data });
  } catch (error) {
    console.error('SMS 발송 실패:', error.response?.data || error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 카카오톡 알림톡 API
app.post('/api/send-kakao', async (req, res) => {
  try {
    const { phone, templateId, variables } = req.body;
    
    // 카카오 알림톡 API 호출 (SOLAPI 사용)
    const response = await axios.post(
      'https://api.solapi.com/messages/v4/send',
      {
        message: {
          to: phone,
          from: process.env.KAKAO_FROM_NUMBER || '발신번호',
          kakaoOptions: {
            pfId: process.env.KAKAO_PFID,
            templateId: templateId,
            variables: variables
          }
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + process.env.SOLAPI_API_KEY
        }
      }
    );
    
    console.log('카카오톡 알림톡 발송 성공:', phone);
    res.json({ success: true, data: response.data });
  } catch (error) {
    console.error('카카오톡 알림톡 발송 실패:', error.response?.data || error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 본인인증 시작 API
app.post('/api/identity-verification/start', async (req, res) => {
  try {
    const { merchantId, userName, birthDate, phoneNumber, returnUrl } = req.body;
    
    // KG이니시스 본인인증 요청
    const response = await axios.post(
      'https://stdpay.inicis.com/stdjs/INIStdPay.js',
      new URLSearchParams({
        merchantId: merchantId,
        userName: userName,
        birthDate: birthDate,
        phoneNumber: phoneNumber,
        returnUrl: returnUrl,
        popupYn: 'Y'
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    console.log('본인인증 요청 성공:', userName);
    res.json({ success: true, verificationUrl: response.data.verificationUrl });
  } catch (error) {
    console.error('본인인증 요청 실패:', error.response?.data || error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 본인인증 결과 확인 API
app.post('/api/identity-verification/result', async (req, res) => {
  try {
    const { transactionId } = req.body;
    
    // KG이니시스 본인인증 결과 확인
    const response = await axios.post(
      'https://stdpay.inicis.com/stdjs/INIStdPay.js',
      new URLSearchParams({
        merchantId: process.env.KG_MERCHANT_ID,
        transactionId: transactionId
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    console.log('본인인증 결과 확인 성공:', transactionId);
    res.json({ success: true, data: response.data });
  } catch (error) {
    console.error('본인인증 결과 확인 실패:', error.response?.data || error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 결제 웹훅 처리
app.post('/api/payment/webhook', async (req, res) => {
  try {
    const { paymentKey, orderId, amount, status } = req.body;
    
    // 결제 상태 업데이트
    console.log('결제 웹훅 수신:', { paymentKey, orderId, amount, status });
    
    // 여기에 결제 상태 업데이트 로직 추가
    
    res.json({ success: true });
  } catch (error) {
    console.error('결제 웹훅 처리 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 헬스 체크
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// 404 처리
app.use('*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// 에러 핸들러
app.use((error, req, res, next) => {
  console.error('API Error:', error);
  res.status(500).json({ error: 'Internal Server Error' });
});

// 네이버 클라우드 서명 생성 함수
function generateSignature(secretKey, timestamp, method, url) {
  const message = method + ' ' + url + '\n' + timestamp + '\n' + process.env.NAVER_SMS_ACCESS_KEY;
  const signature = crypto.createHmac('sha256', secretKey).update(message).digest('base64');
  return signature;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`PriceHunter API Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
}); 
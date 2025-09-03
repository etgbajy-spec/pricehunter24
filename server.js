const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:8000', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());
app.use(express.static('.'));

// 요청 로깅 미들웨어
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// 회원가입 API (통신사 본인인증 기반)
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password, phone, birth, certified } = req.body;
    
    // 본인인증 완료 여부 확인
    if (!certified) {
      return res.status(400).json({ success: false, error: '본인인증을 완료해주세요.' });
    }
    
    // 휴대폰번호 중복 체크
    const existingUsers = JSON.parse(localStorage.getItem('users') || '[]');
    const isDuplicatePhone = existingUsers.some(user => user.phone === phone);
    
    if (isDuplicatePhone) {
      return res.status(400).json({ success: false, error: '이미 가입된 휴대폰번호입니다.' });
    }
    
    // 이메일 중복 체크
    const isDuplicateEmail = existingUsers.some(user => user.email === email);
    if (isDuplicateEmail) {
      return res.status(400).json({ success: false, error: '이미 가입된 이메일 주소입니다.' });
    }
    
    // 새 회원 생성
    const newUser = {
      id: 'user-' + Date.now(),
      name: name,
      email: email,
      password: password, // 실제로는 해시화 필요
      phone: phone,
      birth: birth,
      points: 100, // 가입 보너스
      createdAt: new Date().toISOString(),
      verified: true,
      certified: true // 본인인증 완료 표시
    };
    
    // 회원 정보 저장
    existingUsers.push(newUser);
    localStorage.setItem('users', JSON.stringify(existingUsers));
    
    console.log('회원가입 성공 (본인인증):', phone);
    res.json({ success: true, message: '회원가입이 완료되었습니다!', user: { id: newUser.id, name: newUser.name, email: newUser.email } });
  } catch (error) {
    console.error('회원가입 실패:', error);
    res.status(500).json({ success: false, error: '회원가입에 실패했습니다.' });
  }
});

// 로그인 API
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // 회원 정보 조회
    const existingUsers = JSON.parse(localStorage.getItem('users') || '[]');
    const user = existingUsers.find(u => u.email === email && u.password === password);
    
    if (!user) {
      return res.status(401).json({ success: false, error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }
    
    console.log('로그인 성공:', email);
    res.json({ 
      success: true, 
      message: '로그인되었습니다!', 
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        points: user.points 
      } 
    });
  } catch (error) {
    console.error('로그인 실패:', error);
    res.status(500).json({ success: false, error: '로그인에 실패했습니다.' });
  }
});

// 본인인증 시작 API (KG이니시스)
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

app.listen(PORT, () => {
  console.log(`PriceHunter API Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
}); 
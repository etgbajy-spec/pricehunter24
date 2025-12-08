/**
 * Firebase 관리자 권한 설정 스크립트
 * 
 * 사용 방법:
 * 1. Firebase Console에서 관리자 계정을 생성합니다
 * 2. 이 스크립트를 실행하여 해당 계정에 관리자 권한을 부여합니다
 * 
 * 실행 명령:
 * node set-admin-role.js <관리자이메일>
 * 
 * 예시:
 * node set-admin-role.js admin@pricehunter.com
 */

const admin = require('firebase-admin');
const path = require('path');

// Firebase Admin SDK 초기화
const serviceAccount = require('./pricehunter-99a1b-firebase-adminsdk-fbsvc-61241fe6ae.json');

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: "pricehunter-99a1b"
  });
  console.log('✅ Firebase Admin SDK 초기화 완료');
} catch (error) {
  console.error('❌ Firebase Admin SDK 초기화 실패:', error.message);
  process.exit(1);
}

// 명령줄 인자에서 이메일 가져오기
const adminEmail = process.argv[2];

if (!adminEmail) {
  console.error('❌ 사용법: node set-admin-role.js <관리자이메일>');
  console.error('예시: node set-admin-role.js admin@pricehunter.com');
  process.exit(1);
}

// 이메일 형식 검증
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(adminEmail)) {
  console.error('❌ 올바른 이메일 형식이 아닙니다.');
  process.exit(1);
}

async function setAdminRole() {
  try {
    console.log(`\n🔄 관리자 권한 설정 시작: ${adminEmail}`);
    
    // 이메일로 사용자 찾기
    const user = await admin.auth().getUserByEmail(adminEmail);
    
    if (!user) {
      console.error(`❌ 사용자를 찾을 수 없습니다: ${adminEmail}`);
      console.log('\n💡 먼저 Firebase Console에서 다음 단계를 수행하세요:');
      console.log('   1. Firebase Console → Authentication → Users로 이동');
      console.log('   2. "Add user" 버튼 클릭');
      console.log('   3. 이메일과 임시 비밀번호를 입력하여 계정 생성');
      console.log('   4. 생성된 계정으로 로그인하여 비밀번호 변경');
      process.exit(1);
    }
    
    console.log(`✅ 사용자 찾음: ${user.uid} (${user.email})`);
    
    // Custom Claims 설정 (관리자 권한 부여)
    await admin.auth().setCustomUserClaims(user.uid, {
      role: 'admin'
    });
    
    console.log('✅ 관리자 권한(Custom Claims) 설정 완료!');
    console.log('\n📋 다음 단계:');
    console.log('   1. 해당 계정으로 로그인');
    console.log('   2. 토큰을 새로고침하기 위해 로그아웃 후 다시 로그인');
    console.log('   3. admin-dashboard.html 페이지에서 관리자 대시보드 접근');
    
    // Firestore의 admins 컬렉션에도 추가 (선택사항)
    const db = admin.firestore();
    await db.collection('admins').doc(user.uid).set({
      email: user.email,
      role: 'admin',
      permissions: ['admin'],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    console.log('✅ Firestore admins 컬렉션에도 추가 완료!');
    console.log('\n🎉 모든 설정이 완료되었습니다!');
    
  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
    
    if (error.code === 'auth/user-not-found') {
      console.log('\n💡 사용자를 찾을 수 없습니다. Firebase Console에서 계정을 먼저 생성하세요.');
    } else if (error.code === 'auth/invalid-email') {
      console.log('\n💡 올바른 이메일 형식이 아닙니다.');
    }
    
    process.exit(1);
  }
}

// 실행
setAdminRole()
  .then(() => {
    console.log('\n✅ 스크립트 실행 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 스크립트 실행 실패:', error);
    process.exit(1);
  });


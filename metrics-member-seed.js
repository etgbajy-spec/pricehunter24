/**
 * 리포트 동기화용 회원 시드 생성 (Node + 브라우저 공용)
 */
(function (global) {
  'use strict';

  const REPORT_SEED_FIRST_NAMES = [
    '민준', '서윤', '지훈', '유나', '하은', '도윤', '은서', '태민', '서준', '채원',
    '지안', '승우', '다은', '현우', '수빈', '민재', '소율', '준영', '예린', '시우',
    '가은', '태양', '민서', '지원', '하준', '서현', '우진', '나연', '도현', '지우',
    '민호', '하람', '서진', '유진', '도훈', '채은', '시온', '준서', '하연', '민석',
    '서영', '지호', '유림', '현서', '다인', '건우', '서아', '준혁', '수아', '태호'
  ];

  const REPORT_SEED_LAST_NAMES = [
    '김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '신', '권', '황'
  ];

  const EMAIL_DOMAINS = ['gmail.com', 'naver.com', 'daum.net', 'hanmail.net', 'nate.com'];
  const EMAIL_PREFIXES = ['kim', 'lee', 'park', 'choi', 'jung', 'kang', 'yoon', 'lim', 'han', 'seo', 'oh', 'shin'];
  const EMAIL_SUFFIXES = ['minjun', 'seoyeon', 'jihoon', 'yuna', 'eunseo', 'doyoon', 'taemin', 'jiwoo', 'hayoon', 'woojin', 'subin', 'jaeho'];

  function normalizeMemberName(value) {
    return (value || '').toString().trim().replace(/\s+/g, '');
  }

  function normalizeMemberEmail(value) {
    return (value || '').toString().trim().toLowerCase();
  }

  function normalizeMemberPhone(value) {
    return (value || '').toString().replace(/[^\d]/g, '');
  }

  function memberSeedHash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (h * 31 + str.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }

  function parseDateYmd(dateStr) {
    const parts = String(dateStr || '').split('-').map(Number);
    if (parts.length !== 3 || parts.some((n) => isNaN(n))) return null;
    return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0);
  }

  function formatDateYmd(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function isReportSeedUser(data) {
    if (!data) return false;
    if (data._phReportSeed === true) return true;
    if (data.seeded === true || data.isReportSeed === true) return true;
    const src = (data.seedSource || '').toString();
    if (src === 'report_sync' || src === 'request' || src === 'extra' || src === 'manual') return true;
    const email = normalizeMemberEmail(data.email);
    return email.includes('@seed.pricehunter.local') || email.startsWith('ph.report.');
  }

  function buildRealisticMemberUid(seedKey) {
    const h = memberSeedHash(String(seedKey));
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789';
    let s = '';
    for (let i = 0; i < 28; i++) {
      s += chars[(h + i * 31) % chars.length];
    }
    return s;
  }

  function buildReportSeedEmail(index, nameKey) {
    const h = memberSeedHash(`${index}_${nameKey}`);
    const domain = EMAIL_DOMAINS[h % EMAIL_DOMAINS.length];
    const prefix = EMAIL_PREFIXES[h % EMAIL_PREFIXES.length];
    const suffix = EMAIL_SUFFIXES[(h >> 4) % EMAIL_SUFFIXES.length];
    const num = (h % 900) + 100;
    const patterns = [
      `${prefix}${suffix}${num % 100}`,
      `${prefix}.${suffix}${num % 100}`,
      `${prefix}${suffix}${String(num).slice(-2)}`,
      `${prefix}_${suffix}${num % 50}`
    ];
    const local = patterns[h % patterns.length].toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 28);
    return `${local || 'member'}@${domain}`;
  }

  function buildReportSeedPhone(seedKey, usedPhones) {
    const h = memberSeedHash(seedKey);
    const mid = String(2000 + (h % 8000)).padStart(4, '0');
    let last = String(1000 + Math.floor(h / 97) % 9000).padStart(4, '0');
    let phone = `010-${mid}-${last}`;
    let bump = 0;
    while (usedPhones.has(normalizeMemberPhone(phone)) && bump < 300) {
      bump++;
      last = String((Number(last) + 13) % 10000).padStart(4, '0');
      phone = `010-${mid}-${last}`;
    }
    return phone;
  }

  function buildReportSeedJoinDate(index, total, launchStr, endStr) {
    const start = parseDateYmd(launchStr);
    const end = parseDateYmd(endStr) || new Date();
    if (!start || total <= 0) return end;
    const span = Math.max(1, Math.round((end - start) / 86400000));
    const dayOffset = total <= 1 ? 0 : Math.round((span * index) / (total - 1));
    const d = new Date(start);
    d.setDate(d.getDate() + dayOffset);
    if (d > end) return new Date(end);
    return d;
  }

  function pickReportSeedName(index, usedNames) {
    for (let attempt = 0; attempt < 500; attempt++) {
      const n = index + attempt * 13;
      const last = REPORT_SEED_LAST_NAMES[n % REPORT_SEED_LAST_NAMES.length];
      const first = REPORT_SEED_FIRST_NAMES[Math.floor(n / REPORT_SEED_LAST_NAMES.length) % REPORT_SEED_FIRST_NAMES.length];
      const name = `${last}${first}`;
      const key = normalizeMemberName(name);
      if (key && !usedNames.has(key)) return { name, key };
    }
    const fallback = `회원${index + 1}`;
    return { name: fallback, key: normalizeMemberName(fallback) };
  }

  /** 카카오 로그인은 현재 미활성 — 시드 회원은 email/google만 사용 */
  function pickSeedLoginMethod(email) {
    const h = memberSeedHash(String(email));
    return h % 4 === 0 ? 'google' : 'email';
  }

  function buildSeedMemberDocument(item) {
    const joinDate = item.joinDate instanceof Date ? item.joinDate : new Date(item.joinDate);
    const email = item.email;
    const h = memberSeedHash(`${email}_${item.name}`);
    const loginMethod = pickSeedLoginMethod(email);
    const loginCount = (h % 11) + 1;
    const lastLogin = new Date(joinDate);
    lastLogin.setDate(lastLogin.getDate() + (h % 45) + 1);
    const now = new Date();
    if (lastLogin > now) lastLogin.setTime(joinDate.getTime());

    return {
      uid: buildRealisticMemberUid(email),
      email,
      name: item.name,
      displayName: item.name,
      phone: item.phone,
      loginMethod,
      isActive: true,
      agreeTerms: true,
      agreePrivacy: true,
      agreeMarketing: h % 4 === 0,
      loginCount,
      _phReportSeed: true,
      createdAt: joinDate,
      updatedAt: lastLogin,
      lastLogin
    };
  }

  function collectUsedMemberSets(users) {
    const names = new Set();
    const emails = new Set();
    const phones = new Set();
    (users || []).forEach((user) => {
      const data = user.data ? user.data() : user;
      const n1 = normalizeMemberName(data.name);
      const n2 = normalizeMemberName(data.displayName);
      if (n1) names.add(n1);
      if (n2) names.add(n2);
      const em = normalizeMemberEmail(data.email);
      if (em) emails.add(em);
      const ph = normalizeMemberPhone(data.phone);
      if (ph) phones.add(ph);
    });
    return { names, emails, phones };
  }

  function countRealAndSeedUsers(users) {
    let realCount = 0;
    let seedCount = 0;
    (users || []).forEach((user) => {
      const data = user.data ? user.data() : user;
      if (isReportSeedUser(data)) seedCount++;
      else realCount++;
    });
    return { realCount, seedCount, totalCount: realCount + seedCount };
  }

  function resolveTargetTotal(options) {
    if (options.targetTotal != null && options.targetTotal > 0) return options.targetTotal;
    if (typeof options.getReportMemberTarget === 'function') {
      const fixed = options.getReportMemberTarget();
      if (fixed > 0) return fixed;
    }
    if (typeof options.getReportMemberCount === 'function') {
      return options.getReportMemberCount(options.realCount || 0);
    }
    return Math.round((options.realCount || 0) * 1.82);
  }

  function getUserCreatedTime(user) {
    const data = user && typeof user.data === 'function' ? user.data() : user;
    const v = data && (data.createdAt || data.joinDate || data.updatedAt);
    if (!v) return 0;
    if (v instanceof Date) return v.getTime();
    if (typeof v.toDate === 'function') return v.toDate().getTime();
    if (v.seconds) return v.seconds * 1000;
    const t = new Date(v).getTime();
    return isNaN(t) ? 0 : t;
  }

  function listTrimSeedUserIds(users, targetTotal) {
    const all = (users || []).map((user) => {
      const data = user && typeof user.data === 'function' ? user.data() : user;
      const id = user.id || user.docId || data.id;
      return { id, data, createdAt: getUserCreatedTime(user) };
    }).filter((u) => u.id);

    const total = all.length;
    if (total <= targetTotal) return [];

    const seeds = all
      .filter((u) => isReportSeedUser(u.data))
      .sort((a, b) => b.createdAt - a.createdAt);

    const removeCount = Math.min(total - targetTotal, seeds.length);
    return seeds.slice(0, removeCount).map((u) => u.id);
  }

  function planReportMemberSeeds(options) {
    const {
      realCount,
      totalCount,
      usedSets,
      launchStr,
      endStr
    } = options;

    const targetTotal = resolveTargetTotal({ ...options, realCount });
    const trimIds = listTrimSeedUserIds(options.users || [], targetTotal);
    const projectedTotal = totalCount - trimIds.length;
    const need = Math.max(0, targetTotal - projectedTotal);
    if (need <= 0 && !trimIds.length) {
      return { need: 0, trimIds, targetTotal, queue: [] };
    }

    const usedNames = new Set(usedSets.names || []);
    const usedEmails = new Set(usedSets.emails || []);
    const usedPhones = new Set(usedSets.phones || []);
    const queue = [];

    for (let i = 0; i < need; i++) {
      const picked = pickReportSeedName(totalCount + i, usedNames);
      let email = buildReportSeedEmail(totalCount + i + 1, picked.key);
      let emailKey = normalizeMemberEmail(email);
      let bump = 0;
      while (usedEmails.has(emailKey) && bump < 100) {
        bump++;
        email = buildReportSeedEmail(totalCount + i + 1 + bump * 997, picked.key);
        emailKey = normalizeMemberEmail(email);
      }
      const phone = buildReportSeedPhone(`${picked.key}_${totalCount + i}`, usedPhones);
      const joinDate = buildReportSeedJoinDate(i, need, launchStr, endStr);

      queue.push({
        index: totalCount + i + 1,
        name: picked.name,
        email,
        phone,
        joinDate
      });

      usedNames.add(picked.key);
      usedEmails.add(emailKey);
      usedPhones.add(normalizeMemberPhone(phone));
    }

    return { need, trimIds, targetTotal, queue };
  }

  const api = {
    REPORT_SEED_FIRST_NAMES,
    REPORT_SEED_LAST_NAMES,
    normalizeMemberName,
    normalizeMemberEmail,
    normalizeMemberPhone,
    memberSeedHash,
    isReportSeedUser,
    buildRealisticMemberUid,
    buildReportSeedEmail,
    buildReportSeedPhone,
    buildReportSeedJoinDate,
    pickSeedLoginMethod,
    buildSeedMemberDocument,
    collectUsedMemberSets,
    countRealAndSeedUsers,
    resolveTargetTotal,
    listTrimSeedUserIds,
    planReportMemberSeeds,
    formatDateYmd,
    parseDateYmd
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.MetricsMemberSeed = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : global);

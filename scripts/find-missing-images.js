/**
 * 누락 37개 제품 Wikimedia 검색
 */
'use strict';

const MISSING = {
  '가정용 자동 휴지통': { q: 'automatic sensor trash can', kw: ['trash', 'bin', 'waste', 'sensor'] },
  '가정용 전동 휴지통': { q: 'touchless waste bin', kw: ['trash', 'bin', 'waste'] },
  '무선 바코드 스캐너': { q: 'barcode scanner handheld', kw: ['barcode', 'scanner'] },
  '무선 전동 분무기': { q: 'electric garden sprayer', kw: ['spray', 'sprayer'] },
  '무선 전동 커튼 모터': { q: 'motorized curtain track', kw: ['curtain', 'motor', 'track', 'blind'] },
  '스마트 택배 저울': { q: 'postal shipping scale', kw: ['scale', 'postal', 'shipping', 'parcel'] },
  '스테인리스 선반': { q: 'stainless steel shelf rack', kw: ['shelf', 'shelv', 'rack', 'stainless'] },
  '업소용 반죽 발효기': { q: 'dough proofer cabinet', kw: ['dough', 'proof', 'proofer', 'ferment'] },
  '업소용 전기 찜기': { q: 'electric food steamer', kw: ['steam', 'steamer'] },
  '업소용 전기포트': { q: 'commercial electric kettle urn', kw: ['kettle', 'boiler', 'urn', 'water'] },
  '업소용 초음파 세척기': { q: 'ultrasonic cleaner bath', kw: ['ultrasonic', 'sonic', 'clean'] },
  '업소용 컵 워머': { q: 'electric mug warmer', kw: ['warmer', 'mug', 'cup'] },
  '음식물 처리기': { q: 'garbage disposal kitchen sink', kw: ['dispos', 'garbage', 'waste'] },
  '이동식 미니 냉동고': { q: 'chest freezer', kw: ['freezer', 'freez', 'chest'] },
  '이동식 저온 저장고': { q: 'commercial chest freezer', kw: ['freezer', 'cold', 'chest'] },
  '자동 고양이 급식기': { q: 'automatic cat feeder', kw: ['feeder', 'cat', 'pet', 'food'] },
  '자동 급수 화분': { q: 'self watering plant pot', kw: ['water', 'pot', 'planter', 'plant'] },
  '자동 손목 혈압계': { q: 'wrist blood pressure monitor', kw: ['blood', 'pressure', 'wrist', 'bp'] },
  '자동 향 분사 디퓨저': { q: 'aroma diffuser machine', kw: ['diffus', 'aroma', 'scent', 'freshen'] },
  '전동 네일 집진기': { q: 'nail dust collector manicure', kw: ['nail', 'dust', 'vacuum', 'manicure'] },
  '전동 리프트 작업대': { q: 'scissor lift table', kw: ['lift', 'scissor', 'table', 'platform'] },
  '전동 와인 오프너': { q: 'electric wine opener', kw: ['wine', 'cork', 'opener'] },
  '전동 이동식 모니터 거치대': { q: 'monitor arm desk mount', kw: ['monitor', 'mount', 'arm', 'stand'] },
  '전동 커튼 레일': { q: 'motorized curtain rail', kw: ['curtain', 'rail', 'motor', 'track'] },
  '접이식 캠핑 테이블': { q: 'folding camping table', kw: ['table', 'camp', 'fold'] },
  '접이식 핸드카트': { q: 'folding hand truck dolly', kw: ['cart', 'truck', 'dolly', 'trolley', 'hand'] },
  '주방용 세척 자동 분사기': { q: 'kitchen faucet pull sprayer', kw: ['faucet', 'spray', 'sink', 'kitchen'] },
  '차량용 냉장고': { q: '12v car refrigerator', kw: ['fridge', 'refrigerat', 'car', 'cooler'] },
  '피부 확대 진단 카메라': { q: 'dermatoscope skin', kw: ['derma', 'skin', 'microscope'] },
  '휴대용 공기압 주입기': { q: 'portable tire inflator', kw: ['inflat', 'tire', 'compressor', 'pump'] },
  '휴대용 모니터': { q: 'portable usb monitor', kw: ['monitor', 'display', 'portable'] },
  '휴대용 전기 해먹 스탠드': { q: 'hammock stand frame', kw: ['hammock', 'stand', 'frame'] },
  '휴대용 접이식 의자': { q: 'folding camping chair', kw: ['chair', 'fold', 'camp'] },
  '휴대용 초음파 세척기': { q: 'ultrasonic jewelry cleaner', kw: ['ultrasonic', 'sonic', 'clean'] },
  'LED 작업등': { q: 'LED work light lamp', kw: ['led', 'lamp', 'light', 'work'] },
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function score(title, kw) {
  const t = title.toLowerCase();
  if (/\.(svg|gif|webm|djvu|pdf)(\?|$)/i.test(t)) return -1;
  if (/\b(person|portrait|wedding|logo|map|diagram|chart|flag)\b/i.test(t)) return -1;
  let s = 0;
  for (const k of kw) {
    if (t.includes(k)) s++;
  }
  return s;
}

async function search(product, cfg) {
  const api =
    'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*' +
    '&prop=imageinfo&iiprop=url|mime&iiurlwidth=800' +
    '&generator=search&gsrsearch=' + encodeURIComponent(cfg.q) +
    '&gsrnamespace=6&gsrlimit=20';
  const res = await fetch(api, { headers: { 'User-Agent': 'PriceHunter/1.0' } });
  if (!res.ok) return null;
  const data = await res.json();
  let best = null;
  let bestScore = 0;
  for (const p of Object.values(data.query?.pages || {})) {
    const title = (p.title || '').replace(/^File:/i, '');
    const mime = p.imageinfo?.[0]?.mime || '';
    if (!/^image\/(jpeg|jpg|png|webp)/i.test(mime)) continue;
    const s = score(title, cfg.kw);
    if (s > bestScore) {
      bestScore = s;
      best = {
        file: title,
        url: p.imageinfo[0].thumburl || p.imageinfo[0].url,
        score: s,
      };
    }
  }
  return bestScore >= 1 ? best : null;
}

(async () => {
  const out = {};
  for (const [product, cfg] of Object.entries(MISSING)) {
    try {
      const hit = await search(product, cfg);
      out[product] = hit;
      console.log(hit ? `OK  ${product} => ${hit.file}` : `FAIL ${product}`);
    } catch (e) {
      console.log(`ERR ${product}: ${e.message}`);
    }
    await sleep(6000);
  }
  console.log('\n--- RESULT JSON ---');
  const curated = {};
  for (const [k, v] of Object.entries(out)) {
    if (v) curated[k] = v.url || v.file;
  }
  console.log(JSON.stringify(curated, null, 2));
})();

/**
 * more-reviews 제품 이미지 수집 (Unsplash · Wikimedia)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const OUT_DIR = path.join(__dirname, '..', 'assets', 'review-products');
const MANIFEST_PATH = path.join(OUT_DIR, 'manifest.json');

const SKIP = new Set([
  '30pcs 공구 세트', '4인용 가정 테이블 의자 세트', '거실 테이블',
  '귀멸의 칼날 어드벤트 캘린더', '납땜 보저 통신기', '벽걸이 접이식 사다리',
  '북유럽 아동 화장대 아이방인테리어가구 전신거울', '샤오미 전기난로 4세대 미지아 라디에이터',
  '슈퍼싱글 원목 침대 프레임', '아이화장대 메이크업 놀이 세트', '야외용 파라솔테이블 세트',
  '유니캐슬간이화장대', '회전 책장 거울 수납장',
]);

/** 검증된 Unsplash photo-id */
const U = {
  kitchen1: '1556911220-bff31c812dba',
  kitchen2: '1517668808822-9ebb02f2a0e6',
  grill: '1465101046530-73398c7f28ca',
  electronics1: '1498049794561-7780e7231661',
  electronics2: '1519125323398-675f0ddb6308',
  computer: '1591488320449-011701bb6704',
  appliance: '1558618666-fcd25c85cd64',
  furniture: '1555041469-a586c61ea9bc',
  bag: '1548036328-c9fa89d128fa',
  fitness: '1571019613454-1cb2f99b2d8b',
  watch: '1503602642458-232111445657',
  plant: '1416879595882-3373a0480b5b',
  scale: '1523275335684-37898b6baf30',
  kiosk: '1556742049-0cfed4f6a45d',
  projector: '1593784991095-a205069470b6',
};

const WIKI_QUERY = {
  '업소용 전기포트': 'electric kettle',
  '가정용 로봇청소기': 'robot vacuum cleaner',
  'RTX 5080 그래픽카드': 'graphics card',
  'DDR5 16GB 램': 'DDR4 RAM',
  '적외선 야외 수평기': 'laser level tool',
  '적외선 야외 체크용 수평기': 'laser level',
  '소형 레이저 각인기': 'laser engraving machine',
  '전동 드라이버 세트': 'cordless drill',
  '공업 용접 헬멧': 'welding helmet',
  '농업용 방제 드론': 'agricultural drone',
  '무선 CCTV 카메라': 'surveillance camera',
  '고압 세척기': 'pressure washer',
  '소형 CNC 조각기': 'CNC router',
  '산업용 열화상 카메라': 'thermal camera',
  '스마트 도어락': 'electronic door lock',
  '블루투스 스피커': 'bluetooth speaker',
  '가정용 런닝머신': 'treadmill',
  '가정용 금고': 'safe box',
  '미니 빔프로젝터': 'projector',
};

function hashIdx(str, len) {
  const h = crypto.createHash('md5').update(str).digest();
  return h[0] % len;
}

function categorize(name) {
  if (/램|그래픽|CCTV|모니터|프로젝터|카메라|스피커|도어락|도어벨|키오스크|메뉴판|전자칠판|온습도|체중계|저울|바코드|프레젠터|교환기|마이크|파워뱅크|라벨/.test(name)) return 'electronics';
  if (/전기포트|블렌더|찜기|제빙|진공포장|세척|분사|컵 워머|음식물|쌀통|주방|업소용/.test(name)) return 'kitchen';
  if (/런닝|스텝퍼|마사지|해먹/.test(name)) return 'fitness';
  if (/침대|테이블|의자|선반|커튼|책상|화장대|거실/.test(name)) return 'furniture';
  if (/드라이버|용접|CNC|레이저|공구|타공|집진|세척기|송풍기|작업대|압축|드론|수평기/.test(name)) return 'tools';
  if (/로봇청소|가습|서큘레이터|라디에이터|냉동|건조|제빙|온수|산소|공기/.test(name)) return 'appliance';
  if (/화분|재배등|급식|반려|고양이/.test(name)) return 'plant';
  return 'electronics';
}

function unsplashFor(product) {
  const cat = categorize(product);
  const pools = {
    kitchen: [U.kitchen1, U.kitchen2, U.grill],
    electronics: [U.electronics1, U.electronics2, U.computer, U.watch, U.kiosk],
    fitness: [U.fitness, U.appliance],
    furniture: [U.furniture, U.bag],
    tools: [U.electronics1, U.appliance, U.kitchen2],
    appliance: [U.appliance, U.kitchen1],
    plant: [U.plant, U.furniture],
  };
  const pool = pools[cat] || pools.electronics;
  return unsplashUrl(pool[hashIdx(product, pool.length)]);
}

function unsplashUrl(id) {
  return `https://images.unsplash.com/photo-${id}?w=800&h=600&fit=crop&q=85&auto=format`;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function wikiImage(query) {
  const api =
    'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*' +
    '&prop=imageinfo&iiprop=url&iiurlwidth=800' +
    '&generator=search&gsrsearch=' + encodeURIComponent(query) +
    '&gsrnamespace=6&gsrlimit=8';
  const res = await fetch(api, { headers: { 'User-Agent': 'PriceHunter/1.0' } });
  const data = await res.json();
  for (const p of Object.values(data.query?.pages || {})) {
    const url = p.imageinfo?.[0]?.thumburl || p.imageinfo?.[0]?.url;
    if (url && /\.(jpe?g|png|webp)(\?|$)/i.test(url)) return url;
  }
  return null;
}

async function download(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'PriceHunter/1.0' }, redirect: 'follow' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1200) throw new Error('too small');
  return buf;
}

async function resolveUrl(product) {
  const q = WIKI_QUERY[product];
  if (q) {
    const w = await wikiImage(q);
    if (w) return { url: w, via: 'wikimedia' };
    await sleep(250);
  }
  return { url: unsplashFor(product), via: 'unsplash' };
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const entries = Object.entries(manifest.files || {}).filter(([p]) => !SKIP.has(p));
  const sources = {};

  let ok = 0;
  let fail = 0;

  for (const [product, filename] of entries) {
    const out = path.join(OUT_DIR, filename);
    const force = process.argv.includes('--force');
    if (!force && fs.existsSync(out) && fs.statSync(out).size > 8000) {
      ok++;
      continue;
    }

    process.stdout.write(product.slice(0, 20) + '… ');
    try {
      const { url, via } = await resolveUrl(product);
      const buf = await download(url);
      fs.writeFileSync(out, buf);
      sources[product] = { via, url };
      console.log('✓');
      ok++;
    } catch (e) {
      try {
        const buf = await download(unsplashUrl(U.electronics1));
        fs.writeFileSync(out, buf);
        sources[product] = { via: 'unsplash-fallback', url: unsplashUrl(U.electronics1) };
        console.log('✓ fb');
        ok++;
      } catch {
        console.log('✗', e.message);
        fail++;
      }
    }
    await sleep(180);
  }

  fs.writeFileSync(path.join(OUT_DIR, 'IMAGE_SOURCES.json'), JSON.stringify(sources, null, 2) + '\n');
  const n = fs.readdirSync(OUT_DIR).filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f)).length;
  console.log(`\n이미지 파일 ${n}개 / 대상 ${entries.length}개, 실패 ${fail}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

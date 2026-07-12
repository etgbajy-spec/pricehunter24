/**
 * more-reviews 제품 이미지 — 검증된 curated URL만 사용
 * 실행: node scripts/download-review-product-images.js --force
 */
'use strict';

const fs = require('fs');
const path = require('path');
const CURATED = require('./review-product-curated-urls');
const OPENVERSE_TITLES = new Set([
  'Beautyrest Heated Electric Mattress Pad',
  'Portable ice maker on the kitchen counter',
  'Handheld Vacuum, ONSON Hand Vacuum Cleaner Cordless with 14.8V Li-ion Battery, 7Kpa Powerful Rechargeable Wet Dry Vacuum for Cars, Furniture Stairs and Pet Hairs',
  'What Is an Impulse Sealer?',
  'Router table for Dewalt D26204-QS CNC and 3D print',
  'blender with ingredients for spicy buffalo chicken nachos on a kitchen counter next to a bottle of wine and cooking utensils',
  'VacMaster VP215 Chamber Vacuum Sealer',
  '20130617-cut_drill_light',
]);

const OUT_DIR = path.join(__dirname, '..', 'assets', 'review-products');
const MANIFEST_PATH = path.join(OUT_DIR, 'manifest.json');

const SKIP = new Set([
]);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function apiGet(url, retries = 4) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, { headers: { 'User-Agent': 'PriceHunter/1.0' } });
    if (res.status === 429) {
      await sleep(5000 * (i + 1));
      continue;
    }
    if (!res.ok) return null;
    return res.json();
  }
  return null;
}

async function searchOpenverse(title) {
  const api =
    'https://api.openverse.org/v1/images/?q=' +
    encodeURIComponent(title.slice(0, 80)) +
    '&page_size=5&license_type=commercial,modification';
  const data = await apiGet(api);
  const hit = (data?.results || []).find((r) => (r.title || '').includes(title.slice(0, 30)));
  return hit?.url || hit?.thumbnail || null;
}

async function resolveUrl(product, fileOrTitle) {
  if (/^https?:\/\//i.test(fileOrTitle)) {
    return { url: fileOrTitle, title: fileOrTitle, via: 'direct' };
  }
  if (OPENVERSE_TITLES.has(fileOrTitle)) {
    const ov = await searchOpenverse(fileOrTitle);
    if (ov) return { url: ov, title: fileOrTitle, via: 'openverse' };
  }

  const api =
    'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*' +
    '&prop=imageinfo&iiprop=url|mime&iiurlwidth=900' +
    '&titles=File:' + encodeURIComponent(fileOrTitle);
  const data = await apiGet(api);
  const page = Object.values(data?.query?.pages || {})[0];
  if (page?.missing !== undefined) return null;
  const info = page?.imageinfo?.[0];
  if (!info?.thumburl && !info?.url) return null;
  return {
    url: info.thumburl || info.url,
    title: fileOrTitle,
    via: 'wikimedia',
  };
}

function isImage(buf) {
  if (buf.length < 2000) return false;
  if (buf[0] === 0xff && buf[1] === 0xd8) return true;
  if (buf[0] === 0x89 && buf[1] === 0x50) return true;
  return false;
}

async function download(url) {
  for (let i = 0; i < 5; i++) {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'PriceHunter/1.0' },
      redirect: 'follow',
    });
    if (res.status === 429) {
      await sleep(4000 * (i + 1));
      continue;
    }
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const buf = Buffer.from(await res.arrayBuffer());
    if (!isImage(buf)) throw new Error('invalid image');
    return buf;
  }
  throw new Error('HTTP 429');
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7);
  let entries = Object.entries(manifest.files || {}).filter(([p]) => !SKIP.has(p));
  if (only) entries = entries.filter(([p]) => p.includes(only));
  const force = process.argv.includes('--force');
  const missingOnly = process.argv.includes('--missing-only');
  const sourcesPath = path.join(OUT_DIR, 'IMAGE_SOURCES.json');
  const sources = fs.existsSync(sourcesPath)
    ? JSON.parse(fs.readFileSync(sourcesPath, 'utf8'))
    : {};
  let ok = 0;
  let fail = 0;
  let skip = 0;

  for (const [product, filename] of entries) {
    const out = path.join(OUT_DIR, filename);
    const curated = CURATED[product];

    if (!curated) {
      if (fs.existsSync(out)) fs.unlinkSync(out);
      console.log(product.slice(0, 22).padEnd(24), '⊘ curated 없음 (기존 이미지 삭제)');
      skip++;
      continue;
    }

    const hasValid = fs.existsSync(out) && fs.statSync(out).size > 8000;
    if (missingOnly && hasValid) {
      ok++;
      continue;
    }
    if (!force && hasValid) {
      ok++;
      continue;
    }

    process.stdout.write(product.slice(0, 22).padEnd(24));
    try {
      const hit = await resolveUrl(product, curated);
      if (!hit) throw new Error('파일 없음: ' + curated.slice(0, 40));
      const buf = await download(hit.url);
      fs.writeFileSync(out, buf);
      sources[product] = { ...hit, product, curated };
      console.log(`✓ ${hit.via} | ${hit.title.slice(0, 50)}`);
      ok++;
    } catch (e) {
      console.log(`✗ ${e.message}`);
      fail++;
    }
    await sleep(4000);
  }

  fs.writeFileSync(sourcesPath, JSON.stringify(sources, null, 2) + '\n');
  console.log(`\n완료: 성공 ${ok}, 실패 ${fail}, curated없음 ${skip}`);
  if (fail > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

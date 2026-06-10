/**
 * 제품별 Wikimedia 파일명 탐색 (느리게, 1건씩)
 * node scripts/build-curated-list.js
 */
'use strict';
const CONFIG = require('./review-product-search-config');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function findFile(query, primary, reject = []) {
  const api =
    'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*' +
    '&prop=imageinfo&iiprop=mime&generator=search&gsrsearch=' +
    encodeURIComponent(query) + '&gsrnamespace=6&gsrlimit=25';
  const res = await fetch(api, { headers: { 'User-Agent': 'PriceHunter/1.0' } });
  if (!res.ok) return null;
  const data = await res.json();
  for (const p of Object.values(data.query?.pages || {})) {
    const title = (p.title || '').replace(/^File:/i, '');
    const t = title.toLowerCase();
    const mime = p.imageinfo?.[0]?.mime || '';
    if (!/^image\/(jpeg|jpg|png|webp)/i.test(mime)) continue;
    if (/\.(svg|gif|webm|djvu)/i.test(title)) continue;
    if (reject.some((r) => t.includes(r.toLowerCase()))) continue;
    if (primary.some((kw) => t.includes(kw.toLowerCase()))) return title;
  }
  return null;
}

(async () => {
  const out = {};
  for (const [product, cfg] of Object.entries(CONFIG)) {
    let file = null;
    for (const q of cfg.queries) {
      file = await findFile(q, cfg.primary, cfg.reject || []);
      if (file) break;
      await sleep(5000);
    }
    out[product] = file;
    console.log(file ? 'OK' : 'FAIL', product, file || '');
    await sleep(5000);
  }
  console.log('\nmodule.exports =', JSON.stringify(out, null, 2));
})();

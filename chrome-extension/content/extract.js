/**
 * 상품 페이지 DOM → PriceHunter 의뢰 데이터 추출
 */
(function () {
  'use strict';

  var PH = globalThis.PH_EXTENSION;

  function textOf(selectors, root) {
    root = root || document;
    var list = Array.isArray(selectors) ? selectors : [selectors];
    for (var i = 0; i < list.length; i++) {
      var el = root.querySelector(list[i]);
      if (el && el.textContent) {
        var t = el.textContent.replace(/\s+/g, ' ').trim();
        if (t) return t;
      }
    }
    return '';
  }

  function metaContent(name) {
    var el = document.querySelector('meta[property="' + name + '"], meta[name="' + name + '"]');
    return el ? (el.getAttribute('content') || '').trim() : '';
  }

  function cleanTitle(raw) {
    return String(raw || '')
      .replace(/\s+/g, ' ')
      .replace(/^(G마켓|지마켓|옥션|Auction|Gmarket)\s*[-–—|:]\s*/i, '')
      .replace(/\s*[-|:]\s*(쿠팡|Coupang|로켓배송|네이버|Naver|스마트스토어|11번가|G마켓|옥션).*$/i, '')
      .trim()
      .slice(0, 200);
  }

  function sanitizeCoupangTitle(raw) {
    var title = cleanCoupangOgTitle(raw);
    if (!title) return '';
    return title.replace(/\s{2,}/g, ' ').trim().slice(0, 200);
  }

  function optionBelongsToProduct(option, title) {
    if (!option || !title) return true;
    if (/^[가-힣A-Za-z][가-힣A-Za-z0-9\s]{1,16}\s*[:：]/.test(option)) return true;
    if (option.length < 40) return true;

    var o = option.replace(/\s+/g, '');
    var chunks = title.match(/[\uAC00-\uD7A3]{4,}/g) || [];
    for (var i = 0; i < chunks.length; i++) {
      if (o.indexOf(chunks[i]) >= 0) return true;
    }

    var titleBrand = title.match(/^[\uAC00-\uD7A3]{2,}/);
    var optionBrand = option.match(/^[\uAC00-\uD7A3]{2,}/);
    if (titleBrand && optionBrand && titleBrand[0] !== optionBrand[0]) return false;

    return option.length < 50;
  }

  function isCoupangAttributeLabel(label) {
    return /^(가위용도|바퀴\s*유무|색상|사이즈|모델|용량|구성|엔진|수량|배터리|스펙|옵션|타입|종류|세트|용도|재질|전압|출력|마력|폭|길이|두께|규격|사이즈|형태)$/i.test(
      String(label || '').replace(/\s+/g, ' ').trim()
    );
  }

  function extractCoupangAttributePairs(text) {
    var pairs = [];
    var seen = {};
    var lines = String(text || '').split(/\n+/);

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].replace(/\s+/g, ' ').trim();
      var m = line.match(/^([가-힣A-Za-z][가-힣A-Za-z0-9\s]{1,18})\s*[:：]\s*(.+)$/);
      if (!m) continue;

      var label = m[1].trim();
      var value = m[2].trim();
      if (!value || value.length > 80) continue;
      if (/쿠팡상품번호|배송사|판매자|장바구니|바로구매|도착\s*예정/i.test(label + ' ' + value)) continue;
      if (/^수량$/.test(label) && /^\d+$/.test(value)) continue;
      if (!isCoupangAttributeLabel(label) && !isCoupangOptionLabel(label)) continue;

      var key = label + ':' + value;
      if (seen[key]) continue;
      seen[key] = true;
      pairs.push({ label: label, value: value });
    }
    return pairs;
  }

  function formatCoupangAttributePairs(pairs) {
    if (!pairs || !pairs.length) return '';
    return pairs.map(function (p) { return p.label + ': ' + p.value; }).join(' / ').slice(0, 300);
  }

  function extractCoupangOptionsUniversal(ctx, productTitle) {
    productTitle = productTitle || ctx.productTitle || extractCoupangPrimaryH1() || '';
    var buyZone = ctx.buyZoneText || '';
    var candidates = [];

    function pushOption(text, weight, source) {
      text = String(text || '').replace(/\s+/g, ' ').trim();
      if (!text || text.length < 2) return;
      if (!optionBelongsToProduct(text, productTitle)) return;
      if (isWrongRelatedProductTitle(text) || isCoupangDimensionNoise(text)) return;
      if (text.length > 120 && !/[×x]/.test(text) && text.indexOf(':') < 0) return;
      candidates.push({ text: text, weight: weight, source: source });
    }

    var attrs = extractCoupangAttributePairs(buyZone);
    if (attrs.length) {
      pushOption(formatCoupangAttributePairs(attrs), 220, 'attributes');
    }

    try {
      var composite = extractCoupangCompositeDropdownSelected();
      if (composite) pushOption(composite, 200, 'composite-dropdown');
    } catch (e) { /* ignore */ }

    try {
      collectCoupangDropdownValues(getCoupangOptionRoot()).forEach(function (v) {
        var cleaned = finalizeCoupangOption(v) || normalizeCoupangOptionRaw(v);
        if (cleaned) pushOption(cleaned, 170, 'dropdown');
      });
    } catch (e) { /* ignore */ }

    try {
      var fromNext = extractCoupangOptionFromNextData();
      if (fromNext) pushOption(fromNext, 120, 'next-data');
    } catch (e) { /* ignore */ }

    if (!candidates.length) return '';

    candidates.sort(function (a, b) { return b.weight - a.weight; });
    return candidates[0].text;
  }

  function titleInPanelTop(title, panelText) {
    if (!title || !panelText) return false;
    var head = panelText.slice(0, 2500);
    var probe = title.slice(0, Math.min(24, title.length));
    if (probe.length >= 8 && head.indexOf(probe) >= 0) return true;
    var shortProbe = title.slice(0, Math.min(12, title.length));
    return shortProbe.length >= 6 && head.indexOf(shortProbe) >= 0;
  }

  function extractCoupangPrimaryH1() {
    var selectors = [
      '#sdpContent h1',
      'main h1',
      'h1.prod-buy-header__title',
      '.prod-buy-header__title',
      '[class*="product-title"] h1',
      'h1[class*="product"]',
      'h1[class*="title"]'
    ];
    var skip = '[class*="review"], [class*="Review"], [class*="related"], [class*="recommend"], ' +
      '[class*="sdp-review"], footer, [class*="breadcrumb"], [class*="also-bought"]';

    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (!el || el.closest(skip)) continue;
      var t = sanitizeCoupangTitle(el.textContent);
      if (t && !isBadTitle(t) && /[가-힣]/.test(t) && t.length >= 8) return t;
    }

    var h1s = document.querySelectorAll('h1');
    for (var j = 0; j < h1s.length; j++) {
      var h = h1s[j];
      if (h.closest(skip)) continue;
      var t2 = sanitizeCoupangTitle(h.textContent);
      if (t2 && !isBadTitle(t2) && t2.length >= 8) return t2;
    }
    return '';
  }

  function collectCoupangTitleSignals(ctx) {
    var signals = [];
    var seen = {};

    function add(title, weight, source) {
      title = sanitizeCoupangTitle(title);
      if (!title || isBadTitle(title) || seen[title]) return;
      seen[title] = true;
      var w = weight;
      if (ctx.panelText && titleInPanelTop(title, ctx.panelText)) w += 55;
      else if (ctx.panelText) w = Math.round(w * 0.12);
      signals.push({ title: title, weight: w, source: source });
    }

    add(extractCoupangPrimaryH1(), 130, 'primary-h1');
    try { add(extractCoupangFromNextData().title, 105, 'next-data'); } catch (e) { /* ignore */ }
    add(cleanCoupangOgTitle(metaContent('og:title')), 75, 'og');
    add(cleanCoupangOgTitle(document.title), 60, 'document-title');
    add(extractCoupangTitleFromVisibleDom(), 40, 'visible-dom');

    return signals;
  }

  function resolveCoupangTitle(signals) {
    if (!signals || !signals.length) return '';
    signals.sort(function (a, b) { return b.weight - a.weight; });
    return signals[0].title;
  }

  function firstPriceMatch(text, patterns) {
    for (var i = 0; i < patterns.length; i++) {
      var m = text.match(patterns[i]);
      if (m && m[1]) {
        var p = PH.normalizePrice(m[1]);
        if (p) return p;
      }
    }
    return null;
  }

  function unescapeJsonString(str) {
    try {
      return JSON.parse('"' + String(str).replace(/\\/g, '\\\\') + '"');
    } catch (e) {
      return String(str || '').replace(/\\"/g, '"').replace(/\\n/g, ' ');
    }
  }

  var BAD_TITLE_RE = /추천\s*상품|관련\s*상품|인기\s*상품|베스트\s*상품|최근\s*본|함께\s*보면|다른\s*고객/i;
  var MAX_COUPANG_OPTION_SCAN = 250;

  function forEachDeepElements(root, selector, callback, limit) {
    var count = 0;
    function walk(node) {
      if (!node || count >= limit) return;
      if (node.nodeType !== 1) return;
      if (node.matches && node.matches(selector)) {
        callback(node);
        count++;
        if (count >= limit) return;
      }
      if (node.shadowRoot) walk(node.shadowRoot);
      var children = node.children || [];
      for (var i = 0; i < children.length; i++) {
        walk(children[i]);
        if (count >= limit) return;
      }
    }
    walk(root || document.body);
  }

  function queryDeepAll(selector, root, limit) {
    var out = [];
    forEachDeepElements(root, selector, function (el) { out.push(el); }, limit || 200);
    return out;
  }

  function isGenericMallTitle(text) {
    var t = String(text || '').replace(/\s+/g, ' ').trim();
    if (!t) return true;
    if (/^(products|product|vp|item|goods|쿠팡|상품)$/i.test(t)) return true;
    if (/^(G마켓|지마켓|옥션|Auction|Gmarket|쿠팡|Coupang|네이버|Naver|11번가|스마트스토어)\s*상품$/i.test(t)) {
      return true;
    }
    if (/^(G마켓|지마켓|옥션|Auction|Gmarket|쿠팡|Coupang|네이버|Naver|11번가|스마트스토어)$/i.test(t)) {
      return true;
    }
    return false;
  }

  function isBadTitle(text) {
    var t = String(text || '').trim();
    if (!t || t.length < 6) return true;
    if (isGenericMallTitle(t)) return true;
    if (/^https?:\/\//i.test(t)) return true;
    return BAD_TITLE_RE.test(t);
  }

  function pickFirstGoodTitle(candidates) {
    for (var i = 0; i < candidates.length; i++) {
      var t = cleanTitle(candidates[i]);
      if (t && !isBadTitle(t)) return t;
    }
    return '';
  }

  function extractCoupangTitleFromVisibleDom() {
    var roots = [getCoupangBuyPanel(), getCoupangAtfRoot(), document.querySelector('main'), document.body];
    var seen = {};
    var candidates = [];

    function consider(el, t) {
      t = cleanTitle(t);
      if (!t || isBadTitle(t) || !/[가-힣]/.test(t) || t.length < 8) return;
      if (seen[t]) return;
      seen[t] = true;
      var score = t.length;
      if (el.tagName === 'H1') score += 50;
      if (el.closest('.prod-buy, .prod-atf, .prod-atf-contents, main, [class*="product"], [class*="Product"]')) {
        score += 30;
      }
      candidates.push({ t: t, score: score });
    }

    roots.forEach(function (root) {
      if (!root) return;
      queryDeepAll('h1, h2, [class*="title"], [class*="Title"]', root, 80).forEach(function (el) {
        if (el.closest('nav, footer, [class*="review"], [class*="Review"], [class*="related"], [class*="breadcrumb"]')) {
          return;
        }
        consider(el, el.textContent);
      });
    });

    if (!candidates.length) return '';
    candidates.sort(function (a, b) { return b.score - a.score; });
    return candidates[0].t;
  }

  function extractCoupangPriceFromVisibleDom(buyRoot) {
    buyRoot = buyRoot || getCoupangBuyPanel();
    var candidates = [];
    var scored = [];

    function consider(el) {
      if (isStrikethroughPrice(el)) return;
      var raw = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!raw || raw.length > 28) return;
      if (/쿠폰|개당|배송|적립|월\s*\d|할부|%/i.test(raw)) return;
      var p = parseNaverPriceText(raw);
      if (p && isValidNaverPrice(p)) {
        candidates.push(p);
        scored.push({ p: p, score: scoreCoupangPriceElement(el, p) });
      }
    }

    queryDeepAll(
      '[class*="total-price"], [class*="final-price"], [class*="sale-price"], ' +
      '[class*="price"], [class*="Price"], span, strong, em',
      buyRoot,
      300
    ).forEach(consider);

    if (scored.length) {
      scored.sort(function (a, b) { return b.score - a.score; });
      return scored[0].p;
    }
    return pickBestCoupangPrice(candidates);
  }

  function extractCoupangOptionFromVisibleDom() {
    var root = getCoupangOptionRoot();
    var best = '';
    var bestScore = 0;
    var nodes = root.querySelectorAll('button, [role="button"], div, span, p, li');
    var limit = Math.min(nodes.length, MAX_COUPANG_OPTION_SCAN);

    for (var i = 0; i < limit; i++) {
      var el = nodes[i];
      if (!isCoupangOptionPickerEl(el)) continue;
      if (el.children.length > 10) continue;
      var raw = getCoupangTextWithoutMedia(el);
      var value = extractCoupangValueFromCompositeButton(el, raw);
      if (!value) continue;
      if (!looksLikeCoupangDropdownValue(value) && !(/[×x]/.test(value) && /\d+\s*개/.test(value))) continue;

      var score = value.length;
      if (/\d+\s*개/.test(value)) score += 50;
      if (/프리미엄|패키지|풀패키지|행정|휠/i.test(value)) score += 30;
      if (isCoupangCompositeLabelHeader(raw)) score -= 10;
      if (score > bestScore) {
        bestScore = score;
        best = value;
      }
    }

    return best;
  }

  function cleanCoupangOgTitle(title) {
    title = cleanTitle(title);
    if (!title) return '';
    return title
      .replace(/\s*:\s*쿠팡!.*$/i, '')
      .replace(/\s*-\s*쿠팡.*$/i, '')
      .replace(/\s*\|\s*쿠팡.*$/i, '')
      .replace(/\s*-\s*(?:농업용|가전|디지털|생활|주방|스포츠|패션)[^\s-]*$/i, '')
      .trim();
  }

  function pickBestCoupangPrice(candidates) {
    if (!candidates || !candidates.length) return null;
    var valid = candidates.filter(isValidNaverPrice);
    if (!valid.length) return null;
    var major = valid.filter(function (p) { return p >= 10000; });
    var pool = major.length ? major : valid;
    pool.sort(function (a, b) { return b - a; });
    return pool[0];
  }

  function scoreCoupangPriceElement(el, price) {
    var score = Math.min(price / 1000, 400);
    var cls = String((el && el.className) || '');
    var parentCls = el && el.parentElement ? String(el.parentElement.className || '') : '';
    var combined = cls + ' ' + parentCls;
    if (/total|final|sale|prod-price|price-amount/i.test(combined)) score += 200;
    if (/shipping|delivery|배송|rocket-fee|fee/i.test(combined)) score -= 300;
    if (el && el.closest('[class*="total-price"], [class*="final-price"], [class*="sale-price"], .prod-price')) {
      score += 150;
    }
    return score;
  }

  function getCoupangProductId() {
    var m = location.pathname.match(/\/products\/(\d+)/i);
    return m ? m[1] : '';
  }

  function getCoupangVendorItemIdFromDom() {
    var text = document.body ? (document.body.innerText || '') : '';
    var m = text.match(/쿠팡상품번호\s*[:：]\s*(\d+)\s*[-–—]\s*(\d+)/);
    if (m) return m[2];
    m = text.match(/vendorItemId["'\s:=]+(\d{8,})/i);
    if (m) return m[1];
    return '';
  }

  function getCoupangVendorItemId() {
    var m = location.search.match(/[?&]vendorItemId=(\d+)/i);
    if (m) return m[1];
    m = location.pathname.match(/\/products\/\d+\/vendoritems\/(\d+)/i);
    if (m) return m[1];
    return getCoupangVendorItemIdFromDom();
  }

  function getCoupangPanelInnerText() {
    var chunks = [];
    var seen = {};
    var selectors = [
      '#sdpContent',
      '[class*="product-buy"]',
      '[class*="ProductBuy"]',
      '.prod-atf-contents',
      '.prod-buy',
      'main'
    ];

    function pushText(text) {
      text = String(text || '').trim();
      if (!text || text.length < 20 || seen[text]) return;
      seen[text] = true;
      chunks.push(text.slice(0, 6000));
    }

    selectors.forEach(function (sel) {
      var el = document.querySelector(sel);
      if (el && el.innerText) pushText(el.innerText);
    });

    var buy = getCoupangBuyPanel();
    if (buy && buy.innerText) pushText(buy.innerText);

    var h1 = document.querySelector('h1');
    if (h1) {
      var block = h1.closest('#sdpContent, main, [class*="product"], [class*="Product"]') || h1.parentElement;
      for (var d = 0; d < 10 && block; d++) {
        if (block.innerText && block.innerText.length > 80) {
          pushText(block.innerText);
          break;
        }
        block = block.parentElement;
      }
    }

    return chunks.join('\n').slice(0, 12000);
  }

  function getCoupangBuyZoneText() {
    var chunks = [];
    var seen = {};

    function pushText(text) {
      text = String(text || '').trim();
      if (!text || text.length < 10 || seen[text]) return;
      seen[text] = true;
      chunks.push(text);
    }

    var buy = getCoupangBuyPanel();
    if (buy && buy.innerText) pushText(buy.innerText);

    var h1 = document.querySelector('h1');
    if (h1) {
      var region = h1.closest('#sdpContent, [class*="product-buy"], [class*="ProductBuy"], .prod-atf') || h1.parentElement;
      for (var d = 0; d < 8 && region; d++) {
        if (region.innerText && region.innerText.length > 50) {
          var text = region.innerText;
          var cut = text.length;
          var markers = [
            /함께\s*본/i, /추천\s*상품/i, /다른\s*고객/i, /이\s*상품의\s*리뷰/i,
            /상품평/i, /구매\s*후기/i, /Q\s*&\s*A/i
          ];
          for (var mi = 0; mi < markers.length; mi++) {
            var idx = text.search(markers[mi]);
            if (idx > 400) cut = Math.min(cut, idx);
          }
          pushText(text.slice(0, cut).slice(0, 4500));
          break;
        }
        region = region.parentElement;
      }
    }

    return chunks.join('\n').slice(0, 5000);
  }

  function isCoupangDimensionNoise(text) {
    var t = String(text || '');
    if (/\d+\s*cm\s*[×x]\s*\d+\s*m/i.test(t)) return true;
    if (/\d+\s*mm\s*[×x]\s*\d+/i.test(t)) return true;
    if (/제초매트|잡초매트|잡초\s*매트|마대재질|\(마대/i.test(t)) return true;
    if (/매트\s*,\s*\d+\s*개/i.test(t) && !/패키지|프리미엄|행정|휠|풀패키지/i.test(t)) return true;
    return false;
  }

  function isWrongRelatedProductTitle(text) {
    var t = String(text || '').replace(/\s+/g, ' ').trim();
    if (!t || t.length < 4) return true;
    if (isBadTitle(t)) return true;
    if (isCoupangDimensionNoise(t)) return true;
    if (t.length > 70 && !/[×x]/.test(t)) return true;
    if (/\d{4}\s*년\s*신형/i.test(t)) return true;
    if (/[A-Z]{1,4}-\d{3,}[A-Z]?/i.test(t)) return true;
    if (/\d+\.?\d*\s*HP/i.test(t) && !/[×x]/.test(t)) return true;
    if (/\d+\s*인치/i.test(t) && t.length > 28 && !/[×x]/.test(t)) return true;
    if (/혼다|잔디깎이|예초기|로봇청소기|제설기|트랙터/i.test(t) && t.length > 24 && !/[×x]/.test(t)) return true;
    if (/독일기술|자주식|전기식|엔진식/i.test(t) && t.length > 30 && !/[×x]/.test(t)) return true;
    return false;
  }

  function isLikelyCoupangOptionValue(text) {
    var t = String(text || '').replace(/\s+/g, ' ').trim();
    if (!t || t.length < 3) return false;
    if (isWrongRelatedProductTitle(t) || isCoupangDimensionNoise(t)) return false;
    if (isCoupangCompositeLabelHeader(t) || isCoupangOptionLabel(t) || isCoupangOptionNoise(t)) return false;
    if (/[×x]/.test(t) && /\d+\s*개/.test(t) && /패키지|프리미엄|휠|행정|풀패키지|4행정|2종/i.test(t)) return true;
    if (/[×x]/.test(t) && (/\d+\s*개/.test(t) || /패키지|프리미엄|휠|행정|풀패키지/i.test(t))) return true;
    if (t.length <= 80 && /[×x]/.test(t) && !/\d+\s*cm/i.test(t)) return true;
    if (t.length <= 45 && !/\d+\s*cm/i.test(t)) return true;
    if (t.length > 55 && !/[×x]/.test(t)) return false;
    return looksLikeCoupangDropdownValue(t) || looksLikeCoupangOptionValue(t);
  }

  function extractCoupangCompositeDropdownSelected() {
    var root = getCoupangOptionRoot();
    var best = '';
    var bestScore = 0;

    function consider(raw, bonus) {
      if (!raw || !/구성\s*[×x]\s*엔진/i.test(raw)) return;

      var value = extractCoupangValueFromGluedText(raw);
      if (!value) {
        var m = raw.match(/구성\s*[×x]\s*엔진\s*방식\s*[×x]\s*수량\s*([\s\S]+)/i);
        if (m && m[1]) value = cleanCoupangSelectionLine(m[1].trim());
      }
      if (!value) {
        var lines = raw.split(/\n+/).map(function (l) { return l.replace(/\s+/g, ' ').trim(); }).filter(Boolean);
        for (var li = lines.length - 1; li >= 0; li--) {
          if (isCoupangCompositeLabelHeader(lines[li]) || /^구성\s*[×x]\s*엔진/i.test(lines[li])) continue;
          value = cleanCoupangSelectionLine(lines[li]);
          if (value) break;
        }
      }
      if (!value || isCoupangDimensionNoise(value)) return;

      var normalized = normalizeCoupangOptionRaw(value) || finalizeCoupangOption(value);
      if (!normalized || isCoupangDimensionNoise(normalized)) return;

      var score = 200 + bonus + normalized.length;
      if (/패키지|프리미엄|행정|휠|풀패키지/i.test(normalized)) score += 50;
      if (score > bestScore) {
        bestScore = score;
        best = normalized;
      }
    }

    queryDeepAll('button[aria-expanded="false"], [role="combobox"], button, [role="button"], div, span', root, 80)
      .forEach(function (el) {
        if (el.closest('footer, [class*="review"], [class*="related"], [class*="recommend"]')) return;
        consider(getCoupangTextWithoutMedia(el), el.matches && el.matches('button,[role="button"],[role="combobox"]') ? 40 : 10);
      });

    return best;
  }

  function coupangPriceInPanelText(price, panelText) {
    if (!price || !panelText) return false;
    var digits = String(Math.round(price));
    if (panelText.replace(/[^\d]/g, '').indexOf(digits) >= 0) return true;
    return panelText.indexOf(Number(price).toLocaleString('ko-KR')) >= 0;
  }

  function collectCoupangPriceSignals(ctx) {
    var signals = [];
    var panelText = ctx.panelText || '';

    function add(price, weight, source) {
      if (!price || !isValidNaverPrice(price)) return;
      var w = weight;
      if (panelText && coupangPriceInPanelText(price, panelText)) w += 60;
      else if (panelText) w = Math.round(w * 0.25);
      signals.push({ price: price, weight: w, source: source });
    }

    var unitM = panelText.match(/\(1개당\s*([\d,]+)\s*원\)/);
    if (unitM) add(PH.normalizePrice(unitM[1]), 120, 'panel-unit-price');

    var discountM = panelText.match(/\d{1,2}%\s*[\d,]+\s*원\s*([\d,]+)\s*원/);
    if (discountM) add(PH.normalizePrice(discountM[1]), 110, 'panel-after-discount');

    var priceRe = /\d{1,3}(?:,\d{3})+\s*원/g;
    var pm;
    var panelPrices = [];
    while ((pm = priceRe.exec(panelText.slice(0, 3500))) !== null) {
      var pp = PH.normalizePrice(pm[0]);
      if (!isValidNaverPrice(pp) || pp < 10000) continue;
      var nearby = panelText.slice(Math.max(0, pm.index - 24), pm.index + 40);
      if (/쿠폰/.test(nearby) && pp < 100000) continue;
      panelPrices.push(pp);
    }
    if (panelPrices.length) {
      panelPrices.sort(function (a, b) { return a - b; });
      var uniq = [];
      panelPrices.forEach(function (p) { if (uniq.indexOf(p) < 0) uniq.push(p); });
      add(uniq[0], 95, 'panel-min-major');
      if (uniq.length > 1) add(uniq[uniq.length - 1], 20, 'panel-max');
    }

    try {
      var domPrice = extractCoupangPriceFromDom(ctx.buyRoot);
      if (domPrice) add(domPrice, 50, 'dom');
    } catch (e) { /* ignore */ }

    try {
      var next = extractCoupangFromNextData();
      if (next.price) add(next.price, ctx.vendorItemId ? 70 : 30, 'next-data');
    } catch (e) { /* ignore */ }

    var ld = parseJsonLd();
    if (ld.price) add(ld.price, 40, 'json-ld');

    var metaPrice = PH.normalizePrice(metaContent('product:price:amount'));
    if (metaPrice) add(metaPrice, 35, 'meta');

    return signals;
  }

  function resolveCoupangPrice(signals) {
    if (!signals || !signals.length) return null;
    var buckets = {};
    signals.forEach(function (sig) {
      var key = String(sig.price);
      if (!buckets[key]) buckets[key] = { price: sig.price, weight: 0 };
      buckets[key].weight += sig.weight;
    });
    var ranked = Object.keys(buckets).map(function (k) { return buckets[k]; });
    ranked.sort(function (a, b) { return b.weight - a.weight; });
    return ranked.length ? ranked[0].price : null;
  }

  function normalizeCoupangOptionRaw(option) {
    var t = String(option || '').replace(/\s+/g, ' ').trim();
    if (!t || isWrongRelatedProductTitle(t)) return '';
    t = t.replace(/^구성\s*[×x]\s*엔진\s*방식\s*[×x]\s*수량\s*/i, '');
    t = cleanCoupangOptionLine(t);
    if (!t || isCoupangCompositeLabelHeader(t) || isCoupangOptionLabel(t)) return '';
    if (isCoupangOptionNoise(t) || isWrongRelatedProductTitle(t)) return '';
    if (!isLikelyCoupangOptionValue(t)) return '';
    return t.slice(0, 300);
  }

  function extractCoupangOptionBruteForce(panelText) {
    var text = String(panelText || '').replace(/\s+/g, ' ');

    var glued = text.match(
      /구성\s*[×x]\s*엔진\s*방식\s*[×x]\s*수량\s*([가-힣+][\s\S]{8,140}?\d+\s*개)/i
    );
    if (glued && glued[1]) return normalizeCoupangOptionRaw(glued[1]);

    var re = /([가-힣A-Za-z][가-힣A-Za-z0-9+_\s]{3,}?\s*[×x]\s*[^×x]{2,}?\s*[×x]\s*[^×x]{2,}?\d+\s*개)/g;
    var match;
    var best = '';
    while ((match = re.exec(text)) !== null) {
      var candidate = match[1].trim();
      if (isCoupangCompositeLabelHeader(candidate)) continue;
      if (/^구성\s*[×x]/i.test(candidate) && !/패키지|프리미엄|휠|행정|풀패키지/i.test(candidate)) continue;
      if (candidate.length > best.length) best = candidate;
    }
    return normalizeCoupangOptionRaw(best);
  }

  function extractCoupangOptionFromNextData() {
    var nextEl = document.getElementById('__NEXT_DATA__');
    var source = nextEl ? (nextEl.textContent || '') : '';
    if (!source) return '';

    var vendorItemId = getCoupangVendorItemId();
    var productId = getCoupangProductId();
    var scopeIds = vendorItemId ? [vendorItemId] : [productId].filter(Boolean);
    var parts = [];
    var seen = {};

    function pushPart(val) {
      val = normalizeCoupangOptionRaw(val);
      if (!val || seen[val]) return;
      seen[val] = true;
      parts.push(val);
    }

    if (scopeIds.length) {
      scopeIds.forEach(function (scopeId) {
        var blockRe = new RegExp(
          '"(?:vendorItemId|itemId|productId)"\\s*:\\s*"?'+ scopeId + '"?[\\s\\S]{0,12000}',
          'i'
        );
        var block = source.match(blockRe);
        if (!block) return;
        var chunk = block[0];

        var attrRe = /"(?:attributeName|optionName)"\s*:\s*"((?:\\.|[^"\\])*)"\s*,\s*"(?:attributeValue|optionValue|selectedValue)"\s*:\s*"((?:\\.|[^"\\])*)"/g;
        var am;
        while ((am = attrRe.exec(chunk)) !== null) {
          var name = unescapeJsonString(am[1]);
          var value = unescapeJsonString(am[2]);
          if (!value || value.length < 2 || /^(선택|옵션|수량)$/i.test(value)) continue;
          if (isWrongRelatedProductTitle(value)) continue;
          if (name && !isCoupangOptionLabel(name)) pushPart(value);
          else pushPart(value);
        }
      });
    }

    if (parts.length >= 2) {
      return parts.map(function (p, idx) { return '(' + (idx + 1) + ') ' + p; }).join('  ').slice(0, 300);
    }
    return parts[0] || '';
  }

  function extractCoupangAnyDropdownValue(ctx) {
    var root = getCoupangOptionRoot();
    var candidates = [];

    queryDeepAll(
      'button[aria-expanded="false"], [role="combobox"], [class*="dropdown"], [class*="Dropdown"], ' +
      '[class*="option-picker"], [class*="OptionPicker"]',
      root,
      80
    ).forEach(function (el) {
      if (el.closest('footer, [class*="review"], [class*="Review"], nav, [class*="related"], [class*="recommend"]')) {
        return;
      }
      var raw = getCoupangTextWithoutMedia(el);
      if (!raw || raw.length < 4 || raw.length > 120) return;
      if (/장바구니|바로구매|구매하기|찜|쿠폰|로그인|배송지|로켓|판매자/i.test(raw)) return;
      if (/^(선택|옵션|수량|필수|옵션\s*선택|선택해)/i.test(raw)) return;
      if (isCoupangCompositeLabelHeader(raw) || isWrongRelatedProductTitle(raw)) return;

      var v = extractCoupangValueFromGluedText(raw) || cleanCoupangSelectionLine(raw);
      if (!v) v = raw.replace(/\s+/g, ' ').trim();
      if (!v || !isLikelyCoupangOptionValue(v)) return;

      var score = v.length;
      if (/\d+\s*개/.test(v)) score += 40;
      if (/[×x]/.test(v)) score += 35;
      if (/프리미엄|패키지|풀패키지|행정|휠/i.test(v)) score += 30;
      if (v.length > 50 && !/[×x]/.test(v)) score -= 50;
      candidates.push({ v: v, score: score });
    });

    if (!candidates.length) return '';
    candidates.sort(function (a, b) { return b.score - a.score; });
    return finalizeCoupangOption(candidates[0].v);
  }

  function extractCoupangOptionAfterHeaders(panelText) {
    var lines = String(panelText || '').split(/\n+/);
    var headerRe = /^(구성|색상|사이즈|모델|용량|스펙|옵션|엔진|배터리|세트|타입|종류)\b/i;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].replace(/\s+/g, ' ').trim();
      if (!line) continue;
      if (!headerRe.test(line) && !isCoupangCompositeLabelHeader(line)) continue;

      for (var j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        var next = lines[j].replace(/\s+/g, ' ').trim();
        if (!next || next.length < 4 || next.length > 160) continue;
        if (/장바구니|바로구매|구매하기|무료배송|판매자|로켓|쿠폰/i.test(next)) break;
        if (isCoupangCompositeLabelHeader(next) || isCoupangOptionLabel(next)) continue;

        var value = extractCoupangValueFromGluedText(next) || cleanCoupangSelectionLine(next) || next;
        value = finalizeCoupangOption(value);
        if (value && value.length >= 4) return value;
      }
    }
    return '';
  }

  function collectCoupangOptionSignals(ctx) {
    var signals = [];
    var panelText = ctx.panelText || '';
    var seen = {};

    function add(option, weight, source) {
      if (isWrongRelatedProductTitle(option)) return;
      var finalized = finalizeCoupangOption(option);
      if (!finalized) finalized = normalizeCoupangOptionRaw(option);
      if (!finalized || !isLikelyCoupangOptionValue(finalized) || seen[finalized]) return;
      if (/[×x]/.test(finalized) && /\d+\s*개/.test(finalized)) weight += 45;
      else if (finalized.length > 50 && !/[×x]/.test(finalized)) weight -= 80;
      seen[finalized] = true;
      signals.push({ option: finalized, weight: weight, source: source });
    }

    var buyZoneText = ctx.buyZoneText || ctx.panelText || '';

    try {
      var composite = extractCoupangCompositeDropdownSelected();
      if (composite) add(composite, 220, 'composite-dropdown');
    } catch (e) { /* ignore */ }

    var brute = extractCoupangOptionBruteForce(buyZoneText);
    if (brute) add(brute, 160, 'brute-force');

    try {
      var fromNext = extractCoupangOptionFromNextData();
      if (fromNext) add(fromNext, 145, 'next-data');
    } catch (e) { /* ignore */ }

    var afterHeader = extractCoupangOptionAfterHeaders(buyZoneText);
    if (afterHeader) add(afterHeader, 140, 'after-header');

    var lines = buyZoneText.split(/\n+/);
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].replace(/\s+/g, ' ').trim();
      if (!line || line.length < 8 || line.length > 120) continue;
      if (isCoupangCompositeLabelHeader(line) || isWrongRelatedProductTitle(line)) continue;

      var value = extractCoupangValueFromGluedText(line) || cleanCoupangSelectionLine(line);
      if (!value && /구성\s*[×x]\s*엔진/i.test(lines[i - 1] || '')) {
        value = cleanCoupangSelectionLine(line);
      }
      if (!value || !isLikelyCoupangOptionValue(value)) continue;

      var score = 90 + value.length;
      if (/\d+\s*개/.test(value)) score += 40;
      if (/[×x]/.test(value)) score += 35;
      if (/프리미엄|패키지|풀패키지|행정|휠/i.test(value)) score += 30;
      add(value, score, 'panel-line');
    }

    var glued = buyZoneText.match(/구성\s*[×x]\s*엔진\s*방식\s*[×x]\s*수량\s*([^\n]+)/i);
    if (glued && glued[1]) add(glued[1].trim(), 130, 'panel-glued-regex');

    var xPattern = buyZoneText.match(/([가-힣][가-힣A-Za-z0-9+_\s]{4,}?\s*[×x]\s*[가-힣][^\n]{4,}?\s*[×x]\s*[^\n]*\d+\s*개)/);
    if (xPattern && xPattern[1]) add(xPattern[1], 100, 'panel-x-pattern');

    try { add(extractCoupangAnyDropdownValue(ctx), 125, 'any-dropdown'); } catch (e) { /* ignore */ }
    try { add(extractCoupangOptionDeepScan(), 75, 'deep-scan'); } catch (e) { /* ignore */ }
    try { add(extractCoupangOptionFromVisibleDom(), 60, 'visible-dom'); } catch (e) { /* ignore */ }
    try { add(extractCoupangCompositeOptionFromDom(), 55, 'composite-dom'); } catch (e) { /* ignore */ }
    try {
      var closed = extractCoupangClosedDropdownSelections();
      closed.forEach(function (v) { add(v, 65, 'closed-dropdown'); });
    } catch (e) { /* ignore */ }

    try {
      collectCoupangDropdownValues(ctx.buyRoot).forEach(function (v) {
        add(v, 60, 'dropdown');
      });
    } catch (e) { /* ignore */ }

    return signals;
  }

  function resolveCoupangOption(signals) {
    if (!signals || !signals.length) return '';
    signals.forEach(function (s) {
      if (s.source === 'composite-dropdown') s.weight += 60;
      if (/[×x]/.test(s.option) && /\d+\s*개/.test(s.option) && /패키지|프리미엄|행정|휠|풀패키지/i.test(s.option)) {
        s.weight += 50;
      }
      if (isCoupangDimensionNoise(s.option)) s.weight -= 200;
      if (s.option.length > 50 && !/[×x]/.test(s.option)) s.weight -= 100;
    });
    signals.sort(function (a, b) { return b.weight - a.weight; });
    for (var i = 0; i < signals.length; i++) {
      if (!isWrongRelatedProductTitle(signals[i].option) && isLikelyCoupangOptionValue(signals[i].option)) {
        return signals[i].option;
      }
    }
    return '';
  }

  function resolveCoupangProduct() {
    var ctx = {
      productId: getCoupangProductId(),
      vendorItemId: getCoupangVendorItemId(),
      buyRoot: getCoupangBuyPanel(),
      panelText: getCoupangPanelInnerText(),
      buyZoneText: getCoupangBuyZoneText()
    };

    var titleSignals = collectCoupangTitleSignals(ctx);
    var title = resolveCoupangTitle(titleSignals);
    ctx.productTitle = title;

    var priceSignals = collectCoupangPriceSignals(ctx);
    var price = resolveCoupangPrice(priceSignals);

    var option = extractCoupangOptionsUniversal(ctx, title);

    return { title: title, price: price, option: option };
  }

  function getNaverProductId() {
    var m = location.pathname.match(/\/products\/(\d+)/i);
    return m ? m[1] : '';
  }

  function extractNaverFromScripts() {
    var html = document.documentElement.innerHTML;
    var productId = getNaverProductId();
    var result = { title: '', price: null };

    var dispNames = [];
    var dispRe = /"dispName"\s*:\s*"((?:\\.|[^"\\])*)"/g;
    var dm;
    while ((dm = dispRe.exec(html)) !== null) {
      var n = cleanTitle(unescapeJsonString(dm[1]));
      if (n && !isBadTitle(n)) dispNames.push(n);
    }
    if (dispNames.length) {
      dispNames.sort(function (a, b) { return b.length - a.length; });
      result.title = dispNames[0];
    }

    if (productId) {
      var blockRe = new RegExp(
        '"productNo"\\s*:\\s*"?'+ productId + '"?[\\s\\S]{0,8000}?"discountedSalePrice"\\s*:\\s*(\\d+)',
        'i'
      );
      var blockRe2 = new RegExp(
        '"productNo"\\s*:\\s*"?'+ productId + '"?[\\s\\S]{0,8000}?"salePrice"\\s*:\\s*(\\d+)',
        'i'
      );
      var bm = html.match(blockRe) || html.match(blockRe2);
      if (bm) {
        var scriptPrice = PH.normalizePrice(bm[1]);
        if (isValidNaverPrice(scriptPrice)) result.price = scriptPrice;
      }
    }

    if (!result.price) {
      var salePrices = [];
      [/\"discountedSalePrice\"\s*:\s*(\d+)/g, /\"salePrice\"\s*:\s*(\d+)/g, /\"benefitPrice\"\s*:\s*(\d+)/g, /\"productSalePrice\"\s*:\s*(\d+)/g]
        .forEach(function (re) {
          var m;
          while ((m = re.exec(html)) !== null) {
            var n = PH.normalizePrice(m[1]);
            if (n) salePrices.push(n);
          }
        });
      if (salePrices.length) {
        var valid = salePrices.filter(isValidNaverPrice);
        if (valid.length) result.price = Math.min.apply(null, valid);
      }
    }

  if (!result.title) {
      var nameRe = /"productName"\s*:\s*"((?:\\.|[^"\\])*)"/g;
      var names = [];
      var nm;
      while ((nm = nameRe.exec(html)) !== null) {
        var n2 = cleanTitle(unescapeJsonString(nm[1]));
        if (n2 && !isBadTitle(n2)) names.push(n2);
      }
      if (names.length) {
        names.sort(function (a, b) { return b.length - a.length; });
        result.title = names[0];
      }
    }

    return result;
  }

  function queryAll(selectors, root) {
    root = root || document;
    var out = [];
    var list = Array.isArray(selectors) ? selectors : [selectors];
    list.forEach(function (sel) {
      root.querySelectorAll(sel).forEach(function (el) { out.push(el); });
    });
    return out;
  }

  function isStrikethroughPrice(el) {
    if (!el) return true;
    if (el.closest('del, s, strike, [class*="origin"], [class*="before"], [class*="Origin"], [class*="Before"]')) {
      return true;
    }
    var style = window.getComputedStyle(el);
    if (style.textDecoration && style.textDecoration.indexOf('line-through') >= 0) return true;
    return false;
  }

  function isValidNaverPrice(p) {
    if (!p || !Number.isFinite(p)) return false;
    var digits = String(Math.round(p));
    if (digits.length < 4 || digits.length > 9) return false;
    return p >= 1000 && p <= 50000000;
  }

  function parseNaverPriceText(text) {
    if (!text) return null;
    var str = String(text);
    var matches = str.match(/\d{1,3}(?:,\d{3})+\s*원|\d{4,9}\s*원/g);
    if (matches && matches.length) {
      var last = matches[matches.length - 1];
      var p = PH.normalizePrice(last);
      return isValidNaverPrice(p) ? p : null;
    }
    var p2 = PH.normalizePrice(str);
    return isValidNaverPrice(p2) ? p2 : null;
  }

  /** 네이버·G마켓·쿠팡·11번가 공통 UI 라벨 제거 */
  function stripMallUiLabels(text) {
    return String(text || '')
      .replace(/수량\s*증가|수량\s*감소|수량증가|수량감소/gi, ' ')
      .replace(/쿠폰\s*적용/gi, ' ')
      .replace(/닫기|삭제|더보기|선택됨/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getOptionTextFromEl(el) {
    if (!el) return '';
    var clone = el.cloneNode(true);
    clone.querySelectorAll(
      'button, a, [role="button"], input, [class*="btn"], [class*="button"], [class*="coupon"]'
    ).forEach(function (node) {
      node.remove();
    });
    return stripMallUiLabels(clone.textContent);
  }

  function cleanMallOptionLine(text) {
    var t = stripMallUiLabels(text);
    t = t.replace(/\d{1,3}(?:,\d{3})+\s*원/g, ' ').trim();
    t = t.replace(/^\s*[-+]\s*\d+\s*[-+]\s*/g, '').trim();
    t = t.replace(/\s+(?:수량증가|수량감소|닫기|삭제|쿠폰적용)(?:\s+.*)?$/i, '').trim();
    return t.replace(/\s+/g, ' ').trim();
  }

  function finalizeMallOption(option) {
    return cleanMallOptionLine(option);
  }

  function extractTotalPriceFromPanel(root) {
    root = root || document.body;
    var nodes = root.querySelectorAll('div, span, p, strong, em, dt, dd');
    for (var i = 0; i < nodes.length; i++) {
      var raw = (nodes[i].textContent || '').replace(/\s+/g, ' ').trim();
      if (!/총\s*금액|총\s*상품|결제\s*예정|주문\s*금액/i.test(raw)) continue;
      var match = raw.match(
        /(?:총\s*금액|총\s*상품\s*금액|결제\s*예정\s*금액|주문\s*금액)\s*([\d,]{4,12})\s*원?/i
      );
      if (match) {
        var p = PH.normalizePrice(match[1]);
        if (isValidNaverPrice(p)) return p;
      }
    }
    return null;
  }

  function getCoupangBuyPanel() {
    return (
      document.querySelector(
        '#sdpContent, .sdp-content, .prod-atf-contents, .prod-atf, .prod-buy, .prod-buy-new, ' +
        '.prod-option, .product-buy-header, .prod-buy-header, [class*="product-buy"], [class*="ProductBuy"], main'
      ) ||
      document.body
    );
  }

  function getCoupangAtfRoot() {
    return (
      document.querySelector(
        '#sdpContent, .sdp-content, .prod-atf-contents, .prod-atf, main, [class*="product-detail"], [class*="ProductDetail"]'
      ) ||
      getCoupangBuyPanel()
    );
  }

  function getCoupangOptionRoot() {
    var buy = getCoupangAtfRoot();
    var opt = buy.querySelector(
      '.prod-option, .prod-option-container, .option-table, [class*="prod-option"], [class*="option-picker"], [class*="OptionPicker"]'
    );
    return opt || buy;
  }

  function isInsideCoupangOptionArea(el) {
    if (!el) return false;
    if (el.closest(
      '#reviews, [class*="review"], [class*="Review"], [class*="related"], [class*="sdp-review"], footer'
    )) {
      return false;
    }
    if (/coupang/i.test(location.hostname)) {
      return !el.closest('footer, [class*="review"], [class*="Review"], [class*="related"], [class*="sdp-review"]');
    }
    return !!el.closest(
      '.prod-atf, .prod-atf-contents, .prod-buy, .prod-buy-new, [class*="prod-option"], ' +
      '[class*="option"], .sdp-content, main, #sdpContent'
    );
  }

  function getCoupangTextWithoutMedia(el) {
    if (!el) return '';
    var clone = el.cloneNode(true);
    clone.querySelectorAll('img, svg, picture, video, button').forEach(function (node) {
      node.remove();
    });
    return stripMallUiLabels(clone.textContent).replace(/\s+/g, ' ').trim();
  }

  function pushCoupangOptionValue(values, seen, raw) {
    var stripped = extractCoupangValueFromGluedText(raw);
    var v = finalizeCoupangOption(stripped || raw);
    if (!v || isCoupangOptionNoise(v) || isCoupangOptionLabel(v)) return;
    if (!looksLikeCoupangDropdownValue(v) && !looksLikeCoupangOptionValue(v)) return;

    for (var i = 0; i < values.length; i++) {
      if (!isDuplicateCoupangOption(values[i], v)) continue;
      var better = pickBetterCoupangOption(values[i], v);
      if (better !== values[i]) {
        delete seen[values[i]];
        values[i] = better;
        seen[better] = true;
      }
      return;
    }

    if (seen[v]) return;
    seen[v] = true;
    values.push(v);
  }

  function extractCoupangLabelValuePairs() {
    var root = getCoupangAtfRoot();
    var values = [];
    var seen = {};

    // NOTE: only scan stable containers, not option list items (li)
    root.querySelectorAll('button, div').forEach(function (box) {
      if (!isInsideCoupangOptionArea(box)) return;
      if (/장바구니|바로구매|구매하기/i.test(box.textContent || '') && box.children.length < 2) return;
      if (box.closest('ul, ol, [role="listbox"]')) return;

      var kids = Array.from(box.children).filter(function (child) {
        var t = getCoupangTextWithoutMedia(child);
        return t && t.length >= 2 && t.length <= 100;
      });
      if (kids.length < 2 || kids.length > 5) return;

      for (var i = 0; i < kids.length - 1; i++) {
        var label = getCoupangTextWithoutMedia(kids[i]);
        var value = getCoupangTextWithoutMedia(kids[i + 1]);
        if (isCoupangOptionLabel(label) && value && !isCoupangOptionLabel(value)) {
          pushCoupangOptionValue(values, seen, value);
        }
      }
    });

    root.querySelectorAll('span, label, p, dt').forEach(function (labelEl) {
      if (!isInsideCoupangOptionArea(labelEl)) return;
      if (labelEl.children.length > 0) return;

      var label = (labelEl.textContent || '').replace(/\s+/g, ' ').trim();
      if (!isCoupangOptionLabel(label)) return;

      var sibling = labelEl.nextElementSibling;
      if (sibling) pushCoupangOptionValue(values, seen, getCoupangTextWithoutMedia(sibling));

      var parent = labelEl.parentElement;
      if (!parent) return;
      Array.from(parent.children).forEach(function (child) {
        if (child === labelEl) return;
        var t = getCoupangTextWithoutMedia(child);
        if (t && !isCoupangOptionLabel(t)) pushCoupangOptionValue(values, seen, t);
      });
    });

    return values;
  }

  function isCoupangOpenOptionList(el) {
    var list = el.closest('ul, ol, [role="listbox"], [class*="list"]');
    if (!list || !isInsideCoupangOptionArea(list)) return false;
    return list.querySelectorAll('li, [role="option"]').length >= 4;
  }

  function isCoupangOptionLabel(text) {
    var t = String(text || '').replace(/\s+/g, ' ').trim();
    if (!t || t.length > 45) return false;
    if (isCoupangCompositeLabelHeader(t)) return true;
    if (/^사이즈$/i.test(t)) return true;
    if (/^색상\s*[x×]\s*(사이즈|프레임재질)$/i.test(t)) return true;
    if (/^프레임재질$|^색상$|^모델$|^배터리$|^용량$|^구성$|^엔진\s*방식$|^수량$/i.test(t)) return true;
    if (/^(필수|선택|옵션)$/i.test(t)) return true;
    return false;
  }

  function isCoupangCompositeLabelHeader(text) {
    var t = String(text || '').replace(/\s+/g, ' ').trim();
    if (!/[×x]/.test(t)) return false;
    if (/\d+\s*개/.test(t) || /프리미엄|패키지|휠|풀패키지|행정/i.test(t)) return false;
    if (/쿠폰/.test(t)) return false;
    var parts = t.split(/\s*[×x]\s*/);
    if (parts.length < 2) return false;
    return parts.every(function (p) { return p.length >= 2 && p.length <= 14; });
  }

  function cleanCoupangSelectionLine(text) {
    var t = String(text || '')
      .replace(/\(1개당\s*\)?\s*쿠폰.*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!t || isCoupangCompositeLabelHeader(t) || isCoupangOptionLabel(t) || isCoupangOptionNoise(t)) return '';
    if (looksLikeCoupangDropdownValue(t) || looksLikeCoupangOptionValue(t)) return t;
    if (/[×x]/.test(t) && /[가-힣]/.test(t) && (/\d+\s*개/.test(t) || /행정|패키지|프리미엄|휠/i.test(t))) return t;
    return '';
  }

  function extractCoupangValueFromGluedText(text) {
    var t = String(text || '').replace(/\s+/g, ' ').trim();
    if (isCoupangCompositeLabelHeader(t)) return '';

    var knownHeaders = [
      /^구성\s*[×x]\s*엔진\s*방식\s*[×x]\s*수량\s*/i,
      /^색상\s*[×x]\s*사이즈\s*/i,
      /^색상\s*[×x]\s*프레임재질\s*/i
    ];
    for (var h = 0; h < knownHeaders.length; h++) {
      if (knownHeaders[h].test(t)) {
        return cleanCoupangSelectionLine(t.replace(knownHeaders[h], ''));
      }
    }

    var qtyGlued = t.match(/^((?:[가-힣A-Za-z][가-힣A-Za-z0-9\s]*\s*[×x]\s*){2,}수량)(.+)$/);
    if (qtyGlued && qtyGlued[2]) {
      var headerOnly = qtyGlued[1].replace(/\s+$/, '');
      if (isCoupangCompositeLabelHeader(headerOnly)) {
        return cleanCoupangSelectionLine(qtyGlued[2]);
      }
    }

    var glued = t.match(/^((?:(?:[가-힣A-Za-z]+\s*[×x]\s*){2,}[가-힣A-Za-z]+?))([가-힣+].+)$/);
    if (glued && glued[2] && isCoupangCompositeLabelHeader(glued[1])) {
      return cleanCoupangSelectionLine(glued[2]);
    }

    var afterQty = t.match(/^(?:.+?수량)\s*([가-힣+].+)$/);
    if (afterQty && afterQty[1]) return cleanCoupangSelectionLine(afterQty[1]);

    if (/[×x]/.test(t) && /\d+\s*개/.test(t) && !isCoupangCompositeLabelHeader(t)) {
      return cleanCoupangSelectionLine(t);
    }
    return '';
  }

  function normalizeCoupangOptionCompareKey(text) {
    return String(text || '').replace(/\s+/g, '').toLowerCase();
  }

  function isDuplicateCoupangOption(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    var ka = normalizeCoupangOptionCompareKey(a);
    var kb = normalizeCoupangOptionCompareKey(b);
    if (ka === kb) return true;
    if (ka.indexOf(kb) >= 0 || kb.indexOf(ka) >= 0) return true;
    var strippedA = extractCoupangValueFromGluedText(a);
    if (strippedA && normalizeCoupangOptionCompareKey(strippedA) === kb) return true;
    var strippedB = extractCoupangValueFromGluedText(b);
    if (strippedB && ka === normalizeCoupangOptionCompareKey(strippedB)) return true;
    return false;
  }

  function pickBetterCoupangOption(a, b) {
    if (!a) return b;
    if (!b) return a;
    if (isCoupangCompositeLabelHeader(a) || /^구성\s*×\s*엔진/i.test(a)) return b;
    if (isCoupangCompositeLabelHeader(b) || /^구성\s*×\s*엔진/i.test(b)) return a;
    var strippedA = extractCoupangValueFromGluedText(a);
    var strippedB = extractCoupangValueFromGluedText(b);
    if (strippedA && !strippedB) return strippedA;
    if (strippedB && !strippedA) return strippedB;
    if (strippedA && strippedB) return strippedA.length <= strippedB.length ? strippedA : strippedB;
    return a.length <= b.length ? a : b;
  }

  function extractCoupangValueFromCompositeButton(btn, raw) {
    raw = raw || getCoupangTextWithoutMedia(btn);
    var lines = [];

    btn.querySelectorAll(':scope > div, :scope > span, :scope > p').forEach(function (child) {
      var line = getCoupangTextWithoutMedia(child);
      if (line && line.length >= 2 && line.length <= 120) lines.push(line);
    });

    if (lines.length >= 2) {
      for (var i = lines.length - 1; i >= 0; i--) {
        var v = cleanCoupangSelectionLine(lines[i]);
        if (v) return v;
      }
    }

    var fromGlued = extractCoupangValueFromGluedText(raw);
    if (fromGlued) return fromGlued;

    return cleanCoupangSelectionLine(raw);
  }

  function isCoupangOptionPickerEl(el) {
    if (!el) return false;
    if (el.closest('ul, ol, [role="listbox"], [role="option"]')) return false;
    if (/장바구니|바로구매|구매하기|찜하기|쿠폰\s*받기/i.test(el.textContent || '')) return false;
    var raw = getCoupangTextWithoutMedia(el);
    if (!raw || raw.length < 4 || raw.length > 220) return false;
    if (el.getAttribute('aria-expanded') === 'true') return false;
    if (/[×x]/.test(raw) || /프리미엄|패키지|풀패키지|행정|42v|배터리|세트|\d+\s*개/i.test(raw)) return true;
    if (/coupang/i.test(location.hostname) && raw.length >= 6 && raw.length <= 80) return true;
    return isInsideCoupangOptionArea(el);
  }

  function isCoupangClosedDropdownButton(btn) {
    return isCoupangOptionPickerEl(btn);
  }

  function extractCoupangCompositeOptionFromDom() {
    var root = getCoupangOptionRoot();
    var best = '';
    var bestScore = 0;
    var nodes = root.querySelectorAll('button, [role="button"], div, span, p');
    var limit = Math.min(nodes.length, MAX_COUPANG_OPTION_SCAN);

    for (var ci = 0; ci < limit; ci++) {
      var el = nodes[ci];
      if (!isCoupangOptionPickerEl(el)) continue;
      if (el.children.length > 8) continue;
      var raw = getCoupangTextWithoutMedia(el);
      var value = extractCoupangValueFromCompositeButton(el, raw);
      if (!value) continue;
      if (!looksLikeCoupangDropdownValue(value) && !(/[×x]/.test(value) && /\d+\s*개/.test(value))) continue;

      var score = value.length;
      if (/\d+\s*개/.test(value)) score += 50;
      if (/프리미엄|패키지|풀패키지|행정|휠/i.test(value)) score += 30;
      if (isCoupangCompositeLabelHeader(raw)) score -= 10;
      if (score > bestScore) {
        bestScore = score;
        best = value;
      }
    }

    return best;
  }

  function extractCoupangClosedDropdownSelections() {
    var root = getCoupangOptionRoot();
    var values = [];
    var seen = {};
    var nodes = root.querySelectorAll('button, [role="button"], div, span, p');
    var limit = Math.min(nodes.length, MAX_COUPANG_OPTION_SCAN);

    for (var di = 0; di < limit; di++) {
      var btn = nodes[di];
      if (!isCoupangClosedDropdownButton(btn)) continue;
      var raw = getCoupangTextWithoutMedia(btn);
      if (!raw || raw.length < 6 || raw.length > 200) continue;
      if (!/[×x]/.test(raw) && !/프리미엄|패키지|행정|RS\d/i.test(raw)) continue;

      var value = extractCoupangValueFromCompositeButton(btn, raw);
      if (!value) continue;

      for (var i = 0; i < values.length; i++) {
        if (!isDuplicateCoupangOption(values[i], value)) continue;
        values[i] = pickBetterCoupangOption(values[i], value);
        seen[values[i]] = true;
        value = null;
        break;
      }
      if (!value || seen[value]) continue;
      seen[value] = true;
      values.push(value);
    }

    return values;
  }

  function looksLikeCoupangOptionValue(text) {
    if (!text || text.length < 4 || text.length > 100) return false;
    if (isCoupangOptionNoise(text)) return false;
    if (isCoupangOptionLabel(text)) return false;
    if (/^색상\s*[x×]\s*사이즈$/i.test(text)) return false;
    if (/^프레임재질\s*:/i.test(text)) return false;
    if (/[x×]/.test(text) && /[가-힣A-Za-z]/.test(text) && /\d/.test(text)) return true;
    if (/\d+\s*A(?:H|h)?/i.test(text) && /[가-힣]/.test(text)) return true;
    if (/표준|프리미엄|S\d|M\d|L\d|XL/i.test(text) && text.length >= 5) return true;
    return false;
  }

  function looksLikeCoupangDropdownValue(text) {
    if (!text || text.length < 3 || text.length > 120) return false;
    if (isCoupangOptionNoise(text) || isCoupangOptionLabel(text)) return false;
    if (/^구성\s*[×x]\s*엔진/i.test(text) && /프리미엄|패키지|풀패키지|행정/i.test(text)) return false;
    if (/RS\d|\.?\d*v[-\s]?\d+\s*a?h?/i.test(text)) return true;
    if (/[A-Za-z]\d+[\.\d]*v[-\s]?\d+/i.test(text)) return true;
    if (/[가-힣]+[_\s][\d]+인치/i.test(text)) return true;
    if (/[x×_]/.test(text) && /[가-힣]/.test(text) && text.length >= 6) return true;
    if (/프리미엄|패키지|풀패키지|행정|구성/i.test(text) && /[×x]/.test(text)) return true;
    if (/리얼|블랙|화이트|그레이|하이텐|알루미|인치|스틸/i.test(text) && text.length >= 6) return true;
    return looksLikeCoupangOptionValue(text);
  }

  function isCoupangDropdownTrigger(el) {
    if (!isCoupangOptionPickerEl(el)) return false;
    var tag = el.tagName;
    if (tag === 'BUTTON' || el.getAttribute('role') === 'button') return true;
    if (tag === 'DIV' || tag === 'SPAN' || tag === 'P') return true;
    return false;
  }

  function extractValueFromCoupangDropdownTrigger(trigger) {
    var lines = [];
    trigger.querySelectorAll('span, div, p').forEach(function (child) {
      if (child.querySelector('span, div, p')) return;
      var line = (child.textContent || '').replace(/\s+/g, ' ').trim();
      if (line && line.length >= 2 && line.length <= 80) lines.push(line);
    });

    for (var i = lines.length - 1; i >= 0; i--) {
      var candidate = splitCoupangOptionText(lines[i]);
      if (isCoupangOptionLabel(candidate) || isCoupangOptionNoise(candidate)) continue;
      if (looksLikeCoupangDropdownValue(candidate) || looksLikeCoupangOptionValue(candidate)) {
        return finalizeCoupangOption(candidate);
      }
    }

    var clone = trigger.cloneNode(true);
    clone.querySelectorAll('img, svg, picture').forEach(function (node) { node.remove(); });
    var raw = getOptionTextFromEl(clone)
      .replace(/^사이즈\s*/i, '')
      .replace(/^색상\s*[x×]\s*프레임재질\s*/i, '')
      .replace(/^색상\s*[x×]\s*사이즈\s*/i, '')
      .trim();
    var fromGlued = extractCoupangValueFromGluedText(raw);
    if (fromGlued) return finalizeCoupangOption(fromGlued);
    raw = splitCoupangOptionText(raw);
    if (!raw || isCoupangOptionLabel(raw) || isCoupangOptionNoise(raw)) return '';
    if (looksLikeCoupangDropdownValue(raw) || looksLikeCoupangOptionValue(raw)) {
      return finalizeCoupangOption(raw);
    }
    return '';
  }

  function extractCoupangLabeledDropdowns() {
    return extractCoupangLabelValuePairs();
  }

  function collectCoupangDropdownValues(root) {
    root = root || getCoupangAtfRoot();
    var collected = [];
    var seen = {};

    function pushValue(value) {
      pushCoupangOptionValue(collected, seen, value);
    }

    extractCoupangLabelValuePairs().forEach(function (value) { pushValue(value); });

    root.querySelectorAll('button, div[role="button"]').forEach(function (trigger) {
      if (!isCoupangDropdownTrigger(trigger)) return;
      if (isCoupangOpenOptionList(trigger)) return;
      var value = extractValueFromCoupangDropdownTrigger(trigger);
      if (value) pushValue(value);
    });

    queryDeepAll('button, [role="button"], div, span', root, 350).forEach(function (trigger) {
      if (!isCoupangDropdownTrigger(trigger)) return;
      if (isCoupangOpenOptionList(trigger)) return;
      var value = extractValueFromCoupangDropdownTrigger(trigger);
      if (value) pushValue(value);
    });

    return collected;
  }

  function extractCoupangOptionDeepScan() {
    var best = '';
    var bestScore = 0;
    var root = getCoupangBuyPanel();

    queryDeepAll('button, [role="button"], div, span, p', root, 400).forEach(function (el) {
      if (el.closest('footer, [class*="review"], [class*="Review"], [class*="related"], nav')) return;
      var raw = getCoupangTextWithoutMedia(el);
      if (!raw || raw.length < 10 || raw.length > 220) return;
      if (!/[×x]/.test(raw)) return;
      if (!/프리미엄|패키지|풀패키지|행정|휠|\d+\s*개|구성/i.test(raw)) return;
      if (/장바구니|바로구매|구매하기|찜하기/i.test(raw)) return;

      var value = extractCoupangValueFromCompositeButton(el, raw) || splitCoupangOptionText(raw);
      if (!value) return;
      if (!looksLikeCoupangDropdownValue(value) && !(/[×x]/.test(value) && /\d+\s*개/.test(value))) return;

      var score = value.length;
      if (/\d+\s*개/.test(value)) score += 50;
      if (/프리미엄|패키지|풀패키지|행정|휠/i.test(value)) score += 30;
      if (score > bestScore) {
        bestScore = score;
        best = value;
      }
    });

    return best;
  }

  function extractCoupangFromOptionBlocks() {
    var root = getCoupangOptionRoot();
    var collected = collectCoupangDropdownValues(root);
    if (collected.length >= 2) {
      return formatNaverOptionList(collected.map(function (name) { return { name: name }; }));
    }
    return '';
  }

  function splitCoupangOptionText(text) {
    var t = String(text || '').replace(/\s+/g, ' ').trim();
    var fromGlued = extractCoupangValueFromGluedText(t);
    if (fromGlued) return finalizeCoupangOption(fromGlued);
    var labeled = t.match(/색상\s*[x×]\s*사이즈\s+(.+)$/i);
    if (labeled && labeled[1]) return finalizeCoupangOption(labeled[1]);
    return finalizeCoupangOption(t);
  }

  function extractCoupangOptionFromPicker() {
    var collected = collectCoupangDropdownValues(getCoupangBuyPanel());
    if (collected.length) {
      return formatNaverOptionList(collected.map(function (name) { return { name: name }; }));
    }
    return '';
  }

  function extractCoupangOptionByPattern() {
    var root = getCoupangOptionRoot();
    var collected = [];
    var seen = {};

    root.querySelectorAll('span, div, p, button, label').forEach(function (el) {
      if (el.closest('ul, ol, [role="listbox"], [role="option"]')) return;
      if (el.children.length > 8 || isCoupangOpenOptionList(el)) return;
      var raw = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (raw.length < 6 || raw.length > 100) return;
      if (/^색상\s*[x×]\s*사이즈$/i.test(raw)) return;
      var t = splitCoupangOptionText(raw);
      pushCoupangOptionValue(collected, seen, t);
    });

    if (collected.length >= 2) {
      return formatNaverOptionList(collected.map(function (name) { return { name: name }; }));
    }
    return collected.length === 1 ? collected[0] : '';
  }

  function cleanCoupangOptionLine(text) {
    var t = cleanMallOptionLine(text);
    t = t.replace(/(\d+\s*A(?:H|h)?)(\d{1,3}(?:,\d{3})+\s*원?.*)$/i, '$1');
    t = t.replace(/(\d+\s*(?:GB|ML|인치|inch))(\d{1,3}(?:,\d{3})+\s*원?.*)$/i, '$1');
    t = t.replace(/([가-힣A-Za-z0-9])(\d{1,3}(?:,\d{3})+\s*원).*$/g, '$1').trim();
    t = t.replace(/\d{1,3}(?:,\d{3})+\s*원.*$/g, '').trim();
    t = t.replace(/할인.*$/i, '').trim();
    t = t.replace(/\d{1,2}\/\d{1,2}\s*도착.*$/i, '').trim();
    t = t.replace(/도착\s*예정.*$/i, '').trim();
    t = t.replace(/\(?(?:판매자|로켓|새벽|당일|직접)배송[^)]*\)?/gi, '').trim();
    t = t.replace(/배송비.*$/i, '').trim();
    t = t.replace(/색상\s*[x×]\s*사이즈\s*/gi, '').trim();
    return t.replace(/\s+/g, ' ').trim();
  }

  function finalizeCoupangOption(option) {
    var t = cleanCoupangOptionLine(option);
    if (!t) return '';
    var stripped = extractCoupangValueFromGluedText(t);
    if (stripped) t = stripped;
    t = cleanCoupangOptionLine(t);
    if (!t || isCoupangCompositeLabelHeader(t) || isCoupangOptionLabel(t)) return '';
    return t;
  }

  function isCoupangOptionNoise(text) {
    if (!text) return true;
    if (/^(옵션|수량|필수|선택|삭제|닫기)$/i.test(text)) return true;
    if (/선택해\s*주세요|옵션을\s*선택|필수\s*옵션/i.test(text)) return true;
    if (/\(?\s*1개당\s*\)?\s*쿠폰/i.test(text)) return true;
    if (isCoupangCompositeLabelHeader(text)) return true;
    if (/장바구니|바로구매|쿠폰\s*받기/i.test(text) && text.length < 35) return true;
    if (/도착\s*예정|판매자배송|로켓배송|배송비/i.test(text)) return true;
    if (/\d{1,2}\/\d{1,2}/.test(text) && /도착|배송/.test(text)) return true;
    if (/\d{1,3}(?:,\d{3})+\s*원/.test(text) && text.length > 25 && !/[x×]/.test(text)) return true;
    return false;
  }

  function extractCoupangOptions() {
    var optionRoot = getCoupangOptionRoot();
    var merged = [];
    var seen = {};

    function mergeList(list) {
      (list || []).forEach(function (name) {
        pushCoupangOptionValue(merged, seen, name);
      });
    }

    optionRoot.querySelectorAll(
      '.prod-option__item--selected .prod-option__name, ' +
      '.option-table-list__option--selected .prod-option__name, ' +
      'button.prod-option__item[aria-pressed="true"] .prod-option__name'
    ).forEach(function (el) {
      var t = getOptionTextFromEl(el) || el.textContent;
      if (t && t.length < 80) mergeList([t]);
    });

    queryAll([
      '.prod-option__item--selected',
      '.option-table-list__option--selected'
    ], optionRoot).forEach(function (row) {
      var nameEl = row.querySelector('.prod-option__name, [class*="option__name"]');
      if (nameEl) {
        mergeList([nameEl.textContent]);
      } else if (row.classList && row.classList.contains('prod-option__item--selected')) {
        mergeList([getOptionTextFromEl(row)]);
      }
    });

    optionRoot.querySelectorAll('button.prod-option__item, .prod-option__item').forEach(function (btn) {
      var pressed = btn.getAttribute('aria-pressed');
      if (pressed === 'false') return;
      var nameEl = btn.querySelector('.prod-option__name, [class*="option__name"]');
      if (nameEl) mergeList([nameEl.textContent]);
    });

    if (merged.length === 1) return merged[0];
    if (merged.length >= 2) {
      return formatNaverOptionList(merged.map(function (name) { return { name: name }; }));
    }

    var deepOption = extractCoupangOptionDeepScan();
    if (deepOption) return deepOption;

    var composite = extractCoupangCompositeOptionFromDom();
    if (composite) return composite;

    var visible = extractCoupangOptionFromVisibleDom();
    if (visible) return visible;

    var closedDropdowns = extractCoupangClosedDropdownSelections();
    if (closedDropdowns.length === 1) return closedDropdowns[0];
    if (closedDropdowns.length > 1) {
      return formatNaverOptionList(closedDropdowns.map(function (name) { return { name: name }; }));
    }

    var parts = [];
    optionRoot.querySelectorAll('select').forEach(function (sel) {
      if (!sel.value || sel.selectedIndex < 0) return;
      var opt = sel.options[sel.selectedIndex];
      var label = (opt && opt.textContent || '').replace(/\s+/g, ' ').trim();
      if (!label || isCoupangOptionNoise(label)) return;
      if (/선택|옵션\s*선택/i.test(label) && label.length < 20) return;
      if (parts.indexOf(label) < 0) parts.push(label);
    });
    if (parts.length === 1) return finalizeCoupangOption(parts[0]);
    if (parts.length > 1) return finalizeCoupangOption(parts.join(' / '));

    var fromPattern = extractCoupangOptionByPattern();
    if (fromPattern) return fromPattern;

    return '';
  }

  function extractCoupangPriceFromDom(buyRoot) {
    buyRoot = buyRoot || getCoupangBuyPanel();

    var nextData = extractCoupangFromNextData();
    if (nextData.price && isValidNaverPrice(nextData.price)) return nextData.price;

    var direct = PH.normalizePrice(textOf([
      '.total-price strong',
      '.price-amount.final-price-amount',
      '.prod-price .total-price strong',
      '.prod-sale-price',
      '[class*="total-price"] strong',
      '[class*="final-price-amount"]',
      '[class*="final-price"]',
      '[class*="sale-price"]',
      '.total-price'
    ], buyRoot));
    if (direct && isValidNaverPrice(direct)) return direct;

    var fromPanel = extractTotalPriceFromPanel(buyRoot);
    if (fromPanel && isValidNaverPrice(fromPanel)) return fromPanel;

    var visible = extractCoupangPriceFromVisibleDom(buyRoot);
    if (visible && isValidNaverPrice(visible)) return visible;

    var candidates = [];
    buyRoot.querySelectorAll('[class*="price"], [class*="Price"], strong, span, em').forEach(function (el) {
      if (isStrikethroughPrice(el)) return;
      var raw = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!raw || raw.length > 28) return;
      if (/쿠폰|개당|할인|월\s*\d|할부|%|배송/i.test(raw)) return;
      var p = parseNaverPriceText(raw);
      if (p && isValidNaverPrice(p)) candidates.push(p);
    });
    return pickBestCoupangPrice(candidates);
  }

  function extractCoupangOptionFast() {
    var option = extractCoupangOptionDeepScan();
    if (option) return option;

    option = extractCoupangOptionFromVisibleDom();
    if (option) return option;

    option = extractCoupangCompositeOptionFromDom();
    if (option) return option;

    var closedDropdowns = extractCoupangClosedDropdownSelections();
    if (closedDropdowns.length === 1) return closedDropdowns[0];
    if (closedDropdowns.length > 1) {
      return formatNaverOptionList(closedDropdowns.map(function (name) { return { name: name }; }));
    }

    var collected = collectCoupangDropdownValues(getCoupangBuyPanel());
    if (collected.length === 1) return collected[0];
    if (collected.length > 1) {
      return formatNaverOptionList(collected.map(function (name) { return { name: name }; }));
    }

    return '';
  }

  function extractCoupangProduct() {
    try {
      return resolveCoupangProduct();
    } catch (e) {
      return { title: '', price: null, option: '' };
    }
  }

  function get11stBuyPanel() {
    return (
      document.querySelector(
        '#prdBuyArea, .c_product_info, .l_product_cont, .buy_wrap, .prd_buy, .b_product_info'
      ) || document.body
    );
  }

  function is11stOptionNoise(text) {
    if (!text) return true;
    if (/^(옵션|수량|필수|선택|삭제|닫기)$/i.test(text)) return true;
    if (/선택해\s*주세요|옵션\s*선택/i.test(text)) return true;
    if (/장바구니|바로구매|쿠폰|찜하기/i.test(text) && text.length < 30) return true;
    if (/배송비|무료\s*배송|도착\s*예정|이내\s*도착|택배|대한통운|CJ|제주|도서\s*산간|산간\s*지역/i.test(text)) return true;
    if (/\d{1,2}\/\d{1,2}\s*\(?[월화수목금토일]\)?\s*(이내)?\s*도착/i.test(text)) return true;
    return false;
  }

  function clean11stOptionLine(text) {
    var t = cleanMallOptionLine(text);
    t = t.replace(/판매가\s*선택하기/gi, '').trim();
    t = t.replace(/\b판매가\b/gi, '').trim();
    t = t.replace(/배송비.*$/i, '').trim();
    t = t.replace(/무료\s*배송.*$/i, '').trim();
    t = t.replace(/CJ\s*대한통운.*$/i, '').trim();
    t = t.replace(/\d{1,2}\/\d{1,2}\s*\(?[월화수목금토일]\)?\s*(이내)?\s*도착\s*예정.*$/i, '').trim();
    t = t.replace(/제주지역\s*,?\s*도서산간지역.*$/i, '').trim();
    t = t.replace(/\s+/g, ' ').trim();
    return t;
  }

  function looksLike11stOptionValue(text) {
    var t = clean11stOptionLine(text);
    if (!t || t.length < 3 || t.length > 120) return false;
    if (is11stOptionNoise(t)) return false;
    if (/\d+\s*(?:AH|Ah|km|KM|V|GB|인치|inch)\b/.test(t)) return true;
    if (/[가-힣]{2,}\s*[-–—]\s*.+/.test(t)) return true;
    if (/[x×]/.test(t) && /[가-힣A-Za-z]/.test(t)) return true;
    return false;
  }

  function is11stOptionPickerItem(row) {
    if (!row) return false;
    var raw = (row.textContent || '').replace(/\s+/g, ' ').trim();
    if (/선택하기/.test(raw) && !/수량\s*(증가|감소)|수량증가|수량감소|삭제/.test(raw)) return true;
    var list = row.closest('ul, ol, [role="listbox"], [class*="option_list"], [class*="option-list"]');
    if (!list) return false;
    return (list.textContent || '').split('선택하기').length >= 3;
  }

  function is11stSelectedOptionRow(row) {
    if (!row || is11stOptionPickerItem(row)) return false;
    var raw = (row.textContent || '').replace(/\s+/g, ' ').trim();
    if (!raw || raw.length > 280) return false;
    if (!/\d{1,3}(?:,\d{3})+\s*원/.test(raw)) return false;
    var hasQty = /수량\s*(증가|감소)|수량증가|수량감소/.test(raw);
    var hasDelete = /삭제/.test(raw) ||
      !!row.querySelector('[class*="delete"], [class*="remove"], [class*="btn-remove"], [class*="btn_del"]');
    return hasQty || hasDelete;
  }

  function extract11stOptionNameFromRow(row) {
    var clone = row.cloneNode(true);
    clone.querySelectorAll(
      'button, input, img, svg, [class*="quantity"], [class*="delete"], [class*="remove"], [class*="btn-remove"]'
    ).forEach(function (node) { node.remove(); });

    var raw = getOptionTextFromEl(clone) || clone.textContent || '';
    raw = clean11stOptionLine(raw);
    raw = raw.replace(/\d{1,3}(?:,\d{3})+\s*원.*$/g, '').trim();
    raw = raw.replace(/할인모음가.*$/i, '').trim();
    raw = raw.replace(/판매가.*$/i, '').trim();
    raw = raw.replace(/수량\s*(증가|감소).*$/gi, '').trim();
    raw = raw.replace(/수량증가|수량감소/gi, '').trim();
    raw = raw.replace(/삭제.*$/i, '').trim();
    raw = raw.replace(/선택하기.*$/i, '').trim();
    return raw;
  }

  function extract11stRowPrice(row) {
    var raw = (row.textContent || '').replace(/\s+/g, ' ');
    var m = raw.match(/(?:판매가|할인모음가)\s*([\d,]{4,12})\s*원?/i) ||
      raw.match(/([\d,]{4,12})\s*원/);
    return m ? PH.normalizePrice(m[1]) : null;
  }

  function extract11stSelectedCount() {
    var buyRoot = get11stBuyPanel();
    var count = null;
    buyRoot.querySelectorAll('div, span, p, strong, em, li').forEach(function (el) {
      var raw = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!/총\s*\d+\s*개/i.test(raw)) return;
      var m = raw.match(/총\s*(\d+)\s*개/i);
      if (!m) return;
      var n = parseInt(m[1], 10);
      if (!Number.isFinite(n) || n < 1) return;
      if (/할인모음가|원/.test(raw)) count = n;
    });
    return count;
  }

  function rowHasNestedSelectedOption(row) {
    var nested = false;
    row.querySelectorAll('li, div, section, article').forEach(function (child) {
      if (child === row) return;
      if (is11stSelectedOptionRow(child)) nested = true;
    });
    return nested;
  }

  function collect11stSelectedCandidates(buyRoot) {
    var candidates = [];

    function pushRow(row) {
      if (!is11stSelectedOptionRow(row) || rowHasNestedSelectedOption(row)) return;
      var name = extract11stOptionNameFromRow(row);
      if (!name || !looksLike11stOptionValue(name)) return;
      candidates.push({
        name: name,
        price: extract11stRowPrice(row),
        row: row
      });
    }

    buyRoot.querySelectorAll('li, div, section, article').forEach(pushRow);

    if (!candidates.length) {
      buyRoot.querySelectorAll(
        'button, a, [class*="delete"], [class*="close"], [class*="btn-remove"], [class*="btn_del"]'
      ).forEach(function (btn) {
        if (/장바구니|구매|쿠폰|찜/i.test(btn.textContent || '')) return;
        var row = btn.closest('li, div[class], section');
        if (!row || is11stOptionPickerItem(row)) return;
        pushRow(row);
      });
    }

    return candidates;
  }

  function narrow11stSelectedCandidates(candidates) {
    if (!candidates.length) return candidates;

    var totalPrice = extract11stTotalPrice();
    var totalCount = extract11stSelectedCount();

    if (totalPrice) {
      var byPrice = candidates.filter(function (item) { return item.price === totalPrice; });
      if (byPrice.length) candidates = byPrice;
    }

    if (totalCount === 1 && candidates.length > 1) {
      if (totalPrice) {
        var exact = candidates.filter(function (item) { return item.price === totalPrice; });
        if (exact.length === 1) return exact;
      }
      return [candidates[candidates.length - 1]];
    }

    if (candidates.length > 1 && totalCount && candidates.length > totalCount) {
      return candidates.slice(-totalCount);
    }

    return candidates;
  }

  function extract11stSelectedOptionRows() {
    var buyRoot = get11stBuyPanel();
    var candidates = narrow11stSelectedCandidates(collect11stSelectedCandidates(buyRoot));
    var seen = {};
    var items = [];

    candidates.forEach(function (item) {
      if (!item.name || seen[item.name]) return;
      seen[item.name] = true;
      items.push({ name: item.name });
    });

    return items;
  }

  function extract11stOptions() {
    var buyRoot = get11stBuyPanel();
    var selected = extract11stSelectedOptionRows();
    if (selected.length === 1) return selected[0].name;
    if (selected.length) return formatNaverOptionList(selected);

    var parts = [];
    buyRoot.querySelectorAll('select').forEach(function (sel) {
      if (!sel.value || sel.selectedIndex < 0) return;
      var opt = sel.options[sel.selectedIndex];
      var label = (opt && opt.textContent || '').replace(/\s+/g, ' ').trim();
      if (!label || is11stOptionNoise(label)) return;
      if (/^(선택|옵션|모델|색상|사이즈)$/i.test(label)) return;
      label = clean11stOptionLine(label);
      if (label && parts.indexOf(label) < 0) parts.push(label);
    });
    if (parts.length >= 2) return finalizeMallOption(parts.join(' + '));
    if (parts.length === 1) return finalizeMallOption(parts[0]);
    return '';
  }

  function extract11stTotalPrice() {
    var buyRoot = get11stBuyPanel();
    var nodes = buyRoot.querySelectorAll('div, span, p, strong, em, dd, dt, li, section');
    var best = null;

    function consider(text) {
      var raw = String(text || '').replace(/\s+/g, ' ').trim();
      if (!raw) return;

      // Prefer totals that appear after option selection
      var m1 = raw.match(/(?:할인모음가|판매가)\s*([\d,]{4,12})\s*원?/i);
      var m2 = raw.match(/총\s*\d+\s*개[^0-9]*([\d,]{4,12})\s*원?/i);
      var m3 = raw.match(/총\s*1개[^0-9]*([\d,]{4,12})\s*원?/i);

      var cand = null;
      if (m2 && m2[1]) cand = m2[1];
      else if (m3 && m3[1]) cand = m3[1];
      else if (m1 && m1[1]) cand = m1[1];
      if (!cand) return;

      var p = PH.normalizePrice(cand);
      if (!isValidNaverPrice(p)) return;

      // Score: explicit total > discount-bundle > sale price
      var score = 0;
      if (/총\s*\d+\s*개|총\s*1개/i.test(raw)) score += 30;
      if (/할인모음가/i.test(raw)) score += 20;
      if (/판매가/i.test(raw)) score += 10;
      score += Math.min(20, Math.floor(raw.length / 10));

      if (!best || score > best.score) best = { price: p, score: score };
    }

    for (var i = 0; i < nodes.length; i++) {
      consider(nodes[i].textContent || '');
    }

    // Fallback: sometimes the selected option row contains the right-most price
    if (!best) {
      buyRoot.querySelectorAll('li, div').forEach(function (row) {
        var raw = (row.textContent || '').replace(/\s+/g, ' ').trim();
        if (!raw) return;
        if (!/(할인모음가|판매가|총\s*\d+\s*개|총\s*1개)/i.test(raw)) return;
        consider(raw);
      });
    }

    return best ? best.price : null;
  }

  function extract11stProduct() {
    var buyRoot = get11stBuyPanel();
    var title = textOf(['h1.title', '.prd_name', 'h1.c_product_title', 'h1']);
    var price = extract11stTotalPrice() ||
      extractTotalPriceFromPanel(buyRoot) ||
      PH.normalizePrice(textOf([
        '.price',
        '.sale_price',
        '.c_product_price_value',
        '.value',
        '.sale_price_area .value'
      ], buyRoot));
    if (price && !isValidNaverPrice(price)) price = null;
    return {
      title: cleanTitle(title),
      price: price,
      option: extract11stOptions()
    };
  }

  function getNaverBuyPanel() {
    return (
      document.querySelector(
        '[class*="product_option"], [class*="ProductOption"], [class*="option_area"], ' +
        '[class*="purchase"], [class*="ProductBuy"], [class*="product_buy"]'
      ) ||
      document.querySelector('[class*="ProductDetail"], [class*="product_detail"], [class*="productDetail"]') ||
      document.getElementById('content') ||
      document.body
    );
  }

  var NAVER_UI_NOISE_RE =
    /상품\s*바로가기|이\s*상품담기|장바구니|찜하기|톡톡|선물하기|바로구매|네이버페이|구매하기|쿠폰|배송비|무료배송|상품\s*정보|리뷰\s*\d|적립\s*포인트|포인트\s*적립|최대\s*적립|자세히\s*보기|멤버십|할인\s*혜택/i;

  function looksLikeNaverOptionName(name) {
    if (!name || name.length < 2 || isNaverOptionNoise(name)) return false;
    if (/^\(옵션\d+\)/.test(name) && /[가-힣A-Za-z0-9]/.test(name)) return true;
    if (/\(옵션\d+\)[가-힣A-Za-z0-9]/.test(name)) return true;
    if (/\d+\s*행정\s+[A-Z0-9-]+/i.test(name)) return true;
    if (/\d+\s*(Ah|V|W|A|mAh)\b/i.test(name)) return true;
    if (/\s\/\s/.test(name)) return true;
    if (/\d+\s*인치|\d+인치|inch/i.test(name)) return true;
    if (/[A-Z]{2,}/.test(name) && /[가-힣]/.test(name)) return true;
    if (/[가-힣]{2,}/.test(name) && name.length >= 4) return true;
    return false;
  }

  function shortenNaverOptionName(name) {
    name = cleanNaverOptionLine(name);
    if (!name) return '';
    var model = name.match(/(\d+\s*행정\s+[A-Z0-9-]+)\s*$/i);
    if (model && name.length > 40) return model[1];
    if (name.length > 80) {
      var tail = name.slice(-50).trim();
      if (looksLikeNaverOptionName(tail)) return tail;
    }
    return name;
  }

  function isNaverCartRemoveControl(btn) {
    if (!btn || btn.disabled) return false;
    var label = ((btn.getAttribute('aria-label') || '') + ' ' + (btn.getAttribute('title') || '') + ' ' + (btn.textContent || '')).trim();
    if (/장바구니|구매|찜|선물|톡톡|바로구매|네이버페이/i.test(label)) return false;
    if (/삭제|제거|닫기|delete|remove|close/i.test(label)) return true;
    if (/^[xX×✕]$/.test(label)) return true;
    var cls = String(btn.className || '');
    return /delete|remove|close|btn_del|btn_delete|icon_delete/i.test(cls);
  }

  function getNaverCartRowFromNode(node) {
    var el = node;
    for (var depth = 0; depth < 8 && el && el !== document.body; depth++) {
      var text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (text.length < 6 || text.length > 350) {
        el = el.parentElement;
        continue;
      }
      if ((/총\s*금액|총\s*\d+\s*개|장바구니|바로구매/i.test(text)) && text.length < 90) {
        el = el.parentElement;
        continue;
      }
      if (!/\d{1,3}(?:,\d{3})+\s*원|\d{4,9}\s*원/.test(text)) {
        el = el.parentElement;
        continue;
      }
      if (!isNaverSelectedOptionRow(el)) {
        el = el.parentElement;
        continue;
      }
      return el;
    }
    return null;
  }

  function isNaverCartLineRow(row) {
    var text = (row.textContent || '').replace(/\s+/g, ' ').trim();
    if (text.length < 6 || text.length > 320) return false;
    if (!/\d{1,3}(?:,\d{3})+\s*원|\d{4,9}\s*원/.test(text)) return false;
    if (!isNaverSelectedOptionRow(row)) return false;
    var hasQty = row.querySelector(
      'input[type="number"], [class*="quantity"], [class*="Quantity"], [class*="count"], [class*="Count"]'
    );
    var hasRemove = row.querySelector(
      'button, [role="button"], [class*="delete"], [class*="remove"], [class*="close"], ' +
      'span[class*="delete"], span[class*="remove"], i[class*="delete"], i[class*="close"]'
    );
    return !!(hasQty || hasRemove);
  }

  function collectNaverRowsFromRemoveButtons(buyRoot) {
    var items = [];
    var seen = {};

    function addItem(name, price) {
      name = shortenNaverOptionName(name);
      if (!looksLikeNaverOptionName(name)) return;
      if (seen[name]) return;
      seen[name] = true;
      items.push({ name: name, price: price || null });
    }

    buyRoot.querySelectorAll(
      'button, [role="button"], a, span[class*="delete"], span[class*="remove"], ' +
      'i[class*="delete"], i[class*="remove"], i[class*="close"]'
    ).forEach(function (btn) {
      if (!isNaverCartRemoveControl(btn)) return;
      var row = btn.closest('li, div, tr');
      if (!row || row === buyRoot) return;
      var rowText = (row.textContent || '').replace(/\s+/g, ' ').trim();
      if (rowText.length > 320 || rowText.length < 4) return;
      if (!isNaverSelectedOptionRow(row)) return;
      if (!/\d{1,3}(?:,\d{3})+\s*원|\d{4,9}\s*원/.test(rowText)) return;
      var name = extractNameFromNaverRow(row);
      if (!name) name = shortenNaverOptionName(rowText);
      if (!name || name.length < 2 || name.length > 150) return;
      addItem(name, extractPriceFromNaverRow(row));
    });

    return items;
  }

  function collectNaverRowsFromQuantityRows(buyRoot) {
    var items = [];
    var seen = {};

    function addItem(name, price) {
      name = shortenNaverOptionName(name);
      if (!looksLikeNaverOptionName(name)) return;
      if (seen[name]) return;
      seen[name] = true;
      items.push({ name: name, price: price || null });
    }

    buyRoot.querySelectorAll(
      'input[type="number"], [class*="quantity"], [class*="Quantity"], [class*="count"], [class*="Count"]'
    ).forEach(function (qtyEl) {
      var row = getNaverCartRowFromNode(qtyEl);
      if (!row) return;
      var name = extractNameFromNaverRow(row);
      if (!name) name = shortenNaverOptionName(cleanNaverOptionLine(row.textContent));
      if (!name || name.length < 2 || name.length > 150) return;
      addItem(name, extractPriceFromNaverRow(row));
    });

    return items;
  }

  function sortNaverOptionItems(items) {
    return items.slice().sort(function (a, b) {
      var aAddon = /^\(옵션\d+\)/.test(a.name);
      var bAddon = /^\(옵션\d+\)/.test(b.name);
      if (aAddon && !bAddon) return 1;
      if (!aAddon && bAddon) return -1;
      return 0;
    });
  }

  function mergeNaverDropdownSelections(items) {
    var fromDropdowns = extractNaverFromDropdowns();
    if (!fromDropdowns) return items;

    var parts = fromDropdowns.split(' / ').map(function (p) { return p.trim(); }).filter(Boolean);
    parts.forEach(function (part) {
      if (isNaverOptionNoise(part)) return;
      if (/^(추가\s*부품|추가\s*옵션|필수\s*옵션)$/i.test(part)) return;
      if (/선택해\s*주세요|선택하세요/i.test(part)) return;
      var exists = items.some(function (it) {
        return it.name === part || it.name.indexOf(part) >= 0 || part.indexOf(it.name) >= 0;
      });
      if (!exists) {
        items.unshift({ name: shortenNaverOptionName(part), price: null });
      }
    });

    return sortNaverOptionItems(items);
  }

  function isNaverSelectedOptionRow(row) {
    var text = (row.textContent || '').replace(/\s+/g, ' ').trim();
    if (/적립|포인트|자세히\s*보기|멤버십|쿠폰|할인혜택/i.test(text)) return false;
    if (/^총\s*\d+\s*개/.test(text)) return false;
    if (/총\s*금액/.test(text)) return false;
    return true;
  }

  function extractNaverTotalPriceFromDom() {
    var buyRoot = getNaverBuyPanel();
    var fromPanel = extractTotalPriceFromPanel(buyRoot);
    if (fromPanel) return fromPanel;

    var nodes = buyRoot.querySelectorAll('div, span, p, strong, em, dd, dt, li, section, h3, h4');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var own = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!/총\s*금액/i.test(own)) continue;

      var scopes = [el, el.parentElement];
      if (el.parentElement && el.parentElement.parentElement) {
        scopes.push(el.parentElement.parentElement);
      }
      for (var s = 0; s < scopes.length; s++) {
        var scope = scopes[s];
        if (!scope) continue;
        var raw = (scope.textContent || '').replace(/\s+/g, ' ').trim();
        if (raw.length > 140) continue;
        var match = raw.match(/총\s*금액[^0-9]{0,40}([\d,]{4,12})\s*원?/i);
        if (match) {
          var p = PH.normalizePrice(match[1]);
          if (isValidNaverPrice(p)) return p;
        }
      }
    }

    for (var j = 0; j < nodes.length; j++) {
      var el2 = nodes[j];
      var t2 = (el2.textContent || '').replace(/\s+/g, ' ').trim();
      if (!/^총\s*\d+\s*개/i.test(t2) || t2.length > 40) continue;
      var parent = el2.parentElement;
      if (!parent) continue;
      var pt = (parent.textContent || '').replace(/\s+/g, ' ').trim();
      if (pt.length > 160) continue;
      var m2 = pt.match(/([\d,]{4,12})\s*원/);
      if (m2) {
        var p2 = PH.normalizePrice(m2[1]);
        if (isValidNaverPrice(p2) && p2 >= 10000) return p2;
      }
    }

    for (var k = 0; k < nodes.length; k++) {
      var raw2 = (nodes[k].textContent || '').replace(/\s+/g, ' ').trim();
      if (!/총\s*금액/i.test(raw2)) continue;
      var match2 = raw2.match(/총\s*금액\s*([\d,]{4,12})\s*원?/i);
      if (match2) {
        var p3 = PH.normalizePrice(match2[1]);
        if (isValidNaverPrice(p3)) return p3;
      }
    }
    return null;
  }

  function extractNameFromNaverRow(row) {
    var nameEl = row.querySelector(
      '[class*="option_name"], [class*="product_name"], [class*="name"], [class*="title"]'
    );
    if (nameEl) {
      var fromEl = shortenNaverOptionName(nameEl.textContent);
      if (fromEl && fromEl.length >= 3 && looksLikeNaverOptionName(fromEl)) return fromEl;
    }

    var rowText = row.textContent || '';
    var modelInRow = rowText.match(/(\d+\s*행정\s+[A-Z0-9-]+)/i);
    if (modelInRow && looksLikeNaverOptionName(modelInRow[1])) return modelInRow[1];

    var cleanedLine = cleanNaverOptionLine(rowText);
    var addonMatch = cleanedLine.match(/\(옵션\d+\)[^0-9]+/);
    if (addonMatch) {
      var addonName = addonMatch[0].trim();
      if (looksLikeNaverOptionName(addonName)) return addonName;
    }

    var cleaned = shortenNaverOptionName(rowText);
    return looksLikeNaverOptionName(cleaned) ? cleaned : '';
  }

  function extractPriceFromNaverRow(row) {
    var prices = [];
    var re = /\d{1,3}(?:,\d{3})+\s*원|\d{4,9}\s*원/g;
    var text = row.textContent || '';
    var m;
    while ((m = re.exec(text)) !== null) {
      var p = PH.normalizePrice(m[0]);
      if (isValidNaverPrice(p)) prices.push(p);
    }
    if (!prices.length) return null;
    return prices[prices.length - 1];
  }

  function extractNaverSelectedItemRows() {
    var buyRoot = getNaverBuyPanel();
    var items = [];
    var seen = {};

    function addItem(name, price) {
      name = shortenNaverOptionName(name);
      if (!looksLikeNaverOptionName(name)) return;
      if (seen[name]) return;
      seen[name] = true;
      items.push({ name: name, price: price || null });
    }

    queryAll([
      '[class*="product_item"]',
      '[class*="ProductItem"]',
      '[class*="option_result"] li',
      '[class*="selected_option"] li',
      '[class*="option_list"] li'
    ], buyRoot).forEach(function (row) {
      if (!isNaverCartLineRow(row)) return;
      var name = extractNameFromNaverRow(row);
      if (!name || name.length < 2 || name.length > 150) return;
      addItem(name, extractPriceFromNaverRow(row));
    });

    collectNaverRowsFromRemoveButtons(buyRoot).forEach(function (item) {
      addItem(item.name, item.price);
    });

    collectNaverRowsFromQuantityRows(buyRoot).forEach(function (item) {
      addItem(item.name, item.price);
    });

    items = sortNaverOptionItems(items);
    items = mergeNaverDropdownSelections(items);
    items = ensureNaverMainProductRow(items);
    return sortNaverOptionItems(items);
  }

  function resolveNaverPrice(scripts) {
    var total = extractNaverTotalPriceFromDom();
    if (total) return total;

    var items = extractNaverSelectedItemRows();
    if (items.length >= 1) {
      var priced = items.filter(function (item) { return item.price; });
      if (priced.length >= 1) {
        var sum = priced.reduce(function (acc, item) { return acc + item.price; }, 0);
        if (isValidNaverPrice(sum)) {
          var addonsOnly = items.every(function (it) {
            return /^\(옵션\d+\)/.test(it.name);
          });
          if (!addonsOnly) return sum;
          if (scripts && scripts.price && isValidNaverPrice(scripts.price)) {
            var withBase = sum + scripts.price;
            if (isValidNaverPrice(withBase)) return withBase;
          }
        }
      }
    }

    var domPrice = extractNaverPriceFromDom();
    if (domPrice) return domPrice;
    if (scripts && scripts.price && isValidNaverPrice(scripts.price)) return scripts.price;
    return null;
  }

  function extractNaverPriceFromDom() {
    var total = extractNaverTotalPriceFromDom();
    if (total) return total;

    var items = extractNaverSelectedItemRows();
    if (items.length >= 1) {
      var priced = items.filter(function (item) { return item.price; });
      if (priced.length === items.length && priced.length > 0) {
        var sum = priced.reduce(function (acc, item) { return acc + item.price; }, 0);
        if (isValidNaverPrice(sum)) return sum;
      }
      if (items.length === 1 && items[0].price) return items[0].price;
    }

    var root = getNaverBuyPanel();
    var candidates = [];

    queryAll([
      '[class*="totalPrice"]',
      '[class*="TotalPrice"]',
      '[class*="salePrice"]',
      '[class*="SalePrice"]',
      '[class*="discount"] [class*="price"]',
      '[class*="Price"] strong',
      'span[class*="price"]',
      'em[class*="price"]',
      'strong[class*="price"]'
    ], root).forEach(function (el) {
      if (isStrikethroughPrice(el)) return;
      var p = parseNaverPriceText(el.textContent);
      if (p) candidates.push(p);
    });

    if (!candidates.length) return null;
    if (items.length >= 2) {
      var itemSum = items.filter(function (it) { return it.price; })
        .reduce(function (acc, it) { return acc + it.price; }, 0);
      if (isValidNaverPrice(itemSum)) return itemSum;
    }
    return Math.max.apply(null, candidates);
  }

  function extractNaverTitleFromDom() {
    var titleRoot = document.querySelector(
      '[class*="product_title"], [class*="ProductTitle"], [class*="product_detail_header"], [class*="product_info"]'
    );
    if (titleRoot) {
      var heading = titleRoot.querySelector('h2, h3');
      if (heading) {
        var direct = cleanNaverProductTitle(heading.textContent);
        if (direct && !isBadTitle(direct)) return direct;
      }
    }

    var root =
      document.querySelector('[class*="ProductDetail"], [class*="product_detail"], [class*="productDetail"], #content') ||
      document.body;
    var candidates = [];

    queryAll([
      'h2[class*="Product"]',
      'h3[class*="Product"]',
      '[class*="product_title"]',
      '[class*="ProductTitle"]',
      '[class*="productTitle"]',
      'h2',
      'h3'
    ], root).forEach(function (el) {
      var t = cleanTitle(el.textContent);
      if (t && !isBadTitle(t)) candidates.push(t);
    });

    if (!candidates.length) return '';
    candidates = candidates.filter(function (c) { return c.length >= 8 && c.length <= 160; });
    if (!candidates.length) return '';
    candidates.sort(function (a, b) {
      var score = function (t) {
        var s = 0;
        if (t.length >= 15 && t.length <= 90) s += 40;
        if (t.indexOf(':') < 0) s += 20;
        if (/전기자전거|자전거|타이어|배터리|Ah|inch|인치/i.test(t)) s += 10;
        return s - t.length * 0.05;
      };
      return score(b) - score(a);
    });
    return candidates[0];
  }

  function cleanNaverProductTitle(title) {
    title = cleanTitle(title);
    if (!title) return '';
    title = title.replace(/\s*:\s*[^:]{1,50}$/, '').trim();
    title = title.replace(/\s*-\s*네이버\s*쇼핑.*$/i, '').trim();
    title = title.replace(/\s*:\s*[^:]*스마트스토어.*$/i, '').trim();
    return title;
  }

  function isNaverOptionNoise(text) {
    if (!text) return true;
    if (NAVER_UI_NOISE_RE.test(text)) return true;
    if (/^(선택|옵션|수량|색상|사이즈|필수|추가|옵션\s*선택)/i.test(text)) return true;
    if (/선택해\s*주세요|선택하세요|필수\s*옵션|추가\s*옵션/i.test(text)) return true;
    if (/^\d+원$/.test(text) || /^\d+$/.test(text)) return true;
    if (/^PAS모드|^배터리용량|^추가\s*옵션/i.test(text) && text.length < 25) return true;
    return false;
  }

  function cleanNaverOptionLine(text) {
    var t = String(text || '').replace(/\s+/g, ' ').trim();
    t = t.replace(/적립\s*포인트/gi, ' ');
    t = t.replace(/최대\s*적립/gi, ' ');
    t = t.replace(/자세히\s*보기/gi, ' ');
    t = t.replace(/상품\s*바로가기/gi, ' ');
    t = t.replace(/이\s*상품담기/gi, ' ');
    t = t.replace(/상품명/gi, ' ');
    t = t.replace(/\d{1,3}(?:,\d{3})+\s*원|\d{4,9}\s*원/g, ' ').trim();
    t = t.replace(/\s*\d+\s*개\s*$/g, '').trim();
    t = t.replace(/\s*[-—]\s*\d+\s*\+\s*$/g, '').trim();
    t = t.replace(/^\s*[-+]\s*\d+\s*[-+]\s*/g, '').trim();
    t = t.replace(/\s*[xX×]\s*$/g, '').trim();
    t = t.replace(/\s*삭제\s*$/g, '').trim();
    return t.replace(/\s+/g, ' ').trim();
  }

  /** 옵션 선택 후 나타나는 요약 줄 (빨간 박스 영역) */
  function extractNaverSelectedSummaryRow() {
    var buyRoot = getNaverBuyPanel();

    var best = '';
    var bestScore = 0;

    buyRoot.querySelectorAll('div, li, span, p, em, strong, a, button').forEach(function (el) {
      if (el.children.length > 6) return;
      var t = cleanNaverOptionLine(el.textContent);
      if (!t || t.length < 6 || t.length > 180) return;
      if (/총\s*\d+\s*개|총\s*금액|배송비|무료배송|구매하기|장바구니|찜하기|톡톡|네이버페이|상품\s*바로가기|이\s*상품담기/i.test(t)) return;

      var score = 0;
      if (/\s\/\s/.test(t)) score += 80;
      if (/\([^)]{1,30}\)/.test(t)) score += 10;
      if (el.closest('[class*="product_item"], [class*="ProductItem"], [class*="option_result"], [class*="selected"]')) {
        score += 30;
      }
      if (el.querySelector('button, [class*="delete"], [class*="remove"], [class*="close"]')) score += 25;
      score += Math.min(t.length, 60);
      if (el.children.length <= 2) score += 15;

      if (score > bestScore && !isNaverOptionNoise(t)) {
        bestScore = score;
        best = t;
      }
    });

    return best;
  }

  /** 드롭다운(select)에서 선택된 옵션 조합 */
  function extractNaverFromDropdowns() {
    var parts = [];
    var selects = document.querySelectorAll(
      '[class*="product_option"] select, [class*="ProductOption"] select, ' +
      '[class*="option_area"] select, [class*="product_detail"] select, #content select'
    );

    selects.forEach(function (sel) {
      if (!sel.value || sel.selectedIndex < 0) return;
      var opt = sel.options[sel.selectedIndex];
      var label = (opt && opt.textContent || '').replace(/\s+/g, ' ').trim();
      if (!label || isNaverOptionNoise(label)) return;
      if (/선택|필수|추가\s*옵션|옵션\s*선택/i.test(label) && label.length < 20) return;
      if (parts.indexOf(label) < 0) parts.push(label);
    });

    return parts.join(' / ').slice(0, 200);
  }

  function ensureNaverMainProductRow(items) {
    if (!items || !items.length) return items || [];

    var hasMain = items.some(function (it) {
      return it.name && !/^\(옵션\d+\)/.test(it.name);
    });
    if (hasMain) return items;

    var addonItems = items.filter(function (it) {
      return it.name && /^\(옵션\d+\)/.test(it.name);
    });
    if (!addonItems.length) return items;

    var title = extractNaverTitleFromDom();
    if (!title) title = cleanNaverProductTitle(metaContent('og:title'));
    title = shortenNaverOptionName(title);
    if (!title || title.length < 4) return items;

    var total = extractNaverTotalPriceFromDom();
    var addonSum = addonItems.reduce(function (acc, it) {
      return acc + (it.price || 0);
    }, 0);
    var mainPrice = null;
    if (total && addonSum && total > addonSum) {
      mainPrice = total - addonSum;
    } else {
      var scripts = extractNaverFromScripts();
      if (scripts && scripts.price && isValidNaverPrice(scripts.price)) {
        mainPrice = scripts.price;
      }
    }

    items.unshift({ name: title, price: mainPrice });
    return items;
  }

  function formatNaverOptionList(items) {
    if (!items || !items.length) return '';
    if (items.length === 1) return items[0].name.slice(0, 300);
    return items.map(function (item, idx) {
      return '(' + (idx + 1) + ') ' + item.name;
    }).join('  ').slice(0, 300);
  }

  function formatGmarketOptionList(items) {
    if (!items || !items.length) return '';
    if (items.length === 1) return items[0].name.slice(0, 280);
    return items.map(function (item, idx) {
      return '(' + (idx + 1) + ') ' + String(item.name || '').slice(0, 130);
    }).join('  ').slice(0, 600);
  }

  function extractNaverOptions() {
    var items = extractNaverSelectedItemRows();
    if (items.length) return formatNaverOptionList(items);

    var summary = extractNaverSelectedSummaryRow();
    if (summary) return summary;

    var fromDropdowns = extractNaverFromDropdowns();
    if (fromDropdowns) return fromDropdowns;

    return '';
  }

  function extractNaverSmartStore() {
    var scripts = extractNaverFromScripts();
    var ogTitle = cleanNaverProductTitle(metaContent('og:title'));
    var domTitle = extractNaverTitleFromDom();
    var scriptTitle = cleanNaverProductTitle(scripts.title);

    var title = '';
    if (domTitle && domTitle.length >= 8) {
      title = domTitle;
    } else if (scriptTitle && !isBadTitle(scriptTitle)) {
      title = scriptTitle;
    } else if (ogTitle && !isBadTitle(ogTitle)) {
      title = ogTitle;
    } else if (domTitle) {
      title = domTitle;
    }

    title = cleanNaverProductTitle(title);

    var price = resolveNaverPrice(scripts);
    var option = extractNaverOptions();

    return { title: title, price: price, option: option };
  }

  function extractCoupangFromNextData() {
    var result = { title: '', price: null };
    var productId = getCoupangProductId();
    var vendorItemId = getCoupangVendorItemId();
    var scopeIds = [productId, vendorItemId].filter(Boolean);
    var nextEl = document.getElementById('__NEXT_DATA__');
    var source = nextEl ? (nextEl.textContent || '') : '';
    if (!source) return result;

    function nodeMatchesScope(node) {
      if (!node || typeof node !== 'object') return false;
      var ids = [
        node.itemId,
        node.vendorItemId,
        node.productId,
        node.id
      ].map(function (v) { return v != null ? String(v) : ''; }).filter(Boolean);
      for (var i = 0; i < scopeIds.length; i++) {
        if (ids.indexOf(scopeIds[i]) >= 0) return true;
      }
      return false;
    }

    function applyNode(node) {
      if (!node || typeof node !== 'object') return;
      if (!nodeMatchesScope(node)) return;
      if (!result.title && node.itemName) {
        var n = cleanTitle(String(node.itemName));
        if (!isBadTitle(n)) result.title = n;
      }
      if (!result.price) {
        var p = node.salePrice || node.discountedSalePrice || node.finalPrice || node.priceAmount || node.price;
        if (p) result.price = PH.normalizePrice(p);
      }
    }

    try {
      var data = JSON.parse(source);
      var walk = function (node, depth) {
        if (!node || depth > 14) return;
        if (Array.isArray(node)) {
          for (var i = 0; i < node.length; i++) walk(node[i], depth + 1);
          return;
        }
        if (typeof node !== 'object') return;
        applyNode(node);
        var keys = Object.keys(node);
        for (var k = 0; k < keys.length; k++) walk(node[keys[k]], depth + 1);
      };
      walk(data, 0);
    } catch (e) { /* fall through to regex */ }

    if (scopeIds.length) {
      scopeIds.forEach(function (scopeId) {
        if (!result.price) {
          var scopedPrice = new RegExp(
            '"(?:itemId|vendorItemId|productId|id)"\\s*:\\s*"?'+ scopeId + '"?[\\s\\S]{0,25000}?' +
            '"(?:salePrice|discountedSalePrice|finalPrice|priceAmount)"\\s*:\\s*(\\d{3,9})',
            'i'
          );
          var priceMatch = source.match(scopedPrice);
          if (priceMatch) result.price = PH.normalizePrice(priceMatch[1]);
        }

        if (!result.title) {
          var scopedTitle = new RegExp(
            '"(?:itemId|vendorItemId|productId|id)"\\s*:\\s*"?'+ scopeId + '"?[\\s\\S]{0,25000}?' +
            '"itemName"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"',
            'i'
          );
          var titleMatch = source.match(scopedTitle);
          if (titleMatch) {
            var scopedName = cleanTitle(unescapeJsonString(titleMatch[1]));
            if (!isBadTitle(scopedName)) result.title = scopedName;
          }
        }

        if (!result.title) {
          var scopedTitle2 = new RegExp(
            '"itemName"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"[\\s\\S]{0,25000}?' +
            '"(?:itemId|vendorItemId|productId)"\\s*:\\s*"?'+ scopeId + '"?',
            'i'
          );
          var titleMatch2 = source.match(scopedTitle2);
          if (titleMatch2) {
            var scopedName2 = cleanTitle(unescapeJsonString(titleMatch2[1]));
            if (!isBadTitle(scopedName2)) result.title = scopedName2;
          }
        }
      });
    }

    if (!result.title) {
      var names = [];
      var nameRe = /"itemName"\s*:\s*"((?:\\.|[^"\\])*)"/g;
      var nm;
      while ((nm = nameRe.exec(source)) !== null) {
        var n2 = cleanTitle(unescapeJsonString(nm[1]));
        if (n2 && !isBadTitle(n2) && /[가-힣]/.test(n2) && n2.length >= 8) names.push(n2);
      }
      if (names.length) {
        names.sort(function (a, b) { return b.length - a.length; });
        result.title = names[0];
      }
    }

    if (!result.price) {
      var salePrices = [];
      var saleRe = /"(?:salePrice|discountedSalePrice|finalPrice|priceAmount)"\s*:\s*(\d{3,9})/g;
      var sm;
      while ((sm = saleRe.exec(source)) !== null) {
        var sp = PH.normalizePrice(sm[1]);
        if (isValidNaverPrice(sp)) salePrices.push(sp);
      }
      result.price = pickBestCoupangPrice(salePrices);
    }

    return result;
  }

  function extractGmarketFromScripts() {
    var html = document.documentElement.innerHTML;
    var result = { title: '', price: null };
    var names = [];
    [
      /"goodsName"\s*:\s*"((?:\\.|[^"\\])*)"/g,
      /"gdscNm"\s*:\s*"((?:\\.|[^"\\])*)"/g,
      /"dispName"\s*:\s*"((?:\\.|[^"\\])*)"/g,
      /"itemName"\s*:\s*"((?:\\.|[^"\\])*)"/g,
      /"productName"\s*:\s*"((?:\\.|[^"\\])*)"/g
    ].forEach(function (re) {
      var m;
      while ((m = re.exec(html)) !== null) {
        var n = cleanTitle(unescapeJsonString(m[1]));
        if (n && !isBadTitle(n)) names.push(n);
      }
    });
    if (names.length) {
      names.sort(function (a, b) { return b.length - a.length; });
      result.title = names[0];
    }

    var prices = [];
    [/\"sellPrice\"\s*:\s*(\d+)/g, /\"salePrice\"\s*:\s*(\d+)/g, /\"price\"\s*:\s*(\d+)/g,
      /\"finalPrice\"\s*:\s*(\d+)/g, /\"discountedSalePrice\"\s*:\s*(\d+)/g]
      .forEach(function (re) {
        var pm;
        while ((pm = re.exec(html)) !== null) {
          var p = PH.normalizePrice(pm[1]);
          if (isValidNaverPrice(p)) prices.push(p);
        }
      });
    if (prices.length) result.price = Math.min.apply(null, prices);
    return result;
  }

  function extractGmarketTitleFromVisibleDom() {
    var roots = [
      document.querySelector('.item-topinfo_head, .item-topinfo_detail, .box__item-info, .item-topinfo'),
      document.querySelector('#container'),
      document.body
    ];
    var candidates = [];
    var seen = {};

    roots.forEach(function (root) {
      if (!root) return;
      queryDeepAll('h1, h2, [class*="itemtit"], [class*="item-title"], [class*="product-title"]', root, 50)
        .forEach(function (el) {
          if (el.closest('nav, footer, [class*="review"], [class*="relation"], [class*="recommend"]')) return;
          var t = cleanTitle(el.textContent);
          if (!t || isBadTitle(t) || !/[가-힣]/.test(t) || t.length < 6) return;
          if (seen[t]) return;
          seen[t] = true;
          var score = t.length;
          if (el.tagName === 'H1') score += 40;
          if (el.closest('.item-topinfo, .box__item-info, [class*="item-topinfo"]')) score += 30;
          candidates.push({ t: t, score: score });
        });
    });

    if (!candidates.length) return '';
    candidates.sort(function (a, b) { return b.score - a.score; });
    return candidates[0].t;
  }

  function extractFromScripts() {
    var host = location.hostname.toLowerCase();
    if (host.indexOf('coupang') >= 0) {
      return extractCoupangFromNextData();
    }
    if (host.indexOf('gmarket') >= 0 || host.indexOf('auction') >= 0) {
      return extractGmarketFromScripts();
    }

    var result = { title: '', price: null };
    var html = document.documentElement.innerHTML;

    result.price = firstPriceMatch(html, [
      /"discountedSalePrice"\s*:\s*(\d{3,9})/,
      /"salePrice"\s*:\s*(\d{3,9})/,
      /"finalPrice"\s*:\s*(\d{3,9})/,
      /"priceAmount"\s*:\s*(\d{3,9})/
    ]);

    var titleMatch = html.match(/"itemName"\s*:\s*"([^"]{4,200})"/) ||
      html.match(/"productName"\s*:\s*"([^"]{4,200})"/) ||
      html.match(/"title"\s*:\s*"([^"]{4,200})"/);
    if (titleMatch) {
      try {
        result.title = cleanTitle(JSON.parse('"' + titleMatch[1].replace(/\\/g, '\\\\') + '"'));
      } catch (e) {
        result.title = cleanTitle(titleMatch[1]);
      }
    }

    var nextEl = document.getElementById('__NEXT_DATA__');
    if (nextEl) {
      try {
        var visited = 0;
        var walk = function (node) {
          if (!node || typeof node !== 'object' || visited > 4000) return;
          visited++;
          if (Array.isArray(node)) {
            node.forEach(walk);
            return;
          }
          if (node.itemName && !result.title) result.title = cleanTitle(node.itemName);
          if (node.productName && !result.title) result.title = cleanTitle(node.productName);
          if (node.salePrice && !result.price) result.price = PH.normalizePrice(node.salePrice);
          if (node.discountedSalePrice && !result.price) result.price = PH.normalizePrice(node.discountedSalePrice);
          Object.keys(node).forEach(function (k) {
            if (node[k] && typeof node[k] === 'object') walk(node[k]);
          });
        };
        walk(JSON.parse(nextEl.textContent || '{}'));
      } catch (e) { /* ignore */ }
    }

    return result;
  }

  function parseJsonLd() {
    var result = { title: '', price: null, image: '' };
    document.querySelectorAll('script[type="application/ld+json"]').forEach(function (script) {
      try {
        var data = JSON.parse(script.textContent || '');
        var nodes = Array.isArray(data) ? data : [data];
        nodes.forEach(function walk(node) {
          if (!node || typeof node !== 'object') return;
          if (node['@graph']) node['@graph'].forEach(walk);
          var type = String(node['@type'] || '').toLowerCase();
          if (node.name && !result.title) result.title = cleanTitle(node.name);
          if (type.indexOf('product') >= 0 && node.name) result.title = cleanTitle(node.name);
          if (node.image && !result.image) {
            result.image = Array.isArray(node.image) ? node.image[0] : String(node.image);
          }
          var offers = node.offers;
          var offerList = Array.isArray(offers) ? offers : offers ? [offers] : [];
          offerList.forEach(function (offer) {
            if (!offer) return;
            var p = PH.normalizePrice(offer.price || offer.lowPrice || offer.highPrice);
            if (p) result.price = result.price ? Math.min(result.price, p) : p;
          });
        });
      } catch (e) { /* ignore */ }
    });
    return result;
  }

  function rowLooksLikeGmarketSelectItem(row) {
    if (!row || typeof row.matches !== 'function') return false;
    return row.matches(
      '.select-item, .box__option-item, .box__selected-option, ' +
      '[class*="select-item"], [class*="option-item"], [class*="selected-option"], ' +
      '.list-option__item, .list-form__option-item'
    );
  }

  function isGmarketSelectedItemRow(row) {
    if (!row || isInsideGmarketDropdownMenu(row) || isInsideGmarketNoiseZone(row)) return false;
    if (!hasGmarketQuantityControl(row)) return false;
    var text = (row.textContent || '').replace(/\s+/g, ' ').trim();
    if (text.length < 8 || text.length > 400) return false;
    if (/장바구니|구매하기|옵션선택|선택해\s*주세요/i.test(text)) return false;
    if (/상품\s*\d+/i.test(text) && !gmarketRowHasPrice(text)) return false;
    return true;
  }

  function getGmarketConfirmedSelectItems() {
    var items = [];
    var seen = typeof WeakSet !== 'undefined' ? new WeakSet() : null;
    var root = document.querySelector(
      '#coreInsOrder, .section__order, [class*="item-topinfo"], [class*="option_area"], .item-topinfo'
    ) || document.body;
    getGmarketLeafSelectItems(root).forEach(function (row) {
      if (seen && seen.has(row)) return;
      if (!isGmarketSelectedItemRow(row)) return;
      if (seen) seen.add(row);
      items.push(row);
    });
    return items;
  }

  function getGmarketLowestCommonAncestor(nodes) {
    if (!nodes || !nodes.length) return null;
    var lca = nodes[0];
    for (var i = 1; i < nodes.length; i++) {
      while (lca && !lca.contains(nodes[i])) lca = lca.parentElement;
      if (!lca) return null;
    }
    return lca;
  }

  function getGmarketOrderRoot() {
    var core = document.querySelector('#coreInsOrder');
    if (core) return core;
    var order = document.querySelector(
      '.section__order, .box__item-order, [class*="item-topinfo_order"], [class*="box__item-order"]'
    );
    if (order) return order;

    var confirmed = getGmarketConfirmedSelectItems();
    if (confirmed.length >= 2) {
      var lca = getGmarketLowestCommonAncestor(confirmed);
      if (lca && lca !== document.body) return lca;
    }
    if (confirmed.length === 1) {
      var oneParent = confirmed[0].closest(
        '[class*="order"], [class*="option"], [class*="item-topinfo"], [class*="buy"]'
      );
      if (oneParent) return oneParent;
      if (confirmed[0].parentElement) return confirmed[0].parentElement;
    }

    var sample = document.querySelector('.select-item, [class*="select-item"], [class*="selected-option"]');
    if (sample) {
      if (isInsideGmarketDropdownMenu(sample)) {
        sample = null;
        document.querySelectorAll('.select-item, [class*="select-item"], [class*="selected-option"]').forEach(function (el) {
          if (!sample && !isInsideGmarketDropdownMenu(el) && isGmarketSelectedItemRow(el)) sample = el;
        });
      }
      if (sample) {
        var parent = sample.closest('[class*="order"], [class*="option"], [class*="item-topinfo"]');
        if (parent) return parent;
      }
    }
    return null;
  }

  function getGmarketBuyPanel() {
    var panel = document.querySelector(
      '#coreInsOrder, .section__order, .box__item-order, ' +
      '.box__item-detail-info, .item-topinfo_detail, .box__item-info, ' +
      '[class*="item-topinfo"], [class*="box__item"], [class*="item-topinfo_order"], ' +
      '#itemcase_detail, [id*="ItemCase"], [class*="buy_area"], [class*="order_area"], ' +
      '[class*="option_area"], .item-topinfo, #container'
    );
    if (panel) return panel;
    var order = getGmarketOrderRoot();
    return order || document.body;
  }

  function getGmarketLeafSelectItems(root) {
    if (!root) return [];
    var items = [];
    var seen = typeof WeakSet !== 'undefined' ? new WeakSet() : null;
    root.querySelectorAll(
      '.select-item, .box__option-item, .box__selected-option, ' +
      '[class*="select-item"], [class*="option-item"], [class*="selected-option"], ' +
      '.list-option__item, .list-form__option-item'
    ).forEach(function (el) {
      if (seen && seen.has(el)) return;
      var inner = el.querySelector(
        '.select-item, .box__option-item, [class*="select-item"], [class*="option-item"], [class*="selected-option"]'
      );
      if (inner && inner !== el) return;
      if (seen) seen.add(el);
      items.push(el);
    });
    return items;
  }

  function isGmarketLikelyCartLine(row) {
    if (!row) return false;
    var text = (row.textContent || '').replace(/\s+/g, ' ').trim();
    return (
      hasGmarketQuantityControl(row) &&
      /\d{1,3}(?:,\d{3})+\s*원/.test(text) &&
      (rowLooksLikeGmarketSelectItem(row) || /상품\s*\d+\s*[.．]?/i.test(text))
    );
  }

  function isInsideGmarketDropdownMenu(el) {
    if (!el || typeof el.closest !== 'function') return false;
    if (isGmarketLikelyCartLine(el)) return false;

    return !!el.closest(
      '[class*="dropdown"] [class*="list"], [class*="dropdown"] ul, [class*="dropdown"] ol, ' +
      '[role="listbox"], [class*="option_layer"], [class*="layer_option"], [class*="popup"], ' +
      '[class*="select-list"]:not([class*="selected"]), [aria-expanded="true"] + ul'
    );
  }

  function isInsideGmarketNoiseZone(el) {
    if (!el || typeof el.closest !== 'function') return false;
    return !!el.closest(
      'nav, footer, [class*="recommend"], [class*="relation"], [class*="related"], ' +
      '[class*="together"], [class*="banner"], [class*="review"], [class*="qna"]'
    );
  }

  function forEachDeepElement(root, fn) {
    if (!root || !fn) return;
    var stack = [root];
    while (stack.length) {
      var node = stack.pop();
      if (!node || node.nodeType !== 1) continue;
      fn(node);
      if (node.shadowRoot) stack.push(node.shadowRoot);
      var kids = node.children;
      for (var i = kids.length - 1; i >= 0; i--) stack.push(kids[i]);
    }
  }

  function gmarketRowHasPrice(text) {
    return /\d{1,3}(?:,\d{3})+(?:\s*원)?/.test(String(text || ''));
  }

  function isGmarketPromoOrPaymentNoise(text) {
    if (!text) return true;
    if (/카드\s*무이자|무이자\s*할부|무이자\s*\(|할부\s*행사|제휴\s*카드|카드\s*추가\s*혜택/i.test(text)) return true;
    if (/월\s*X|개월\s*무이자|나라사랑|결제\s*할인|Smile\s*Pay|할인\s*혜택/i.test(text)) return true;
    return false;
  }

  function getGmarketOptionCartRoot() {
    var candidates = [];

    forEachDeepElement(document.body, function (el) {
      if (el === document.body || isInsideGmarketNoiseZone(el)) return;
      if (el.children.length > 45) return;
      var text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (text.length < 40) return;
      if (!/총\s*금액/i.test(text)) return;
      if (!/상품\s*\d+\s*[.．]/i.test(text)) return;
      if (!/장바구니|구매하기/.test(text)) return;
      var catalogCount = (text.match(/상품\s*\d+\s*[.．]/gi) || []).length;
      if (!catalogCount) return;
      candidates.push({ el: el, len: text.length, count: catalogCount });
    });

    if (candidates.length) {
      candidates = candidates.filter(function (c) { return c.count <= 8; });
      if (!candidates.length) {
        candidates = [];
        forEachDeepElement(document.body, function (el) {
          if (el === document.body || isInsideGmarketNoiseZone(el)) return;
          if (el.children.length > 45) return;
          var t = (el.textContent || '').replace(/\s+/g, ' ').trim();
          if (t.length < 40 || !/총\s*금액/i.test(t)) return;
          if (!/상품\s*\d+\s*[.．]/i.test(t)) return;
          if (!/장바구니|구매하기/.test(t)) return;
          var cc = (t.match(/상품\s*\d+\s*[.．]/gi) || []).length;
          if (cc) candidates.push({ el: el, len: t.length, count: cc });
        });
      }
      candidates.sort(function (a, b) {
        if (a.count !== b.count) return a.count - b.count;
        return a.len - b.len;
      });
      return candidates[0].el;
    }

    var best = null;
    var bestScore = 0;
    forEachDeepElement(document.body, function (el) {
      if (el === document.body || isInsideGmarketNoiseZone(el)) return;
      var text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (text.length < 50 || text.length > 3200) return;

      var score = 0;
      if (/총\s*금액/i.test(text)) score += 45;
      if (/장바구니/.test(text)) score += 30;
      if (/구매하기/.test(text)) score += 30;
      var catalogMatches = text.match(/상품\s*0*\d+\s*[.．]/gi);
      if (catalogMatches) score += 35 * catalogMatches.length;
      if (hasGmarketQuantityControl(text)) score += 20;
      if (isGmarketPromoOrPaymentNoise(text) && !(catalogMatches && catalogMatches.length >= 1)) {
        score -= 100;
      }
      if (score > bestScore && score >= 80) {
        bestScore = score;
        best = el;
      }
    });

    if (best) return best;

    return document.querySelector(
      '#coreInsOrder, .section__order, [class*="box__item-order"], [class*="option_area"]'
    ) || getGmarketBuyPanel();
  }

  function isGmarketDropdownCatalogChunk(chunk) {
    var t = String(chunk || '').replace(/\s+/g, ' ').trim();
    if (/할인률\s*\d+\s*%?\s*기존가/i.test(t) && !/쿠폰\s*적용/.test(t)) return true;
    if (/기존가\s*$/i.test(t) && !/쿠폰\s*적용/.test(t) && !/[-+−－]\s*\d+\s*[-+−－＋]/.test(t)) {
      return true;
    }
    return false;
  }

  function isGmarketSelectedCartLineChunk(chunk) {
    var t = String(chunk || '').replace(/\s+/g, ' ').trim();
    if (!/^상품\s*0*\d+\s*[.．]/i.test(t)) return false;
    if (isGmarketDropdownCatalogChunk(t)) return false;
    if (!gmarketRowHasPrice(t)) return false;
    if (/쿠폰\s*적용/.test(t)) return true;
    if (/[-+−－]\s*\d+\s*[-+−－＋]/.test(t)) return true;
    if (!/할인률|기존가/i.test(t)) return true;
    return false;
  }

  function extractGmarketCatalogLinesFromText(root) {
    if (!root) return [];
    var text = (root.textContent || '').replace(/\s+/g, ' ').trim();
    if (!/상품\s*0*\d+\s*[.．]/i.test(text)) return [];

    var items = [];
    var seen = {};
    var chunks = text.split(/(?=상품\s*0*\d+\s*[.．])/i);

    chunks.forEach(function (chunk) {
      chunk = chunk.trim();
      if (!/^상품\s*0*\d+\s*[.．]/i.test(chunk)) return;
      if (!isGmarketSelectedCartLineChunk(chunk)) return;
      chunk = chunk.replace(/총\s*금액.*$/i, '').replace(/장바구니.*$/i, '').replace(/구매하기.*$/i, '').trim();

      var head = chunk.match(/^상품\s*0*(\d+)\s*[.．]\s*(.+)$/i);
      if (!head) return;

      var prices = head[2].match(/\d{1,3}(?:,\d{3})+(?:\s*원)?/g);
      if (!prices || !prices.length) return;
      var price = PH.normalizePrice(prices[prices.length - 1]);
      if (!isValidNaverPrice(price)) return;

      var body = head[2]
        .replace(/\s*[-+−－]\s*\d+\s*[-+−－＋].*$/i, '')
        .replace(/\s+\d{1,3}(?:,\d{3})+(?:\s*원)?\s*$/i, '')
        .replace(/\s*쿠폰\s*적용.*$/i, '')
        .replace(/\s*할인률\s*\d+\s*%?\s*기존가.*$/i, '')
        .replace(/\s*기존가\s*$/i, '')
        .trim();
      if (!body || body.length < 4) return;

      var name = finalizeGmarketOption('상품 ' + parseInt(head[1], 10) + '. ' + body);
      if (!isUsableGmarketOptionText(name)) return;
      var key = getGmarketCatalogOptionKey(name);
      if (seen[key]) return;
      seen[key] = true;
      items.push({ name: name, price: price });
    });

    return sortGmarketCatalogItems(items);
  }

  function extractGmarketCartTotalPrice(root) {
    root = root || getGmarketOptionCartRoot();
    var total = scanGmarketTotalInRoot(root);
    if (total) return total;
    var text = (root.textContent || '').replace(/\s+/g, ' ');
    var m = text.match(/총\s*금액[^0-9]{0,40}([\d,]{4,12})(?:\s*원)?/i);
    if (m) {
      var p = PH.normalizePrice(m[1]);
      if (isValidNaverPrice(p)) return p;
    }
    return null;
  }

  function pickBestGmarketCatalogItems(sources) {
    var cartTotal = extractGmarketCartTotalPrice(getGmarketOptionCartRoot());
    var best = [];
    var bestScore = -99999;

    sources.forEach(function (items) {
      if (!items || !items.length || items.length > 8) return;

      var score = 40;
      if (items.some(function (it) { return /할인률|기존가/i.test(it.name || ''); })) {
        score -= 400;
      }
      score -= items.length * 10;

      var sum = sumGmarketRowPrices(items);
      if (cartTotal && sum) {
        if (Math.abs(cartTotal - sum) <= 1500) score += 300;
        else if (sum > cartTotal * 1.2) score -= 200;
      }
      if (items.length >= 1 && items.length <= 6) score += 15;

      if (score > bestScore) {
        bestScore = score;
        best = items;
      }
    });
    return best;
  }

  function hasGmarketQuantityControl(row) {
    if (!row) return false;
    var text = typeof row === 'string' ? row : (row.textContent || '').replace(/\s+/g, ' ');
    if (/[+\-−－]\s*\d+\s*[+\-−＋]/.test(text)) return true;
    if (typeof row !== 'string' && row.querySelector(
      'input[type="number"], [class*="quantity"], [class*="qty"], [class*="spinner"], [class*="count"]'
    )) return true;
    if (typeof row !== 'string') {
      var nodes = row.querySelectorAll('button, a, span, div, input');
      var hasMinus = false;
      var hasPlus = false;
      for (var i = 0; i < nodes.length; i++) {
        var t = (nodes[i].textContent || '').trim();
        if (/^[\-−－]$/.test(t)) hasMinus = true;
        if (/^[\+＋]$/.test(t)) hasPlus = true;
      }
      if (hasMinus && hasPlus) return true;
    }
    return false;
  }

  function isGmarketOptionUiGarbage(text) {
    var t = String(text || '').replace(/\s+/g, ' ').trim();
    if (!t) return true;
    if (isGmarketPromoOrPaymentNoise(t)) return true;
    if (/\b열기\b/i.test(t)) return true;
    if (/\btest\b/i.test(t)) return true;
    if (/^상품\s*\d+\s*$/i.test(t)) return true;
    if (t.length < 14 && !/상품\s*0*\d+\s*[.．]\s*\S{5,}/.test(t)) return true;
    return false;
  }

  function isGmarketCartRemoveControl(btn) {
    if (!btn || btn.disabled) return false;
    var label = ((btn.getAttribute('aria-label') || '') + ' ' + (btn.getAttribute('title') || '') +
      ' ' + (btn.textContent || '')).replace(/\s+/g, ' ').trim();
    if (/장바구니|구매|쿠폰|찜|선물|열기|선택해|dropdown|옵션선택|선물하기/i.test(label)) return false;
    if (/삭제|제거|닫기|delete|remove|close/i.test(label)) return true;
    if (/^[xX×✕]$/.test(label)) return true;
    var cls = String(btn.className || '');
    if (/delete|remove|close|btn_del|btn-delete|btn_close|icon_close|del_item|btn-delete/i.test(cls)) {
      return true;
    }
    if (btn.tagName === 'BUTTON' || btn.tagName === 'A' || btn.getAttribute('role') === 'button') {
      var row = getGmarketCartRowFromNode(btn);
      if (row && /상품\s*0*\d+\s*[.．]/.test(row.textContent || '')) return true;
    }
    return false;
  }

  function getGmarketCartRowFromNode(node) {
    var el = node;
    for (var depth = 0; depth < 10 && el && el !== document.body; depth++) {
      if (isInsideGmarketNoiseZone(el)) return null;
      var text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (text.length < 12 || text.length > 380) {
        el = el.parentElement;
        continue;
      }
      if (/총\s*금액|총\s*\d+\s*개/.test(text) && text.length < 90) {
        el = el.parentElement;
        continue;
      }
      if (!gmarketRowHasPrice(text)) {
        el = el.parentElement;
        continue;
      }
      if (countGmarketCatalogOptionsInText(text) > 1) {
        el = el.parentElement;
        continue;
      }
      if (!hasGmarketQuantityControl(el)) {
        el = el.parentElement;
        continue;
      }
      var catalog = extractGmarketCatalogOptionName(text);
      if (catalog) {
        if (isGmarketOptionUiGarbage(catalog)) {
          el = el.parentElement;
          continue;
        }
        return el;
      }
      var cleaned = cleanGmarketOptionLine(text);
      if (!looksLikeGmarketOptionName(cleaned) || isGmarketOptionUiGarbage(cleaned)) {
        el = el.parentElement;
        continue;
      }
      return el;
    }
    return null;
  }

  function collectGmarketCatalogCartLines(root) {
    if (!root) return [];
    var items = [];
    var seen = {};

    function push(name, price) {
      name = finalizeGmarketOption(name);
      if (!name || !isUsableGmarketOptionText(name)) return;
      if (!/^상품\s*0*\d+\s*[.．]/i.test(name)) return;
      var key = getGmarketCatalogOptionKey(name);
      if (seen[key]) {
        for (var i = 0; i < items.length; i++) {
          if (getGmarketCatalogOptionKey(items[i].name) !== key) continue;
          if (name.length > items[i].name.length) items[i].name = name;
          if (price && (!items[i].price || price > items[i].price)) items[i].price = price;
          return;
        }
      }
      seen[key] = true;
      items.push({ name: name, price: price || null });
    }

    function addFromRow(row) {
      if (!row) return;
      var name = extractGmarketCatalogOptionName(row.textContent);
      if (!name) name = extractGmarketOptionNameFromRow(row);
      if (!name || !/^상품\s*0*\d+\s*[.．]/i.test(name)) return;
      push(name, extractGmarketPriceFromRow(row));
    }

    root.querySelectorAll('button, a, [role="button"], span, i, em').forEach(function (btn) {
      if (!isGmarketCartRemoveControl(btn)) return;
      addFromRow(getGmarketCartRowFromNode(btn));
    });

    root.querySelectorAll(
      'button, a, span, input[type="number"], [class*="quantity"], [class*="qty"], [class*="count"]'
    ).forEach(function (el) {
      var label = (el.textContent || '').trim();
      var isQty = el.type === 'number' || /^[+\-−－＋]$/.test(label) ||
        /quantity|qty|count|spinner/i.test(String(el.className || ''));
      if (!isQty) return;
      addFromRow(getGmarketCartRowFromNode(el));
    });

    forEachDeepElement(root, function (el) {
      if (el.children.length > 24) return;
      var text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (text.length < 20 || text.length > 340) return;
      if (countGmarketCatalogOptionsInText(text) !== 1) return;
      if (!/상품\s*0*\d+\s*[.．]/.test(text)) return;
      if (!gmarketRowHasPrice(text)) return;
      if (isGmarketPromoOrPaymentNoise(text)) return;
      if (isGmarketDropdownCatalogChunk(text)) return;
      if (!hasGmarketQuantityControl(el) && !/쿠폰\s*적용/.test(text)) return;

      var nested = false;
      var kids = el.querySelectorAll('li, div, tr');
      for (var ci = 0; ci < kids.length; ci++) {
        var child = kids[ci];
        if (child === el || nested) continue;
        var ct = (child.textContent || '').replace(/\s+/g, ' ').trim();
        if (ct.length >= 20 && countGmarketCatalogOptionsInText(ct) === 1 &&
            /상품\s*0*\d+\s*[.．]/.test(ct) && gmarketRowHasPrice(ct)) {
          nested = true;
        }
      }
      if (nested) return;
      addFromRow(el);
    });

    return items;
  }

  function collectGmarketRowsUniversal(root) {
    if (!root) return [];
    var items = [];
    var seen = {};

    function push(name, price) {
      name = finalizeGmarketOption(name);
      if (!name || !isUsableGmarketOptionText(name)) return;
      var key = getGmarketCatalogOptionKey(name);
      if (seen[key]) {
        for (var i = 0; i < items.length; i++) {
          if (getGmarketCatalogOptionKey(items[i].name) !== key) continue;
          if (name.length > items[i].name.length) items[i].name = name;
          if (price && (!items[i].price || price > items[i].price)) items[i].price = price;
          return;
        }
      }
      seen[key] = true;
      items.push({ name: name, price: price || null });
    }

    function addFromRow(row) {
      if (!row) return;
      var name = extractGmarketOptionNameFromRow(row);
      if (!name) return;
      push(name, extractGmarketPriceFromRow(row));
    }

    root.querySelectorAll('button, [role="button"], a, span, i, em').forEach(function (btn) {
      if (!isGmarketCartRemoveControl(btn)) return;
      addFromRow(getGmarketCartRowFromNode(btn));
    });

    root.querySelectorAll(
      'button, a, span, input[type="number"], [class*="quantity"], [class*="qty"], [class*="count"]'
    ).forEach(function (el) {
      var label = (el.textContent || '').trim();
      var isQty = el.type === 'number' || /^[+\-−－＋]$/.test(label) ||
        /quantity|qty|count|spinner/i.test(String(el.className || ''));
      if (!isQty) return;
      addFromRow(getGmarketCartRowFromNode(el));
    });

    root.querySelectorAll('li, div, tr, section, article').forEach(function (el) {
      if (el.children.length > 22) return;
      var text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (text.length < 18 || text.length > 340) return;
      if (countGmarketCatalogOptionsInText(text) !== 1) return;
      if (!/상품\s*0*\d+\s*[.．]/.test(text)) return;
      if (!/\d{1,3}(?:,\d{3})+\s*원/.test(text)) return;
      if (!hasGmarketQuantityControl(el)) return;
      if (isInsideGmarketNoiseZone(el)) return;

      var nested = false;
      el.querySelectorAll('li, div, tr').forEach(function (child) {
        if (child === el || nested) return;
        var ct = (child.textContent || '').replace(/\s+/g, ' ').trim();
        if (ct.length >= 18 && countGmarketCatalogOptionsInText(ct) === 1 &&
            /상품\s*0*\d+\s*[.．]/.test(ct) && /\d{1,3}(?:,\d{3})+\s*원/.test(ct) &&
            hasGmarketQuantityControl(child)) {
          nested = true;
        }
      });
      if (nested) return;
      addFromRow(el);
    });

    root.querySelectorAll(
      'li, div, .select-item, [class*="select-item"], [class*="option-item"], [class*="selected-option"]'
    ).forEach(function (el) {
      if (isInsideGmarketNoiseZone(el)) return;
      if (!hasGmarketQuantityControl(el)) return;
      var text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (text.length < 12 || text.length > 340) return;
      if (!/\d{1,3}(?:,\d{3})+\s*원/.test(text)) return;
      if (/상품\s*0*\d+\s*[.．]/.test(text)) return;
      if (isGmarketPromoOrPaymentNoise(text)) return;
      var cleaned = cleanGmarketOptionLine(text);
      if (/\s\+\s/.test(cleaned) || looksLikeGmarketOptionName(cleaned)) {
        addFromRow(el);
      }
    });

    return items;
  }

  function isGmarketRowRemoveButton(btn) {
    if (!btn) return false;
    var label = ((btn.getAttribute('aria-label') || '') + ' ' + (btn.textContent || '')).replace(/\s+/g, ' ').trim();
    if (/장바구니|구매|쿠폰|찜|선물|열기|선택해/i.test(label)) return false;
    if (/^(x|×|삭제|delete|remove|닫기|close)$/i.test(label)) return true;
    if (String(btn.className || '').match(/del|delete|remove|close/i)) return true;
    if ((btn.tagName === 'BUTTON' || btn.getAttribute('role') === 'button') && label.length <= 2) {
      var row = btn.closest('.select-item, [class*="select-item"], [class*="option-item"], li, div[class]');
      if (row && hasGmarketQuantityControl(row)) return true;
    }
    return false;
  }

  function isGmarketConfirmedCartLine(row) {
    if (!row || isInsideGmarketNoiseZone(row)) return false;
    if (!isGmarketLikelyCartLine(row)) return false;
    if (isInsideGmarketDropdownMenu(row)) return false;
    var text = (row.textContent || '').replace(/\s+/g, ' ').trim();
    if (/장바구니|구매하기|옵션선택|선택해\s*주세요/i.test(text)) return false;
    return true;
  }

  function isGmarketConfirmedSelectedRow(row) {
    if (!isGmarketSelectedItemRow(row)) return false;
    var text = (row.textContent || '').replace(/\s+/g, ' ').trim();
    return (
      rowLooksLikeGmarketSelectItem(row) ||
      !!row.querySelector(
        '.select-item, [class*="select-item"], [class*="selected-option"], [class*="option-item"]'
      ) ||
      !!row.querySelector(
        '[class*="delete"], [class*="del"], [class*="close"], [class*="remove"], [class*="btn-remove"]'
      ) ||
      /상품\s*\d+\s*[.．]?/i.test(text)
    );
  }

  function scoreGmarketOptionText(text) {
    if (!text || text.length < 6 || text.length > 160) return -1;
    if (isGmarketOptionNoise(text) && !/\s\+\s/.test(text)) return -1;
    var score = 0;
    if (/^상품\s*\d+\s*[.．]/i.test(text)) score += 85;
    if (/\s\+\s/.test(text)) score += 70;
    if (/\(\d+\s*km/i.test(text)) score += 25;
    if (/\d+\s*A(h)?\b/i.test(text)) score += 20;
    if (/모델|배터리|색상|사이즈|용량/i.test(text)) score += 10;
    if (/^\d+$/.test(text) || /^\d[\d,]*\s*원?$/.test(text)) return -1;
    return score;
  }

  function isUsableGmarketOptionText(text) {
    var t = String(text || '').replace(/\s+/g, ' ').trim();
    if (!t || t.length < 8) return false;
    if (/^(가|든|상|품|옵션|선택)$/i.test(t)) return false;
    if (isGmarketOptionUiGarbage(t)) return false;
    if (isGmarketOptionNoise(t)) return false;
    return true;
  }

  function getGmarketCatalogOptionKey(name) {
    var m = String(name || '').match(/상품\s*0*(\d+)/i);
    if (m) return 'cat-' + parseInt(m[1], 10);
    return String(name || '').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 100);
  }

  function countGmarketCatalogOptionsInText(text) {
    var matches = String(text || '').match(/상품\s*\d+\s*[.．]?/gi);
    return matches ? matches.length : 0;
  }

  function extractGmarketCatalogOptionName(text) {
    var raw = String(text || '').replace(/\s+/g, ' ').trim();
    var m = raw.match(/상품\s*(\d+)\s*[.．]?\s*(.+)/i);
    if (!m) return '';
    var body = m[2]
      .replace(/\s*[+-]\s*\d+\s*[+-].*$/, '')
      .replace(/\s+\d{1,3}(?:,\d{3})+(?:\s*원)?.*$/, '')
      .replace(/\s*(?:수량증가|수량감소|닫기|삭제|쿠폰적용|열기|test).*$/i, '')
      .replace(/\s*할인률\s*\d+\s*%?\s*기존가.*$/i, '')
      .replace(/\s*기존가\s*$/i, '')
      .replace(/^\s*열기\s*/i, '')
      .trim();
    if (!body || body.length < 4) return '';
    return finalizeGmarketOption('상품 ' + m[1] + '. ' + body);
  }

  function isGmarketCatalogOptionRow(row) {
    if (!isGmarketConfirmedSelectedRow(row)) return false;
    var text = (row.textContent || '').replace(/\s+/g, ' ').trim();
    if (!/상품\s*\d+\s*[.．]?/i.test(text)) return false;
    if (countGmarketCatalogOptionsInText(text) > 1) return false;

    var nested = 0;
    row.querySelectorAll('li, div[class]').forEach(function (child) {
      if (child === row) return;
      if (isGmarketConfirmedSelectedRow(child)) nested++;
    });
    return nested === 0;
  }

  function extractGmarketFromSelectedDropdownDisplay() {
    var buyRoot = getGmarketBuyPanel();
    var best = '';
    buyRoot.querySelectorAll(
      'button, [class*="dropdown"], [class*="select"] button, [class*="option"] button, ' +
      '[class*="option"] [class*="value"], [class*="select"] [class*="selected"]'
    ).forEach(function (el) {
      if (/장바구니|구매하기|선물하기|열기$/i.test((el.textContent || '').trim())) return;
      var t = extractGmarketCatalogOptionName(el.textContent) ||
        cleanGmarketOptionLine(getGmarketOptionTextFromEl(el) || el.textContent);
      if (!isUsableGmarketOptionText(t)) return;
      if (!/^상품\s*\d+/i.test(t) && t.length < 12) return;
      if (t.length > best.length) best = t;
    });
    return best;
  }

  function extractGmarketOptionByPattern() {
    var roots = [getGmarketBuyPanel()];
    if (roots[0] !== document.body) roots.push(document.body);

    var best = '';
    var bestScore = 0;
    roots.forEach(function (root) {
      root.querySelectorAll('div, li, span, p, strong, dd, dt, label, a').forEach(function (el) {
        if (el.children.length > 12) return;
        var raw = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (raw.length < 8 || raw.length > 200) return;
        if (/^장바구니$|^구매하기$|^옵션선택$/i.test(raw)) return;

        var t = getGmarketOptionTextFromEl(el);
        if (!t) t = cleanGmarketOptionLine(raw);
        var score = scoreGmarketOptionText(t);
        if (score < 0) return;
        if (/\d{1,3}(?:,\d{3})+\s*원/.test(raw)) score += 12;
        if (/쿠폰\s*적용/.test(raw)) score += 15;
        if (el.closest('#coreInsOrder, [class*="order"], [class*="option"], [class*="select"]')) {
          score += 10;
        }
        score += Math.max(0, 18 - el.children.length * 3);

        if (score > bestScore) {
          bestScore = score;
          best = t;
        }
      });
    });
    return bestScore >= 45 && isUsableGmarketOptionText(best) ? finalizeGmarketOption(best) : '';
  }

  function extractGmarketFromActiveDropdowns() {
    var parts = [];
    getGmarketBuyPanel().querySelectorAll(
      '[class*="dropdown"] [class*="value"], [class*="dropdown"] [class*="selected"], ' +
      '[class*="select"] [class*="on"], [class*="select"] [class*="active"], ' +
      'button[aria-expanded="true"], [class*="option"] [class*="active"]'
    ).forEach(function (el) {
      var t = extractGmarketCatalogOptionName(el.textContent) ||
        cleanGmarketOptionLine(el.textContent);
      if (!isUsableGmarketOptionText(t) || t.length > 200 || isGmarketOptionNoise(t)) return;
      if (/^(모델|배터리|옵션|선택)$/i.test(t)) return;
      if (parts.indexOf(t) < 0) parts.push(t);
    });
    if (parts.length >= 1) return parts.join(' + ').slice(0, 300);
    return '';
  }

  function isGmarketOptionNoise(text) {
    if (!text) return true;
    if (isGmarketOptionUiGarbage(text)) return true;
    if (isGmarketPromoOrPaymentNoise(text)) return true;
    if (/^쿠폰\s*적용$|^장바구니$|^구매하기$|^찜하기$/i.test(text)) return true;
    if (/총\s*금액|총\s*\d+\s*개|옵션\s*선택|선택해\s*주세요/i.test(text)) return true;
    if (/^모델$|^배터리$|^옵션$/i.test(text)) return true;
    if (/^수량증가$|^수량감소$|^닫기$|^삭제$|^열기$/i.test(text)) return true;
    if (/^\d+$/.test(text)) return true;
    return false;
  }

  function stripGmarketUiLabels(text) {
    return stripMallUiLabels(text);
  }

  function getGmarketOptionTextFromEl(el) {
    return getOptionTextFromEl(el);
  }

  function cleanGmarketOptionLine(text) {
    var t = stripGmarketUiLabels(text);
    t = t.replace(/\b열기\b/gi, ' ').replace(/\btest\b/gi, ' ').trim();
    t = t.replace(/\s*할인률\s*\d+\s*%?\s*기존가.*$/i, '').trim();
    t = t.replace(/\s*기존가\s*$/i, '').trim();
    t = t.replace(/\d{1,3}(?:,\d{3})+(?:\s*원)?/g, ' ').trim();
    t = t.replace(/^\s*[-+]\s*\d+\s*[-+]\s*/g, '').trim();
    t = t.replace(/\s*[-—]\s*\d+\s*\+\s*$/g, '').trim();
    t = t.replace(/\s+(?:수량증가|수량감소|닫기|삭제|쿠폰적용)(?:\s+.*)?$/i, '').trim();
    t = t.replace(/\s+/g, ' ').trim();

    var plusIdx = t.indexOf(' + ');
    if (plusIdx >= 0) {
      var before = t.slice(0, plusIdx).trim();
      var after = t.slice(plusIdx + 3).trim();
      after = after.replace(/\s*(?:수량증가|수량감소|닫기|삭제|쿠폰적용).*$/i, '').trim();
      after = after.replace(/\s+\d+\s*$/, '').trim();
      if (before && after) return before + ' + ' + after;
    }
    return t;
  }

  function finalizeGmarketOption(option) {
    return cleanGmarketOptionLine(option);
  }

  function looksLikeGmarketOptionName(name) {
    if (!name || name.length < 3 || name.length > 160) return false;
    if (isGmarketPromoOrPaymentNoise(name)) return false;
    if (/^상품\s*\d+\s*[.．]?/i.test(name)) return !isGmarketOptionNoise(name);
    if (/\s\+\s/.test(name) && name.length >= 8) return !isGmarketOptionNoise(name);
    if (/[가-힣A-Za-z][^:：]{1,40}\s*[:：]\s*\S{2,}/.test(name)) return !isGmarketOptionNoise(name);
    if (isGmarketOptionNoise(name)) return false;
    if (/\d+\s*(Ah|A|km|W|V)\b/i.test(name)) return true;
    if (/\([^)]{2,40}\)/.test(name)) return true;
    if (/모델|색상|사이즈|용량|세트|주행|예초|부착|트리머|체인|호파|괭이|천길/i.test(name) && name.length >= 6) {
      return true;
    }
    return false;
  }

  function extractGmarketOptionNameFromRow(row) {
    var catalog = extractGmarketCatalogOptionName(row.textContent);
    if (isUsableGmarketOptionText(catalog)) return catalog;

    var fromClone = getGmarketOptionTextFromEl(row);
    if (fromClone && (looksLikeGmarketOptionName(fromClone) || /\s\+\s/.test(fromClone))) {
      var cleanedClone = finalizeGmarketOption(fromClone);
      if (isUsableGmarketOptionText(cleanedClone)) return cleanedClone;
    }

    var candidates = [];
    row.querySelectorAll('strong, span, p, em, div, a').forEach(function (el) {
      if (el.children.length > 3) return;
      var t = extractGmarketCatalogOptionName(el.textContent) || cleanGmarketOptionLine(el.textContent);
      if (t && t.length >= 8 && t.length <= 150) candidates.push(t);
    });
    var cleaned = cleanGmarketOptionLine(row.textContent);
    if (cleaned && cleaned.length >= 8) candidates.push(cleaned);

    candidates.sort(function (a, b) {
      return scoreGmarketOptionText(b) - scoreGmarketOptionText(a);
    });

    for (var i = 0; i < candidates.length; i++) {
      if (!isUsableGmarketOptionText(candidates[i])) continue;
      if (looksLikeGmarketOptionName(candidates[i]) || /\s\+\s/.test(candidates[i])) {
        return finalizeGmarketOption(candidates[i]);
      }
    }
    return '';
  }

  function extractGmarketPriceFromRow(row) {
    if (!row) return null;
    var prices = [];

    function collectFromEl(el) {
      if (!el || isStrikethroughPrice(el) || isGmarketPriceNoiseContext(el)) return;
      var text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text || text.length > 120) return;
      var re = /\d{1,3}(?:,\d{3})+(?:\s*원)?|\d{4,9}(?:\s*원)?/g;
      var m;
      while ((m = re.exec(text)) !== null) {
        var p = PH.normalizePrice(m[0]);
        if (isValidNaverPrice(p)) prices.push(p);
      }
    }

    row.querySelectorAll('span, strong, em, b, p, div').forEach(collectFromEl);
    if (!prices.length) collectFromEl(row);
    if (!prices.length) return null;

    prices = prices.filter(function (p, i, arr) { return arr.indexOf(p) === i; });
    if (prices.length === 1) return prices[0];
    prices.sort(function (a, b) { return a - b; });
    return prices[prices.length - 1];
  }

  function sortGmarketCatalogItems(items) {
    return items.sort(function (a, b) {
      var ka = getGmarketCatalogOptionKey(a.name);
      var kb = getGmarketCatalogOptionKey(b.name);
      var na = /^cat-(\d+)$/.test(ka) ? parseInt(ka.slice(4), 10) : 9999;
      var nb = /^cat-(\d+)$/.test(kb) ? parseInt(kb.slice(4), 10) : 9999;
      if (na !== nb) return na - nb;
      return a.name.length - b.name.length;
    });
  }

  function collectGmarketRowsFromLeaves(roots, considerRow) {
    roots.forEach(function (root) {
      if (!root) return;
      getGmarketLeafSelectItems(root).forEach(function (row) {
        if (isGmarketConfirmedCartLine(row)) considerRow(row);
      });
    });
  }

  function rebuildGmarketRowsFromCartLines() {
    var cartRoot = getGmarketOptionCartRoot();
    var items = pickBestGmarketCatalogItems([
      collectGmarketCatalogCartLines(cartRoot),
      extractGmarketCatalogLinesFromText(cartRoot)
    ]);
    if (items.length) return sortGmarketCatalogItems(items);
    return sortGmarketCatalogItems(collectGmarketRowsUniversal(cartRoot));
  }

  function extractGmarketSelectedRowsWithPrices() {
    var cartRoot = getGmarketOptionCartRoot();
    var orderRoot = getGmarketOrderRoot();
    var items = pickBestGmarketCatalogItems([
      collectGmarketCatalogCartLines(cartRoot),
      extractGmarketCatalogLinesFromText(cartRoot),
      orderRoot && orderRoot !== cartRoot ? collectGmarketCatalogCartLines(orderRoot) : [],
      orderRoot && orderRoot !== cartRoot ? extractGmarketCatalogLinesFromText(orderRoot) : []
    ]);
    if (items.length) return sortGmarketCatalogItems(items);
    return sortGmarketCatalogItems(collectGmarketRowsUniversal(cartRoot));
  }

  function sumGmarketRowPrices(items) {
    if (!items || !items.length || items.length > 8) return null;
    var sum = 0;
    var priced = 0;
    items.forEach(function (it) {
      if (it.price && isValidNaverPrice(it.price)) {
        sum += it.price;
        priced++;
      }
    });
    return priced > 0 ? sum : null;
  }

  function isReasonableGmarketTotal(total, rows, basePrice) {
    if (!isValidNaverPrice(total)) return false;
    if (total > 20000000) return false;
    var rowSum = sumGmarketRowPrices(rows);
    if (rowSum) {
      if (total >= rowSum * 0.9 && total <= rowSum * 1.15) return true;
      if (Math.abs(total - rowSum) <= 1000) return true;
      if (rows && rows.length >= 2 && total >= rowSum * 0.85) return true;
    }
    if (basePrice && total <= basePrice * 12) return true;
    if (!rows || !rows.length) return total <= 10000000;
    if (rows.length === 1 && rowSum && total > rowSum && total <= rowSum * 12) return true;
    return false;
  }

  function isGmarketPriceNoiseContext(el) {
    if (!el) return false;
    var text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (/결제할인|나라사랑|카드\s*할인|카드\s*무이자|무이자|할부|IBK|적립|포인트|배송비|제휴\s*카드/i.test(text)) {
      return true;
    }
    if (typeof el.closest === 'function' &&
      el.closest('[class*="payment"], [class*="card"], [class*="smile"], [class*="point"]')) {
      return true;
    }
    return false;
  }

  function getGmarketPriceRoots() {
    var roots = [];
    var seen = {};
    function add(el) {
      if (!el || seen[el] || el === document.body) return;
      seen[el] = true;
      roots.push(el);
    }
    add(document.querySelector('#coreInsOrder'));
    add(getGmarketOrderRoot());
    add(getGmarketOptionCartRoot());
    add(getGmarketBuyPanel());
    add(document.querySelector('.section__order, [class*="box__item-order"], [class*="item-topinfo_order"]'));

    var confirmed = getGmarketConfirmedSelectItems();
    if (confirmed.length) {
      add(getGmarketLowestCommonAncestor(confirmed));
      confirmed.forEach(function (row) {
        add(row.parentElement);
      });
    }

    document.querySelectorAll('div, span, p, strong, dd, dt, section').forEach(function (el) {
      var own = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!/총\s*금액/i.test(own) || own.length > 80) return;
      if (el.closest('[class*="recommend"], [class*="related"], nav, footer')) return;
      var scope = el.closest(
        '#coreInsOrder, [class*="order"], [class*="option"], [class*="item-topinfo"], [class*="buy"], [class*="select"]'
      );
      add(scope || el.parentElement);
    });

    document.querySelectorAll('iframe').forEach(function (frame) {
      try {
        var doc = frame.contentDocument;
        if (!doc) return;
        add(doc.querySelector('#coreInsOrder'));
        var inFrame = doc.querySelector('[class*="order"], [class*="select-item"]');
        if (inFrame) add(inFrame.closest('#coreInsOrder, [class*="order"]') || null);
      } catch (e) { /* cross-origin */ }
    });
    return roots;
  }

  function extractGmarketOptionDelta(text) {
    var t = String(text || '');
    var plus = t.match(/\(\s*\+\s*([\d,]{1,12})\s*원?\s*\)/);
    if (plus) return PH.normalizePrice(plus[1]) || 0;
    var minus = t.match(/\(\s*-\s*([\d,]{1,12})\s*원?\s*\)/);
    if (minus) return -(PH.normalizePrice(minus[1]) || 0);
    if (/\(\s*-\s*\)/.test(t)) return 0;
    return null;
  }

  function estimateGmarketRowUnitPrice(row, basePrice) {
    if (!row) return null;
    if (row.price && isValidNaverPrice(row.price)) return row.price;
    if (!basePrice) return null;
    var name = row.name || row.textContent || '';
    var delta = extractGmarketOptionDelta(name);
    if (delta !== null) return Math.max(1000, basePrice + delta);
    return basePrice;
  }

  function sumGmarketRowPricesInclusive(rows, basePrice) {
    if (!rows || !rows.length || !basePrice) return null;
    if (rows.length === 1) return estimateGmarketRowUnitPrice(rows[0], basePrice);
    var sum = 0;
    rows.forEach(function (row) {
      var unit = estimateGmarketRowUnitPrice(row, basePrice);
      if (unit && isValidNaverPrice(unit)) sum += unit;
    });
    return sum > 0 ? sum : null;
  }

  function scanGmarketTotalInRoot(root) {
    if (!root) return null;
    var fromPanel = extractTotalPriceFromPanel(root);
    if (fromPanel) return fromPanel;

    var nodes = root.querySelectorAll('div, span, p, strong, em, dd, dt, li, section');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (isGmarketPriceNoiseContext(el)) continue;
      var own = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!/총\s*금액/i.test(own)) continue;

      var scopes = [el, el.parentElement, el.parentElement && el.parentElement.parentElement];
      for (var s = 0; s < scopes.length; s++) {
        var scope = scopes[s];
        if (!scope) continue;
        var raw = (scope.textContent || '').replace(/\s+/g, ' ').trim();
        if (raw.length > 240) continue;
        var match = raw.match(/총\s*금액[^0-9]{0,48}([\d,]{4,12})\s*원?/i);
        if (match) {
          var p = PH.normalizePrice(match[1]);
          if (isValidNaverPrice(p)) return p;
        }
      }
    }

    for (var j = 0; j < nodes.length; j++) {
      var el2 = nodes[j];
      var t2 = (el2.textContent || '').replace(/\s+/g, ' ').trim();
      if (!/^총\s*\d+\s*개/i.test(t2) || t2.length > 48) continue;
      var parent = el2.parentElement;
      if (!parent || isGmarketPriceNoiseContext(parent)) continue;
      var pt = (parent.textContent || '').replace(/\s+/g, ' ').trim();
      if (pt.length > 240) continue;
      var m2 = pt.match(/([\d,]{4,12})\s*원/);
      if (m2) {
        var p2 = PH.normalizePrice(m2[1]);
        if (isValidNaverPrice(p2)) return p2;
      }
    }

    for (var k = 0; k < nodes.length; k++) {
      if (isGmarketPriceNoiseContext(nodes[k])) continue;
      var raw2 = (nodes[k].textContent || '').replace(/\s+/g, ' ').trim();
      var patterns = [
        /총\s*금액\s*([\d,]{4,12})\s*원?/i,
        /총\s*\d+\s*개[^0-9]*([\d,]{4,12})\s*원?/i,
        /총\s*상품\s*금액[^0-9]*([\d,]{4,12})\s*원?/i,
        /주문\s*금액[^0-9]*([\d,]{4,12})\s*원?/i
      ];
      for (var pi = 0; pi < patterns.length; pi++) {
        var m = raw2.match(patterns[pi]);
        if (!m || !m[1]) continue;
        var p3 = PH.normalizePrice(m[1]);
        if (isValidNaverPrice(p3)) return p3;
      }
    }

    return PH.normalizePrice(textOf([
      '.sum_price strong',
      '.sum_price',
      '.box__price-sum strong',
      '.box__price-sum',
      '[class*="total-price"] strong',
      '[class*="price-sum"] strong',
      '#totalPrice'
    ], root));
  }

  function resolveGmarketPrice(rows, basePrice) {
    rows = rows || extractGmarketSelectedRowsWithPrices();
    if (rows.length < 2) {
      var rebuilt = rebuildGmarketRowsFromCartLines();
      if (rebuilt.length > rows.length) rows = rebuilt;
    }
    if (rows.length > 8) rows = rows.slice(0, 8);
    if (!basePrice) basePrice = extractGmarketMainSellingPrice();

    var cartRoot = getGmarketOptionCartRoot();
    var cartTotal = extractGmarketCartTotalPrice(cartRoot);
    if (cartTotal && isReasonableGmarketTotal(cartTotal, rows, basePrice)) return cartTotal;

    var buyPanel = getGmarketBuyPanel();
    var panelTotal = scanGmarketTotalInRoot(buyPanel);
    if (panelTotal && isReasonableGmarketTotal(panelTotal, rows, basePrice)) return panelTotal;

    var roots = getGmarketPriceRoots();
    for (var i = 0; i < roots.length; i++) {
      var total = scanGmarketTotalInRoot(roots[i]);
      if (total && isReasonableGmarketTotal(total, rows, basePrice)) return total;
    }

    var sumExplicit = sumGmarketRowPrices(rows);
    if (sumExplicit && isReasonableGmarketTotal(sumExplicit, rows, basePrice)) return sumExplicit;

    var inclusive = sumGmarketRowPricesInclusive(rows, basePrice);
    if (inclusive && isReasonableGmarketTotal(inclusive, rows, basePrice)) return inclusive;

    if (basePrice && isValidNaverPrice(basePrice) && (!rows.length || rows.length === 1)) {
      return basePrice;
    }
    return sumExplicit || inclusive || null;
  }

  function extractGmarketTotalPriceFromDom(preloadedRows) {
    return resolveGmarketPrice(preloadedRows, null);
  }

  function extractGmarketMainSellingPrice() {
    var priceRoot = document.querySelector(
      '.item-topinfo_detail, .box__item-info, .box__item-detail-info, .item-topinfo'
    ) || getGmarketBuyPanel();

    var couponApplied = PH.normalizePrice(textOf([
      '[class*="coupon"] [class*="price"]',
      '.box__price-coupon strong',
      '[class*="price-coupon"]'
    ], priceRoot));

    var selling = PH.normalizePrice(textOf([
      '.price_real',
      '.box__price-seller strong',
      '[class*="price-seller"] strong',
      '.price'
    ], priceRoot));

    if (couponApplied && isValidNaverPrice(couponApplied)) return couponApplied;
    if (selling && isValidNaverPrice(selling)) return selling;
    return null;
  }

  function extractGmarketSelectedRows() {
    return extractGmarketSelectedRowsWithPrices().map(function (it) {
      return { name: it.name };
    });
  }

  function extractGmarketFromDropdowns() {
    var parts = [];
    getGmarketOptionCartRoot().querySelectorAll('select').forEach(function (sel) {
      if (!sel.value || sel.selectedIndex < 0) return;
      var opt = sel.options[sel.selectedIndex];
      var label = (opt && opt.textContent || '').replace(/\s+/g, ' ').trim();
      if (!label || isGmarketOptionNoise(label)) return;
      if (isGmarketPromoOrPaymentNoise(label)) return;
      if (/^(선택|옵션|모델|배터리)$/i.test(label)) return;
      if (!/^상품\s*\d+/i.test(label) && !looksLikeGmarketOptionName(label)) return;
      if (parts.indexOf(label) < 0) parts.push(label);
    });
    if (!parts.length) return '';
    return parts.join(' + ').slice(0, 300);
  }

  function extractGmarketOptions(preloadedRows) {
    var rows = preloadedRows || extractGmarketSelectedRowsWithPrices();
    if (rows.length < 2) {
      var rebuilt = rebuildGmarketRowsFromCartLines();
      if (rebuilt.length > rows.length) rows = rebuilt;
    }
    if (rows.length) {
      var formatted = formatGmarketOptionList(rows.map(function (row) {
        return { name: row.name };
      }));
      if (isUsableGmarketOptionText(formatted) && !isGmarketPromoOrPaymentNoise(formatted)) {
        return finalizeGmarketOption(formatted);
      }
    }

    return '';
  }

  function extractGmarketTotalPrice() {
    return extractGmarketTotalPriceFromDom();
  }

  function extractGmarketProduct() {
    var scripts = extractGmarketFromScripts();
    var ld = parseJsonLd();
    var title = pickFirstGoodTitle([
      textOf([
        'h1.itemtit',
        '.itemtit',
        'h1.box__item-title',
        '.item-topinfo_head h1',
        '.itemtit_pricebox h1',
        '[class*="itemtit"]'
      ], document.querySelector('.item-topinfo_head, .item-topinfo_detail, .box__item-info, .item-topinfo')),
      extractGmarketTitleFromVisibleDom(),
      scripts.title,
      ld.title,
      metaContent('og:title'),
      document.title
    ]);

    var rows = [];
    var price = null;
    var option = '';
    var basePrice = null;
    try {
      rows = extractGmarketSelectedRowsWithPrices();
      if (rows.length < 2) {
        var moreRows = rebuildGmarketRowsFromCartLines();
        if (moreRows.length > rows.length) rows = moreRows;
      }
      basePrice = extractGmarketMainSellingPrice();
      price = resolveGmarketPrice(rows, basePrice);
      if (!price && !rows.length) {
        price = basePrice ||
          scripts.price ||
          ld.price ||
          PH.normalizePrice(textOf(['.price_real', '.box__price-seller strong', '.price', '.sum_price']));
      }
      if (!price && rows.length >= 2 && basePrice) {
        price = sumGmarketRowPricesInclusive(rows, basePrice);
      }
      if (price && !isValidNaverPrice(price)) price = null;
    } catch (e) { /* price optional */ }
    try {
      option = extractGmarketOptions(rows);
    } catch (e) { /* option optional */ }

    return { title: title, price: price, option: option };
  }

  function extractSelectedOptions() {
    var parts = [];
    var host = location.hostname.toLowerCase();

    if (host.indexOf('coupang') >= 0) {
      try {
        return extractCoupangOptions() || extractCoupangOptionFast() || '';
      } catch (e) {
        try { return extractCoupangOptionFast() || ''; } catch (e2) { return ''; }
      }
    }

    document.querySelectorAll(
      '[class*="option"][class*="selected"], ' +
      '[class*="Option"][class*="selected"], ' +
      '[class*="option"][aria-selected="true"]'
    ).forEach(function (el) {
      var t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (t && t.length < 100 && parts.indexOf(t) < 0) parts.push(t);
    });

    document.querySelectorAll('select').forEach(function (sel) {
      if (!sel.value || sel.selectedIndex < 0) return;
      var opt = sel.options[sel.selectedIndex];
      var label = (opt && opt.textContent || '').replace(/\s+/g, ' ').trim();
      if (label && label !== '선택' && label !== '옵션 선택' && label !== '선택해주세요' && parts.indexOf(label) < 0) {
        parts.push(label);
      }
    });

    return parts.join(' / ').slice(0, 200);
  }

  function extractDomByHost(host) {
    var title = '';
    var price = null;

    if (host.indexOf('coupang') >= 0) {
      var coupang = extractCoupangProduct();
      title = coupang.title || textOf([
        'h1.prod-buy-header__title',
        '.prod-buy-header__title',
        'h1.product-title',
        'h1[class*="product"]',
        'h1[class*="title"]',
        'h1'
      ]);
      price = coupang.price || PH.normalizePrice(textOf([
        '.total-price strong',
        '.total-price',
        '.prod-price .total-price',
        '[class*="total-price"] strong',
        '[class*="total-price"]',
        '.price-amount.final-price-amount',
        '[class*="sale-price"]',
        '[class*="final-price"]'
      ]));
    } else if (host.indexOf('naver') >= 0 || host.indexOf('smartstore') >= 0) {
      var naver = extractNaverSmartStore();
      title = naver.title || textOf([
        'h3._22kNZ',
        'h3[class*="Product"]',
        '.product_title',
        'h2._2QCa1',
        'h1._2ewhz',
        'h1'
      ]);
      price = naver.price || PH.normalizePrice(metaContent('product:price:amount'));
    } else if (host.indexOf('11st') >= 0) {
      var eleven = extract11stProduct();
      title = eleven.title || textOf(['h1.title', '.prd_name', 'h1']);
      price = eleven.price || PH.normalizePrice(textOf(['.price', '.sale_price', '.value']));
    } else if (host.indexOf('gmarket') >= 0 || host.indexOf('auction') >= 0) {
      var gmarket = extractGmarketProduct();
      title = gmarket.title || textOf(['h1.itemtit', '.itemtit', 'h1']);
      price = gmarket.price || PH.normalizePrice(textOf(['.price_real', '.price', '.sum_price']));
    }

    return { title: title, price: price };
  }

  function detectMarketplace(host) {
    if (host.indexOf('coupang') >= 0) return '쿠팡';
    if (host.indexOf('smartstore') >= 0 || host.indexOf('shopping.naver') >= 0) return '네이버';
    if (host.indexOf('11st') >= 0) return '11번가';
    if (host.indexOf('gmarket') >= 0) return 'G마켓';
    if (host.indexOf('auction') >= 0) return '옥션';
    return '쇼핑몰';
  }

  function isLikelyProductPage() {
    var path = location.pathname + location.search;
    var host = location.hostname;
    if (/coupang\.com/i.test(host) && /\/vp\/products\/|\/products\//i.test(path)) return true;
    if (/smartstore\.naver\.com/i.test(host) && /\/products\//i.test(path)) return true;
    if (/shopping\.naver\.com/i.test(host) && /\/catalog\//i.test(path)) return true;
    if (/11st\.co\.kr/i.test(host) && /\/products\//i.test(path)) return true;
    if (/gmarket\.co\.kr|auction\.co\.kr/i.test(host) && /item|Goods|goods|DetailView/i.test(path)) return true;
    return !!metaContent('og:type').match(/product/i) || !!parseJsonLd().title;
  }

  function extractProductInfo() {
    var host = location.hostname.toLowerCase();
    var isNaver = host.indexOf('naver') >= 0 || host.indexOf('smartstore') >= 0;
    var isGmarket = host.indexOf('gmarket') >= 0 || host.indexOf('auction') >= 0;
    var isCoupang = host.indexOf('coupang') >= 0;
    var is11st = host.indexOf('11st') >= 0;
    var naverData = isNaver ? extractNaverSmartStore() : null;
    var gmarketData = null;
    if (isGmarket) {
      try {
        gmarketData = extractGmarketProduct();
      } catch (e) {
        gmarketData = { title: '', price: null, option: '' };
      }
    }
    var coupangData = null;
    if (isCoupang) {
      try {
        coupangData = extractCoupangProduct();
      } catch (e) {
        coupangData = { title: '', price: null, option: '' };
      }
    }
    var elevenData = is11st ? extract11stProduct() : null;
    var scripts = extractFromScripts();
    var ld = parseJsonLd();
    var dom = isCoupang
      ? { title: (coupangData && coupangData.title) || '', price: (coupangData && coupangData.price) || null }
      : isGmarket && gmarketData
        ? { title: gmarketData.title || '', price: gmarketData.price || null }
        : extractDomByHost(host);

    var title = isCoupang
      ? ((coupangData && coupangData.title) || sanitizeCoupangTitle(metaContent('og:title')))
      : pickFirstGoodTitle([
        naverData && naverData.title,
        gmarketData && gmarketData.title,
        dom.title,
        scripts.title,
        ld.title,
        metaContent('og:title'),
        document.title
      ]);

    var price = (naverData && naverData.price) || (gmarketData && gmarketData.price) ||
      (coupangData && coupangData.price) || (elevenData && elevenData.price) ||
      dom.price || scripts.price || ld.price ||
      PH.normalizePrice(metaContent('product:price:amount'));

    var option = (naverData && naverData.option) || (gmarketData && gmarketData.option) ||
      (coupangData && coupangData.option) || (elevenData && elevenData.option) ||
      (isCoupang || isGmarket ? '' : extractSelectedOptions());

    return {
      url: PH.cleanProductUrl(location.href),
      productName: title,
      price: price,
      option: option || '',
      marketplace: detectMarketplace(host),
      imageUrl: ld.image || metaContent('og:image') || '',
      isProductPage: isLikelyProductPage()
    };
  }

  function buildFallbackProduct() {
    return {
      url: PH.cleanProductUrl(location.href),
      productName: '',
      price: null,
      option: '',
      marketplace: detectMarketplace(location.hostname.toLowerCase()),
      imageUrl: metaContent('og:image') || '',
      isProductPage: isLikelyProductPage()
    };
  }

  chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
    if (!message || message.action !== 'extract') return;
    var product;
    try {
      product = extractProductInfo();
    } catch (err) {
      product = buildFallbackProduct();
    }
    if (!product || !product.url) {
      product = buildFallbackProduct();
    }
    sendResponse({ ok: true, product: product });
    return true;
  });

  globalThis.PHExtract = { extractProductInfo: extractProductInfo, isLikelyProductPage: isLikelyProductPage };
})();

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
      .replace(/\s*[-|:]\s*(쿠팡|Coupang|로켓배송|네이버|Naver|스마트스토어|11번가|G마켓|옥션).*$/i, '')
      .trim()
      .slice(0, 200);
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
  var MAX_COUPANG_OPTION_SCAN = 80;

  function isBadTitle(text) {
    var t = String(text || '').trim();
    if (!t || t.length < 6) return true;
    if (/^(products|product|vp|item|goods|쿠팡|상품)$/i.test(t)) return true;
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
    var roots = [getCoupangAtfRoot(), document.querySelector('main'), document.body];
    var seen = {};
    var candidates = [];

    roots.forEach(function (root) {
      if (!root) return;
      root.querySelectorAll('h1, h2, [class*="title"], [class*="Title"]').forEach(function (el) {
        if (el.closest('header, nav, footer, [class*="review"], [class*="Review"], [class*="related"], [class*="breadcrumb"]')) {
          return;
        }
        var t = cleanTitle(el.textContent);
        if (!t || isBadTitle(t) || !/[가-힣]/.test(t) || t.length < 8) return;
        if (seen[t]) return;
        seen[t] = true;
        var score = t.length;
        if (el.tagName === 'H1') score += 50;
        if (el.closest('.prod-buy, .prod-atf, .prod-atf-contents, [class*="product"], [class*="Product"]')) {
          score += 30;
        }
        candidates.push({ t: t, score: score });
      });
    });

    if (!candidates.length) return '';
    candidates.sort(function (a, b) { return b.score - a.score; });
    return candidates[0].t;
  }

  function extractCoupangPriceFromVisibleDom(buyRoot) {
    buyRoot = buyRoot || getCoupangAtfRoot();
    var candidates = [];

    buyRoot.querySelectorAll('span, strong, em, div, p').forEach(function (el) {
      if (isStrikethroughPrice(el)) return;
      var raw = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!raw || raw.length > 24) return;
      if (/쿠폰|개당|배송|적립|%/i.test(raw)) return;
      var p = parseNaverPriceText(raw);
      if (p && isValidNaverPrice(p)) candidates.push(p);
    });

    if (!candidates.length) return null;
    candidates.sort(function (a, b) { return a - b; });
    return candidates[0];
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
      if (!value || !looksLikeCoupangDropdownValue(value)) continue;

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
      .trim();
  }

  function getCoupangProductId() {
    var m = location.pathname.match(/\/products\/(\d+)/i);
    return m ? m[1] : '';
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
        '.prod-atf-contents, .prod-atf, .prod-buy, .prod-buy-new, .prod-option, .product-buy-header, .prod-buy-header'
      ) ||
      document.body
    );
  }

  function getCoupangAtfRoot() {
    return (
      document.querySelector('.prod-atf-contents, .prod-atf, .sdp-content main') ||
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
    return !!el.closest(
      '.prod-atf, .prod-atf-contents, .prod-buy, .prod-buy-new, [class*="prod-option"], ' +
      '[class*="option"], .sdp-content, main'
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
    t = finalizeCoupangOption(t);
    if (!t || isCoupangCompositeLabelHeader(t) || isCoupangOptionLabel(t) || isCoupangOptionNoise(t)) return '';
    if (looksLikeCoupangDropdownValue(t) || looksLikeCoupangOptionValue(t)) return t;
    if (/×/.test(t) && /[가-힣]/.test(t) && (/\d+\s*개/.test(t) || /행정|패키지|프리미엄/i.test(t))) return t;
    return '';
  }

  function extractCoupangValueFromGluedText(text) {
    var t = String(text || '').replace(/\s+/g, ' ').trim();
    if (isCoupangCompositeLabelHeader(t)) return '';

    var knownHeaders = [
      /^구성\s*×\s*엔진\s*방식\s*×\s*수량\s*/i,
      /^색상\s*×\s*사이즈\s*/i,
      /^색상\s*×\s*프레임재질\s*/i
    ];
    for (var h = 0; h < knownHeaders.length; h++) {
      if (knownHeaders[h].test(t)) {
        return cleanCoupangSelectionLine(t.replace(knownHeaders[h], ''));
      }
    }

    var qtyGlued = t.match(/^((?:[가-힣A-Za-z][가-힣A-Za-z0-9\s]*\s*×\s*){2,}수량)(.+)$/);
    if (qtyGlued && qtyGlued[2]) {
      var headerOnly = qtyGlued[1].replace(/\s+$/, '');
      if (isCoupangCompositeLabelHeader(headerOnly)) {
        return cleanCoupangSelectionLine(qtyGlued[2]);
      }
    }

    var glued = t.match(/^((?:(?:[가-힣A-Za-z]+\s*×\s*){2,}[가-힣A-Za-z]+?))([가-힣+].+)$/);
    if (glued && glued[2] && isCoupangCompositeLabelHeader(glued[1])) {
      return cleanCoupangSelectionLine(glued[2]);
    }

    var afterQty = t.match(/^(?:.+?수량)\s*([가-힣+].+)$/);
    if (afterQty && afterQty[1]) return cleanCoupangSelectionLine(afterQty[1]);

    if (/×/.test(t) && /\d+\s*개/.test(t) && !isCoupangCompositeLabelHeader(t)) {
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
    if (!el || !isInsideCoupangOptionArea(el)) return false;
    if (el.closest('ul, ol, [role="listbox"], [role="option"]')) return false;
    if (!el.closest('.prod-option, [class*="prod-option"], [class*="option"], .prod-atf, .prod-buy, .prod-atf-contents')) {
      return false;
    }
    if (/장바구니|바로구매|구매하기|찜하기|쿠폰\s*받기/i.test(el.textContent || '')) return false;
    var raw = getCoupangTextWithoutMedia(el);
    if (!raw || raw.length < 8 || raw.length > 220) return false;
    if (!/[×x]/.test(raw) && !/프리미엄|패키지|풀패키지|행정/i.test(raw)) return false;
    if (el.getAttribute('aria-expanded') === 'true') return false;
    return true;
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
      if (!value || !looksLikeCoupangDropdownValue(value)) continue;

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
    if (/^구성\s*×\s*엔진/i.test(text) && /프리미엄|패키지|풀패키지|행정/i.test(text)) return false;
    if (/RS\d|\.?\d*v[-\s]?\d+\s*a?h?/i.test(text)) return true;
    if (/[A-Za-z]\d+[\.\d]*v[-\s]?\d+/i.test(text)) return true;
    if (/[가-힣]+[_\s][\d]+인치/i.test(text)) return true;
    if (/[x×_]/.test(text) && /[가-힣]/.test(text) && text.length >= 6) return true;
    if (/프리미엄|패키지|풀패키지|행정|구성/i.test(text) && /×/.test(text)) return true;
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

    return collected;
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
    buyRoot = buyRoot || getCoupangAtfRoot();
    var visible = extractCoupangPriceFromVisibleDom(buyRoot);
    if (visible && isValidNaverPrice(visible)) return visible;

    var nextData = extractCoupangFromNextData();
    if (nextData.price && isValidNaverPrice(nextData.price)) return nextData.price;

    var fromPanel = extractTotalPriceFromPanel(buyRoot);
    if (fromPanel) return fromPanel;

    var direct = PH.normalizePrice(textOf([
      '.total-price strong',
      '.price-amount.final-price-amount',
      '.prod-price .total-price strong',
      '.prod-sale-price',
      '[class*="total-price"] strong',
      '[class*="final-price"]',
      '[class*="sale-price"]',
      '.total-price'
    ], buyRoot));
    if (direct && isValidNaverPrice(direct)) return direct;

    var candidates = [];
    buyRoot.querySelectorAll('[class*="price"], [class*="Price"], strong, span, em').forEach(function (el) {
      if (isStrikethroughPrice(el)) return;
      var raw = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!raw || raw.length > 28) return;
      if (/쿠폰|개당|할인|%|배송/i.test(raw)) return;
      var p = parseNaverPriceText(raw);
      if (p && isValidNaverPrice(p)) candidates.push(p);
    });
    if (!candidates.length) return null;
    candidates.sort(function (a, b) { return a - b; });
    return candidates[0];
  }

  function extractCoupangOptionFast() {
    var option = extractCoupangOptionFromVisibleDom();
    if (option) return option;

    option = extractCoupangCompositeOptionFromDom();
    if (option) return option;

    var closedDropdowns = extractCoupangClosedDropdownSelections();
    if (closedDropdowns.length === 1) return closedDropdowns[0];
    if (closedDropdowns.length > 1) {
      return formatNaverOptionList(closedDropdowns.map(function (name) { return { name: name }; }));
    }

    return '';
  }

  function extractCoupangProduct() {
    var buyRoot = getCoupangAtfRoot();
    var nextData = extractCoupangFromNextData();

    var title = pickFirstGoodTitle([
      extractCoupangTitleFromVisibleDom(),
      cleanCoupangOgTitle(metaContent('og:title')),
      cleanCoupangOgTitle(metaContent('twitter:title')),
      cleanTitle(textOf([
        'h1.prod-buy-header__title',
        '.prod-buy-header__title',
        'h1[class*="product-title"]',
        'h1[class*="ProductTitle"]',
        '.product-buy-header h1',
        'div.product-buy-header h1 span',
        'h1.product-title',
        'h1'
      ], buyRoot)),
      nextData.title,
      cleanCoupangOgTitle(document.title)
    ]);

    var price = extractCoupangPriceFromDom(buyRoot);
    if (price && !isValidNaverPrice(price)) price = null;

    var option = extractCoupangOptionFast();

    return {
      title: title,
      price: price,
      option: option
    };
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
    var nextEl = document.getElementById('__NEXT_DATA__');
    var source = nextEl ? (nextEl.textContent || '') : '';
    if (!source) return result;

    if (productId) {
      var scopedPrice = new RegExp(
        '"(?:itemId|productId|id)"\\s*:\\s*"?'+ productId + '"?[\\s\\S]{0,25000}?' +
        '"(?:salePrice|discountedSalePrice|finalPrice|priceAmount)"\\s*:\\s*(\\d{3,9})',
        'i'
      );
      var priceMatch = source.match(scopedPrice);
      if (priceMatch) result.price = PH.normalizePrice(priceMatch[1]);

      var scopedTitle = new RegExp(
        '"(?:itemId|productId|id)"\\s*:\\s*"?'+ productId + '"?[\\s\\S]{0,25000}?' +
        '"itemName"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"',
        'i'
      );
      var titleMatch = source.match(scopedTitle);
      if (titleMatch) {
        var scopedName = cleanTitle(unescapeJsonString(titleMatch[1]));
        if (!isBadTitle(scopedName)) result.title = scopedName;
      }

      if (!result.title) {
        var scopedTitle2 = new RegExp(
          '"itemName"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"[\\s\\S]{0,25000}?' +
          '"(?:itemId|productId)"\\s*:\\s*"?'+ productId + '"?',
          'i'
        );
        var titleMatch2 = source.match(scopedTitle2);
        if (titleMatch2) {
          var scopedName2 = cleanTitle(unescapeJsonString(titleMatch2[1]));
          if (!isBadTitle(scopedName2)) result.title = scopedName2;
        }
      }
    }

    if (!result.title) {
      var names = [];
      var nameRe = /"itemName"\s*:\s*"((?:\\.|[^"\\])*)"/g;
      var nm;
      while ((nm = nameRe.exec(source)) !== null) {
        var n = cleanTitle(unescapeJsonString(nm[1]));
        if (n && !isBadTitle(n) && /[가-힣]/.test(n) && n.length >= 8) names.push(n);
      }
      if (names.length) {
        names.sort(function (a, b) { return b.length - a.length; });
        result.title = names[0];
      }
    }

    if (!result.price) {
      result.price = firstPriceMatch(source, [
        /"discountedSalePrice"\s*:\s*(\d{3,9})/,
        /"salePrice"\s*:\s*(\d{3,9})/,
        /"finalPrice"\s*:\s*(\d{3,9})/,
        /"priceAmount"\s*:\s*(\d{3,9})/
      ]);
    }

    return result;
  }

  function extractFromScripts() {
    if (location.hostname.toLowerCase().indexOf('coupang') >= 0) {
      return extractCoupangFromNextData();
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

  function getGmarketBuyPanel() {
    var frames = document.querySelectorAll('iframe');
    for (var i = 0; i < frames.length; i++) {
      try {
        var doc = frames[i].contentDocument;
        if (!doc) continue;
        var inFrame = doc.querySelector(
          '#coreInsOrder, [class*="option"], [class*="select-item"], [class*="order"]'
        );
        if (inFrame) return doc.body;
      } catch (e) { /* cross-origin */ }
    }
    return (
      document.querySelector(
        '#coreInsOrder, .section__order, .box__item-order, .item-topinfo_order, ' +
        '.box__item-detail-info, .item-topinfo_detail, .box__item-info, ' +
        '[class*="item-topinfo"], [class*="box__item"]'
      ) ||
      document.querySelector('#container, .item-topinfo') ||
      document.body
    );
  }

  function scoreGmarketOptionText(text) {
    if (!text || text.length < 6 || text.length > 160) return -1;
    if (isGmarketOptionNoise(text) && !/\s\+\s/.test(text)) return -1;
    var score = 0;
    if (/\s\+\s/.test(text)) score += 70;
    if (/\(\d+\s*km/i.test(text)) score += 25;
    if (/\d+\s*A(h)?\b/i.test(text)) score += 20;
    if (/모델|배터리|색상|사이즈|용량/i.test(text)) score += 10;
    if (/^\d+$/.test(text) || /^\d[\d,]*\s*원?$/.test(text)) return -1;
    return score;
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
    return bestScore >= 45 ? finalizeGmarketOption(best) : '';
  }

  function extractGmarketFromActiveDropdowns() {
    var parts = [];
    getGmarketBuyPanel().querySelectorAll(
      '[class*="dropdown"] [class*="value"], [class*="dropdown"] [class*="selected"], ' +
      '[class*="select"] [class*="on"], [class*="select"] [class*="active"], ' +
      'button[aria-expanded="true"], [class*="option"] [class*="active"]'
    ).forEach(function (el) {
      var t = cleanGmarketOptionLine(el.textContent);
      if (!t || t.length < 2 || t.length > 80 || isGmarketOptionNoise(t)) return;
      if (/^(모델|배터리|옵션|선택)$/i.test(t)) return;
      if (parts.indexOf(t) < 0) parts.push(t);
    });
    if (parts.length >= 2) return parts.join(' + ').slice(0, 300);
    return '';
  }

  function isGmarketOptionNoise(text) {
    if (!text) return true;
    if (/^쿠폰\s*적용$|^장바구니$|^구매하기$|^찜하기$/i.test(text)) return true;
    if (/총\s*금액|총\s*\d+\s*개|옵션\s*선택|선택해\s*주세요/i.test(text)) return true;
    if (/^모델$|^배터리$|^옵션$/i.test(text)) return true;
    if (/^수량증가$|^수량감소$|^닫기$|^삭제$/i.test(text)) return true;
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
    t = t.replace(/\d{1,3}(?:,\d{3})+\s*원/g, ' ').trim();
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
    if (!name || name.length < 4 || name.length > 160) return false;
    if (/\s\+\s/.test(name) && name.length >= 8) return !isGmarketOptionNoise(name);
    if (isGmarketOptionNoise(name)) return false;
    if (/\d+\s*(Ah|A|km|W|V)\b/i.test(name)) return true;
    if (/\([^)]{2,40}\)/.test(name)) return true;
    if (/모델|색상|사이즈|용량|세트|주행/i.test(name) && name.length >= 6) return true;
    return name.length >= 8 && /[가-힣]/.test(name) && /\d/.test(name);
  }

  function extractGmarketOptionNameFromRow(row) {
    var fromClone = getGmarketOptionTextFromEl(row);
    if (fromClone && (looksLikeGmarketOptionName(fromClone) || /\s\+\s/.test(fromClone))) {
      return finalizeGmarketOption(fromClone);
    }

    var candidates = [];
    row.querySelectorAll('strong, span, p, em, div, a').forEach(function (el) {
      if (el.children.length > 3) return;
      var t = cleanGmarketOptionLine(el.textContent);
      if (t && t.length >= 4 && t.length <= 150) candidates.push(t);
    });
    var cleaned = cleanGmarketOptionLine(row.textContent);
    if (cleaned) candidates.push(cleaned);

    candidates.sort(function (a, b) {
      return scoreGmarketOptionText(b) - scoreGmarketOptionText(a);
    });

    for (var i = 0; i < candidates.length; i++) {
      if (looksLikeGmarketOptionName(candidates[i]) || /\s\+\s/.test(candidates[i])) {
        return finalizeGmarketOption(candidates[i]);
      }
    }
    return '';
  }

  function extractGmarketSelectedRows() {
    var buyRoot = getGmarketBuyPanel();
    var items = [];
    var seen = {};

    function add(name) {
      name = finalizeGmarketOption(name);
      if (!name || seen[name]) return;
      seen[name] = true;
      items.push({ name: name });
    }

    queryAll([
      '.select-item',
      '.box__option-item',
      '.box__selected-option',
      '[class*="select-item"]',
      '[class*="option-item"]',
      '.list-option__item',
      '.list-form__option-item',
      '#option_list .select-item',
      '.item_option_area li',
      '.box__option-list li'
    ], buyRoot).forEach(function (row) {
      if (/^장바구니|^구매하기/i.test((row.textContent || '').replace(/\s+/g, ' ').trim())) return;
      var name = extractGmarketOptionNameFromRow(row);
      if (name) add(name);
    });

    if (!items.length) {
      buyRoot.querySelectorAll(
        'button, a, [role="button"], [class*="delete"], [class*="close"], ' +
        '[class*="btn-remove"], [class*="btn_delete"], [class*="btn-del"]'
      ).forEach(function (btn) {
        if (/장바구니|구매|쿠폰|찜|선물/i.test(btn.textContent || '')) return;
        var row = btn.closest('li, div[class]');
        if (!row || row === buyRoot) return;
        var rowText = row.textContent || '';
        if (rowText.length > 280 || rowText.length < 8) return;
        if (!/\d{1,3}(?:,\d{3})+\s*원/.test(rowText)) return;
        var name = extractGmarketOptionNameFromRow(row);
        if (name) add(name);
      });
    }

    if (!items.length) {
      buyRoot.querySelectorAll('div, li, span, strong, p').forEach(function (el) {
        if (el.children.length > 8) return;
        var t = cleanGmarketOptionLine(el.textContent);
        if (!looksLikeGmarketOptionName(t)) return;
        if (/\s\+\s/.test(t) || /\d+\s*Ah/i.test(t) || /\(\d+km/i.test(t)) add(t);
      });
    }

    return items;
  }

  function extractGmarketFromDropdowns() {
    var parts = [];
    getGmarketBuyPanel().querySelectorAll('select').forEach(function (sel) {
      if (!sel.value || sel.selectedIndex < 0) return;
      var opt = sel.options[sel.selectedIndex];
      var label = (opt && opt.textContent || '').replace(/\s+/g, ' ').trim();
      if (!label || isGmarketOptionNoise(label)) return;
      if (/^(선택|옵션|모델|배터리)$/i.test(label)) return;
      if (parts.indexOf(label) < 0) parts.push(label);
    });
    if (!parts.length) return '';
    return parts.join(' + ').slice(0, 300);
  }

  function extractGmarketOptions() {
    var byPattern = extractGmarketOptionByPattern();
    if (byPattern) return byPattern;

    var items = extractGmarketSelectedRows();
    if (items.length) return finalizeGmarketOption(formatNaverOptionList(items));

    var fromActive = extractGmarketFromActiveDropdowns();
    if (fromActive) return finalizeGmarketOption(fromActive);

    var fromDropdowns = extractGmarketFromDropdowns();
    if (fromDropdowns) return finalizeGmarketOption(fromDropdowns);

    return '';
  }

  function extractGmarketTotalPrice() {
    return extractTotalPriceFromPanel(getGmarketBuyPanel());
  }

  function extractGmarketProduct() {
    var title = textOf(['h1.itemtit', '.itemtit', 'h1.box__item-title', 'h1']);
    var price = extractGmarketTotalPrice() ||
      PH.normalizePrice(textOf(['.price_real', '.box__price-seller strong', '.price', '.sum_price']));
    if (price && !isValidNaverPrice(price)) price = null;
    return {
      title: cleanTitle(title),
      price: price,
      option: extractGmarketOptions()
    };
  }

  function extractSelectedOptions() {
    var parts = [];
    var host = location.hostname.toLowerCase();

    if (host.indexOf('coupang') >= 0) {
      return extractCoupangOptions() || '';
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
    if (/gmarket\.co\.kr|auction\.co\.kr/i.test(host) && /item|Goods|goods/i.test(path)) return true;
    return !!metaContent('og:type').match(/product/i) || !!parseJsonLd().title;
  }

  function extractProductInfo() {
    var host = location.hostname.toLowerCase();
    var isNaver = host.indexOf('naver') >= 0 || host.indexOf('smartstore') >= 0;
    var isGmarket = host.indexOf('gmarket') >= 0 || host.indexOf('auction') >= 0;
    var isCoupang = host.indexOf('coupang') >= 0;
    var is11st = host.indexOf('11st') >= 0;
    var naverData = isNaver ? extractNaverSmartStore() : null;
    var gmarketData = isGmarket ? extractGmarketProduct() : null;
    var coupangData = isCoupang ? extractCoupangProduct() : null;
    var elevenData = is11st ? extract11stProduct() : null;
    var scripts = extractFromScripts();
    var ld = parseJsonLd();
    var dom = isCoupang
      ? { title: (coupangData && coupangData.title) || '', price: (coupangData && coupangData.price) || null }
      : extractDomByHost(host);

    var title = isCoupang
      ? pickFirstGoodTitle([
        coupangData && coupangData.title,
        extractCoupangTitleFromVisibleDom(),
        cleanCoupangOgTitle(metaContent('og:title')),
        cleanCoupangOgTitle(metaContent('twitter:title')),
        dom.title,
        scripts.title,
        ld.title,
        cleanCoupangOgTitle(document.title)
      ])
      : pickFirstGoodTitle([
        naverData && naverData.title,
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
      extractSelectedOptions();

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

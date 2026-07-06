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

  function isBadTitle(text) {
    var t = String(text || '').trim();
    if (!t || t.length < 6) return true;
    return BAD_TITLE_RE.test(t);
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
    if (!name || name.length < 4 || isNaverOptionNoise(name)) return false;
    if (/\d+\s*(Ah|V|W|A|mAh)\b/i.test(name)) return true;
    if (/\s\/\s/.test(name)) return true;
    if (/\d+\s*인치|\d+인치|inch/i.test(name)) return true;
    if (/[A-Z]{2,}/.test(name) && /[가-힣]/.test(name)) return true;
    if (/[가-힣]{2,}/.test(name) && name.length >= 8) return true;
    return false;
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
    var nodes = buyRoot.querySelectorAll('div, span, p, strong, em, dd, dt, li, section');
    for (var i = 0; i < nodes.length; i++) {
      var raw = (nodes[i].textContent || '').replace(/\s+/g, ' ').trim();
      if (!/총\s*금액/i.test(raw)) continue;
      var match = raw.match(/총\s*금액\s*([\d,]{4,12})\s*원?/i);
      if (match) {
        var p = PH.normalizePrice(match[1]);
        if (isValidNaverPrice(p)) return p;
      }
    }
    return null;
  }

  function extractNameFromNaverRow(row) {
    var nameEl = row.querySelector(
      '[class*="option_name"], [class*="product_name"], [class*="name"], [class*="title"]'
    );
    if (nameEl) {
      var fromEl = cleanNaverOptionLine(nameEl.textContent);
      if (fromEl && looksLikeNaverOptionName(fromEl)) return fromEl;
    }
    var cleaned = cleanNaverOptionLine(row.textContent);
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
      if (!isNaverSelectedOptionRow(row)) return;
      var hasRemove = row.querySelector(
        'button, [class*="delete"], [class*="remove"], [class*="close"], [aria-label*="삭제"]'
      );
      if (!hasRemove) return;
      var name = extractNameFromNaverRow(row);
      if (!name || name.length < 3 || name.length > 150) return;
      addItem(name, extractPriceFromNaverRow(row));
    });

    if (!items.length) {
      buyRoot.querySelectorAll('button, [class*="delete"], [class*="remove"], [class*="close"]').forEach(function (btn) {
        if (/장바구니|구매|찜|선물|톡톡/i.test(btn.textContent || '')) return;
        var row = btn.closest('li, div');
        if (!row || row === buyRoot || (row.textContent || '').length > 300) return;
        if (!isNaverSelectedOptionRow(row)) return;
        if (!/\d{1,3}(?:,\d{3})+\s*원|\d{4,9}\s*원/.test(row.textContent || '')) return;
        var name = extractNameFromNaverRow(row);
        if (!name || name.length < 3 || name.length > 150) return;
        addItem(name, extractPriceFromNaverRow(row));
      });
    }

    return items;
  }

  function resolveNaverPrice(scripts) {
    var total = extractNaverTotalPriceFromDom();
    if (total) return total;

    var items = extractNaverSelectedItemRows();
    if (items.length >= 2) {
      var priced = items.filter(function (item) { return item.price; });
      if (priced.length === items.length) {
        var sum = priced.reduce(function (acc, item) { return acc + item.price; }, 0);
        if (isValidNaverPrice(sum)) return sum;
      }
    }
    if (items.length === 1 && items[0].price) return items[0].price;

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
    return Math.min.apply(null, candidates);
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

  function extractFromScripts() {
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
        var walk = function (node) {
          if (!node || typeof node !== 'object') return;
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

        var t = cleanGmarketOptionLine(raw);
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
    return bestScore >= 45 ? best : '';
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
    if (/^\d+$/.test(text)) return true;
    return false;
  }

  function cleanGmarketOptionLine(text) {
    var t = String(text || '').replace(/\s+/g, ' ').trim();
    t = t.replace(/쿠폰\s*적용/gi, ' ').trim();
    t = t.replace(/\d{1,3}(?:,\d{3})+\s*원/g, ' ').trim();
    t = t.replace(/^\s*[-+]\s*\d+\s*[-+]\s*/g, '').trim();
    t = t.replace(/\s*[-—]\s*\d+\s*\+\s*$/g, '').trim();
    return t.replace(/\s+/g, ' ').trim();
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
        return candidates[i];
      }
    }
    return '';
  }

  function extractGmarketSelectedRows() {
    var buyRoot = getGmarketBuyPanel();
    var items = [];
    var seen = {};

    function add(name) {
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
    if (items.length) return formatNaverOptionList(items);

    var fromActive = extractGmarketFromActiveDropdowns();
    if (fromActive) return fromActive;

    var fromDropdowns = extractGmarketFromDropdowns();
    if (fromDropdowns) return fromDropdowns;

    return '';
  }

  function extractGmarketTotalPrice() {
    var buyRoot = getGmarketBuyPanel();
    var nodes = buyRoot.querySelectorAll('div, span, p, strong, em, dt, dd');
    for (var i = 0; i < nodes.length; i++) {
      var raw = (nodes[i].textContent || '').replace(/\s+/g, ' ').trim();
      if (!/총\s*금액/i.test(raw)) continue;
      var match = raw.match(/총\s*금액\s*([\d,]{4,12})\s*원?/i);
      if (match) {
        var p = PH.normalizePrice(match[1]);
        if (isValidNaverPrice(p)) return p;
      }
    }
    return null;
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
      document.querySelectorAll(
        '.prod-option__item--selected .prod-option__name, ' +
        '.prod-option__item--selected, ' +
        'button[class*="option"][aria-pressed="true"], ' +
        'li[class*="option"][class*="selected"], ' +
        '[class*="option-picker"] [class*="selected"], ' +
        '.option-table-list__option--selected'
      ).forEach(function (el) {
        var t = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (t && t.length < 100 && parts.indexOf(t) < 0 && !/^옵션/.test(t)) parts.push(t);
      });
    } else {
      document.querySelectorAll(
        '[class*="option"][class*="selected"], ' +
        '[class*="Option"][class*="selected"], ' +
        '[class*="option"][aria-selected="true"]'
      ).forEach(function (el) {
        var t = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (t && t.length < 100 && parts.indexOf(t) < 0) parts.push(t);
      });
    }

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
      title = textOf([
        'h1.prod-buy-header__title',
        '.prod-buy-header__title',
        'h1.product-title',
        'h1[class*="product"]',
        'h1[class*="title"]',
        'h1'
      ]);
      price = PH.normalizePrice(textOf([
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
      title = textOf(['h1.title', '.prd_name', 'h1']);
      price = PH.normalizePrice(textOf(['.price', '.sale_price', '.value']));
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
    var naverData = isNaver ? extractNaverSmartStore() : null;
    var gmarketData = isGmarket ? extractGmarketProduct() : null;
    var scripts = extractFromScripts();
    var ld = parseJsonLd();
    var dom = extractDomByHost(host);

    var title = cleanTitle(
      (naverData && naverData.title) ||
      dom.title ||
      scripts.title ||
      ld.title ||
      metaContent('og:title') ||
      document.title
    );
    if (isBadTitle(title) && naverData && naverData.title) {
      title = cleanTitle(naverData.title);
    }

    var price = (naverData && naverData.price) || (gmarketData && gmarketData.price) ||
      dom.price || scripts.price || ld.price ||
      PH.normalizePrice(metaContent('product:price:amount'));

    var option = (naverData && naverData.option) || (gmarketData && gmarketData.option) ||
      extractSelectedOptions();

    return {
      url: PH.cleanProductUrl(location.href),
      productName: title,
      price: price,
      option: option || '단일옵션',
      marketplace: detectMarketplace(host),
      imageUrl: ld.image || metaContent('og:image') || '',
      isProductPage: isLikelyProductPage()
    };
  }

  chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
    if (!message || message.action !== 'extract') return;
    try {
      sendResponse({ ok: true, product: extractProductInfo() });
    } catch (err) {
      sendResponse({ ok: false, error: err.message || String(err) });
    }
    return true;
  });

  globalThis.PHExtract = { extractProductInfo: extractProductInfo, isLikelyProductPage: isLikelyProductPage };
})();

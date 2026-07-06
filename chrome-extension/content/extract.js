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
      if (bm) result.price = PH.normalizePrice(bm[1]);
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
      if (salePrices.length) result.price = Math.min.apply(null, salePrices);
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

  function extractNaverPriceFromDom() {
    var root =
      document.querySelector('[class*="ProductDetail"], [class*="product_detail"], [class*="productDetail"], #content') ||
      document.body;
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
      var p = PH.normalizePrice(el.textContent);
      if (p) candidates.push(p);
    });

    if (!candidates.length) return null;
    return Math.min.apply(null, candidates);
  }

  function extractNaverTitleFromDom() {
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
    candidates.sort(function (a, b) { return b.length - a.length; });
    return candidates[0];
  }

  function extractNaverOptions() {
    var parts = [];
    var root =
      document.querySelector('[class*="ProductDetail"], [class*="product_detail"], [class*="productDetail"], [class*="option_area"], #content') ||
      document.body;

    queryAll([
      '[class*="product_option"] [class*="option"]',
      '[class*="product_option"] em',
      '[class*="product_option"] strong',
      '[class*="ProductOption"] [class*="selected"]',
      '[class*="option_select"] [class*="on"]',
      '[class*="option_select"] [class*="selected"]',
      '[class*="option"] [class*="selected"]',
      '[class*="Option"] [class*="selected"]',
      'button[class*="option"][aria-pressed="true"]',
      '[class*="color"] [class*="selected"]',
      '[class*="Color"] [aria-selected="true"]',
      '[class*="product_item"] [class*="name"]',
      '[class*="option_name"]',
      '[class*="OptionName"]'
    ], root).forEach(function (el) {
      var t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!t || t.length > 120) return;
      if (/^(선택|옵션|수량|색상|사이즈|필수|추가)$/i.test(t)) return;
      if (/^\d+원$/.test(t)) return;
      if (/^\d+$/.test(t)) return;
      if (parts.indexOf(t) < 0) parts.push(t);
    });

    if (!parts.length) {
      queryAll('[class*="product_item"], [class*="ProductItem"], [class*="selected_option"]', root).forEach(function (el) {
        var t = (el.textContent || '').replace(/\s+/g, ' ').trim();
        var m = t.match(/^([^0-9\n]{2,80}?)(?:\s+\d+\s*개|\s*\d+원)/);
        if (m && m[1] && parts.indexOf(m[1].trim()) < 0) {
          parts.push(m[1].trim());
        }
      });
    }

    return parts.join(' / ').slice(0, 200);
  }

  function extractNaverSmartStore() {
    var scripts = extractNaverFromScripts();
    var ogTitle = cleanTitle(metaContent('og:title'));
    if (ogTitle) {
      ogTitle = ogTitle.replace(/\s*:\s*[^:]*스마트스토어.*$/i, '').trim();
      ogTitle = ogTitle.replace(/\s*-\s*네이버\s*쇼핑.*$/i, '').trim();
    }

    var domTitle = extractNaverTitleFromDom();
    var title = '';
    if (ogTitle && !isBadTitle(ogTitle) && ogTitle.length >= (scripts.title || '').length) {
      title = ogTitle;
    } else if (scripts.title && !isBadTitle(scripts.title)) {
      title = scripts.title;
    } else if (domTitle) {
      title = domTitle;
    } else if (ogTitle) {
      title = ogTitle;
    }

    var price = scripts.price || extractNaverPriceFromDom();
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
      title = textOf(['h1.itemtit', '.itemtit', 'h1']);
      price = PH.normalizePrice(textOf(['.price_real', '.price', '.sum_price']));
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
    var naverData = isNaver ? extractNaverSmartStore() : null;
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

    var price = (naverData && naverData.price) || dom.price || scripts.price || ld.price ||
      PH.normalizePrice(metaContent('product:price:amount'));

    var option = (naverData && naverData.option) || extractSelectedOptions();

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

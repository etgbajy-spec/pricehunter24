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

  function extractFromScripts() {
    var result = { title: '', price: null };
    var html = document.documentElement.innerHTML;

    result.price = firstPriceMatch(html, [
      /"salePrice"\s*:\s*(\d{3,9})/,
      /"discountedSalePrice"\s*:\s*(\d{3,9})/,
      /"finalPrice"\s*:\s*(\d{3,9})/,
      /"priceAmount"\s*:\s*(\d{3,9})/,
      /"price"\s*:\s*(\d{3,9})/
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
      title = textOf([
        'h3._22kNZ',
        'h3[class*="Product"]',
        '.product_title',
        'h2._2QCa1',
        'h1._2ewhz',
        'h1'
      ]);
      price = PH.normalizePrice(textOf([
        'span._1LY7D',
        'span[class*="price"]',
        '[class*="totalPrice"]',
        '.price',
        'strong[class*="price"]'
      ])) || PH.normalizePrice(metaContent('product:price:amount'));
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
    var scripts = extractFromScripts();
    var ld = parseJsonLd();
    var dom = extractDomByHost(host);
    var title = cleanTitle(
      dom.title ||
      scripts.title ||
      ld.title ||
      metaContent('og:title') ||
      document.title
    );

    var price = dom.price || scripts.price || ld.price || PH.normalizePrice(metaContent('product:price:amount'));
    var option = extractSelectedOptions();

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

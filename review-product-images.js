/**
 * 후기 제품 이미지 — assets/review-products/ + manifest.json
 * Firestore 등록 이미지 우선, 실패 시 manifest 로컬 fallback
 */
(function (global) {
  const BASE = '/assets/review-products/';

  let manifestCache = null;
  let manifestPromise = null;

  function getProductName(review) {
    if (!review || typeof review !== 'object') return '';
    return (review.product || review.productName || review.itemName || '').toString().trim();
  }

  function pickDataImage(review) {
    if (!review || typeof review !== 'object') return '';
    if (Array.isArray(review.images) && review.images[0]) return review.images[0];
    if (Array.isArray(review.photos) && review.photos[0]) return review.photos[0];
    return review.image || review.productImage || review.itemImage || review.photo || '';
  }

  function isRequestLinkedReview(review) {
    if (!review || typeof review !== 'object') return false;
    return !!(review.requestId || review.requestNumber);
  }

  function shouldUseLocalImage(review) {
    return !pickDataImage(review);
  }

  function toPublicUrl(relativePath) {
    if (!relativePath) return '';
    const text = String(relativePath).trim().replace(/\\/g, '/');
    if (/^https?:\/\//i.test(text) || /^data:/i.test(text)) return text;
    if (text.startsWith('/')) return text;
    return text.startsWith('assets/') ? '/' + text : BASE + text.replace(/^\//, '');
  }

  function findManifestFilename(productName, files) {
    if (!productName || !files) return '';
    if (files[productName]) return files[productName];
    const normalized = productName.replace(/\s+/g, ' ').trim();
    if (files[normalized]) return files[normalized];

    const keys = Object.keys(files);
    const exactCi = keys.find(function (k) {
      return k.toLowerCase() === normalized.toLowerCase();
    });
    if (exactCi) return files[exactCi];

    const partial = keys.find(function (k) {
      return k.includes(normalized) || normalized.includes(k);
    });
    return partial ? files[partial] : '';
  }

  function getLocalImageCandidates(review, manifest) {
    const productName = getProductName(review);
    if (!productName) return [];

    const files = (manifest && manifest.files) || {};
    const manifestFile = findManifestFilename(productName, files);
    if (!manifestFile) return [];
    return [BASE + manifestFile];
  }

  function resolveImage(review, manifest) {
    const dataImg = pickDataImage(review);
    const localRaw = getLocalImageCandidates(review, manifest || manifestCache);
    const localUrls = localRaw.map(toPublicUrl);

    if (dataImg) {
      const dataUrl = toPublicUrl(dataImg);
      const fallbacks = localUrls.filter(function (u) { return u && u !== dataUrl; });
      return { src: dataUrl, fallbacks: fallbacks, source: 'data' };
    }

    if (!shouldUseLocalImage(review) && !localUrls.length) {
      return { src: '', fallbacks: [], source: 'none' };
    }

    return {
      src: localUrls[0] || '',
      fallbacks: localUrls.slice(1),
      source: localUrls.length ? 'local' : 'none'
    };
  }

  function loadManifest() {
    if (manifestCache) return Promise.resolve(manifestCache);
    if (manifestPromise) return manifestPromise;
    manifestPromise = fetch(BASE + 'manifest.json')
      .then(function (res) { return res.ok ? res.json() : { files: {} }; })
      .catch(function () { return { files: {} }; })
      .then(function (data) {
        manifestCache = data && typeof data === 'object' ? data : { files: {} };
        if (!manifestCache.files) manifestCache.files = {};
        return manifestCache;
      });
    return manifestPromise;
  }

  function showPlaceholder(img) {
    img.classList.add('hidden');
    const placeholder = img.parentElement && img.parentElement.querySelector('[data-ph-img-placeholder]');
    if (placeholder) placeholder.classList.remove('hidden');
  }

  function attachFallbackHandler(img) {
    if (!img || img.dataset.phFallbackBound) return;
    img.dataset.phFallbackBound = '1';
    img.onerror = null;

    img.addEventListener('error', function onError() {
      if (img.dataset.phFallbackDone === '1') return;

      let fallbacks = [];
      try {
        fallbacks = JSON.parse(img.dataset.phFallbacks || '[]');
      } catch (e) {
        fallbacks = [];
      }

      while (fallbacks.length && fallbacks[0] === img.src) {
        fallbacks.shift();
      }

      if (!fallbacks.length) {
        img.dataset.phFallbackDone = '1';
        img.removeEventListener('error', onError);
        showPlaceholder(img);
        return;
      }

      const next = fallbacks.shift();
      img.dataset.phFallbacks = JSON.stringify(fallbacks);
      img.src = next;
    });
  }

  global.ReviewProductImages = {
    BASE: BASE,
    loadManifest: loadManifest,
    getProductName: getProductName,
    pickDataImage: pickDataImage,
    isRequestLinkedReview: isRequestLinkedReview,
    shouldUseLocalImage: shouldUseLocalImage,
    getLocalImageCandidates: getLocalImageCandidates,
    resolveImage: resolveImage,
    attachFallbackHandler: attachFallbackHandler,
    toPublicUrl: toPublicUrl
  };
})(typeof window !== 'undefined' ? window : globalThis);

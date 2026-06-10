/**
 * more-reviews 로컬 제품 이미지
 * - assets/review-products/ 폴더 + manifest.json
 * - Firestore에 이미지가 있으면 그대로 사용 (실제 의뢰 사진 3건 등)
 * - 이미지가 없는 후기만 로컬 폴더에서 제품명으로 조회
 */
(function (global) {
  const BASE = 'assets/review-products/';
  const EXTENSIONS = ['webp', 'jpg', 'jpeg', 'png'];

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

  function slugify(name) {
    return name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\u3131-\uD79D.-]+/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function getLocalImageCandidates(review, manifest) {
    const productName = getProductName(review);
    if (!productName) return [];

    const files = (manifest && manifest.files) || {};
    const urls = [];
    const seen = new Set();

    function pushUrl(filename) {
      if (!filename || seen.has(filename)) return;
      seen.add(filename);
      urls.push(BASE + filename);
    }

    if (files[productName]) {
      pushUrl(files[productName]);
    }

    EXTENSIONS.forEach(function (ext) {
      pushUrl(encodeURIComponent(productName) + '.' + ext);
    });

    const slug = slugify(productName);
    if (slug) {
      EXTENSIONS.forEach(function (ext) {
        pushUrl(slug + '.' + ext);
      });
    }

    return urls;
  }

  function resolveImage(review, manifest) {
    const dataImg = pickDataImage(review);
    if (dataImg) {
      return { src: dataImg, fallbacks: [], source: 'data' };
    }
    if (!shouldUseLocalImage(review)) {
      return { src: '', fallbacks: [], source: 'none' };
    }
    const candidates = getLocalImageCandidates(review, manifest || manifestCache);
    return {
      src: candidates[0] || '',
      fallbacks: candidates.slice(1),
      source: candidates.length ? 'local' : 'none'
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

  function attachFallbackHandler(img) {
    if (!img || img.dataset.phFallbackBound) return;
    img.dataset.phFallbackBound = '1';
    img.addEventListener('error', function onError() {
      let fallbacks = [];
      try {
        fallbacks = JSON.parse(img.dataset.phFallbacks || '[]');
      } catch (e) {
        fallbacks = [];
      }
      if (!fallbacks.length) {
        img.removeEventListener('error', onError);
        img.classList.add('hidden');
        const placeholder = img.parentElement && img.parentElement.querySelector('[data-ph-img-placeholder]');
        if (placeholder) placeholder.classList.remove('hidden');
        return;
      }
      img.src = fallbacks.shift();
      img.dataset.phFallbacks = JSON.stringify(fallbacks);
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
    attachFallbackHandler: attachFallbackHandler
  };

  global.__phReviewImgFallback = function (img) {
    attachFallbackHandler(img);
    img.dispatchEvent(new Event('error'));
  };
})(typeof window !== 'undefined' ? window : globalThis);

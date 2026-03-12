const DEFAULT_GALLERY_INDEX_URL = String(
  import.meta.env.VITE_GALLERY_INDEX_URL || 'https://images.1701701.xyz/gallery-index.json'
).trim();
const MEMORY_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
let cachedItems = null;
let cachedAt = 0;
let inflightItemsPromise = null;

const toAbsoluteUrl = (value, fallbackBase = '') => {
  const input = String(value || '').trim();
  if (!input) return '';
  try {
    return new URL(input).toString();
  } catch {
    if (!fallbackBase) return '';
    try {
      return new URL(input, fallbackBase).toString();
    } catch {
      return '';
    }
  }
};

const parseGalleryIndexItems = (payload, fallbackBase = '') => {
  const gallery = payload?.gallery;
  if (!gallery || typeof gallery !== 'object') return [];

  const seen = new Set();
  const result = [];

  for (const [category, categoryData] of Object.entries(gallery)) {
    const images = Array.isArray(categoryData?.images) ? categoryData.images : [];
    for (const image of images) {
      const original = toAbsoluteUrl(image?.original, fallbackBase);
      if (!original || seen.has(original)) continue;

      seen.add(original);
      const preview = toAbsoluteUrl(image?.preview, fallbackBase) || original;
      const name = typeof image?.name === 'string' && image.name
        ? image.name
        : original.split('/').pop() || 'image';

      result.push({
        id: `${category}/${name}/${original}`,
        category,
        name,
        url: original,
        previewUrl: preview
      });
    }
  }

  return result.sort(
    (left, right) => left.category.localeCompare(right.category) || left.name.localeCompare(right.name)
  );
};

const loadRemoteItems = async () => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const endpoint = toAbsoluteUrl(DEFAULT_GALLERY_INDEX_URL, origin) || DEFAULT_GALLERY_INDEX_URL;
  if (!endpoint) {
    throw new Error('图库清单地址为空');
  }

  const response = await fetch(endpoint, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`图库索引请求失败（HTTP ${response.status}）`);
  }

  const payload = await response.json();
  return parseGalleryIndexItems(payload, endpoint);
};

const fetchAndCacheItems = async () => {
  const items = await loadRemoteItems();
  cachedItems = items;
  cachedAt = Date.now();
  return items;
};

export const loadGalleryItems = async () => {
  const now = Date.now();
  if (cachedItems && now - cachedAt < MEMORY_CACHE_TTL_MS) {
    return cachedItems;
  }
  if (inflightItemsPromise) {
    return await inflightItemsPromise;
  }

  inflightItemsPromise = fetchAndCacheItems().finally(() => {
    inflightItemsPromise = null;
  });

  return await inflightItemsPromise;
};

export const refreshGalleryItems = async () => {
  if (inflightItemsPromise) {
    return await inflightItemsPromise;
  }

  inflightItemsPromise = fetchAndCacheItems().finally(() => {
    inflightItemsPromise = null;
  });

  return await inflightItemsPromise;
};

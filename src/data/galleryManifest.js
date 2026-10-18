const DEFAULT_GALLERY_INDEX_URL = String(
  import.meta.env.VITE_GALLERY_INDEX_URL || 'https://imgs.1701701.xyz/data/images.json'
).trim();
import {
  clearPersistentManifestCache,
  readPersistentManifestCache,
  writePersistentManifestCache
} from './persistentManifestCache.js';
import { createManifestRefreshNotifier } from './manifestRefreshNotifier.js';

const PERSISTENT_CACHE_KEY = 'manifest-cache:gallery:v2';
// v1 的清单会存 7 天且期间不发请求，新图集老用户看不到；升版本让存量用户重拉一次。
const LEGACY_PERSISTENT_CACHE_KEYS = ['manifest-cache:gallery:v1'];
const PERSISTENT_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
// 缓存照用，但每次进站后台校验一次；同一标签页内 5 分钟内不重复请求。
const BACKGROUND_REVALIDATE_INTERVAL_MS = 5 * 60 * 1000;
let cachedItems = null;
let inflightItemsPromise = null;
let lastRevalidateAt = 0;
let legacyCacheCleaned = false;
const galleryManifestRefreshNotifier = createManifestRefreshNotifier();

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

const sortGalleryItems = (items) => items.sort(
  (left, right) => left.category.localeCompare(right.category) || left.name.localeCompare(right.name)
);

const decodePathSegment = (value) => {
  const input = String(value || '').trim();
  if (!input) return '';

  try {
    return decodeURIComponent(input);
  } catch {
    return input;
  }
};

const getFilenameFromUrl = (value) => {
  const input = String(value || '').trim();
  if (!input) return '';

  try {
    const url = new URL(input);
    const pathname = url.pathname.split('/').filter(Boolean);
    return decodePathSegment(pathname[pathname.length - 1] || '');
  } catch {
    const pathname = input.split(/[?#]/)[0].split('/').filter(Boolean);
    return decodePathSegment(pathname[pathname.length - 1] || '');
  }
};

const getCategoryFromPath = (value) => {
  const input = String(value || '').trim();
  if (!input) return '';

  try {
    const url = new URL(input);
    const pathname = url.pathname.split('/').filter(Boolean);
    return pathname.length >= 2 ? decodePathSegment(pathname[pathname.length - 2]) : '';
  } catch {
    const pathname = input.split(/[?#]/)[0].split('/').filter(Boolean);
    return pathname.length >= 2 ? decodePathSegment(pathname[pathname.length - 2]) : '';
  }
};

const parseFlatGalleryItems = (payload, fallbackBase = '') => {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const seen = new Set();
  const result = [];

  for (const item of items) {
    const original = toAbsoluteUrl(item?.original || item?.url, fallbackBase);
    if (!original || seen.has(original)) continue;

    seen.add(original);
    const category = String(
      item?.category
      || getCategoryFromPath(item?.path)
      || getCategoryFromPath(item?.id)
      || getCategoryFromPath(item?.url)
      || '未分类'
    ).trim() || '未分类';
    const name = String(item?.name || getFilenameFromUrl(original) || 'image').trim() || 'image';
    const preview = toAbsoluteUrl(
      item?.preview || item?.previewUrl || item?.thumbnail || item?.thumb,
      fallbackBase
    ) || original;

    result.push({
      id: String(item?.id || `${category}/${name}/${original}`),
      category,
      name,
      url: original,
      previewUrl: preview
    });
  }

  return sortGalleryItems(result);
};

const parseNestedGalleryItems = (payload, fallbackBase = '') => {
  const gallery = payload?.gallery;
  if (!gallery || typeof gallery !== 'object') return [];

  const seen = new Set();
  const result = [];

  for (const [rawCategory, categoryData] of Object.entries(gallery)) {
    const category = String(rawCategory || '').trim();
    if (!category) continue;
    const images = Array.isArray(categoryData?.images) ? categoryData.images : [];
    for (const image of images) {
      const original = toAbsoluteUrl(image?.original, fallbackBase);
      if (!original || seen.has(original)) continue;

      seen.add(original);
      const preview = toAbsoluteUrl(image?.preview, fallbackBase) || original;
      const name = String(image?.name || getFilenameFromUrl(original) || 'image').trim() || 'image';

      result.push({
        id: `${category}/${name}/${original}`,
        category,
        name,
        url: original,
        previewUrl: preview
      });
    }
  }

  return sortGalleryItems(result);
};

const parseGalleryIndexItems = (payload, fallbackBase = '') => {
  const flatItems = parseFlatGalleryItems(payload, fallbackBase);
  if (flatItems.length > 0) {
    return flatItems;
  }

  return parseNestedGalleryItems(payload, fallbackBase);
};

const loadRemoteItems = async () => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const endpoint = toAbsoluteUrl(DEFAULT_GALLERY_INDEX_URL, origin) || DEFAULT_GALLERY_INDEX_URL;
  if (!endpoint) {
    throw new Error('图库清单地址为空');
  }

  const response = await fetch(endpoint, { cache: 'default' });
  if (!response.ok) {
    throw new Error(`图库索引请求失败（HTTP ${response.status}）`);
  }

  const payload = await response.json();
  return parseGalleryIndexItems(payload, endpoint);
};

export const __resetGalleryManifestCacheForTests = () => {
  cachedItems = null;
  inflightItemsPromise = null;
  lastRevalidateAt = 0;
  legacyCacheCleaned = false;
  galleryManifestRefreshNotifier.clear();
  clearPersistentManifestCache(PERSISTENT_CACHE_KEY);
  LEGACY_PERSISTENT_CACHE_KEYS.forEach((key) => clearPersistentManifestCache(key));
};

export const subscribeToGalleryItems = galleryManifestRefreshNotifier.subscribe;

const clearLegacyCachesOnce = () => {
  if (legacyCacheCleaned) return;
  legacyCacheCleaned = true;
  LEGACY_PERSISTENT_CACHE_KEYS.forEach((key) => clearPersistentManifestCache(key));
};

const fetchAndCacheItems = async () => {
  const items = await loadRemoteItems();
  cachedItems = items;
  writePersistentManifestCache(PERSISTENT_CACHE_KEY, items);
  return items;
};

const runFetch = () => {
  if (inflightItemsPromise) return inflightItemsPromise;
  inflightItemsPromise = fetchAndCacheItems().finally(() => {
    inflightItemsPromise = null;
  });
  return inflightItemsPromise;
};

const revalidateInBackground = (now) => {
  if (now - lastRevalidateAt < BACKGROUND_REVALIDATE_INTERVAL_MS) return;
  if (inflightItemsPromise) return;
  lastRevalidateAt = now;
  galleryManifestRefreshNotifier.refreshInBackground(runFetch());
};

export const loadGalleryItems = async () => {
  clearLegacyCachesOnce();
  const now = Date.now();

  if (cachedItems) {
    revalidateInBackground(now);
    return cachedItems;
  }

  const persistedCache = readPersistentManifestCache(PERSISTENT_CACHE_KEY);
  if (persistedCache?.data) {
    cachedItems = persistedCache.data;

    if (now - persistedCache.savedAt < PERSISTENT_CACHE_TTL_MS) {
      revalidateInBackground(now);
      return cachedItems;
    }
  }

  if (inflightItemsPromise) {
    return await inflightItemsPromise;
  }

  try {
    inflightItemsPromise = fetchAndCacheItems().finally(() => {
      inflightItemsPromise = null;
    });
    return await inflightItemsPromise;
  } catch (error) {
    if (cachedItems) return cachedItems;
    throw error;
  }
};

/** 手动刷新图集：丢缓存强制重拉并推给订阅者。 */
export const refreshGalleryItems = async () => {
  clearPersistentManifestCache(PERSISTENT_CACHE_KEY);
  cachedItems = null;
  lastRevalidateAt = Date.now();

  const refreshPromise = runFetch();
  galleryManifestRefreshNotifier.refreshInBackground(refreshPromise);

  return await refreshPromise;
};

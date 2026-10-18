const DEFAULT_VIDEO_INDEX_URL = String(
  import.meta.env.VITE_VIDEO_INDEX_URL || 'https://r2.1701701.xyz/json/video-index.json'
).trim();
import {
  clearPersistentManifestCache,
  readPersistentManifestCache,
  writePersistentManifestCache
} from './persistentManifestCache.js';
import {
  fetchJsonWithBundledFallback,
  toAbsoluteUrl
} from './manifestSourceUtils.js';
import { createManifestRefreshNotifier } from './manifestRefreshNotifier.js';

const PERSISTENT_CACHE_KEY = 'manifest-cache:video:v2';
// v1 的清单会存 7 天且期间不发请求，新视频老用户看不到；升版本让存量用户重拉一次。
const LEGACY_PERSISTENT_CACHE_KEYS = ['manifest-cache:video:v1'];
const BUNDLED_SNAPSHOT_PATH = '/video-index.json';
const PERSISTENT_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
// 缓存照用，但每次进站后台校验一次；同一标签页内 5 分钟内不重复请求。
const BACKGROUND_REVALIDATE_INTERVAL_MS = 5 * 60 * 1000;
let cachedCatalog = null;
let inflightCatalogPromise = null;
let lastRevalidateAt = 0;
let legacyCacheCleaned = false;
const videoManifestRefreshNotifier = createManifestRefreshNotifier();

const resolveAssetUrl = (value, fallbackBase = '') => {
  const input = String(value || '').trim();
  if (!input) return '';
  return toAbsoluteUrl(input, fallbackBase) || input;
};

const toLegacyIcon = (value) => {
  const icon = String(value || '').trim();
  if (!icon) return '#icon-video';
  if (icon.startsWith('#')) return icon;
  if (icon.startsWith('icon-')) return `#${icon}`;
  return `#icon-${icon}`;
};

const toSortedList = (input) => {
  const list = Array.isArray(input) ? input : [];
  return list
    .map((item, index) => {
      const sortOrder = Number(item?.sortOrder);
      return {
        item,
        index,
        sortOrder: Number.isFinite(sortOrder) ? sortOrder : index * 10
      };
    })
    .sort((left, right) => (
      left.sortOrder - right.sortOrder || left.index - right.index
    ))
    .map((entry) => entry.item);
};

const normalizeVideoItems = (items, videoMap, parentId, assetBase = '') => {
  const result = [];

  toSortedList(items).forEach((item, index) => {
    if (!item || item.enabled === false) return;

    const itemType = String(item.type || '').trim().toLowerCase();
    const hasChildren = Array.isArray(item.items) && item.items.length > 0;
    const isFolder = itemType === 'folder' || item.isFolder || item.folderId || hasChildren;

    if (isFolder) {
      const folderId = String(item.id || item.folderId || `${parentId}-folder-${index + 1}`);
      const title = String(item.title || folderId).trim() || folderId;
      const thumb = resolveAssetUrl(item.thumb, assetBase);
      videoMap[folderId] = normalizeVideoItems(item.items, videoMap, folderId, assetBase);
      result.push({
        id: item.id ?? folderId,
        title,
        isFolder: true,
        folderId,
        thumb
      });
      return;
    }

    const title = String(item.title || '').trim();
    const url = resolveAssetUrl(item.url, assetBase);
    if (!title || !url) return;

    result.push({
      id: item.id ?? `${parentId}-video-${index + 1}`,
      title,
      url,
      backupUrl: resolveAssetUrl(item.backupUrl, assetBase),
      thumb: resolveAssetUrl(item.thumb, assetBase)
    });
  });

  return result;
};

const parseVideoManifest = (payload, assetBase = '') => {
  const categories = toSortedList(payload?.categories).filter((category) => (
    category &&
    category.enabled !== false &&
    String(category.id || '').trim()
  ));
  if (categories.length === 0) return null;

  const videoCategories = [];
  const videoData = {};

  categories.forEach((category) => {
    const id = String(category.id || '').trim();
    const name = String(category.name || id).trim() || id;
    videoCategories.push({
      id,
      name,
      icon: toLegacyIcon(category.icon)
    });
    videoData[id] = normalizeVideoItems(category.items, videoData, id, assetBase);
  });

  return { videoCategories, videoData };
};

const loadRemoteCatalog = async () => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const endpoint = toAbsoluteUrl(DEFAULT_VIDEO_INDEX_URL, origin) || DEFAULT_VIDEO_INDEX_URL;
  if (!endpoint) {
    throw new Error('视频清单地址为空');
  }

  const { payload, resolvedUrl } = await fetchJsonWithBundledFallback({
    primaryUrl: endpoint,
    fallbackPath: BUNDLED_SNAPSHOT_PATH,
    requestLabel: '视频清单请求失败'
  });
  const parsed = parseVideoManifest(payload, resolvedUrl);
  if (!parsed) {
    throw new Error('视频清单格式无效');
  }
  return parsed;
};

export const __resetVideoManifestCacheForTests = () => {
  cachedCatalog = null;
  inflightCatalogPromise = null;
  lastRevalidateAt = 0;
  legacyCacheCleaned = false;
  videoManifestRefreshNotifier.clear();
  clearPersistentManifestCache(PERSISTENT_CACHE_KEY);
  LEGACY_PERSISTENT_CACHE_KEYS.forEach((key) => clearPersistentManifestCache(key));
};

export const subscribeToVideoCatalog = videoManifestRefreshNotifier.subscribe;

const clearLegacyCachesOnce = () => {
  if (legacyCacheCleaned) return;
  legacyCacheCleaned = true;
  LEGACY_PERSISTENT_CACHE_KEYS.forEach((key) => clearPersistentManifestCache(key));
};

const loadAndPersistCatalog = async () => {
  if (inflightCatalogPromise) {
    return await inflightCatalogPromise;
  }

  inflightCatalogPromise = loadRemoteCatalog()
    .then((catalog) => {
      cachedCatalog = catalog;
      writePersistentManifestCache(PERSISTENT_CACHE_KEY, catalog);
      return catalog;
    })
    .finally(() => {
      inflightCatalogPromise = null;
    });

  return await inflightCatalogPromise;
};

const revalidateInBackground = (now) => {
  if (now - lastRevalidateAt < BACKGROUND_REVALIDATE_INTERVAL_MS) return;
  if (inflightCatalogPromise) return;
  lastRevalidateAt = now;
  videoManifestRefreshNotifier.refreshInBackground(loadAndPersistCatalog());
};

/** 手动刷新视频清单：丢缓存强制重拉并推给订阅者。 */
export const refreshVideoCatalog = () => {
  clearPersistentManifestCache(PERSISTENT_CACHE_KEY);
  cachedCatalog = null;
  lastRevalidateAt = Date.now();
  const refreshPromise = loadAndPersistCatalog();
  videoManifestRefreshNotifier.refreshInBackground(refreshPromise);
  return refreshPromise;
};

export const loadVideoCatalog = async () => {
  clearLegacyCachesOnce();
  const now = Date.now();

  if (cachedCatalog) {
    revalidateInBackground(now);
    return cachedCatalog;
  }

  const persistedCache = readPersistentManifestCache(PERSISTENT_CACHE_KEY);
  if (persistedCache?.data) {
    cachedCatalog = persistedCache.data;

    if (now - persistedCache.savedAt < PERSISTENT_CACHE_TTL_MS) {
      revalidateInBackground(now);
      return cachedCatalog;
    }
  }

  try {
    return await loadAndPersistCatalog();
  } catch (error) {
    if (cachedCatalog) return cachedCatalog;
    throw error;
  }
};

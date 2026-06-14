const DEFAULT_DOWNLOAD_INDEX_URL = String(
  import.meta.env.VITE_DOWNLOAD_INDEX_URL || 'https://r2.1701701.xyz/json/download-index.json'
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

const PERSISTENT_CACHE_KEY = 'manifest-cache:download:v1';
const BUNDLED_SNAPSHOT_PATH = '/download-index.json';
const MEMORY_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const PERSISTENT_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
let cachedSections = null;
let cachedAt = 0;
let inflightSectionsPromise = null;
const downloadManifestRefreshNotifier = createManifestRefreshNotifier();

const resolveAssetUrl = (value, fallbackBase = '') => {
  const input = String(value || '').trim();
  if (!input) return '';
  return toAbsoluteUrl(input, fallbackBase) || input;
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

const normalizeItem = (item, assetBase = '') => {
  if (!item || item.enabled === false) return null;
  const title = String(item.title || '').trim();
  const url = resolveAssetUrl(item.url, assetBase);
  if (!title || !url) return null;

  return {
    title,
    url,
    filename: String(item.filename || '').trim() || undefined,
    previewUrl: resolveAssetUrl(item.previewUrl, assetBase) || undefined
  };
};

const normalizeGroup = (group, assetBase = '') => {
  if (!group || group.enabled === false) return null;
  const title = String(group.title || '').trim();
  if (!title) return null;

  const items = toSortedList(group.items)
    .map((item) => normalizeItem(item, assetBase))
    .filter(Boolean);
  if (items.length === 0) return null;

  return { title, items };
};

const normalizeSection = (section, assetBase = '') => {
  if (!section || section.enabled === false) return null;
  const title = String(section.title || '').trim();
  if (!title) return null;

  const groups = toSortedList(section.groups)
    .map((group) => normalizeGroup(group, assetBase))
    .filter(Boolean);
  if (groups.length === 0) return null;

  return {
    title,
    groups,
    note: section.note && typeof section.note === 'object'
      ? {
          label: String(section.note.label || '').trim(),
          href: resolveAssetUrl(section.note.href, assetBase) || String(section.note.href || '').trim()
        }
      : undefined
  };
};

const parseDownloadManifest = (payload, assetBase = '') => {
  const sections = toSortedList(payload?.sections)
    .map((section) => normalizeSection(section, assetBase))
    .filter(Boolean);

  return sections.length > 0 ? sections : null;
};

const loadRemoteSections = async () => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const endpoint = toAbsoluteUrl(DEFAULT_DOWNLOAD_INDEX_URL, origin) || DEFAULT_DOWNLOAD_INDEX_URL;
  if (!endpoint) {
    throw new Error('下载清单地址为空');
  }

  const { payload, resolvedUrl } = await fetchJsonWithBundledFallback({
    primaryUrl: endpoint,
    fallbackPath: BUNDLED_SNAPSHOT_PATH,
    requestLabel: '下载清单请求失败'
  });
  const parsed = parseDownloadManifest(payload, resolvedUrl);
  if (!parsed) {
    throw new Error('下载清单格式无效');
  }
  return parsed;
};

export const __resetDownloadManifestCacheForTests = () => {
  cachedSections = null;
  cachedAt = 0;
  inflightSectionsPromise = null;
  downloadManifestRefreshNotifier.clear();
  clearPersistentManifestCache(PERSISTENT_CACHE_KEY);
};

export const subscribeToDownloadSections = downloadManifestRefreshNotifier.subscribe;

const loadAndPersistSections = async () => {
  if (inflightSectionsPromise) {
    return await inflightSectionsPromise;
  }

  inflightSectionsPromise = loadRemoteSections()
    .then((sections) => {
      cachedSections = sections;
      cachedAt = Date.now();
      writePersistentManifestCache(PERSISTENT_CACHE_KEY, sections);
      return sections;
    })
    .finally(() => {
      inflightSectionsPromise = null;
    });

  return await inflightSectionsPromise;
};

export const loadDownloadSections = async () => {
  const now = Date.now();
  if (cachedSections && now - cachedAt < MEMORY_CACHE_TTL_MS) {
    return cachedSections;
  }
  if (cachedSections) {
    downloadManifestRefreshNotifier.refreshInBackground(loadAndPersistSections());
    return cachedSections;
  }

  const persistedCache = readPersistentManifestCache(PERSISTENT_CACHE_KEY);
  if (persistedCache?.data) {
    cachedSections = persistedCache.data;
    cachedAt = persistedCache.savedAt;

    if (now - persistedCache.savedAt < PERSISTENT_CACHE_TTL_MS) {
      if (now - persistedCache.savedAt >= MEMORY_CACHE_TTL_MS) {
        downloadManifestRefreshNotifier.refreshInBackground(loadAndPersistSections());
      }
      return cachedSections;
    }
  }

  try {
    return await loadAndPersistSections();
  } catch (error) {
    if (cachedSections) return cachedSections;
    throw error;
  }
};

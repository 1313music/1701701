const DEFAULT_MUSIC_INDEX_URL = String(
  import.meta.env.VITE_MUSIC_INDEX_URL || 'https://r2.1701701.xyz/json/music-index.json'
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

const PERSISTENT_CACHE_KEY = 'manifest-cache:music:v2';
// v1 时代清单一存 7 天、且缓存没过期时一个请求都不发，导致新增专辑老用户永远看不到。
// 升到 v2 后旧 key 一律丢弃，让存量用户下次打开就重新拉一次。
const LEGACY_PERSISTENT_CACHE_KEYS = ['manifest-cache:music:v1'];
const BUNDLED_SNAPSHOT_PATH = '/music-index.json';
const PERSISTENT_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
// 缓存照用，但每次进站都在后台校验一次；同一标签页内 5 分钟内不重复请求。
const BACKGROUND_REVALIDATE_INTERVAL_MS = 5 * 60 * 1000;
const ALBUM_SORT_ORDER_OVERRIDES = Object.freeze({
  'tokyo-live': 8,
  'san-que-yi-kl': 9,
  'forbidden-games': 10
});
let cachedAlbums = null;
let inflightAlbumsPromise = null;
let lastRevalidateAt = 0;
let legacyCacheCleaned = false;
const musicManifestRefreshNotifier = createManifestRefreshNotifier();

const resolveAssetUrl = (value, fallbackBase = '') => {
  const input = String(value || '').trim();
  if (!input) return '';
  return toAbsoluteUrl(input, fallbackBase) || input;
};

const toSortedList = (input, getSortOrderOverride) => {
  const list = Array.isArray(input) ? input : [];
  return list
    .map((item, index) => {
      const overrideSortOrder = typeof getSortOrderOverride === 'function'
        ? getSortOrderOverride(item)
        : undefined;
      const sortOrder = Number(overrideSortOrder ?? item?.sortOrder);
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

const getAlbumSortOrderOverride = (album) => {
  const albumId = String(album?.id || '').trim();
  return ALBUM_SORT_ORDER_OVERRIDES[albumId];
};

const normalizeSong = (song, albumId, index, assetBase = '') => {
  if (!song || song.enabled === false) return null;
  const src = resolveAssetUrl(song.src, assetBase);
  if (!src) return null;

  const trackNumber = Number(song.trackNumber);
  const safeTrackNumber = Number.isFinite(trackNumber) && trackNumber > 0
    ? trackNumber
    : index + 1;
  const songId = String(song.id || `${albumId}-${String(safeTrackNumber).padStart(2, '0')}`);

  return {
    id: songId,
    trackNumber: safeTrackNumber,
    name: String(song.name || `Track ${safeTrackNumber}`).trim() || `Track ${safeTrackNumber}`,
    src,
    lrc: resolveAssetUrl(song.lrc, assetBase),
    cover: resolveAssetUrl(song.cover, assetBase)
  };
};

const normalizeAlbum = (album, assetBase = '') => {
  if (!album || album.enabled === false) return null;
  const albumId = String(album.id || '').trim();
  if (!albumId) return null;

  const songs = toSortedList(album.songs)
    .map((song, songIndex) => normalizeSong(song, albumId, songIndex, assetBase))
    .filter(Boolean);
  if (songs.length === 0) return null;

  return {
    id: albumId,
    name: String(album.name || albumId).trim() || albumId,
    artist: String(album.artist || '').trim(),
    cover: resolveAssetUrl(album.cover, assetBase),
    year: Number.isFinite(Number(album.year)) ? Number(album.year) : undefined,
    type: String(album.type || '').trim() || undefined,
    releaseDate: String(album.releaseDate || '').trim() || undefined,
    description: String(album.description || '').trim() || undefined,
    profileSourceName: String(album.profileSourceName || '').trim() || undefined,
    profileSourceUrl: resolveAssetUrl(album.profileSourceUrl, assetBase) || undefined,
    songs
  };
};

const parseMusicManifest = (payload, assetBase = '') => {
  const albums = toSortedList(payload?.albums, getAlbumSortOrderOverride)
    .map((album) => normalizeAlbum(album, assetBase))
    .filter(Boolean);

  return albums.length > 0 ? albums : null;
};

const loadRemoteAlbums = async () => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const endpoint = toAbsoluteUrl(DEFAULT_MUSIC_INDEX_URL, origin) || DEFAULT_MUSIC_INDEX_URL;
  if (!endpoint) {
    throw new Error('音乐清单地址为空');
  }

  const { payload, resolvedUrl } = await fetchJsonWithBundledFallback({
    primaryUrl: endpoint,
    fallbackPath: BUNDLED_SNAPSHOT_PATH,
    requestLabel: '音乐清单请求失败'
  });
  const parsed = parseMusicManifest(payload, resolvedUrl);
  if (!parsed) {
    throw new Error('音乐清单格式无效');
  }
  return parsed;
};

export const __resetMusicManifestCacheForTests = () => {
  cachedAlbums = null;
  inflightAlbumsPromise = null;
  lastRevalidateAt = 0;
  legacyCacheCleaned = false;
  musicManifestRefreshNotifier.clear();
  clearPersistentManifestCache(PERSISTENT_CACHE_KEY);
  LEGACY_PERSISTENT_CACHE_KEYS.forEach((key) => clearPersistentManifestCache(key));
};

export const subscribeToMusicManifestAlbums = musicManifestRefreshNotifier.subscribe;

const clearLegacyCachesOnce = () => {
  if (legacyCacheCleaned) return;
  legacyCacheCleaned = true;
  LEGACY_PERSISTENT_CACHE_KEYS.forEach((key) => clearPersistentManifestCache(key));
};

const loadAndPersistAlbums = async () => {
  if (inflightAlbumsPromise) {
    return await inflightAlbumsPromise;
  }

  inflightAlbumsPromise = loadRemoteAlbums()
    .then((albums) => {
      cachedAlbums = albums;
      writePersistentManifestCache(PERSISTENT_CACHE_KEY, albums);
      return albums;
    })
    .finally(() => {
      inflightAlbumsPromise = null;
    });

  return await inflightAlbumsPromise;
};

// 缓存照常先渲染，同时后台拉一次最新清单；拉到后 notify 订阅者，列表就地热更新。
const revalidateInBackground = (now) => {
  if (now - lastRevalidateAt < BACKGROUND_REVALIDATE_INTERVAL_MS) return;
  if (inflightAlbumsPromise) return;
  lastRevalidateAt = now;
  musicManifestRefreshNotifier.refreshInBackground(loadAndPersistAlbums());
};

/**
 * 手动刷新曲库：丢掉本地缓存强制重拉，并把结果推给订阅者。
 * 只清 music 清单缓存，不碰收藏（tempPlaylistIds）、最近播放、音量等其它 key。
 */
export const refreshMusicManifestAlbums = () => {
  clearPersistentManifestCache(PERSISTENT_CACHE_KEY);
  cachedAlbums = null;
  lastRevalidateAt = Date.now();
  const refreshPromise = loadAndPersistAlbums();
  musicManifestRefreshNotifier.refreshInBackground(refreshPromise);
  return refreshPromise;
};

export const loadMusicManifestAlbums = async () => {
  clearLegacyCachesOnce();
  const now = Date.now();

  if (cachedAlbums) {
    revalidateInBackground(now);
    return cachedAlbums;
  }

  const persistedCache = readPersistentManifestCache(PERSISTENT_CACHE_KEY);
  if (persistedCache?.data) {
    cachedAlbums = persistedCache.data;

    if (now - persistedCache.savedAt < PERSISTENT_CACHE_TTL_MS) {
      // 关键改动：以前这里只在缓存超过 6 小时才后台校验，等于新增专辑要等一周。
      revalidateInBackground(now);
      return cachedAlbums;
    }
  }

  try {
    return await loadAndPersistAlbums();
  } catch (error) {
    if (cachedAlbums) return cachedAlbums;
    throw error;
  }
};

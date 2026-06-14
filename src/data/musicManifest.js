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

const PERSISTENT_CACHE_KEY = 'manifest-cache:music:v1';
const BUNDLED_SNAPSHOT_PATH = '/music-index.json';
const MEMORY_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const PERSISTENT_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ALBUM_SORT_ORDER_OVERRIDES = Object.freeze({
  'forbidden-games': 10,
  'san-que-yi-kl': 1000000,
  'tokyo-live': 1000010
});
let cachedAlbums = null;
let cachedAt = 0;
let inflightAlbumsPromise = null;
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
  cachedAt = 0;
  inflightAlbumsPromise = null;
  musicManifestRefreshNotifier.clear();
  clearPersistentManifestCache(PERSISTENT_CACHE_KEY);
};

export const subscribeToMusicManifestAlbums = musicManifestRefreshNotifier.subscribe;

const loadAndPersistAlbums = async () => {
  if (inflightAlbumsPromise) {
    return await inflightAlbumsPromise;
  }

  inflightAlbumsPromise = loadRemoteAlbums()
    .then((albums) => {
      cachedAlbums = albums;
      cachedAt = Date.now();
      writePersistentManifestCache(PERSISTENT_CACHE_KEY, albums);
      return albums;
    })
    .finally(() => {
      inflightAlbumsPromise = null;
    });

  return await inflightAlbumsPromise;
};

export const loadMusicManifestAlbums = async () => {
  const now = Date.now();
  if (cachedAlbums && now - cachedAt < MEMORY_CACHE_TTL_MS) {
    return cachedAlbums;
  }
  if (cachedAlbums) {
    musicManifestRefreshNotifier.refreshInBackground(loadAndPersistAlbums());
    return cachedAlbums;
  }

  const persistedCache = readPersistentManifestCache(PERSISTENT_CACHE_KEY);
  if (persistedCache?.data) {
    cachedAlbums = persistedCache.data;
    cachedAt = persistedCache.savedAt;

    if (now - persistedCache.savedAt < PERSISTENT_CACHE_TTL_MS) {
      if (now - persistedCache.savedAt >= MEMORY_CACHE_TTL_MS) {
        musicManifestRefreshNotifier.refreshInBackground(loadAndPersistAlbums());
      }
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

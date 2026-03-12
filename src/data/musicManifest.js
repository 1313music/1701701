const DEFAULT_MUSIC_INDEX_URL = String(
  import.meta.env.VITE_MUSIC_INDEX_URL || 'https://r2.1701701.xyz/json/music-index.json'
).trim();
const MEMORY_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
let cachedAlbums = null;
let cachedAt = 0;
let inflightAlbumsPromise = null;

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

const normalizeSong = (song, albumId, index) => {
  if (!song || song.enabled === false) return null;
  const src = String(song.src || '').trim();
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
    lrc: String(song.lrc || '').trim(),
    cover: String(song.cover || '').trim()
  };
};

const normalizeAlbum = (album) => {
  if (!album || album.enabled === false) return null;
  const albumId = String(album.id || '').trim();
  if (!albumId) return null;

  const songs = toSortedList(album.songs)
    .map((song, songIndex) => normalizeSong(song, albumId, songIndex))
    .filter(Boolean);
  if (songs.length === 0) return null;

  return {
    id: albumId,
    name: String(album.name || albumId).trim() || albumId,
    artist: String(album.artist || '').trim(),
    cover: String(album.cover || '').trim(),
    year: Number.isFinite(Number(album.year)) ? Number(album.year) : undefined,
    type: String(album.type || '').trim() || undefined,
    songs
  };
};

const parseMusicManifest = (payload) => {
  const albums = toSortedList(payload?.albums)
    .map((album) => normalizeAlbum(album))
    .filter(Boolean);

  return albums.length > 0 ? albums : null;
};

const loadRemoteAlbums = async () => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const endpoint = toAbsoluteUrl(DEFAULT_MUSIC_INDEX_URL, origin) || DEFAULT_MUSIC_INDEX_URL;
  if (!endpoint) {
    throw new Error('音乐清单地址为空');
  }

  const response = await fetch(endpoint, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`音乐清单请求失败（HTTP ${response.status}）`);
  }

  const payload = await response.json();
  const parsed = parseMusicManifest(payload);
  if (!parsed) {
    throw new Error('音乐清单格式无效');
  }
  return parsed;
};

export const loadMusicManifestAlbums = async () => {
  const now = Date.now();
  if (cachedAlbums && now - cachedAt < MEMORY_CACHE_TTL_MS) {
    return cachedAlbums;
  }
  if (inflightAlbumsPromise) {
    return await inflightAlbumsPromise;
  }

  inflightAlbumsPromise = loadRemoteAlbums()
    .then((albums) => {
      cachedAlbums = albums;
      cachedAt = Date.now();
      return albums;
    })
    .finally(() => {
      inflightAlbumsPromise = null;
    });

  return await inflightAlbumsPromise;
};

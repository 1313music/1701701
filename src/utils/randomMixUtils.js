export const RANDOM_MIX_ALBUM_ID = 'random-mix';
export const ALL_SITE_SHUFFLE_ALBUM_ID = 'all-site-shuffle';
export const ALL_SITE_SEQUENTIAL_ALBUM_ID = 'all-site-sequential';
export const DEFAULT_RANDOM_MIX_SIZE = 25;

const isValidAlbum = (album) => album && Array.isArray(album.songs);

export const flattenLibrarySongs = (albums) => {
  if (!Array.isArray(albums)) return [];
  const entries = [];
  const seenSrcs = new Set();

  for (const album of albums) {
    if (!isValidAlbum(album)) continue;
    for (const song of album.songs) {
      const src = song?.src;
      if (!src || seenSrcs.has(src)) continue;
      seenSrcs.add(src);
      entries.push({ album, song });
    }
  }

  return entries;
};

const toVirtualSong = ({ album, song }) => ({
  ...song,
  cover: song.cover || album.cover || '',
  artist: album.artist || '',
  sourceAlbumId: album.id || '',
  sourceAlbumName: album.name || ''
});

const buildCoverGrid = (entries) => {
  const covers = [];
  const seen = new Set();
  for (const entry of entries) {
    const cover = entry?.song?.cover || entry?.album?.cover || '';
    if (!cover || seen.has(cover)) continue;
    seen.add(cover);
    covers.push(cover);
    if (covers.length >= 4) break;
  }
  return covers;
};

const countSourceAlbums = (entries) => {
  const sourceIds = new Set();
  for (const entry of entries) {
    const sourceId = entry?.album?.id || entry?.album?.name || '';
    if (sourceId) sourceIds.add(sourceId);
  }
  return sourceIds.size;
};

const shuffleEntries = (entries, random = Math.random) => {
  const shuffled = [...entries];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
};

const findDiverseCandidateIndex = (pool, previousEntry) => {
  if (!previousEntry) return 0;
  const previousAlbumId = previousEntry.album?.id || '';
  const previousArtist = previousEntry.album?.artist || '';

  const differentAlbumAndArtistIndex = pool.findIndex((entry) => (
    (entry.album?.id || '') !== previousAlbumId
    && (entry.album?.artist || '') !== previousArtist
  ));
  if (differentAlbumAndArtistIndex >= 0) return differentAlbumAndArtistIndex;

  const differentAlbumIndex = pool.findIndex((entry) => (
    (entry.album?.id || '') !== previousAlbumId
  ));
  if (differentAlbumIndex >= 0) return differentAlbumIndex;

  return 0;
};

export const pickRandomMixEntries = (entries, {
  random = Math.random,
  size = DEFAULT_RANDOM_MIX_SIZE
} = {}) => {
  if (!Array.isArray(entries) || entries.length === 0) return [];
  const numericSize = Number(size);
  const safeSize = Number.isFinite(numericSize) && numericSize > 0
    ? Math.floor(numericSize)
    : DEFAULT_RANDOM_MIX_SIZE;
  const targetSize = Math.max(1, Math.min(safeSize, entries.length));
  const pool = shuffleEntries(entries, random);
  const picked = [];

  while (pool.length > 0 && picked.length < targetSize) {
    const previousEntry = picked[picked.length - 1] || null;
    const candidateIndex = findDiverseCandidateIndex(pool, previousEntry);
    picked.push(pool.splice(candidateIndex, 1)[0]);
  }

  return picked;
};

const buildVirtualAlbum = ({ id, name, artist, entries, virtualType }) => {
  if (!entries.length) return null;
  const songs = entries.map(toVirtualSong);
  return {
    id,
    name,
    artist,
    cover: songs[0]?.cover || '',
    coverGrid: buildCoverGrid(entries),
    isVirtual: true,
    sourceAlbumCount: countSourceAlbums(entries),
    virtualType,
    songs
  };
};

export const buildRandomMixAlbum = (albums, options = {}) => {
  const entries = flattenLibrarySongs(albums);
  const randomEntries = pickRandomMixEntries(entries, options);
  return buildVirtualAlbum({
    id: RANDOM_MIX_ALBUM_ID,
    name: '随便听',
    artist: '随机歌单',
    virtualType: 'random-mix',
    entries: randomEntries
  });
};

export const buildAllSiteShuffleAlbum = (albums, options = {}) => {
  const entries = flattenLibrarySongs(albums);
  const shuffledEntries = pickRandomMixEntries(entries, {
    ...options,
    size: entries.length
  });
  return buildVirtualAlbum({
    id: ALL_SITE_SHUFFLE_ALBUM_ID,
    name: '随机全站',
    artist: '全站随机',
    virtualType: 'all-site-shuffle',
    entries: shuffledEntries
  });
};

export const buildAllSiteSequentialAlbum = (albums) => {
  const entries = flattenLibrarySongs(albums);
  return buildVirtualAlbum({
    id: ALL_SITE_SEQUENTIAL_ALBUM_ID,
    name: '顺序全站',
    artist: '全站顺序',
    virtualType: 'all-site-sequential',
    entries
  });
};

import { sanitizeTempPlaylist } from './playlistUtils.js';

const normalizeIds = (ids) => sanitizeTempPlaylist(ids);

const getCandidateSongIds = (songs) => sanitizeTempPlaylist(
  Array.isArray(songs) ? songs.map((song) => song?.src) : []
);

export const toggleFavoriteId = (prevIds, id) => {
  const safePrev = normalizeIds(prevIds);
  if (!id) {
    return { nextIds: safePrev, action: 'noop' };
  }

  if (safePrev.includes(id)) {
    return {
      nextIds: safePrev.filter((item) => item !== id),
      action: 'removed'
    };
  }

  return {
    nextIds: [...safePrev, id],
    action: 'added'
  };
};

export const addFavoriteId = (prevIds, id) => {
  const safePrev = normalizeIds(prevIds);
  if (!id) {
    return { nextIds: safePrev, action: 'noop' };
  }

  if (safePrev.includes(id)) {
    return { nextIds: safePrev, action: 'noop' };
  }

  return {
    nextIds: [...safePrev, id],
    action: 'added'
  };
};

export const toggleAlbumFavoritesBySongs = (prevIds, songs) => {
  const safePrev = normalizeIds(prevIds);
  const candidateIds = getCandidateSongIds(songs);
  if (candidateIds.length === 0) {
    return { nextIds: safePrev, action: 'noop', count: 0 };
  }

  const prevSet = new Set(safePrev);
  const allFavorited = candidateIds.every((id) => prevSet.has(id));

  if (allFavorited) {
    const removeSet = new Set(candidateIds);
    return {
      nextIds: safePrev.filter((id) => !removeSet.has(id)),
      action: 'removed',
      count: candidateIds.length
    };
  }

  const additions = candidateIds.filter((id) => !prevSet.has(id));
  if (additions.length === 0) {
    return { nextIds: safePrev, action: 'noop', count: 0 };
  }

  return {
    nextIds: [...safePrev, ...additions],
    action: 'added',
    count: additions.length
  };
};

export const clearFavoriteIds = (prevIds) => {
  const safePrev = normalizeIds(prevIds);
  if (safePrev.length === 0) {
    return { nextIds: safePrev, changed: false };
  }
  return { nextIds: [], changed: true };
};

const normalizeAlbumId = (value) => {
  const normalized = String(value || '').trim();
  return normalized || 'library';
};

const normalizeSongId = (value) => {
  const normalized = String(value || '').trim();
  return normalized || '';
};

const normalizeTrackSrc = (value) => {
  const normalized = String(value || '').trim();
  return normalized || '';
};

const decodeUriSafely = (value) => {
  if (!value) return '';
  try {
    return decodeURI(value);
  } catch {
    return value;
  }
};

const dedupeStrings = (values) => {
  const seen = new Set();
  return values.filter((value) => {
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
};

const encodePathPreservingEscapes = (value) => (
  encodeURIComponent(String(value || '')).replace(/%25([0-9A-F]{2})/gi, '%$1')
);

const encodePathWithReadableUnicode = (value) => (
  Array.from(String(value || '')).map((char) => (
    /[^\x00-\x7F]/.test(char) ? char : encodeURIComponent(char)
  )).join('')
);

export const buildSongCommentPaths = ({ albumId, songId, trackSrc }) => {
  const normalizedAlbumId = normalizeAlbumId(albumId);
  const normalizedSongId = normalizeSongId(songId);
  const normalizedTrackSrc = normalizeTrackSrc(trackSrc);

  const primaryPath = normalizedSongId
    ? `song:${normalizedAlbumId}:${normalizedSongId}`
    : (normalizedTrackSrc
      ? `song:${normalizedAlbumId}:${encodeURIComponent(normalizedTrackSrc)}`
      : '');

  const decodedTrackSrc = decodeUriSafely(normalizedTrackSrc);
  const legacyPaths = dedupeStrings([
    normalizedTrackSrc
      ? `song:${normalizedAlbumId}:${encodePathPreservingEscapes(normalizedTrackSrc)}`
      : '',
    decodedTrackSrc
      ? `song:${normalizedAlbumId}:${encodePathWithReadableUnicode(decodedTrackSrc)}`
      : ''
  ]).filter((value) => value !== primaryPath);

  return {
    primaryPath,
    legacyPaths
  };
};

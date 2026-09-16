// 短链用 a / s 承载专辑与歌曲序号，旧参数继续兼容（老分享出去的链接不能失效）
const readFirstParam = (params, keys) => {
  for (const key of keys) {
    const value = String(params.get(key) || '').trim();
    if (value) return value;
  }
  return '';
};

export const resolveMusicShareTarget = (musicAlbums, search) => {
  const albums = Array.isArray(musicAlbums) ? musicAlbums : [];
  const params = search instanceof URLSearchParams
    ? search
    : new URLSearchParams(String(search || ''));

  const albumId = readFirstParam(params, ['albumId', 'a']);
  if (!albumId) return null;

  const targetAlbum = albums.find((album) => String(album?.id) === albumId);
  if (!targetAlbum?.songs?.length) return null;

  const songId = readFirstParam(params, ['songId', 'i']);
  if (songId) {
    const matchedSong = targetAlbum.songs.find((song) => String(song?.id) === songId);
    if (matchedSong) {
      return { album: targetAlbum, track: matchedSong };
    }
  }

  let songIndexValue = Number.parseInt(readFirstParam(params, ['song', 's']) || '1', 10);
  if (
    !Number.isInteger(songIndexValue) ||
    songIndexValue < 1 ||
    songIndexValue > targetAlbum.songs.length
  ) {
    songIndexValue = 1;
  }

  return {
    album: targetAlbum,
    track: targetAlbum.songs[songIndexValue - 1]
  };
};


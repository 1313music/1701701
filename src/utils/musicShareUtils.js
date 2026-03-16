export const resolveMusicShareTarget = (musicAlbums, search) => {
  const albums = Array.isArray(musicAlbums) ? musicAlbums : [];
  const params = search instanceof URLSearchParams
    ? search
    : new URLSearchParams(String(search || ''));

  const albumId = String(params.get('albumId') || '').trim();
  if (!albumId) return null;

  const targetAlbum = albums.find((album) => String(album?.id) === albumId);
  if (!targetAlbum?.songs?.length) return null;

  const songId = String(params.get('songId') || '').trim();
  if (songId) {
    const matchedSong = targetAlbum.songs.find((song) => String(song?.id) === songId);
    if (matchedSong) {
      return { album: targetAlbum, track: matchedSong };
    }
  }

  let songIndexValue = Number.parseInt(params.get('song') || '1', 10);
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


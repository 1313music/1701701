import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { loadMusicManifestAlbums } from '../data/musicManifest.js';
import {
  addFavoriteId,
  clearFavoriteIds,
  toggleAlbumFavoritesBySongs,
  toggleFavoriteId
} from '../utils/favoritesUtils.js';
import { sanitizeTempPlaylist } from '../utils/playlistUtils.js';

const TEMP_PLAYLIST_KEY = 'tempPlaylistIds';

const buildSongSrcSet = (albums) => {
  const set = new Set();
  for (const album of albums) {
    for (const song of album.songs) {
      if (song?.src) set.add(song.src);
    }
  }
  return set;
};

const buildSongIndex = (albums) => {
  const map = new Map();
  for (const album of albums) {
    for (const song of album.songs) {
      if (song?.src && !map.has(song.src)) {
        map.set(song.src, { album, song });
      }
    }
  }
  return map;
};

export const useLibraryState = ({ showToast }) => {
  const [musicAlbums, setMusicAlbums] = useState([]);
  const [isMusicLoading, setIsMusicLoading] = useState(true);
  const [musicLoadError, setMusicLoadError] = useState('');
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [tempPlaylistIds, setTempPlaylistIds] = useState(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(TEMP_PLAYLIST_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return sanitizeTempPlaylist(parsed);
    } catch {
      return [];
    }
  });

  const tempPlaylistIdsRef = useRef(tempPlaylistIds);
  const songIndex = useMemo(() => buildSongIndex(musicAlbums), [musicAlbums]);
  const allSongSrcs = useMemo(() => buildSongSrcSet(musicAlbums), [musicAlbums]);
  const tempPlaylistSet = useMemo(() => new Set(tempPlaylistIds), [tempPlaylistIds]);
  const tempPlaylistItems = useMemo(
    () => tempPlaylistIds.map((id) => songIndex.get(id)).filter(Boolean),
    [songIndex, tempPlaylistIds]
  );

  useEffect(() => {
    let canceled = false;
    const loadMusicAlbums = async () => {
      try {
        const albums = await loadMusicManifestAlbums();
        if (canceled) return;
        setMusicAlbums(Array.isArray(albums) ? albums : []);
      } catch {
        if (canceled) return;
        setMusicLoadError('曲库加载失败，请刷新重试');
      } finally {
        if (!canceled) {
          setIsMusicLoading(false);
        }
      }
    };

    void loadMusicAlbums();
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    tempPlaylistIdsRef.current = tempPlaylistIds;
  }, [tempPlaylistIds]);

  useEffect(() => {
    if (allSongSrcs.size === 0) return;
    setTempPlaylistIds((prev) => {
      const next = sanitizeTempPlaylist(prev, allSongSrcs);
      tempPlaylistIdsRef.current = next;
      if (
        next.length === prev.length &&
        next.every((id, index) => id === prev[index])
      ) {
        return prev;
      }
      return next;
    });
  }, [allSongSrcs]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(TEMP_PLAYLIST_KEY, JSON.stringify(tempPlaylistIds));
    } catch {
      // ignore storage errors
    }
  }, [tempPlaylistIds]);

  const applyTempPlaylistMutation = useCallback((mutator) => {
    if (typeof mutator !== 'function') return null;
    const result = mutator(tempPlaylistIdsRef.current);
    if (!result || !Array.isArray(result.nextIds)) return null;
    tempPlaylistIdsRef.current = result.nextIds;
    setTempPlaylistIds(result.nextIds);
    return result;
  }, []);

  const toggleTempSong = useCallback((song, event) => {
    const id = song?.src;
    if (!id) return;
    const result = applyTempPlaylistMutation((prev) => toggleFavoriteId(prev, id));
    if (!result || result.action === 'noop') return;
    showToast(
      result.action === 'removed' ? '已取消收藏' : '已收藏',
      result.action === 'removed' ? 'tone-remove' : 'tone-add',
      event
    );
  }, [applyTempPlaylistMutation, showToast]);

  const addTempSong = useCallback((song, anchorOrOptions = { placement: 'bottom' }) => {
    const id = song?.src;
    if (!id) return;
    const result = applyTempPlaylistMutation((prev) => addFavoriteId(prev, id));
    if (!result || result.action !== 'added') {
      showToast('已在收藏', 'tone-add', anchorOrOptions);
      return;
    }
    showToast('已收藏', 'tone-add', anchorOrOptions);
  }, [applyTempPlaylistMutation, showToast]);

  const toggleAlbumFavorites = useCallback((songs, anchorOrOptions = { placement: 'bottom' }) => {
    const result = applyTempPlaylistMutation((prev) => toggleAlbumFavoritesBySongs(prev, songs));
    if (!result || result.action === 'noop') return;
    if (result.action === 'removed') {
      showToast(
        result.count === 1 ? '已取消收藏 1 首' : `已取消收藏 ${result.count} 首`,
        'tone-remove',
        anchorOrOptions
      );
      return;
    }

    showToast(
      result.count === 1 ? '已收藏 1 首' : `已收藏 ${result.count} 首`,
      'tone-add',
      anchorOrOptions
    );
  }, [applyTempPlaylistMutation, showToast]);

  const clearTempPlaylist = useCallback((anchorOrOptions = { placement: 'bottom' }) => {
    applyTempPlaylistMutation((prev) => clearFavoriteIds(prev));
    showToast('已清空收藏', 'tone-remove', anchorOrOptions);
  }, [applyTempPlaylistMutation, showToast]);

  const searchTerm = searchQuery.trim().toLowerCase();
  const filteredAlbums = useMemo(() => {
    if (!searchTerm) return musicAlbums;
    return musicAlbums.filter((album) => (
      album.name.toLowerCase().includes(searchTerm) ||
      album.artist.toLowerCase().includes(searchTerm) ||
      album.songs.some((song) => song.name.toLowerCase().includes(searchTerm))
    ));
  }, [musicAlbums, searchTerm]);

  const songSuggestions = useMemo(() => {
    if (!searchTerm) return [];
    const results = [];
    for (const album of musicAlbums) {
      const albumMatch = album.name.toLowerCase().includes(searchTerm) ||
        album.artist.toLowerCase().includes(searchTerm);
      for (const song of album.songs) {
        if (albumMatch || song.name.toLowerCase().includes(searchTerm)) {
          results.push({ album, song });
          if (results.length >= 8) return results;
        }
      }
    }
    return results;
  }, [musicAlbums, searchTerm]);

  return {
    musicAlbums,
    isMusicLoading,
    musicLoadError,
    selectedAlbum,
    setSelectedAlbum,
    searchQuery,
    setSearchQuery,
    songIndex,
    tempPlaylistIds,
    tempPlaylistItems,
    tempPlaylistSet,
    toggleTempSong,
    addTempSong,
    toggleAlbumFavorites,
    clearTempPlaylist,
    filteredAlbums,
    songSuggestions
  };
};

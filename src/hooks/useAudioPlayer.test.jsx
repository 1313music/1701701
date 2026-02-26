import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAudioPlayer } from './useAudioPlayer';

class AudioMock {
  constructor() {
    this._src = '';
    this.currentTime = 0;
    this.duration = 0;
    this.playbackRate = 1;
    this.preload = '';
    this.playsInline = false;
    this.listeners = new Map();
  }

  set src(value) {
    if (!value) {
      this._src = '';
      this.currentTime = 0;
      return;
    }
    const base = globalThis.window?.location?.href || 'http://localhost/';
    this._src = new URL(value, base).href;
    this.currentTime = 0;
  }

  get src() {
    return this._src;
  }

  addEventListener(type, listener) {
    const set = this.listeners.get(type) || new Set();
    set.add(listener);
    this.listeners.set(type, set);
  }

  removeEventListener(type, listener) {
    const set = this.listeners.get(type);
    if (!set) return;
    set.delete(listener);
  }

  play() {
    return Promise.resolve();
  }

  pause() {}
}

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('useAudioPlayer lyric race', () => {
  let originalAudio;
  let originalFetch;

  beforeEach(() => {
    originalAudio = globalThis.Audio;
    originalFetch = globalThis.fetch;
    globalThis.Audio = AudioMock;
  });

  afterEach(() => {
    globalThis.Audio = originalAudio;
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('keeps newer lyrics when an older request resolves later', async () => {
    const album = {
      id: 'album-1',
      name: 'Album',
      artist: 'Artist',
      cover: '',
      songs: [
        { name: 'Song 1', src: 'song-1.mp3', lrc: 'https://example.com/1.lrc' },
        { name: 'Song 2', src: 'song-2.mp3', lrc: 'https://example.com/2.lrc' }
      ]
    };
    const songIndex = new Map([
      ['song-1.mp3', { album, song: album.songs[0] }],
      ['song-2.mp3', { album, song: album.songs[1] }]
    ]);

    const first = createDeferred();
    const second = createDeferred();
    globalThis.fetch = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);

    const { result } = renderHook(() => useAudioPlayer({
      musicAlbums: [album],
      songIndex
    }));

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.playSongFromAlbum(album, album.songs[1]);
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);

    second.resolve({
      text: () => Promise.resolve('[00:00.00]new lyric')
    });

    await waitFor(() => {
      expect(result.current.lyrics[0]?.text).toBe('new lyric');
    });

    first.resolve({
      text: () => Promise.resolve('[00:00.00]old lyric')
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(result.current.lyrics[0]?.text).toBe('new lyric');
  });

  it('keeps playback position when pausing and resuming the same track', async () => {
    const album = {
      id: 'album-2',
      name: 'Album 2',
      artist: 'Artist',
      cover: '',
      songs: [
        { name: 'Song 1', src: 'https://example.com/音乐.mp3' }
      ]
    };
    const songIndex = new Map([
      [album.songs[0].src, { album, song: album.songs[0] }]
    ]);

    const { result } = renderHook(() => useAudioPlayer({
      musicAlbums: [album],
      songIndex
    }));

    act(() => {
      result.current.handlePlayPause();
    });
    await waitFor(() => {
      expect(result.current.isPlaying).toBe(true);
    });

    act(() => {
      result.current.audioRef.current.currentTime = 42;
      result.current.handlePlayPause();
    });
    await waitFor(() => {
      expect(result.current.isPlaying).toBe(false);
    });

    act(() => {
      result.current.handlePlayPause();
    });
    await waitFor(() => {
      expect(result.current.isPlaying).toBe(true);
    });

    expect(result.current.audioRef.current.currentTime).toBe(42);
  });
});

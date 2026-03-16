import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Repeat, Repeat1, Shuffle } from 'lucide-react';
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

  emit(type) {
    const set = this.listeners.get(type);
    if (!set) return;
    set.forEach((listener) => listener({}));
  }
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
  let originalMediaSessionDescriptor;
  let originalMediaMetadataDescriptor;
  let originalUserAgentDescriptor;
  let originalPlatformDescriptor;
  let originalMaxTouchPointsDescriptor;

  const setNavigatorField = (field, value) => {
    Object.defineProperty(globalThis.navigator, field, {
      configurable: true,
      value
    });
  };

  beforeEach(() => {
    originalAudio = globalThis.Audio;
    originalFetch = globalThis.fetch;
    originalMediaSessionDescriptor = Object.getOwnPropertyDescriptor(globalThis.navigator, 'mediaSession');
    originalMediaMetadataDescriptor = Object.getOwnPropertyDescriptor(globalThis.window, 'MediaMetadata');
    originalUserAgentDescriptor = Object.getOwnPropertyDescriptor(globalThis.navigator, 'userAgent');
    originalPlatformDescriptor = Object.getOwnPropertyDescriptor(globalThis.navigator, 'platform');
    originalMaxTouchPointsDescriptor = Object.getOwnPropertyDescriptor(globalThis.navigator, 'maxTouchPoints');
    globalThis.Audio = AudioMock;
  });

  afterEach(() => {
    globalThis.Audio = originalAudio;
    globalThis.fetch = originalFetch;

    if (originalMediaSessionDescriptor) {
      Object.defineProperty(globalThis.navigator, 'mediaSession', originalMediaSessionDescriptor);
    } else {
      delete globalThis.navigator.mediaSession;
    }

    if (originalMediaMetadataDescriptor) {
      Object.defineProperty(globalThis.window, 'MediaMetadata', originalMediaMetadataDescriptor);
    } else {
      delete globalThis.window.MediaMetadata;
    }

    if (originalUserAgentDescriptor) {
      Object.defineProperty(globalThis.navigator, 'userAgent', originalUserAgentDescriptor);
    }
    if (originalPlatformDescriptor) {
      Object.defineProperty(globalThis.navigator, 'platform', originalPlatformDescriptor);
    }
    if (originalMaxTouchPointsDescriptor) {
      Object.defineProperty(globalThis.navigator, 'maxTouchPoints', originalMaxTouchPointsDescriptor);
    }

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

  it('resolves relative lyric urls against the current page', async () => {
    const album = {
      id: 'album-relative',
      name: 'Album Relative',
      artist: 'Artist',
      cover: '',
      songs: [
        { name: 'Song 1', src: 'song-1.mp3', lrc: './lyrics/song-1.lrc' }
      ]
    };
    const songIndex = new Map([
      ['song-1.mp3', { album, song: album.songs[0] }]
    ]);

    globalThis.fetch = vi.fn().mockResolvedValue({
      text: () => Promise.resolve('[00:00.00]relative lyric')
    });

    const { result } = renderHook(() => useAudioPlayer({
      musicAlbums: [album],
      songIndex
    }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        new URL('./lyrics/song-1.lrc', window.location.href).href
      );
    });

    await waitFor(() => {
      expect(result.current.lyrics[0]?.text).toBe('relative lyric');
    });
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

  it('publishes media metadata and playback position updates', async () => {
    const mediaSession = {
      setActionHandler: vi.fn(),
      setPositionState: vi.fn(),
      playbackState: 'none'
    };
    const MediaMetadataMock = vi.fn().mockImplementation(function MediaMetadata(data) {
      this.data = data;
    });
    Object.defineProperty(globalThis.navigator, 'mediaSession', {
      configurable: true,
      value: mediaSession
    });
    Object.defineProperty(globalThis.window, 'MediaMetadata', {
      configurable: true,
      value: MediaMetadataMock
    });

    const album = {
      id: 'album-metadata',
      name: 'Album Metadata',
      artist: 'Artist',
      cover: 'https://example.com/album.jpg',
      songs: [
        { name: 'Song 1', src: 'song-1.mp3', cover: 'https://example.com/song.jpg' }
      ]
    };
    const songIndex = new Map([
      [album.songs[0].src, { album, song: album.songs[0] }]
    ]);

    const { result } = renderHook(() => useAudioPlayer({
      musicAlbums: [album],
      songIndex
    }));

    await waitFor(() => {
      expect(MediaMetadataMock).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Song 1',
        artist: 'Artist',
        album: 'Album Metadata'
      }));
    });

    act(() => {
      result.current.handlePlayPause();
      result.current.audioRef.current.duration = 180;
      result.current.audioRef.current.currentTime = 45;
      result.current.audioRef.current.emit('loadedmetadata');
      result.current.audioRef.current.emit('timeupdate');
    });

    await waitFor(() => {
      expect(mediaSession.setPositionState).toHaveBeenCalledWith({
        duration: 180,
        playbackRate: 1,
        position: 45
      });
    });

    expect(mediaSession.playbackState).toBe('playing');
  });

  it('prefers previous/next controls over seek controls on iOS lock screen', async () => {
    const mediaSession = {
      setActionHandler: vi.fn(),
      setPositionState: vi.fn(),
      playbackState: 'none'
    };
    Object.defineProperty(globalThis.navigator, 'mediaSession', {
      configurable: true,
      value: mediaSession
    });
    setNavigatorField('userAgent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    setNavigatorField('platform', 'iPhone');
    setNavigatorField('maxTouchPoints', 5);

    const album = {
      id: 'album-ios',
      name: 'Album iOS',
      artist: 'Artist',
      cover: '',
      songs: [
        { name: 'Song 1', src: 'song-1.mp3' },
        { name: 'Song 2', src: 'song-2.mp3' }
      ]
    };
    const songIndex = new Map([
      [album.songs[0].src, { album, song: album.songs[0] }],
      [album.songs[1].src, { album, song: album.songs[1] }]
    ]);

    renderHook(() => useAudioPlayer({
      musicAlbums: [album],
      songIndex
    }));

    await waitFor(() => {
      expect(mediaSession.setActionHandler).toHaveBeenCalled();
    });

    expect(mediaSession.setActionHandler.mock.calls).toContainEqual(['seekbackward', null]);
    expect(mediaSession.setActionHandler.mock.calls).toContainEqual(['seekforward', null]);
    expect(
      mediaSession.setActionHandler.mock.calls.some(
        ([action, handler]) => action === 'previoustrack' && typeof handler === 'function'
      )
    ).toBe(true);
    expect(
      mediaSession.setActionHandler.mock.calls.some(
        ([action, handler]) => action === 'nexttrack' && typeof handler === 'function'
      )
    ).toBe(true);
  });

  it('keeps seek controls on non-iOS devices', async () => {
    const mediaSession = {
      setActionHandler: vi.fn(),
      setPositionState: vi.fn(),
      playbackState: 'none'
    };
    Object.defineProperty(globalThis.navigator, 'mediaSession', {
      configurable: true,
      value: mediaSession
    });
    setNavigatorField('userAgent', 'Mozilla/5.0 (Linux; Android 14; Pixel 8)');
    setNavigatorField('platform', 'Linux armv8l');
    setNavigatorField('maxTouchPoints', 5);

    const album = {
      id: 'album-android',
      name: 'Album Android',
      artist: 'Artist',
      cover: '',
      songs: [
        { name: 'Song 1', src: 'song-1.mp3' },
        { name: 'Song 2', src: 'song-2.mp3' }
      ]
    };
    const songIndex = new Map([
      [album.songs[0].src, { album, song: album.songs[0] }],
      [album.songs[1].src, { album, song: album.songs[1] }]
    ]);

    renderHook(() => useAudioPlayer({
      musicAlbums: [album],
      songIndex
    }));

    await waitFor(() => {
      expect(mediaSession.setActionHandler).toHaveBeenCalled();
    });

    expect(
      mediaSession.setActionHandler.mock.calls.some(
        ([action, handler]) => action === 'seekbackward' && typeof handler === 'function'
      )
    ).toBe(true);
    expect(
      mediaSession.setActionHandler.mock.calls.some(
        ([action, handler]) => action === 'seekforward' && typeof handler === 'function'
      )
    ).toBe(true);
  });

  it('does not re-register media actions when switching tracks within same album', async () => {
    const mediaSession = {
      setActionHandler: vi.fn(),
      setPositionState: vi.fn(),
      playbackState: 'none'
    };
    Object.defineProperty(globalThis.navigator, 'mediaSession', {
      configurable: true,
      value: mediaSession
    });
    setNavigatorField('userAgent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    setNavigatorField('platform', 'iPhone');
    setNavigatorField('maxTouchPoints', 5);

    const album = {
      id: 'album-stable',
      name: 'Album Stable',
      artist: 'Artist',
      cover: '',
      songs: [
        { name: 'Song 1', src: 'song-1.mp3' },
        { name: 'Song 2', src: 'song-2.mp3' }
      ]
    };
    const songIndex = new Map([
      [album.songs[0].src, { album, song: album.songs[0] }],
      [album.songs[1].src, { album, song: album.songs[1] }]
    ]);

    const { result } = renderHook(() => useAudioPlayer({
      musicAlbums: [album],
      songIndex
    }));

    await waitFor(() => {
      expect(mediaSession.setActionHandler).toHaveBeenCalled();
    });
    const initialCalls = mediaSession.setActionHandler.mock.calls.length;

    act(() => {
      result.current.handleNext();
    });

    await waitFor(() => {
      expect(result.current.currentTrack?.src).toBe(album.songs[1].src);
    });

    expect(mediaSession.setActionHandler.mock.calls.length).toBe(initialCalls);
  });

  it('cycles play modes and replays the current track in single mode', async () => {
    const album = {
      id: 'album-mode',
      name: 'Album Mode',
      artist: 'Artist',
      cover: '',
      songs: [
        { id: 'song-1', name: 'Song 1', src: 'song-1.mp3' },
        { id: 'song-2', name: 'Song 2', src: 'song-2.mp3' }
      ]
    };
    const songIndex = new Map([
      [album.songs[0].src, { album, song: album.songs[0] }],
      [album.songs[1].src, { album, song: album.songs[1] }]
    ]);

    const { result } = renderHook(() => useAudioPlayer({
      musicAlbums: [album],
      songIndex
    }));

    await waitFor(() => {
      expect(result.current.currentTrack?.src).toBe(album.songs[0].src);
    });

    expect(result.current.getPlayModeIcon().type).toBe(Repeat);

    act(() => {
      result.current.togglePlayMode();
    });

    await waitFor(() => {
      expect(result.current.playMode).toBe('single');
    });
    expect(result.current.getPlayModeIcon().type).toBe(Repeat1);

    const playSpy = vi.spyOn(result.current.audioRef.current, 'play');
    act(() => {
      result.current.audioRef.current.currentTime = 88;
      result.current.audioRef.current.emit('ended');
    });

    expect(result.current.audioRef.current.currentTime).toBe(0);
    expect(playSpy).toHaveBeenCalledTimes(1);
    expect(result.current.currentTrack?.src).toBe(album.songs[0].src);

    act(() => {
      result.current.togglePlayMode();
    });

    await waitFor(() => {
      expect(result.current.playMode).toBe('shuffle');
    });
    expect(result.current.getPlayModeIcon().type).toBe(Shuffle);
  });

  it('supports shuffle navigation, seek, same-track toggle, and pausePlayback', async () => {
    const album = {
      id: 'album-controls',
      name: 'Album Controls',
      artist: 'Artist',
      cover: '',
      songs: [
        { id: 'song-1', name: 'Song 1', src: 'song-1.mp3' },
        { id: 'song-2', name: 'Song 2', src: 'song-2.mp3' },
        { id: 'song-3', name: 'Song 3', src: 'song-3.mp3' }
      ]
    };
    const songIndex = new Map(
      album.songs.map((song) => [song.src, { album, song }])
    );

    const { result } = renderHook(() => useAudioPlayer({
      musicAlbums: [album],
      songIndex
    }));

    await waitFor(() => {
      expect(result.current.currentTrack?.src).toBe(album.songs[0].src);
    });

    act(() => {
      result.current.togglePlayMode();
    });

    await waitFor(() => {
      expect(result.current.playMode).toBe('single');
    });

    act(() => {
      result.current.togglePlayMode();
    });

    await waitFor(() => {
      expect(result.current.playMode).toBe('shuffle');
    });

    const randomSpy = vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.6)
      .mockReturnValueOnce(0.05);

    act(() => {
      result.current.handleNext();
    });

    await waitFor(() => {
      expect(result.current.currentTrack?.src).toBe(album.songs[1].src);
    });

    act(() => {
      result.current.handlePrev();
    });

    await waitFor(() => {
      expect(result.current.currentTrack?.src).toBe(album.songs[0].src);
    });

    act(() => {
      result.current.audioRef.current.duration = 180;
      result.current.audioRef.current.emit('loadedmetadata');
    });

    act(() => {
      result.current.handleSeek({
        clientX: 60,
        currentTarget: {
          getBoundingClientRect: () => ({ left: 10, width: 200 })
        }
      });
    });

    expect(result.current.audioRef.current.currentTime).toBeCloseTo(45);

    act(() => {
      result.current.playSongFromAlbum(album, album.songs[0]);
    });

    await waitFor(() => {
      expect(result.current.isPlaying).toBe(false);
    });

    const pauseSpy = vi.spyOn(result.current.audioRef.current, 'pause');
    act(() => {
      result.current.pausePlayback();
    });

    expect(pauseSpy).toHaveBeenCalledTimes(1);
    expect(result.current.isPlaying).toBe(false);

    randomSpy.mockRestore();
  });
});

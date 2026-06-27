import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import App from './App.jsx';

const mockFavoriteAlbum = {
  id: 'favorites',
  name: '我的收藏',
  artist: '我的收藏',
  isVirtual: true,
  virtualType: 'favorites',
  songs: [
    {
      id: 'fav-1',
      name: '收藏歌曲一',
      src: 'fav-1.mp3',
      sourceAlbumId: 'source-album',
      sourceAlbumName: '原专辑'
    }
  ]
};

const mockSourceAlbum = {
  id: 'source-album',
  name: '原专辑',
  artist: '李志',
  songs: [
    {
      id: 'fav-1',
      name: '收藏歌曲一',
      src: 'fav-1.mp3'
    },
    {
      id: 'source-2',
      name: '原专辑歌曲二',
      src: 'source-2.mp3'
    }
  ]
};

const mockCurrentTrack = mockFavoriteAlbum.songs[0];
const mockSetAlbumListOpen = vi.fn();
const mockAlbumListOverlay = vi.fn(() => null);

vi.mock('./components/Sidebar', () => ({
  default: () => <aside data-testid="sidebar" />
}));

vi.mock('./components/SearchHeader', () => ({
  default: () => <div data-testid="search-header" />
}));

vi.mock('./components/AlbumGrid', () => ({
  default: () => <div data-testid="album-grid" />
}));

vi.mock('./components/PlayerBar', () => ({
  default: ({ setIsAlbumListOpen }) => (
    <button type="button" onClick={() => setIsAlbumListOpen(true)}>
      打开播放列表
    </button>
  )
}));

vi.mock('./components/AnnouncementTrigger.jsx', () => ({
  default: () => null
}));

vi.mock('./components/AnnouncementModal.jsx', () => ({
  default: () => null
}));

vi.mock('./components/VideoAccessModal.jsx', () => ({
  default: () => null
}));

vi.mock('./components/AlbumListOverlay.jsx', () => ({
  default: (props) => {
    mockAlbumListOverlay(props);
    return props.isOpen ? (
      <div data-testid="album-list-overlay">{props.album?.name}</div>
    ) : null;
  }
}));

vi.mock('./hooks/useAudioPlayer.jsx', () => ({
  useAudioPlayer: () => ({
    currentTrack: mockCurrentTrack,
    setCurrentTrack: vi.fn(),
    currentAlbum: mockFavoriteAlbum,
    setCurrentAlbum: vi.fn(),
    isPlaying: true,
    setIsPlaying: vi.fn(),
    volume: 1,
    isMuted: false,
    progress: 0,
    currentTime: 0,
    duration: 180,
    lyrics: [],
    currentLyricIndex: -1,
    currentLyricText: '',
    isTrackNameOverflowing: false,
    trackNameRef: { current: null },
    audioRef: { current: { pause: vi.fn() } },
    currentSongInfo: {
      album: mockSourceAlbum,
      song: mockSourceAlbum.songs[0]
    },
    trackChangeId: 1,
    sleepTimerRemainingMs: 0,
    handleVolumeChange: vi.fn(),
    toggleMuted: vi.fn(),
    handlePlayPause: vi.fn(),
    handleSeek: vi.fn(),
    handlePrev: vi.fn(),
    handleNext: vi.fn(),
    playSongFromAlbum: vi.fn(),
    pausePlayback: vi.fn(),
    startSleepTimer: vi.fn(),
    cancelSleepTimer: vi.fn(),
    togglePlayMode: vi.fn(),
    getPlayModeIcon: vi.fn(() => null)
  })
}));

vi.mock('./hooks/useLibraryState.js', () => ({
  useLibraryState: () => ({
    musicAlbums: [mockSourceAlbum],
    isMusicLoading: false,
    musicLoadError: '',
    selectedAlbum: null,
    setSelectedAlbum: vi.fn(),
    searchQuery: '',
    setSearchQuery: vi.fn(),
    songIndex: new Map([[mockCurrentTrack.src, {
      album: mockSourceAlbum,
      song: mockSourceAlbum.songs[0]
    }]]),
    tempPlaylistIds: [mockCurrentTrack.src],
    tempPlaylistItems: [{
      album: mockSourceAlbum,
      song: mockSourceAlbum.songs[0]
    }],
    tempPlaylistSet: new Set([mockCurrentTrack.src]),
    toggleTempSong: vi.fn(),
    addTempSong: vi.fn(),
    toggleAlbumFavorites: vi.fn(),
    clearTempPlaylist: vi.fn(),
    filteredAlbums: [mockSourceAlbum],
    songSuggestions: []
  })
}));

vi.mock('./hooks/useAppShell.js', async () => {
  const ReactModule = await vi.importActual('react');

  return {
    useAppShell: () => {
      const [isAlbumListOpen, setIsAlbumListOpen] = ReactModule.useState(false);
      const [hasAlbumListOverlayLoaded, setHasAlbumListOverlayLoaded] = ReactModule.useState(false);

      return {
        view: 'library',
        locationSearch: '',
        handleViewChange: vi.fn(),
        replaceLocationSearch: vi.fn(),
        isLyricsOpen: false,
        lyricsOverlaySessionId: 0,
        playerOverlayContextId: 1,
        isAlbumListOpen,
        isSidebarOpen: false,
        setIsSidebarOpen: vi.fn(),
        isSidebarCollapsed: true,
        setIsSidebarCollapsed: vi.fn(),
        hasLyricsOverlayLoaded: false,
        hasAlbumListOverlayLoaded,
        setLyricsOverlayOpen: vi.fn(),
        setAlbumListOverlayOpen: (open) => {
          mockSetAlbumListOpen(open);
          if (open) {
            setHasAlbumListOverlayLoaded(true);
          }
          setIsAlbumListOpen(open);
        },
        lyricsCommentRequest: {
          id: 0,
          trackSrc: '',
          overlaySessionId: 0,
          trackChangeId: 0,
          viewContextId: 0,
          mode: 'overlay'
        },
        openCurrentTrackComments: vi.fn(),
        isWeChatBrowserHintOpen: false,
        closeWeChatBrowserHint: vi.fn(),
        showBackToTop: false,
        handleBackToTop: vi.fn()
      };
    }
  };
});

vi.mock('./hooks/useAnnouncement.js', () => ({
  useAnnouncement: () => ({
    announcement: null,
    announcementHistory: [],
    hasActiveAnnouncement: false,
    isAnnouncementOpen: false,
    isAnnouncementUnread: false,
    dismissAnnouncement: vi.fn(),
    openAnnouncement: vi.fn()
  })
}));

vi.mock('./hooks/useTheme.js', () => ({
  useTheme: () => ({
    themePreference: 'system',
    resolvedTheme: 'light',
    showViewportDebug: false,
    viewportDebug: null,
    handleThemeToggle: vi.fn()
  })
}));

vi.mock('./hooks/useToast.js', () => ({
  useToast: () => ({
    toastMessage: '',
    isToastVisible: false,
    toastTone: '',
    toastPlacement: '',
    showToast: vi.fn()
  })
}));

vi.mock('./hooks/useVideoAccess.js', () => ({
  useVideoAccess: () => ({
    isVideoAccessOpen: false,
    videoPassword: '',
    setVideoPassword: vi.fn(),
    videoPasswordError: '',
    setVideoPasswordError: vi.fn(),
    videoAccessConfig: {
      promptLines: [],
      qrUrl: '',
      qrAlt: '',
      passwordNote: ''
    },
    closeVideoAccessModal: vi.fn(),
    requestVideoView: vi.fn(),
    submitVideoAccess: vi.fn()
  })
}));

vi.mock('./hooks/useSharePanel.js', () => ({
  useSharePanel: () => ({
    sharePanelData: null,
    shareCardDataUrl: '',
    isShareCardGenerating: false,
    closeSharePanel: vi.fn(),
    handleCopyShareLink: vi.fn(),
    handleCopySpecificPageUrl: vi.fn(),
    handleShareCardImage: vi.fn(),
    handleShareCurrentTrack: vi.fn(),
    handleShareVideo: vi.fn()
  })
}));

vi.mock('./hooks/useAudioPlaybackShortcuts.js', () => ({
  useAudioPlaybackShortcuts: vi.fn()
}));

vi.mock('./hooks/useSeoMeta.js', () => ({
  useSeoMeta: vi.fn()
}));

describe('App playback list', () => {
  afterEach(() => {
    mockSetAlbumListOpen.mockClear();
    mockAlbumListOverlay.mockClear();
  });

  it('opens the current favorites queue instead of the source album from the player list button', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '打开播放列表' }));

    await waitFor(() => {
      expect(screen.getByTestId('album-list-overlay')).toHaveTextContent('我的收藏');
    });

    const latestProps = mockAlbumListOverlay.mock.calls.at(-1)[0];
    expect(mockSetAlbumListOpen).toHaveBeenCalledWith(true);
    expect(latestProps.album).toMatchObject({
      id: 'favorites',
      name: '我的收藏',
      songs: [expect.objectContaining({ src: 'fav-1.mp3' })]
    });
    expect(latestProps.album.id).not.toBe('source-album');
  });
});

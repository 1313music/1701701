import { useCallback, useEffect, useState } from 'react';

import { isWeChatBrowser } from '../utils/appDomUtils.js';
import {
  AVAILABLE_VIEWS,
  getCanonicalSearchForView,
  getPathForView,
  resolveViewFromLocation,
  shouldRedirectDisabledDownloadPath
} from '../utils/appShellConfig.js';

const createInitialLyricsCommentRequest = () => ({
  id: 0,
  trackSrc: '',
  overlaySessionId: 0,
  trackChangeId: 0,
  viewContextId: 0,
  mode: 'overlay'
});

export const useAppShell = ({ currentTrackSrc, pausePlayback, trackChangeId }) => {
  const [view, setView] = useState(() => (
    typeof window === 'undefined' ? 'library' : resolveViewFromLocation(window.location)
  ));
  const [locationSearch, setLocationSearch] = useState(() => (
    typeof window === 'undefined'
      ? ''
      : shouldRedirectDisabledDownloadPath(window.location)
        ? ''
        : getCanonicalSearchForView(resolveViewFromLocation(window.location), window.location.search)
  ));
  const [isLyricsOpen, setIsLyricsOpen] = useState(false);
  const [lyricsOverlaySessionId, setLyricsOverlaySessionId] = useState(0);
  const [playerOverlayContextId, setPlayerOverlayContextId] = useState(0);
  const [isAlbumListOpen, setIsAlbumListOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [hasLyricsOverlayLoaded, setHasLyricsOverlayLoaded] = useState(false);
  const [hasAlbumListOverlayLoaded, setHasAlbumListOverlayLoaded] = useState(false);
  const [isWeChatBrowserHintOpen, setIsWeChatBrowserHintOpen] = useState(() => (
    typeof window !== 'undefined' && isWeChatBrowser()
  ));
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [lyricsCommentRequest, setLyricsCommentRequest] = useState(createInitialLyricsCommentRequest);

  const setLyricsOverlayOpen = useCallback((open) => {
    if (open) {
      setHasLyricsOverlayLoaded(true);
      if (!isLyricsOpen) {
        setLyricsOverlaySessionId((prev) => prev + 1);
      }
      setIsLyricsOpen(true);
      return;
    }
    setIsLyricsOpen(false);
  }, [isLyricsOpen]);

  const setAlbumListOverlayOpen = useCallback((open) => {
    if (open) {
      setHasAlbumListOverlayLoaded(true);
      setIsAlbumListOpen(true);
      return;
    }
    setIsAlbumListOpen(false);
  }, []);

  const stopPlaybackForVideo = useCallback(() => {
    pausePlayback?.();
    setLyricsOverlayOpen(false);
    setAlbumListOverlayOpen(false);
  }, [pausePlayback, setAlbumListOverlayOpen, setLyricsOverlayOpen]);

  const syncUrlForView = useCallback((nextView, historyMode = 'push') => {
    if (typeof window === 'undefined' || historyMode === 'skip') return;
    const url = new URL(window.location.href);
    url.pathname = getPathForView(nextView);
    url.search = getCanonicalSearchForView(nextView, window.location.search);
    url.hash = '';

    const nextRelativeUrl = `${url.pathname}${url.search}${url.hash}`;
    const currentRelativeUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    if (nextRelativeUrl === currentRelativeUrl) {
      setLocationSearch(url.search);
      return;
    }

    if (historyMode === 'replace') {
      window.history.replaceState(null, '', nextRelativeUrl);
    } else {
      window.history.pushState(null, '', nextRelativeUrl);
    }

    setLocationSearch(url.search);
  }, []);

  const replaceLocationSearch = useCallback((nextSearch, options = {}) => {
    if (typeof window === 'undefined') return;
    const targetView = AVAILABLE_VIEWS.has(options.view) ? options.view : view;
    const historyMode = options.historyMode === 'push' ? 'push' : 'replace';
    const url = new URL(window.location.href);
    url.pathname = getPathForView(targetView);
    url.search = getCanonicalSearchForView(targetView, nextSearch || '');
    url.hash = '';

    const nextRelativeUrl = `${url.pathname}${url.search}${url.hash}`;
    const currentRelativeUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    if (nextRelativeUrl === currentRelativeUrl) {
      setLocationSearch(url.search);
      return;
    }

    if (historyMode === 'replace') {
      window.history.replaceState(null, '', nextRelativeUrl);
    } else {
      window.history.pushState(null, '', nextRelativeUrl);
    }

    setLocationSearch(url.search);
  }, [view]);

  const handleViewChange = useCallback((nextView, options = {}) => {
    const resolvedView = AVAILABLE_VIEWS.has(nextView) ? nextView : 'library';
    const historyMode = options.historyMode || 'push';
    const isViewChanging = view !== resolvedView;

    if (resolvedView === 'video') {
      stopPlaybackForVideo();
    }
    if (isViewChanging) {
      setPlayerOverlayContextId((prev) => prev + 1);
      setLyricsCommentRequest((prev) => ({
        ...prev,
        trackSrc: '',
        overlaySessionId: 0,
        trackChangeId: -1,
        viewContextId: -1,
        mode: 'overlay'
      }));
    }
    setView((prev) => (prev === resolvedView ? prev : resolvedView));
    syncUrlForView(resolvedView, historyMode);
  }, [stopPlaybackForVideo, syncUrlForView, view]);

  const openCurrentTrackComments = useCallback(() => {
    if (!currentTrackSrc) return;
    const shouldOpenStandaloneCommentDrawer = (
      !isLyricsOpen &&
      typeof window !== 'undefined' &&
      window.innerWidth > 1024
    );
    const requestMode = shouldOpenStandaloneCommentDrawer ? 'standalone' : 'overlay';

    const targetOverlaySessionId = requestMode === 'overlay'
      ? (isLyricsOpen ? lyricsOverlaySessionId : lyricsOverlaySessionId + 1)
      : lyricsOverlaySessionId;
    setHasLyricsOverlayLoaded(true);

    setLyricsCommentRequest((prev) => ({
      id: prev.id + 1,
      trackSrc: currentTrackSrc,
      overlaySessionId: targetOverlaySessionId,
      trackChangeId,
      viewContextId: playerOverlayContextId,
      mode: requestMode
    }));
    if (requestMode === 'overlay') {
      setLyricsOverlayOpen(true);
    }
  }, [
    currentTrackSrc,
    isLyricsOpen,
    lyricsOverlaySessionId,
    playerOverlayContextId,
    setLyricsOverlayOpen,
    trackChangeId
  ]);

  const closeWeChatBrowserHint = useCallback(() => {
    setIsWeChatBrowserHintOpen(false);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !shouldRedirectDisabledDownloadPath(window.location)) return;
    window.history.replaceState(null, '', getPathForView('library'));
  }, []);

  const handleBackToTop = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handlePopState = () => {
      handleViewChange(resolveViewFromLocation(window.location), { historyMode: 'replace' });
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [handleViewChange]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    let frameId = 0;
    const updateVisibility = () => {
      frameId = 0;
      const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
      const shouldShow = scrollTop > 280;
      setShowBackToTop((prev) => (prev === shouldShow ? prev : shouldShow));
    };

    const handleScroll = () => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(updateVisibility);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, []);

  return {
    view,
    locationSearch,
    handleViewChange,
    replaceLocationSearch,
    isLyricsOpen,
    lyricsOverlaySessionId,
    playerOverlayContextId,
    isAlbumListOpen,
    isSidebarOpen,
    setIsSidebarOpen,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    hasLyricsOverlayLoaded,
    hasAlbumListOverlayLoaded,
    setLyricsOverlayOpen,
    setAlbumListOverlayOpen,
    lyricsCommentRequest,
    openCurrentTrackComments,
    isWeChatBrowserHintOpen,
    closeWeChatBrowserHint,
    showBackToTop,
    handleBackToTop
  };
};

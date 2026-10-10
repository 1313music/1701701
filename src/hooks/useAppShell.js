import { useCallback, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';

import { runLaneWipe } from '../utils/laneWipe.js';
import { VIEW_CHUNK_LOADERS, loadViewComponent } from '../utils/viewChunks.js';
import {
  AVAILABLE_VIEWS,
  getCanonicalSearchForView,
  getPathForView,
  resolveViewFromLocation,
  shouldRedirectDisabledDownloadResourcePath
} from '../utils/appShellConfig.js';

/** 切页时最多等目标页面代码多久（毫秒）。超时就照常扫掠，不再干等。 */
const VIEW_CHUNK_WAIT_LIMIT = 250;

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
      : shouldRedirectDisabledDownloadResourcePath(window.location)
        ? ''
        : getCanonicalSearchForView(resolveViewFromLocation(window.location), window.location.search)
  ));
  const [isLyricsOpen, setIsLyricsOpen] = useState(false);
  const [lyricsOverlaySessionId, setLyricsOverlaySessionId] = useState(0);
  const [playerOverlayContextId, setPlayerOverlayContextId] = useState(0);
  const [isAlbumListOpen, setIsAlbumListOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [hasLyricsOverlayLoaded, setHasLyricsOverlayLoaded] = useState(false);
  const [hasAlbumListOverlayLoaded, setHasAlbumListOverlayLoaded] = useState(false);
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

    const commitView = () => {
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
    };

    if (!isViewChanging) {
      commitView();
      return;
    }

    // 扫掠起点用被点的那颗导航按钮；拿不到位置（比如浏览器前进/后退）就用默认点
    const rect = options.originRect;
    const hasOrigin = Boolean(rect) && (rect.width > 0 || rect.height > 0);
    const startWipe = () => runLaneWipe({
      originX: hasOrigin ? rect.left + rect.width / 2 : undefined,
      originY: hasOrigin ? rect.top + rect.height / 2 : undefined,
      // flushSync：让 React 同步把新页面渲染出来，快照才拍得到切换后的样子
      applyChange: () => flushSync(commitView)
    });

    if (!VIEW_CHUNK_LOADERS[resolvedView]) {
      startWipe();
      return;
    }

    // 先把目标页面的代码取回来再扫，否则扫掠揭开的是 Suspense 的「加载中」占位。
    // 但不能无限等：慢网下宁可照常扫（那时会看到占位，跟没做动画时一样）。
    let started = false;
    const startOnce = () => {
      if (started) return;
      started = true;
      startWipe();
    };
    loadViewComponent(resolvedView).then(startOnce, startOnce);
    if (typeof window !== 'undefined') {
      window.setTimeout(startOnce, VIEW_CHUNK_WAIT_LIMIT);
    }
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

  useEffect(() => {
    if (typeof window === 'undefined' || !shouldRedirectDisabledDownloadResourcePath(window.location)) return;
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
    showBackToTop,
    handleBackToTop
  };
};

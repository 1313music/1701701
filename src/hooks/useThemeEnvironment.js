import { useEffect } from 'react';

import { isMacDesktopWebViewLike, isNativeAppWebView } from '../utils/appDomUtils.js';

const isIOSDevice = () => /iPad|iPhone|iPod/.test(window.navigator.userAgent);
const isAndroidDevice = () => /Android/i.test(window.navigator.userAgent || '');

const createSafeAreaProbe = () => {
  if (typeof document === 'undefined') return null;

  const probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.position = 'fixed';
  probe.style.top = '0';
  probe.style.left = '0';
  probe.style.width = '0';
  probe.style.height = '0';
  probe.style.visibility = 'hidden';
  probe.style.pointerEvents = 'none';
  probe.style.paddingTop = 'env(safe-area-inset-top, 0px)';
  probe.style.paddingRight = 'env(safe-area-inset-right, 0px)';
  probe.style.paddingBottom = 'env(safe-area-inset-bottom, 0px)';
  probe.style.paddingLeft = 'env(safe-area-inset-left, 0px)';
  document.body.appendChild(probe);
  return probe;
};

const addMediaQueryChangeListener = (mediaQuery, listener) => {
  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }
  if (typeof mediaQuery.addListener === 'function') {
    mediaQuery.addListener(listener);
    return () => mediaQuery.removeListener(listener);
  }
  return () => {};
};

const readInsetValue = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.max(parsed, 0) : 0;
};

const VIEWPORT_SCROLL_SETTLE_DELAY_MS = 160;

export const shouldDeferViewportUpdate = ({ reason, isScrollGestureActive }) => (
  isScrollGestureActive
  && (reason === 'visual-viewport-resize' || reason === 'visual-viewport-scroll')
);

const clearViewportVars = (root) => {
  root.style.setProperty('--mobile-browser-bottom-gap', '0px');
  root.style.removeProperty('--mobile-fullscreen-height');
  root.style.removeProperty('--mobile-layout-safe-top');
  root.style.removeProperty('--mobile-main-top-safe-offset');
  root.style.removeProperty('--mobile-layout-safe-bottom');
  root.style.removeProperty('--mobile-player-safe-bottom');
  root.style.removeProperty('--mobile-fullscreen-safe-top');
  root.style.removeProperty('--mobile-fullscreen-safe-right');
  root.style.removeProperty('--mobile-fullscreen-safe-bottom');
  root.style.removeProperty('--mobile-fullscreen-safe-left');
};

export const useDisplayModeTheme = ({ resolvedTheme }) => {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const isiOS = isIOSDevice();
    const isAndroid = isAndroidDevice();
    const isMacDesktopWebView = isMacDesktopWebViewLike();
    const isNativeApp = isNativeAppWebView();
    const initialStandalone = mediaQuery.matches || (isiOS && window.navigator.standalone === true);
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    const standaloneThemeColor = resolvedTheme === 'dark' ? '#121214' : '#ffffff';
    const browserThemeColor = resolvedTheme === 'dark' ? '#121214' : '#ffffff';
    let stabilizeTimer1 = 0;
    let stabilizeTimer2 = 0;

    const applyMode = () => {
      const fallbackStandalone = isiOS && window.navigator.standalone === true;
      const runtimeStandalone = mediaQuery.matches || fallbackStandalone;
      const isStandalone = initialStandalone || runtimeStandalone;
      const isFallbackStandalone = !mediaQuery.matches && isStandalone;
      root.classList.remove('display-mode-standalone');
      root.classList.toggle('standalone-fallback', isFallbackStandalone);
      root.classList.toggle('standalone-mode', isStandalone);
      root.classList.toggle('native-app-mode', isNativeApp);
      root.classList.toggle('browser-mode', !isStandalone && !isNativeApp);
      root.classList.toggle('android-device', isAndroid);
      root.classList.toggle('android-browser-mode', isAndroid && !isStandalone && !isNativeApp);
      root.classList.toggle('mac-desktop-webview-like', isMacDesktopWebView);
      if (themeColorMeta) {
        themeColorMeta.setAttribute('content', isStandalone ? standaloneThemeColor : browserThemeColor);
      }
    };

    const stabilizeStandaloneViewport = () => {
      if (!isiOS) return;
      const isStandalone = root.classList.contains('standalone-mode') || root.classList.contains('standalone-fallback');
      if (!isStandalone || window.scrollY !== 0) return;
      window.requestAnimationFrame(() => {
        window.scrollTo(0, 1);
        window.scrollTo(0, 0);
        window.dispatchEvent(new Event('resize'));
      });
    };

    const applyModeAndStabilize = () => {
      applyMode();
      stabilizeStandaloneViewport();
      if (stabilizeTimer1) window.clearTimeout(stabilizeTimer1);
      if (stabilizeTimer2) window.clearTimeout(stabilizeTimer2);
      stabilizeTimer1 = window.setTimeout(stabilizeStandaloneViewport, 120);
      stabilizeTimer2 = window.setTimeout(stabilizeStandaloneViewport, 360);
    };

    const removeMediaQueryListener = addMediaQueryChangeListener(mediaQuery, applyModeAndStabilize);

    applyModeAndStabilize();
    window.addEventListener('pageshow', applyModeAndStabilize);
    document.addEventListener('visibilitychange', applyModeAndStabilize);

    return () => {
      if (stabilizeTimer1) window.clearTimeout(stabilizeTimer1);
      if (stabilizeTimer2) window.clearTimeout(stabilizeTimer2);
      window.removeEventListener('pageshow', applyModeAndStabilize);
      document.removeEventListener('visibilitychange', applyModeAndStabilize);
      root.classList.remove('android-device');
      root.classList.remove('android-browser-mode');
      root.classList.remove('native-app-mode');
      root.classList.remove('mac-desktop-webview-like');
      removeMediaQueryListener();
    };
  }, [resolvedTheme]);
};

export const useAndroidViewportVars = () => {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;
    const isAndroid = isAndroidDevice();
    const isiOS = isIOSDevice();
    const shouldTrackMobileViewport = isAndroid || isiOS;
    let rafId = 0;
    let settleTimerId = 0;
    let lastScrollActivityAt = 0;
    let probe = null;

    if (shouldTrackMobileViewport) {
      probe = createSafeAreaProbe();
    }

    const updateViewportVars = () => {
      if (!shouldTrackMobileViewport) {
        clearViewportVars(root);
        return;
      }

      const vv = window.visualViewport;
      const viewportHeight = vv?.height ?? window.innerHeight;
      const offsetTop = Math.max(vv?.offsetTop ?? 0, 0);
      const rawBottomGap = Math.max(window.innerHeight - (viewportHeight + offsetTop), 0);
      const isMobileWidth = window.innerWidth <= 1024;
      const browserBottomGap = isMobileWidth
        ? Math.min(Math.round(rawBottomGap), 120)
        : 0;
      const probeStyle = probe ? window.getComputedStyle(probe) : null;
      const safeTopInset = probeStyle ? Math.round(readInsetValue(probeStyle.paddingTop)) : 0;
      const safeRightInset = probeStyle ? Math.round(readInsetValue(probeStyle.paddingRight)) : 0;
      const safeBottomInset = probeStyle ? Math.round(readInsetValue(probeStyle.paddingBottom)) : 0;
      const safeLeftInset = probeStyle ? Math.round(readInsetValue(probeStyle.paddingLeft)) : 0;
      const isStandalone = root.classList.contains('standalone-mode') || root.classList.contains('standalone-fallback');
      const isAndroidBrowserMode = root.classList.contains('android-browser-mode');
      const measuredTopInset = Math.max(Math.round(offsetTop), safeTopInset);
      const screenHeight = Math.max(window.screen?.height || 0, window.screen?.availHeight || 0);
      const viewportShortfall = screenHeight > 0
        ? Math.max(Math.round(screenHeight - viewportHeight), 0)
        : 0;
      // Some Android browsers render edge-to-edge but still report both
      // visualViewport.offsetTop and env(safe-area-inset-top) as 0, which
      // lets the fixed top bar slide under the OS status bar.
      const needsAndroidBrowserTopFallback = (
        isAndroidBrowserMode
        && isMobileWidth
        && measuredTopInset === 0
        && viewportShortfall > 0
        && viewportShortfall <= 56
      );
      const fallbackTopInset = isStandalone && isMobileWidth && measuredTopInset === 0
        ? 24
        : needsAndroidBrowserTopFallback
          ? 24
          : 0;
      const safeTop = Math.max(measuredTopInset, fallbackTopInset);

      root.style.setProperty('--mobile-fullscreen-height', `${Math.round(viewportHeight)}px`);
      root.style.setProperty('--mobile-browser-bottom-gap', `${browserBottomGap}px`);
      root.style.setProperty('--mobile-layout-safe-top', `${safeTop}px`);
      root.style.setProperty('--mobile-main-top-safe-offset', `${safeTop}px`);
      root.style.setProperty('--mobile-layout-safe-bottom', `${safeBottomInset}px`);
      root.style.setProperty('--mobile-player-safe-bottom', `${safeBottomInset}px`);
      root.style.setProperty('--mobile-fullscreen-safe-top', `${safeTop}px`);
      root.style.setProperty('--mobile-fullscreen-safe-right', `${safeRightInset}px`);
      root.style.setProperty('--mobile-fullscreen-safe-bottom', `${safeBottomInset}px`);
      root.style.setProperty('--mobile-fullscreen-safe-left', `${safeLeftInset}px`);
    };

    const requestUpdate = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        updateViewportVars();
      });
    };

    const requestSettledUpdate = () => {
      if (settleTimerId) {
        window.clearTimeout(settleTimerId);
      }
      settleTimerId = window.setTimeout(() => {
        settleTimerId = 0;
        requestUpdate();
      }, VIEWPORT_SCROLL_SETTLE_DELAY_MS);
    };

    const handleViewportEvent = (reason) => {
      const isScrollGestureActive = (
        lastScrollActivityAt > 0
        && Date.now() - lastScrollActivityAt < VIEWPORT_SCROLL_SETTLE_DELAY_MS
      );
      if (shouldDeferViewportUpdate({ reason, isScrollGestureActive })) {
        requestSettledUpdate();
        return;
      }
      requestUpdate();
    };

    const handleWindowScroll = () => {
      lastScrollActivityAt = Date.now();
      requestSettledUpdate();
    };

    const handleVisualViewportResize = () => {
      handleViewportEvent('visual-viewport-resize');
    };

    const handleVisualViewportScroll = () => {
      handleViewportEvent('visual-viewport-scroll');
    };

    updateViewportVars();

    window.addEventListener('resize', requestUpdate);
    window.addEventListener('orientationchange', requestUpdate);
    window.addEventListener('pageshow', requestUpdate);
    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    document.addEventListener('visibilitychange', requestUpdate);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleVisualViewportResize);
      window.visualViewport.addEventListener('scroll', handleVisualViewportScroll);
    }

    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      if (settleTimerId) {
        window.clearTimeout(settleTimerId);
      }
      window.removeEventListener('resize', requestUpdate);
      window.removeEventListener('orientationchange', requestUpdate);
      window.removeEventListener('pageshow', requestUpdate);
      window.removeEventListener('scroll', handleWindowScroll);
      document.removeEventListener('visibilitychange', requestUpdate);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleVisualViewportResize);
        window.visualViewport.removeEventListener('scroll', handleVisualViewportScroll);
      }
      probe?.remove();
      clearViewportVars(root);
    };
  }, []);
};

export const useViewportDebugState = ({ setViewportDebug, showViewportDebug }) => {
  useEffect(() => {
    if (typeof window === 'undefined' || !showViewportDebug) return;

    const root = document.documentElement;
    const probe = createSafeAreaProbe();
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const isiOS = isIOSDevice();
    let rafId = 0;

    const updateDebug = () => {
      const vv = window.visualViewport;
      const viewportMeta = document.querySelector('meta[name="viewport"]')?.getAttribute('content') || '(missing)';
      const probeStyle = probe ? getComputedStyle(probe) : null;
      const rootStyle = getComputedStyle(root);
      const safeProbe = probeStyle
        ? `t:${probeStyle.paddingTop} r:${probeStyle.paddingRight} b:${probeStyle.paddingBottom} l:${probeStyle.paddingLeft}`
        : 'n/a';
      const safeVars = `layout(t:${(rootStyle.getPropertyValue('--mobile-layout-safe-top') || 'n/a').trim()} b:${(rootStyle.getPropertyValue('--mobile-layout-safe-bottom') || 'n/a').trim()})`;
      const vvText = vv
        ? `${Math.round(vv.width)}x${Math.round(vv.height)} top:${Math.round(vv.offsetTop)} left:${Math.round(vv.offsetLeft)} scale:${Number(vv.scale || 1).toFixed(2)}`
        : 'N/A';

      const fallbackStandalone = isiOS && window.navigator.standalone === true;
      const isStandalone = mediaQuery.matches || fallbackStandalone;

      setViewportDebug({
        time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
        mode: isStandalone ? 'standalone' : 'browser',
        navStandalone: window.navigator.standalone === true ? 'true' : 'false',
        viewportMeta,
        inner: `${window.innerWidth}x${window.innerHeight}`,
        client: `${root.clientWidth}x${root.clientHeight}`,
        visualViewport: vvText,
        scroll: `x:${Math.round(window.scrollX)} y:${Math.round(window.scrollY)}`,
        safeProbe,
        safeVars,
        rootClass: root.className || '(none)'
      });
    };

    const requestUpdate = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        updateDebug();
      });
    };

    const removeMediaQueryListener = addMediaQueryChangeListener(mediaQuery, requestUpdate);

    updateDebug();
    window.addEventListener('resize', requestUpdate);
    window.addEventListener('orientationchange', requestUpdate);
    window.addEventListener('pageshow', requestUpdate);
    window.addEventListener('scroll', requestUpdate, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', requestUpdate);
      window.visualViewport.addEventListener('scroll', requestUpdate);
    }

    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener('resize', requestUpdate);
      window.removeEventListener('orientationchange', requestUpdate);
      window.removeEventListener('pageshow', requestUpdate);
      window.removeEventListener('scroll', requestUpdate);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', requestUpdate);
        window.visualViewport.removeEventListener('scroll', requestUpdate);
      }
      removeMediaQueryListener();
      probe?.remove();
    };
  }, [setViewportDebug, showViewportDebug]);
};

import { useCallback, useEffect, useMemo, useState } from 'react';

const THEME_PREFERENCE_KEY = 'themePreference';

const getSystemTheme = () => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const useTheme = ({ showToast } = {}) => {
  const [themePreference, setThemePreference] = useState(() => {
    if (typeof window === 'undefined') return 'light';
    const stored = window.localStorage.getItem(THEME_PREFERENCE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    return getSystemTheme();
  });
  const [showViewportDebug] = useState(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('debugViewport') === '1' || params.get('debug') === '1';
  });
  const [viewportDebug, setViewportDebug] = useState(null);

  const resolvedTheme = useMemo(() => themePreference, [themePreference]);

  const handleThemeToggle = useCallback((event) => {
    const nextPreference = themePreference === 'dark' ? 'light' : 'dark';
    const message = nextPreference === 'dark' ? '深色模式' : '浅色模式';
    setThemePreference(nextPreference);
    const anchorEvent = event?.currentTarget ? { currentTarget: event.currentTarget } : null;
    showToast?.(message, 'tone-add', { placement: 'side', anchorEvent });
  }, [showToast, themePreference]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const isiOS = /iPad|iPhone|iPod/.test(window.navigator.userAgent);
    const isAndroid = /Android/i.test(window.navigator.userAgent || '');
    // In iOS/standalone shells, display-mode can transiently report false during gestures.
    // Lock standalone for the current session once we detect it at startup.
    const initialStandalone = mediaQuery.matches || (isiOS && window.navigator.standalone === true);
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    const standaloneThemeColor = resolvedTheme === 'dark' ? '#121214' : '#ffffff';
    const browserThemeColor = 'transparent';
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
      root.classList.toggle('browser-mode', !isStandalone);
      root.classList.toggle('android-device', isAndroid);
      root.classList.toggle('android-browser-mode', isAndroid && !isStandalone);
      if (themeColorMeta) {
        themeColorMeta.setAttribute('content', isStandalone ? standaloneThemeColor : browserThemeColor);
      }
    };

    const stabilizeStandaloneViewport = () => {
      if (!isiOS) return;
      const isStandalone = root.classList.contains('standalone-mode') || root.classList.contains('standalone-fallback');
      if (!isStandalone) return;
      if (window.scrollY !== 0) return;
      // iOS PWA occasionally needs one synthetic scroll cycle to settle hit-testing/safe-area layout.
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

    applyModeAndStabilize();
    window.addEventListener('pageshow', applyModeAndStabilize);
    document.addEventListener('visibilitychange', applyModeAndStabilize);
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', applyModeAndStabilize);
      return () => {
        if (stabilizeTimer1) window.clearTimeout(stabilizeTimer1);
        if (stabilizeTimer2) window.clearTimeout(stabilizeTimer2);
        window.removeEventListener('pageshow', applyModeAndStabilize);
        document.removeEventListener('visibilitychange', applyModeAndStabilize);
        mediaQuery.removeEventListener('change', applyModeAndStabilize);
      };
    }
    mediaQuery.addListener(applyModeAndStabilize);
    return () => {
      if (stabilizeTimer1) window.clearTimeout(stabilizeTimer1);
      if (stabilizeTimer2) window.clearTimeout(stabilizeTimer2);
      window.removeEventListener('pageshow', applyModeAndStabilize);
      document.removeEventListener('visibilitychange', applyModeAndStabilize);
      root.classList.remove('android-device');
      root.classList.remove('android-browser-mode');
      mediaQuery.removeListener(applyModeAndStabilize);
    };
  }, [resolvedTheme]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;
    const isAndroid = /Android/i.test(window.navigator.userAgent || '');
    let rafId = 0;
    let probe = null;

    const readInsetValue = (value) => {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? Math.max(parsed, 0) : 0;
    };

    const clearViewportVars = () => {
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

    if (isAndroid) {
      probe = document.createElement('div');
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
    }

    const updateViewportVars = () => {
      if (!isAndroid) {
        clearViewportVars();
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
      const measuredTopInset = Math.max(Math.round(offsetTop), safeTopInset);
      // Some Android PWAs/WebViews render under the status bar while env()/visualViewport still report 0.
      const fallbackTopInset = isStandalone && isMobileWidth && measuredTopInset === 0 ? 24 : 0;
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

    updateViewportVars();

    window.addEventListener('resize', requestUpdate);
    window.addEventListener('orientationchange', requestUpdate);
    window.addEventListener('pageshow', requestUpdate);
    document.addEventListener('visibilitychange', requestUpdate);
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
      document.removeEventListener('visibilitychange', requestUpdate);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', requestUpdate);
        window.visualViewport.removeEventListener('scroll', requestUpdate);
      }
      if (probe) {
        probe.remove();
      }
      clearViewportVars();
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !showViewportDebug) return;

    const root = document.documentElement;
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

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const isiOS = /iPad|iPhone|iPod/.test(window.navigator.userAgent);
    let rafId = 0;

    const updateDebug = () => {
      const vv = window.visualViewport;
      const viewportMeta = document.querySelector('meta[name="viewport"]')?.getAttribute('content') || '(missing)';
      const probeStyle = getComputedStyle(probe);
      const rootStyle = getComputedStyle(root);
      const safeProbe = `t:${probeStyle.paddingTop} r:${probeStyle.paddingRight} b:${probeStyle.paddingBottom} l:${probeStyle.paddingLeft}`;
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

    updateDebug();
    window.addEventListener('resize', requestUpdate);
    window.addEventListener('orientationchange', requestUpdate);
    window.addEventListener('pageshow', requestUpdate);
    window.addEventListener('scroll', requestUpdate, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', requestUpdate);
      window.visualViewport.addEventListener('scroll', requestUpdate);
    }
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', requestUpdate);
    } else if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(requestUpdate);
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
      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', requestUpdate);
      } else if (typeof mediaQuery.removeListener === 'function') {
        mediaQuery.removeListener(requestUpdate);
      }
      probe.remove();
    };
  }, [showViewportDebug]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(THEME_PREFERENCE_KEY, themePreference);
    } catch {
      // ignore storage errors
    }
  }, [themePreference]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    document.documentElement.setAttribute('data-theme', resolvedTheme);
    document.body.setAttribute('data-theme', resolvedTheme);
  }, [resolvedTheme]);

  return {
    themePreference,
    resolvedTheme,
    showViewportDebug,
    viewportDebug,
    handleThemeToggle
  };
};

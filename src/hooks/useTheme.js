import { useCallback, useEffect, useMemo, useState } from 'react';

const THEME_PREFERENCE_KEY = 'themePreference';

const getSystemTheme = () => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const useTheme = ({ showToast } = {}) => {
  const [themePreference, setThemePreference] = useState(() => {
    if (typeof window === 'undefined') return 'system';
    const stored = window.localStorage.getItem(THEME_PREFERENCE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
    return 'system';
  });
  const [systemTheme, setSystemTheme] = useState(() => getSystemTheme());
  const [showViewportDebug] = useState(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('debugViewport') === '1' || params.get('debug') === '1';
  });
  const [viewportDebug, setViewportDebug] = useState(null);

  const resolvedTheme = useMemo(
    () => (themePreference === 'system' ? systemTheme : themePreference),
    [systemTheme, themePreference]
  );

  const handleThemeToggle = useCallback((event) => {
    const nextPreference = themePreference === 'system'
      ? 'light'
      : themePreference === 'light'
        ? 'dark'
        : 'system';
    const message = nextPreference === 'system'
      ? '跟随系统'
      : nextPreference === 'dark'
        ? '深色模式'
        : '浅色模式';
    setThemePreference(nextPreference);
    const anchorEvent = event?.currentTarget ? { currentTarget: event.currentTarget } : null;
    showToast?.(message, 'tone-add', { placement: 'side', anchorEvent });
  }, [showToast, themePreference]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const isiOS = /iPad|iPhone|iPod/.test(window.navigator.userAgent);
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    const browserViewport = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
    const standaloneViewport = `${browserViewport}, viewport-fit=cover`;
    const standaloneThemeColor = resolvedTheme === 'dark' ? '#121214' : '#ffffff';
    const browserThemeColor = 'transparent';

    const applyMode = () => {
      const fallbackStandalone = isiOS && window.navigator.standalone === true;
      const isStandalone = mediaQuery.matches || fallbackStandalone;
      root.classList.remove('display-mode-standalone');
      root.classList.toggle('standalone-fallback', fallbackStandalone && !mediaQuery.matches);
      root.classList.toggle('standalone-mode', isStandalone);
      root.classList.toggle('browser-mode', !isStandalone);
      if (viewportMeta) {
        viewportMeta.setAttribute('content', isStandalone ? standaloneViewport : browserViewport);
      }
      if (themeColorMeta) {
        themeColorMeta.setAttribute('content', isStandalone ? standaloneThemeColor : browserThemeColor);
      }
    };

    applyMode();
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', applyMode);
      return () => mediaQuery.removeEventListener('change', applyMode);
    }
    mediaQuery.addListener(applyMode);
    return () => mediaQuery.removeListener(applyMode);
  }, [resolvedTheme]);

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
    if (typeof window === 'undefined') return undefined;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event) => {
      setSystemTheme(event.matches ? 'dark' : 'light');
    };
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

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
    systemTheme,
    resolvedTheme,
    showViewportDebug,
    viewportDebug,
    handleThemeToggle
  };
};

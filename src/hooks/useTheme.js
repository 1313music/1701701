import { useCallback, useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';

import { runLaneWipe } from '../utils/laneWipe.js';
import {
  useAndroidViewportVars,
  useDisplayModeTheme,
  useViewportDebugState
} from './useThemeEnvironment.js';

const THEME_PREFERENCE_KEY = 'themePreference';
const THEME_PREFERENCE_SOURCE_KEY = 'themePreferenceSource';
const DEFAULT_THEME_PREFERENCE = 'system';
const DEFAULT_RESOLVED_THEME = 'light';

const isResolvedTheme = (theme) => theme === 'light' || theme === 'dark';

const readSystemTheme = () => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return DEFAULT_RESOLVED_THEME;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const readStoredThemePreference = () => {
  if (typeof window === 'undefined') return DEFAULT_THEME_PREFERENCE;

  try {
    const stored = window.localStorage.getItem(THEME_PREFERENCE_KEY);
    const source = window.localStorage.getItem(THEME_PREFERENCE_SOURCE_KEY);

    if (stored === 'system') return 'system';
    if (stored === 'light') return 'light';
    if (stored === 'dark' && source === 'manual') return 'dark';
    return DEFAULT_THEME_PREFERENCE;
  } catch {
    return DEFAULT_THEME_PREFERENCE;
  }
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

export const useTheme = ({ showToast } = {}) => {
  const [themePreference, setThemePreference] = useState(readStoredThemePreference);
  const [systemTheme, setSystemTheme] = useState(readSystemTheme);
  const [showViewportDebug] = useState(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('debugViewport') === '1' || params.get('debug') === '1';
  });
  const [viewportDebug, setViewportDebug] = useState(null);

  const resolvedTheme = useMemo(
    () => (isResolvedTheme(themePreference) ? themePreference : systemTheme),
    [systemTheme, themePreference]
  );

  const handleThemeToggle = useCallback((event) => {
    const nextPreference = resolvedTheme === 'dark' ? 'light' : 'dark';
    const message = nextPreference === 'dark' ? '深色模式' : '浅色模式';
    const anchorEvent = event?.currentTarget ? { currentTarget: event.currentTarget } : null;

    // React 在事件回调结束后会清空 currentTarget，按钮位置必须在这里同步取到
    const rect = event?.currentTarget?.getBoundingClientRect?.();

    const notify = () => showToast?.(message, 'tone-add', { placement: 'side', anchorEvent });

    const applyTheme = () => {
      // flushSync 让 React 同步把新主题渲染出来，快照才能拍到切换后的样子
      flushSync(() => setThemePreference(nextPreference));
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', nextPreference);
        document.body.setAttribute('data-theme', nextPreference);
      }
    };

    const transition = runLaneWipe({
      originX: rect ? rect.left + rect.width / 2 : undefined,
      originY: rect ? rect.top + rect.height / 2 : undefined,
      applyChange: applyTheme
    });

    if (!transition) {
      notify();
      return;
    }

    // 扫掠期间整页被快照盖住，这时候弹提示是看不见的，等扫完再弹
    // 用 then(ok, fail) 而不是 then().catch()，避免 notify 自己抛错时被调用两次
    transition.finished.then(notify, notify);
  }, [resolvedTheme, showToast]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const syncSystemTheme = () => {
      setSystemTheme(mediaQuery.matches ? 'dark' : 'light');
    };
    const removeMediaQueryListener = addMediaQueryChangeListener(mediaQuery, syncSystemTheme);
    syncSystemTheme();

    return removeMediaQueryListener;
  }, []);

  useDisplayModeTheme({ resolvedTheme });
  useAndroidViewportVars();
  useViewportDebugState({ showViewportDebug, setViewportDebug });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(THEME_PREFERENCE_KEY, themePreference);
      if (isResolvedTheme(themePreference)) {
        window.localStorage.setItem(THEME_PREFERENCE_SOURCE_KEY, 'manual');
      } else {
        window.localStorage.removeItem(THEME_PREFERENCE_SOURCE_KEY);
      }
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

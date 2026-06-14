import { useCallback, useEffect, useMemo, useState } from 'react';

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
    setThemePreference(nextPreference);
    const anchorEvent = event?.currentTarget ? { currentTarget: event.currentTarget } : null;
    showToast?.(message, 'tone-add', { placement: 'side', anchorEvent });
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

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  useAndroidViewportVars,
  useDisplayModeTheme,
  useViewportDebugState
} from './useThemeEnvironment.js';

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

  useDisplayModeTheme({ resolvedTheme });
  useAndroidViewportVars();
  useViewportDebugState({ showViewportDebug, setViewportDebug });

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

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTheme } from './useTheme.js';

describe('useTheme', () => {
  const originalMatchMedia = window.matchMedia;
  const originalRequestAnimationFrame = window.requestAnimationFrame;
  const originalCancelAnimationFrame = window.cancelAnimationFrame;
  let mediaQueries;

  const installMatchMedia = ({ prefersDark = false } = {}) => {
    mediaQueries = new Map();
    window.matchMedia = vi.fn((query) => {
      if (mediaQueries.has(query)) return mediaQueries.get(query);

      let matches = query === '(prefers-color-scheme: dark)' ? prefersDark : false;
      const listeners = new Set();
      const mediaQuery = {
        media: query,
        get matches() {
          return matches;
        },
        addEventListener: vi.fn((type, listener) => {
          if (type === 'change') listeners.add(listener);
        }),
        removeEventListener: vi.fn((type, listener) => {
          if (type === 'change') listeners.delete(listener);
        }),
        addListener: vi.fn((listener) => {
          listeners.add(listener);
        }),
        removeListener: vi.fn((listener) => {
          listeners.delete(listener);
        }),
        dispatch: (nextMatches) => {
          matches = nextMatches;
          listeners.forEach((listener) => listener({ matches, media: query }));
        }
      };
      mediaQueries.set(query, mediaQuery);
      return mediaQuery;
    });
  };

  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.body.removeAttribute('data-theme');

    installMatchMedia();
    window.requestAnimationFrame = vi.fn((callback) => {
      callback();
      return 1;
    });
    window.cancelAnimationFrame = vi.fn();
  });

  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.body.removeAttribute('data-theme');
    window.matchMedia = originalMatchMedia;
    window.requestAnimationFrame = originalRequestAnimationFrame;
    window.cancelAnimationFrame = originalCancelAnimationFrame;
    vi.restoreAllMocks();
  });

  it('follows the light system theme when the user has not chosen a theme', async () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current.themePreference).toBe('system');
    expect(result.current.resolvedTheme).toBe('light');

    await waitFor(() => {
      expect(window.localStorage.getItem('themePreference')).toBe('system');
      expect(window.localStorage.getItem('themePreferenceSource')).toBeNull();
      expect(document.documentElement).toHaveAttribute('data-theme', 'light');
      expect(document.body).toHaveAttribute('data-theme', 'light');
    });
  });

  it('follows the dark system theme when the user has not chosen a theme', async () => {
    installMatchMedia({ prefersDark: true });

    const { result } = renderHook(() => useTheme());

    expect(result.current.themePreference).toBe('system');
    expect(result.current.resolvedTheme).toBe('dark');

    await waitFor(() => {
      expect(window.localStorage.getItem('themePreference')).toBe('system');
      expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
      expect(document.body).toHaveAttribute('data-theme', 'dark');
    });
  });

  it('updates the resolved theme when the system theme changes', async () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current.resolvedTheme).toBe('light');

    act(() => {
      mediaQueries.get('(prefers-color-scheme: dark)').dispatch(true);
    });

    expect(result.current.themePreference).toBe('system');
    expect(result.current.resolvedTheme).toBe('dark');

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    });
  });

  it('keeps a user-selected light preference', async () => {
    window.localStorage.setItem('themePreference', 'light');

    const { result } = renderHook(() => useTheme());

    expect(result.current.themePreference).toBe('light');
    expect(result.current.resolvedTheme).toBe('light');

    await waitFor(() => {
      expect(window.localStorage.getItem('themePreference')).toBe('light');
      expect(window.localStorage.getItem('themePreferenceSource')).toBe('manual');
      expect(document.documentElement).toHaveAttribute('data-theme', 'light');
      expect(document.body).toHaveAttribute('data-theme', 'light');
    });
  });

  it('keeps a user-selected dark preference', async () => {
    window.localStorage.setItem('themePreference', 'dark');
    window.localStorage.setItem('themePreferenceSource', 'manual');

    const { result } = renderHook(() => useTheme());

    expect(result.current.themePreference).toBe('dark');
    expect(result.current.resolvedTheme).toBe('dark');

    await waitFor(() => {
      expect(window.localStorage.getItem('themePreference')).toBe('dark');
      expect(window.localStorage.getItem('themePreferenceSource')).toBe('manual');
      expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
      expect(document.body).toHaveAttribute('data-theme', 'dark');
    });
  });

  it('migrates the old automatic dark default back to the system theme', async () => {
    window.localStorage.setItem('themePreference', 'dark');

    const { result } = renderHook(() => useTheme());

    expect(result.current.themePreference).toBe('system');
    expect(result.current.resolvedTheme).toBe('light');

    await waitFor(() => {
      expect(window.localStorage.getItem('themePreference')).toBe('system');
      expect(window.localStorage.getItem('themePreferenceSource')).toBeNull();
      expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    });
  });
});

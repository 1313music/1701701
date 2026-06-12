import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTheme } from './useTheme.js';

describe('useTheme', () => {
  const originalMatchMedia = window.matchMedia;
  const originalRequestAnimationFrame = window.requestAnimationFrame;
  const originalCancelAnimationFrame = window.cancelAnimationFrame;

  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.body.removeAttribute('data-theme');

    window.matchMedia = vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn()
    }));
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

  it('defaults to dark mode when the user has not chosen a theme', async () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current.themePreference).toBe('dark');
    expect(result.current.resolvedTheme).toBe('dark');

    await waitFor(() => {
      expect(window.localStorage.getItem('themePreference')).toBe('dark');
      expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
      expect(document.body).toHaveAttribute('data-theme', 'dark');
    });
  });

  it('keeps a user-selected light preference', async () => {
    window.localStorage.setItem('themePreference', 'light');

    const { result } = renderHook(() => useTheme());

    expect(result.current.themePreference).toBe('light');
    expect(result.current.resolvedTheme).toBe('light');

    await waitFor(() => {
      expect(window.localStorage.getItem('themePreference')).toBe('light');
      expect(document.documentElement).toHaveAttribute('data-theme', 'light');
      expect(document.body).toHaveAttribute('data-theme', 'light');
    });
  });
});

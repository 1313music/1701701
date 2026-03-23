import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useVideoSourceResolver } from './useVideoSourceResolver.js';

describe('useVideoSourceResolver', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('falls back to the backup source when the primary js resolver fails', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() => useVideoSourceResolver({
      activeVideo: {
        url: 'https://example.com/playlist.js',
        backupUrl: 'https://example.com/backup.mp4'
      },
      activeVideoKey: 'video:1'
    }));

    await waitFor(() => {
      expect(result.current.isResolving).toBe(false);
    });

    expect(result.current.resolvedUrl).toBe('https://example.com/backup.mp4');
    expect(result.current.fallbackUrl).toBe('https://example.com/backup.mp4');
    expect(result.current.resolveError).toBe('');
  });

  it('keeps the backup source available when the primary resolver succeeds', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('https://cdn.example.com/stream.m3u8')
    });

    const { result } = renderHook(() => useVideoSourceResolver({
      activeVideo: {
        url: 'https://example.com/playlist.js',
        backupUrl: 'https://example.com/backup.mp4'
      },
      activeVideoKey: 'video:2'
    }));

    await waitFor(() => {
      expect(result.current.isResolving).toBe(false);
    });

    expect(result.current.resolvedUrl).toBe('https://cdn.example.com/stream.m3u8');
    expect(result.current.resolvedType).toBe('hls');
    expect(result.current.fallbackUrl).toBe('https://example.com/backup.mp4');
    expect(result.current.canSwitchToBackup).toBe(true);
  });
});

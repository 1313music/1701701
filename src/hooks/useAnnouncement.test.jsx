import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAnnouncement } from './useAnnouncement.js';

const ANNOUNCEMENT_READ_KEY = 'announcement:last-read-id:v1';

const AnnouncementHarness = ({ pollIntervalMs = 1000 }) => {
  const {
    announcement,
    isAnnouncementOpen,
    isLoadingAnnouncement,
    dismissAnnouncement
  } = useAnnouncement({ pollIntervalMs });

  return (
    <div>
      <div data-testid="loading">{isLoadingAnnouncement ? 'loading' : 'ready'}</div>
      <div data-testid="announcement-id">{announcement?.id || 'none'}</div>
      <div data-testid="announcement-open">{isAnnouncementOpen ? 'open' : 'closed'}</div>
      <button type="button" onClick={dismissAnnouncement}>dismiss</button>
    </div>
  );
};

describe('useAnnouncement', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    window.localStorage.clear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('opens an active unread announcement and persists the read id on dismiss', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'announcement-1',
        enabled: true,
        title: '更新',
        content: '新增公告能力'
      })
    });

    render(<AnnouncementHarness pollIntervalMs={0} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      expect(screen.getByTestId('announcement-id')).toHaveTextContent('announcement-1');
      expect(screen.getByTestId('announcement-open')).toHaveTextContent('open');
    });

    fireEvent.click(screen.getByRole('button', { name: 'dismiss' }));

    expect(window.localStorage.getItem(ANNOUNCEMENT_READ_KEY)).toBe('announcement-1');
    expect(screen.getByTestId('announcement-open')).toHaveTextContent('closed');
  });

  it('reopens when polling discovers a newer announcement id', async () => {
    let requestCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      requestCount += 1;
      return {
        ok: true,
        json: async () => (
          requestCount === 1
            ? {
                id: 'announcement-1',
                enabled: true,
                title: '更新',
                content: '第一次公告'
              }
            : {
                id: 'announcement-2',
                enabled: true,
                title: '更新',
                content: '第二次公告'
              }
        )
      };
    });

    render(<AnnouncementHarness pollIntervalMs={1000} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    await waitFor(() => {
      expect(screen.getByTestId('announcement-open')).toHaveTextContent('open');
    });

    fireEvent.click(screen.getByRole('button', { name: 'dismiss' }));
    expect(window.localStorage.getItem(ANNOUNCEMENT_READ_KEY)).toBe('announcement-1');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    await waitFor(() => {
      expect(screen.getByTestId('announcement-id')).toHaveTextContent('announcement-2');
      expect(screen.getByTestId('announcement-open')).toHaveTextContent('open');
    });
  });
});

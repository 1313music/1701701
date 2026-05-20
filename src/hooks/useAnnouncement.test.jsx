import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAnnouncement } from './useAnnouncement.js';

const ANNOUNCEMENT_READ_KEY = 'announcement:last-read-id:v1';

const AnnouncementHarness = ({ pollIntervalMs }) => {
  const {
    announcement,
    announcementHistory,
    isAnnouncementOpen,
    isAnnouncementUnread,
    isLoadingAnnouncement,
    dismissAnnouncement,
    openAnnouncement
  } = useAnnouncement({ pollIntervalMs });

  return (
    <div>
      <div data-testid="loading">{isLoadingAnnouncement ? 'loading' : 'ready'}</div>
      <div data-testid="announcement-id">{announcement?.id || 'none'}</div>
      <div data-testid="announcement-history-count">{announcementHistory.length}</div>
      <div data-testid="announcement-open">{isAnnouncementOpen ? 'open' : 'closed'}</div>
      <div data-testid="announcement-unread">{isAnnouncementUnread ? 'unread' : 'read'}</div>
      <button type="button" onClick={dismissAnnouncement}>dismiss</button>
      <button type="button" onClick={openAnnouncement}>open announcement</button>
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
    expect(screen.getByTestId('announcement-unread')).toHaveTextContent('read');

    fireEvent.click(screen.getByRole('button', { name: 'open announcement' }));
    expect(screen.getByTestId('announcement-open')).toHaveTextContent('open');
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

  it('does not poll for announcements by default', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'announcement-1',
        enabled: true,
        title: '更新',
        content: '默认只加载一次'
      })
    });

    render(<AnnouncementHarness />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    await waitFor(() => {
      expect(screen.getByTestId('announcement-id')).toHaveTextContent('announcement-1');
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30 * 60 * 1000);
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('loads announcement history from the announcement payload', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        announcement: {
          id: 'announcement-2',
          enabled: true,
          title: '更新',
          content: '第二次公告'
        },
        history: [
          {
            id: 'announcement-1',
            enabled: false,
            title: '历史公告',
            content: '第一次公告',
            updatedAt: '2026-05-18T00:00:00+08:00'
          }
        ]
      })
    });

    render(<AnnouncementHarness pollIntervalMs={0} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    await waitFor(() => {
      expect(screen.getByTestId('announcement-id')).toHaveTextContent('announcement-2');
      expect(screen.getByTestId('announcement-history-count')).toHaveTextContent('1');
    });
  });

  it('keeps silent unread announcements closed until the trigger opens them', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'announcement-silent',
        enabled: true,
        title: '更新',
        content: '静默公告',
        deliveryMode: 'silent'
      })
    });

    render(<AnnouncementHarness pollIntervalMs={0} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    await waitFor(() => {
      expect(screen.getByTestId('announcement-id')).toHaveTextContent('announcement-silent');
      expect(screen.getByTestId('announcement-open')).toHaveTextContent('closed');
      expect(screen.getByTestId('announcement-unread')).toHaveTextContent('unread');
    });

    fireEvent.click(screen.getByRole('button', { name: 'open announcement' }));
    expect(screen.getByTestId('announcement-open')).toHaveTextContent('open');
  });
});

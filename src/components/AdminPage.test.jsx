import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import AdminPage from './AdminPage.jsx';

vi.mock('../data/announcementAdminApi.js', () => ({
  isAnnouncementAdminApiConfigured: () => true,
  publishAnnouncement: vi.fn(async ({ announcement }) => ({
    ...announcement,
    updatedAt: '2026-05-18T00:00:00.000Z'
  }))
}));

vi.mock('../data/announcementSource.js', () => ({
  loadAnnouncement: vi.fn(async () => ({
    announcement: {
      id: 'current-notice',
      enabled: true,
      title: '当前公告',
      content: '当前正文',
      type: 'info',
      force: false,
      confirmText: '我知道了',
      linkText: '',
      linkUrl: '',
      startAt: '',
      endAt: '',
      updatedAt: ''
    }
  }))
}));

describe('AdminPage', () => {
  afterEach(() => {
    window.sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('loads the current announcement and publishes edits', async () => {
    const { publishAnnouncement } = await import('../data/announcementAdminApi.js');

    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('当前公告')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('管理员口令'), {
      target: { value: 'secret-token' }
    });
    fireEvent.change(screen.getByLabelText('标题'), {
      target: { value: '新的公告' }
    });
    fireEvent.change(screen.getByLabelText('正文'), {
      target: { value: '新的正文' }
    });
    fireEvent.click(screen.getByRole('button', { name: '发布公告' }));

    await waitFor(() => {
      expect(publishAnnouncement).toHaveBeenCalledWith(expect.objectContaining({
        token: 'secret-token',
        announcement: expect.objectContaining({
          id: 'current-notice',
          title: '新的公告',
          content: '新的正文'
        })
      }));
    });

    expect(await screen.findByText('公告已发布')).toBeInTheDocument();
  });
});

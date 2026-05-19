import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import AppPage from './AppPage.jsx';

describe('AppPage', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('marks cross-origin packages as unverified instead of ready when probing fails', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('cors blocked'));

    render(<AppPage />);

    await waitFor(() => {
      expect(screen.getAllByRole('link', { name: '打开下载链接' })).toHaveLength(3);
    });

    const openLinks = screen.getAllByRole('link', { name: '打开下载链接' });
    expect(openLinks[0]).toHaveAttribute(
      'data-umami-event',
      'app_download_click'
    );
    expect(openLinks[0]).toHaveAttribute(
      'data-umami-event-action',
      'open_link'
    );
    expect(screen.queryByRole('link', { name: '立即下载' })).not.toBeInTheDocument();
    expect(screen.getAllByText('无法自动校验，已提供直链')).toHaveLength(3);
  });

  it('shows the ready state when a package probe succeeds', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: () => 'application/octet-stream'
      }
    });

    render(<AppPage />);

    await waitFor(() => {
      expect(screen.getAllByRole('link', { name: '立即下载' })).toHaveLength(3);
    });

    const downloadLinks = screen.getAllByRole('link', { name: '立即下载' });
    expect(downloadLinks[0]).toHaveAttribute('data-umami-event', 'app_download_click');
    expect(downloadLinks[0]).toHaveAttribute('data-umami-event-platform', 'mac');
    expect(downloadLinks[0]).toHaveAttribute('data-umami-event-filename', '1701701.dmg');
    expect(downloadLinks[0]).toHaveAttribute('data-umami-event-action', 'download');
  });
});

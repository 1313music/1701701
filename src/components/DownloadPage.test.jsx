import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import DownloadPage from './DownloadPage.jsx';

const { loadDownloadSections } = vi.hoisted(() => ({
  loadDownloadSections: vi.fn()
}));

vi.mock('../data/downloadManifest', () => ({
  loadDownloadSections
}));

describe('DownloadPage', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    loadDownloadSections.mockResolvedValue([
      {
        title: '其他资源',
        groups: [
          {
            title: '资源下载',
            items: [
              {
                title: '《李志自传》',
                url: 'https://example.com/lizhi-biography.pdf',
                filename: '李志自传.pdf'
              }
            ]
          }
        ]
      }
    ]);
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['pdf'])
    });
    window.history.replaceState(null, '', '/download');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
    window.history.replaceState(null, '', '/');
  });

  it('links downloadable previews to internal standalone preview routes', async () => {
    render(<DownloadPage />);

    expect(await screen.findByRole('link', { name: '预览' })).toHaveAttribute(
      'href',
      '/download/preview/%E6%9D%8E%E5%BF%97%E8%87%AA%E4%BC%A0'
    );
  });

  it('renders the standalone preview page for internal preview routes', async () => {
    window.history.replaceState(
      null,
      '',
      '/download/preview/%E6%9D%8E%E5%BF%97%E8%87%AA%E4%BC%A0'
    );

    render(<DownloadPage />);

    expect(await screen.findByRole('heading', { name: '《李志自传》' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回下载页' })).toHaveAttribute('href', '/download');
    expect(screen.getByText('文档较大，首次加载可能需要 5 到 20 秒。若长时间空白，可尝试右上角“新窗口打开”。')).toBeInTheDocument();
    expect(screen.getByText('预览加载中，请稍等…')).toBeInTheDocument();
    expect(screen.getByTitle('《李志自传》 文档预览')).toHaveAttribute(
      'src',
      `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent('https://example.com/lizhi-biography.pdf')}`
    );
  });

  it('hides the loading placeholder after the preview frame reports ready', async () => {
    window.history.replaceState(
      null,
      '',
      '/download/preview/%E6%9D%8E%E5%BF%97%E8%87%AA%E4%BC%A0'
    );

    render(<DownloadPage />);

    const iframe = await screen.findByTitle('《李志自传》 文档预览');
    fireEvent.load(iframe);

    expect(screen.queryByText('预览加载中，请稍等…')).not.toBeInTheDocument();
  });
});

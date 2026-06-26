import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import DownloadPage from './DownloadPage.jsx';

const { copyTextToClipboard, loadDownloadSections } = vi.hoisted(() => ({
  copyTextToClipboard: vi.fn(),
  loadDownloadSections: vi.fn()
}));

vi.mock('../utils/appDomUtils.js', () => ({
  copyTextToClipboard
}));

vi.mock('../data/downloadManifest', () => ({
  loadDownloadSections,
  subscribeToDownloadSections: () => () => {}
}));

describe('DownloadPage', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    loadDownloadSections.mockResolvedValue([
      {
        title: '其他歌曲',
        groups: [
          {
            title: '翻唱/现场/即兴/微博/未收录',
            items: [
              {
                title: '现场资料示例',
                url: 'https://example.com/live-note.pdf',
                filename: '现场资料示例.pdf',
                previewUrl: 'https://example.com/live-note-preview.pdf'
              }
            ]
          }
        ]
      },
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
    copyTextToClipboard.mockResolvedValue(true);
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

  it('does not render resource documents on the download page', async () => {
    render(<DownloadPage />);

    expect(await screen.findByText('现场资料示例')).toBeInTheDocument();
    expect(screen.queryByText('李志自传')).not.toBeInTheDocument();
  });

  it('links downloadable previews to internal standalone preview routes', async () => {
    render(<DownloadPage />);

    fireEvent.click(await screen.findByRole('button', { name: /翻唱\/现场\/即兴\/微博\/未收录/ }));

    expect(screen.getByRole('link', { name: '预览' })).toHaveAttribute(
      'href',
      '/download/preview/%E7%8E%B0%E5%9C%BA%E8%B5%84%E6%96%99%E7%A4%BA%E4%BE%8B'
    );
  });

  it('renders the standalone preview page for internal preview routes', async () => {
    window.history.replaceState(
      null,
      '',
      '/download/preview/%E7%8E%B0%E5%9C%BA%E8%B5%84%E6%96%99%E7%A4%BA%E4%BE%8B'
    );

    render(<DownloadPage />);

    expect(await screen.findByRole('heading', { name: '现场资料示例' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '返回下载页' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '打开原件' })).toHaveAttribute(
      'href',
      'https://example.com/live-note-preview.pdf'
    );
    fireEvent.click(screen.getByRole('button', { name: '复制预览链接' }));
    await waitFor(() => {
      expect(copyTextToClipboard).toHaveBeenCalledWith(
        'https://1701701.xyz/download/preview/%E7%8E%B0%E5%9C%BA%E8%B5%84%E6%96%99%E7%A4%BA%E4%BE%8B'
      );
    });
    expect(screen.getByRole('button', { name: '复制预览链接' })).toHaveTextContent('已复制');
    expect(screen.getByText('预览加载较慢时，可直接打开原件。')).toBeInTheDocument();
    expect(screen.getByText('预览加载中，请稍等…')).toBeInTheDocument();
    expect(screen.getByTitle('现场资料示例 文档预览')).toHaveAttribute(
      'src',
      'https://example.com/live-note-preview.pdf'
    );
  });

  it('hides the loading placeholder after the preview frame reports ready', async () => {
    window.history.replaceState(
      null,
      '',
      '/download/preview/%E7%8E%B0%E5%9C%BA%E8%B5%84%E6%96%99%E7%A4%BA%E4%BE%8B'
    );

    render(<DownloadPage />);

    const iframe = await screen.findByTitle('现场资料示例 文档预览');
    fireEvent.load(iframe);

    expect(screen.queryByText('预览加载中，请稍等…')).not.toBeInTheDocument();
    expect(screen.queryByText('预览加载较慢时，可直接打开原件。')).not.toBeInTheDocument();
  });
});

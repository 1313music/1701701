import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ResourcesPage from './ResourcesPage.jsx';

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

describe('ResourcesPage', () => {
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
                title: '现场音频',
                url: 'https://example.com/live.mp3'
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
    window.history.replaceState(null, '', '/resources');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
    window.history.replaceState(null, '', '/');
  });

  it('renders only resource documents', async () => {
    render(<ResourcesPage />);

    expect(await screen.findByText('李志自传')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '文档', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '全部文档', level: 2 })).toBeInTheDocument();
    expect(screen.queryByText('现场音频')).not.toBeInTheDocument();
  });

  it('links resource previews to internal resource preview routes', async () => {
    render(<ResourcesPage />);

    expect(await screen.findByRole('link', { name: '预览' })).toHaveAttribute(
      'href',
      '/resources/preview/%E6%9D%8E%E5%BF%97%E8%87%AA%E4%BC%A0'
    );
  });

  it('uses an original link action when sourceUrl is configured', async () => {
    loadDownloadSections.mockResolvedValueOnce([
      {
        title: '其他资源',
        groups: [
          {
            title: '资源下载',
            items: [
              {
                title: '李志与情感',
                url: 'https://www.douban.com/topic/480367002/',
                sourceUrl: 'https://www.douban.com/topic/480367002/',
                actionLabel: '原文'
              }
            ]
          }
        ]
      }
    ]);

    render(<ResourcesPage />);

    expect(await screen.findByText('李志与情感')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '原文' })).toHaveAttribute(
      'href',
      'https://www.douban.com/topic/480367002/'
    );
    expect(screen.queryByRole('link', { name: '预览' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '下载' })).not.toBeInTheDocument();
  });

  it('renders the standalone resource preview page', async () => {
    window.history.replaceState(
      null,
      '',
      '/resources/preview/%E6%9D%8E%E5%BF%97%E8%87%AA%E4%BC%A0'
    );

    render(<ResourcesPage />);

    expect(await screen.findByRole('heading', { name: '李志自传' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '返回文档页' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '打开原件' })).toHaveAttribute(
      'href',
      'https://mozilla.github.io/pdf.js/web/viewer.html?file=https%3A%2F%2Fexample.com%2Flizhi-biography.pdf'
    );
    fireEvent.click(screen.getByRole('button', { name: '复制预览链接' }));
    await waitFor(() => {
      expect(copyTextToClipboard).toHaveBeenCalledWith(
        'https://1701701.xyz/resources/preview/%E6%9D%8E%E5%BF%97%E8%87%AA%E4%BC%A0'
      );
    });
    expect(screen.getByRole('button', { name: '复制预览链接' })).toHaveTextContent('链接已复制');
    expect(screen.getByTitle('李志自传 文档预览')).toHaveAttribute(
      'src',
      `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent('https://example.com/lizhi-biography.pdf')}`
    );
  });

  it('hides the loading placeholder after the preview frame reports ready', async () => {
    window.history.replaceState(
      null,
      '',
      '/resources/preview/%E6%9D%8E%E5%BF%97%E8%87%AA%E4%BC%A0'
    );

    render(<ResourcesPage />);

    const iframe = await screen.findByTitle('李志自传 文档预览');
    fireEvent.load(iframe);

    expect(screen.queryByText('预览加载中，请稍等…')).not.toBeInTheDocument();
    expect(screen.queryByText('预览加载较慢时，可直接打开原件。')).not.toBeInTheDocument();
  });
});

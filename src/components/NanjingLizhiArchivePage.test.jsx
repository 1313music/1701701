import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import NanjingLizhiArchivePage from './NanjingLizhiArchivePage.jsx';

const manifest = {
  target: 'nanjinglizhi.cn',
  snapshots: [
    {
      timestamp: '20130607181829',
      capturedAt: '2013-06-07T18:18:29Z',
      label: '2013-06-07',
      original: 'http://www.nanjinglizhi.cn:80/',
      digest: 'VCXZYQF3A7N43BB5OYDQS6FSYJAU452Q',
      sitePath: '/archives/nanjinglizhi/snapshots/20130607181829/index.html',
      sourceSitePath: '/archives/nanjinglizhi/snapshots/20130607181829/source.html',
      waybackUrl: 'https://web.archive.org/web/20130607181829/http://www.nanjinglizhi.cn:80/'
    },
    {
      timestamp: '20180421034504',
      capturedAt: '2018-04-21T03:45:04Z',
      label: '2018-04-21 - requested snapshot',
      original: 'http://www.nanjinglizhi.cn:80/',
      digest: 'KNO4SC3COIJ64MJK3DJXGBLHTYPLA3TP',
      sitePath: '/archives/nanjinglizhi/snapshots/20180421034504/index.html',
      sourceSitePath: '/archives/nanjinglizhi/snapshots/20180421034504/source.html',
      waybackUrl: 'https://web.archive.org/web/20180421034504/http://www.nanjinglizhi.cn:80/'
    }
  ]
};

const lizhizhuangbiManifest = {
  target: 'lizhizhuangbi.com',
  snapshots: [
    {
      timestamp: '20110715023458',
      capturedAt: '2011-07-15T02:34:58Z',
      label: '2011-07-15 - requested snapshot',
      original: 'http://www.lizhizhuangbi.com:80/',
      digest: '2ZHZORFKNZ2GIB67IG4RGGKN6M5FHBT4',
      sitePath: '/archives/lizhizhuangbi/snapshots/20110715023458/index.html',
      sourceSitePath: '/archives/lizhizhuangbi/snapshots/20110715023458/source.html',
      waybackUrl: 'https://web.archive.org/web/20110715023458/http://www.lizhizhuangbi.com:80/'
    }
  ]
};

const lizhizhuangbiBlogManifest = {
  target: 'lizhizhuangbi.com/blog',
  displayMode: 'catalog',
  unitLabel: '历史页面',
  snapshots: [
    {
      id: '20120226030910-www-lizhizhuangbi-com-80-blog-p-321',
      timestamp: '20120226030910',
      capturedAt: '2012-02-26T03:09:10Z',
      label: '2012-02-26',
      title: '李志招聘兼职法律顾问',
      pageType: 'post',
      pageTypeLabel: '文章',
      original: 'http://www.lizhizhuangbi.com:80/blog/?p=321',
      sitePath: '/archives/lizhizhuangbi-blog/pages/20120226030910-www-lizhizhuangbi-com-80-blog-p-321/index.html',
      sourceSitePath: '/archives/lizhizhuangbi-blog/pages/20120226030910-www-lizhizhuangbi-com-80-blog-p-321/source.html',
      waybackUrl: 'https://web.archive.org/web/20120226030910/http://www.lizhizhuangbi.com:80/blog/?p=321'
    }
  ]
};

describe('NanjingLizhiArchivePage', () => {
  const originalFetch = globalThis.fetch;

  const mockFetch = ({ showBlogArchive = false } = {}) => {
    globalThis.fetch = vi.fn(async (url) => ({
      ok: true,
      json: async () => {
        const urlText = String(url);
        if (urlText.endsWith('/archive-config.json')) {
          return { showBlogArchive };
        }
        if (urlText.includes('lizhizhuangbi-blog')) {
          return lizhizhuangbiBlogManifest;
        }
        if (urlText.includes('lizhizhuangbi')) {
          return lizhizhuangbiManifest;
        }
        return manifest;
      }
    }));
  };

  beforeEach(() => {
    mockFetch();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it('loads the earlier official site domain first', async () => {
    render(<NanjingLizhiArchivePage />);

    expect(await screen.findByRole('button', { name: '查看 2011-07-15 快照' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '旧官网档案馆' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'lizhizhuangbi.com',
      'nanjinglizhi.cn'
    ]);
    expect(screen.getByRole('tab', { name: 'lizhizhuangbi.com' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'nanjinglizhi.cn' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.queryByRole('tab', { name: 'lizhizhuangbi.com/blog' })).not.toBeInTheDocument();
    expect(screen.queryByText('指定快照')).not.toBeInTheDocument();
    expect(screen.getByTitle('lizhizhuangbi.com 2011-07-15 存档')).toHaveAttribute(
      'src',
      '/archives/lizhizhuangbi/snapshots/20110715023458/index.html'
    );
    expect(screen.getByTitle('lizhizhuangbi.com 2011-07-15 存档')).toHaveAttribute('scrolling', 'no');
    expect(screen.queryByRole('link', { name: '原始快照' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '原始 HTML' })).not.toBeInTheDocument();
    expect(screen.queryByText('当前快照')).not.toBeInTheDocument();
    expect(screen.queryByText('时间线')).not.toBeInTheDocument();
    expect(screen.queryByText('内容摘要')).not.toBeInTheDocument();
    expect(screen.queryByText('本地路径')).not.toBeInTheDocument();
  });

  it('switches between saved old official site domains', async () => {
    render(<NanjingLizhiArchivePage />);

    expect(await screen.findByRole('button', { name: '查看 2011-07-15 快照' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'nanjinglizhi.cn' }));

    expect(await screen.findByRole('button', { name: '查看 2013-06-07 快照' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'nanjinglizhi.cn' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTitle('nanjinglizhi.cn 2013-06-07 存档')).toHaveAttribute(
      'src',
      '/archives/nanjinglizhi/snapshots/20130607181829/index.html'
    );
    expect(globalThis.fetch).toHaveBeenCalledWith('/archives/nanjinglizhi/manifest.json', { cache: 'no-cache' });

    fireEvent.click(screen.getByRole('button', { name: '查看 2018-04-21 快照' }));

    await waitFor(() => {
      expect(screen.getByTitle('nanjinglizhi.cn 2018-04-21 存档')).toHaveAttribute(
        'src',
        '/archives/nanjinglizhi/snapshots/20180421034504/index.html'
      );
    });
  });

  it('shows the blog archive only when the runtime switch is enabled', async () => {
    mockFetch({ showBlogArchive: true });

    render(<NanjingLizhiArchivePage />);

    const blogTab = await screen.findByRole('tab', { name: 'lizhizhuangbi.com/blog' });
    fireEvent.click(blogTab);

    expect(await screen.findByLabelText('选择档案页面')).toBeInTheDocument();
    expect(screen.getByTitle('lizhizhuangbi.com/blog 2012-02-26 存档')).toHaveAttribute(
      'src',
      '/archives/lizhizhuangbi-blog/pages/20120226030910-www-lizhizhuangbi-com-80-blog-p-321/index.html'
    );
    expect(globalThis.fetch).toHaveBeenCalledWith('/archive-config.json', {
      cache: 'no-store',
      signal: expect.any(AbortSignal)
    });
  });
});

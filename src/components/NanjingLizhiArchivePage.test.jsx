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

describe('NanjingLizhiArchivePage', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn(async (url) => ({
      ok: true,
      json: async () => (String(url).includes('lizhizhuangbi') ? lizhizhuangbiManifest : manifest)
    }));
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it('loads the archive manifest and switches the selected snapshot', async () => {
    render(<NanjingLizhiArchivePage />);

    expect(await screen.findByRole('button', { name: '查看 2013-06-07 快照' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '旧官网档案馆' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'nanjinglizhi.cn' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'lizhizhuangbi.com' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.queryByText('指定快照')).not.toBeInTheDocument();
    expect(screen.getByTitle('nanjinglizhi.cn 2013-06-07 存档')).toHaveAttribute(
      'src',
      '/archives/nanjinglizhi/snapshots/20130607181829/index.html'
    );

    fireEvent.click(screen.getByRole('button', { name: '查看 2018-04-21 快照' }));

    await waitFor(() => {
      expect(screen.getByTitle('nanjinglizhi.cn 2018-04-21 存档')).toHaveAttribute(
        'src',
        '/archives/nanjinglizhi/snapshots/20180421034504/index.html'
      );
    });
    expect(screen.getByTitle('nanjinglizhi.cn 2018-04-21 存档')).toHaveAttribute('scrolling', 'no');
    expect(screen.queryByRole('link', { name: 'Wayback' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '原始 HTML' })).not.toBeInTheDocument();
    expect(screen.queryByText('当前快照')).not.toBeInTheDocument();
    expect(screen.queryByText('时间线')).not.toBeInTheDocument();
    expect(screen.queryByText('内容摘要')).not.toBeInTheDocument();
    expect(screen.queryByText('本地路径')).not.toBeInTheDocument();
  });

  it('switches between saved old official site domains', async () => {
    render(<NanjingLizhiArchivePage />);

    expect(await screen.findByRole('button', { name: '查看 2013-06-07 快照' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'lizhizhuangbi.com' }));

    expect(await screen.findByRole('button', { name: '查看 2011-07-15 快照' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'lizhizhuangbi.com' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTitle('lizhizhuangbi.com 2011-07-15 存档')).toHaveAttribute(
      'src',
      '/archives/lizhizhuangbi/snapshots/20110715023458/index.html'
    );
    expect(globalThis.fetch).toHaveBeenCalledWith('/archives/lizhizhuangbi/manifest.json', { cache: 'no-cache' });
  });
});

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import AboutPage from './AboutPage.jsx';
import { copyTextToClipboard } from '../utils/appDomUtils.js';

vi.mock('../utils/appDomUtils.js', () => ({
  copyTextToClipboard: vi.fn(async () => true)
}));

describe('AboutPage', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows official account QR codes inline without a modal entry', () => {
    render(<AboutPage />);

    expect(screen.getByText('支持正版：')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '官方专辑购买渠道' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '官方专辑' })).not.toBeInTheDocument();
    expect(screen.getByText('相关资料：')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '文档' })).toHaveAttribute('href', '/resources');
    expect(screen.getByRole('link', { name: '旧官网档案馆' })).toHaveAttribute('href', '/archive');
    expect(screen.queryByText('支持本站')).not.toBeInTheDocument();
    expect(screen.queryByText('扫码支持')).not.toBeInTheDocument();
    expect(screen.queryByAltText('支持本站二维码')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '公众号' })).toBeInTheDocument();
    expect(screen.getByAltText('共享云音乐公众号二维码')).toHaveAttribute(
      'src',
      'https://p1.music.126.net/DS_fxjI4TFZymft2hcnhKA==/109951173460969360.jpg'
    );
    expect(screen.getByAltText('民谣俱乐部公众号二维码')).toHaveAttribute(
      'src',
      'https://p1.music.126.net/tDzmXS4sGZDEJx4HKLqPww==/109951173460972219.jpg'
    );
    expect(screen.queryByRole('button', { name: /公众号.*共享云音乐/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '关闭' })).not.toBeInTheDocument();
  });

  it('opens the external purchase confirmation from the low-key official album link', () => {
    render(<AboutPage />);

    fireEvent.click(screen.getByRole('button', { name: '官方专辑购买渠道' }));

    expect(screen.getByRole('heading', { name: '即将前往 tower.jp' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '确认跳转' })).toBeInTheDocument();
  });

  it('copies an official account name from the inline QR section', async () => {
    render(<AboutPage />);

    fireEvent.click(screen.getByRole('button', { name: '复制共享云音乐名称' }));

    await waitFor(() => {
      expect(copyTextToClipboard).toHaveBeenCalledWith('共享云音乐');
    });
    expect(screen.getByRole('button', { name: '复制共享云音乐名称' })).toHaveTextContent('已复制');
  });
});

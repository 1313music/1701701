import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import SupportPage from './SupportPage.jsx';

describe('SupportPage', () => {
  it('renders the standalone support QR page', () => {
    render(<SupportPage />);

    expect(screen.getByRole('heading', { name: '1701701.xyz', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('一方音乐自留地 · 你的每一次停留，皆是动力。')).toBeInTheDocument();
    expect(screen.getByText('因乐相逢')).toBeInTheDocument();
    expect(screen.getByText('自由分享')).toBeInTheDocument();
    expect(screen.getByText('行路有光')).toBeInTheDocument();
    expect(screen.getByText('赞赏支持')).toBeInTheDocument();
    expect(screen.getByText('金额自由，全凭心意。')).toBeInTheDocument();
    expect(screen.getByText('静默相伴，已是共鸣。')).toBeInTheDocument();
    expect(screen.getByText('免费支持')).toBeInTheDocument();
    expect(screen.getByText('顺手观看一段短视频。')).toBeInTheDocument();
    expect(screen.getByText('无需破费，亦是微小而重要的微光。')).toBeInTheDocument();
    expect(screen.getByText('微信赞赏')).toBeInTheDocument();
    expect(screen.getByText('观看广告')).toBeInTheDocument();
    expect(screen.getByAltText('微信赞赏码')).toHaveAttribute(
      'src',
      'https://p1.music.126.net/ifGbpzmPVmB_S5ikLD9GZA==/109951173466867867.jpg'
    );
    expect(screen.getByAltText('免费支持二维码')).toHaveAttribute(
      'src',
      'https://p1.music.126.net/2okpfR3EE8OJdP9MKcwuVg==/109951173468389389.jpg'
    );
    expect(screen.queryByText('一个分享李志音乐&视频的网站 | 1701701.xyz')).not.toBeInTheDocument();
  });
});

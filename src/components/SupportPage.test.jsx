import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import SupportPage from './SupportPage.jsx';

describe('SupportPage', () => {
  it('renders the standalone support QR page', () => {
    render(<SupportPage />);

    expect(screen.getByRole('heading', { name: '支持 1701701.xyz', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('独立维护')).toBeInTheDocument();
    expect(screen.getByText('完全免费')).toBeInTheDocument();
    expect(screen.getByText('随缘支持')).toBeInTheDocument();
    expect(screen.getByText('免费支持')).toBeInTheDocument();
    expect(screen.getByText('微信赞赏码')).toBeInTheDocument();
    expect(screen.getByText('请喝杯冰啤酒')).toBeInTheDocument();
    expect(screen.getByText('金额自由，全凭心意。')).toBeInTheDocument();
    expect(screen.getByText('不用留言，感谢支持。')).toBeInTheDocument();
    expect(screen.getByText('免费点个赞')).toBeInTheDocument();
    expect(screen.getByText('顺手帮忙看个短视频广告。')).toBeInTheDocument();
    expect(screen.getByText('无需花费金钱，同样是很大的支持。')).toBeInTheDocument();
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

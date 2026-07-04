import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import SupportPage from './SupportPage.jsx';

describe('SupportPage', () => {
  it('renders the standalone support QR page', () => {
    render(<SupportPage />);

    expect(screen.getByRole('heading', { name: '逛累了？来跟站长碰个杯 🥂', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('全场免单')).toBeInTheDocument();
    expect(screen.getByText('免费支持')).toBeInTheDocument();
    expect(screen.getByText('请站长喝杯冰啤酒')).toBeInTheDocument();
    expect(screen.getByText('顺手给站长满上一罐冰啤酒，快乐加倍。')).toBeInTheDocument();
    expect(screen.getByText('让广告商来买单')).toBeInTheDocument();
    expect(screen.getByText('让广告商替你把这杯酒钱付了，双赢。')).toBeInTheDocument();
    expect(screen.getByText('扫码碰个杯')).toBeInTheDocument();
    expect(screen.getByText('扫码薅羊毛')).toBeInTheDocument();
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

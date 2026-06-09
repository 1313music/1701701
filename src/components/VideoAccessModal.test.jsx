import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import VideoAccessModal from './VideoAccessModal.jsx';

const renderModal = () => render(
  <VideoAccessModal
    isOpen
    onClose={vi.fn()}
    promptLines={['扫码观看广告后获取视频密码']}
    qrUrl="https://r2.1701701.xyz/QR/v.jpg"
    qrAlt="视频验证小程序二维码"
    passwordNote="如密码失效，请刷新网页或清除缓存并重新扫码获取"
    videoPassword=""
    onPasswordChange={vi.fn()}
    videoPasswordError=""
    onSubmit={vi.fn()}
    onCopyOfficialAccountName={vi.fn()}
  />
);

describe('VideoAccessModal', () => {
  it('shows the mini program password instructions and refresh note', () => {
    renderModal();

    expect(screen.getByText('扫码观看广告后获取视频密码')).toBeInTheDocument();
    expect(screen.getByText('如密码失效，请刷新网页或清除缓存并重新扫码获取')).toBeInTheDocument();
    expect(screen.getByAltText('视频验证小程序二维码')).toHaveAttribute('src', 'https://r2.1701701.xyz/QR/v.jpg');
    expect(screen.getByPlaceholderText('请输入视频密码')).toBeInTheDocument();
  });
});

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import VideoAccessModal from './VideoAccessModal.jsx';

const renderModal = () => render(
  <VideoAccessModal
    isOpen
    onClose={vi.fn()}
    officialAccountName="民谣俱乐部"
    keyword="密码"
    qrUrl="/img/qrcode.jpg"
    videoPassword=""
    onPasswordChange={vi.fn()}
    videoPasswordError=""
    onSubmit={vi.fn()}
    onCopyOfficialAccountName={vi.fn()}
  />
);

describe('VideoAccessModal', () => {
  it('shows the WeChat password instructions and refresh note', () => {
    renderModal();

    expect(screen.getByText('关注【民谣俱乐部】公众号')).toBeInTheDocument();
    expect(screen.getByText('回复【密码】获取视频密码')).toBeInTheDocument();
    expect(screen.getByText('如密码失效，请重新回复获取最新密码')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('请输入视频密码')).toBeInTheDocument();
  });
});

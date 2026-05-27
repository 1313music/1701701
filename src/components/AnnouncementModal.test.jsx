import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import AnnouncementModal from './AnnouncementModal.jsx';

describe('AnnouncementModal', () => {
  it('renders history announcements and lets users inspect one', () => {
    const handleConfirm = vi.fn();

    render(
      <AnnouncementModal
        open
        announcement={{
          id: 'current',
          title: '站点公告',
          content: '暂无新的公告。',
          contentAlign: 'center',
          imageUrl: '/img/notice.jpg',
          imageAlt: '公告配图',
          imageCaption: '公告图片说明',
          imageMaxWidth: 360,
          imageMaxHeight: 280,
          linkText: '查看关于页',
          linkUrl: '/about',
          confirmText: '我知道了'
        }}
        history={[
          {
            id: 'history-1',
            title: '历史公告一',
            content: '历史公告正文',
            updatedAt: '2026-05-18T00:00:00+08:00',
            confirmText: '关闭'
          }
        ]}
        onConfirm={handleConfirm}
      />
    );

    expect(screen.getByRole('button', { name: '历史公告' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '查看历史公告：历史公告一' })).not.toBeInTheDocument();
    expect(screen.getByText('暂无新的公告。').closest('.announcement-body')).toHaveClass('align-center');
    const image = screen.getByRole('img', { name: '公告配图' });
    expect(image).toHaveAttribute('src', '/img/notice.jpg');
    expect(image.closest('figure')?.style.getPropertyValue('--announcement-image-max-width')).toBe('360px');
    expect(image.closest('figure')?.style.getPropertyValue('--announcement-image-max-height')).toBe('280px');
    expect(screen.getByText('公告图片说明')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '历史公告' }));

    expect(screen.getByRole('heading', { name: '历史公告' })).toBeInTheDocument();
    expect(screen.queryByText('暂无新的公告。')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '查看关于页' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '收起历史' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '返回最新' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '查看历史公告：历史公告一' }));

    expect(screen.getByRole('heading', { name: '历史公告一' })).toBeInTheDocument();
    expect(screen.getByText('历史公告正文')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '返回最新' }));
    expect(screen.getByRole('heading', { name: '站点公告' })).toBeInTheDocument();
  });
});

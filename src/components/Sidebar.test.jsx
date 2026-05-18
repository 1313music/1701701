import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import Sidebar from './Sidebar.jsx';

describe('Sidebar', () => {
  it('renders announcement entry in nav and mobile topbar when active', () => {
    const handleOpenAnnouncement = vi.fn();

    render(
      <Sidebar
        view="library"
        setView={vi.fn()}
        isSidebarOpen={false}
        setIsSidebarOpen={vi.fn()}
        announcement={{ title: '站点更新公告' }}
        hasActiveAnnouncement
        isAnnouncementUnread
        onOpenAnnouncement={handleOpenAnnouncement}
      />
    );

    expect(screen.getAllByRole('button', { name: '查看公告：站点更新公告' })).toHaveLength(3);

    fireEvent.click(screen.getAllByRole('button', { name: '查看公告：站点更新公告' })[0]);
    expect(handleOpenAnnouncement).toHaveBeenCalledTimes(1);
  });

  it('does not render announcement controls when inactive', () => {
    render(
      <Sidebar
        view="library"
        setView={vi.fn()}
        isSidebarOpen={false}
        setIsSidebarOpen={vi.fn()}
        announcement={{ title: '站点更新公告' }}
        hasActiveAnnouncement={false}
      />
    );

    expect(screen.queryByRole('button', { name: '查看公告：站点更新公告' })).not.toBeInTheDocument();
  });
});

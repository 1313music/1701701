import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import Sidebar from './Sidebar.jsx';

describe('Sidebar', () => {
  it('routes navigation clicks', () => {
    const setView = vi.fn();
    render(
      <Sidebar
        view="library"
        setView={setView}
        isSidebarOpen={false}
        setIsSidebarOpen={vi.fn()}
      />
    );

    fireEvent.click(screen.getAllByRole('button', { name: '视频' })[0]);
    expect(setView).toHaveBeenCalledWith('video');
  });

  it('does not render announcement controls in navigation', () => {
    render(
      <Sidebar
        view="library"
        setView={vi.fn()}
        isSidebarOpen={false}
        setIsSidebarOpen={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: '公告' })).not.toBeInTheDocument();
  });

  it('hides the download navigation while the page switch is off', () => {
    render(
      <Sidebar
        view="library"
        setView={vi.fn()}
        isSidebarOpen={false}
        setIsSidebarOpen={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: '下载' })).not.toBeInTheDocument();
  });

  it('shows announcement trigger in the mobile topbar slot', () => {
    const handleOpenAnnouncement = vi.fn();

    render(
      <Sidebar
        view="library"
        setView={vi.fn()}
        isSidebarOpen={false}
        setIsSidebarOpen={vi.fn()}
        announcement={{ title: '站点更新公告' }}
        showAnnouncementTrigger
        isAnnouncementUnread
        onOpenAnnouncement={handleOpenAnnouncement}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '查看公告：站点更新公告' }));
    expect(handleOpenAnnouncement).toHaveBeenCalledTimes(1);
  });

  it('renders theme switching as a mobile switch', () => {
    const handleThemeToggle = vi.fn();
    const setIsSidebarOpen = vi.fn();

    render(
      <Sidebar
        view="library"
        setView={vi.fn()}
        isSidebarOpen={false}
        setIsSidebarOpen={setIsSidebarOpen}
        themePreference="light"
        onThemeToggle={handleThemeToggle}
      />
    );

    const themeSwitches = screen.getAllByRole('switch', { name: '主题：浅色，点击切换为深色' });
    const mobileThemeSwitch = themeSwitches[0];
    const desktopThemeSwitch = themeSwitches[1];

    expect(themeSwitches).toHaveLength(2);
    expect(mobileThemeSwitch).toHaveAttribute('aria-checked', 'false');
    expect(desktopThemeSwitch).toHaveAttribute('aria-checked', 'false');
    expect(screen.getAllByText('外观')).toHaveLength(2);

    fireEvent.click(mobileThemeSwitch);
    expect(handleThemeToggle).toHaveBeenCalledTimes(1);
    expect(setIsSidebarOpen).not.toHaveBeenCalled();
  });

  it('renders the theme switch from the resolved system theme', () => {
    render(
      <Sidebar
        view="library"
        setView={vi.fn()}
        isSidebarOpen={false}
        setIsSidebarOpen={vi.fn()}
        themePreference="system"
        resolvedTheme="dark"
        onThemeToggle={vi.fn()}
      />
    );

    const themeSwitches = screen.getAllByRole('switch', { name: '主题：深色，点击切换为浅色' });

    expect(themeSwitches).toHaveLength(2);
    expect(themeSwitches[0]).toHaveAttribute('aria-checked', 'true');
    expect(themeSwitches[1]).toHaveAttribute('aria-checked', 'true');
  });
});

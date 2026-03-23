import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Sidebar from './Sidebar.jsx';

const createProps = (overrides = {}) => ({
  view: 'library',
  setView: vi.fn(),
  isSidebarOpen: true,
  setIsSidebarOpen: vi.fn(),
  isSidebarCollapsed: false,
  setIsSidebarCollapsed: vi.fn(),
  themePreference: 'light',
  onThemeToggle: vi.fn(),
  ...overrides
});

describe('Sidebar', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders navigation items as keyboard-reachable buttons', () => {
    const props = createProps();
    render(<Sidebar {...props} />);

    expect(screen.getAllByRole('button', { name: '音乐' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: '视频' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: '下载' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: '图库' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'APP' })).toHaveLength(2);
  });

  it('routes nav clicks through the button controls', () => {
    const props = createProps();
    render(<Sidebar {...props} />);

    fireEvent.click(screen.getAllByRole('button', { name: '视频' })[0]);

    expect(props.setIsSidebarOpen).toHaveBeenCalledWith(false);
    expect(props.setView).toHaveBeenCalledWith('video');
  });
});

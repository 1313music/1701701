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
});

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import AnnouncementEntry from './AnnouncementEntry.jsx';

describe('AnnouncementEntry', () => {
  it('shows the current announcement and opens it on demand', () => {
    const handleOpen = vi.fn();

    render(
      <AnnouncementEntry
        announcement={{ title: '站点更新公告' }}
        visible
        unread
        onOpen={handleOpen}
      />
    );

    expect(screen.getByText('新公告')).toBeInTheDocument();
    expect(screen.getByText('站点更新公告')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '查看公告：站点更新公告' }));
    expect(handleOpen).toHaveBeenCalledTimes(1);
  });

  it('stays hidden when no active announcement is available', () => {
    const { container } = render(
      <AnnouncementEntry
        announcement={{ title: '站点更新公告' }}
        visible={false}
        unread={false}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});

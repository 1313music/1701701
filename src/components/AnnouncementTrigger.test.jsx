import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import AnnouncementTrigger from './AnnouncementTrigger.jsx';

describe('AnnouncementTrigger', () => {
  it('renders an icon trigger and opens the announcement', () => {
    const handleOpen = vi.fn();

    render(
      <AnnouncementTrigger
        announcement={{ title: '站点更新公告' }}
        visible
        unread
        onOpen={handleOpen}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '查看公告：站点更新公告' }));
    expect(handleOpen).toHaveBeenCalledTimes(1);
  });

  it('stays hidden when inactive', () => {
    const { container } = render(
      <AnnouncementTrigger
        announcement={{ title: '站点更新公告' }}
        visible={false}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders a default announcement entry without announcement data', () => {
    render(<AnnouncementTrigger visible onOpen={() => {}} />);

    expect(screen.getByRole('button', { name: '查看公告：站点公告' })).toBeInTheDocument();
  });
});

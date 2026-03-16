import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import GalleryDisplayPage from './GalleryDisplayPage.jsx';

const { loadGalleryItems, refreshGalleryItems } = vi.hoisted(() => ({
  loadGalleryItems: vi.fn(),
  refreshGalleryItems: vi.fn()
}));

vi.mock('../data/galleryManifest', () => ({
  loadGalleryItems,
  refreshGalleryItems
}));

describe('GalleryDisplayPage', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('puts all at the end and defaults to the cover category', async () => {
    loadGalleryItems.mockResolvedValue([
      { id: 'bb-1', category: 'BB', name: 'bb-1', url: 'https://example.com/bb-1.jpg', previewUrl: 'https://example.com/bb-1.jpg' },
      { id: 'cover-1', category: '封面', name: 'cover-1', url: 'https://example.com/cover-1.jpg', previewUrl: 'https://example.com/cover-1.jpg' },
      { id: 'cover-2', category: '封面', name: 'cover-2', url: 'https://example.com/cover-2.jpg', previewUrl: 'https://example.com/cover-2.jpg' },
      { id: 'kl-1', category: '吉隆坡', name: 'kl-1', url: 'https://example.com/kl-1.jpg', previewUrl: 'https://example.com/kl-1.jpg' }
    ]);

    const { container } = render(<GalleryDisplayPage />);

    await waitFor(() => {
      expect(loadGalleryItems).toHaveBeenCalledTimes(1);
    });

    const categoryBar = screen.getByLabelText('分类筛选');
    const buttons = within(categoryBar).getAllByRole('button');
    expect(buttons.map((button) => button.textContent?.replace(/\s+/g, ''))).toEqual([
      '封面2',
      '吉隆坡1',
      'BB1',
      '全部4'
    ]);
    expect(within(categoryBar).getByRole('button', { name: /封面/ })).toHaveClass('is-active');
    expect(container.querySelectorAll('.gallery-waterfall-item')).toHaveLength(2);
  });
});

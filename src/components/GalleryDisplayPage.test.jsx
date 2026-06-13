import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

const setWindowScrollMetrics = ({
  scrollTop = 0,
  clientHeight = 720,
  scrollHeight = 1440,
  clientWidth = 1180
} = {}) => {
  Object.defineProperty(window, 'innerHeight', {
    value: clientHeight,
    configurable: true
  });
  Object.defineProperty(window, 'innerWidth', {
    value: clientWidth,
    configurable: true
  });
  Object.defineProperty(window, 'scrollY', {
    value: scrollTop,
    configurable: true
  });
  Object.defineProperty(document.documentElement, 'scrollTop', {
    value: scrollTop,
    configurable: true,
    writable: true
  });
  Object.defineProperty(document.body, 'scrollTop', {
    value: scrollTop,
    configurable: true,
    writable: true
  });
  Object.defineProperty(document.documentElement, 'clientHeight', {
    value: clientHeight,
    configurable: true
  });
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    value: scrollHeight,
    configurable: true
  });
  Object.defineProperty(document.body, 'scrollHeight', {
    value: scrollHeight,
    configurable: true
  });
};

const dispatchDownwardIntent = async ({ scrollTop, scrollHeight }) => {
  setWindowScrollMetrics({ scrollTop, scrollHeight });
  window.dispatchEvent(new WheelEvent('wheel', { deltaY: 120 }));

  await act(async () => {
    await new Promise((resolve) => {
      window.setTimeout(resolve, 160);
    });
  });
};

const getWaterfallColumnSources = (container) => (
  Array.from(container.querySelectorAll('.gallery-waterfall-column')).map((column) => (
    Array.from(column.querySelectorAll('img')).map((image) => image.getAttribute('src'))
  ))
);

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

    await waitFor(() => {
      expect(container.querySelectorAll('.gallery-waterfall-item')).toHaveLength(2);
    });
  });

  it('renders the gallery in batches and only loads more after downward scroll intent', async () => {
    loadGalleryItems.mockResolvedValue(
      Array.from({ length: 56 }, (_, index) => ({
        id: `cover-${index + 1}`,
        category: '封面',
        name: `cover-${index + 1}`,
        url: `https://example.com/cover-${index + 1}.jpg`,
        previewUrl: `https://example.com/cover-${index + 1}.jpg`
      }))
    );

    setWindowScrollMetrics({
      scrollTop: 0,
      clientHeight: 720,
      scrollHeight: 680,
      clientWidth: 1180
    });

    const { container } = render(<GalleryDisplayPage />);

    await waitFor(() => {
      expect(loadGalleryItems).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(container.querySelectorAll('.gallery-waterfall-item')).toHaveLength(15);
    });

    const initialColumns = getWaterfallColumnSources(container);

    await act(async () => {
      await new Promise((resolve) => {
        window.setTimeout(resolve, 180);
      });
    });

    await waitFor(() => {
      expect(container.querySelectorAll('.gallery-waterfall-item')).toHaveLength(15);
    });

    await dispatchDownwardIntent({ scrollTop: 0, scrollHeight: 680 });

    await waitFor(() => {
      expect(container.querySelectorAll('.gallery-waterfall-item')).toHaveLength(27);
    });

    const columnsAfterFirstAppend = getWaterfallColumnSources(container);
    expect(columnsAfterFirstAppend).toHaveLength(initialColumns.length);
    initialColumns.forEach((columnItems, columnIndex) => {
      expect(columnsAfterFirstAppend[columnIndex].slice(0, columnItems.length)).toEqual(columnItems);
    });

    await act(async () => {
      await new Promise((resolve) => {
        window.setTimeout(resolve, 160);
      });
    });

    await waitFor(() => {
      expect(container.querySelectorAll('.gallery-waterfall-item')).toHaveLength(27);
    });

    await dispatchDownwardIntent({ scrollTop: 780, scrollHeight: 1480 });

    await waitFor(() => {
      expect(container.querySelectorAll('.gallery-waterfall-item')).toHaveLength(39);
    });

    await dispatchDownwardIntent({ scrollTop: 1460, scrollHeight: 2140 });

    await waitFor(() => {
      expect(container.querySelectorAll('.gallery-waterfall-item')).toHaveLength(51);
    });

    await dispatchDownwardIntent({ scrollTop: 2140, scrollHeight: 2800 });

    await waitFor(() => {
      expect(container.querySelectorAll('.gallery-waterfall-item')).toHaveLength(56);
    });

    expect(screen.getByText('已加载全部')).toBeInTheDocument();
  });

  it('opens the lightbox and navigates between images', async () => {
    loadGalleryItems.mockResolvedValue([
      { id: 'cover-a', category: '封面', name: 'cover-a', url: 'https://example.com/cover-a.jpg', previewUrl: 'https://example.com/cover-a-small.jpg' },
      { id: 'cover-b', category: '封面', name: 'cover-b', url: 'https://example.com/cover-b.jpg', previewUrl: 'https://example.com/cover-b-small.jpg' },
      { id: 'cover-c', category: '封面', name: 'cover-c', url: 'https://example.com/cover-c.jpg', previewUrl: 'https://example.com/cover-c-small.jpg' }
    ]);

    const { container } = render(<GalleryDisplayPage />);

    await waitFor(() => {
      expect(container.querySelectorAll('.gallery-waterfall-item')).toHaveLength(3);
    });

    const previewButton = container.querySelector('.gallery-waterfall-preview');
    fireEvent.click(previewButton);

    const dialog = screen.getByRole('dialog', { name: '图片预览' });
    const initialImage = within(dialog).getByRole('img');
    const initialSrc = initialImage.getAttribute('src');
    expect(within(dialog).getByText(/\d+ \/ 3/)).toBeInTheDocument();
    expect(within(dialog).queryByRole('link', { name: '查看原图' })).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: '下一张' }));

    await waitFor(() => {
      const nextImage = within(screen.getByRole('dialog', { name: '图片预览' })).getByRole('img');
      expect(nextImage.getAttribute('src')).not.toBe(initialSrc);
    });

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '图片预览' })).not.toBeInTheDocument();
    });
  });
});

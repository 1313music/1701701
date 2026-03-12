import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ImagePlus, LoaderCircle, RefreshCw } from 'lucide-react';
import '../styles/gallery.css';

const DEFAULT_INDEX_URL = String(
  import.meta.env.VITE_GALLERY_INDEX_URL || 'https://images.1701701.xyz/gallery-index.json'
).trim();

const toAbsoluteUrl = (value, fallbackBase = '') => {
  const input = String(value || '').trim();
  if (!input) return '';
  try {
    return new URL(input).toString();
  } catch {
    if (!fallbackBase) return '';
    try {
      return new URL(input, fallbackBase).toString();
    } catch {
      return '';
    }
  }
};

const parseGalleryIndexItems = (payload, fallbackBase = '') => {
  const gallery = payload?.gallery;
  if (!gallery || typeof gallery !== 'object') return [];

  const seen = new Set();
  const result = [];

  for (const [category, categoryData] of Object.entries(gallery)) {
    const images = Array.isArray(categoryData?.images) ? categoryData.images : [];
    for (const image of images) {
      const original = toAbsoluteUrl(image?.original, fallbackBase);
      if (!original || seen.has(original)) continue;
      seen.add(original);
      const preview = toAbsoluteUrl(image?.preview, fallbackBase) || original;
      const name = typeof image?.name === 'string' && image.name
        ? image.name
        : original.split('/').pop() || 'image';

      result.push({
        id: `${category}/${name}/${original}`,
        category,
        name,
        url: original,
        previewUrl: preview
      });
    }
  }

  return result.sort(
    (left, right) => left.category.localeCompare(right.category) || left.name.localeCompare(right.name)
  );
};

const shuffleItems = (input) => {
  const list = Array.isArray(input) ? [...input] : [];
  for (let i = list.length - 1; i > 0; i -= 1) {
    const randomIndex = Math.floor(Math.random() * (i + 1));
    [list[i], list[randomIndex]] = [list[randomIndex], list[i]];
  }
  return list;
};

const ALL_CATEGORY = '__all__';

const GalleryDisplayPage = () => {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORY);
  const [loadedItemIds, setLoadedItemIds] = useState(() => new Set());

  const categoryStats = useMemo(() => {
    const map = new Map();
    for (const item of items) {
      map.set(item.category, (map.get(item.category) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [items]);

  const filteredItems = useMemo(() => (
    selectedCategory === ALL_CATEGORY
      ? items
      : items.filter((item) => item.category === selectedCategory)
  ), [items, selectedCategory]);

  const categoryCount = categoryStats.length;
  const itemIdSet = useMemo(() => new Set(items.map((item) => item.id)), [items]);
  const sourceUrl = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return toAbsoluteUrl(DEFAULT_INDEX_URL, origin) || DEFAULT_INDEX_URL;
  }, []);

  const loadImages = useCallback(async () => {
    setIsLoading(true);
    setError('');

    const endpoint = sourceUrl;
    if (!endpoint) {
      setItems([]);
      setError('未配置可用的图库索引地址（VITE_GALLERY_INDEX_URL）');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(endpoint, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`图库索引请求失败（HTTP ${response.status}）`);
      }

      const payload = await response.json();
      const parsedItems = parseGalleryIndexItems(payload, endpoint);
      const randomizedItems = shuffleItems(parsedItems);
      setItems(randomizedItems);
      setSelectedCategory(ALL_CATEGORY);
    } catch (requestError) {
      setItems([]);
      setError(requestError?.message || '图库加载失败');
    } finally {
      setIsLoading(false);
    }
  }, [sourceUrl]);

  useEffect(() => {
    void loadImages();
  }, [loadImages]);

  useEffect(() => {
    if (selectedCategory === ALL_CATEGORY) return;
    const exists = categoryStats.some((category) => category.name === selectedCategory);
    if (!exists) {
      setSelectedCategory(ALL_CATEGORY);
    }
  }, [categoryStats, selectedCategory]);

  useEffect(() => {
    setLoadedItemIds((prev) => {
      let changed = false;
      const next = new Set();
      for (const id of prev) {
        if (itemIdSet.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [itemIdSet]);

  const markItemLoaded = useCallback((id) => {
    setLoadedItemIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    if (!previewUrl) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [previewUrl]);

  const lightbox = previewUrl && typeof document !== 'undefined'
    ? createPortal(
      <div className="gallery-lightbox" onClick={() => setPreviewUrl('')}>
        <div className="gallery-lightbox-backdrop" />
        <div className="gallery-lightbox-panel" onClick={(event) => event.stopPropagation()}>
          <img src={previewUrl} alt="预览图片" />
          <div className="gallery-lightbox-actions">
            <button type="button" className="gallery-btn primary" onClick={() => setPreviewUrl('')}>关闭</button>
          </div>
        </div>
      </div>,
      document.body
    )
    : null;

  return (
    <>
      <div className="gallery-page gallery-browser-page">
        {error && (
          <section className="gallery-readonly-card gallery-error-card" aria-label="图库加载错误">
            <div>{error}</div>
            <button type="button" className="gallery-btn ghost" onClick={loadImages} disabled={isLoading}>
              <RefreshCw size={16} />
              重新加载
            </button>
          </section>
        )}

        <section className="gallery-list-card" aria-label="瀑布流图库">
          <div className="gallery-list-header">
            <h2>图库展示</h2>
            <div className="gallery-list-meta">
              <span>{filteredItems.length} / {items.length} 张</span>
              <span>{categoryCount} 个分类</span>
            </div>
          </div>

          {!isLoading && categoryStats.length > 0 && (
            <div className="gallery-category-bar" aria-label="分类筛选">
              <button
                type="button"
                className={`gallery-category-btn ${selectedCategory === ALL_CATEGORY ? 'is-active' : ''}`}
                onClick={() => setSelectedCategory(ALL_CATEGORY)}
              >
                全部
                <span>{items.length}</span>
              </button>
              {categoryStats.map((category) => (
                <button
                  key={category.name}
                  type="button"
                  className={`gallery-category-btn ${selectedCategory === category.name ? 'is-active' : ''}`}
                  onClick={() => setSelectedCategory(category.name)}
                >
                  {category.name}
                  <span>{category.count}</span>
                </button>
              ))}
            </div>
          )}

          {isLoading ? (
            <div className="gallery-browser-loading">
              <LoaderCircle size={18} className="gallery-spin" />
              加载图库中...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="gallery-empty-state">
              <ImagePlus size={22} />
              {items.length === 0
                ? '暂无图片，请先更新并发布 `gallery-index.json`。'
                : `分类「${selectedCategory}」暂无图片。`}
            </div>
          ) : (
            <div className="gallery-waterfall">
              {filteredItems.map((item, index) => {
                const isLoaded = loadedItemIds.has(item.id);
                const delay = (index % 12) * 24;
                return (
                <figure
                  key={item.id}
                  className={`gallery-waterfall-item ${isLoaded ? 'is-loaded' : ''}`}
                  style={{ '--stagger-delay': `${delay}ms` }}
                >
                  <button
                    type="button"
                    className="gallery-waterfall-preview"
                    onClick={() => setPreviewUrl(item.url)}
                    title="查看图片"
                  >
                    <span className="gallery-waterfall-skeleton" aria-hidden="true" />
                    <img
                      src={item.previewUrl}
                      alt="图库图片"
                      loading="lazy"
                      className={isLoaded ? 'is-loaded' : ''}
                      onLoad={() => markItemLoaded(item.id)}
                      onError={() => markItemLoaded(item.id)}
                    />
                  </button>
                </figure>
              );
              })}
            </div>
          )}
        </section>
      </div>

      {lightbox}
    </>
  );
};

export default GalleryDisplayPage;

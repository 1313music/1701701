const DEFAULT_VIDEO_INDEX_URL = String(
  import.meta.env.VITE_VIDEO_INDEX_URL || 'https://r2.1701701.xyz/json/video-index.json'
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

const toLegacyIcon = (value) => {
  const icon = String(value || '').trim();
  if (!icon) return '#icon-video';
  if (icon.startsWith('#')) return icon;
  if (icon.startsWith('icon-')) return `#${icon}`;
  return `#icon-${icon}`;
};

const toSortedList = (input) => {
  const list = Array.isArray(input) ? input : [];
  return list
    .map((item, index) => {
      const sortOrder = Number(item?.sortOrder);
      return {
        item,
        index,
        sortOrder: Number.isFinite(sortOrder) ? sortOrder : index * 10
      };
    })
    .sort((left, right) => (
      left.sortOrder - right.sortOrder || left.index - right.index
    ))
    .map((entry) => entry.item);
};

const normalizeVideoItems = (items, videoMap, parentId) => {
  const result = [];

  toSortedList(items).forEach((item, index) => {
    if (!item || item.enabled === false) return;

    const itemType = String(item.type || '').trim().toLowerCase();
    const hasChildren = Array.isArray(item.items) && item.items.length > 0;
    const isFolder = itemType === 'folder' || item.isFolder || item.folderId || hasChildren;

    if (isFolder) {
      const folderId = String(item.id || item.folderId || `${parentId}-folder-${index + 1}`);
      const title = String(item.title || folderId).trim() || folderId;
      const thumb = String(item.thumb || '').trim();
      videoMap[folderId] = normalizeVideoItems(item.items, videoMap, folderId);
      result.push({
        id: item.id ?? folderId,
        title,
        isFolder: true,
        folderId,
        thumb
      });
      return;
    }

    const title = String(item.title || '').trim();
    const url = String(item.url || '').trim();
    if (!title || !url) return;

    result.push({
      id: item.id ?? `${parentId}-video-${index + 1}`,
      title,
      url,
      backupUrl: String(item.backupUrl || '').trim(),
      thumb: String(item.thumb || '').trim()
    });
  });

  return result;
};

const parseVideoManifest = (payload) => {
  const categories = toSortedList(payload?.categories).filter((category) => (
    category &&
    category.enabled !== false &&
    String(category.id || '').trim()
  ));
  if (categories.length === 0) return null;

  const videoCategories = [];
  const videoData = {};

  categories.forEach((category) => {
    const id = String(category.id || '').trim();
    const name = String(category.name || id).trim() || id;
    videoCategories.push({
      id,
      name,
      icon: toLegacyIcon(category.icon)
    });
    videoData[id] = normalizeVideoItems(category.items, videoData, id);
  });

  return { videoCategories, videoData };
};

const loadRemoteCatalog = async () => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const endpoint = toAbsoluteUrl(DEFAULT_VIDEO_INDEX_URL, origin) || DEFAULT_VIDEO_INDEX_URL;
  if (!endpoint) {
    throw new Error('视频清单地址为空');
  }

  const response = await fetch(endpoint, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`视频清单请求失败（HTTP ${response.status}）`);
  }

  const payload = await response.json();
  const parsed = parseVideoManifest(payload);
  if (!parsed) {
    throw new Error('视频清单格式无效');
  }
  return parsed;
};

export const loadVideoCatalog = async () => {
  return await loadRemoteCatalog();
};

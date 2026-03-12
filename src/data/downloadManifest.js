const DEFAULT_DOWNLOAD_INDEX_URL = String(
  import.meta.env.VITE_DOWNLOAD_INDEX_URL || 'https://r2.1701701.xyz/json/download-index.json'
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

const normalizeItem = (item) => {
  if (!item || item.enabled === false) return null;
  const title = String(item.title || '').trim();
  const url = String(item.url || '').trim();
  if (!title || !url) return null;

  return {
    title,
    url,
    filename: String(item.filename || '').trim() || undefined,
    previewUrl: String(item.previewUrl || '').trim() || undefined
  };
};

const normalizeGroup = (group) => {
  if (!group || group.enabled === false) return null;
  const title = String(group.title || '').trim();
  if (!title) return null;

  const items = toSortedList(group.items)
    .map((item) => normalizeItem(item))
    .filter(Boolean);
  if (items.length === 0) return null;

  return { title, items };
};

const normalizeSection = (section) => {
  if (!section || section.enabled === false) return null;
  const title = String(section.title || '').trim();
  if (!title) return null;

  const groups = toSortedList(section.groups)
    .map((group) => normalizeGroup(group))
    .filter(Boolean);
  if (groups.length === 0) return null;

  return {
    title,
    groups,
    note: section.note && typeof section.note === 'object'
      ? {
          label: String(section.note.label || '').trim(),
          href: String(section.note.href || '').trim()
        }
      : undefined
  };
};

const parseDownloadManifest = (payload) => {
  const sections = toSortedList(payload?.sections)
    .map((section) => normalizeSection(section))
    .filter(Boolean);

  return sections.length > 0 ? sections : null;
};

const loadRemoteSections = async () => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const endpoint = toAbsoluteUrl(DEFAULT_DOWNLOAD_INDEX_URL, origin) || DEFAULT_DOWNLOAD_INDEX_URL;
  if (!endpoint) {
    throw new Error('下载清单地址为空');
  }

  const response = await fetch(endpoint, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`下载清单请求失败（HTTP ${response.status}）`);
  }

  const payload = await response.json();
  const parsed = parseDownloadManifest(payload);
  if (!parsed) {
    throw new Error('下载清单格式无效');
  }
  return parsed;
};

export const loadDownloadSections = async () => {
  return await loadRemoteSections();
};


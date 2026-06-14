import { toAbsoluteUrl } from './manifestSourceUtils.js';

const DEFAULT_ANNOUNCEMENT_PATH = '/announcement.json';
const PRIMARY_ANNOUNCEMENT_URL = String(import.meta.env.VITE_ANNOUNCEMENT_URL || '').trim();
const MAX_HISTORY_ITEMS = 50;

const normalizeText = (value, fallback = '') => {
  const normalized = String(value ?? fallback).trim();
  return normalized || fallback;
};

const normalizeImageSize = (value) => {
  const size = Number.parseInt(value, 10);
  if (!Number.isFinite(size) || size <= 0) return '';
  return Math.min(Math.max(size, 80), 1600);
};

const normalizeDeliveryMode = (value) => {
  const mode = normalizeText(value).toLowerCase();
  if (['silent', 'quiet', 'dot', 'badge'].includes(mode)) return 'silent';
  return 'modal';
};

const normalizeContentAlign = (value) => (
  normalizeText(value).toLowerCase() === 'center' ? 'center' : 'left'
);

const parseAnnouncement = (payload) => {
  const source = payload?.announcement && typeof payload.announcement === 'object'
    ? payload.announcement
    : payload;

  if (!source || typeof source !== 'object') return null;

  const id = normalizeText(source.id);
  const content = normalizeText(source.content || source.message);
  if (!id || !content) return null;
  const imageUrl = normalizeText(source.imageUrl || source.image);
  const copyText = normalizeText(source.copyText || source.copyContent || source.clipboardText);

  return {
    id,
    enabled: source.enabled !== false,
    title: normalizeText(source.title, '站点公告'),
    content,
    contentAlign: normalizeContentAlign(source.contentAlign || source.textAlign),
    type: normalizeText(source.type, 'info'),
    deliveryMode: normalizeDeliveryMode(source.deliveryMode || source.notifyMode || source.notificationMode),
    force: source.force === true,
    confirmText: normalizeText(source.confirmText, '我知道了'),
    copyText,
    copyButtonText: copyText
      ? normalizeText(source.copyButtonText || source.copyLabel || source.clipboardButtonText, '复制文字')
      : normalizeText(source.copyButtonText || source.copyLabel || source.clipboardButtonText),
    imageUrl,
    imageAlt: imageUrl ? normalizeText(source.imageAlt || source.imageTitle || source.title, '公告图片') : normalizeText(source.imageAlt || source.imageTitle),
    imageCaption: imageUrl ? normalizeText(source.imageCaption || source.caption) : '',
    imageMaxWidth: normalizeImageSize(source.imageMaxWidth || source.imageWidth),
    imageMaxHeight: normalizeImageSize(source.imageMaxHeight || source.imageHeight),
    linkText: normalizeText(source.linkText),
    linkUrl: normalizeText(source.linkUrl),
    startAt: normalizeText(source.startAt),
    endAt: normalizeText(source.endAt),
    updatedAt: normalizeText(source.updatedAt),
    archivedAt: normalizeText(source.archivedAt)
  };
};

const getAnnouncementSortTime = (announcement) => {
  const values = [
    announcement?.archivedAt,
    announcement?.updatedAt,
    announcement?.startAt,
    announcement?.endAt
  ];

  for (const value of values) {
    const time = Date.parse(value);
    if (Number.isFinite(time)) return time;
  }

  return 0;
};

const parseAnnouncementHistory = (payload, currentAnnouncement) => {
  const candidates = [
    ...(Array.isArray(payload?.history) ? payload.history : []),
    ...(Array.isArray(payload?.announcements) ? payload.announcements : [])
  ];
  const seenIds = new Set(currentAnnouncement?.id ? [currentAnnouncement.id] : []);

  return candidates
    .map((item, index) => ({
      announcement: parseAnnouncement(item),
      index
    }))
    .filter(({ announcement }) => {
      if (!announcement?.id || seenIds.has(announcement.id)) return false;
      seenIds.add(announcement.id);
      return true;
    })
    .sort((left, right) => {
      const rightTime = getAnnouncementSortTime(right.announcement);
      const leftTime = getAnnouncementSortTime(left.announcement);
      if (rightTime !== leftTime) return rightTime - leftTime;
      return left.index - right.index;
    })
    .slice(0, MAX_HISTORY_ITEMS)
    .map(({ announcement }) => announcement);
};

const parseAnnouncementPayload = (payload) => {
  const announcement = parseAnnouncement(payload);
  return {
    announcement,
    history: parseAnnouncementHistory(payload, announcement)
  };
};

const fetchAnnouncementJson = async (url, signal) => {
  const response = await fetch(url, {
    cache: 'no-store',
    signal
  });

  if (!response.ok) {
    throw new Error(`公告请求失败（HTTP ${response.status}）`);
  }

  return await response.json();
};

const resolveBundledAnnouncementUrl = () => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return toAbsoluteUrl(DEFAULT_ANNOUNCEMENT_PATH, origin) || DEFAULT_ANNOUNCEMENT_PATH;
};

export const isAnnouncementActive = (announcement, now = Date.now()) => {
  if (!announcement?.enabled) return false;

  const startTime = Date.parse(announcement.startAt);
  if (Number.isFinite(startTime) && now < startTime) return false;

  const endTime = Date.parse(announcement.endAt);
  if (Number.isFinite(endTime) && now > endTime) return false;

  return true;
};

export const loadAnnouncement = async ({ signal } = {}) => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const primaryUrl = toAbsoluteUrl(PRIMARY_ANNOUNCEMENT_URL, origin) || '';
  const fallbackUrl = resolveBundledAnnouncementUrl();
  const targets = [
    primaryUrl,
    fallbackUrl
  ].filter((target, index, list) => target && list.indexOf(target) === index);

  let lastError = null;

  for (const target of targets) {
    try {
      const payload = await fetchAnnouncementJson(target, signal);
      const parsed = parseAnnouncementPayload(payload);
      return {
        ...parsed,
        resolvedUrl: target,
        usedFallback: target === fallbackUrl && target !== primaryUrl
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('公告加载失败');
};

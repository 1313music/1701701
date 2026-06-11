import { toAbsoluteUrl } from './manifestSourceUtils.js';

const DEFAULT_DANMAKU_AUTHOR = '1701701';
const DEFAULT_DANMAKU_MAXIMUM = 1000;
const DEFAULT_DANMAKU_BOTTOM = '12%';
const DEFAULT_DANMAKU_SPEED_RATE = 0.9;

const normalizeEnvText = (value) => String(value || '').trim();

const toPositiveInteger = (value, fallback, min, max) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
};

const toPositiveNumber = (value, fallback, min, max) => {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
};

const normalizeApiUrl = (value) => {
  const input = normalizeEnvText(value);
  if (!input) return '';

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const absolute = toAbsoluteUrl(input, origin);
  if (!absolute) return '';

  return absolute.endsWith('/') ? absolute : `${absolute}/`;
};

const hashString = (value) => {
  let hash = 2166136261;
  const input = String(value || '');
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

const normalizeIdSegment = (value, fallback) => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return normalized || fallback;
};

export const buildVideoDanmakuId = (activeVideo, watchCategory = '') => {
  if (!activeVideo) return '';

  const categorySegment = normalizeIdSegment(
    activeVideo._categoryId || watchCategory,
    'category'
  );
  const videoSegment = normalizeIdSegment(
    activeVideo.id || activeVideo.title,
    'video'
  );
  const source = [
    activeVideo._categoryId || watchCategory || '',
    activeVideo.id || '',
    activeVideo.title || '',
    activeVideo.url || ''
  ].join('|');

  return `video-${categorySegment}-${videoSegment}-${hashString(source)}`;
};

export const buildVideoDanmakuOptions = ({
  activeVideo,
  watchCategory = '',
  env = import.meta.env
} = {}) => {
  const api = normalizeApiUrl(env?.VITE_VIDEO_DANMAKU_API_URL);
  if (!api) return null;

  const id = buildVideoDanmakuId(activeVideo, watchCategory);
  if (!id) return null;

  return {
    id,
    api,
    user: normalizeEnvText(env?.VITE_VIDEO_DANMAKU_AUTHOR) || DEFAULT_DANMAKU_AUTHOR,
    maximum: toPositiveInteger(
      env?.VITE_VIDEO_DANMAKU_MAXIMUM,
      DEFAULT_DANMAKU_MAXIMUM,
      1,
      5000
    ),
    bottom: normalizeEnvText(env?.VITE_VIDEO_DANMAKU_BOTTOM) || DEFAULT_DANMAKU_BOTTOM,
    speedRate: toPositiveNumber(
      env?.VITE_VIDEO_DANMAKU_SPEED_RATE,
      DEFAULT_DANMAKU_SPEED_RATE,
      0.2,
      3
    )
  };
};

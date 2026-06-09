const ANNOUNCEMENT_KEY = 'current';
const DEFAULT_PUBLIC_OBJECT_KEY = 'announcement.json';
const ANNOUNCEMENT_HISTORY_LIMIT = 50;
const DEFAULT_GALLERY_BRANCH = 'main';
const DEFAULT_GALLERY_INDEX_PATH = 'public/data/images.json';
const DEFAULT_GALLERY_REPO_IMAGE_ROOT = 'public/images';
const DEFAULT_GALLERY_PUBLIC_IMAGE_ROOT = 'images';
const DEFAULT_MUSIC_INDEX_KEY = 'json/music-index.json';
const DEFAULT_MUSIC_AUDIO_ROOT = 'mp3';
const DEFAULT_MUSIC_LRC_ROOT = 'lrc';
const DEFAULT_MUSIC_COVER_ROOT = 'img/music';
const DEFAULT_VIDEO_INDEX_KEY = 'json/video-index.json';
const DEFAULT_VIDEO_ACCESS_KEY = 'json/video-access.json';
const DEFAULT_VIDEO_ACCESS_PASSWORD = 'SongSharing';
const DEFAULT_VIDEO_ACCESS_QR_URL = 'https://r2.1701701.xyz/QR/v.jpg';
const DEFAULT_DOWNLOAD_INDEX_KEY = 'json/download-index.json';
const MAX_GALLERY_IMAGES_PER_REQUEST = 12;
const MAX_GALLERY_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_MUSIC_AUDIO_FILES_PER_REQUEST = 40;
const MAX_MUSIC_AUDIO_BYTES = 100 * 1024 * 1024;
const MAX_MUSIC_LYRIC_BYTES = 1024 * 1024;
const GALLERY_ALLOWED_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.avif',
  '.heic',
  '.heif',
  '.svg',
  '.bmp',
  '.ico'
]);
const MUSIC_AUDIO_ALLOWED_EXTENSIONS = new Set([
  '.mp3',
  '.m4a',
  '.aac',
  '.wav',
  '.flac',
  '.ogg',
  '.opus',
  '.webm'
]);
const MUSIC_LYRIC_ALLOWED_EXTENSIONS = new Set(['.lrc', '.txt']);

const DEFAULT_ANNOUNCEMENT = Object.freeze({
  id: 'default-disabled',
  enabled: false,
  title: '站点公告',
  content: '当前没有启用的公告。',
  contentAlign: 'left',
  type: 'info',
  deliveryMode: 'modal',
  force: false,
  confirmText: '我知道了',
  imageUrl: '',
  imageAlt: '',
  imageCaption: '',
  imageMaxWidth: '',
  imageMaxHeight: '',
  linkText: '',
  linkUrl: '',
  startAt: '',
  endAt: '',
  updatedAt: ''
});

const DEFAULT_ANNOUNCEMENT_BUNDLE = Object.freeze({
  announcement: DEFAULT_ANNOUNCEMENT,
  history: []
});

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

const stripSlashes = (value) => normalizeText(value).replace(/^\/+|\/+$/g, '');

const removeControlChars = (value) => Array.from(value)
  .filter((character) => {
    const code = character.charCodeAt(0);
    return code >= 32 && code !== 127;
  })
  .join('');

const normalizePathSegment = (value, fallback) => {
  const segment = removeControlChars(normalizeText(value, fallback))
    .replace(/[\\/:*?"<>|#%{}^~[\]`]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+|\.+$/g, '');

  return segment || fallback;
};

const normalizeGitPath = (value, fallback) => stripSlashes(value || fallback)
  .split('/')
  .map((segment) => normalizePathSegment(segment, 'item'))
  .filter(Boolean)
  .join('/') || fallback;

const encodeGitHubPath = (path) => normalizeGitPath(path, path)
  .split('/')
  .map((segment) => encodeURIComponent(segment))
  .join('/');

const allowedType = (value) => (
  ['info', 'warning', 'success'].includes(value) ? value : 'info'
);

const timingSafeEqual = (left, right) => {
  const leftText = String(left || '');
  const rightText = String(right || '');
  if (leftText.length !== rightText.length) return false;

  let diff = 0;
  for (let index = 0; index < leftText.length; index += 1) {
    diff |= leftText.charCodeAt(index) ^ rightText.charCodeAt(index);
  }
  return diff === 0;
};

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const isAllowedOrigin = (origin, configuredOrigin) => {
  const normalizedOrigin = normalizeText(origin);
  const normalizedConfigured = normalizeText(configuredOrigin);
  if (!normalizedOrigin || !normalizedConfigured) return false;
  if (normalizedConfigured === '*') return true;
  if (!normalizedConfigured.includes('*')) return normalizedOrigin === normalizedConfigured;

  const pattern = `^${normalizedConfigured.split('*').map(escapeRegExp).join('.*')}$`;
  return new RegExp(pattern).test(normalizedOrigin);
};

const corsHeaders = (request, env) => {
  const origin = request.headers.get('Origin') || '*';
  const configured = String(env.ALLOWED_ORIGIN || '*').trim();
  const configuredOrigins = configured.split(',').map((item) => item.trim()).filter(Boolean);
  const matchedOrigin = configuredOrigins.find((item) => isAllowedOrigin(origin, item));
  const allowOrigin = configured === '*'
    ? '*'
    : matchedOrigin
      ? origin
      : configuredOrigins[0] || origin;

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: configured === '*' ? 'Accept-Encoding' : 'Origin'
  };
};

const jsonResponse = (request, env, body, init = {}) => new Response(JSON.stringify(body), {
  ...init,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...corsHeaders(request, env),
    ...(init.headers || {})
  }
});

const errorResponse = (request, env, status, message) => jsonResponse(
  request,
  env,
  { error: message },
  { status }
);

const normalizeStoredHistory = (history, currentAnnouncement) => {
  const seenIds = new Set(currentAnnouncement?.id ? [currentAnnouncement.id] : []);
  const entries = Array.isArray(history) ? history : [];

  return entries
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => {
      const imageUrl = normalizeText(entry.imageUrl || entry.image);
      return {
        ...DEFAULT_ANNOUNCEMENT,
        ...entry,
        id: normalizeText(entry.id),
        title: normalizeText(entry.title, '站点公告'),
        content: normalizeText(entry.content || entry.message),
        contentAlign: normalizeContentAlign(entry.contentAlign || entry.textAlign),
        type: allowedType(normalizeText(entry.type, 'info')),
        deliveryMode: normalizeDeliveryMode(entry.deliveryMode || entry.notifyMode || entry.notificationMode),
        confirmText: normalizeText(entry.confirmText, '我知道了'),
        imageUrl,
        imageAlt: imageUrl ? normalizeText(entry.imageAlt || entry.imageTitle || entry.title, '公告图片') : normalizeText(entry.imageAlt || entry.imageTitle),
        imageCaption: imageUrl ? normalizeText(entry.imageCaption || entry.caption) : '',
        imageMaxWidth: normalizeImageSize(entry.imageMaxWidth || entry.imageWidth),
        imageMaxHeight: normalizeImageSize(entry.imageMaxHeight || entry.imageHeight),
        linkText: normalizeText(entry.linkText),
        linkUrl: normalizeText(entry.linkUrl),
        startAt: normalizeText(entry.startAt),
        endAt: normalizeText(entry.endAt),
        updatedAt: normalizeText(entry.updatedAt),
        archivedAt: normalizeText(entry.archivedAt)
      };
    })
    .filter((entry) => {
      if (!entry.id || !entry.content || seenIds.has(entry.id)) return false;
      seenIds.add(entry.id);
      return true;
    })
    .slice(0, ANNOUNCEMENT_HISTORY_LIMIT);
};

const createDefaultAnnouncementBundle = () => ({
  announcement: { ...DEFAULT_ANNOUNCEMENT_BUNDLE.announcement },
  history: []
});

const normalizeAnnouncementBundlePayload = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return createDefaultAnnouncementBundle();
  }

  const announcementSource = payload?.announcement && typeof payload.announcement === 'object'
    ? payload.announcement
    : payload;
  const announcement = {
    ...DEFAULT_ANNOUNCEMENT,
    ...announcementSource
  };
  const history = normalizeStoredHistory(payload?.history, announcement);

  return { announcement, history };
};

const readPublicAnnouncementBundle = async (env) => {
  try {
    const object = await env.ANNOUNCEMENT_PUBLIC_BUCKET?.get(getPublicObjectKey(env));
    if (!object) return null;

    return normalizeAnnouncementBundlePayload(JSON.parse(await object.text()));
  } catch {
    return null;
  }
};

const readAnnouncementBundle = async (env) => {
  const raw = await env.ANNOUNCEMENT_KV?.get(ANNOUNCEMENT_KEY);
  if (raw) {
    try {
      return normalizeAnnouncementBundlePayload(JSON.parse(raw));
    } catch {
      // Fall through to the public object so early deployments can recover.
    }
  }

  return await readPublicAnnouncementBundle(env) || createDefaultAnnouncementBundle();
};

const normalizeAnnouncement = (payload, previousAnnouncement) => {
  const source = payload?.announcement && typeof payload.announcement === 'object'
    ? payload.announcement
    : payload;

  if (!source || typeof source !== 'object') {
    throw new Error('公告格式不正确');
  }

  const id = normalizeText(source.id);
  const content = normalizeText(source.content || source.message);
  if (!id) throw new Error('公告 id 不能为空');
  if (!content) throw new Error('公告正文不能为空');
  const imageUrl = normalizeText(source.imageUrl || source.image);

  return {
    id,
    enabled: typeof source.enabled === 'boolean'
      ? source.enabled
      : previousAnnouncement.enabled !== false,
    title: normalizeText(source.title, '站点公告'),
    content,
    contentAlign: normalizeContentAlign(source.contentAlign || source.textAlign),
    type: allowedType(normalizeText(source.type, 'info')),
    deliveryMode: normalizeDeliveryMode(source.deliveryMode || source.notifyMode || source.notificationMode),
    force: source.force === true,
    confirmText: normalizeText(source.confirmText, '我知道了'),
    imageUrl,
    imageAlt: imageUrl ? normalizeText(source.imageAlt || source.imageTitle || source.title, '公告图片') : normalizeText(source.imageAlt || source.imageTitle),
    imageCaption: imageUrl ? normalizeText(source.imageCaption || source.caption) : '',
    imageMaxWidth: normalizeImageSize(source.imageMaxWidth || source.imageWidth),
    imageMaxHeight: normalizeImageSize(source.imageMaxHeight || source.imageHeight),
    linkText: normalizeText(source.linkText),
    linkUrl: normalizeText(source.linkUrl),
    startAt: normalizeText(source.startAt),
    endAt: normalizeText(source.endAt),
    updatedAt: normalizeText(source.updatedAt, new Date().toISOString())
  };
};

const shouldArchiveAnnouncement = (previousAnnouncement, nextAnnouncement) => (
  previousAnnouncement
  && previousAnnouncement.id
  && previousAnnouncement.content
  && previousAnnouncement.id !== DEFAULT_ANNOUNCEMENT.id
  && previousAnnouncement.id !== nextAnnouncement.id
);

const buildAnnouncementBundle = (previousBundle, announcement) => {
  const archivedAt = new Date().toISOString();
  const previousAnnouncement = previousBundle?.announcement || DEFAULT_ANNOUNCEMENT;
  const history = normalizeStoredHistory(previousBundle?.history, announcement);

  if (shouldArchiveAnnouncement(previousAnnouncement, announcement)) {
    history.unshift({
      ...previousAnnouncement,
      archivedAt: previousAnnouncement.archivedAt || archivedAt
    });
  }

  return {
    announcement,
    history: normalizeStoredHistory(history, announcement)
  };
};

const removeAnnouncementHistoryItem = (previousBundle, historyId) => {
  const id = normalizeText(historyId);
  if (!id) {
    const error = new Error('历史公告 id 不能为空');
    error.status = 400;
    throw error;
  }

  const announcement = previousBundle?.announcement || DEFAULT_ANNOUNCEMENT;
  const history = normalizeStoredHistory(previousBundle?.history, announcement);
  const nextHistory = history.filter((item) => item.id !== id);
  if (nextHistory.length === history.length) {
    const error = new Error('没有找到这条历史公告');
    error.status = 404;
    throw error;
  }

  return {
    announcement,
    history: nextHistory
  };
};

const buildPublicAnnouncementPayload = ({ announcement, history }) => ({
  ...announcement,
  announcement,
  history
});

const getPublicObjectKey = (env) => normalizeText(
  env.PUBLIC_OBJECT_KEY,
  DEFAULT_PUBLIC_OBJECT_KEY
).replace(/^\/+/, '') || DEFAULT_PUBLIC_OBJECT_KEY;

const publishPublicAnnouncement = async (env, bundle) => {
  if (!env.ANNOUNCEMENT_PUBLIC_BUCKET) return null;

  const key = getPublicObjectKey(env);
  await env.ANNOUNCEMENT_PUBLIC_BUCKET.put(key, JSON.stringify(buildPublicAnnouncementPayload(bundle), null, 2), {
    httpMetadata: {
      contentType: 'application/json; charset=utf-8',
      cacheControl: 'public, max-age=60'
    }
  });

  const publicBaseUrl = normalizeText(env.PUBLIC_ANNOUNCEMENT_BASE_URL);
  if (!publicBaseUrl) return { key };

  return {
    key,
    url: `${publicBaseUrl.replace(/\/+$/, '')}/${key}`
  };
};

const isAuthorized = (request, env) => {
  const expectedToken = String(env.ADMIN_TOKEN || '').trim();
  if (!expectedToken) return false;

  const header = request.headers.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  return timingSafeEqual(token, expectedToken);
};

const getGalleryConfig = (env) => ({
  token: normalizeText(env.GALLERY_GITHUB_TOKEN || env.GITHUB_TOKEN),
  owner: normalizeText(env.GALLERY_GITHUB_OWNER),
  repo: normalizeText(env.GALLERY_GITHUB_REPO),
  branch: normalizeText(env.GALLERY_GITHUB_BRANCH, DEFAULT_GALLERY_BRANCH),
  indexPath: normalizeGitPath(
    env.GALLERY_REPO_INDEX_PATH || env.GALLERY_INDEX_PATH,
    DEFAULT_GALLERY_INDEX_PATH
  ),
  repoImageRoot: normalizeGitPath(
    env.GALLERY_REPO_IMAGE_ROOT,
    DEFAULT_GALLERY_REPO_IMAGE_ROOT
  ),
  publicImageRoot: normalizeGitPath(
    env.GALLERY_PUBLIC_IMAGE_ROOT || env.GALLERY_IMAGE_ROOT,
    DEFAULT_GALLERY_PUBLIC_IMAGE_ROOT
  ),
  publicBaseUrl: normalizeText(env.GALLERY_PUBLIC_BASE_URL),
  committerName: normalizeText(env.GITHUB_COMMITTER_NAME, '1701701 Admin'),
  committerEmail: normalizeText(env.GITHUB_COMMITTER_EMAIL, 'admin@1701701.xyz')
});

const getMusicConfig = (env) => ({
  bucket: env.MUSIC_PUBLIC_BUCKET || env.MUSIC_BUCKET,
  indexKey: normalizeGitPath(env.MUSIC_INDEX_KEY, DEFAULT_MUSIC_INDEX_KEY),
  audioRoot: normalizeGitPath(env.MUSIC_AUDIO_ROOT, DEFAULT_MUSIC_AUDIO_ROOT),
  lyricRoot: normalizeGitPath(env.MUSIC_LRC_ROOT || env.MUSIC_LYRIC_ROOT, DEFAULT_MUSIC_LRC_ROOT),
  coverRoot: normalizeGitPath(env.MUSIC_COVER_ROOT, DEFAULT_MUSIC_COVER_ROOT),
  publicBaseUrl: normalizeText(env.MUSIC_PUBLIC_BASE_URL || env.PUBLIC_MUSIC_BASE_URL)
});

const getVideoConfig = (env) => ({
  bucket: env.VIDEO_PUBLIC_BUCKET || env.VIDEO_BUCKET || env.MUSIC_PUBLIC_BUCKET || env.MUSIC_BUCKET,
  indexKey: normalizeGitPath(env.VIDEO_INDEX_KEY, DEFAULT_VIDEO_INDEX_KEY),
  accessKey: normalizeGitPath(env.VIDEO_ACCESS_KEY, DEFAULT_VIDEO_ACCESS_KEY),
  defaultAccessPassword: normalizeText(
    env.VIDEO_ACCESS_DEFAULT_PASSWORD || env.VITE_VIDEO_PASSWORD,
    DEFAULT_VIDEO_ACCESS_PASSWORD
  ),
  defaultAccessQrUrl: normalizeText(
    env.VIDEO_ACCESS_DEFAULT_QR_URL || env.VITE_VIDEO_ACCESS_QR_URL,
    DEFAULT_VIDEO_ACCESS_QR_URL
  ),
  publicBaseUrl: normalizeText(
    env.VIDEO_PUBLIC_BASE_URL
      || env.PUBLIC_VIDEO_BASE_URL
      || env.MUSIC_PUBLIC_BASE_URL
      || env.PUBLIC_MUSIC_BASE_URL
  )
});

const getDownloadConfig = (env) => ({
  bucket: env.DOWNLOAD_PUBLIC_BUCKET
    || env.DOWNLOAD_BUCKET
    || env.VIDEO_PUBLIC_BUCKET
    || env.VIDEO_BUCKET
    || env.MUSIC_PUBLIC_BUCKET
    || env.MUSIC_BUCKET,
  indexKey: normalizeGitPath(env.DOWNLOAD_INDEX_KEY, DEFAULT_DOWNLOAD_INDEX_KEY),
  publicBaseUrl: normalizeText(
    env.DOWNLOAD_PUBLIC_BASE_URL
      || env.PUBLIC_DOWNLOAD_BASE_URL
      || env.VIDEO_PUBLIC_BASE_URL
      || env.PUBLIC_VIDEO_BASE_URL
      || env.MUSIC_PUBLIC_BASE_URL
      || env.PUBLIC_MUSIC_BASE_URL
  )
});

const validateGalleryConfig = (config) => {
  const missing = [];
  if (!config.token) missing.push('GITHUB_TOKEN');
  if (!config.owner) missing.push('GALLERY_GITHUB_OWNER');
  if (!config.repo) missing.push('GALLERY_GITHUB_REPO');
  if (missing.length > 0) {
    throw new Error(`图库 GitHub 配置不完整：${missing.join(', ')}`);
  }
};

const validateMusicConfig = (config) => {
  if (!config.bucket) {
    throw new Error('音乐 R2 配置不完整：MUSIC_PUBLIC_BUCKET');
  }
};

const validateVideoConfig = (config) => {
  if (!config.bucket) {
    throw new Error('视频 R2 配置不完整：VIDEO_PUBLIC_BUCKET');
  }
};

const validateDownloadConfig = (config) => {
  if (!config.bucket) {
    throw new Error('下载 R2 配置不完整：DOWNLOAD_PUBLIC_BUCKET');
  }
};

const githubJson = async (config, path, init = {}) => {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
      'User-Agent': '1701701-admin-worker',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.headers || {})
    }
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // GitHub error bodies are JSON in normal cases.
  }

  if (!response.ok) {
    const detail = payload?.message ? `：${payload.message}` : '';
    const error = new Error(`GitHub 请求失败（HTTP ${response.status}）${detail}`);
    error.status = response.status;
    throw error;
  }

  return payload;
};

const githubGetOptional = async (config, path) => {
  try {
    return await githubJson(config, path);
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
};

const base64ToUtf8 = (value) => {
  const cleaned = String(value || '').replace(/\s+/g, '');
  if (!cleaned) return '';

  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder().decode(bytes);
};

const arrayBufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

const readGalleryIndex = async (config) => {
  const contentPath = encodeGitHubPath(config.indexPath);
  const payload = await githubGetOptional(
    config,
    `/repos/${config.owner}/${config.repo}/contents/${contentPath}?ref=${encodeURIComponent(config.branch)}`
  );

  if (!payload?.content) return {};

  try {
    const parsed = JSON.parse(base64ToUtf8(payload.content));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const getGalleryItemPath = (item) => normalizeText(
  item?.path
    || item?.id
    || String(item?.url || item?.original || '').replace(/^https?:\/\/[^/]+\/?/, '')
);

const flattenNestedGalleryItems = (payload) => {
  const gallery = payload?.gallery;
  if (!gallery || typeof gallery !== 'object') return [];

  const result = [];
  for (const [rawCategory, categoryData] of Object.entries(gallery)) {
    const category = normalizeText(rawCategory, '未分类');
    const images = Array.isArray(categoryData?.images) ? categoryData.images : [];
    for (const image of images) {
      const path = getGalleryItemPath(image);
      if (!path) continue;
      result.push({
        ...image,
        id: normalizeText(image?.id, path),
        category,
        name: normalizeText(image?.name, path.split('/').pop() || 'image'),
        path,
        url: normalizeText(image?.url || image?.original, `/${path}`),
        original: normalizeText(image?.original || image?.url, `/${path}`),
        preview: normalizeText(image?.preview, image?.url || image?.original || `/${path}`)
      });
    }
  }
  return result;
};

const getGalleryItems = (payload) => {
  if (Array.isArray(payload?.items)) return payload.items;
  return flattenNestedGalleryItems(payload);
};

const dedupeGalleryItems = (items) => {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const path = getGalleryItemPath(item);
    if (!path || seen.has(path)) continue;
    seen.add(path);
    result.push(item);
  }
  return result;
};

const getExtensionFromType = (type) => {
  const normalized = normalizeText(type).toLowerCase();
  if (normalized === 'image/jpeg') return '.jpg';
  if (normalized === 'image/png') return '.png';
  if (normalized === 'image/webp') return '.webp';
  if (normalized === 'image/gif') return '.gif';
  if (normalized === 'image/avif') return '.avif';
  return '';
};

const getAudioExtensionFromType = (type) => {
  const normalized = normalizeText(type).toLowerCase();
  if (normalized === 'audio/mpeg' || normalized === 'audio/mp3') return '.mp3';
  if (normalized === 'audio/mp4' || normalized === 'audio/x-m4a') return '.m4a';
  if (normalized === 'audio/aac') return '.aac';
  if (normalized === 'audio/wav' || normalized === 'audio/x-wav') return '.wav';
  if (normalized === 'audio/flac' || normalized === 'audio/x-flac') return '.flac';
  if (normalized === 'audio/ogg') return '.ogg';
  if (normalized === 'audio/opus') return '.opus';
  if (normalized === 'audio/webm') return '.webm';
  return '';
};

const getExtensionFromFilename = (filename) => {
  const match = normalizeText(filename).match(/(\.[^.]+)$/);
  return normalizeText(match?.[1]).toLowerCase();
};

const sanitizeFilename = (name, type, fallbackBase) => {
  const rawName = normalizeText(String(name || '').split(/[\\/]/).pop(), fallbackBase);
  const cleaned = normalizePathSegment(rawName, fallbackBase);
  if (/\.[a-z0-9]{2,5}$/i.test(cleaned)) return cleaned;
  return `${cleaned}${getExtensionFromType(type) || '.jpg'}`;
};

const sanitizeUploadFilename = ({
  name,
  type,
  fallbackBase,
  defaultExtension,
  extensionFromType = () => ''
}) => {
  const rawName = normalizeText(String(name || '').split(/[\\/]/).pop(), fallbackBase);
  const cleaned = normalizePathSegment(rawName, fallbackBase);
  if (/\.[a-z0-9]{2,5}$/i.test(cleaned)) return cleaned;
  return `${cleaned}${extensionFromType(type) || defaultExtension}`;
};

const splitFilename = (filename) => {
  const match = normalizeText(filename).match(/^(.*?)(\.[^.]+)?$/);
  return {
    base: normalizeText(match?.[1], 'image'),
    extension: normalizeText(match?.[2])
  };
};

const stripTrackPrefix = (value) => {
  const text = normalizeText(value);
  return text.replace(/^\d{1,3}\s*[._-]\s*/, '').trim() || text;
};

const getFileMatchKey = (filename) => stripTrackPrefix(splitFilename(filename).base).toLowerCase();

const createUniqueImagePath = ({ imageRoot, category, filename, usedPaths }) => {
  const normalizedCategory = normalizePathSegment(category, '未分类');
  const normalizedFilename = sanitizeFilename(filename, '', 'image.jpg');
  const { base, extension } = splitFilename(normalizedFilename);
  let candidate = `${imageRoot}/${normalizedCategory}/${normalizedFilename}`;
  let suffix = 2;
  while (usedPaths.has(candidate)) {
    candidate = `${imageRoot}/${normalizedCategory}/${base}-${suffix}${extension}`;
    suffix += 1;
  }
  usedPaths.add(candidate);
  return candidate;
};

const toRepoImagePath = ({ config, publicPath }) => {
  const publicRoot = `${stripSlashes(config.publicImageRoot)}/`;
  const normalizedPublicPath = normalizeGitPath(publicPath, publicPath);
  const relativeImagePath = normalizedPublicPath.startsWith(publicRoot)
    ? normalizedPublicPath.slice(publicRoot.length)
    : normalizedPublicPath;
  return `${stripSlashes(config.repoImageRoot)}/${relativeImagePath}`;
};

const isUploadedFile = (value) => (
  value
  && typeof value.arrayBuffer === 'function'
  && typeof value.name === 'string'
);

const isGalleryImageFile = isUploadedFile;

const readGalleryImageFiles = (formData) => {
  const files = [
    ...formData.getAll('images'),
    ...formData.getAll('image')
  ].filter(isGalleryImageFile);
  const names = formData.getAll('imageNames').map((name) => normalizeText(name));

  if (files.length === 0) {
    throw new Error('请选择要发布的图片');
  }
  if (files.length > MAX_GALLERY_IMAGES_PER_REQUEST) {
    throw new Error(`单次最多发布 ${MAX_GALLERY_IMAGES_PER_REQUEST} 张图片`);
  }

  return files.map((file, index) => ({
    file,
    name: names[index] || file.name
  }));
};

const validateGalleryImageFile = (file, name) => {
  const displayName = name || file.name || 'image';
  const extension = getExtensionFromFilename(displayName);
  const isAllowedExtension = GALLERY_ALLOWED_EXTENSIONS.has(extension);
  const mimeType = String(file.type || '').toLowerCase();
  const isImageMime = !mimeType || mimeType.startsWith('image/');

  if (!isAllowedExtension || !isImageMime) {
    throw new Error(`文件不是支持的图片格式：${displayName}`);
  }
  if (file.size > MAX_GALLERY_IMAGE_BYTES) {
    throw new Error(`图片超过 ${Math.round(MAX_GALLERY_IMAGE_BYTES / 1024 / 1024)}MB：${displayName}`);
  }
};

const buildPublicGalleryUrl = (config, path) => {
  const relativePath = `/${path}`;
  if (!config.publicBaseUrl) return relativePath;
  try {
    return new URL(relativePath, `${config.publicBaseUrl.replace(/\/+$/, '')}/`).toString();
  } catch {
    return relativePath;
  }
};

const buildGalleryPublish = async ({ config, formData, currentIndex }) => {
  const category = normalizePathSegment(formData.get('category'), '未分类');
  const displayName = normalizeText(formData.get('name'));
  const now = new Date().toISOString();
  const existingItems = getGalleryItems(currentIndex);
  const usedPaths = new Set(existingItems.map(getGalleryItemPath).filter(Boolean));
  const imageFiles = readGalleryImageFiles(formData);
  const imageBlobs = [];
  const newItems = [];

  for (const { file, name: originalName } of imageFiles) {
    validateGalleryImageFile(file, originalName || file.name);

    const filename = sanitizeFilename(originalName || file.name, file.type, 'image.jpg');
    const publicPath = createUniqueImagePath({
      imageRoot: config.publicImageRoot,
      category,
      filename,
      usedPaths
    });
    const repoPath = toRepoImagePath({ config, publicPath });
    const url = buildPublicGalleryUrl(config, publicPath);
    const name = imageFiles.length === 1 && displayName ? displayName : filename;

    imageBlobs.push({
      path: repoPath,
      content: arrayBufferToBase64(await file.arrayBuffer())
    });
    newItems.push({
      id: publicPath,
      category,
      name,
      path: publicPath,
      url,
      original: url,
      preview: url,
      type: normalizeText(file.type, 'image/jpeg'),
      size: file.size,
      updatedAt: now
    });
  }

  const nextItems = dedupeGalleryItems([...newItems, ...existingItems]);
  const nextIndex = {
    ...currentIndex,
    generatedAt: now,
    count: nextItems.length,
    items: nextItems
  };

  return {
    imageBlobs,
    newItems,
    nextIndex,
    commitMessage: normalizeText(
      formData.get('message'),
      `Publish gallery image${newItems.length > 1 ? 's' : ''}: ${newItems.map((item) => item.name).join(', ')}`
    ).slice(0, 180)
  };
};

const createEmptyMusicIndex = () => ({
  schemaVersion: 1,
  updatedAt: new Date().toISOString(),
  albums: []
});

const readMusicIndex = async (config) => {
  const object = await config.bucket.get(config.indexKey);
  if (!object) return createEmptyMusicIndex();

  try {
    const parsed = JSON.parse(await object.text());
    return {
      schemaVersion: 1,
      updatedAt: normalizeText(parsed?.updatedAt, new Date().toISOString()),
      albums: Array.isArray(parsed?.albums) ? parsed.albums : []
    };
  } catch {
    return createEmptyMusicIndex();
  }
};

const buildPublicMusicUrl = (config, key) => {
  const relativePath = `/${stripSlashes(key)}`;
  if (!config.publicBaseUrl) return relativePath;
  return `${config.publicBaseUrl.replace(/\/+$/, '')}${relativePath}`;
};

const extractObjectKey = (value) => {
  const source = normalizeText(value);
  if (!source) return '';
  try {
    return decodeURIComponent(new URL(source).pathname.replace(/^\/+/, ''));
  } catch {
    try {
      return decodeURIComponent(source.replace(/^\/+/, ''));
    } catch {
      return source.replace(/^\/+/, '');
    }
  }
};

const collectMusicObjectKeys = (index) => {
  const keys = new Set([DEFAULT_MUSIC_INDEX_KEY]);
  for (const album of index?.albums || []) {
    const albumCover = extractObjectKey(album?.cover);
    if (albumCover) keys.add(albumCover);
    for (const song of album?.songs || []) {
      for (const value of [song?.src, song?.lrc, song?.cover]) {
        const key = extractObjectKey(value);
        if (key) keys.add(key);
      }
    }
  }
  return keys;
};

const createUniqueObjectKey = ({ root, folder, filename, usedKeys }) => {
  const normalizedRoot = stripSlashes(root);
  const normalizedFolder = normalizePathSegment(folder, 'album');
  const normalizedFilename = normalizePathSegment(filename, 'file');
  const { base, extension } = splitFilename(normalizedFilename);
  let candidate = `${normalizedRoot}/${normalizedFolder}/${normalizedFilename}`;
  let suffix = 2;
  while (usedKeys.has(candidate)) {
    candidate = `${normalizedRoot}/${normalizedFolder}/${base}-${suffix}${extension}`;
    suffix += 1;
  }
  usedKeys.add(candidate);
  return candidate;
};

const parseOptionalInteger = (value) => {
  const text = normalizeText(value);
  if (!text) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : undefined;
};

const getMaxTrackNumber = (songs) => (Array.isArray(songs) ? songs : [])
  .reduce((max, song) => {
    const trackNumber = Number(song?.trackNumber);
    return Number.isFinite(trackNumber) && trackNumber > max ? trackNumber : max;
  }, 0);

const createUniqueSongId = ({ albumId, trackNumber, usedSongIds }) => {
  const base = `${albumId}-${String(trackNumber).padStart(2, '0')}`;
  let candidate = base;
  let suffix = 2;
  while (usedSongIds.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  usedSongIds.add(candidate);
  return candidate;
};

const readMusicAudioFiles = (formData) => {
  const files = [
    ...formData.getAll('audios'),
    ...formData.getAll('audio')
  ].filter(isUploadedFile);
  const names = formData.getAll('audioNames').map((name) => normalizeText(name));

  if (files.length > MAX_MUSIC_AUDIO_FILES_PER_REQUEST) {
    throw new Error(`单次最多发布 ${MAX_MUSIC_AUDIO_FILES_PER_REQUEST} 首歌曲`);
  }

  return files.map((file, index) => ({
    kind: 'file',
    file,
    name: names[index] || file.name
  }));
};

const readMusicLyricFiles = (formData) => {
  const files = [
    ...formData.getAll('lyrics'),
    ...formData.getAll('lyric')
  ].filter(isUploadedFile);
  const names = formData.getAll('lyricNames').map((name) => normalizeText(name));
  return files.map((file, index) => ({
    file,
    name: names[index] || file.name
  }));
};

const readMusicSongCoverFiles = (formData) => {
  const files = [
    ...formData.getAll('songCovers'),
    ...formData.getAll('songCoverImages'),
    ...formData.getAll('songCover')
  ].filter(isUploadedFile);
  const names = formData.getAll('songCoverNames').map((name) => normalizeText(name));
  return files.map((file, index) => ({
    file,
    name: names[index] || file.name
  }));
};

const getLineValues = (value) => String(value || '')
  .split(/\r?\n/)
  .map((line) => normalizeText(line))
  .filter(Boolean);

const getLineSlots = (value) => String(value || '')
  .split(/\r?\n/)
  .map((line) => normalizeText(line));

const isEmptyMusicSlot = (value) => {
  const normalized = normalizeText(value).toLowerCase();
  return !normalized || normalized === '-' || normalized === 'default' || normalized === 'album';
};

const assertHttpUrl = (value, label) => {
  try {
    const url = new URL(value);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.toString();
    }
  } catch {
    // handled below
  }
  throw new Error(`${label}不是有效的 http(s) 链接：${value}`);
};

const getFilenameFromUrl = (value, fallback = '') => {
  try {
    const url = new URL(value);
    const rawName = url.pathname.split('/').filter(Boolean).pop() || fallback;
    return decodeURIComponent(rawName);
  } catch {
    return fallback;
  }
};

const readMusicAudioUrls = (formData) => getLineValues(
  formData.get('audioUrls') || formData.get('audioUrl')
).map((url, index) => {
  const normalizedUrl = assertHttpUrl(url, '音频链接');
  return {
    kind: 'url',
    url: normalizedUrl,
    name: getFilenameFromUrl(normalizedUrl, `remote-${index + 1}`)
  };
});

const readMusicLyricUrls = (formData) => getLineValues(
  formData.get('lyricUrls') || formData.get('lyricsUrls') || formData.get('lyricUrl')
).map((url, index) => {
  const normalizedUrl = assertHttpUrl(url, '歌词链接');
  return {
    url: normalizedUrl,
    name: getFilenameFromUrl(normalizedUrl, `remote-${index + 1}.lrc`)
  };
});

const readMusicSongCoverUrls = (formData) => getLineSlots(
  formData.get('songCoverUrls') || formData.get('songCoverUrl')
).map((url, index) => {
  if (isEmptyMusicSlot(url)) return null;
  const normalizedUrl = assertHttpUrl(url, '单曲封面链接');
  return {
    url: normalizedUrl,
    name: getFilenameFromUrl(normalizedUrl, `cover-${index + 1}.jpg`)
  };
});

const readMusicCoverFile = (formData) => {
  const file = formData.get('coverImage') || formData.get('cover');
  return isUploadedFile(file) ? file : null;
};

const validateMusicAudioFile = (file, name) => {
  const displayName = name || file.name || 'audio';
  const extension = getExtensionFromFilename(displayName);
  const mimeType = String(file.type || '').toLowerCase();
  const isAllowedExtension = MUSIC_AUDIO_ALLOWED_EXTENSIONS.has(extension);
  const isAllowedMime = !mimeType
    || mimeType.startsWith('audio/')
    || mimeType === 'application/octet-stream';

  if (!isAllowedExtension || !isAllowedMime) {
    throw new Error(`文件不是支持的音频格式：${displayName}`);
  }
  if (file.size > MAX_MUSIC_AUDIO_BYTES) {
    throw new Error(`音频超过 ${Math.round(MAX_MUSIC_AUDIO_BYTES / 1024 / 1024)}MB：${displayName}`);
  }
};

const validateMusicLyricFile = (file, name) => {
  const displayName = name || file.name || 'lyric';
  const extension = getExtensionFromFilename(displayName);
  if (!MUSIC_LYRIC_ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error(`歌词文件仅支持 .lrc 或 .txt：${displayName}`);
  }
  if (file.size > MAX_MUSIC_LYRIC_BYTES) {
    throw new Error(`歌词文件超过 ${Math.round(MAX_MUSIC_LYRIC_BYTES / 1024 / 1024)}MB：${displayName}`);
  }
};

const getMusicSongNames = (formData) => String(formData.get('songNames') || '')
  .split(/\r?\n/)
  .map((line) => normalizeText(line));

const buildLyricFileLookup = (lyricFiles) => {
  const lookup = new Map();
  for (const lyricFile of lyricFiles) {
    const key = getFileMatchKey(lyricFile.name || lyricFile.file.name);
    if (key && !lookup.has(key)) lookup.set(key, lyricFile);
  }
  return lookup;
};

const buildLyricUrlLookup = (lyricUrls) => {
  const lookup = new Map();
  for (const lyricUrl of lyricUrls) {
    if (!lyricUrl) continue;
    const key = getFileMatchKey(lyricUrl.name);
    if (key && !lookup.has(key)) lookup.set(key, lyricUrl);
  }
  return lookup;
};

const buildSongCoverFileLookup = (songCoverFiles) => {
  const lookup = new Map();
  for (const songCoverFile of songCoverFiles) {
    const key = getFileMatchKey(songCoverFile.name || songCoverFile.file.name);
    if (key && !lookup.has(key)) lookup.set(key, songCoverFile);
  }
  return lookup;
};

const buildSongCoverUrlLookup = (songCoverUrls) => {
  const lookup = new Map();
  for (const songCoverUrl of songCoverUrls) {
    if (!songCoverUrl) continue;
    const key = getFileMatchKey(songCoverUrl.name);
    if (key && !lookup.has(key)) lookup.set(key, songCoverUrl);
  }
  return lookup;
};

const buildMusicPublish = ({ config, formData, currentIndex }) => {
  const rawAlbumId = normalizeText(formData.get('albumId') || formData.get('id'));
  if (!rawAlbumId) throw new Error('专辑 ID 不能为空');

  const albumId = normalizePathSegment(rawAlbumId, 'album');
  const albumName = normalizeText(formData.get('albumName') || formData.get('name'));
  const artist = normalizeText(formData.get('artist'));
  const coverUrl = normalizeText(formData.get('coverUrl'));
  const albumType = normalizeText(formData.get('type'));
  const year = parseOptionalInteger(formData.get('year'));
  const sortOrder = parseOptionalInteger(formData.get('sortOrder'));
  const requestedStartTrackNumber = parseOptionalInteger(formData.get('startTrackNumber'));
  const audioFiles = readMusicAudioFiles(formData);
  const audioUrls = readMusicAudioUrls(formData);
  const lyricFiles = readMusicLyricFiles(formData);
  const lyricUrls = readMusicLyricUrls(formData);
  const coverFile = readMusicCoverFile(formData);
  const songCoverFiles = readMusicSongCoverFiles(formData);
  const songCoverUrls = readMusicSongCoverUrls(formData);
  const songNames = getMusicSongNames(formData);
  const audioSources = [...audioFiles, ...audioUrls];
  const albums = Array.isArray(currentIndex?.albums) ? currentIndex.albums : [];
  const existingAlbumIndex = albums.findIndex((album) => String(album?.id || '') === albumId);
  const existingAlbum = existingAlbumIndex >= 0 ? albums[existingAlbumIndex] : null;

  if (audioSources.length === 0) {
    throw new Error('请选择要发布的音频文件或填写音频链接');
  }
  if (audioSources.length > MAX_MUSIC_AUDIO_FILES_PER_REQUEST) {
    throw new Error(`单次最多发布 ${MAX_MUSIC_AUDIO_FILES_PER_REQUEST} 首歌曲`);
  }

  if (!albumName && !existingAlbum) {
    throw new Error('新专辑需要填写专辑名');
  }
  if (!artist && !existingAlbum) {
    throw new Error('新专辑需要填写艺术家');
  }

  const existingSongs = Array.isArray(existingAlbum?.songs) ? existingAlbum.songs : [];
  const firstTrackNumber = requestedStartTrackNumber && requestedStartTrackNumber > 0
    ? requestedStartTrackNumber
    : getMaxTrackNumber(existingSongs) + 1 || 1;
  const albumFolder = albumName || existingAlbum?.name || albumId;
  const usedKeys = collectMusicObjectKeys(currentIndex);
  usedKeys.add(config.indexKey);
  const usedSongIds = new Set();
  for (const album of albums) {
    for (const song of album?.songs || []) {
      if (song?.id) usedSongIds.add(String(song.id));
    }
  }

  const uploads = [];
  const lyricLookup = buildLyricFileLookup(lyricFiles);
  const lyricUrlLookup = buildLyricUrlLookup(lyricUrls);
  const songCoverLookup = buildSongCoverFileLookup(songCoverFiles);
  const songCoverUrlLookup = buildSongCoverUrlLookup(songCoverUrls);
  let nextCover = coverUrl || existingAlbum?.cover || '';

  if (coverFile) {
    validateGalleryImageFile(coverFile, coverFile.name);
    const coverFilename = sanitizeUploadFilename({
      name: coverFile.name,
      type: coverFile.type,
      fallbackBase: `${albumId}.jpg`,
      defaultExtension: '.jpg',
      extensionFromType: getExtensionFromType
    });
    const coverKey = createUniqueObjectKey({
      root: config.coverRoot,
      folder: albumFolder,
      filename: coverFilename,
      usedKeys
    });
    nextCover = buildPublicMusicUrl(config, coverKey);
    uploads.push({
      key: coverKey,
      file: coverFile,
      contentType: normalizeText(coverFile.type, 'image/jpeg')
    });
  }

  const newSongs = [];
  audioSources.forEach((audioSource, index) => {
    const trackNumber = firstTrackNumber + index;
    let audioFilename = audioSource.name || `remote-${trackNumber}`;
    let songSrc = audioSource.url || '';

    if (audioSource.kind === 'file') {
      validateMusicAudioFile(audioSource.file, audioSource.name || audioSource.file.name);
      audioFilename = sanitizeUploadFilename({
        name: audioSource.name || audioSource.file.name,
        type: audioSource.file.type,
        fallbackBase: `${String(trackNumber).padStart(2, '0')}.mp3`,
        defaultExtension: '.mp3',
        extensionFromType: getAudioExtensionFromType
      });
      const audioKey = createUniqueObjectKey({
        root: config.audioRoot,
        folder: albumFolder,
        filename: audioFilename,
        usedKeys
      });
      songSrc = buildPublicMusicUrl(config, audioKey);
      uploads.push({
        key: audioKey,
        file: audioSource.file,
        contentType: normalizeText(audioSource.file.type, 'audio/mpeg')
      });
    }

    const fallbackSongName = stripTrackPrefix(splitFilename(audioFilename).base);
    const songName = songNames[index] || fallbackSongName || `Track ${trackNumber}`;
    const songId = createUniqueSongId({ albumId, trackNumber, usedSongIds });
    const lyricFile = lyricLookup.get(getFileMatchKey(audioFilename)) || lyricFiles[index];
    const linkedLyric = lyricUrlLookup.get(getFileMatchKey(audioFilename)) || lyricUrls[index];
    const songCoverFile = songCoverLookup.get(getFileMatchKey(audioFilename)) || songCoverFiles[index];
    const linkedSongCover = songCoverUrlLookup.get(getFileMatchKey(audioFilename)) || songCoverUrls[index];
    let lyricUrl = '';
    let songCoverUrl = '';

    if (lyricFile) {
      validateMusicLyricFile(lyricFile.file, lyricFile.name || lyricFile.file.name);
      const lyricFilename = sanitizeUploadFilename({
        name: lyricFile.name || lyricFile.file.name,
        type: lyricFile.file.type,
        fallbackBase: `${splitFilename(audioFilename).base}.lrc`,
        defaultExtension: '.lrc'
      });
      const lyricKey = createUniqueObjectKey({
        root: config.lyricRoot,
        folder: albumFolder,
        filename: lyricFilename,
        usedKeys
      });
      lyricUrl = buildPublicMusicUrl(config, lyricKey);
      uploads.push({
        key: lyricKey,
        file: lyricFile.file,
        contentType: 'text/plain; charset=utf-8'
      });
    } else if (linkedLyric?.url) {
      lyricUrl = linkedLyric.url;
    }

    if (songCoverFile) {
      validateGalleryImageFile(songCoverFile.file, songCoverFile.name || songCoverFile.file.name);
      const songCoverFilename = sanitizeUploadFilename({
        name: songCoverFile.name || songCoverFile.file.name,
        type: songCoverFile.file.type,
        fallbackBase: `${splitFilename(audioFilename).base}.jpg`,
        defaultExtension: '.jpg',
        extensionFromType: getExtensionFromType
      });
      const songCoverKey = createUniqueObjectKey({
        root: config.coverRoot,
        folder: albumFolder,
        filename: songCoverFilename,
        usedKeys
      });
      songCoverUrl = buildPublicMusicUrl(config, songCoverKey);
      uploads.push({
        key: songCoverKey,
        file: songCoverFile.file,
        contentType: normalizeText(songCoverFile.file.type, 'image/jpeg')
      });
    } else if (linkedSongCover?.url) {
      songCoverUrl = linkedSongCover.url;
    }

    newSongs.push({
      id: songId,
      trackNumber,
      name: songName,
      src: songSrc,
      lrc: lyricUrl,
      cover: songCoverUrl,
      enabled: true
    });
  });

  const nextAlbum = {
    id: albumId,
    name: albumName || existingAlbum?.name || albumId,
    artist: artist || existingAlbum?.artist || '',
    cover: nextCover,
    ...(year ? { year } : Number.isFinite(Number(existingAlbum?.year)) ? { year: Number(existingAlbum.year) } : {}),
    ...(albumType ? { type: albumType } : existingAlbum?.type ? { type: String(existingAlbum.type) } : {}),
    ...(Number.isFinite(sortOrder)
      ? { sortOrder }
      : Number.isFinite(Number(existingAlbum?.sortOrder))
        ? { sortOrder: Number(existingAlbum.sortOrder) }
        : { sortOrder: (albums.length + 1) * 10 }),
    enabled: existingAlbum?.enabled === false ? false : true,
    songs: [
      ...existingSongs,
      ...newSongs
    ]
  };

  const nextAlbums = existingAlbumIndex >= 0
    ? albums.map((album, index) => (index === existingAlbumIndex ? nextAlbum : album))
    : [...albums, nextAlbum];
  const now = new Date().toISOString();
  const nextIndex = {
    schemaVersion: 1,
    updatedAt: now,
    albums: nextAlbums
  };

  return {
    uploads,
    newSongs,
    nextAlbum,
    nextIndex
  };
};

const publishMusicToR2 = async ({ config, publish }) => {
  for (const upload of publish.uploads) {
    await config.bucket.put(upload.key, await upload.file.arrayBuffer(), {
      httpMetadata: {
        contentType: upload.contentType,
        cacheControl: 'public, max-age=31536000, immutable'
      }
    });
  }

  await config.bucket.put(config.indexKey, `${JSON.stringify(publish.nextIndex, null, 2)}\n`, {
    httpMetadata: {
      contentType: 'application/json; charset=utf-8',
      cacheControl: 'public, max-age=60'
    }
  });

  return {
    key: config.indexKey,
    url: buildPublicMusicUrl(config, config.indexKey)
  };
};

const createEmptyVideoIndex = () => ({
  schemaVersion: 1,
  updatedAt: new Date().toISOString(),
  categories: []
});

const readVideoIndex = async (config) => {
  const object = await config.bucket.get(config.indexKey);
  if (!object) return createEmptyVideoIndex();

  try {
    const parsed = JSON.parse(await object.text());
    return {
      schemaVersion: 1,
      updatedAt: normalizeText(parsed?.updatedAt, new Date().toISOString()),
      categories: Array.isArray(parsed?.categories) ? parsed.categories : []
    };
  } catch {
    return createEmptyVideoIndex();
  }
};

const buildPublicVideoUrl = (config, key = config.indexKey) => {
  const relativePath = `/${stripSlashes(key)}`;
  if (!config.publicBaseUrl) return relativePath;
  return `${config.publicBaseUrl.replace(/\/+$/, '')}${relativePath}`;
};

const buildPublicVideoIndexUrl = (config) => buildPublicVideoUrl(config, config.indexKey);

const normalizeVideoAccessPromptLines = (value, fallback) => {
  if (!Array.isArray(value)) return fallback;
  const lines = value
    .map((line) => normalizeText(line))
    .filter(Boolean)
    .slice(0, 3);
  return lines.length > 0 ? lines : fallback;
};

const createDefaultVideoAccessConfig = (config) => ({
  schemaVersion: 1,
  enabled: true,
  password: normalizeText(config.defaultAccessPassword, DEFAULT_VIDEO_ACCESS_PASSWORD),
  passwordVersion: 'default',
  qrUrl: normalizeText(config.defaultAccessQrUrl, DEFAULT_VIDEO_ACCESS_QR_URL),
  qrAlt: '视频验证小程序二维码',
  promptLines: [
    '扫码观看广告后获取视频密码'
  ],
  passwordNote: '如密码失效，请刷新网页或清除缓存并重新扫码获取',
  updatedAt: ''
});

const normalizeVideoAccessConfig = (payload, config) => {
  const fallback = createDefaultVideoAccessConfig(config);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return fallback;

  return {
    schemaVersion: 1,
    enabled: payload.enabled !== false,
    password: normalizeText(payload.password, fallback.password),
    passwordVersion: normalizeText(payload.passwordVersion, fallback.passwordVersion),
    qrUrl: normalizeText(payload.qrUrl || payload.qr || payload.imageUrl, fallback.qrUrl),
    qrAlt: normalizeText(payload.qrAlt, fallback.qrAlt),
    promptLines: normalizeVideoAccessPromptLines(payload.promptLines, fallback.promptLines),
    passwordNote: normalizeText(payload.passwordNote, fallback.passwordNote),
    updatedAt: normalizeText(payload.updatedAt, fallback.updatedAt)
  };
};

const readVideoAccessConfig = async (config) => {
  const object = await config.bucket.get(config.accessKey);
  if (!object) return createDefaultVideoAccessConfig(config);

  try {
    return normalizeVideoAccessConfig(JSON.parse(await object.text()), config);
  } catch {
    return createDefaultVideoAccessConfig(config);
  }
};

const createVideoAccessPasswordVersion = () => {
  const randomId = globalThis.crypto?.randomUUID?.()
    || Math.random().toString(36).slice(2);
  return `${Date.now().toString(36)}-${randomId}`;
};

const publishVideoAccessConfigToR2 = async ({ config, videoAccess }) => {
  await config.bucket.put(config.accessKey, `${JSON.stringify(videoAccess, null, 2)}\n`, {
    httpMetadata: {
      contentType: 'application/json; charset=utf-8',
      cacheControl: 'no-store'
    }
  });

  return {
    key: config.accessKey,
    url: buildPublicVideoUrl(config, config.accessKey)
  };
};

const getMaxSortOrder = (items) => (Array.isArray(items) ? items : [])
  .reduce((max, item) => {
    const sortOrder = Number(item?.sortOrder);
    return Number.isFinite(sortOrder) && sortOrder > max ? sortOrder : max;
  }, 0);

const collectVideoItemIds = (items, ids = new Set()) => {
  for (const item of items || []) {
    if (item?.id) ids.add(String(item.id));
    if (Array.isArray(item?.items)) collectVideoItemIds(item.items, ids);
  }
  return ids;
};

const createUniqueVideoItemId = ({ categoryId, title, index, usedIds }) => {
  const fallbackBase = normalizePathSegment(title, `video-${index + 1}`).toLowerCase();
  const base = `${categoryId}-${fallbackBase || `video-${index + 1}`}`;
  let candidate = base;
  let suffix = 2;
  while (usedIds.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(candidate);
  return candidate;
};

const getIndexedLineValue = (values, index) => {
  if (values[index]) return values[index];
  return values.length === 1 ? values[0] : '';
};

const inferVideoTitleFromUrl = (value, fallback) => {
  const filename = getFilenameFromUrl(value, fallback);
  const base = stripTrackPrefix(splitFilename(filename).base);
  return base || fallback;
};

const createVideoItemsFromForm = ({ formData, categoryId, targetItems }) => {
  const videoUrls = getLineValues(formData.get('videoUrls') || formData.get('url'))
    .map((url) => assertHttpUrl(url, '视频链接'));
  if (videoUrls.length === 0) {
    throw new Error('请填写视频链接');
  }

  const titles = getLineValues(formData.get('videoTitles') || formData.get('title'));
  const ids = getLineValues(formData.get('videoIds') || formData.get('id'));
  const backupUrls = getLineValues(formData.get('backupUrls') || formData.get('backupUrl'))
    .map((url) => assertHttpUrl(url, '备用链接'));
  const thumbUrls = getLineValues(formData.get('thumbUrls') || formData.get('thumbUrl'))
    .map((url) => assertHttpUrl(url, '封面链接'));
  const requestedStartSortOrder = parseOptionalInteger(formData.get('startSortOrder'));
  const firstSortOrder = Number.isFinite(requestedStartSortOrder)
    ? requestedStartSortOrder
    : getMaxSortOrder(targetItems) + 10;
  const usedIds = collectVideoItemIds(targetItems);

  return videoUrls.map((url, index) => {
    const title = titles[index] || inferVideoTitleFromUrl(url, `视频 ${index + 1}`);
    const itemId = ids[index] || createUniqueVideoItemId({
      categoryId,
      title,
      index,
      usedIds
    });
    if (ids[index]) usedIds.add(ids[index]);

    return {
      type: 'video',
      id: itemId,
      title,
      url,
      backupUrl: getIndexedLineValue(backupUrls, index),
      thumb: getIndexedLineValue(thumbUrls, index),
      sortOrder: firstSortOrder + index * 10,
      enabled: true
    };
  });
};

const buildVideoPublish = ({ config, formData, currentIndex }) => {
  const categoryId = normalizeText(formData.get('categoryId'));
  if (!categoryId) throw new Error('分类 ID 不能为空');

  const categoryName = normalizeText(formData.get('categoryName'));
  const categoryIcon = normalizeText(formData.get('categoryIcon'), 'video');
  const categorySortOrder = parseOptionalInteger(formData.get('categorySortOrder'));
  const folderId = normalizeText(formData.get('folderId'));
  const folderTitle = normalizeText(formData.get('folderTitle'));
  const folderThumb = normalizeText(formData.get('folderThumb'));
  const folderSortOrder = parseOptionalInteger(formData.get('folderSortOrder'));
  const categories = Array.isArray(currentIndex?.categories) ? currentIndex.categories : [];
  const existingCategoryIndex = categories.findIndex((category) => String(category?.id || '') === categoryId);
  const existingCategory = existingCategoryIndex >= 0 ? categories[existingCategoryIndex] : null;

  if (!categoryName && !existingCategory) {
    throw new Error('新分类需要填写分类名称');
  }

  const existingCategoryItems = Array.isArray(existingCategory?.items) ? existingCategory.items : [];
  let targetItems = existingCategoryItems;
  let nextCategoryItems = existingCategoryItems;
  let nextFolder = null;

  if (folderId || folderTitle) {
    const safeFolderId = folderId || normalizePathSegment(folderTitle, 'folder');
    const existingFolderIndex = existingCategoryItems.findIndex((item) => (
      String(item?.id || '') === safeFolderId && (item?.type === 'folder' || Array.isArray(item?.items))
    ));
    const existingFolder = existingFolderIndex >= 0 ? existingCategoryItems[existingFolderIndex] : null;
    targetItems = Array.isArray(existingFolder?.items) ? existingFolder.items : [];
    const newItems = createVideoItemsFromForm({ formData, categoryId, targetItems });
    nextFolder = {
      type: 'folder',
      id: safeFolderId,
      title: folderTitle || existingFolder?.title || safeFolderId,
      thumb: folderThumb || existingFolder?.thumb || '',
      ...(Number.isFinite(folderSortOrder)
        ? { sortOrder: folderSortOrder }
        : Number.isFinite(Number(existingFolder?.sortOrder))
          ? { sortOrder: Number(existingFolder.sortOrder) }
          : { sortOrder: getMaxSortOrder(existingCategoryItems) + 10 }),
      enabled: existingFolder?.enabled === false ? false : true,
      items: [...targetItems, ...newItems]
    };
    nextCategoryItems = existingFolderIndex >= 0
      ? existingCategoryItems.map((item, index) => (index === existingFolderIndex ? nextFolder : item))
      : [...existingCategoryItems, nextFolder];
  }

  const newItems = nextFolder
    ? nextFolder.items.slice(targetItems.length)
    : createVideoItemsFromForm({ formData, categoryId, targetItems });
  if (!nextFolder) {
    nextCategoryItems = [...existingCategoryItems, ...newItems];
  }

  const nextCategory = {
    id: categoryId,
    name: categoryName || existingCategory?.name || categoryId,
    icon: categoryIcon || existingCategory?.icon || 'video',
    ...(Number.isFinite(categorySortOrder)
      ? { sortOrder: categorySortOrder }
      : Number.isFinite(Number(existingCategory?.sortOrder))
        ? { sortOrder: Number(existingCategory.sortOrder) }
        : { sortOrder: (categories.length + 1) * 10 }),
    enabled: existingCategory?.enabled === false ? false : true,
    items: nextCategoryItems
  };

  const nextCategories = existingCategoryIndex >= 0
    ? categories.map((category, index) => (index === existingCategoryIndex ? nextCategory : category))
    : [...categories, nextCategory];
  const nextIndex = {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    categories: nextCategories
  };

  return {
    newItems,
    nextCategory,
    nextIndex,
    manifestKey: config.indexKey
  };
};

const publishVideoToR2 = async ({ config, publish }) => {
  await config.bucket.put(config.indexKey, `${JSON.stringify(publish.nextIndex, null, 2)}\n`, {
    httpMetadata: {
      contentType: 'application/json; charset=utf-8',
      cacheControl: 'public, max-age=60'
    }
  });

  return {
    key: config.indexKey,
    url: buildPublicVideoIndexUrl(config)
  };
};

const createEmptyDownloadIndex = () => ({
  schemaVersion: 1,
  updatedAt: new Date().toISOString(),
  sections: []
});

const readDownloadIndex = async (config) => {
  const object = await config.bucket.get(config.indexKey);
  if (!object) return createEmptyDownloadIndex();

  try {
    const parsed = JSON.parse(await object.text());
    return {
      schemaVersion: 1,
      updatedAt: normalizeText(parsed?.updatedAt, new Date().toISOString()),
      sections: Array.isArray(parsed?.sections) ? parsed.sections : []
    };
  } catch {
    return createEmptyDownloadIndex();
  }
};

const buildPublicDownloadIndexUrl = (config) => {
  const relativePath = `/${stripSlashes(config.indexKey)}`;
  if (!config.publicBaseUrl) return relativePath;
  return `${config.publicBaseUrl.replace(/\/+$/, '')}${relativePath}`;
};

const inferDownloadTitleFromUrl = (value, fallback) => {
  const filename = getFilenameFromUrl(value, fallback);
  const base = stripTrackPrefix(splitFilename(filename).base);
  return base || fallback;
};

const createDownloadItemsFromForm = ({ formData, targetItems }) => {
  const itemUrls = getLineValues(formData.get('itemUrls') || formData.get('downloadUrls') || formData.get('url'))
    .map((url) => assertHttpUrl(url, '下载链接'));
  if (itemUrls.length === 0) {
    throw new Error('请填写下载链接');
  }

  const titles = getLineSlots(formData.get('itemTitles') || formData.get('titles') || formData.get('title'));
  const filenames = getLineSlots(formData.get('filenames') || formData.get('filename'));
  const previewUrls = getLineSlots(formData.get('previewUrls') || formData.get('previewUrl'));
  const requestedStartSortOrder = parseOptionalInteger(formData.get('startSortOrder'));
  const firstSortOrder = Number.isFinite(requestedStartSortOrder)
    ? requestedStartSortOrder
    : getMaxSortOrder(targetItems) + 10;

  return itemUrls.map((url, index) => {
    const filename = isEmptyMusicSlot(filenames[index])
      ? getFilenameFromUrl(url, `download-${index + 1}`)
      : filenames[index];
    const previewUrl = isEmptyMusicSlot(previewUrls[index])
      ? ''
      : assertHttpUrl(previewUrls[index], '预览链接');

    return {
      title: titles[index] || inferDownloadTitleFromUrl(url, `下载 ${index + 1}`),
      url,
      filename,
      ...(previewUrl ? { previewUrl } : {}),
      sortOrder: firstSortOrder + index * 10,
      enabled: true
    };
  });
};

const buildDownloadPublish = ({ config, formData, currentIndex }) => {
  const sectionTitle = normalizeText(formData.get('sectionTitle'));
  if (!sectionTitle) throw new Error('下载栏目不能为空');

  const groupTitle = normalizeText(formData.get('groupTitle'));
  if (!groupTitle) throw new Error('下载分组不能为空');

  const sectionSortOrder = parseOptionalInteger(formData.get('sectionSortOrder'));
  const groupSortOrder = parseOptionalInteger(formData.get('groupSortOrder'));
  const sections = Array.isArray(currentIndex?.sections) ? currentIndex.sections : [];
  const existingSectionIndex = sections.findIndex((section) => String(section?.title || '') === sectionTitle);
  const existingSection = existingSectionIndex >= 0 ? sections[existingSectionIndex] : null;
  const existingGroups = Array.isArray(existingSection?.groups) ? existingSection.groups : [];
  const existingGroupIndex = existingGroups.findIndex((group) => String(group?.title || '') === groupTitle);
  const existingGroup = existingGroupIndex >= 0 ? existingGroups[existingGroupIndex] : null;
  const existingItems = Array.isArray(existingGroup?.items) ? existingGroup.items : [];
  const newItems = createDownloadItemsFromForm({ formData, targetItems: existingItems });

  const nextGroup = {
    ...(existingGroup || {}),
    title: groupTitle,
    ...(Number.isFinite(groupSortOrder)
      ? { sortOrder: groupSortOrder }
      : Number.isFinite(Number(existingGroup?.sortOrder))
        ? { sortOrder: Number(existingGroup.sortOrder) }
        : { sortOrder: getMaxSortOrder(existingGroups) + 10 }),
    enabled: existingGroup?.enabled === false ? false : true,
    items: [...existingItems, ...newItems]
  };

  const nextGroups = existingGroupIndex >= 0
    ? existingGroups.map((group, index) => (index === existingGroupIndex ? nextGroup : group))
    : [...existingGroups, nextGroup];

  const nextSection = {
    ...(existingSection || {}),
    title: sectionTitle,
    ...(Number.isFinite(sectionSortOrder)
      ? { sortOrder: sectionSortOrder }
      : Number.isFinite(Number(existingSection?.sortOrder))
        ? { sortOrder: Number(existingSection.sortOrder) }
        : { sortOrder: (sections.length + 1) * 10 }),
    enabled: existingSection?.enabled === false ? false : true,
    groups: nextGroups
  };

  const nextSections = existingSectionIndex >= 0
    ? sections.map((section, index) => (index === existingSectionIndex ? nextSection : section))
    : [...sections, nextSection];
  const nextIndex = {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    sections: nextSections
  };

  return {
    newItems,
    nextSection,
    nextGroup,
    nextIndex,
    manifestKey: config.indexKey
  };
};

const publishDownloadToR2 = async ({ config, publish }) => {
  await config.bucket.put(config.indexKey, `${JSON.stringify(publish.nextIndex, null, 2)}\n`, {
    httpMetadata: {
      contentType: 'application/json; charset=utf-8',
      cacheControl: 'public, max-age=60'
    }
  });

  return {
    key: config.indexKey,
    url: buildPublicDownloadIndexUrl(config)
  };
};

const createGithubBlob = async (config, content) => {
  const payload = await githubJson(config, `/repos/${config.owner}/${config.repo}/git/blobs`, {
    method: 'POST',
    body: JSON.stringify({
      content,
      encoding: 'base64'
    })
  });
  return payload.sha;
};

const publishGalleryToGitHub = async ({ config, publish }) => {
  const ref = await githubJson(
    config,
    `/repos/${config.owner}/${config.repo}/git/ref/heads/${encodeURIComponent(config.branch)}`
  );
  const parentSha = ref?.object?.sha;
  if (!parentSha) throw new Error('无法读取 GitHub 分支引用');

  const parentCommit = await githubJson(
    config,
    `/repos/${config.owner}/${config.repo}/git/commits/${parentSha}`
  );
  const baseTree = parentCommit?.tree?.sha;
  if (!baseTree) throw new Error('无法读取 GitHub 基础 tree');

  const imageEntries = [];
  for (const imageBlob of publish.imageBlobs) {
    imageEntries.push({
      path: imageBlob.path,
      mode: '100644',
      type: 'blob',
      sha: await createGithubBlob(config, imageBlob.content)
    });
  }

  const tree = await githubJson(config, `/repos/${config.owner}/${config.repo}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({
      base_tree: baseTree,
      tree: [
        ...imageEntries,
        {
          path: config.indexPath,
          mode: '100644',
          type: 'blob',
          content: `${JSON.stringify(publish.nextIndex, null, 2)}\n`
        }
      ]
    })
  });

  const commit = await githubJson(config, `/repos/${config.owner}/${config.repo}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({
      message: publish.commitMessage,
      tree: tree.sha,
      parents: [parentSha],
      committer: {
        name: config.committerName,
        email: config.committerEmail,
        date: new Date().toISOString()
      }
    })
  });

  await githubJson(
    config,
    `/repos/${config.owner}/${config.repo}/git/refs/heads/${encodeURIComponent(config.branch)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        sha: commit.sha,
        force: false
      })
    }
  );

  return {
    sha: commit.sha,
    url: commit.html_url || `https://github.com/${config.owner}/${config.repo}/commit/${commit.sha}`
  };
};

const handleGalleryGet = async (request, env) => {
  const config = getGalleryConfig(env);
  validateGalleryConfig(config);
  return jsonResponse(request, env, {
    gallery: await readGalleryIndex(config)
  });
};

const handleGalleryPublish = async (request, env) => {
  const config = getGalleryConfig(env);
  validateGalleryConfig(config);

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse(request, env, 400, '请求表单无效');
  }

  let publish;
  try {
    publish = await buildGalleryPublish({
      config,
      formData,
      currentIndex: await readGalleryIndex(config)
    });
  } catch (error) {
    return errorResponse(request, env, 400, error.message);
  }

  const commit = await publishGalleryToGitHub({ config, publish });
  return jsonResponse(request, env, {
    ok: true,
    items: publish.newItems,
    commit,
    indexPath: config.indexPath
  });
};

const handleMusicGet = async (request, env) => {
  const config = getMusicConfig(env);
  validateMusicConfig(config);
  return jsonResponse(request, env, {
    music: await readMusicIndex(config),
    indexKey: config.indexKey
  });
};

const handleMusicPublish = async (request, env) => {
  const config = getMusicConfig(env);
  validateMusicConfig(config);

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse(request, env, 400, '请求表单无效');
  }

  let publish;
  try {
    publish = buildMusicPublish({
      config,
      formData,
      currentIndex: await readMusicIndex(config)
    });
  } catch (error) {
    return errorResponse(request, env, 400, error.message);
  }

  const manifestTarget = await publishMusicToR2({ config, publish });
  return jsonResponse(request, env, {
    ok: true,
    album: publish.nextAlbum,
    songs: publish.newSongs,
    manifestTarget
  });
};

const handleVideoGet = async (request, env) => {
  const config = getVideoConfig(env);
  validateVideoConfig(config);
  return jsonResponse(request, env, {
    video: await readVideoIndex(config),
    indexKey: config.indexKey
  });
};

const handleVideoPublish = async (request, env) => {
  const config = getVideoConfig(env);
  validateVideoConfig(config);

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse(request, env, 400, '请求表单无效');
  }

  let publish;
  try {
    publish = buildVideoPublish({
      config,
      formData,
      currentIndex: await readVideoIndex(config)
    });
  } catch (error) {
    return errorResponse(request, env, 400, error.message);
  }

  const manifestTarget = await publishVideoToR2({ config, publish });
  return jsonResponse(request, env, {
    ok: true,
    category: publish.nextCategory,
    items: publish.newItems,
    manifestTarget
  });
};

const handleVideoAccessGet = async (request, env) => {
  const config = getVideoConfig(env);
  validateVideoConfig(config);
  return jsonResponse(request, env, {
    config: await readVideoAccessConfig(config),
    indexKey: config.accessKey
  });
};

const handleVideoAccessUpdate = async (request, env) => {
  const config = getVideoConfig(env);
  validateVideoConfig(config);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return errorResponse(request, env, 400, '请求 JSON 无效');
  }

  const currentVideoAccess = await readVideoAccessConfig(config);
  const enabled = payload?.enabled !== false;
  const password = normalizeText(payload?.password, currentVideoAccess.password);
  const qrUrl = normalizeText(payload?.qrUrl, currentVideoAccess.qrUrl);
  if (enabled && !password) {
    return errorResponse(request, env, 400, '视频访问口令不能为空');
  }

  const videoAccess = {
    schemaVersion: 1,
    enabled,
    password,
    passwordVersion: createVideoAccessPasswordVersion(),
    qrUrl,
    qrAlt: normalizeText(payload?.qrAlt, currentVideoAccess.qrAlt),
    promptLines: normalizeVideoAccessPromptLines(payload?.promptLines, currentVideoAccess.promptLines),
    passwordNote: normalizeText(payload?.passwordNote, currentVideoAccess.passwordNote),
    updatedAt: new Date().toISOString()
  };
  const publicTarget = await publishVideoAccessConfigToR2({ config, videoAccess });
  return jsonResponse(request, env, {
    ok: true,
    config: videoAccess,
    publicTarget
  });
};

const handleDownloadGet = async (request, env) => {
  const config = getDownloadConfig(env);
  validateDownloadConfig(config);
  return jsonResponse(request, env, {
    download: await readDownloadIndex(config),
    indexKey: config.indexKey
  });
};

const handleDownloadPublish = async (request, env) => {
  const config = getDownloadConfig(env);
  validateDownloadConfig(config);

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse(request, env, 400, '请求表单无效');
  }

  let publish;
  try {
    publish = buildDownloadPublish({
      config,
      formData,
      currentIndex: await readDownloadIndex(config)
    });
  } catch (error) {
    return errorResponse(request, env, 400, error.message);
  }

  const manifestTarget = await publishDownloadToR2({ config, publish });
  return jsonResponse(request, env, {
    ok: true,
    section: publish.nextSection,
    group: publish.nextGroup,
    items: publish.newItems,
    manifestTarget
  });
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request, env)
      });
    }

    if (url.pathname === '/api/announcement' && request.method === 'GET') {
      return jsonResponse(request, env, buildPublicAnnouncementPayload(await readAnnouncementBundle(env)));
    }

    if (url.pathname === '/api/admin/announcement' && request.method === 'GET') {
      if (!isAuthorized(request, env)) {
        return errorResponse(request, env, 401, '管理员口令无效');
      }

      return jsonResponse(request, env, {
        ...(await readAnnouncementBundle(env))
      });
    }

    if (url.pathname === '/api/admin/announcement' && request.method === 'PUT') {
      if (!isAuthorized(request, env)) {
        return errorResponse(request, env, 401, '管理员口令无效');
      }

      let payload;
      try {
        payload = await request.json();
      } catch {
        return errorResponse(request, env, 400, '请求 JSON 无效');
      }

      let announcement;
      let previousBundle;
      try {
        previousBundle = await readAnnouncementBundle(env);
        announcement = normalizeAnnouncement(payload, previousBundle.announcement);
      } catch (error) {
        return errorResponse(request, env, 400, error.message);
      }

      const bundle = buildAnnouncementBundle(previousBundle, announcement);
      await env.ANNOUNCEMENT_KV.put(ANNOUNCEMENT_KEY, JSON.stringify(bundle));
      const publicTarget = await publishPublicAnnouncement(env, bundle);
      return jsonResponse(request, env, {
        ok: true,
        ...bundle,
        publicTarget
      });
    }

    if (url.pathname.startsWith('/api/admin/announcement/history/') && request.method === 'DELETE') {
      if (!isAuthorized(request, env)) {
        return errorResponse(request, env, 401, '管理员口令无效');
      }

      const historyId = decodeURIComponent(url.pathname.slice('/api/admin/announcement/history/'.length));
      let bundle;
      try {
        const storedBundle = await readAnnouncementBundle(env);
        try {
          bundle = removeAnnouncementHistoryItem(storedBundle, historyId);
        } catch (error) {
          if (error.status !== 404) throw error;
          const publicBundle = await readPublicAnnouncementBundle(env);
          if (!publicBundle) throw error;
          bundle = removeAnnouncementHistoryItem({
            announcement: storedBundle.announcement || publicBundle.announcement,
            history: publicBundle.history
          }, historyId);
        }
      } catch (error) {
        return errorResponse(request, env, error.status || 400, error.message);
      }

      await env.ANNOUNCEMENT_KV.put(ANNOUNCEMENT_KEY, JSON.stringify(bundle));
      const publicTarget = await publishPublicAnnouncement(env, bundle);
      return jsonResponse(request, env, {
        ok: true,
        ...bundle,
        publicTarget
      });
    }

    if (url.pathname === '/api/admin/gallery' && request.method === 'GET') {
      if (!isAuthorized(request, env)) {
        return errorResponse(request, env, 401, '管理员口令无效');
      }

      try {
        return await handleGalleryGet(request, env);
      } catch (error) {
        return errorResponse(request, env, 500, error.message || '图库读取失败');
      }
    }

    if (url.pathname === '/api/admin/gallery' && request.method === 'POST') {
      if (!isAuthorized(request, env)) {
        return errorResponse(request, env, 401, '管理员口令无效');
      }

      try {
        return await handleGalleryPublish(request, env);
      } catch (error) {
        return errorResponse(request, env, error.status || 500, error.message || '图库发布失败');
      }
    }

    if (url.pathname === '/api/admin/music' && request.method === 'GET') {
      if (!isAuthorized(request, env)) {
        return errorResponse(request, env, 401, '管理员口令无效');
      }

      try {
        return await handleMusicGet(request, env);
      } catch (error) {
        return errorResponse(request, env, 500, error.message || '音乐清单读取失败');
      }
    }

    if (url.pathname === '/api/admin/music' && request.method === 'POST') {
      if (!isAuthorized(request, env)) {
        return errorResponse(request, env, 401, '管理员口令无效');
      }

      try {
        return await handleMusicPublish(request, env);
      } catch (error) {
        return errorResponse(request, env, error.status || 500, error.message || '音乐发布失败');
      }
    }

    if (url.pathname === '/api/admin/video' && request.method === 'GET') {
      if (!isAuthorized(request, env)) {
        return errorResponse(request, env, 401, '管理员口令无效');
      }

      try {
        return await handleVideoGet(request, env);
      } catch (error) {
        return errorResponse(request, env, 500, error.message || '视频清单读取失败');
      }
    }

    if (url.pathname === '/api/admin/video' && request.method === 'POST') {
      if (!isAuthorized(request, env)) {
        return errorResponse(request, env, 401, '管理员口令无效');
      }

      try {
        return await handleVideoPublish(request, env);
      } catch (error) {
        return errorResponse(request, env, error.status || 500, error.message || '视频发布失败');
      }
    }

    if (url.pathname === '/api/admin/video-access' && request.method === 'GET') {
      if (!isAuthorized(request, env)) {
        return errorResponse(request, env, 401, '管理员口令无效');
      }

      try {
        return await handleVideoAccessGet(request, env);
      } catch (error) {
        return errorResponse(request, env, 500, error.message || '视频口令读取失败');
      }
    }

    if (url.pathname === '/api/admin/video-access' && request.method === 'PUT') {
      if (!isAuthorized(request, env)) {
        return errorResponse(request, env, 401, '管理员口令无效');
      }

      try {
        return await handleVideoAccessUpdate(request, env);
      } catch (error) {
        return errorResponse(request, env, error.status || 500, error.message || '视频口令保存失败');
      }
    }

    if (url.pathname === '/api/admin/download' && request.method === 'GET') {
      if (!isAuthorized(request, env)) {
        return errorResponse(request, env, 401, '管理员口令无效');
      }

      try {
        return await handleDownloadGet(request, env);
      } catch (error) {
        return errorResponse(request, env, 500, error.message || '下载清单读取失败');
      }
    }

    if (url.pathname === '/api/admin/download' && request.method === 'POST') {
      if (!isAuthorized(request, env)) {
        return errorResponse(request, env, 401, '管理员口令无效');
      }

      try {
        return await handleDownloadPublish(request, env);
      } catch (error) {
        return errorResponse(request, env, error.status || 500, error.message || '下载发布失败');
      }
    }

    return errorResponse(request, env, 404, 'Not found');
  }
};

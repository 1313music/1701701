const ANNOUNCEMENT_KEY = 'current';
const DEFAULT_PUBLIC_OBJECT_KEY = 'announcement.json';
const DEFAULT_GALLERY_BRANCH = 'main';
const DEFAULT_GALLERY_INDEX_PATH = 'public/data/images.json';
const DEFAULT_GALLERY_REPO_IMAGE_ROOT = 'public/images';
const DEFAULT_GALLERY_PUBLIC_IMAGE_ROOT = 'images';
const MAX_GALLERY_IMAGES_PER_REQUEST = 12;
const MAX_GALLERY_IMAGE_BYTES = 12 * 1024 * 1024;
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

const DEFAULT_ANNOUNCEMENT = Object.freeze({
  id: 'default-disabled',
  enabled: false,
  title: '站点公告',
  content: '当前没有启用的公告。',
  type: 'info',
  force: false,
  confirmText: '我知道了',
  linkText: '',
  linkUrl: '',
  startAt: '',
  endAt: '',
  updatedAt: ''
});

const normalizeText = (value, fallback = '') => {
  const normalized = String(value ?? fallback).trim();
  return normalized || fallback;
};

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
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
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

const readAnnouncement = async (env) => {
  const raw = await env.ANNOUNCEMENT_KV?.get(ANNOUNCEMENT_KEY);
  if (!raw) return { ...DEFAULT_ANNOUNCEMENT };

  try {
    return {
      ...DEFAULT_ANNOUNCEMENT,
      ...JSON.parse(raw)
    };
  } catch {
    return { ...DEFAULT_ANNOUNCEMENT };
  }
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

  return {
    id,
    enabled: typeof source.enabled === 'boolean'
      ? source.enabled
      : previousAnnouncement.enabled !== false,
    title: normalizeText(source.title, '站点公告'),
    content,
    type: allowedType(normalizeText(source.type, 'info')),
    force: source.force === true,
    confirmText: normalizeText(source.confirmText, '我知道了'),
    linkText: normalizeText(source.linkText),
    linkUrl: normalizeText(source.linkUrl),
    startAt: normalizeText(source.startAt),
    endAt: normalizeText(source.endAt),
    updatedAt: normalizeText(source.updatedAt, new Date().toISOString())
  };
};

const getPublicObjectKey = (env) => normalizeText(
  env.PUBLIC_OBJECT_KEY,
  DEFAULT_PUBLIC_OBJECT_KEY
).replace(/^\/+/, '') || DEFAULT_PUBLIC_OBJECT_KEY;

const publishPublicAnnouncement = async (env, announcement) => {
  if (!env.ANNOUNCEMENT_PUBLIC_BUCKET) return null;

  const key = getPublicObjectKey(env);
  await env.ANNOUNCEMENT_PUBLIC_BUCKET.put(key, JSON.stringify(announcement, null, 2), {
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

const validateGalleryConfig = (config) => {
  const missing = [];
  if (!config.token) missing.push('GITHUB_TOKEN');
  if (!config.owner) missing.push('GALLERY_GITHUB_OWNER');
  if (!config.repo) missing.push('GALLERY_GITHUB_REPO');
  if (missing.length > 0) {
    throw new Error(`图库 GitHub 配置不完整：${missing.join(', ')}`);
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

const splitFilename = (filename) => {
  const match = normalizeText(filename).match(/^(.*?)(\.[^.]+)?$/);
  return {
    base: normalizeText(match?.[1], 'image'),
    extension: normalizeText(match?.[2])
  };
};

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

const isGalleryImageFile = (value) => (
  value
  && typeof value.arrayBuffer === 'function'
  && typeof value.name === 'string'
);

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
      return jsonResponse(request, env, await readAnnouncement(env));
    }

    if (url.pathname === '/api/admin/announcement' && request.method === 'GET') {
      if (!isAuthorized(request, env)) {
        return errorResponse(request, env, 401, '管理员口令无效');
      }

      return jsonResponse(request, env, {
        announcement: await readAnnouncement(env)
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
      try {
        announcement = normalizeAnnouncement(payload, await readAnnouncement(env));
      } catch (error) {
        return errorResponse(request, env, 400, error.message);
      }

      await env.ANNOUNCEMENT_KV.put(ANNOUNCEMENT_KEY, JSON.stringify(announcement));
      const publicTarget = await publishPublicAnnouncement(env, announcement);
      return jsonResponse(request, env, {
        ok: true,
        announcement,
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

    return errorResponse(request, env, 404, 'Not found');
  }
};

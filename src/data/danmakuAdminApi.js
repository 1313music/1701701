import { toAbsoluteUrl } from './manifestSourceUtils.js';

const DANMAKU_ADMIN_API_BASE_URL = String(
  import.meta.env.VITE_DANMAKU_ADMIN_API_BASE_URL || ''
).trim();

const readErrorMessage = async (response, fallback) => {
  try {
    const payload = await response.json();
    return payload?.error || payload?.message || fallback;
  } catch {
    return fallback;
  }
};

const getSameOriginDanmakuAdminApiBaseUrl = () => {
  if (typeof window === 'undefined') return '';

  const { origin, hostname } = window.location;
  if (hostname === '1701701.xyz' || hostname === 'www.1701701.xyz') {
    return `${origin}/api/danmaku/admin`;
  }

  return '';
};

export const getDanmakuAdminApiBaseUrl = () => {
  const sameOriginBaseUrl = getSameOriginDanmakuAdminApiBaseUrl();
  if (sameOriginBaseUrl) return sameOriginBaseUrl;

  if (!DANMAKU_ADMIN_API_BASE_URL) return '';

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return toAbsoluteUrl(DANMAKU_ADMIN_API_BASE_URL, origin) || '';
};

export const buildDanmakuAdminApiUrl = (path, params = {}) => {
  const baseUrl = getDanmakuAdminApiBaseUrl();
  if (!baseUrl) return '';

  try {
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    const normalizedPath = String(path || '').replace(/^\/+/, '');
    const url = new URL(normalizedPath, normalizedBase);
    Object.entries(params).forEach(([key, value]) => {
      const normalizedValue = String(value ?? '').trim();
      if (normalizedValue) url.searchParams.set(key, normalizedValue);
    });
    return url.toString();
  } catch {
    return '';
  }
};

export const isDanmakuAdminApiConfigured = () => Boolean(
  buildDanmakuAdminApiUrl('/items')
);

const getAuthHeaders = (token, extraHeaders = {}) => {
  const normalizedToken = String(token || '').trim();
  if (!normalizedToken) {
    throw new Error('请输入管理员口令');
  }

  return {
    Authorization: `Bearer ${normalizedToken}`,
    ...extraHeaders
  };
};

export const loadDanmakuItems = async ({
  token,
  status = 'all',
  videoKey = '',
  query = '',
  limit = 50,
  offset = 0,
  signal
} = {}) => {
  const endpoint = buildDanmakuAdminApiUrl('/items', {
    status,
    videoKey,
    q: query,
    limit,
    offset
  });
  if (!endpoint) {
    throw new Error('弹幕后台接口未配置');
  }

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'GET',
      cache: 'no-store',
      signal,
      headers: getAuthHeaders(token)
    });
  } catch (error) {
    const reason = error?.message ? `：${error.message}` : '';
    throw new Error(`无法连接弹幕后台${reason}。请稍后重试。`);
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `弹幕读取失败（HTTP ${response.status}）`));
  }

  return await response.json();
};

export const deleteDanmakuItem = async ({
  id,
  token,
  signal
} = {}) => {
  const normalizedId = String(id || '').trim();
  if (!normalizedId) {
    throw new Error('缺少弹幕 ID');
  }

  const endpoint = buildDanmakuAdminApiUrl(`/items/${encodeURIComponent(normalizedId)}`);
  if (!endpoint) {
    throw new Error('弹幕后台接口未配置');
  }

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'DELETE',
      cache: 'no-store',
      signal,
      headers: getAuthHeaders(token)
    });
  } catch (error) {
    const reason = error?.message ? `：${error.message}` : '';
    throw new Error(`无法连接弹幕后台${reason}。请稍后重试。`);
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `弹幕删除失败（HTTP ${response.status}）`));
  }

  return await response.json();
};

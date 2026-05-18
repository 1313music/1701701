const ANNOUNCEMENT_KEY = 'current';
const DEFAULT_PUBLIC_OBJECT_KEY = 'announcement.json';

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

const corsHeaders = (request, env) => {
  const origin = request.headers.get('Origin') || '*';
  const configured = String(env.ALLOWED_ORIGIN || '*').trim();
  const allowOrigin = configured === '*'
    ? '*'
    : configured.split(',').map((item) => item.trim()).includes(origin)
      ? origin
      : configured.split(',')[0].trim();

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
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

    return errorResponse(request, env, 404, 'Not found');
  }
};

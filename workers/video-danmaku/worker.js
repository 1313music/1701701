const DEFAULT_ALLOWED_ORIGIN = '*';
const DEFAULT_MAX_TEXT_LENGTH = 40;
const DEFAULT_MAX_DANMAKU_PER_VIDEO = 1000;
const DEFAULT_RATE_LIMIT_SECONDS = 10;
const DEFAULT_AUTHOR = 'guest';
const DEFAULT_COLOR = 0xffffff;
const DEFAULT_TYPE = 0;

class ClientError extends Error {}

const normalizeText = (value, fallback = '') => {
  const normalized = Array.from(String(value ?? fallback))
    .filter((character) => {
      const codePoint = character.codePointAt(0) || 0;
      return codePoint >= 32 && codePoint !== 127;
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized || fallback;
};

const toInteger = (value, fallback, min, max) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
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
  const configured = normalizeText(env.ALLOWED_ORIGIN, DEFAULT_ALLOWED_ORIGIN);
  const configuredOrigins = configured.split(',').map((item) => item.trim()).filter(Boolean);
  const matchedOrigin = configuredOrigins.find((item) => isAllowedOrigin(origin, item));
  const allowOrigin = configured === '*'
    ? '*'
    : matchedOrigin
      ? origin
      : configuredOrigins[0] || origin;

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: configured === '*' ? 'Accept-Encoding' : 'Origin'
  };
};

const dplayerResponse = (request, env, body, init = {}) => new Response(JSON.stringify(body), {
  ...init,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...corsHeaders(request, env),
    ...(init.headers || {})
  }
});

const successResponse = (request, env, data = []) => dplayerResponse(request, env, {
  code: 0,
  data
});

const clientErrorResponse = (request, env, message) => dplayerResponse(request, env, {
  code: 1,
  msg: message
});

const serverErrorResponse = (request, env, message = '弹幕服务暂时不可用') => dplayerResponse(
  request,
  env,
  {
    code: 1,
    msg: message
  },
  { status: 500 }
);

const normalizeVideoKey = (value) => {
  const videoKey = normalizeText(value);
  if (!videoKey) throw new ClientError('缺少弹幕池 id');
  if (videoKey.length > 160) throw new ClientError('弹幕池 id 过长');
  if (!/^[a-z0-9:_-]+$/i.test(videoKey)) throw new ClientError('弹幕池 id 格式不正确');
  return videoKey;
};

const normalizeAuthor = (value) => normalizeText(value, DEFAULT_AUTHOR).slice(0, 48) || DEFAULT_AUTHOR;

const normalizeDanmakuText = (value, env) => {
  const maxLength = toInteger(env.DANMAKU_MAX_TEXT_LENGTH, DEFAULT_MAX_TEXT_LENGTH, 1, 120);
  const text = normalizeText(value);
  if (!text) throw new ClientError('请输入弹幕内容');
  if (Array.from(text).length > maxLength) {
    throw new ClientError(`弹幕最多 ${maxLength} 个字`);
  }
  return text;
};

const normalizeTime = (value) => {
  const time = Number.parseFloat(value);
  if (!Number.isFinite(time) || time < 0) throw new ClientError('弹幕时间不正确');
  return Math.min(time, 24 * 60 * 60);
};

const normalizeType = (value) => {
  if (value === 'top') return 1;
  if (value === 'bottom') return 2;
  if (value === 'right') return 0;

  return toInteger(value, DEFAULT_TYPE, 0, 2);
};

const normalizeColor = (value) => {
  if (typeof value === 'number') {
    return toInteger(value, DEFAULT_COLOR, 0, 0xffffff);
  }

  const input = normalizeText(value);
  if (!input) return DEFAULT_COLOR;
  const hex = input.replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    return Number.parseInt(hex.split('').map((character) => character + character).join(''), 16);
  }
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return Number.parseInt(hex, 16);
  }

  return toInteger(input, DEFAULT_COLOR, 0, 0xffffff);
};

const getMaximumDanmaku = (env) => toInteger(
  env.DANMAKU_MAX_PER_VIDEO,
  DEFAULT_MAX_DANMAKU_PER_VIDEO,
  1,
  5000
);

const parseBody = async (request) => {
  const contentType = request.headers.get('Content-Type') || '';
  if (contentType.includes('application/json')) {
    return await request.json();
  }

  if (contentType.includes('form')) {
    const formData = await request.formData();
    return Object.fromEntries(formData.entries());
  }

  try {
    return await request.json();
  } catch {
    return {};
  }
};

const getDatabase = (env) => {
  if (!env.DANMAKU_DB) {
    throw new Error('DANMAKU_DB binding is missing');
  }
  return env.DANMAKU_DB;
};

const toHex = (buffer) => Array.from(new Uint8Array(buffer))
  .map((byte) => byte.toString(16).padStart(2, '0'))
  .join('');

const hashTextFallback = (value) => {
  let hash = 2166136261;
  const input = String(value || '');
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

const hashRequestIp = async (request, env) => {
  const ip = normalizeText(
    request.headers.get('CF-Connecting-IP')
    || request.headers.get('X-Forwarded-For')?.split(',')[0]
    || ''
  );
  if (!ip) return '';

  const salt = normalizeText(env.DANMAKU_IP_HASH_SALT, 'video-danmaku');
  if (!globalThis.crypto?.subtle) {
    return hashTextFallback(`${salt}:${ip}`);
  }

  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${salt}:${ip}`)
  );
  return toHex(digest);
};

const assertRateLimit = async (env, ipHash, now) => {
  if (!ipHash) return;
  const rateLimitSeconds = toInteger(
    env.DANMAKU_RATE_LIMIT_SECONDS,
    DEFAULT_RATE_LIMIT_SECONDS,
    0,
    3600
  );
  if (rateLimitSeconds <= 0) return;

  const latest = await getDatabase(env)
    .prepare('SELECT created_at FROM danmaku WHERE ip_hash = ? ORDER BY created_at DESC LIMIT 1')
    .bind(ipHash)
    .first();
  const latestCreatedAt = Number(latest?.created_at || 0);
  if (latestCreatedAt > 0 && now - latestCreatedAt < rateLimitSeconds * 1000) {
    throw new ClientError(`发送太频繁，请 ${rateLimitSeconds} 秒后再试`);
  }
};

const readDanmaku = async (request, env) => {
  const url = new URL(request.url);
  const videoKey = normalizeVideoKey(url.searchParams.get('id'));
  const limit = Math.min(
    toInteger(url.searchParams.get('max'), getMaximumDanmaku(env), 1, 5000),
    getMaximumDanmaku(env)
  );

  const { results } = await getDatabase(env)
    .prepare(`
      SELECT time, type, color, author, text
      FROM danmaku
      WHERE video_key = ? AND status = 'visible'
      ORDER BY time ASC, created_at ASC
      LIMIT ?
    `)
    .bind(videoKey, limit)
    .all();

  return successResponse(request, env, (results || []).map((row) => [
    Number(row.time || 0),
    normalizeType(row.type),
    normalizeColor(row.color),
    normalizeAuthor(row.author),
    normalizeText(row.text)
  ]));
};

const writeDanmaku = async (request, env) => {
  const payload = await parseBody(request);
  const videoKey = normalizeVideoKey(payload.id);
  const text = normalizeDanmakuText(payload.text, env);
  const time = normalizeTime(payload.time);
  const type = normalizeType(payload.type);
  const color = normalizeColor(payload.color);
  const author = normalizeAuthor(payload.author);
  const now = Date.now();
  const ipHash = await hashRequestIp(request, env);

  await assertRateLimit(env, ipHash, now);

  const id = crypto.randomUUID ? crypto.randomUUID() : `${now}-${Math.random().toString(36).slice(2)}`;
  await getDatabase(env)
    .prepare(`
      INSERT INTO danmaku (
        id, video_key, time, type, color, author, text, ip_hash, status, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'visible', ?)
    `)
    .bind(id, videoKey, time, type, color, author, text, ipHash, now)
    .run();

  return successResponse(request, env, {
    id,
    time,
    type,
    color,
    author,
    text
  });
};

const isDanmakuEndpoint = (pathname) => {
  const normalized = pathname.replace(/\/+$/, '');
  return normalized === '/api/danmaku/v3' || normalized === '/v3';
};

export default {
  async fetch(request, env = {}) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request, env)
      });
    }

    const url = new URL(request.url);
    if (!isDanmakuEndpoint(url.pathname)) {
      return dplayerResponse(request, env, {
        code: 1,
        msg: 'Not found'
      }, { status: 404 });
    }

    try {
      if (request.method === 'GET') {
        return await readDanmaku(request, env);
      }
      if (request.method === 'POST') {
        return await writeDanmaku(request, env);
      }

      return dplayerResponse(request, env, {
        code: 1,
        msg: 'Method not allowed'
      }, {
        status: 405,
        headers: { Allow: 'GET, POST, OPTIONS' }
      });
    } catch (error) {
      if (error instanceof ClientError) {
        return clientErrorResponse(request, env, error.message);
      }
      return serverErrorResponse(request, env);
    }
  }
};

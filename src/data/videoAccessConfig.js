import { toAbsoluteUrl } from './manifestSourceUtils.js';

const DEFAULT_VIDEO_PASSWORD = '1701701xyz';
const BUILD_TIME_VIDEO_PASSWORD = String(
  import.meta.env.VITE_VIDEO_PASSWORD || DEFAULT_VIDEO_PASSWORD
).trim() || DEFAULT_VIDEO_PASSWORD;
const DEFAULT_VIDEO_ACCESS_CONFIG_URL = String(
  import.meta.env.VITE_VIDEO_ACCESS_CONFIG_URL || 'https://r2.1701701.xyz/json/video-access.json'
).trim();
const PERSISTENT_VIDEO_ACCESS_CONFIG_CACHE_KEY = 'video-access-config-cache:v1';
const DEFAULT_VIDEO_ACCESS_CONFIG_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const VIDEO_ACCESS_CONFIG_CACHE_TTL_MS = (() => {
  const value = Number.parseInt(import.meta.env.VITE_VIDEO_ACCESS_CONFIG_CACHE_TTL_MS, 10);
  return Number.isFinite(value) && value >= 0
    ? value
    : DEFAULT_VIDEO_ACCESS_CONFIG_CACHE_TTL_MS;
})();

let cachedVideoAccessConfig = null;
let cachedVideoAccessConfigAt = 0;
let inflightVideoAccessConfigPromise = null;

export const DEFAULT_VIDEO_ACCESS_CONFIG = Object.freeze({
  password: BUILD_TIME_VIDEO_PASSWORD,
  passwordVersion: 'build-time',
  updatedAt: ''
});

const normalizeVideoAccessConfig = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ...DEFAULT_VIDEO_ACCESS_CONFIG };
  }

  const password = String(payload.password || DEFAULT_VIDEO_ACCESS_CONFIG.password).trim()
    || DEFAULT_VIDEO_ACCESS_CONFIG.password;
  const passwordVersion = String(payload.passwordVersion || DEFAULT_VIDEO_ACCESS_CONFIG.passwordVersion).trim()
    || DEFAULT_VIDEO_ACCESS_CONFIG.passwordVersion;

  return {
    password,
    passwordVersion,
    updatedAt: String(payload.updatedAt || '').trim()
  };
};

export const getVideoAccessConfigUrl = () => {
  if (!DEFAULT_VIDEO_ACCESS_CONFIG_URL) return '';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return toAbsoluteUrl(DEFAULT_VIDEO_ACCESS_CONFIG_URL, origin) || '';
};

const readStorage = () => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const clearPersistentVideoAccessConfigCache = () => {
  const storage = readStorage();
  if (!storage) return;
  try {
    storage.removeItem(PERSISTENT_VIDEO_ACCESS_CONFIG_CACHE_KEY);
  } catch {
    // ignore storage failures
  }
};

const readPersistentVideoAccessConfigCache = (now) => {
  if (!(VIDEO_ACCESS_CONFIG_CACHE_TTL_MS > 0)) return null;

  const storage = readStorage();
  if (!storage) return null;

  let raw = null;
  try {
    raw = storage.getItem(PERSISTENT_VIDEO_ACCESS_CONFIG_CACHE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    const savedAt = Number(parsed?.savedAt);
    if (!Number.isFinite(savedAt) || now - savedAt >= VIDEO_ACCESS_CONFIG_CACHE_TTL_MS) {
      clearPersistentVideoAccessConfigCache();
      return null;
    }
    if (!parsed?.data || typeof parsed.data !== 'object' || Array.isArray(parsed.data)) {
      clearPersistentVideoAccessConfigCache();
      return null;
    }

    return {
      config: normalizeVideoAccessConfig(parsed.data),
      savedAt
    };
  } catch {
    clearPersistentVideoAccessConfigCache();
    return null;
  }
};

const writePersistentVideoAccessConfigCache = (config, savedAt) => {
  if (!(VIDEO_ACCESS_CONFIG_CACHE_TTL_MS > 0)) return;

  const storage = readStorage();
  if (!storage) return;
  try {
    storage.setItem(PERSISTENT_VIDEO_ACCESS_CONFIG_CACHE_KEY, JSON.stringify({
      savedAt,
      data: config
    }));
  } catch {
    // ignore storage failures
  }
};

export const __resetVideoAccessConfigCacheForTests = ({ clearPersistent = true } = {}) => {
  cachedVideoAccessConfig = null;
  cachedVideoAccessConfigAt = 0;
  inflightVideoAccessConfigPromise = null;
  if (clearPersistent) {
    clearPersistentVideoAccessConfigCache();
  }
};

const fetchVideoAccessConfig = async ({ signal } = {}) => {
  const endpoint = getVideoAccessConfigUrl();
  if (!endpoint) {
    return {
      config: { ...DEFAULT_VIDEO_ACCESS_CONFIG },
      cacheable: false
    };
  }

  try {
    const response = await fetch(endpoint, {
      cache: 'no-store',
      signal
    });
    if (!response.ok) throw new Error(`视频口令配置读取失败（HTTP ${response.status}）`);
    return {
      config: normalizeVideoAccessConfig(await response.json()),
      cacheable: true
    };
  } catch {
    return {
      config: { ...DEFAULT_VIDEO_ACCESS_CONFIG },
      cacheable: false
    };
  }
};

export const loadVideoAccessConfig = async ({ signal, forceRefresh = false } = {}) => {
  const now = Date.now();
  if (
    !forceRefresh
    && cachedVideoAccessConfig
    && VIDEO_ACCESS_CONFIG_CACHE_TTL_MS > 0
    && now - cachedVideoAccessConfigAt < VIDEO_ACCESS_CONFIG_CACHE_TTL_MS
  ) {
    return cachedVideoAccessConfig;
  }

  if (!forceRefresh) {
    const persistedCache = readPersistentVideoAccessConfigCache(now);
    if (persistedCache) {
      cachedVideoAccessConfig = persistedCache.config;
      cachedVideoAccessConfigAt = persistedCache.savedAt;
      return cachedVideoAccessConfig;
    }
  }

  if (!forceRefresh && inflightVideoAccessConfigPromise) {
    return await inflightVideoAccessConfigPromise;
  }

  const nextPromise = fetchVideoAccessConfig({ signal })
    .then(({ config, cacheable }) => {
      if (cacheable) {
        const savedAt = Date.now();
        cachedVideoAccessConfig = config;
        cachedVideoAccessConfigAt = savedAt;
        writePersistentVideoAccessConfigCache(config, savedAt);
      }
      return config;
    });

  inflightVideoAccessConfigPromise = nextPromise;

  try {
    return await nextPromise;
  } finally {
    if (inflightVideoAccessConfigPromise === nextPromise) {
      inflightVideoAccessConfigPromise = null;
    }
  }
};

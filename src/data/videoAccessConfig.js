import { toAbsoluteUrl } from './manifestSourceUtils.js';

const DEFAULT_VIDEO_PASSWORD = '1701701xyz';
const BUILD_TIME_VIDEO_PASSWORD = String(
  import.meta.env.VITE_VIDEO_PASSWORD || DEFAULT_VIDEO_PASSWORD
).trim() || DEFAULT_VIDEO_PASSWORD;
const DEFAULT_VIDEO_ACCESS_CONFIG_URL = String(
  import.meta.env.VITE_VIDEO_ACCESS_CONFIG_URL || 'https://r2.1701701.xyz/json/video-access.json'
).trim();

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

export const loadVideoAccessConfig = async ({ signal } = {}) => {
  const endpoint = getVideoAccessConfigUrl();
  if (!endpoint) return { ...DEFAULT_VIDEO_ACCESS_CONFIG };

  try {
    const response = await fetch(endpoint, {
      cache: 'no-store',
      signal
    });
    if (!response.ok) throw new Error(`视频口令配置读取失败（HTTP ${response.status}）`);
    return normalizeVideoAccessConfig(await response.json());
  } catch {
    return { ...DEFAULT_VIDEO_ACCESS_CONFIG };
  }
};

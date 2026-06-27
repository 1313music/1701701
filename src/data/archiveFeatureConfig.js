import { readBooleanEnvSwitch } from '../utils/featureFlags.js';

const DEFAULT_ARCHIVE_CONFIG_PATH = '/archive-config.json';
const ARCHIVE_CONFIG_URL = String(
  import.meta.env.VITE_ARCHIVE_CONFIG_URL || DEFAULT_ARCHIVE_CONFIG_PATH
).trim() || DEFAULT_ARCHIVE_CONFIG_PATH;

const TRUTHY_VALUES = new Set(['1', 'true', 'yes', 'on']);
const FALSY_VALUES = new Set(['0', 'false', 'no', 'off']);

export const DEFAULT_ARCHIVE_FEATURE_CONFIG = Object.freeze({
  showBlogArchive: readBooleanEnvSwitch('VITE_ENABLE_BLOG_ARCHIVE', false)
});

const parseBooleanSwitch = (value, fallback) => {
  if (typeof value === 'boolean') return value;
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return fallback;
  if (TRUTHY_VALUES.has(normalized)) return true;
  if (FALSY_VALUES.has(normalized)) return false;
  return fallback;
};

export const normalizeArchiveFeatureConfig = (payload) => {
  const source = payload?.archive && typeof payload.archive === 'object'
    ? payload.archive
    : payload;

  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return { ...DEFAULT_ARCHIVE_FEATURE_CONFIG };
  }

  const rawBlogSwitch = source.showBlogArchive
    ?? source.enableBlogArchive
    ?? source.blogArchiveEnabled;

  return {
    showBlogArchive: parseBooleanSwitch(
      rawBlogSwitch,
      DEFAULT_ARCHIVE_FEATURE_CONFIG.showBlogArchive
    )
  };
};

export const loadArchiveFeatureConfig = async ({ signal } = {}) => {
  try {
    const response = await fetch(ARCHIVE_CONFIG_URL, {
      cache: 'no-store',
      signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return normalizeArchiveFeatureConfig(await response.json());
  } catch {
    return { ...DEFAULT_ARCHIVE_FEATURE_CONFIG };
  }
};

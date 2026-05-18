import { toAbsoluteUrl } from './manifestSourceUtils.js';

const ANNOUNCEMENT_API_BASE_URL = String(
  import.meta.env.VITE_ANNOUNCEMENT_API_BASE_URL || ''
).trim();

export const getAnnouncementApiBaseUrl = () => {
  if (!ANNOUNCEMENT_API_BASE_URL) return '';

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return toAbsoluteUrl(ANNOUNCEMENT_API_BASE_URL, origin) || '';
};

export const buildAnnouncementApiUrl = (path) => {
  const baseUrl = getAnnouncementApiBaseUrl();
  if (!baseUrl) return '';

  try {
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    const normalizedPath = String(path || '').replace(/^\/+/, '');
    return new URL(normalizedPath, normalizedBase).toString();
  } catch {
    return '';
  }
};

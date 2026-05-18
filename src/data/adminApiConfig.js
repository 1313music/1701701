import { toAbsoluteUrl } from './manifestSourceUtils.js';

const ADMIN_API_BASE_URL = String(
  import.meta.env.VITE_ADMIN_API_BASE_URL
  || import.meta.env.VITE_ANNOUNCEMENT_API_BASE_URL
  || ''
).trim();

export const getAdminApiBaseUrl = () => {
  if (!ADMIN_API_BASE_URL) return '';

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return toAbsoluteUrl(ADMIN_API_BASE_URL, origin) || '';
};

export const buildAdminApiUrl = (path) => {
  const baseUrl = getAdminApiBaseUrl();
  if (!baseUrl) return '';

  try {
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    const normalizedPath = String(path || '').replace(/^\/+/, '');
    return new URL(normalizedPath, normalizedBase).toString();
  } catch {
    return '';
  }
};

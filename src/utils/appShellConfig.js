export const VIEW_PATHS = Object.freeze({
  library: '/',
  video: '/video',
  download: '/download',
  gallery: '/gallery',
  app: '/app',
  about: '/about',
  comment: '/comment'
});

export const VIEW_QUERY_KEYS = Object.freeze({
  library: ['albumId', 'songId', 'song'],
  video: ['videoId', 'videoCategory'],
  download: [],
  gallery: [],
  app: [],
  about: [],
  comment: []
});

export const AVAILABLE_VIEWS = new Set(Object.keys(VIEW_PATHS));

export const SITE_URL = 'https://1701701.xyz';
export const SITE_NAME = '1701701.xyz';
export const DEFAULT_OG_IMAGE = `${SITE_URL}/logo.png`;
export const WALINE_SERVER_URL = import.meta.env.VITE_WALINE_SERVER_URL || 'https://hello.1701701.xyz';
export const WECHAT_OFFICIAL_ACCOUNT_NAME = '民谣俱乐部';
export const WECHAT_VIDEO_PASSWORD_KEYWORD = '密码';
export const WECHAT_OFFICIAL_ACCOUNT_QR_URL = 'https://p1.music.126.net/iMUBvGOv8WsuiwXYEAojmQ==/109951172851448166.jpg';
export const APP_READY_EVENT = 'app-initial-ready';

const normalizePathname = (pathname = '/') => {
  if (!pathname) return '/';
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
  if (normalized.length === 1) return normalized;
  return normalized.replace(/\/+$/, '') || '/';
};

export const getPathForView = (view) => VIEW_PATHS[view] || VIEW_PATHS.library;

const getViewFromPathname = (pathname = '/') => {
  const normalized = normalizePathname(pathname);
  const matched = Object.entries(VIEW_PATHS).find(([, path]) => path === normalized);
  return matched ? matched[0] : null;
};

export const getCanonicalSearchForView = (view, search = '') => {
  const params = new URLSearchParams(search);
  params.delete('view');
  const nextParams = new URLSearchParams();

  for (const key of VIEW_QUERY_KEYS[view] || []) {
    const value = params.get(key);
    if (value) {
      nextParams.set(key, value);
    }
  }

  const nextSearch = nextParams.toString();
  return nextSearch ? `?${nextSearch}` : '';
};

export const resolveViewFromLocation = (locationLike) => {
  if (!locationLike) return 'library';
  const pathnameView = getViewFromPathname(locationLike.pathname);
  if (pathnameView) return pathnameView;
  const params = new URLSearchParams(locationLike.search || '');
  const queryView = String(params.get('view') || '').trim();
  return AVAILABLE_VIEWS.has(queryView) ? queryView : 'library';
};

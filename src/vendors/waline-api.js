import {
  addComment,
  deleteComment,
  fetchCommentCount,
  getArticleCounter,
  getComment,
  getPageview,
  getRecentComment,
  getUserList,
  updateArticleCounter,
  updateComment,
  updatePageview
} from '@waline/api/dist/api.js';

const buildLoginUrl = (serverURL, lang, withRedirect = false) => {
  const base = String(serverURL || '').replace(/\/?$/, '');
  const params = new URLSearchParams({ lng: lang || 'en-US' });
  if (withRedirect && typeof window !== 'undefined') {
    params.set('redirect', window.location.href);
  }
  return `${base}/ui/login?${params.toString()}`;
};

export const login = ({ serverURL, lang }) => {
  if (typeof window === 'undefined') {
    return new Promise(() => {});
  }

  const width = 450;
  const height = 450;
  const left = Math.max((window.innerWidth - width) / 2, 0);
  const top = Math.max((window.innerHeight - height) / 2, 0);
  const loginUrl = buildLoginUrl(serverURL, lang, false);

  const popup = window.open(
    loginUrl,
    '_blank',
    `width=${width},height=${height},left=${left},top=${top},scrollbars=no,resizable=no,status=no,location=no,toolbar=no,menubar=no`
  );

  if (!popup) {
    window.location.href = buildLoginUrl(serverURL, lang, true);
    return new Promise(() => {});
  }

  try {
    popup.postMessage({ type: 'TOKEN', data: null }, '*');
  } catch {
    // noop
  }

  return new Promise((resolve) => {
    const handleMessage = (event) => {
      const payload = event?.data;
      if (!payload || typeof payload !== 'object' || payload.type !== 'userInfo') return;
      if (!payload.data?.token) return;
      try {
        popup.close();
      } catch {
        // noop
      }
      window.removeEventListener('message', handleMessage);
      resolve(payload.data);
    };

    window.addEventListener('message', handleMessage);
  });
};

export {
  addComment,
  deleteComment,
  fetchCommentCount,
  getArticleCounter,
  getComment,
  getPageview,
  getRecentComment,
  getUserList,
  updateArticleCounter,
  updateComment,
  updatePageview
};

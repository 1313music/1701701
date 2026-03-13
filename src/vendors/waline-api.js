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
} from '@waline/api-original';

const AUTH_BRIDGE_PATH = '/comment-auth-bridge.html';
const AUTH_BRIDGE_MESSAGE_TYPE = 'waline-auth-bridge';
const WALINE_USER_STORAGE_KEY = 'WALINE_USER';

export const WALINE_AUTH_SUCCESS_EVENT = 'waline-auth-success';

const authOverlayState = {
  overlay: null,
  frame: null,
  title: null,
  modeButtons: {},
  pendingResolver: null,
  serverURL: '',
  lang: 'zh-CN',
  mode: 'login'
};

const normalizeServerURL = (serverURL) => String(serverURL || '').replace(/\/?$/, '');

const buildAuthBridgeUrl = () => {
  if (typeof window === 'undefined') return AUTH_BRIDGE_PATH;
  return new URL(AUTH_BRIDGE_PATH, window.location.origin).toString();
};

const buildAuthUrl = (serverURL, lang, mode = 'login') => {
  const base = normalizeServerURL(serverURL);
  const params = new URLSearchParams({
    lng: lang || 'zh-CN',
    redirect: buildAuthBridgeUrl()
  });
  const targetPath = mode === 'register' ? 'register' : 'login';
  return `${base}/ui/${targetPath}?${params.toString()}`;
};

const persistWalineUser = (userInfo) => {
  if (typeof window === 'undefined' || !userInfo) return;
  const storage = userInfo.remember ? window.localStorage : window.sessionStorage;
  try {
    storage.setItem(WALINE_USER_STORAGE_KEY, JSON.stringify(userInfo));
  } catch {
    // ignore storage errors
  }
};

const closeWalineAuthOverlay = () => {
  if (!authOverlayState.overlay) return;
  authOverlayState.overlay.hidden = true;
  authOverlayState.overlay.classList.remove('is-visible');
  if (authOverlayState.frame) {
    authOverlayState.frame.src = 'about:blank';
  }
};

const applyAuthMode = (mode) => {
  if (!authOverlayState.frame || !authOverlayState.serverURL) return;
  authOverlayState.mode = mode === 'register' ? 'register' : 'login';
  authOverlayState.frame.src = buildAuthUrl(
    authOverlayState.serverURL,
    authOverlayState.lang,
    authOverlayState.mode
  );

  if (authOverlayState.title) {
    authOverlayState.title.textContent = authOverlayState.mode === 'register' ? '评论注册' : '评论登录';
  }

  Object.entries(authOverlayState.modeButtons).forEach(([buttonMode, button]) => {
    const isActive = buttonMode === authOverlayState.mode;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
};

const finalizeWalineAuth = async (token) => {
  const normalizedToken = String(token || '').trim();
  if (!normalizedToken || !authOverlayState.serverURL || typeof window === 'undefined') return;

  try {
    const response = await fetch(`${normalizeServerURL(authOverlayState.serverURL)}/token`, {
      headers: {
        Authorization: `Bearer ${normalizedToken}`
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (payload?.errno || !payload?.data?.objectId) return;

    const userInfo = {
      ...payload.data,
      token: normalizedToken
    };

    persistWalineUser(userInfo);
    window.dispatchEvent(new CustomEvent(WALINE_AUTH_SUCCESS_EVENT, { detail: userInfo }));
    closeWalineAuthOverlay();

    if (typeof authOverlayState.pendingResolver === 'function') {
      authOverlayState.pendingResolver(userInfo);
      authOverlayState.pendingResolver = null;
    }
  } catch (error) {
    console.error('[Waline] Failed to finalize auth', error);
  }
};

const handleWalineAuthMessage = (event) => {
  if (typeof window === 'undefined' || event.origin !== window.location.origin) return;
  const payload = event?.data;
  if (!payload || typeof payload !== 'object' || payload.type !== AUTH_BRIDGE_MESSAGE_TYPE) return;
  void finalizeWalineAuth(payload.token);
};

const handleWalineAuthKeydown = (event) => {
  if (event.key !== 'Escape' || authOverlayState.overlay?.hidden) return;
  closeWalineAuthOverlay();
};

const ensureWalineAuthOverlay = () => {
  if (typeof document === 'undefined' || authOverlayState.overlay) return;

  const overlay = document.createElement('div');
  overlay.className = 'waline-auth-overlay';
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="waline-auth-modal" role="dialog" aria-modal="true" aria-labelledby="waline-auth-title">
      <div class="waline-auth-header">
        <div class="waline-auth-heading">
          <span class="waline-auth-eyebrow">Waline 账号</span>
          <h3 id="waline-auth-title">评论登录</h3>
        </div>
        <div class="waline-auth-controls">
          <div class="waline-auth-tabs" role="tablist" aria-label="评论账号操作">
            <button type="button" class="waline-auth-tab active" data-mode="login" aria-pressed="true">登录</button>
            <button type="button" class="waline-auth-tab" data-mode="register" aria-pressed="false">注册</button>
          </div>
          <button type="button" class="waline-auth-close" aria-label="关闭账号弹层">关闭</button>
        </div>
      </div>
      <div class="waline-auth-frame-wrap">
        <iframe class="waline-auth-frame" title="Waline 登录与注册" src="about:blank"></iframe>
      </div>
    </div>
  `;

  const modal = overlay.querySelector('.waline-auth-modal');
  const frame = overlay.querySelector('.waline-auth-frame');
  const title = overlay.querySelector('#waline-auth-title');
  const closeButton = overlay.querySelector('.waline-auth-close');
  const loginButton = overlay.querySelector('[data-mode="login"]');
  const registerButton = overlay.querySelector('[data-mode="register"]');

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      closeWalineAuthOverlay();
    }
  });

  modal?.addEventListener('click', (event) => {
    event.stopPropagation();
  });

  closeButton?.addEventListener('click', () => {
    closeWalineAuthOverlay();
  });

  loginButton?.addEventListener('click', () => {
    applyAuthMode('login');
  });

  registerButton?.addEventListener('click', () => {
    applyAuthMode('register');
  });

  document.body.appendChild(overlay);
  window.addEventListener('message', handleWalineAuthMessage);
  window.addEventListener('keydown', handleWalineAuthKeydown);

  authOverlayState.overlay = overlay;
  authOverlayState.frame = frame;
  authOverlayState.title = title;
  authOverlayState.modeButtons = {
    login: loginButton,
    register: registerButton
  };
};

export const openWalineAuthOverlay = ({ serverURL, lang = 'zh-CN', mode = 'login' }) => {
  if (typeof window === 'undefined' || !serverURL) {
    return new Promise(() => {});
  }

  ensureWalineAuthOverlay();
  authOverlayState.serverURL = serverURL;
  authOverlayState.lang = lang;
  authOverlayState.overlay.hidden = false;
  authOverlayState.overlay.classList.add('is-visible');
  applyAuthMode(mode);

  return new Promise((resolve) => {
    authOverlayState.pendingResolver = resolve;
  });
};

export const login = ({ serverURL, lang }) => openWalineAuthOverlay({
  serverURL,
  lang,
  mode: 'login'
});

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

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

const WALINE_USER_STORAGE_KEY = 'WALINE_USER';

const authOverlayState = {
  overlay: null,
  title: null,
  status: null,
  forms: {},
  fields: {},
  modeButtons: {},
  submitButtons: {},
  pendingResolver: null,
  serverURL: '',
  lang: 'zh-CN',
  mode: 'login',
  previousOverflow: ''
};

const normalizeServerURL = (serverURL) => String(serverURL || '').replace(/\/+$/, '');

const buildWalineUrl = (serverURL, path, lang, params = {}) => {
  const url = new URL(path.replace(/^\/+/, ''), `${normalizeServerURL(serverURL)}/`);
  url.searchParams.set('lang', lang || 'zh-CN');

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
};

const readJsonSafely = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const requestWaline = async ({ serverURL, lang, path, method = 'GET', body, token, params }) => {
  const headers = {};

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(buildWalineUrl(serverURL, path, lang, params), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const payload = await readJsonSafely(response);

  if (!response.ok) {
    const message = payload?.errmsg || `${response.status} ${response.statusText}`.trim();
    throw new Error(message || '请求失败');
  }

  if (payload?.errno) {
    throw new Error(payload.errmsg || '请求失败');
  }

  return payload?.data ?? null;
};

const showAuthStatus = (message = '', type = 'error') => {
  if (!authOverlayState.status) return;

  authOverlayState.status.hidden = !message;
  authOverlayState.status.textContent = message;
  authOverlayState.status.classList.remove('is-error', 'is-success', 'is-info');

  if (message) {
    authOverlayState.status.classList.add(`is-${type}`);
  }
};

const setBusy = (mode, busy) => {
  const submitButton = authOverlayState.submitButtons[mode];
  const form = authOverlayState.forms[mode];

  if (submitButton) {
    submitButton.disabled = busy;
    submitButton.textContent = busy
      ? mode === 'register' ? '注册中...' : '登录中...'
      : mode === 'register' ? '注册' : '登录';
  }

  if (!form) return;

  const elements = form.querySelectorAll('input, button');
  elements.forEach((element) => {
    if (element === submitButton) return;
    element.disabled = busy;
  });
};

const toggleTwoFactorField = (enabled) => {
  const wrapper = authOverlayState.fields.loginCodeWrap;
  const input = authOverlayState.fields.loginCode;

  if (!wrapper || !input) return;

  wrapper.hidden = !enabled;
  input.required = Boolean(enabled);

  if (!enabled) {
    input.value = '';
  }
};

const persistWalineUser = (userInfo) => {
  if (typeof window === 'undefined' || !userInfo?.token) return;

  const primaryStorage = userInfo.remember ? window.localStorage : window.sessionStorage;
  const secondaryStorage = userInfo.remember ? window.sessionStorage : window.localStorage;

  try {
    primaryStorage.setItem(WALINE_USER_STORAGE_KEY, JSON.stringify(userInfo));
    secondaryStorage.setItem(WALINE_USER_STORAGE_KEY, 'null');
  } catch {
    // ignore storage errors
  }
};

const focusCurrentMode = () => {
  const field = authOverlayState.mode === 'register'
    ? authOverlayState.fields.registerNick
    : authOverlayState.fields.loginEmail;

  if (!field) return;

  window.setTimeout(() => {
    field.focus({ preventScroll: true });
  }, 0);
};

const closeWalineAuthOverlay = () => {
  if (!authOverlayState.overlay) return;

  authOverlayState.overlay.hidden = true;
  authOverlayState.overlay.classList.remove('is-visible');

  if (typeof document !== 'undefined') {
    document.body.style.overflow = authOverlayState.previousOverflow;
  }
};

const resolvePendingLogin = (userInfo) => {
  if (typeof authOverlayState.pendingResolver === 'function') {
    authOverlayState.pendingResolver(userInfo);
    authOverlayState.pendingResolver = null;
  }
};

const finalizeWalineLogin = (userInfo) => {
  persistWalineUser(userInfo);
  closeWalineAuthOverlay();
  resolvePendingLogin(userInfo);
};

const applyAuthMode = (mode, { preserveStatus = false } = {}) => {
  const normalizedMode = mode === 'register' ? 'register' : 'login';
  authOverlayState.mode = normalizedMode;

  if (authOverlayState.title) {
    authOverlayState.title.textContent = normalizedMode === 'register' ? '评论注册' : '评论登录';
  }

  Object.entries(authOverlayState.forms).forEach(([formMode, form]) => {
    form.hidden = formMode !== normalizedMode;
  });

  Object.entries(authOverlayState.modeButtons).forEach(([buttonMode, button]) => {
    const isActive = buttonMode === normalizedMode;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });

  if (!preserveStatus) {
    showAuthStatus('');
  }

  focusCurrentMode();
};

const checkTwoFactorRequirement = async (email) => {
  const normalizedEmail = String(email || '').trim();
  if (!normalizedEmail || !authOverlayState.serverURL) {
    toggleTwoFactorField(false);
    return false;
  }

  try {
    const payload = await requestWaline({
      serverURL: authOverlayState.serverURL,
      lang: authOverlayState.lang,
      path: 'token/2fa',
      params: { email: normalizedEmail }
    });
    const enabled = Boolean(payload?.enable);
    toggleTwoFactorField(enabled);
    return enabled;
  } catch {
    toggleTwoFactorField(false);
    return false;
  }
};

const handleLoginSubmit = async (event) => {
  event.preventDefault();

  const email = authOverlayState.fields.loginEmail?.value?.trim() || '';
  const password = authOverlayState.fields.loginPassword?.value || '';
  const code = authOverlayState.fields.loginCode?.value?.trim() || '';
  const remember = Boolean(authOverlayState.fields.loginRemember?.checked);

  if (!email) {
    showAuthStatus('请输入邮箱');
    return;
  }

  if (!password) {
    showAuthStatus('请输入密码');
    return;
  }

  setBusy('login', true);
  showAuthStatus('');

  try {
    const requiresTwoFactor = await checkTwoFactorRequirement(email);

    if (requiresTwoFactor && !code) {
      showAuthStatus('请输入 2FA 验证码');
      return;
    }

    const response = await requestWaline({
      serverURL: authOverlayState.serverURL,
      lang: authOverlayState.lang,
      path: 'token',
      method: 'POST',
      body: {
        email,
        password,
        ...(requiresTwoFactor ? { code } : {})
      }
    });

    const { token, ...user } = response || {};

    if (!token) {
      throw new Error('登录成功但未返回凭证');
    }

    finalizeWalineLogin({
      ...user,
      token,
      remember
    });
  } catch (error) {
    showAuthStatus(error instanceof Error ? error.message : '登录失败，请稍后重试');
  } finally {
    setBusy('login', false);
  }
};

const handleRegisterSubmit = async (event) => {
  event.preventDefault();

  const displayName = authOverlayState.fields.registerNick?.value?.trim() || '';
  const email = authOverlayState.fields.registerEmail?.value?.trim() || '';
  const password = authOverlayState.fields.registerPassword?.value || '';
  const confirmPassword = authOverlayState.fields.registerConfirm?.value || '';

  if (!displayName || displayName.length < 2) {
    showAuthStatus('请输入正确的昵称');
    return;
  }

  if (!email) {
    showAuthStatus('请输入邮箱');
    return;
  }

  if (!password) {
    showAuthStatus('请输入密码');
    return;
  }

  if (password !== confirmPassword) {
    showAuthStatus('两次密码不一致');
    return;
  }

  setBusy('register', true);
  showAuthStatus('');

  try {
    const response = await requestWaline({
      serverURL: authOverlayState.serverURL,
      lang: authOverlayState.lang,
      path: 'user',
      method: 'POST',
      body: {
        display_name: displayName,
        email,
        password
      }
    });

    authOverlayState.fields.loginEmail.value = email;
    authOverlayState.fields.loginPassword.value = '';
    authOverlayState.fields.loginCode.value = '';
    authOverlayState.fields.registerPassword.value = '';
    authOverlayState.fields.registerConfirm.value = '';

    applyAuthMode('login', { preserveStatus: true });
    showAuthStatus(
      response?.verify
        ? '注册成功，请先去邮箱完成验证，再回来登录。'
        : '注册成功，请直接登录。',
      'success'
    );
  } catch (error) {
    showAuthStatus(error instanceof Error ? error.message : '注册失败，请稍后重试');
  } finally {
    setBusy('register', false);
  }
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
      <div class="waline-auth-body">
        <p class="waline-auth-status" hidden></p>
        <form class="waline-auth-form" data-mode="login" novalidate>
          <label class="waline-auth-field">
            <span>邮箱</span>
            <input type="email" name="email" autocomplete="email" placeholder="your@email.com" />
          </label>
          <label class="waline-auth-field">
            <span>密码</span>
            <input type="password" name="password" autocomplete="current-password" placeholder="输入评论账号密码" />
          </label>
          <label class="waline-auth-field" data-role="code" hidden>
            <span>2FA 验证码</span>
            <input type="text" name="code" inputmode="numeric" autocomplete="one-time-code" placeholder="请输入 6 位验证码" />
          </label>
          <label class="waline-auth-check">
            <input type="checkbox" name="remember" checked />
            <span>下次自动登录</span>
          </label>
          <button type="submit" class="waline-auth-submit">登录</button>
        </form>
        <form class="waline-auth-form" data-mode="register" novalidate hidden>
          <label class="waline-auth-field">
            <span>昵称</span>
            <input type="text" name="nick" autocomplete="nickname" placeholder="至少 2 个字符" />
          </label>
          <label class="waline-auth-field">
            <span>邮箱</span>
            <input type="email" name="email" autocomplete="email" placeholder="注册后用于登录和找回密码" />
          </label>
          <label class="waline-auth-field">
            <span>密码</span>
            <input type="password" name="password" autocomplete="new-password" placeholder="设置评论账号密码" />
          </label>
          <label class="waline-auth-field">
            <span>确认密码</span>
            <input type="password" name="confirm-password" autocomplete="new-password" placeholder="再次输入密码" />
          </label>
          <button type="submit" class="waline-auth-submit">注册</button>
        </form>
        <p class="waline-auth-note">登录和注册都在当前页面完成，不会再跳到外部浏览器。</p>
      </div>
    </div>
  `;

  const modal = overlay.querySelector('.waline-auth-modal');
  const closeButton = overlay.querySelector('.waline-auth-close');
  const loginButton = overlay.querySelector('[data-mode="login"]');
  const registerButton = overlay.querySelector('[data-mode="register"]');
  const status = overlay.querySelector('.waline-auth-status');
  const loginForm = overlay.querySelector('.waline-auth-form[data-mode="login"]');
  const registerForm = overlay.querySelector('.waline-auth-form[data-mode="register"]');

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

  loginForm?.addEventListener('submit', handleLoginSubmit);
  registerForm?.addEventListener('submit', handleRegisterSubmit);

  const loginEmail = loginForm?.querySelector('input[name="email"]');
  loginEmail?.addEventListener('blur', (event) => {
    void checkTwoFactorRequirement(event.target.value);
  });

  document.body.appendChild(overlay);
  window.addEventListener('keydown', handleWalineAuthKeydown);

  authOverlayState.overlay = overlay;
  authOverlayState.title = overlay.querySelector('#waline-auth-title');
  authOverlayState.status = status;
  authOverlayState.forms = {
    login: loginForm,
    register: registerForm
  };
  authOverlayState.fields = {
    loginEmail,
    loginPassword: loginForm?.querySelector('input[name="password"]'),
    loginCodeWrap: loginForm?.querySelector('[data-role="code"]'),
    loginCode: loginForm?.querySelector('input[name="code"]'),
    loginRemember: loginForm?.querySelector('input[name="remember"]'),
    registerNick: registerForm?.querySelector('input[name="nick"]'),
    registerEmail: registerForm?.querySelector('input[name="email"]'),
    registerPassword: registerForm?.querySelector('input[name="password"]'),
    registerConfirm: registerForm?.querySelector('input[name="confirm-password"]')
  };
  authOverlayState.modeButtons = {
    login: loginButton,
    register: registerButton
  };
  authOverlayState.submitButtons = {
    login: loginForm?.querySelector('.waline-auth-submit'),
    register: registerForm?.querySelector('.waline-auth-submit')
  };
};

export const openWalineAuthOverlay = ({ serverURL, lang = 'zh-CN', mode = 'login' }) => {
  if (typeof window === 'undefined' || !serverURL) {
    return new Promise(() => {});
  }

  ensureWalineAuthOverlay();

  authOverlayState.serverURL = serverURL;
  authOverlayState.lang = lang;
  authOverlayState.previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  authOverlayState.overlay.hidden = false;
  authOverlayState.overlay.classList.add('is-visible');
  toggleTwoFactorField(false);
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

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
import { PRESET_AVATARS, isPresetAvatarUrl } from '../data/avatarPresets.js';
import { buildDefaultAvatarUrl } from '../utils/defaultAvatar.js';

const WALINE_USER_STORAGE_KEY = 'WALINE_USER';
export const WALINE_AUTH_SUCCESS_EVENT = 'waline-auth-success';

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

const profileOverlayState = {
  overlay: null,
  status: null,
  form: null,
  fields: {},
  submitButton: null,
  avatarPreviewImage: null,
  avatarPreviewPlaceholder: null,
  avatarPresetButtons: [],
  avatarResetButton: null,
  defaultAvatarUrl: '',
  serverURL: '',
  lang: 'zh-CN',
  userInfo: null,
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

const showStatus = (statusElement, message = '', type = 'error') => {
  if (!statusElement) return;

  statusElement.hidden = !message;
  statusElement.textContent = message;
  statusElement.classList.remove('is-error', 'is-success', 'is-info');

  if (message) {
    statusElement.classList.add(`is-${type}`);
  }
};

const showAuthStatus = (message = '', type = 'error') => {
  showStatus(authOverlayState.status, message, type);
};

const showProfileStatus = (message = '', type = 'error') => {
  showStatus(profileOverlayState.status, message, type);
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

const setProfileBusy = (busy) => {
  if (profileOverlayState.submitButton) {
    profileOverlayState.submitButton.disabled = busy;
    profileOverlayState.submitButton.textContent = busy ? '保存中...' : '更新我的档案';
  }

  if (!profileOverlayState.form) return;

  const elements = profileOverlayState.form.querySelectorAll('input, button');
  elements.forEach((element) => {
    if (element === profileOverlayState.submitButton) return;
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

const parseStoredWalineUser = (value) => {
  if (!value || value === 'null') return null;

  try {
    const userInfo = JSON.parse(value);
    return userInfo && typeof userInfo === 'object' && userInfo.token ? userInfo : null;
  } catch {
    return null;
  }
};

const readStoredWalineUser = () => {
  if (typeof window === 'undefined') return null;

  return parseStoredWalineUser(window.localStorage.getItem(WALINE_USER_STORAGE_KEY))
    || parseStoredWalineUser(window.sessionStorage.getItem(WALINE_USER_STORAGE_KEY));
};

const persistWalineUser = (userInfo) => {
  if (typeof window === 'undefined' || !userInfo?.token) return;

  const serializedUser = JSON.stringify(userInfo);
  const previousValue = window.localStorage.getItem(WALINE_USER_STORAGE_KEY);

  try {
    // Keep localStorage in sync with Waline's internal reactive store.
    window.localStorage.setItem(WALINE_USER_STORAGE_KEY, serializedUser);

    if (userInfo.remember) {
      window.sessionStorage.setItem(WALINE_USER_STORAGE_KEY, 'null');
    } else {
      window.sessionStorage.setItem(WALINE_USER_STORAGE_KEY, serializedUser);
    }
  } catch {
    // ignore storage errors
  }

  try {
    const storageEvent = new StorageEvent('storage', {
      key: WALINE_USER_STORAGE_KEY,
      oldValue: previousValue,
      newValue: serializedUser,
      storageArea: window.localStorage
    });
    window.dispatchEvent(storageEvent);
  } catch {
    const fallbackEvent = new Event('storage');
    Object.defineProperties(fallbackEvent, {
      key: { value: WALINE_USER_STORAGE_KEY },
      oldValue: { value: previousValue },
      newValue: { value: serializedUser },
      storageArea: { value: window.localStorage }
    });
    window.dispatchEvent(fallbackEvent);
  }
};

const emitWalineAuthSuccess = (userInfo) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(WALINE_AUTH_SUCCESS_EVENT, { detail: userInfo }));
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

const focusProfileForm = () => {
  const field = profileOverlayState.fields.profileNick;
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

const closeWalineProfileOverlay = () => {
  if (!profileOverlayState.overlay) return;

  profileOverlayState.overlay.hidden = true;
  profileOverlayState.overlay.classList.remove('is-visible');

  if (typeof document !== 'undefined') {
    document.body.style.overflow = profileOverlayState.previousOverflow;
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
  emitWalineAuthSuccess(userInfo);

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
  const avatar = authOverlayState.fields.registerAvatar?.value?.trim() || '';

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

  if (!isValidHttpUrl(avatar)) {
    showAuthStatus('头像地址需以 http:// 或 https:// 开头，或者留空');
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
        password,
        ...(avatar ? { avatar } : {})
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

const isValidHttpUrl = (value) => {
  const url = String(value || '').trim();
  return !url || /^https?:\/\//i.test(url);
};

// 预设头像按钮的高亮状态跟着输入框走：值正好等于某个预设地址才算选中。
const syncProfileAvatarPresetSelection = (value) => {
  const url = String(value || '').trim();

  profileOverlayState.avatarPresetButtons.forEach(({ button, preset }) => {
    const isActive = preset.url === url;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
};

// 头像预览：输入框里填了合法的 http(s) 地址就展示那张图，否则回退到占位文字。
const renderProfileAvatarPreview = (value) => {
  const url = String(value || '').trim();

  syncProfileAvatarPresetSelection(url);

  const image = profileOverlayState.avatarPreviewImage;
  const placeholder = profileOverlayState.avatarPreviewPlaceholder;

  if (!image || !placeholder) return;

  if (!isValidHttpUrl(url) || !url) {
    image.hidden = true;
    image.removeAttribute('src');
    placeholder.hidden = false;
    return;
  }

  image.hidden = false;
  placeholder.hidden = true;

  if (image.getAttribute('src') !== url) {
    image.setAttribute('src', url);
  }
};

// 「恢复默认头像」的探针：算出来的地址先真的加载一次，加载不出来就不给用户用。
// 目的是万一以后改了服务器上的头像配置（模板变了），算出来的地址会是错的，别写进用户资料。
const avatarProbeCache = new Map();

const probeAvatarUrl = (url) => {
  if (!url) return Promise.resolve(false);
  if (avatarProbeCache.has(url)) return Promise.resolve(avatarProbeCache.get(url));

  return new Promise((resolve) => {
    const image = new Image();

    const finish = (ok) => {
      avatarProbeCache.set(url, ok);
      resolve(ok);
    };

    image.onload = () => finish(true);
    image.onerror = () => finish(false);
    image.src = url;
  });
};

const refreshProfileAvatarReset = (userInfo) => {
  const button = profileOverlayState.avatarResetButton;
  if (!button) return;

  const defaultUrl = buildDefaultAvatarUrl(userInfo?.email);
  const currentUrl = String(userInfo?.avatar || '').trim();

  profileOverlayState.defaultAvatarUrl = defaultUrl;
  button.hidden = true;

  // 没有邮箱、或当前头像本来就是默认的 —— 没什么可恢复的。
  if (!defaultUrl || defaultUrl === currentUrl) return;

  void probeAvatarUrl(defaultUrl).then((ok) => {
    // 探针是异步的：这期间可能已经关掉弹窗或换了账号，别乱显示。
    if (!ok || profileOverlayState.userInfo !== userInfo) return;
    button.hidden = false;
  });
};

const handleProfileSubmit = async (event) => {
  event.preventDefault();

  const currentUserInfo = profileOverlayState.userInfo || readStoredWalineUser();
  const displayName = profileOverlayState.fields.profileNick?.value?.trim() || '';
  const avatar = profileOverlayState.fields.profileAvatar?.value?.trim() || '';

  if (!currentUserInfo?.token) {
    showProfileStatus('请先登录后再更新资料');
    return;
  }

  if (!displayName || displayName.length < 2) {
    showProfileStatus('请输入正确的昵称');
    return;
  }

  if (!isValidHttpUrl(avatar)) {
    showProfileStatus('图片地址需以 http:// 或 https:// 开头，或者留空');
    return;
  }

  setProfileBusy(true);
  showProfileStatus('');

  try {
    await requestWaline({
      serverURL: profileOverlayState.serverURL,
      lang: profileOverlayState.lang,
      path: 'user',
      method: 'PUT',
      token: currentUserInfo.token,
      body: {
        display_name: displayName,
        // 服务端只有拿到非空字符串才会写入 avatar，留空即保持当前头像不变。
        ...(avatar ? { avatar } : {})
      }
    });

    // 不再提交 url：个人主页已从界面移除，服务端保留用户原有的值，不主动清空。
    const nextUserInfo = {
      ...currentUserInfo,
      display_name: displayName,
      ...(avatar ? { avatar } : {})
    };

    profileOverlayState.userInfo = nextUserInfo;
    persistWalineUser(nextUserInfo);
    emitWalineAuthSuccess(nextUserInfo);
    closeWalineProfileOverlay();
  } catch (error) {
    showProfileStatus(error instanceof Error ? error.message : '更新失败，请稍后重试');
  } finally {
    setProfileBusy(false);
  }
};

const handleWalineAuthKeydown = (event) => {
  if (event.key !== 'Escape' || authOverlayState.overlay?.hidden) return;
  closeWalineAuthOverlay();
};

const handleWalineProfileKeydown = (event) => {
  if (event.key !== 'Escape' || profileOverlayState.overlay?.hidden) return;
  closeWalineProfileOverlay();
};

const ensureWalineAuthOverlay = () => {
  if (typeof document === 'undefined' || authOverlayState.overlay) return;

  const registerPresetAvatarsMarkup = PRESET_AVATARS
    .map((preset, index) => `<button type="button" class="waline-register-avatar-preset" data-avatar-url="${preset.url}" aria-label="注册预设头像 ${index + 1}" aria-pressed="false"><img src="${preset.url}" alt="" loading="lazy" decoding="async" /></button>`)
    .join('\n            ');
  const overlay = document.createElement('div');
  overlay.className = 'waline-auth-overlay';
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="waline-auth-modal" role="dialog" aria-modal="true" aria-labelledby="waline-auth-title">
      <div class="waline-auth-header">
        <div class="waline-auth-heading">
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
          <section class="waline-register-avatar" aria-labelledby="waline-register-avatar-title">
            <div class="waline-register-avatar-heading">
              <div class="waline-register-avatar-title-row">
                <span id="waline-register-avatar-title">头像（选填）</span>
                <div class="waline-register-avatar-preview" aria-hidden="true">
                  <img data-role="register-avatar-preview-image" alt="" hidden />
                  <span data-role="register-avatar-preview-placeholder">未选择</span>
                </div>
              </div>
              <span class="waline-register-avatar-hint">现在选一张，之后也可以在个人设置里更换</span>
            </div>
            <div class="waline-register-avatar-presets" role="group" aria-label="注册时选择预设头像">
              ${registerPresetAvatarsMarkup}
            </div>
            <label class="waline-auth-field">
              <span>自定义图片地址（选填）</span>
              <input type="url" name="avatar" autocomplete="off" placeholder="https://example.com/avatar.png" />
            </label>
          </section>
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
  const registerAvatarInput = registerForm?.querySelector('input[name="avatar"]');
  const registerAvatarPreviewImage = registerForm?.querySelector('[data-role="register-avatar-preview-image"]');
  const registerAvatarPreviewPlaceholder = registerForm?.querySelector('[data-role="register-avatar-preview-placeholder"]');
  const registerAvatarPresetButtons = Array.from(
    registerForm?.querySelectorAll('.waline-register-avatar-preset') || []
  ).map((button) => ({
    button,
    preset: PRESET_AVATARS.find((preset) => preset.url === button.dataset.avatarUrl)
  })).filter(({ preset }) => preset);

  const renderRegisterAvatarPreview = (value) => {
    const url = String(value || '').trim();
    const isValid = /^https?:\/\//i.test(url);

    if (registerAvatarPreviewImage) {
      if (isValid) {
        registerAvatarPreviewImage.src = url;
        registerAvatarPreviewImage.hidden = false;
      } else {
        registerAvatarPreviewImage.hidden = true;
        registerAvatarPreviewImage.removeAttribute('src');
      }
    }

    if (registerAvatarPreviewPlaceholder) {
      registerAvatarPreviewPlaceholder.hidden = isValid;
    }

    registerAvatarPresetButtons.forEach(({ button, preset }) => {
      const isActive = preset.url === url;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  };

  registerAvatarInput?.addEventListener('input', () => {
    renderRegisterAvatarPreview(registerAvatarInput.value);
  });
  registerAvatarInput?.addEventListener('change', () => {
    renderRegisterAvatarPreview(registerAvatarInput.value);
  });
  registerAvatarPreviewImage?.addEventListener('error', () => {
    registerAvatarPreviewImage.hidden = true;
    registerAvatarPreviewImage.removeAttribute('src');
    if (registerAvatarPreviewPlaceholder) registerAvatarPreviewPlaceholder.hidden = false;
  });
  registerAvatarPresetButtons.forEach(({ button, preset }) => {
    button.addEventListener('click', () => {
      if (!registerAvatarInput) return;
      registerAvatarInput.value = preset.url;
      renderRegisterAvatarPreview(preset.url);
    });
  });

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
    registerAvatar: registerAvatarInput,
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

const ensureWalineProfileOverlay = () => {
  if (typeof document === 'undefined' || profileOverlayState.overlay) return;

  const overlay = document.createElement('div');
  overlay.className = 'waline-auth-overlay waline-profile-overlay';
  overlay.hidden = true;

  const presetAvatarsMarkup = PRESET_AVATARS
    .map((preset) => `<button type="button" class="waline-profile-avatar-preset" data-avatar-url="${preset.url}" aria-label="${preset.label}" aria-pressed="false"><img src="${preset.url}" alt="" loading="lazy" decoding="async" /></button>`)
    .join('\n            ');

  overlay.innerHTML = `
    <div class="waline-auth-modal waline-profile-modal" role="dialog" aria-modal="true" aria-labelledby="waline-profile-title">
      <div class="waline-auth-header waline-profile-header">
        <div class="waline-auth-heading">
          <div class="waline-profile-title-row">
            <h3 id="waline-profile-title">个人设置</h3>
            <button type="button" class="waline-auth-close" aria-label="关闭账号设置">
              <span class="waline-profile-close-icon" aria-hidden="true">×</span>
              <span>关闭</span>
            </button>
          </div>
        </div>
      </div>
      <div class="waline-auth-body waline-profile-body">
        <p class="waline-auth-status" hidden></p>
        <form class="waline-auth-form waline-profile-form" novalidate>
          <section class="waline-profile-avatar-section" aria-labelledby="waline-profile-avatar-title">
            <div class="waline-profile-avatar">
              <span class="waline-profile-avatar-preview" aria-hidden="true">
                <img alt="" data-role="avatar-preview-image" hidden />
                <span class="waline-profile-avatar-placeholder" data-role="avatar-preview-placeholder">暂无</span>
              </span>
              <div class="waline-profile-avatar-heading">
                <div class="waline-profile-avatar-heading-row">
                  <span class="waline-profile-avatar-title" id="waline-profile-avatar-title">选择头像</span>
                  <span class="waline-profile-avatar-count">21 张 · XKK</span>
                </div>
                <p class="waline-profile-avatar-hint">点选预设查看效果，也可以粘贴自己的图片地址。</p>
              </div>
            </div>
            <div class="waline-profile-avatar-presets" role="group" aria-label="XKK 预设头像">
              ${presetAvatarsMarkup}
            </div>
            <div class="waline-profile-avatar-custom">
              <label class="waline-auth-field">
                <span>图片地址</span>
                <input type="url" name="avatar" autocomplete="off" placeholder="https://example.com/avatar.png" />
              </label>
              <button type="button" class="waline-profile-avatar-reset" hidden>恢复默认头像</button>
            </div>
          </section>
          <section class="waline-profile-details" aria-labelledby="waline-profile-details-title">
            <div class="waline-profile-details-heading">
              <span class="waline-profile-details-title" id="waline-profile-details-title">账号资料</span>
              <span class="waline-profile-details-hint">昵称会显示在评论中</span>
            </div>
            <div class="waline-profile-details-fields">
              <label class="waline-auth-field">
                <span>昵称</span>
                <input type="text" name="nick" autocomplete="nickname" placeholder="至少 2 个字符" />
              </label>
              <label class="waline-auth-field">
                <span>邮箱</span>
                <input type="email" name="email" autocomplete="email" readonly />
              </label>
            </div>
          </section>
          <button type="submit" class="waline-auth-submit">更新我的档案</button>
        </form>
      </div>
    </div>
  `;

  const modal = overlay.querySelector('.waline-profile-modal');
  const closeButton = overlay.querySelector('.waline-auth-close');
  const status = overlay.querySelector('.waline-auth-status');
  const form = overlay.querySelector('.waline-profile-form');
  const avatarInput = form?.querySelector('input[name="avatar"]');
  const avatarPreviewImage = overlay.querySelector('[data-role="avatar-preview-image"]');
  const avatarPreviewPlaceholder = overlay.querySelector('[data-role="avatar-preview-placeholder"]');

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      closeWalineProfileOverlay();
    }
  });

  modal?.addEventListener('click', (event) => {
    event.stopPropagation();
  });

  closeButton?.addEventListener('click', () => {
    closeWalineProfileOverlay();
  });

  form?.addEventListener('submit', handleProfileSubmit);

  const handleAvatarPreviewInput = (event) => {
    renderProfileAvatarPreview(event.target.value);
  };

  // 'input' 覆盖手动输入/粘贴，'change' 覆盖自动填充与失焦提交，处理函数本身是幂等的。
  avatarInput?.addEventListener('input', handleAvatarPreviewInput);
  avatarInput?.addEventListener('change', handleAvatarPreviewInput);

  // 预设头像：点一下就把它填进输入框（不直接提交，用户还能看到预览再保存）。
  const avatarPresetButtons = Array.from(overlay.querySelectorAll('.waline-profile-avatar-preset'))
    .map((button) => ({
      button,
      preset: PRESET_AVATARS.find((preset) => preset.url === button.dataset.avatarUrl)
    }))
    .filter(({ preset }) => Boolean(preset));

  avatarPresetButtons.forEach(({ button, preset }) => {
    button.addEventListener('click', () => {
      if (!avatarInput) return;
      avatarInput.value = preset.url;
      renderProfileAvatarPreview(preset.url);
    });
  });

  // 恢复默认头像：把算出来的地址填进输入框（同样不直接提交，用户能先看预览）。
  const avatarResetButton = overlay.querySelector('.waline-profile-avatar-reset');
  avatarResetButton?.addEventListener('click', () => {
    const defaultUrl = profileOverlayState.defaultAvatarUrl;
    if (!defaultUrl || !avatarInput) return;
    avatarInput.value = defaultUrl;
    renderProfileAvatarPreview(defaultUrl);
    showProfileStatus('已填入默认头像地址，点「更新我的档案」保存后生效。', 'info');
  });

  // 地址填错（图挂了/不是图片）时不要把破图留在预览里。
  avatarPreviewImage?.addEventListener('error', () => {
    avatarPreviewImage.hidden = true;
    avatarPreviewImage.removeAttribute('src');
    if (avatarPreviewPlaceholder) {
      avatarPreviewPlaceholder.hidden = false;
    }
  });

  document.body.appendChild(overlay);
  window.addEventListener('keydown', handleWalineProfileKeydown);

  profileOverlayState.overlay = overlay;
  profileOverlayState.status = status;
  profileOverlayState.form = form;
  profileOverlayState.fields = {
    profileNick: form?.querySelector('input[name="nick"]'),
    profileEmail: form?.querySelector('input[name="email"]'),
    profileAvatar: avatarInput
  };
  profileOverlayState.avatarPreviewImage = avatarPreviewImage;
  profileOverlayState.avatarPreviewPlaceholder = avatarPreviewPlaceholder;
  profileOverlayState.avatarPresetButtons = avatarPresetButtons;
  profileOverlayState.avatarResetButton = avatarResetButton;
  profileOverlayState.submitButton = form?.querySelector('.waline-auth-submit');
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

export const openWalineProfileOverlay = ({ serverURL, lang = 'zh-CN' }) => {
  if (typeof window === 'undefined' || !serverURL) return false;

  const userInfo = readStoredWalineUser();

  if (!userInfo?.token) {
    void openWalineAuthOverlay({ serverURL, lang, mode: 'login' });
    return false;
  }

  ensureWalineProfileOverlay();

  profileOverlayState.serverURL = serverURL;
  profileOverlayState.lang = lang;
  profileOverlayState.userInfo = userInfo;
  profileOverlayState.previousOverflow = document.body.style.overflow;

  if (profileOverlayState.fields.profileNick) {
    profileOverlayState.fields.profileNick.value = userInfo.display_name || '';
  }
  if (profileOverlayState.fields.profileEmail) {
    profileOverlayState.fields.profileEmail.value = userInfo.email || '';
  }
  if (profileOverlayState.fields.profileAvatar) {
    // 只有「当前头像正好是我们提供的预设」时才回填，这样用户能看出上次选的是哪张；
    // 其余情况（按邮箱生成的默认头像、或用户自己填的网址）一律留空，
    // 否则用户会以为那串地址是必须保留的值。
    profileOverlayState.fields.profileAvatar.value = isPresetAvatarUrl(userInfo.avatar)
      ? userInfo.avatar
      : '';
  }

  // userInfo.avatar 是服务端算好的「当前头像」，只拿来预览。
  renderProfileAvatarPreview(userInfo.avatar || '');

  // 「恢复默认头像」按钮要等探针确认地址可用才显示，所以是异步的。
  refreshProfileAvatarReset(userInfo);

  document.body.style.overflow = 'hidden';
  profileOverlayState.overlay.hidden = false;
  profileOverlayState.overlay.classList.add('is-visible');
  showProfileStatus('');
  focusProfileForm();

  return true;
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

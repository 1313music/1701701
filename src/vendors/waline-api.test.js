import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PRESET_AVATARS } from '../data/avatarPresets.js';

const PROFILE_SUBMIT_LABEL = '更新我的档案';
const AVATAR_FIELD_LABEL = '图片地址';
const RESET_AVATAR_LABEL = '恢复默认头像';

// seedStoredUser 用的邮箱，服务端会返回这个默认头像地址（md5 由 Python hashlib 核对过）
const SEEDED_EMAIL = 'minyaoclub2@163.com';
const SEEDED_DEFAULT_AVATAR =
  'https://cravatar.cn/avatar/f84bb4e1f13373cd922689bfc926b395?s=150&d=wavatar';

const OriginalImage = globalThis.Image;

// 探针用 new Image() 真的加载一次头像地址。jsdom 不会加载图片，
// 所以这里用一个假的 Image：设 src 后异步触发 onload / onerror。
const mockImageProbe = (succeed) => {
  globalThis.Image = class MockImage {
    set src(value) {
      this.currentSrc = value;
      Promise.resolve().then(() => {
        if (succeed) this.onload?.();
        else this.onerror?.();
      });
    }

    get src() {
      return this.currentSrc;
    }
  };
};

const flushMicrotasks = () => new Promise((resolve) => { setTimeout(resolve, 0); });

// waline-api.js 在模块作用域里缓存了弹窗 DOM 引用，每个用例都重新加载一份干净的模块。
const loadWalineApi = async () => {
  vi.resetModules();
  return import('./waline-api.js');
};

const seedStoredUser = (overrides = {}) => {
  window.localStorage.setItem('WALINE_USER', JSON.stringify({
    display_name: '谢尔比',
    email: 'minyaoclub2@163.com',
    url: '',
    token: 'test-token',
    avatar: 'https://cravatar.cn/avatar/0123456789abcdef0123456789abcdef?s=150&d=wavatar',
    objectId: 1,
    remember: true,
    ...overrides
  }));
};

const getPreviewImage = () => document.querySelector('[data-role="avatar-preview-image"]');
const getPreviewPlaceholder = () => document.querySelector('[data-role="avatar-preview-placeholder"]');

describe('waline-api profile overlay', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.localStorage.clear();
    window.sessionStorage.clear();
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ errno: 0, errmsg: '', data: null })
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.Image = OriginalImage;
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('updates the nickname without touching the homepage field', async () => {
    const { openWalineProfileOverlay, WALINE_AUTH_SUCCESS_EVENT } = await loadWalineApi();
    const authListener = vi.fn();
    // 个人主页已从界面移除，但用户库里原有的值必须原样保留、且不能被提交覆盖
    seedStoredUser({ url: 'https://example.com/me' });
    window.addEventListener(WALINE_AUTH_SUCCESS_EVENT, authListener);

    expect(openWalineProfileOverlay({
      serverURL: 'https://comments.example.com',
      lang: 'zh-CN'
    })).toBe(true);

    // 界面上已经没有这个输入框了
    expect(screen.queryByLabelText('个人主页地址')).toBeNull();

    const nickInput = screen.getByLabelText('昵称');
    expect(nickInput).toHaveValue('谢尔比');
    fireEvent.change(nickInput, { target: { value: '谢尔比2' } });
    fireEvent.click(screen.getByRole('button', { name: PROFILE_SUBMIT_LABEL }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://comments.example.com/user?lang=zh-CN',
      expect.objectContaining({
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token'
        },
        body: JSON.stringify({
          display_name: '谢尔比2'
        })
      })
    );
    // 本地存储里原有的主页地址没被动过
    expect(JSON.parse(window.localStorage.getItem('WALINE_USER'))).toMatchObject({
      display_name: '谢尔比2',
      url: 'https://example.com/me'
    });
    expect(authListener).toHaveBeenCalledWith(expect.objectContaining({
      detail: expect.objectContaining({
        display_name: '谢尔比2',
        url: 'https://example.com/me'
      })
    }));

    window.removeEventListener(WALINE_AUTH_SUCCESS_EVENT, authListener);
  });

  it('previews the current avatar without prefilling the input', async () => {
    const { openWalineProfileOverlay } = await loadWalineApi();
    seedStoredUser({ avatar: 'https://example.com/me.jpg' });

    expect(openWalineProfileOverlay({
      serverURL: 'https://comments.example.com',
      lang: 'zh-CN'
    })).toBe(true);

    const avatarInput = screen.getByLabelText(AVATAR_FIELD_LABEL);
    expect(avatarInput).not.toBeRequired();
    expect(avatarInput).toHaveValue('');

    expect(getPreviewImage().getAttribute('src')).toBe('https://example.com/me.jpg');
    expect(getPreviewImage().hidden).toBe(false);
    expect(getPreviewPlaceholder().hidden).toBe(true);
  });

  it('updates the avatar preview while typing', async () => {
    const { openWalineProfileOverlay } = await loadWalineApi();
    seedStoredUser();

    openWalineProfileOverlay({ serverURL: 'https://comments.example.com', lang: 'zh-CN' });

    const avatarInput = screen.getByLabelText(AVATAR_FIELD_LABEL);

    fireEvent.input(avatarInput, { target: { value: 'https://cdn.example.com/a.png' } });
    expect(getPreviewImage().getAttribute('src')).toBe('https://cdn.example.com/a.png');
    expect(getPreviewImage().hidden).toBe(false);
    expect(getPreviewPlaceholder().hidden).toBe(true);

    fireEvent.input(avatarInput, { target: { value: '' } });
    expect(getPreviewImage().hidden).toBe(true);
    expect(getPreviewImage().hasAttribute('src')).toBe(false);
    expect(getPreviewPlaceholder().hidden).toBe(false);
  });

  it('saves a custom avatar address and syncs the stored user', async () => {
    const { openWalineProfileOverlay, WALINE_AUTH_SUCCESS_EVENT } = await loadWalineApi();
    const authListener = vi.fn();
    seedStoredUser();
    window.addEventListener(WALINE_AUTH_SUCCESS_EVENT, authListener);

    openWalineProfileOverlay({ serverURL: 'https://comments.example.com', lang: 'zh-CN' });

    fireEvent.change(screen.getByLabelText(AVATAR_FIELD_LABEL), {
      target: { value: 'https://cdn.example.com/a.png' }
    });
    fireEvent.click(screen.getByRole('button', { name: PROFILE_SUBMIT_LABEL }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://comments.example.com/user?lang=zh-CN',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          display_name: '谢尔比',
          avatar: 'https://cdn.example.com/a.png'
        })
      })
    );
    expect(JSON.parse(window.localStorage.getItem('WALINE_USER'))).toMatchObject({
      avatar: 'https://cdn.example.com/a.png'
    });
    expect(authListener).toHaveBeenCalledWith(expect.objectContaining({
      detail: expect.objectContaining({ avatar: 'https://cdn.example.com/a.png' })
    }));

    window.removeEventListener(WALINE_AUTH_SUCCESS_EVENT, authListener);
  });

  it('rejects an avatar address that is not http(s)', async () => {
    const { openWalineProfileOverlay } = await loadWalineApi();
    seedStoredUser();

    openWalineProfileOverlay({ serverURL: 'https://comments.example.com', lang: 'zh-CN' });

    fireEvent.change(screen.getByLabelText(AVATAR_FIELD_LABEL), {
      target: { value: 'ftp://cdn.example.com/a.png' }
    });
    fireEvent.click(screen.getByRole('button', { name: PROFILE_SUBMIT_LABEL }));

    await waitFor(() => {
      expect(screen.getByText('图片地址需以 http:// 或 https:// 开头，或者留空')).toBeTruthy();
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('renders one button per preset avatar', async () => {
    const { openWalineProfileOverlay } = await loadWalineApi();
    seedStoredUser();

    openWalineProfileOverlay({ serverURL: 'https://comments.example.com', lang: 'zh-CN' });

    expect(PRESET_AVATARS.length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /^预设头像 \d+$/ })).toHaveLength(PRESET_AVATARS.length);
  });

  it('fills the field and the preview when a preset avatar is picked', async () => {
    const { openWalineProfileOverlay } = await loadWalineApi();
    seedStoredUser();

    openWalineProfileOverlay({ serverURL: 'https://comments.example.com', lang: 'zh-CN' });

    const target = PRESET_AVATARS[2];
    const presetButton = screen.getByRole('button', { name: target.label });
    expect(presetButton).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(presetButton);

    expect(screen.getByLabelText(AVATAR_FIELD_LABEL)).toHaveValue(target.url);
    expect(getPreviewImage().getAttribute('src')).toBe(target.url);
    expect(getPreviewImage().hidden).toBe(false);
    expect(presetButton).toHaveAttribute('aria-pressed', 'true');

    // 只有被点的那一个处于选中态
    const active = screen.getAllByRole('button', { name: /^预设头像 \d+$/ })
      .filter((button) => button.getAttribute('aria-pressed') === 'true');
    expect(active).toHaveLength(1);
  });

  it('saves the picked preset avatar', async () => {
    const { openWalineProfileOverlay } = await loadWalineApi();
    seedStoredUser();

    openWalineProfileOverlay({ serverURL: 'https://comments.example.com', lang: 'zh-CN' });

    const target = PRESET_AVATARS[0];
    fireEvent.click(screen.getByRole('button', { name: target.label }));
    fireEvent.click(screen.getByRole('button', { name: PROFILE_SUBMIT_LABEL }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://comments.example.com/user?lang=zh-CN',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          display_name: '谢尔比',
          avatar: target.url
        })
      })
    );
    expect(JSON.parse(window.localStorage.getItem('WALINE_USER'))).toMatchObject({
      avatar: target.url
    });
  });

  it('prefills the field when the current avatar is already a preset', async () => {
    const { openWalineProfileOverlay } = await loadWalineApi();
    const target = PRESET_AVATARS[5];
    seedStoredUser({ avatar: target.url });

    openWalineProfileOverlay({ serverURL: 'https://comments.example.com', lang: 'zh-CN' });

    expect(screen.getByLabelText(AVATAR_FIELD_LABEL)).toHaveValue(target.url);
    expect(screen.getByRole('button', { name: target.label })).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps the field empty and nothing selected for a non-preset avatar', async () => {
    const { openWalineProfileOverlay } = await loadWalineApi();
    seedStoredUser({ avatar: 'https://cravatar.cn/avatar/abc?s=150&d=wavatar' });

    openWalineProfileOverlay({ serverURL: 'https://comments.example.com', lang: 'zh-CN' });

    expect(screen.getByLabelText(AVATAR_FIELD_LABEL)).toHaveValue('');
    const active = screen.getAllByRole('button', { name: /^预设头像 \d+$/ })
      .filter((button) => button.getAttribute('aria-pressed') === 'true');
    expect(active).toHaveLength(0);
    // 预览仍然显示服务端算好的当前头像
    expect(getPreviewImage().getAttribute('src')).toBe('https://cravatar.cn/avatar/abc?s=150&d=wavatar');
  });

  // ---- 恢复默认头像 ----

  const getResetButton = () => document.querySelector('.waline-profile-avatar-reset');

  it('offers to restore the default avatar once the address probe succeeds', async () => {
    mockImageProbe(true);
    const { openWalineProfileOverlay } = await loadWalineApi();
    seedStoredUser();

    openWalineProfileOverlay({ serverURL: 'https://comments.example.com', lang: 'zh-CN' });

    await waitFor(() => {
      expect(getResetButton().hidden).toBe(false);
    });
    expect(getResetButton().textContent).toBe(RESET_AVATAR_LABEL);
  });

  it('fills the field with the default avatar when the reset button is used', async () => {
    mockImageProbe(true);
    const { openWalineProfileOverlay } = await loadWalineApi();
    seedStoredUser();

    openWalineProfileOverlay({ serverURL: 'https://comments.example.com', lang: 'zh-CN' });
    await waitFor(() => {
      expect(getResetButton().hidden).toBe(false);
    });

    fireEvent.click(getResetButton());

    expect(screen.getByLabelText(AVATAR_FIELD_LABEL)).toHaveValue(SEEDED_DEFAULT_AVATAR);
    expect(getPreviewImage().getAttribute('src')).toBe(SEEDED_DEFAULT_AVATAR);
    expect(screen.getByText('已填入默认头像地址，点「更新我的档案」保存后生效。')).toBeTruthy();
  });

  it('saves the default avatar after using the reset button', async () => {
    mockImageProbe(true);
    const { openWalineProfileOverlay } = await loadWalineApi();
    seedStoredUser();

    openWalineProfileOverlay({ serverURL: 'https://comments.example.com', lang: 'zh-CN' });
    await waitFor(() => {
      expect(getResetButton().hidden).toBe(false);
    });

    fireEvent.click(getResetButton());
    fireEvent.click(screen.getByRole('button', { name: PROFILE_SUBMIT_LABEL }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://comments.example.com/user?lang=zh-CN',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          display_name: '谢尔比',
          avatar: SEEDED_DEFAULT_AVATAR
        })
      })
    );
  });

  it('hides the reset button when the current avatar is already the default', async () => {
    mockImageProbe(true);
    const { openWalineProfileOverlay } = await loadWalineApi();
    seedStoredUser({ avatar: SEEDED_DEFAULT_AVATAR });

    openWalineProfileOverlay({ serverURL: 'https://comments.example.com', lang: 'zh-CN' });
    await flushMicrotasks();

    expect(getResetButton().hidden).toBe(true);
  });

  it('keeps the reset button hidden when the default address cannot be loaded', async () => {
    mockImageProbe(false);
    const { openWalineProfileOverlay } = await loadWalineApi();
    seedStoredUser();

    openWalineProfileOverlay({ serverURL: 'https://comments.example.com', lang: 'zh-CN' });
    await flushMicrotasks();

    expect(getResetButton().hidden).toBe(true);
  });

  it('hides the reset button when the account has no email', async () => {
    mockImageProbe(true);
    const { openWalineProfileOverlay } = await loadWalineApi();
    seedStoredUser({ email: '' });

    openWalineProfileOverlay({ serverURL: 'https://comments.example.com', lang: 'zh-CN' });
    await flushMicrotasks();

    expect(getResetButton().hidden).toBe(true);
  });
});

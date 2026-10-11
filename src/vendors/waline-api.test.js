import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const PROFILE_SUBMIT_LABEL = '更新我的档案';
const AVATAR_FIELD_LABEL = '头像图片地址';

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
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('updates profile with an optional homepage field', async () => {
    const { openWalineProfileOverlay, WALINE_AUTH_SUCCESS_EVENT } = await loadWalineApi();
    const authListener = vi.fn();
    seedStoredUser();
    window.addEventListener(WALINE_AUTH_SUCCESS_EVENT, authListener);

    expect(openWalineProfileOverlay({
      serverURL: 'https://comments.example.com',
      lang: 'zh-CN'
    })).toBe(true);

    const homepageInput = screen.getByLabelText('个人主页地址');
    expect(homepageInput).not.toBeRequired();
    expect(homepageInput).toHaveValue('');

    fireEvent.change(homepageInput, { target: { value: '' } });
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
          display_name: '谢尔比',
          url: ''
        })
      })
    );
    expect(JSON.parse(window.localStorage.getItem('WALINE_USER'))).toMatchObject({
      display_name: '谢尔比',
      url: ''
    });
    expect(authListener).toHaveBeenCalledWith(expect.objectContaining({
      detail: expect.objectContaining({ url: '' })
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
          url: '',
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
      expect(screen.getByText('头像图片地址需以 http:// 或 https:// 开头，或者留空')).toBeTruthy();
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  WALINE_AUTH_SUCCESS_EVENT,
  openWalineProfileOverlay
} from './waline-api.js';

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
    const authListener = vi.fn();
    const userInfo = {
      display_name: '谢尔比',
      email: 'minyaoclub2@163.com',
      url: '',
      token: 'test-token',
      avatar: 'https://example.com/avatar.jpg',
      objectId: 1,
      remember: true
    };
    window.localStorage.setItem('WALINE_USER', JSON.stringify(userInfo));
    window.addEventListener(WALINE_AUTH_SUCCESS_EVENT, authListener);

    expect(openWalineProfileOverlay({
      serverURL: 'https://comments.example.com',
      lang: 'zh-CN'
    })).toBe(true);

    const homepageInput = screen.getByLabelText('个人主页地址');
    expect(homepageInput).not.toBeRequired();
    expect(homepageInput).toHaveValue('');

    fireEvent.change(homepageInput, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: '更新我的档案' }));

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
});

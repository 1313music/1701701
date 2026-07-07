import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import CommentSection from './CommentSection.jsx';

const { init, openWalineAuthOverlay, openWalineProfileOverlay, getComment } = vi.hoisted(() => ({
  init: vi.fn(),
  openWalineAuthOverlay: vi.fn(),
  openWalineProfileOverlay: vi.fn(),
  getComment: vi.fn()
}));

vi.mock('@waline/client', () => ({
  init
}));

vi.mock('@waline/client/style', () => ({}));

vi.mock('../vendors/waline-api.js', () => ({
  WALINE_AUTH_SUCCESS_EVENT: 'waline-auth-success',
  openWalineAuthOverlay,
  openWalineProfileOverlay,
  getComment
}));

const renderWalineShell = (el) => {
  el.innerHTML = `
    <div class="wl-header-item">
      <label>昵称</label>
      <input name="nick" />
    </div>
    <div class="wl-header-item">
      <input name="mail" />
    </div>
    <textarea></textarea>
    <div class="wl-footer">
      <button class="wl-btn">原始登录</button>
    </div>
    <div class="wl-login-info">
      <a href="https://comments.example.com/ui/profile" class="wl-login-nick">谢尔比</a>
    </div>
  `;
};

describe('CommentSection', () => {
  const instances = [];

  beforeEach(() => {
    instances.length = 0;
    getComment.mockResolvedValue({
      count: 0,
      page: 1,
      pageSize: 100,
      totalPages: 1,
      data: []
    });
    init.mockImplementation(({ el }) => {
      renderWalineShell(el);
      const instance = {
        destroy: vi.fn(),
        update: vi.fn()
      };
      instances.push(instance);
      return instance;
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders an empty state when no comment server is configured', () => {
    render(<CommentSection serverURL="" />);

    expect(screen.getByText('未配置评论服务地址')).toBeInTheDocument();
    expect(init).not.toHaveBeenCalled();
  });

  it('syncs Waline placeholders and bridges login/register actions', async () => {
    const { container } = render(<CommentSection serverURL="https://comments.example.com" />);

    await waitFor(() => {
      expect(init).toHaveBeenCalledTimes(1);
    });

    expect(init).toHaveBeenCalledWith(expect.objectContaining({
      commentSorting: 'latest',
      imageUploader: false,
      search: false,
      locale: expect.objectContaining({
        oldest: '按正序',
        latest: '按倒序'
      })
    }));

    const nickInput = container.querySelector('input[name="nick"]');
    const emailInput = container.querySelector('input[name="mail"]');
    const textarea = container.querySelector('textarea');

    expect(nickInput).toHaveAttribute('placeholder', '昵称');
    expect(nickInput).toHaveAttribute('aria-label', '昵称');
    expect(emailInput).toHaveAttribute('placeholder', '邮箱');
    expect(emailInput).toHaveAttribute('aria-label', '邮箱');
    expect(textarea).toHaveAttribute('placeholder', '说点什么吧');

    fireEvent.click(screen.getByRole('button', { name: '登录 Waline 账号' }));
    fireEvent.click(screen.getByRole('button', { name: '注册 Waline 账号' }));

    expect(openWalineAuthOverlay).toHaveBeenNthCalledWith(1, {
      serverURL: 'https://comments.example.com',
      lang: 'zh-CN',
      mode: 'login'
    });
    expect(openWalineAuthOverlay).toHaveBeenNthCalledWith(2, {
      serverURL: 'https://comments.example.com',
      lang: 'zh-CN',
      mode: 'register'
    });

    fireEvent.click(screen.getByRole('link', { name: '打开 Waline 账号设置' }));

    expect(openWalineProfileOverlay).toHaveBeenCalledWith({
      serverURL: 'https://comments.example.com',
      lang: 'zh-CN'
    });
  });

  it('updates path and reinitializes after Waline auth success', async () => {
    const { rerender, unmount } = render(
      <CommentSection
        serverURL="https://comments.example.com"
        path="page:alpha"
        title=""
        subtitle=""
      />
    );

    await waitFor(() => {
      expect(init).toHaveBeenCalledTimes(1);
    });

    expect(instances[0].update).not.toHaveBeenCalled();

    rerender(
      <CommentSection
        serverURL="https://comments.example.com"
        path="page:beta"
        title=""
        subtitle=""
      />
    );

    await waitFor(() => {
      expect(instances[0].update).toHaveBeenLastCalledWith({ path: 'page:beta' });
    });

    act(() => {
      window.dispatchEvent(new CustomEvent('waline-auth-success'));
    });

    await waitFor(() => {
      expect(init).toHaveBeenCalledTimes(2);
    });

    expect(instances[0].destroy).toHaveBeenCalledTimes(1);

    unmount();

    expect(instances[1].destroy).toHaveBeenCalledTimes(1);
  });

});

import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import CommentSection from './CommentSection.jsx';

const { init, openWalineAuthOverlay, getComment } = vi.hoisted(() => ({
  init: vi.fn(),
  openWalineAuthOverlay: vi.fn(),
  getComment: vi.fn()
}));

vi.mock('@waline/client', () => ({
  init
}));

vi.mock('@waline/client/style', () => ({}));

vi.mock('../vendors/waline-api.js', () => ({
  WALINE_AUTH_SUCCESS_EVENT: 'waline-auth-success',
  openWalineAuthOverlay,
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

    expect(instances[0].update).toHaveBeenCalledWith({ path: 'page:alpha' });

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

  it('renders merged legacy comments from aliased song paths', async () => {
    getComment
      .mockResolvedValueOnce({
        count: 1,
        page: 1,
        pageSize: 100,
        totalPages: 1,
        data: [{
          objectId: 1,
          time: new Date('2026-03-12T11:21:58+08:00').getTime(),
          nick: '匿名',
          orig: '蜡烛',
          comment: '蜡烛',
          children: [],
          sticky: false
        }]
      })
      .mockResolvedValueOnce({
        count: 1,
        page: 1,
        pageSize: 100,
        totalPages: 1,
        data: [{
          objectId: 2,
          time: new Date('2026-03-17T10:44:09+08:00').getTime(),
          nick: '匿名',
          orig: '啦啦啦啦啦',
          comment: '啦啦啦啦啦',
          children: [],
          sticky: false
        }]
      });

    render(
      <CommentSection
        serverURL="https://comments.example.com"
        path="song:van-gogh:van-gogh-04"
        legacyPaths={[
          'song:van-gogh:https%3A%2F%2Fr2.1701701.xyz%2Fmp3%2F%E6%A2%B5%E9%AB%98%E5%85%88%E7%94%9F%2F04.%E5%B9%BF%E5%9C%BA.mp3',
          'song:van-gogh:https%3A%2F%2Fr2.1701701.xyz%2Fmp3%2F%25E6%25A2%25B5%25E9%25AB%2598%25E5%2585%2588%25E7%2594%259F%2F04.%25E5%25B9%25BF%25E5%259C%25BA.mp3'
        ]}
        title=""
        subtitle=""
      />
    );

    await waitFor(() => {
      expect(screen.getByText('历史评论')).toBeInTheDocument();
    });

    expect(screen.getByText('蜡烛')).toBeInTheDocument();
    expect(screen.getByText('啦啦啦啦啦')).toBeInTheDocument();
    expect(getComment).toHaveBeenCalledTimes(2);
  });
});

import { fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  getWalineHeaderText,
  syncWalineAuthButtons,
  syncWalineHeaderPlaceholders
} from './walineDomAdapter.js';

const createRoot = () => {
  const root = document.createElement('div');
  root.innerHTML = `
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
  return root;
};

describe('walineDomAdapter', () => {
  it('derives translated field labels from label or input name', () => {
    const input = document.createElement('input');
    input.setAttribute('name', 'email');

    expect(getWalineHeaderText('自定义', input)).toBe('自定义');
    expect(getWalineHeaderText('', input)).toBe('邮箱');
    expect(getWalineHeaderText('', document.createElement('input'))).toBe('');
  });

  it('syncs placeholders and bridges login/register actions', () => {
    const root = createRoot();
    const onLogin = vi.fn();
    const onRegister = vi.fn();

    syncWalineHeaderPlaceholders(root);
    syncWalineAuthButtons({ root, onLogin, onRegister });

    expect(root.querySelector('input[name="nick"]')).toHaveAttribute('placeholder', '昵称');
    expect(root.querySelector('input[name="mail"]')).toHaveAttribute('placeholder', '邮箱');
    expect(root.querySelector('textarea')).toHaveAttribute('placeholder', '说点什么吧');

    fireEvent.click(root.querySelector('.wl-login-btn'));
    fireEvent.click(root.querySelector('.wl-register-btn'));

    expect(onLogin).toHaveBeenCalledTimes(1);
    expect(onRegister).toHaveBeenCalledTimes(1);
  });

  it('removes stale register buttons when no controllable login action exists', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <div class="wl-footer"></div>
      <button class="wl-register-btn">注册</button>
    `;

    syncWalineAuthButtons({
      root,
      onLogin: vi.fn(),
      onRegister: vi.fn()
    });

    expect(root.querySelector('.wl-register-btn')).not.toBeInTheDocument();
  });
});


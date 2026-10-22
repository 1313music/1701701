import React, { useMemo, useState } from 'react';
import { PRESET_AVATARS } from '../data/avatarPresets.js';
import { updateWalineUserProfile } from '../vendors/waline-api.js';
import '../styles/reset-password.css';

const MIN_PASSWORD_LENGTH = 6;
const MIN_NICK_LENGTH = 2;

const readTokenFromLocation = () => {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('token') || '';
};

const isValidHttpUrl = (value) => !value || /^https?:\/\//i.test(value);

/**
 * 邮件重置密码的落地页。
 *
 * 服务端没有「凭 token 取当前用户资料」的接口，所以这里不预填昵称/头像：
 * token 本身就代表用户，直接 PUT /api/user 改密码，昵称和头像选填、留空不动。
 */
const ResetPasswordPage = ({ serverURL }) => {
  const token = useMemo(readTokenFromLocation, []);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nick, setNick] = useState('');
  const [avatar, setAvatar] = useState('');
  const [status, setStatus] = useState({ type: '', message: '' });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!token) {
      setStatus({ type: 'error', message: '链接无效或已过期，请回到留言板重新申请重置邮件。' });
      return;
    }
    if (!password || !confirmPassword) {
      setStatus({ type: 'error', message: '请填写新密码和确认密码。' });
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setStatus({ type: 'error', message: `新密码至少 ${MIN_PASSWORD_LENGTH} 位。` });
      return;
    }
    if (password !== confirmPassword) {
      setStatus({ type: 'error', message: '两次输入的新密码不一致。' });
      return;
    }
    if (nick && nick.length < MIN_NICK_LENGTH) {
      setStatus({ type: 'error', message: `昵称至少 ${MIN_NICK_LENGTH} 个字符，或者留空不修改。` });
      return;
    }
    if (!isValidHttpUrl(avatar)) {
      setStatus({ type: 'error', message: '头像地址需以 http:// 或 https:// 开头，或者留空不修改。' });
      return;
    }

    setBusy(true);
    setStatus({ type: '', message: '' });

    try {
      await updateWalineUserProfile({
        serverURL,
        token,
        data: {
          password,
          ...(nick ? { display_name: nick } : {}),
          ...(avatar ? { avatar } : {})
        }
      });
      setDone(true);
      setStatus({ type: 'success', message: '密码已更新，正在返回留言板…' });
      window.setTimeout(() => {
        window.location.href = '/comment';
      }, 1400);
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : '更新失败，请稍后重试。'
      });
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <div className="reset-page">
        <div className="reset-card">
          <h1 className="reset-title">链接无效</h1>
          <p className="reset-subtitle">这个重置链接缺少凭证，可能已过期或复制不完整。</p>
          <a className="reset-back" href="/comment">返回留言板，重新申请重置邮件</a>
        </div>
      </div>
    );
  }

  return (
    <div className="reset-page">
      <div className="reset-card">
        <h1 className="reset-title">重置密码</h1>
        <p className="reset-subtitle">
          你正在通过邮件链接重置密码。设置好新密码后，就可以用新密码登录留言板。
        </p>

        <form className="reset-form" onSubmit={handleSubmit} noValidate>
          <label className="reset-field">
            <span>新密码</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={`至少 ${MIN_PASSWORD_LENGTH} 位`}
              autoComplete="new-password"
            />
          </label>

          <label className="reset-field">
            <span>确认新密码</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="再次输入新密码"
              autoComplete="new-password"
            />
          </label>

          <label className="reset-field">
            <span>昵称（选填，留空不修改）</span>
            <input
              type="text"
              value={nick}
              onChange={(event) => setNick(event.target.value)}
              placeholder={`至少 ${MIN_NICK_LENGTH} 个字符`}
              autoComplete="nickname"
            />
          </label>

          <section className="reset-avatar" aria-labelledby="reset-avatar-title">
            <div className="reset-avatar-heading">
              <span className="reset-avatar-title" id="reset-avatar-title">头像（选填，留空不修改）</span>
              <span className="reset-avatar-hint">点选一张预设，或粘贴自己的图片地址</span>
            </div>
            <div className="reset-avatar-presets" role="group" aria-label="预设头像">
              {PRESET_AVATARS.map((preset) => (
                <button
                  key={preset.url}
                  type="button"
                  className={`reset-avatar-preset${avatar === preset.url ? ' is-active' : ''}`}
                  aria-label={preset.label}
                  aria-pressed={avatar === preset.url}
                  onClick={() => setAvatar(preset.url)}
                >
                  <img src={preset.url} alt="" loading="lazy" decoding="async" />
                </button>
              ))}
            </div>
            <label className="reset-field">
              <span>自定义图片地址</span>
              <input
                type="url"
                value={avatar}
                onChange={(event) => setAvatar(event.target.value)}
                placeholder="https://example.com/avatar.png"
                autoComplete="off"
              />
            </label>
            {avatar ? (
              <div className="reset-avatar-preview">
                <img src={avatar} alt="头像预览" />
                <button type="button" className="reset-avatar-clear" onClick={() => setAvatar('')}>
                  清除
                </button>
              </div>
            ) : null}
          </section>

          {status.message ? (
            <p className={`reset-status is-${status.type}`} role="status">{status.message}</p>
          ) : null}

          <button type="submit" className="reset-submit" disabled={busy || done}>
            {busy ? '保存中…' : done ? '已保存' : '保存并返回留言板'}
          </button>
        </form>

        <a className="reset-back" href="/comment">返回留言板</a>
      </div>
    </div>
  );
};

export default ResetPasswordPage;

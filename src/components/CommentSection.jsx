import React, { useCallback, useEffect, useRef } from 'react';
import { init } from '@waline/client';
import '@waline/client/style';
import '../styles/comments.css';

const REGISTER_URL_FALLBACK = 'https://hello.1701701.xyz/ui/register';

const CommentSection = ({ serverURL, path = 'page:home', title = '留言板', subtitle = '' }) => {
  const containerRef = useRef(null);
  const walineRef = useRef(null);
  const syncTimerRef = useRef(null);
  const observerRef = useRef(null);
  const latestPathRef = useRef(path);

  useEffect(() => {
    latestPathRef.current = path;
  }, [path]);

  const getHeaderText = useCallback((labelText, input) => {
    if (labelText) return labelText;
    const fieldName = (input?.getAttribute('name') || '').toLowerCase();
    if (fieldName.includes('nick')) return '昵称';
    if (fieldName.includes('mail') || fieldName.includes('email')) return '邮箱';
    return '';
  }, []);

  const openRegisterPage = useCallback(() => {
    if (typeof window === 'undefined') return;
    const registerURL = serverURL
      ? `${String(serverURL).replace(/\/?$/, '')}/ui/register`
      : REGISTER_URL_FALLBACK;
    const width = 520;
    const height = 720;
    const left = Math.max((window.innerWidth - width) / 2, 0);
    const top = Math.max((window.innerHeight - height) / 2, 0);
    const popup = window.open(
      registerURL,
      '_blank',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes,status=no,location=no,toolbar=no,menubar=no`
    );

    if (!popup) {
      window.location.href = registerURL;
    }
  }, [serverURL]);

  const syncHeaderPlaceholders = useCallback(() => {
    const root = containerRef.current;
    if (!root) return;
    const headerItems = root.querySelectorAll('.wl-header-item');
    headerItems.forEach((item) => {
      const label = item.querySelector('label');
      const input = item.querySelector('input');
      if (!input) return;
      const text = getHeaderText(label?.textContent?.trim(), input);
      if (!text) return;
      input.placeholder = text;
      input.setAttribute('aria-label', text);
    });
    const textareas = root.querySelectorAll('textarea');
    textareas.forEach((textarea) => {
      textarea.placeholder = '说点什么吧';
    });
  }, [getHeaderText]);

  const syncAuthButtons = useCallback(() => {
    const root = containerRef.current;
    if (!root) return;

    const existingButtons = root.querySelectorAll('.wl-register-btn');
    const loginButton = root.querySelector('.wl-footer button.wl-btn:not(.primary)');

    if (!loginButton) {
      existingButtons.forEach((button) => button.remove());
      return;
    }

    const existingNextButton = loginButton.nextElementSibling;
    if (existingNextButton?.classList.contains('wl-register-btn')) {
      return;
    }

    existingButtons.forEach((button) => button.remove());

    const registerButton = document.createElement('button');
    registerButton.type = 'button';
    registerButton.className = 'wl-btn wl-register-btn';
    registerButton.textContent = '注册';
    registerButton.setAttribute('aria-label', '注册 Waline 账号');
    registerButton.addEventListener('click', openRegisterPage);
    loginButton.insertAdjacentElement('afterend', registerButton);
  }, [openRegisterPage]);

  const scheduleHeaderSync = useCallback(() => {
    syncHeaderPlaceholders();
    syncAuthButtons();
    if (typeof window !== 'undefined' && window.requestAnimationFrame) {
      window.requestAnimationFrame(() => {
        syncHeaderPlaceholders();
        syncAuthButtons();
      });
    }
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
    }
    syncTimerRef.current = setTimeout(() => {
      syncTimerRef.current = null;
      syncHeaderPlaceholders();
      syncAuthButtons();
    }, 120);
  }, [syncAuthButtons, syncHeaderPlaceholders]);

  useEffect(() => {
    if (!containerRef.current || !serverURL) return undefined;
    walineRef.current = init({
      el: containerRef.current,
      serverURL,
      path: latestPathRef.current,
      meta: ['nick', 'mail'],
      lang: 'zh-CN',
      locale: {
        comment: '评论',
        sofa: ''
      },
      noCopyright: true,
      noRss: true,
      emoji: [
        'https://unpkg.com/@waline/emojis@1.4.0/weibo',
        'https://unpkg.com/@waline/emojis@1.4.0/bmoji',
        'https://unpkg.com/@waline/emojis@1.4.0/qq',
        'https://unpkg.com/@waline/emojis@1.4.0/tieba'
      ]
    });
    scheduleHeaderSync();
    if (typeof MutationObserver !== 'undefined') {
      observerRef.current = new MutationObserver(() => {
        scheduleHeaderSync();
      });
      observerRef.current.observe(containerRef.current, {
        childList: true,
        subtree: true
      });
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      if (walineRef.current?.destroy) {
        walineRef.current.destroy();
      }
      walineRef.current = null;
    };
  }, [scheduleHeaderSync, serverURL]);

  useEffect(() => {
    if (!walineRef.current?.update || !path) return;
    walineRef.current.update({ path });
    scheduleHeaderSync();
  }, [path, scheduleHeaderSync]);

  return (
    <section className="comment-section">
      {title || subtitle ? (
        <div className="comment-section-header">
          <div>
            {title ? <h2 className="comment-section-title">{title}</h2> : null}
            {subtitle ? <p className="comment-section-subtitle">{subtitle}</p> : null}
          </div>
        </div>
      ) : null}
      {!serverURL ? (
        <div className="comment-section-empty">未配置评论服务地址</div>
      ) : (
        <div ref={containerRef} className="comment-section-body" />
      )}
    </section>
  );
};

export default CommentSection;

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { init } from '@waline/client';
import '@waline/client/style';
import { WALINE_AUTH_SUCCESS_EVENT, openWalineAuthOverlay } from '../vendors/waline-api.js';
import {
  syncWalineAuthButtons,
  syncWalineHeaderPlaceholders
} from '../vendors/walineDomAdapter.js';
import '../styles/comments.css';

const CommentSection = ({ serverURL, path = 'page:home', title = '留言板', subtitle = '' }) => {
  const containerRef = useRef(null);
  const walineRef = useRef(null);
  const syncTimerRef = useRef(null);
  const observerRef = useRef(null);
  const latestPathRef = useRef(path);
  const [authRefreshKey, setAuthRefreshKey] = useState(0);

  useEffect(() => {
    latestPathRef.current = path;
  }, [path]);

  const openRegisterPage = useCallback(() => {
    if (!serverURL) return;
    void openWalineAuthOverlay({
      serverURL,
      lang: 'zh-CN',
      mode: 'register'
    });
  }, [serverURL]);

  const openLoginPage = useCallback(() => {
    if (!serverURL) return;
    void openWalineAuthOverlay({
      serverURL,
      lang: 'zh-CN',
      mode: 'login'
    });
  }, [serverURL]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleAuthSuccess = () => {
      setAuthRefreshKey((previous) => previous + 1);
    };

    window.addEventListener(WALINE_AUTH_SUCCESS_EVENT, handleAuthSuccess);
    return () => {
      window.removeEventListener(WALINE_AUTH_SUCCESS_EVENT, handleAuthSuccess);
    };
  }, []);

  const syncHeaderPlaceholders = useCallback(() => {
    syncWalineHeaderPlaceholders(containerRef.current);
  }, []);

  const syncAuthButtons = useCallback(() => {
    syncWalineAuthButtons({
      root: containerRef.current,
      onLogin: openLoginPage,
      onRegister: openRegisterPage
    });
  }, [openLoginPage, openRegisterPage]);

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
  }, [authRefreshKey, scheduleHeaderSync, serverURL]);

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

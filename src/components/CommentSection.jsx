import React, { useCallback, useEffect, useRef, useState } from 'react';
import { init } from '@waline/client';
import '@waline/client/style';
import {
  WALINE_AUTH_SUCCESS_EVENT,
  getComment,
  openWalineAuthOverlay
} from '../vendors/waline-api.js';
import {
  syncWalineAuthButtons,
  syncWalineHeaderPlaceholders
} from '../vendors/walineDomAdapter.js';
import '../styles/comments.css';

const COMMENT_SORT_BY = 'insertedAt_asc';
const createPrimaryDebugState = () => ({
  loading: false,
  error: '',
  count: null,
  totalPages: null
});

const CommentSection = ({
  serverURL,
  path = 'page:home',
  title = '留言板',
  subtitle = ''
}) => {
  const containerRef = useRef(null);
  const walineRef = useRef(null);
  const syncTimerRef = useRef(null);
  const observerRef = useRef(null);
  const latestPathRef = useRef(path);
  const [authRefreshKey, setAuthRefreshKey] = useState(0);
  const [primaryDebug, setPrimaryDebug] = useState(createPrimaryDebugState);

  const isDebug = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).has('commentDebug');

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

  const markPrimaryDebugLoading = useCallback(() => {
    setPrimaryDebug((previous) => ({
      ...previous,
      loading: true,
      error: ''
    }));
  }, []);

  const applyPrimaryDebugSuccess = useCallback((response) => {
    setPrimaryDebug({
      loading: false,
      error: '',
      count: Number(response?.count ?? 0),
      totalPages: Number(response?.totalPages ?? 0)
    });
  }, []);

  const applyPrimaryDebugError = useCallback((error) => {
    setPrimaryDebug({
      loading: false,
      error: error instanceof Error ? error.message : 'primary load failed',
      count: null,
      totalPages: null
    });
  }, []);

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

  useEffect(() => {
    if (!isDebug || !serverURL || !path) {
      return undefined;
    }

    const controller = typeof AbortController !== 'undefined'
      ? new AbortController()
      : null;
    let canceled = false;

    const loadPrimaryDebug = async () => {
      markPrimaryDebugLoading();
      try {
        const response = await getComment({
          serverURL,
          lang: 'zh-CN',
          path,
          page: 1,
          pageSize: 1,
          sortBy: COMMENT_SORT_BY,
          signal: controller?.signal
        });
        if (canceled) return;
        applyPrimaryDebugSuccess(response);
      } catch (error) {
        if (canceled) return;
        applyPrimaryDebugError(error);
      }
    };

    void loadPrimaryDebug();

    return () => {
      canceled = true;
      controller?.abort();
    };
  }, [
    applyPrimaryDebugError,
    applyPrimaryDebugSuccess,
    isDebug,
    markPrimaryDebugLoading,
    path,
    serverURL
  ]);

  const resolvedPrimaryDebug = isDebug && serverURL && path
    ? primaryDebug
    : createPrimaryDebugState();

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
      {isDebug ? (
        <div className="comment-section-debug">
          <div className="comment-section-debug-row">
            <span>server</span>
            <code>{serverURL || 'empty'}</code>
          </div>
          <div className="comment-section-debug-row">
            <span>primary path</span>
            <code>{path || 'empty'}</code>
          </div>
          <div className="comment-section-debug-row">
              <span>primary count</span>
              <code>
              {resolvedPrimaryDebug.loading ? 'loading' : `${resolvedPrimaryDebug.count ?? 'n/a'} / ${resolvedPrimaryDebug.totalPages ?? 'n/a'}`}
            </code>
          </div>
          {resolvedPrimaryDebug.error ? (
            <div className="comment-section-debug-row is-error">
              <span>primary error</span>
              <code>{resolvedPrimaryDebug.error}</code>
            </div>
          ) : null}
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

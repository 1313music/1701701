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

const LEGACY_COMMENT_PAGE_SIZE = 100;
const LEGACY_COMMENT_SORT_BY = 'insertedAt_asc';
const EMPTY_LEGACY_PATHS = [];

const flattenCommentTree = (comments, depth = 0) => comments.flatMap((comment) => ([
  { ...comment, depth },
  ...flattenCommentTree(comment.children || [], depth + 1)
]));

const formatCommentTime = (value) => {
  if (!Number.isFinite(value)) return '';
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value));
  } catch {
    return '';
  }
};

const CommentSection = ({
  serverURL,
  path = 'page:home',
  legacyPaths = EMPTY_LEGACY_PATHS,
  title = '留言板',
  subtitle = ''
}) => {
  const containerRef = useRef(null);
  const walineRef = useRef(null);
  const syncTimerRef = useRef(null);
  const observerRef = useRef(null);
  const latestPathRef = useRef(path);
  const [authRefreshKey, setAuthRefreshKey] = useState(0);
  const [legacyComments, setLegacyComments] = useState([]);

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

  useEffect(() => {
    if (!serverURL || legacyPaths.length === 0) {
      setLegacyComments((previous) => (previous.length === 0 ? previous : []));
      return undefined;
    }

    const controller = typeof AbortController !== 'undefined'
      ? new AbortController()
      : null;
    let canceled = false;

    const loadLegacyComments = async () => {
      try {
        const responses = await Promise.all(legacyPaths.map(async (legacyPath) => {
          const firstPage = await getComment({
            serverURL,
            lang: 'zh-CN',
            path: legacyPath,
            page: 1,
            pageSize: LEGACY_COMMENT_PAGE_SIZE,
            sortBy: LEGACY_COMMENT_SORT_BY,
            signal: controller?.signal
          });

          const totalPages = Math.max(Number(firstPage?.totalPages) || 1, 1);
          const pages = [firstPage];
          for (let page = 2; page <= totalPages; page += 1) {
            pages.push(await getComment({
              serverURL,
              lang: 'zh-CN',
              path: legacyPath,
              page,
              pageSize: LEGACY_COMMENT_PAGE_SIZE,
              sortBy: LEGACY_COMMENT_SORT_BY,
              signal: controller?.signal
            }));
          }

          return pages.flatMap((page) => flattenCommentTree(page?.data || []));
        }));

        if (canceled) return;

        const mergedComments = [];
        const seenCommentIds = new Set();
        responses.flat().forEach((comment) => {
          const objectId = Number(comment?.objectId);
          if (!Number.isFinite(objectId) || seenCommentIds.has(objectId)) return;
          seenCommentIds.add(objectId);
          mergedComments.push(comment);
        });

        mergedComments.sort((left, right) => (
          (Number(left?.time) || 0) - (Number(right?.time) || 0)
        ));
        setLegacyComments(mergedComments);
      } catch {
        if (canceled) return;
        setLegacyComments([]);
      }
    };

    void loadLegacyComments();

    return () => {
      canceled = true;
      controller?.abort();
    };
  }, [legacyPaths, serverURL]);

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
      {legacyComments.length > 0 ? (
        <div className="comment-section-legacy">
          <div className="comment-section-legacy-head">
            <h3>历史评论</h3>
            <p>已自动合并早期不同评论路径下的单曲评论。</p>
          </div>
          <div className="comment-section-legacy-list">
            {legacyComments.map((comment) => (
              <article
                key={comment.objectId}
                className="comment-section-legacy-item"
                style={{ '--legacy-comment-depth': comment.depth || 0 }}
              >
                <div className="comment-section-legacy-meta">
                  <span className="comment-section-legacy-author">{comment.nick || '匿名'}</span>
                  <span className="comment-section-legacy-time">{formatCommentTime(comment.time)}</span>
                </div>
                <div className="comment-section-legacy-content">{comment.orig || comment.comment || ''}</div>
              </article>
            ))}
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

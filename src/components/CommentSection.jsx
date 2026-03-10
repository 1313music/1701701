import React, { useEffect, useRef } from 'react';
import { init } from '@waline/client';
import '@waline/client/style';

const CommentSection = ({ serverURL, path = 'page:home', title = '留言板', subtitle = '' }) => {
  const containerRef = useRef(null);
  const walineRef = useRef(null);

  const syncHeaderPlaceholders = () => {
    const root = containerRef.current;
    if (!root) return;
    const headerItems = root.querySelectorAll('.wl-header-item');
    headerItems.forEach((item) => {
      const label = item.querySelector('label');
      const input = item.querySelector('input');
      if (!label || !input) return;
      const text = label.textContent?.trim();
      if (!text) return;
      if (!input.placeholder) {
        input.placeholder = text;
      }
      input.setAttribute('aria-label', text);
    });
    const textarea = root.querySelector('textarea');
    if (textarea) {
      textarea.placeholder = '音乐和心情都可以留在这里';
    }
  };

  const scheduleHeaderSync = () => {
    syncHeaderPlaceholders();
    if (typeof window !== 'undefined' && window.requestAnimationFrame) {
      window.requestAnimationFrame(syncHeaderPlaceholders);
    }
    setTimeout(syncHeaderPlaceholders, 120);
  };

  useEffect(() => {
    if (!containerRef.current || !serverURL) return undefined;
    walineRef.current = init({
      el: containerRef.current,
      serverURL,
      path,
      lang: 'zh-CN',
      locale: {
        comment: '留言',
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

    return () => {
      if (walineRef.current?.destroy) {
        walineRef.current.destroy();
      }
      walineRef.current = null;
    };
  }, [serverURL]);

  useEffect(() => {
    if (!walineRef.current?.update || !path) return;
    walineRef.current.update({ path });
    scheduleHeaderSync();
  }, [path]);

  return (
    <section className="comment-section">
      <div className="comment-section-header">
        <div>
          <h2 className="comment-section-title">{title}</h2>
          {subtitle ? <p className="comment-section-subtitle">{subtitle}</p> : null}
        </div>
      </div>
      {!serverURL ? (
        <div className="comment-section-empty">未配置评论服务地址</div>
      ) : (
        <div ref={containerRef} className="comment-section-body" />
      )}
    </section>
  );
};

export default CommentSection;

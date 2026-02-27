import { useEffect, useMemo, useState } from 'react';

const IOS_PWA_GUIDE_DISMISSED_KEY = 'iosPwaGuideDismissed';

const isIOS = () => {
  if (typeof navigator === 'undefined') return false;
  return /iP(hone|ad|od)/i.test(navigator.userAgent || '');
};

const isSafari = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Safari/i.test(ua) && !/(CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|MicroMessenger)/i.test(ua);
};

const isStandalone = () => {
  if (typeof window === 'undefined') return false;
  const mqStandalone = window.matchMedia?.('(display-mode: standalone)')?.matches;
  const navStandalone = window.navigator?.standalone === true;
  return Boolean(mqStandalone || navStandalone);
};

const IosPwaGuide = ({ blocked = false }) => {
  const [open, setOpen] = useState(false);

  const eligible = useMemo(() => {
    if (typeof window === 'undefined') return false;
    if (!isIOS() || !isSafari() || isStandalone()) return false;
    try {
      return window.localStorage.getItem(IOS_PWA_GUIDE_DISMISSED_KEY) !== '1';
    } catch {
      return true;
    }
  }, []);

  useEffect(() => {
    if (!eligible) return;
    const timer = window.setTimeout(() => setOpen(true), 1200);
    return () => window.clearTimeout(timer);
  }, [eligible]);

  const closeNow = () => {
    setOpen(false);
  };

  const closeForever = () => {
    try {
      window.localStorage.setItem(IOS_PWA_GUIDE_DISMISSED_KEY, '1');
    } catch {
      // ignore
    }
    setOpen(false);
  };

  if (!eligible || !open || blocked) return null;

  return (
    <div className="ios-pwa-guide" role="dialog" aria-modal="false" aria-labelledby="ios-pwa-guide-title">
      <div className="ios-pwa-guide-card">
        <div className="ios-pwa-guide-title" id="ios-pwa-guide-title">添加到 iPhone 主屏幕</div>
        <ol className="ios-pwa-guide-steps">
          <li>点击 Safari 底部的“共享”按钮。</li>
          <li>选择“添加到主屏幕”。</li>
          <li>点击右上角“添加”。</li>
        </ol>
        <div className="ios-pwa-guide-actions">
          <button
            type="button"
            className="ios-pwa-guide-btn ghost"
            onClick={closeForever}
          >
            不再提示
          </button>
          <button
            type="button"
            className="ios-pwa-guide-btn primary"
            onClick={closeNow}
          >
            我知道了
          </button>
        </div>
      </div>
    </div>
  );
};

export default IosPwaGuide;

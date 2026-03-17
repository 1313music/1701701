import { useEffect, useMemo, useState } from 'react';

import '../styles/pwa-guide.css';

const IOS_PWA_AUDIO_NOTICE_DISMISSED_KEY = 'iosPwaAudioNoticeDismissed';

const isIOS = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';
  const maxTouchPoints = navigator.maxTouchPoints || 0;
  return /iP(hone|ad|od)/i.test(ua) || (platform === 'MacIntel' && maxTouchPoints > 1);
};

const isStandalone = () => {
  if (typeof window === 'undefined') return false;
  const mqStandalone = window.matchMedia?.('(display-mode: standalone)')?.matches;
  const navStandalone = window.navigator?.standalone === true;
  return Boolean(mqStandalone || navStandalone);
};

const IosPwaAudioNotice = ({ blocked = false, onCopyLink }) => {
  const [open, setOpen] = useState(false);

  const eligible = useMemo(() => {
    if (typeof window === 'undefined') return false;
    if (!isIOS() || !isStandalone()) return false;
    try {
      return window.localStorage.getItem(IOS_PWA_AUDIO_NOTICE_DISMISSED_KEY) !== '1';
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
      window.localStorage.setItem(IOS_PWA_AUDIO_NOTICE_DISMISSED_KEY, '1');
    } catch {
      // ignore storage errors
    }
    setOpen(false);
  };

  const handleCopyLink = () => {
    if (typeof window === 'undefined') return;
    onCopyLink?.(window.location.href);
  };

  if (!eligible || !open || blocked) return null;

  return (
    <div className="ios-pwa-guide" role="dialog" aria-modal="false" aria-labelledby="ios-pwa-audio-notice-title">
      <div className="ios-pwa-guide-card">
        <div className="ios-pwa-guide-title" id="ios-pwa-audio-notice-title">温馨提示</div>
        <ol className="ios-pwa-guide-steps">
          <li>当前为 PWA 主屏模式，锁屏/后台播放可能异常。</li>
          <li>建议用 Safari 打开，播放更稳定。</li>
        </ol>
        <div className="ios-pwa-guide-actions">
          <button
            type="button"
            className="ios-pwa-guide-btn ghost"
            onClick={handleCopyLink}
          >
            复制链接
          </button>
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

export default IosPwaAudioNotice;

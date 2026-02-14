import { useCallback, useRef, useState } from 'react';

const VIDEO_PASSWORD = '1701701xyz';
const VIDEO_ACCESS_KEY = 'videoAccessGranted';
const VIDEO_ACCESS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const persistVideoAccessGrant = () => {
  if (typeof window === 'undefined') return;
  const payload = {
    granted: true,
    expiresAt: Date.now() + VIDEO_ACCESS_TTL_MS
  };
  try {
    window.localStorage.setItem(VIDEO_ACCESS_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
};

const readVideoAccessGranted = () => {
  if (typeof window === 'undefined') return false;
  let raw = null;
  try {
    raw = window.localStorage.getItem(VIDEO_ACCESS_KEY);
  } catch {
    return false;
  }
  if (!raw) return false;

  if (raw === 'true') {
    persistVideoAccessGrant();
    return true;
  }

  try {
    const parsed = JSON.parse(raw);
    const expiresAt = Number(parsed?.expiresAt);
    if (parsed?.granted === true && Number.isFinite(expiresAt) && expiresAt > Date.now()) {
      return true;
    }
  } catch {
    // ignore parse errors and clear below
  }

  try {
    window.localStorage.removeItem(VIDEO_ACCESS_KEY);
  } catch {
    // ignore storage errors
  }
  return false;
};

export const useVideoAccess = () => {
  const [isVideoAccessOpen, setIsVideoAccessOpen] = useState(false);
  const [videoPassword, setVideoPassword] = useState('');
  const [videoPasswordError, setVideoPasswordError] = useState('');
  const [isVideoAccessGranted, setIsVideoAccessGranted] = useState(() => readVideoAccessGranted());
  const pendingGrantActionRef = useRef(null);

  const closeVideoAccessModal = useCallback(() => {
    pendingGrantActionRef.current = null;
    setIsVideoAccessOpen(false);
    setVideoPassword('');
    setVideoPasswordError('');
  }, []);

  const requestVideoView = useCallback((onGranted) => {
    const hasValidVideoAccess = readVideoAccessGranted();
    if (hasValidVideoAccess !== isVideoAccessGranted) {
      setIsVideoAccessGranted(hasValidVideoAccess);
    }
    if (!hasValidVideoAccess) {
      pendingGrantActionRef.current = typeof onGranted === 'function' ? onGranted : null;
      setVideoPassword('');
      setVideoPasswordError('');
      setIsVideoAccessOpen(true);
      return false;
    }
    pendingGrantActionRef.current = null;
    onGranted?.();
    return true;
  }, [isVideoAccessGranted]);

  const submitVideoAccess = useCallback((onGranted) => {
    const input = videoPassword.trim();
    if (input === VIDEO_PASSWORD) {
      setIsVideoAccessGranted(true);
      persistVideoAccessGrant();
      const callback = pendingGrantActionRef.current || onGranted;
      pendingGrantActionRef.current = null;
      closeVideoAccessModal();
      callback?.();
      return true;
    }
    setVideoPasswordError('密码不正确');
    return false;
  }, [closeVideoAccessModal, videoPassword]);

  return {
    isVideoAccessOpen,
    setIsVideoAccessOpen,
    videoPassword,
    setVideoPassword,
    videoPasswordError,
    setVideoPasswordError,
    isVideoAccessGranted,
    closeVideoAccessModal,
    requestVideoView,
    submitVideoAccess
  };
};

import { useCallback, useRef, useState } from 'react';

import {
  DEFAULT_VIDEO_ACCESS_CONFIG,
  loadVideoAccessConfig
} from '../data/videoAccessConfig.js';

const VIDEO_ACCESS_KEY = 'videoAccessGranted';
const VIDEO_ACCESS_TTL_MS = 365 * 24 * 60 * 60 * 1000;
const LEGACY_VIDEO_ACCESS_VERSION = 'build-time';

const getPasswordVersion = (config) => String(
  config?.passwordVersion || LEGACY_VIDEO_ACCESS_VERSION
).trim() || LEGACY_VIDEO_ACCESS_VERSION;

const persistVideoAccessGrant = (passwordVersion) => {
  if (typeof window === 'undefined') return;
  const payload = {
    granted: true,
    expiresAt: Date.now() + VIDEO_ACCESS_TTL_MS,
    passwordVersion: getPasswordVersion({ passwordVersion })
  };
  try {
    window.localStorage.setItem(VIDEO_ACCESS_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
};

const readVideoAccessGranted = (passwordVersion) => {
  if (typeof window === 'undefined') return false;
  const currentVersion = getPasswordVersion({ passwordVersion });
  let raw = null;
  try {
    raw = window.localStorage.getItem(VIDEO_ACCESS_KEY);
  } catch {
    return false;
  }
  if (!raw) return false;

  if (raw === 'true') {
    if (currentVersion === LEGACY_VIDEO_ACCESS_VERSION) {
      persistVideoAccessGrant(currentVersion);
      return true;
    }
    return false;
  }

  try {
    const parsed = JSON.parse(raw);
    const expiresAt = Number(parsed?.expiresAt);
    if (
      parsed?.granted === true
      && Number.isFinite(expiresAt)
      && expiresAt > Date.now()
    ) {
      return String(parsed?.passwordVersion || '') === currentVersion;
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
  const [videoAccessConfig, setVideoAccessConfig] = useState(() => DEFAULT_VIDEO_ACCESS_CONFIG);
  const [isVideoAccessGranted, setIsVideoAccessGranted] = useState(() => (
    readVideoAccessGranted(getPasswordVersion(DEFAULT_VIDEO_ACCESS_CONFIG))
  ));
  const videoAccessConfigRef = useRef(DEFAULT_VIDEO_ACCESS_CONFIG);
  const isVideoAccessGrantedRef = useRef(isVideoAccessGranted);
  const pendingGrantActionRef = useRef(null);

  const setVideoAccessGrantedState = useCallback((granted) => {
    isVideoAccessGrantedRef.current = granted;
    setIsVideoAccessGranted(granted);
  }, []);

  const applyVideoAccessConfig = useCallback((config) => {
    const nextConfig = config || DEFAULT_VIDEO_ACCESS_CONFIG;
    const passwordVersion = getPasswordVersion(nextConfig);
    const granted = readVideoAccessGranted(passwordVersion);
    videoAccessConfigRef.current = nextConfig;
    setVideoAccessConfig(nextConfig);
    setVideoAccessGrantedState(granted);
    return { config: nextConfig, granted };
  }, [setVideoAccessGrantedState]);

  const refreshVideoAccessConfig = useCallback(async (options) => {
    const config = await loadVideoAccessConfig(options);
    return applyVideoAccessConfig(config);
  }, [applyVideoAccessConfig]);

  const closeVideoAccessModal = useCallback(() => {
    pendingGrantActionRef.current = null;
    setIsVideoAccessOpen(false);
    setVideoPassword('');
    setVideoPasswordError('');
  }, []);

  const requestVideoView = useCallback((onGranted) => {
    pendingGrantActionRef.current = typeof onGranted === 'function' ? onGranted : null;

    const resolveAccess = async () => {
      const { config, granted } = await refreshVideoAccessConfig();
      if (config.enabled === false) {
        const callback = pendingGrantActionRef.current || onGranted;
        pendingGrantActionRef.current = null;
        setIsVideoAccessOpen(false);
        setVideoPassword('');
        setVideoPasswordError('');
        callback?.();
        return true;
      }

      if (!granted) {
        setVideoPassword('');
        setVideoPasswordError('');
        setIsVideoAccessOpen(true);
        return false;
      }

      const callback = pendingGrantActionRef.current || onGranted;
      pendingGrantActionRef.current = null;
      callback?.();
      return true;
    };

    void resolveAccess();
    return isVideoAccessGrantedRef.current;
  }, [refreshVideoAccessConfig]);

  const submitVideoAccess = useCallback((onGranted) => {
    const resolveAccess = async () => {
      const { config } = await refreshVideoAccessConfig();
      const input = videoPassword.trim();
      if (input === String(config.password || '').trim()) {
        const passwordVersion = getPasswordVersion(config);
        setVideoAccessGrantedState(true);
        persistVideoAccessGrant(passwordVersion);
        const callback = pendingGrantActionRef.current || onGranted;
        pendingGrantActionRef.current = null;
        closeVideoAccessModal();
        callback?.();
        return true;
      }

      setVideoAccessGrantedState(false);
      setVideoPasswordError('密码不正确');
      return false;
    };

    void resolveAccess();
    return false;
  }, [closeVideoAccessModal, refreshVideoAccessConfig, setVideoAccessGrantedState, videoPassword]);

  return {
    isVideoAccessOpen,
    setIsVideoAccessOpen,
    videoPassword,
    setVideoPassword,
    videoPasswordError,
    setVideoPasswordError,
    isVideoAccessGranted,
    videoAccessConfig,
    closeVideoAccessModal,
    requestVideoView,
    submitVideoAccess
  };
};

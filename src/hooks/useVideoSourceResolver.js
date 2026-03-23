import { useCallback, useEffect, useRef, useState } from 'react';

const createEmptyResolvedSource = (error = '') => ({
  url: '',
  type: 'auto',
  error
});

export const useVideoSourceResolver = ({ activeVideo, activeVideoKey }) => {
  const [resolvedUrl, setResolvedUrl] = useState('');
  const [fallbackUrl, setFallbackUrl] = useState('');
  const [fallbackType, setFallbackType] = useState('auto');
  const [sourceAttempt, setSourceAttempt] = useState(0);
  const [resolveAttempt, setResolveAttempt] = useState(0);
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState('');
  const [resolvedType, setResolvedType] = useState('auto');
  const [resolvedVideoKey, setResolvedVideoKey] = useState('');
  const fallbackTriedRef = useRef(false);

  const canPlayInline = useCallback(
    (url = '', type = 'auto') => type === 'hls' || /\.(mp4|m3u8|webm|ogg)(\?|$)/i.test(url),
    []
  );

  const resolvePlayableSource = useCallback(async (rawUrl = '') => {
    let url = rawUrl || '';
    let type = 'auto';

    if (!url) {
      return { url: '', type: 'auto', error: '视频地址为空' };
    }

    if (/\.m3u8(\?|$)/i.test(url)) {
      type = 'hls';
    }

    if (/\.js(\?|$)/i.test(url)) {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`bad-status-${res.status}`);
      }
      const text = await res.text();
      const trimmed = text.trimStart();
      if (trimmed.startsWith('#EXTM3U')) {
        type = 'hls';
      }
      const directMatch = text.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/i);
      const quotedMatch = text.match(/['"]([^'"]+\.m3u8[^'"]*)['"]/i);
      const candidate = directMatch?.[0] || quotedMatch?.[1];
      if (candidate) {
        url = /^https?:\/\//i.test(candidate)
          ? candidate
          : new URL(candidate, url).href;
        type = 'hls';
      } else if (!trimmed.startsWith('#EXTM3U')) {
        return { url: '', type: 'auto', error: '未找到可播放的 m3u8 地址' };
      }
    }

    return { url, type, error: '' };
  }, []);

  const resolvePlayableSourceSafely = useCallback(async (rawUrl = '') => {
    try {
      return await resolvePlayableSource(rawUrl);
    } catch {
      return createEmptyResolvedSource('解析播放地址失败');
    }
  }, [resolvePlayableSource]);

  useEffect(() => {
    if (!activeVideo) {
      setResolvedUrl('');
      setFallbackUrl('');
      setFallbackType('auto');
      setSourceAttempt(0);
      setResolveAttempt(0);
      setResolveError('');
      setIsResolving(false);
      setResolvedType('auto');
      setResolvedVideoKey('');
      fallbackTriedRef.current = false;
      return;
    }

    let canceled = false;
    const targetVideoKey = activeVideoKey;
    const resolveUrl = async () => {
      setResolvedUrl('');
      setResolvedType('auto');
      setFallbackUrl('');
      setFallbackType('auto');
      setResolvedVideoKey('');
      setResolveError('');
      setIsResolving(true);
      fallbackTriedRef.current = false;

      try {
        const [primary, backup] = await Promise.all([
          resolvePlayableSourceSafely(activeVideo.url || ''),
          activeVideo.backupUrl
            ? resolvePlayableSourceSafely(activeVideo.backupUrl)
            : Promise.resolve(createEmptyResolvedSource())
        ]);

        if (canceled) return;

        setFallbackUrl(backup.url || '');
        setFallbackType(backup.type || 'auto');

        if (primary.url) {
          setResolvedUrl(primary.url);
          setResolvedType(primary.type);
          setResolvedVideoKey(targetVideoKey);
          return;
        }

        if (backup.url) {
          fallbackTriedRef.current = true;
          setResolvedUrl(backup.url);
          setResolvedType(backup.type);
          setResolvedVideoKey(targetVideoKey);
          return;
        }

        setResolvedUrl('');
        setResolvedType('auto');
        setResolvedVideoKey('');
      } finally {
        if (!canceled) {
          setIsResolving(false);
        }
      }
    };

    void resolveUrl();
    return () => {
      canceled = true;
    };
  }, [activeVideo, activeVideoKey, resolveAttempt, resolvePlayableSourceSafely]);

  const trySwitchToFallback = useCallback(() => {
    if (!fallbackUrl || resolvedUrl === fallbackUrl || fallbackTriedRef.current) {
      return false;
    }
    fallbackTriedRef.current = true;
    setResolveError('');
    setResolvedUrl(fallbackUrl);
    setResolvedType(fallbackType || 'auto');
    setSourceAttempt((value) => value + 1);
    return true;
  }, [fallbackType, fallbackUrl, resolvedUrl]);

  const handleSwitchToBackup = useCallback(() => {
    if (!fallbackUrl) return;
    fallbackTriedRef.current = true;
    setResolveError('');
    setResolvedUrl(fallbackUrl);
    setResolvedType(fallbackType || 'auto');
    setResolvedVideoKey(activeVideoKey);
    setSourceAttempt((value) => value + 1);
  }, [activeVideoKey, fallbackType, fallbackUrl]);

  const handleReloadVideo = useCallback(() => {
    if (!activeVideo) return;
    fallbackTriedRef.current = false;
    setResolvedUrl('');
    setResolvedType('auto');
    setResolvedVideoKey('');
    setResolveError('');
    setSourceAttempt((value) => value + 1);
    setResolveAttempt((value) => value + 1);
  }, [activeVideo]);

  const setPlaybackError = useCallback((message) => {
    setResolveError(message);
  }, []);

  return {
    resolvedUrl,
    fallbackUrl,
    fallbackType,
    isResolving,
    resolveError,
    resolvedType,
    resolvedVideoKey,
    canPlayInline,
    canSwitchToBackup: Boolean(fallbackUrl),
    backupActionLabel: resolvedUrl === fallbackUrl ? '重试备用链接' : '切换备用链接',
    playerContainerKey: `${resolvedVideoKey || activeVideoKey || 'video'}:${sourceAttempt}:${resolveAttempt}`,
    handleSwitchToBackup,
    handleReloadVideo,
    trySwitchToFallback,
    setPlaybackError
  };
};

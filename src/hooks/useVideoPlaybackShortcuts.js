import { useEffect } from 'react';

export const useVideoPlaybackShortcuts = ({ activeVideo, dpRef, nextWatchEpisode, prevWatchEpisode, setActiveVideo }) => {
  useEffect(() => {
    if (!activeVideo) return undefined;
    const isEditableTarget = (target) => (
      target instanceof HTMLElement &&
      Boolean(target.closest('input, textarea, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]'))
    );

    const handlePlaybackHotkey = (event) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (isEditableTarget(event.target)) return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

      const video = dpRef.current?.video;
      if (!video) return;

      const currentTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
      const duration = Number.isFinite(video.duration) ? video.duration : Number.POSITIVE_INFINITY;
      const delta = event.key === 'ArrowLeft' ? -10 : 10;
      const nextTime = Math.min(Math.max(currentTime + delta, 0), duration);

      if (nextTime === currentTime) return;
      video.currentTime = nextTime;
      if (video.paused && typeof video.play === 'function') {
        void video.play().catch(() => {});
      }
      event.preventDefault();
    };

    document.addEventListener('keydown', handlePlaybackHotkey);
    return () => {
      document.removeEventListener('keydown', handlePlaybackHotkey);
    };
  }, [activeVideo, dpRef]);

  useEffect(() => {
    if (!activeVideo) return undefined;
    const handleEpisodeHotkey = (event) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === '[' && prevWatchEpisode) {
        event.preventDefault();
        setActiveVideo(prevWatchEpisode);
      }
      if (event.key === ']' && nextWatchEpisode) {
        event.preventDefault();
        setActiveVideo(nextWatchEpisode);
      }
    };
    document.addEventListener('keydown', handleEpisodeHotkey);
    return () => {
      document.removeEventListener('keydown', handleEpisodeHotkey);
    };
  }, [activeVideo, nextWatchEpisode, prevWatchEpisode, setActiveVideo]);
};

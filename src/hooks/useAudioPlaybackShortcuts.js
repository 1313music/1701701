import { useEffect } from 'react';

const isEditableOrInteractiveTarget = (target) => (
  target instanceof HTMLElement &&
  Boolean(target.closest(
    'input, textarea, select, button, a, [role="button"], [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]'
  ))
);

const getAudioDuration = (audio, fallbackDuration) => {
  if (Number.isFinite(audio.duration) && audio.duration > 0) return audio.duration;
  if (Number.isFinite(fallbackDuration) && fallbackDuration > 0) return fallbackDuration;
  return Number.POSITIVE_INFINITY;
};

export const useAudioPlaybackShortcuts = ({
  audioRef,
  duration,
  enabled,
  handleNext,
  handlePlayPause,
  handlePrev
}) => {
  useEffect(() => {
    if (!enabled) return undefined;

    const handleKeyDown = (event) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (isEditableOrInteractiveTarget(event.target)) return;

      const audio = audioRef.current;
      if (!audio) return;

      if (event.key === ' ' || event.key === 'Spacebar' || event.code === 'Space') {
        event.preventDefault();
        handlePlayPause();
        return;
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        const currentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
        const maxDuration = getAudioDuration(audio, duration);
        const delta = event.key === 'ArrowLeft' ? -10 : 10;
        const nextTime = Math.min(Math.max(currentTime + delta, 0), maxDuration);
        if (nextTime !== currentTime) {
          audio.currentTime = nextTime;
          event.preventDefault();
        }
        return;
      }

      if (event.key === '[') {
        event.preventDefault();
        handlePrev();
        return;
      }

      if (event.key === ']') {
        event.preventDefault();
        handleNext();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [audioRef, duration, enabled, handleNext, handlePlayPause, handlePrev]);
};

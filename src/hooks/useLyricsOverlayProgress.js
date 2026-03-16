import { useCallback, useRef, useState } from 'react';

export const useLyricsOverlayProgress = ({ audioRef, duration }) => {
  const isDraggingRef = useRef(false);
  const lastTouchRef = useRef(0);
  const [isDragActive, setIsDragActive] = useState(false);

  const seekByClientX = useCallback((clientX, target) => {
    if (!target || !audioRef.current) return;
    const rect = target.getBoundingClientRect();
    const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    audioRef.current.currentTime = ratio * duration;
  }, [audioRef, duration]);

  const startDrag = useCallback((clientX, target, moveEvent, upEvent, getClientX, options) => {
    if (isDraggingRef.current) return;
    isDraggingRef.current = true;
    seekByClientX(clientX, target);
    setIsDragActive(true);

    const onMove = (moveEventObj) => {
      if (!isDraggingRef.current) return;
      if (moveEventObj.cancelable) moveEventObj.preventDefault();
      const nextX = getClientX(moveEventObj);
      if (typeof nextX === 'number') seekByClientX(nextX, target);
    };
    const onUp = (upEventObj) => {
      const endX = getClientX(upEventObj);
      if (typeof endX === 'number') seekByClientX(endX, target);
      isDraggingRef.current = false;
      setIsDragActive(false);
      window.removeEventListener(moveEvent, onMove, options);
      window.removeEventListener(upEvent, onUp, options);
    };

    window.addEventListener(moveEvent, onMove, options);
    window.addEventListener(upEvent, onUp, options);
  }, [seekByClientX]);

  const handlePointerDown = useCallback((event) => {
    if (isDraggingRef.current) return;
    event.preventDefault();
    startDrag(
      event.clientX,
      event.currentTarget,
      'pointermove',
      'pointerup',
      (moveEvent) => moveEvent.clientX
    );
  }, [startDrag]);

  const handleMouseDown = useCallback((event) => {
    if (Date.now() - lastTouchRef.current < 500) return;
    if (isDraggingRef.current) return;
    event.preventDefault();
    startDrag(
      event.clientX,
      event.currentTarget,
      'mousemove',
      'mouseup',
      (moveEvent) => moveEvent.clientX
    );
  }, [startDrag]);

  const handleTouchStart = useCallback((event) => {
    if (isDraggingRef.current) return;
    const touch = event.touches[0];
    if (!touch) return;
    lastTouchRef.current = Date.now();
    const options = { passive: false };
    startDrag(
      touch.clientX,
      event.currentTarget,
      'touchmove',
      'touchend',
      (moveEvent) => {
        const nextTouch = moveEvent.touches && moveEvent.touches[0]
          ? moveEvent.touches[0]
          : moveEvent.changedTouches && moveEvent.changedTouches[0];
        return nextTouch ? nextTouch.clientX : undefined;
      },
      options
    );
  }, [startDrag]);

  return {
    isDragActive,
    handlePointerDown,
    handleMouseDown,
    handleTouchStart
  };
};

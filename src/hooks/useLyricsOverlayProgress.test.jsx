import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useLyricsOverlayProgress } from './useLyricsOverlayProgress.js';

const createClientXEvent = (type, clientX, cancelable = true) => {
  const event = new Event(type, { bubbles: true, cancelable });
  Object.defineProperty(event, 'clientX', { configurable: true, value: clientX });
  return event;
};

const createTouchEvent = (type, touches, changedTouches = touches) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'touches', { configurable: true, value: touches });
  Object.defineProperty(event, 'changedTouches', { configurable: true, value: changedTouches });
  return event;
};

const createTarget = () => ({
  getBoundingClientRect: () => ({
    left: 100,
    width: 200
  })
});

describe('useLyricsOverlayProgress', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('seeks on pointer drag start, move, and release', () => {
    const audioRef = { current: { currentTime: 0 } };
    const { result } = renderHook(() => useLyricsOverlayProgress({
      audioRef,
      duration: 180
    }));

    const preventDefault = vi.fn();

    act(() => {
      result.current.handlePointerDown({
        clientX: 150,
        currentTarget: createTarget(),
        preventDefault
      });
    });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(result.current.isDragActive).toBe(true);
    expect(audioRef.current.currentTime).toBe(45);

    act(() => {
      window.dispatchEvent(createClientXEvent('pointermove', 250));
    });
    expect(audioRef.current.currentTime).toBe(135);

    act(() => {
      window.dispatchEvent(createClientXEvent('pointerup', 300, false));
    });
    expect(audioRef.current.currentTime).toBe(180);
    expect(result.current.isDragActive).toBe(false);
  });

  it('suppresses mouse drag right after a touch drag and handles touchend seeking', () => {
    const audioRef = { current: { currentTime: 0 } };
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1000);

    const { result } = renderHook(() => useLyricsOverlayProgress({
      audioRef,
      duration: 180
    }));

    act(() => {
      result.current.handleTouchStart({
        touches: [{ clientX: 100 }],
        currentTarget: createTarget()
      });
    });

    expect(result.current.isDragActive).toBe(true);
    expect(audioRef.current.currentTime).toBe(0);

    nowSpy.mockReturnValue(1100);
    act(() => {
      window.dispatchEvent(createTouchEvent('touchend', [], [{ clientX: 200 }]));
    });

    expect(audioRef.current.currentTime).toBe(90);
    expect(result.current.isDragActive).toBe(false);

    const preventDefault = vi.fn();
    nowSpy.mockReturnValue(1200);
    act(() => {
      result.current.handleMouseDown({
        clientX: 250,
        currentTarget: createTarget(),
        preventDefault
      });
    });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(audioRef.current.currentTime).toBe(90);
  });
});


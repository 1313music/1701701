import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAudioPlaybackShortcuts } from './useAudioPlaybackShortcuts.js';

const createProps = (overrides = {}) => ({
  audioRef: {
    current: {
      currentTime: 50,
      duration: 120
    }
  },
  duration: 120,
  enabled: true,
  handleNext: vi.fn(),
  handlePlayPause: vi.fn(),
  handlePrev: vi.fn(),
  ...overrides
});

const pressKey = (key, options = {}) => {
  document.dispatchEvent(new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    key,
    ...options
  }));
};

describe('useAudioPlaybackShortcuts', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('toggles playback from Space when enabled', () => {
    const props = createProps();
    renderHook(() => useAudioPlaybackShortcuts(props));

    act(() => {
      pressKey(' ', { code: 'Space' });
    });

    expect(props.handlePlayPause).toHaveBeenCalledTimes(1);
  });

  it('seeks with arrow keys and clamps to the known duration', () => {
    const props = createProps();
    renderHook(() => useAudioPlaybackShortcuts(props));

    act(() => {
      pressKey('ArrowRight');
    });
    expect(props.audioRef.current.currentTime).toBe(60);

    act(() => {
      pressKey('ArrowLeft');
    });
    expect(props.audioRef.current.currentTime).toBe(50);

    props.audioRef.current.currentTime = 116;
    act(() => {
      pressKey('ArrowRight');
    });
    expect(props.audioRef.current.currentTime).toBe(120);
  });

  it('switches tracks with bracket keys', () => {
    const props = createProps();
    renderHook(() => useAudioPlaybackShortcuts(props));

    act(() => {
      pressKey('[');
      pressKey(']');
    });

    expect(props.handlePrev).toHaveBeenCalledTimes(1);
    expect(props.handleNext).toHaveBeenCalledTimes(1);
  });

  it('ignores disabled state and editable targets', () => {
    const disabledProps = createProps({ enabled: false });
    renderHook(() => useAudioPlaybackShortcuts(disabledProps));

    act(() => {
      pressKey(' ', { code: 'Space' });
    });
    expect(disabledProps.handlePlayPause).not.toHaveBeenCalled();

    const enabledProps = createProps();
    renderHook(() => useAudioPlaybackShortcuts(enabledProps));
    const input = document.createElement('input');
    document.body.appendChild(input);

    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        code: 'Space',
        key: ' '
      }));
    });

    expect(enabledProps.handlePlayPause).not.toHaveBeenCalled();
    input.remove();
  });
});

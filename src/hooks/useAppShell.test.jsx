import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useAppShell } from './useAppShell.js';

describe('useAppShell', () => {
  it('defaults the desktop sidebar to collapsed', () => {
    const { result } = renderHook(() => useAppShell({
      currentTrackSrc: '',
      pausePlayback: undefined,
      trackChangeId: 0
    }));

    expect(result.current.isSidebarCollapsed).toBe(true);
    expect(result.current.isSidebarOpen).toBe(false);
  });
});

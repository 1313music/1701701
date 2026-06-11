import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSharePanel } from './useSharePanel.js';
import { copyTextToClipboard } from '../utils/appDomUtils.js';

vi.mock('../utils/appDomUtils.js', async () => {
  const actual = await vi.importActual('../utils/appDomUtils.js');
  return {
    ...actual,
    copyTextToClipboard: vi.fn()
  };
});

describe('useSharePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('copies video share links directly without opening the share card panel', async () => {
    copyTextToClipboard.mockResolvedValue(true);
    const showToast = vi.fn();
    const { result } = renderHook(() => useSharePanel({
      getCurrentTrackSharePayload: vi.fn(),
      showToast
    }));
    const anchorOptions = { placement: 'bottom' };

    await act(async () => {
      await result.current.handleShareVideo({
        type: 'video',
        title: '测试视频',
        url: 'https://1701701.xyz/video?videoId=video-1&videoCategory=cat-1'
      }, anchorOptions);
    });

    expect(copyTextToClipboard).toHaveBeenCalledWith('https://1701701.xyz/video?videoId=video-1&videoCategory=cat-1');
    expect(showToast).toHaveBeenCalledWith('视频链接已复制', 'tone-add', anchorOptions);
    expect(result.current.sharePanelData).toBeNull();
    expect(result.current.shareCardDataUrl).toBe('');
    expect(result.current.isShareCardGenerating).toBe(false);
  });
});

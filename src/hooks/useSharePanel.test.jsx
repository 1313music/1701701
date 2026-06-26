import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSharePanel } from './useSharePanel.js';
import {
  copyTextToClipboard,
  isAndroidNativeAppWebView,
  saveShareCardToNativeAlbum
} from '../utils/appDomUtils.js';

vi.mock('../utils/appDomUtils.js', async () => {
  const actual = await vi.importActual('../utils/appDomUtils.js');
  return {
    ...actual,
    copyTextToClipboard: vi.fn(),
    isAndroidNativeAppWebView: vi.fn(),
    saveShareCardToNativeAlbum: vi.fn()
  };
});

vi.mock('../utils/shareCardGenerator.js', () => ({
  createShareCardDataUrl: vi.fn().mockResolvedValue('data:image/png;base64,AA==')
}));

describe('useSharePanel', () => {
  const originalNavigatorShareDescriptor = Object.getOwnPropertyDescriptor(globalThis.navigator, 'share');

  beforeEach(() => {
    vi.clearAllMocks();
    isAndroidNativeAppWebView.mockReturnValue(false);
    saveShareCardToNativeAlbum.mockResolvedValue('unavailable');
  });

  afterEach(() => {
    if (originalNavigatorShareDescriptor) {
      Object.defineProperty(globalThis.navigator, 'share', originalNavigatorShareDescriptor);
    } else {
      delete globalThis.navigator.share;
    }
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

  it('saves generated share cards to the native Android album before system sharing', async () => {
    saveShareCardToNativeAlbum.mockResolvedValue('saved');
    isAndroidNativeAppWebView.mockReturnValue(true);
    const navigatorShare = vi.fn();
    Object.defineProperty(globalThis.navigator, 'share', {
      configurable: true,
      value: navigatorShare
    });
    const showToast = vi.fn();
    const { result } = renderHook(() => useSharePanel({
      getCurrentTrackSharePayload: () => ({
        panelTitle: '分享歌曲',
        title: '测试歌曲 - 李志',
        text: '测试歌曲',
        url: 'https://1701701.xyz/?albumId=1&songId=1',
        trackName: '测试歌曲',
        albumName: '测试专辑',
        cover: ''
      }),
      showToast
    }));

    act(() => {
      result.current.handleShareCurrentTrack();
    });

    await waitFor(() => {
      expect(result.current.shareCardDataUrl).toBe('data:image/png;base64,AA==');
    });

    await act(async () => {
      await result.current.handleShareCardImage();
    });

    expect(saveShareCardToNativeAlbum).toHaveBeenCalledWith(
      'data:image/png;base64,AA==',
      expect.stringMatching(/^1701701-share-card-\d+\.png$/)
    );
    expect(navigatorShare).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('分享卡片已保存到相册', 'tone-add', { placement: 'side' });
  });

  it('shows a native Android save error instead of reporting a browser download', async () => {
    saveShareCardToNativeAlbum.mockResolvedValue('failed');
    isAndroidNativeAppWebView.mockReturnValue(true);
    const navigatorShare = vi.fn();
    Object.defineProperty(globalThis.navigator, 'share', {
      configurable: true,
      value: navigatorShare
    });
    const showToast = vi.fn();
    const { result } = renderHook(() => useSharePanel({
      getCurrentTrackSharePayload: () => ({
        title: '测试歌曲 - 李志',
        text: '测试歌曲',
        url: 'https://1701701.xyz/?albumId=1&songId=1',
        trackName: '测试歌曲',
        albumName: '测试专辑',
        cover: ''
      }),
      showToast
    }));

    act(() => {
      result.current.handleShareCurrentTrack();
    });

    await waitFor(() => {
      expect(result.current.shareCardDataUrl).toBe('data:image/png;base64,AA==');
    });

    await act(async () => {
      await result.current.handleShareCardImage();
    });

    expect(navigatorShare).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('保存失败，请检查相册权限', 'tone-remove', { placement: 'side' });
  });
});

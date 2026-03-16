import { useCallback, useRef, useState } from 'react';

import {
  copyTextToClipboard,
  dataUrlToFile,
  downloadDataUrl,
  isIOSDevice,
  openImagePreviewWindow
} from '../utils/appDomUtils.js';

export const useSharePanel = ({ getCurrentTrackSharePayload, showToast }) => {
  const [sharePanelData, setSharePanelData] = useState(null);
  const [shareCardDataUrl, setShareCardDataUrl] = useState('');
  const [isShareCardGenerating, setIsShareCardGenerating] = useState(false);
  const shareCardRequestIdRef = useRef(0);

  const startShareCardGeneration = useCallback((payload) => {
    if (!payload?.url) return;
    const requestId = ++shareCardRequestIdRef.current;
    setIsShareCardGenerating(true);
    setShareCardDataUrl('');
    void (async () => {
      try {
        const { createShareCardDataUrl } = await import('../utils/shareCardGenerator.js');
        if (shareCardRequestIdRef.current !== requestId) return;
        const dataUrl = await createShareCardDataUrl(payload);
        if (shareCardRequestIdRef.current !== requestId) return;
        setShareCardDataUrl(dataUrl);
      } catch {
        if (shareCardRequestIdRef.current !== requestId) return;
        setShareCardDataUrl('');
        showToast('分享卡片生成失败', 'tone-remove', { placement: 'bottom' });
      } finally {
        if (shareCardRequestIdRef.current === requestId) {
          setIsShareCardGenerating(false);
        }
      }
    })();
  }, [showToast]);

  const closeSharePanel = useCallback(() => {
    shareCardRequestIdRef.current += 1;
    setSharePanelData(null);
    setShareCardDataUrl('');
    setIsShareCardGenerating(false);
  }, []);

  const openSharePanel = useCallback((payload) => {
    if (!payload?.url) return false;
    setSharePanelData(payload);
    startShareCardGeneration(payload);
    return true;
  }, [startShareCardGeneration]);

  const handleShareCurrentTrack = useCallback((anchorOrOptions) => {
    const payload = getCurrentTrackSharePayload?.();
    if (!openSharePanel(payload)) {
      showToast('当前歌曲暂不可分享', 'tone-remove', anchorOrOptions || { placement: 'bottom' });
    }
  }, [getCurrentTrackSharePayload, openSharePanel, showToast]);

  const handleShareVideo = useCallback((payload, anchorOrOptions) => {
    if (!openSharePanel(payload)) {
      showToast('当前视频暂不可分享', 'tone-remove', anchorOrOptions || { placement: 'bottom' });
    }
  }, [openSharePanel, showToast]);

  const handleCopySpecificPageUrl = useCallback(async (url, successMessage, anchorOrOptions) => {
    if (!url) return;
    const copied = await copyTextToClipboard(url);
    showToast(
      copied ? successMessage : '复制失败，请手动复制',
      copied ? 'tone-add' : 'tone-remove',
      anchorOrOptions || { placement: 'bottom' }
    );
  }, [showToast]);

  const handleCopyShareLink = useCallback(async (anchorOrOptions = { placement: 'side' }) => {
    if (!sharePanelData?.url) return;
    const copied = await copyTextToClipboard(sharePanelData.url);
    showToast(
      copied ? '分享链接已复制' : '复制失败，请手动复制',
      copied ? 'tone-add' : 'tone-remove',
      anchorOrOptions
    );
  }, [sharePanelData?.url, showToast]);

  const handleDownloadShareCard = useCallback((anchorOrOptions = { placement: 'side' }) => {
    if (!shareCardDataUrl) return;
    downloadDataUrl(shareCardDataUrl, '1701701-share-card.png');
    showToast('分享卡片已下载', 'tone-add', anchorOrOptions);
  }, [shareCardDataUrl, showToast]);

  const handleShareCardImage = useCallback(async () => {
    if (!shareCardDataUrl) return;
    const file = dataUrlToFile(shareCardDataUrl, `1701701-share-card-${Date.now()}.png`);
    const canUseSystemShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

    if (isIOSDevice() && canUseSystemShare) {
      showToast('在系统菜单选择“保存图像”即可保存到相册', 'tone-add', {
        placement: 'top',
        duration: 3800
      });
    }

    if (canUseSystemShare) {
      try {
        await navigator.share({
          files: [file],
          title: sharePanelData?.title || '1701701 分享卡片',
          text: sharePanelData?.text || ''
        });
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
      }
    }

    if (isIOSDevice()) {
      const opened = openImagePreviewWindow(shareCardDataUrl);
      if (opened) {
        showToast('已打开图片，长按可保存到相册', 'tone-add', { placement: 'side' });
        return;
      }
    }

    handleDownloadShareCard({ placement: 'side' });
  }, [handleDownloadShareCard, shareCardDataUrl, sharePanelData?.text, sharePanelData?.title, showToast]);

  return {
    sharePanelData,
    shareCardDataUrl,
    isShareCardGenerating,
    closeSharePanel,
    handleCopyShareLink,
    handleCopySpecificPageUrl,
    handleShareCardImage,
    handleShareCurrentTrack,
    handleShareVideo
  };
};

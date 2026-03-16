import { useCallback, useMemo, useState } from 'react';

export const useVideoComments = ({ activeVideo, activeVideoKey, commentServerURL, watchCategory }) => {
  const [drawerVideoKey, setDrawerVideoKey] = useState('');

  const currentVideoCommentPath = useMemo(() => (
    activeVideo
      ? `video:${activeVideo._categoryId || watchCategory || 'default'}:${encodeURIComponent(String(activeVideo.id || ''))}:${encodeURIComponent(activeVideo.url || activeVideo.title || '')}`
      : ''
  ), [activeVideo, watchCategory]);

  const canOpenCommentDrawer = Boolean(commentServerURL && currentVideoCommentPath);
  const isCommentDrawerOpen = Boolean(activeVideoKey && drawerVideoKey === activeVideoKey && canOpenCommentDrawer);
  const shouldRenderVideoCommentDrawer = Boolean(isCommentDrawerOpen && canOpenCommentDrawer && activeVideo);

  const handleOpenVideoComment = useCallback(() => {
    if (!canOpenCommentDrawer || !activeVideoKey) return;
    setDrawerVideoKey((prev) => (prev === activeVideoKey ? '' : activeVideoKey));
  }, [activeVideoKey, canOpenCommentDrawer]);

  const closeCommentDrawer = useCallback(() => {
    setDrawerVideoKey('');
  }, []);

  return {
    closeCommentDrawer,
    currentVideoCommentPath,
    canOpenCommentDrawer,
    shouldRenderVideoCommentDrawer,
    handleOpenVideoComment
  };
};

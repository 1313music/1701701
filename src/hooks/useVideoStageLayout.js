import { useEffect, useRef, useState } from 'react';

export const useVideoStageLayout = ({ activeVideo, isResolving, resolveError, resolvedUrl }) => {
  const [stageMainHeight, setStageMainHeight] = useState(0);
  const stageMainRef = useRef(null);

  useEffect(() => {
    if (!activeVideo) return undefined;
    const mainNode = stageMainRef.current;
    if (!mainNode) return undefined;

    const updateHeight = () => {
      const nextHeight = Math.round(mainNode.getBoundingClientRect().height);
      setStageMainHeight((prev) => (Math.abs(prev - nextHeight) < 2 ? prev : nextHeight));
    };

    updateHeight();

    let observer;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => updateHeight());
      observer.observe(mainNode);
    }

    window.addEventListener('resize', updateHeight);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, [activeVideo, isResolving, resolveError, resolvedUrl]);

  return {
    stageMainRef,
    stageMainHeight: activeVideo ? stageMainHeight : 0
  };
};

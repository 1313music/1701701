import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_TONE = 'tone-add';
const DEFAULT_PLACEMENT = 'anchor';

export const useToast = () => {
  const [toastMessage, setToastMessage] = useState('');
  const [isToastVisible, setIsToastVisible] = useState(false);
  const [toastTone, setToastTone] = useState(DEFAULT_TONE);
  const [toastPlacement, setToastPlacement] = useState(DEFAULT_PLACEMENT);
  const toastTimerRef = useRef(null);

  useEffect(() => () => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
  }, []);

  const showToast = useCallback((message, tone = DEFAULT_TONE, anchorOrOptions) => {
    if (!message) return;

    setToastMessage(message);
    setToastTone(tone);

    let anchorEvent = null;
    let placement = DEFAULT_PLACEMENT;
    if (anchorOrOptions?.currentTarget) {
      anchorEvent = anchorOrOptions;
    } else if (anchorOrOptions && typeof anchorOrOptions === 'object') {
      placement = anchorOrOptions.placement || DEFAULT_PLACEMENT;
      anchorEvent = anchorOrOptions.anchorEvent || null;
    }

    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const padding = 12;
      if (anchorEvent?.currentTarget) {
        const rect = anchorEvent.currentTarget.getBoundingClientRect();
        if (placement === 'side') {
          const estimateWidth = 160;
          const shouldFlip = rect.right + estimateWidth + padding > window.innerWidth;
          placement = shouldFlip ? 'side-left' : 'side-right';
          const x = shouldFlip ? rect.left - 12 : rect.right + 12;
          const y = rect.top + rect.height / 2;
          document.documentElement.style.setProperty('--toast-x', `${x}px`);
          document.documentElement.style.setProperty('--toast-y', `${y}px`);
        } else {
          const x = Math.min(
            Math.max(rect.left + rect.width / 2, padding),
            window.innerWidth - padding
          );
          const y = Math.min(Math.max(rect.top, padding), window.innerHeight - padding);
          document.documentElement.style.setProperty('--toast-x', `${x}px`);
          document.documentElement.style.setProperty('--toast-y', `${y}px`);
        }
      } else if (placement === 'side') {
        const sidebar = document.querySelector('.sidebar');
        const sidebarRight = sidebar?.getBoundingClientRect().right || padding;
        const x = sidebarRight + 12;
        const y = window.innerHeight / 2;
        document.documentElement.style.setProperty('--toast-x', `${x}px`);
        document.documentElement.style.setProperty('--toast-y', `${y}px`);
        placement = 'side-right';
      } else if (placement === 'bottom') {
        const x = window.innerWidth / 2;
        const y = Math.max(window.innerHeight - 96, padding);
        document.documentElement.style.setProperty('--toast-x', `${x}px`);
        document.documentElement.style.setProperty('--toast-y', `${y}px`);
      } else {
        document.documentElement.style.setProperty('--toast-x', `${window.innerWidth / 2}px`);
        document.documentElement.style.setProperty('--toast-y', `${padding}px`);
      }
    }

    setToastPlacement(placement);
    setIsToastVisible(true);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setIsToastVisible(false);
    }, 1500);
  }, []);

  return {
    toastMessage,
    isToastVisible,
    toastTone,
    toastPlacement,
    showToast
  };
};

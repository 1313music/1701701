const OVERLAY_TRANSITION = { duration: 0.22, ease: [0.22, 0.61, 0.36, 1] };
const PANEL_DESKTOP_TRANSITION = {
  type: 'spring',
  stiffness: 430,
  damping: 34,
  mass: 0.82
};
const PANEL_MOBILE_TRANSITION = {
  type: 'spring',
  stiffness: 410,
  damping: 36,
  mass: 0.9
};
const REDUCED_MOTION_TRANSITION = { duration: 0.12, ease: 'linear' };

export const getAlbumListOverlayMotionProps = ({ shouldReduceMotion = false } = {}) => ({
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: shouldReduceMotion ? REDUCED_MOTION_TRANSITION : OVERLAY_TRANSITION
});

export const getAlbumListPanelMotionProps = ({
  isMobile = false,
  shouldReduceMotion = false
} = {}) => {
  const transformOrigin = isMobile ? 'center bottom' : 'center center';

  if (shouldReduceMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: REDUCED_MOTION_TRANSITION,
      style: { transformOrigin }
    };
  }

  if (isMobile) {
    return {
      initial: { opacity: 0, y: 48, scale: 0.985 },
      animate: { opacity: 1, y: 0, scale: 1 },
      exit: { opacity: 0, y: 34, scale: 0.992 },
      transition: PANEL_MOBILE_TRANSITION,
      style: { transformOrigin }
    };
  }

  return {
    initial: { opacity: 0, y: 24, scale: 0.965 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: 16, scale: 0.982 },
    transition: PANEL_DESKTOP_TRANSITION,
    style: { transformOrigin }
  };
};

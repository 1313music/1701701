const MOBILE_VIEWPORT_MAX_WIDTH = 1024;
const COMPACT_VIEWPORT_MAX_HEIGHT = 780;
const VERY_SHORT_VIEWPORT_MAX_HEIGHT = 640;

const toPositiveNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
};

export const shouldUseCompactMobileFullscreenLayout = ({ width, height }) => {
  const viewportWidth = toPositiveNumber(width);
  const viewportHeight = toPositiveNumber(height);

  if (!viewportWidth || !viewportHeight || viewportWidth > MOBILE_VIEWPORT_MAX_WIDTH) {
    return false;
  }

  return viewportHeight <= COMPACT_VIEWPORT_MAX_HEIGHT;
};

export const getAdaptiveMobileCoverSize = ({ width, height }) => {
  const viewportWidth = toPositiveNumber(width);
  const viewportHeight = toPositiveNumber(height);

  if (!viewportWidth || !viewportHeight) {
    return null;
  }

  const isCompact = shouldUseCompactMobileFullscreenLayout({
    width: viewportWidth,
    height: viewportHeight
  });
  const isVeryShort = viewportHeight <= VERY_SHORT_VIEWPORT_MAX_HEIGHT;
  const widthLimit = isCompact
    ? Math.min(viewportWidth * 0.74, 320)
    : Math.min(viewportWidth * 0.8, 360);
  const minHeightLimit = isVeryShort ? 176 : isCompact ? 208 : 220;
  const maxHeightLimit = isVeryShort ? 240 : isCompact ? 300 : 340;
  const heightRatio = isVeryShort ? 0.34 : isCompact ? 0.38 : 0.4;
  const heightLimit = Math.min(viewportHeight * heightRatio, maxHeightLimit);
  const coverSize = Math.min(widthLimit, Math.max(minHeightLimit, heightLimit));

  return Math.round(coverSize);
};

import QRCode from 'qrcode';

const isIOSDevice = () => {
  if (typeof navigator === 'undefined') return false;
  return /iP(hone|ad|od)/i.test(navigator.userAgent || '');
};

const resolveIsDarkTheme = () => {
  if (typeof document === 'undefined') return false;
  const theme = document.documentElement.getAttribute('data-theme');
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

const drawRoundedRectPath = (ctx, x, y, width, height, radius) => {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

const buildWrappedLines = (ctx, text, maxWidth, maxLines) => {
  if (!text) return [];
  const chars = Array.from(text);
  const lines = [];
  let currentLine = '';
  for (const char of chars) {
    const testLine = currentLine + char;
    const exceeds = ctx.measureText(testLine).width > maxWidth;
    if (!exceeds || !currentLine) {
      currentLine = testLine;
      continue;
    }
    lines.push(currentLine);
    currentLine = char;
    if (lines.length >= maxLines) break;
  }
  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }
  if (lines.length === maxLines && chars.length > lines.join('').length) {
    const last = lines[maxLines - 1] || '';
    let trimmed = last;
    while (trimmed.length > 0 && ctx.measureText(`${trimmed}...`).width > maxWidth) {
      trimmed = trimmed.slice(0, -1);
    }
    lines[maxLines - 1] = `${trimmed}...`;
  }
  return lines;
};

const loadCanvasImage = (src) => new Promise((resolve, reject) => {
  if (!src) {
    reject(new Error('missing image src'));
    return;
  }
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('image load failed'));
  img.src = src;
});

const drawImageCover = (ctx, image, x, y, width, height) => {
  if (!image?.width || !image?.height) return;
  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;
  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
};

let manualBlurFallbackCache = null;
const shouldUseManualCanvasBlur = () => {
  if (manualBlurFallbackCache !== null) return manualBlurFallbackCache;
  if (typeof document === 'undefined') {
    manualBlurFallbackCache = true;
    return manualBlurFallbackCache;
  }
  if (isIOSDevice()) {
    manualBlurFallbackCache = true;
    return manualBlurFallbackCache;
  }
  const probeCanvas = document.createElement('canvas');
  const probeCtx = probeCanvas.getContext('2d');
  if (!probeCtx || !('filter' in probeCtx)) {
    manualBlurFallbackCache = true;
    return manualBlurFallbackCache;
  }
  const originalFilter = probeCtx.filter;
  probeCtx.filter = 'blur(2px)';
  manualBlurFallbackCache = probeCtx.filter !== 'blur(2px)';
  probeCtx.filter = originalFilter;
  return manualBlurFallbackCache;
};

const drawManuallyBlurredCover = (ctx, image, x, y, width, height, intensity = 0.06) => {
  if (typeof document === 'undefined' || !image?.width || !image?.height) {
    drawImageCover(ctx, image, x, y, width, height);
    return;
  }

  const sampleScale = Math.max(0.03, Math.min(0.075, intensity));
  const sampleWidth = Math.max(32, Math.round(width * sampleScale));
  const sampleHeight = Math.max(32, Math.round(height * sampleScale));

  const baseCanvas = document.createElement('canvas');
  baseCanvas.width = sampleWidth;
  baseCanvas.height = sampleHeight;
  const baseCtx = baseCanvas.getContext('2d');
  if (!baseCtx) {
    drawImageCover(ctx, image, x, y, width, height);
    return;
  }
  baseCtx.clearRect(0, 0, sampleWidth, sampleHeight);
  baseCtx.imageSmoothingEnabled = true;
  baseCtx.imageSmoothingQuality = 'high';
  drawImageCover(baseCtx, image, 0, 0, sampleWidth, sampleHeight);

  const midCanvas = document.createElement('canvas');
  midCanvas.width = Math.max(16, Math.round(sampleWidth * 0.56));
  midCanvas.height = Math.max(16, Math.round(sampleHeight * 0.56));
  const midCtx = midCanvas.getContext('2d');
  if (!midCtx) {
    drawImageCover(ctx, image, x, y, width, height);
    return;
  }
  midCtx.imageSmoothingEnabled = true;
  midCtx.imageSmoothingQuality = 'high';
  midCtx.drawImage(baseCanvas, 0, 0, midCanvas.width, midCanvas.height);

  const lowCanvas = document.createElement('canvas');
  lowCanvas.width = Math.max(12, Math.round(sampleWidth * 0.32));
  lowCanvas.height = Math.max(12, Math.round(sampleHeight * 0.32));
  const lowCtx = lowCanvas.getContext('2d');
  if (!lowCtx) {
    drawImageCover(ctx, image, x, y, width, height);
    return;
  }
  lowCtx.imageSmoothingEnabled = true;
  lowCtx.imageSmoothingQuality = 'high';
  lowCtx.drawImage(midCanvas, 0, 0, lowCanvas.width, lowCanvas.height);

  const blurCanvas = document.createElement('canvas');
  blurCanvas.width = sampleWidth;
  blurCanvas.height = sampleHeight;
  const blurCtx = blurCanvas.getContext('2d');
  if (!blurCtx) {
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(baseCanvas, x, y, width, height);
    ctx.restore();
    return;
  }

  blurCtx.clearRect(0, 0, sampleWidth, sampleHeight);
  blurCtx.imageSmoothingEnabled = true;
  blurCtx.imageSmoothingQuality = 'high';
  blurCtx.globalAlpha = 1;
  blurCtx.drawImage(lowCanvas, 0, 0, sampleWidth, sampleHeight);
  blurCtx.globalAlpha = 0.68;
  blurCtx.drawImage(midCanvas, 0, 0, sampleWidth, sampleHeight);
  blurCtx.globalAlpha = 0.22;
  blurCtx.drawImage(baseCanvas, 0, 0, sampleWidth, sampleHeight);

  const diffuseCanvas = document.createElement('canvas');
  diffuseCanvas.width = sampleWidth;
  diffuseCanvas.height = sampleHeight;
  const diffuseCtx = diffuseCanvas.getContext('2d');
  if (diffuseCtx) {
    diffuseCtx.drawImage(blurCanvas, 0, 0);
    const diffusionOffsets = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]];
    blurCtx.globalAlpha = 0.08;
    for (const [dx, dy] of diffusionOffsets) {
      blurCtx.drawImage(diffuseCanvas, dx, dy, sampleWidth, sampleHeight);
    }
  }
  blurCtx.globalAlpha = 1;

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(blurCanvas, x, y, width, height);
  ctx.restore();
};

const drawBlurredCover = (ctx, image, x, y, width, height, options = {}) => {
  const {
    blur = 40,
    saturation = 1.2,
    manualIntensity = 0.06
  } = options;

  if (!shouldUseManualCanvasBlur()) {
    ctx.save();
    ctx.filter = `blur(${blur}px) saturate(${saturation})`;
    drawImageCover(ctx, image, x, y, width, height);
    ctx.restore();
    return;
  }

  drawManuallyBlurredCover(ctx, image, x, y, width, height, manualIntensity);
};

const clampColorByte = (value) => Math.max(0, Math.min(255, Math.round(value)));

const mixRgb = (from, to, ratio) => ({
  r: clampColorByte(from.r + (to.r - from.r) * ratio),
  g: clampColorByte(from.g + (to.g - from.g) * ratio),
  b: clampColorByte(from.b + (to.b - from.b) * ratio)
});

const scaleRgb = (rgb, multiplier) => ({
  r: clampColorByte(rgb.r * multiplier),
  g: clampColorByte(rgb.g * multiplier),
  b: clampColorByte(rgb.b * multiplier)
});

const toRgbColor = (rgb) => `rgb(${clampColorByte(rgb.r)}, ${clampColorByte(rgb.g)}, ${clampColorByte(rgb.b)})`;
const toRgbaColor = (rgb, alpha) => `rgba(${clampColorByte(rgb.r)}, ${clampColorByte(rgb.g)}, ${clampColorByte(rgb.b)}, ${alpha})`;

const extractImageTone = (image) => {
  if (typeof document === 'undefined' || !image?.width || !image?.height) return null;
  const sampleSize = 24;
  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = sampleSize;
  sampleCanvas.height = sampleSize;
  const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
  if (!sampleCtx) return null;

  try {
    sampleCtx.drawImage(image, 0, 0, sampleSize, sampleSize);
    const { data } = sampleCtx.getImageData(0, 0, sampleSize, sampleSize);
    let red = 0;
    let green = 0;
    let blue = 0;
    let count = 0;

    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      if (alpha < 24) continue;
      red += data[i];
      green += data[i + 1];
      blue += data[i + 2];
      count += 1;
    }

    if (count === 0) return null;
    return {
      r: red / count,
      g: green / count,
      b: blue / count
    };
  } catch {
    return null;
  }
};

const normalizeAccentTone = (rgb, isDark) => {
  if (!rgb) return null;
  const luminance = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
  const target = isDark ? 116 : 150;
  const ratio = target / Math.max(luminance, 1);
  const clampedRatio = Math.max(0.68, Math.min(1.42, ratio));
  return scaleRgb(rgb, clampedRatio);
};

export const createShareCardDataUrl = async ({
  trackName,
  albumName,
  url,
  cover
}) => {
  if (typeof document === 'undefined' || !url) return '';
  const isDark = resolveIsDarkTheme();
  const useManualBlur = shouldUseManualCanvasBlur();
  const width = 1080;
  const cardInsetX = 72;
  const cardTopGap = 80;
  const cardBodyHeight = 1360;
  const shareQrSize = 96;
  const lowerGap = cardTopGap;
  const height = cardTopGap + cardBodyHeight + lowerGap + shareQrSize + lowerGap;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  let coverImage = null;
  try {
    coverImage = await loadCanvasImage(cover);
  } catch {
    coverImage = null;
  }

  const defaultAccent = isDark
    ? { r: 96, g: 146, b: 206 }
    : { r: 136, g: 170, b: 214 };
  const sampledAccent = extractImageTone(coverImage);
  const accent = normalizeAccentTone(sampledAccent || defaultAccent, isDark) || defaultAccent;

  const palette = {
    backdrop: toRgbaColor(mixRgb(accent, { r: 14, g: 22, b: 34 }, 0.72), isDark ? 0.5 : 0.46),
    vignette: isDark ? 'rgba(3, 6, 10, 0.62)' : 'rgba(8, 14, 24, 0.42)',
    cardGlassTop: useManualBlur
      ? (isDark ? 'rgba(246, 251, 255, 0.1)' : 'rgba(248, 252, 255, 0.14)')
      : (isDark ? 'rgba(246, 251, 255, 0.08)' : 'rgba(248, 252, 255, 0.13)'),
    cardGlassMid: useManualBlur
      ? (isDark ? 'rgba(210, 224, 244, 0.055)' : 'rgba(225, 236, 250, 0.075)')
      : (isDark ? 'rgba(210, 224, 244, 0.07)' : 'rgba(225, 236, 250, 0.12)'),
    cardGlassBottom: useManualBlur
      ? (isDark ? 'rgba(24, 34, 48, 0.22)' : 'rgba(152, 172, 198, 0.2)')
      : (isDark ? 'rgba(24, 34, 48, 0.28)' : 'rgba(152, 172, 198, 0.24)'),
    cardStrokeTop: useManualBlur ? 'rgba(255, 255, 255, 0.56)' : 'rgba(255, 255, 255, 0.34)',
    cardStrokeMid: useManualBlur ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.2)',
    cardStrokeBottom: useManualBlur ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.12)',
    cardInnerStroke: useManualBlur ? 'rgba(255, 255, 255, 0.095)' : 'rgba(255, 255, 255, 0.09)',
    cardShadow: isDark ? 'rgba(4, 8, 12, 0.22)' : 'rgba(18, 34, 56, 0.16)',
    text: '#f7fbff',
    subText: 'rgba(244, 249, 255, 0.76)',
    footer: 'rgba(244, 249, 255, 0.8)',
    controlTrack: 'rgba(244, 249, 255, 0.38)',
    controlFill: 'rgba(255, 255, 255, 0.95)',
    qrDark: '#ffffff',
    qrLight: '#0000',
    coverFallback0: toRgbColor(mixRgb(accent, { r: 255, g: 255, b: 255 }, 0.2)),
    coverFallback1: toRgbColor(mixRgb(accent, { r: 12, g: 18, b: 28 }, 0.56)),
    grain: useManualBlur
      ? (isDark ? 'rgba(255, 255, 255, 0.006)' : 'rgba(255, 255, 255, 0.005)')
      : (isDark ? 'rgba(255, 255, 255, 0.018)' : 'rgba(255, 255, 255, 0.014)')
  };

  if (coverImage) {
    drawBlurredCover(
      ctx,
      coverImage,
      -width * 0.14,
      -height * 0.14,
      width * 1.28,
      height * 1.28,
      { blur: 56, saturation: 1.24, manualIntensity: useManualBlur ? 0.026 : 0.055 }
    );
  } else {
    const fallback = ctx.createLinearGradient(0, 0, width, height);
    fallback.addColorStop(0, toRgbColor(mixRgb(accent, { r: 12, g: 18, b: 30 }, 0.58)));
    fallback.addColorStop(1, toRgbColor(mixRgb(accent, { r: 32, g: 46, b: 68 }, 0.52)));
    ctx.fillStyle = fallback;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.fillStyle = palette.backdrop;
  ctx.fillRect(0, 0, width, height);

  const vignette = ctx.createRadialGradient(width * 0.5, height * 0.42, width * 0.18, width * 0.5, height * 0.5, width * 0.88);
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(0.62, 'rgba(0, 0, 0, 0.14)');
  vignette.addColorStop(1, palette.vignette);
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  for (let i = 0; i < 1200; i += 1) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const size = Math.random() * 1.4 + 0.4;
    ctx.fillStyle = palette.grain;
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();

  const cardX = cardInsetX;
  const cardY = cardTopGap;
  const cardWidth = width - 144;
  const cardHeight = cardBodyHeight;
  const cardRadius = 58;

  ctx.save();
  drawRoundedRectPath(ctx, cardX, cardY, cardWidth, cardHeight, cardRadius);
  ctx.clip();
  if (coverImage) {
    ctx.save();
    ctx.globalAlpha = isDark ? 0.42 : 0.36;
    drawBlurredCover(
      ctx,
      coverImage,
      cardX - width * 0.26,
      cardY - height * 0.24,
      width * 1.52,
      height * 1.52,
      {
        blur: isDark ? 46 : 42,
        saturation: isDark ? 1.3 : 1.24,
        manualIntensity: useManualBlur ? 0.024 : 0.05
      }
    );
    ctx.restore();
  }
  const cardGlass = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardHeight);
  cardGlass.addColorStop(0, palette.cardGlassTop);
  cardGlass.addColorStop(0.46, palette.cardGlassMid);
  cardGlass.addColorStop(1, palette.cardGlassBottom);
  ctx.fillStyle = cardGlass;
  ctx.fillRect(cardX, cardY, cardWidth, cardHeight);

  const cardMist = ctx.createRadialGradient(
    cardX + cardWidth * 0.22,
    cardY + cardHeight * 0.2,
    cardWidth * 0.08,
    cardX + cardWidth * 0.22,
    cardY + cardHeight * 0.2,
    cardWidth * 0.62
  );
  cardMist.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
  cardMist.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = cardMist;
  ctx.fillRect(cardX, cardY, cardWidth, cardHeight);

  if (useManualBlur) {
    const liquidTint = ctx.createLinearGradient(cardX, cardY, cardX + cardWidth, cardY + cardHeight);
    liquidTint.addColorStop(0, toRgbaColor(mixRgb(accent, { r: 204, g: 232, b: 255 }, 0.4), isDark ? 0.07 : 0.06));
    liquidTint.addColorStop(0.52, 'rgba(255, 255, 255, 0)');
    liquidTint.addColorStop(1, toRgbaColor(mixRgb(accent, { r: 128, g: 172, b: 222 }, 0.52), isDark ? 0.08 : 0.06));
    ctx.fillStyle = liquidTint;
    ctx.fillRect(cardX, cardY, cardWidth, cardHeight);

    const topGlint = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardHeight * 0.28);
    topGlint.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
    topGlint.addColorStop(0.36, 'rgba(255, 255, 255, 0.08)');
    topGlint.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = topGlint;
    ctx.fillRect(cardX, cardY, cardWidth, cardHeight * 0.32);

    const refractionBand = ctx.createLinearGradient(
      cardX - cardWidth * 0.14,
      cardY + cardHeight * 0.18,
      cardX + cardWidth * 1.08,
      cardY + cardHeight * 0.58
    );
    refractionBand.addColorStop(0, 'rgba(255, 255, 255, 0)');
    refractionBand.addColorStop(0.42, 'rgba(255, 255, 255, 0.075)');
    refractionBand.addColorStop(0.5, 'rgba(255, 255, 255, 0.012)');
    refractionBand.addColorStop(0.58, 'rgba(255, 255, 255, 0.06)');
    refractionBand.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = refractionBand;
    ctx.fillRect(cardX, cardY, cardWidth, cardHeight);

    const innerShade = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardHeight);
    innerShade.addColorStop(0, 'rgba(255, 255, 255, 0.038)');
    innerShade.addColorStop(0.62, 'rgba(255, 255, 255, 0)');
    innerShade.addColorStop(1, 'rgba(0, 0, 0, 0.14)');
    ctx.fillStyle = innerShade;
    ctx.fillRect(cardX, cardY, cardWidth, cardHeight);
  }
  ctx.restore();

  ctx.save();
  drawRoundedRectPath(ctx, cardX, cardY, cardWidth, cardHeight, cardRadius);
  ctx.shadowColor = palette.cardShadow;
  ctx.shadowBlur = 34;
  ctx.shadowOffsetY = 10;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  const cardStroke = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardHeight);
  cardStroke.addColorStop(0, palette.cardStrokeTop);
  cardStroke.addColorStop(0.42, palette.cardStrokeMid);
  cardStroke.addColorStop(1, palette.cardStrokeBottom);
  drawRoundedRectPath(ctx, cardX, cardY, cardWidth, cardHeight, cardRadius);
  ctx.strokeStyle = cardStroke;
  ctx.lineWidth = 1.35;
  ctx.stroke();

  drawRoundedRectPath(ctx, cardX + 1.8, cardY + 1.8, cardWidth - 3.6, cardHeight - 3.6, cardRadius - 1.8);
  ctx.strokeStyle = palette.cardInnerStroke;
  ctx.lineWidth = 1;
  ctx.stroke();

  const coverPadding = 74;
  const coverX = cardX + coverPadding;
  const coverY = cardY + 74;
  const coverSize = cardWidth - coverPadding * 2;

  if (coverImage) {
    ctx.save();
    drawRoundedRectPath(ctx, coverX, coverY, coverSize, coverSize, 28);
    ctx.clip();
    drawImageCover(ctx, coverImage, coverX, coverY, coverSize, coverSize);
    ctx.restore();
  } else {
    const coverFallback = ctx.createLinearGradient(coverX, coverY, coverX + coverSize, coverY + coverSize);
    coverFallback.addColorStop(0, palette.coverFallback0);
    coverFallback.addColorStop(1, palette.coverFallback1);
    drawRoundedRectPath(ctx, coverX, coverY, coverSize, coverSize, 28);
    ctx.fillStyle = coverFallback;
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.font = '700 130px "Lexend", "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('♪', coverX + coverSize / 2, coverY + coverSize / 2 + 44);
  }

  const contentLeft = cardX + 62;
  const contentRight = cardX + cardWidth - 62;
  const contentWidth = contentRight - contentLeft;
  const contentCenterX = cardX + cardWidth / 2;
  const titleTopSpacing = 102;
  const subtitleGap = 64;
  const titleStartY = coverY + coverSize + titleTopSpacing;
  const subtitleFontSize = 38;
  const titleText = trackName || '未知歌曲';
  const titleFontFamily = '"Lexend", "PingFang SC", "Microsoft YaHei", sans-serif';
  let titleFontSize = 60;
  ctx.textAlign = 'center';
  ctx.font = `700 ${titleFontSize}px ${titleFontFamily}`;
  while (titleFontSize > subtitleFontSize && ctx.measureText(titleText).width > contentWidth) {
    titleFontSize -= 2;
    ctx.font = `700 ${titleFontSize}px ${titleFontFamily}`;
  }
  let titleLine = titleText;
  if (ctx.measureText(titleLine).width > contentWidth) {
    const chars = Array.from(titleLine);
    let end = chars.length;
    while (end > 0 && ctx.measureText(`${chars.slice(0, end).join('')}...`).width > contentWidth) {
      end -= 1;
    }
    titleLine = `${chars.slice(0, Math.max(end, 0)).join('')}...`;
  }
  const lastTitleBaselineY = titleStartY;

  const subtitleAlbum = albumName || '未知专辑';
  const subtitle = subtitleAlbum;
  const subtitleY = lastTitleBaselineY + subtitleGap;

  ctx.fillStyle = palette.text;
  ctx.font = `700 ${titleFontSize}px ${titleFontFamily}`;
  ctx.fillText(titleLine, contentCenterX, titleStartY);

  ctx.fillStyle = palette.subText;
  ctx.font = `600 ${subtitleFontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`;
  const subtitleLine = buildWrappedLines(ctx, subtitle, contentWidth, 1)[0] || subtitle;
  ctx.fillText(subtitleLine, contentCenterX, subtitleY);

  const progressSpacing = 84;
  const progressX = contentLeft + 8;
  const progressY = subtitleY + progressSpacing;
  const progressWidth = contentWidth - 16;
  const playedWidth = progressWidth * 0.5;
  const knobX = progressX + playedWidth;

  ctx.lineCap = 'round';
  ctx.lineWidth = 9;
  ctx.strokeStyle = palette.controlTrack;
  ctx.beginPath();
  ctx.moveTo(progressX, progressY);
  ctx.lineTo(progressX + progressWidth, progressY);
  ctx.stroke();

  ctx.strokeStyle = palette.controlFill;
  ctx.beginPath();
  ctx.moveTo(progressX, progressY);
  ctx.lineTo(knobX, progressY);
  ctx.stroke();

  ctx.fillStyle = palette.controlFill;
  ctx.beginPath();
  ctx.arc(knobX, progressY, 12.5, 0, Math.PI * 2);
  ctx.fill();

  const drawPlayGlyph = (x, y, size, direction = 'next') => {
    const scale = size / 24;
    ctx.save();
    ctx.translate(x, y);
    if (direction === 'prev') {
      ctx.scale(-1, 1);
    }
    ctx.scale(scale, scale);
    ctx.translate(-12, -12);
    ctx.beginPath();
    ctx.moveTo(5, 3);
    ctx.lineTo(19, 12);
    ctx.lineTo(5, 21);
    ctx.closePath();
    ctx.fillStyle = palette.controlFill;
    ctx.strokeStyle = palette.controlFill;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  };

  const drawSkipIcon = (x, y, size, direction) => {
    ctx.save();
    const iconSize = size;
    const overlap = iconSize * (8 / 20);
    const spacing = iconSize - overlap;
    if (direction === 'prev') {
      drawPlayGlyph(x + spacing / 2, y, iconSize, 'prev');
      drawPlayGlyph(x - spacing / 2, y, iconSize, 'prev');
    } else {
      drawPlayGlyph(x - spacing / 2, y, iconSize, 'next');
      drawPlayGlyph(x + spacing / 2, y, iconSize, 'next');
    }
    ctx.restore();
  };

  const drawPauseIcon = (x, y, size) => {
    const scale = size / 24;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.translate(-12, -12);
    ctx.fillStyle = palette.controlFill;
    ctx.strokeStyle = palette.controlFill;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = 2;
    drawRoundedRectPath(ctx, 6, 4, 4, 16, 1);
    ctx.fill();
    ctx.stroke();
    drawRoundedRectPath(ctx, 14, 4, 4, 16, 1);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  };

  const skipIconSize = 72;
  const pauseIconSize = 115;
  const pauseVisualTopOffset = (pauseIconSize * 8) / 24;
  const controlsY = progressY + progressSpacing + pauseVisualTopOffset;
  const pauseX = cardX + cardWidth * 0.5;
  const sideControlOffset = Math.max(168, cardWidth * 0.19);
  const prevX = pauseX - sideControlOffset;
  const nextX = pauseX + sideControlOffset;
  drawSkipIcon(prevX, controlsY, skipIconSize, 'prev');
  drawPauseIcon(pauseX, controlsY, pauseIconSize);
  drawSkipIcon(nextX, controlsY, skipIconSize, 'next');

  const qrDataUrl = await QRCode.toDataURL(url, {
    errorCorrectionLevel: 'M',
    margin: 0,
    width: 320,
    color: {
      dark: palette.qrDark,
      light: palette.qrLight
    }
  });
  const qrImage = await loadCanvasImage(qrDataUrl);
  const qrX = cardX + cardWidth - shareQrSize;
  const qrY = cardY + cardHeight + lowerGap;
  ctx.drawImage(qrImage, qrX, qrY, shareQrSize, shareQrSize);

  const infoLeftX = cardX;
  const brandText = '1701701.xyz';
  const tipText = '扫码播放歌曲';
  const infoFontSize = 35;
  const infoBlockTop = qrY;
  const infoLineGap = Math.max(14, shareQrSize - infoFontSize * 2);
  const infoBrandY = infoBlockTop;
  const infoTitleY = infoBrandY + infoFontSize + infoLineGap;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = palette.text;
  ctx.font = `600 ${infoFontSize}px "Lexend", "PingFang SC", "Microsoft YaHei", sans-serif`;
  ctx.fillText(brandText, infoLeftX, infoBrandY);
  ctx.fillStyle = palette.footer;
  ctx.font = `600 ${infoFontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`;
  ctx.fillText(tipText, infoLeftX, infoTitleY);

  return canvas.toDataURL('image/png');
};

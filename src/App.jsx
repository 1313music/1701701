import React, { useMemo, useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import './index.css';
import QRCode from 'qrcode';

// Components
import Sidebar from './components/Sidebar';
import PlayerBar from './components/PlayerBar';
import AlbumGrid from './components/AlbumGrid';
import SearchHeader from './components/SearchHeader';

// Hooks
import { useAudioPlayer } from './hooks/useAudioPlayer.jsx';
import { useTheme } from './hooks/useTheme.js';
import { useToast } from './hooks/useToast.js';
import { useVideoAccess } from './hooks/useVideoAccess.js';
import { sanitizeTempPlaylist } from './utils/playlistUtils.js';

const TEMP_PLAYLIST_KEY = 'tempPlaylistIds';
const LyricsOverlay = lazy(() => import('./components/LyricsOverlay.jsx'));
const AlbumListOverlay = lazy(() => import('./components/AlbumListOverlay.jsx'));
const VideoPage = lazy(() => import('./components/VideoPage.jsx'));
const DownloadPage = lazy(() => import('./components/DownloadPage.jsx'));
const AboutPage = lazy(() => import('./components/AboutPage.jsx'));

const buildSongSrcSet = (albums) => {
  const set = new Set();
  for (const album of albums) {
    for (const song of album.songs) {
      if (song?.src) set.add(song.src);
    }
  }
  return set;
};

const buildSongIndex = (albums) => {
  const map = new Map();
  for (const album of albums) {
    for (const song of album.songs) {
      if (song?.src && !map.has(song.src)) {
        map.set(song.src, { album, song });
      }
    }
  }
  return map;
};

const SITE_URL = 'https://1701701.xyz';
const SITE_NAME = '1701701.xyz';
const DEFAULT_OG_IMAGE = `${SITE_URL}/logo.png`;
const LI_ZHI_ENTITY_LINKS = [
  'https://musicbrainz.org/artist/e54bc357-19aa-4e1f-9795-3346e486d5db',
  'https://en.wikipedia.org/wiki/Li_Zhi_(singer)'
];
const RESEARCHED_KEY_RELEASES = [
  { name: '被禁忌的游戏', year: '2004' },
  { name: '梵高先生', year: '2005' },
  { name: '这个世界会好吗', year: '2006' },
  { name: '我爱南京', year: '2009' },
  { name: '你好，郑州', year: '2010' },
  { name: 'F', year: '2011' },
  { name: '1701', year: '2014' },
  { name: '8', year: '2016' },
  { name: '在每一条伤心的应天大街上', year: '2016' },
  { name: '看见', year: '2020' }
];
const KL_EVENT_DATES = [
  '2025-11-11T20:30:00+08:00',
  '2025-11-12T20:30:00+08:00',
  '2025-11-13T20:30:00+08:00'
];
const KL_EVENT_URL = 'https://idealivearena.com/event/three-missing-one/';

const upsertMetaTag = ({ name, property }, content) => {
  if (typeof document === 'undefined' || !content) return;
  const selector = name
    ? `meta[name="${name}"]`
    : `meta[property="${property}"]`;
  let tag = document.head.querySelector(selector);
  if (!tag) {
    tag = document.createElement('meta');
    if (name) tag.setAttribute('name', name);
    if (property) tag.setAttribute('property', property);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
};

const upsertLinkTag = (rel, href) => {
  if (typeof document === 'undefined' || !rel || !href) return;
  let tag = document.head.querySelector(`link[rel="${rel}"]`);
  if (!tag) {
    tag = document.createElement('link');
    tag.setAttribute('rel', rel);
    document.head.appendChild(tag);
  }
  tag.setAttribute('href', href);
};

const upsertJsonLd = (id, payload) => {
  if (typeof document === 'undefined' || !id || !payload) return;
  let script = document.getElementById(id);
  if (!script) {
    script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = id;
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(payload);
};

const copyTextToClipboard = async (text) => {
  if (!text) return false;
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fallback below
    }
  }
  if (typeof document === 'undefined') return false;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  document.body.appendChild(textarea);
  textarea.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  document.body.removeChild(textarea);
  return copied;
};

const resolveIsDarkTheme = () => {
  if (typeof document === 'undefined') return false;
  const theme = document.documentElement.getAttribute('data-theme');
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

const dataUrlToFile = (dataUrl, filename) => {
  const [meta, content] = dataUrl.split(',');
  const mime = meta.match(/data:(.*?);base64/)?.[1] || 'image/png';
  const binary = atob(content || '');
  const length = binary.length;
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], filename, { type: mime });
};

const downloadDataUrl = (dataUrl, filename) => {
  if (!dataUrl || typeof document === 'undefined') return;
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const isIOSDevice = () => {
  if (typeof navigator === 'undefined') return false;
  return /iP(hone|ad|od)/i.test(navigator.userAgent || '');
};

const openImagePreviewWindow = (dataUrl) => {
  if (!dataUrl || typeof window === 'undefined') return false;
  const previewWindow = window.open('', '_blank');
  if (!previewWindow || !previewWindow.document) return false;
  const doc = previewWindow.document;
  doc.title = '分享卡片';
  const html = doc.documentElement;
  html.style.height = '100%';
  doc.body.style.margin = '0';
  doc.body.style.background = '#05070b';
  doc.body.style.minHeight = '100%';
  doc.body.style.display = 'flex';
  doc.body.style.flexDirection = 'column';
  doc.body.style.alignItems = 'center';
  doc.body.style.justifyContent = 'flex-start';
  doc.body.style.gap = '16px';
  doc.body.style.padding = '16px 10px 24px';
  doc.body.style.boxSizing = 'border-box';

  const img = doc.createElement('img');
  img.src = dataUrl;
  img.alt = '分享卡片';
  img.style.width = '100%';
  img.style.maxWidth = '700px';
  img.style.maxHeight = 'calc(100vh - 140px)';
  img.style.height = 'auto';
  img.style.borderRadius = '14px';
  img.style.boxShadow = '0 14px 42px rgba(0, 0, 0, 0.45)';
  img.style.objectFit = 'contain';
  doc.body.appendChild(img);

  const tip = doc.createElement('div');
  tip.textContent = '长按图片 -> 存储到“照片”';
  tip.style.color = '#ffffff';
  tip.style.background = 'rgba(255, 255, 255, 0.14)';
  tip.style.border = '1px solid rgba(255, 255, 255, 0.24)';
  tip.style.borderRadius = '12px';
  tip.style.padding = '10px 14px';
  tip.style.font = '700 19px -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
  tip.style.lineHeight = '1.3';
  tip.style.backdropFilter = 'blur(8px)';
  tip.style.webkitBackdropFilter = 'blur(8px)';
  tip.style.textAlign = 'center';
  tip.style.position = 'sticky';
  tip.style.bottom = '10px';
  doc.body.appendChild(tip);
  return true;
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

const toHexPart = (value) => clampColorByte(value).toString(16).padStart(2, '0');
const toHexColor = (rgb) => `#${toHexPart(rgb.r)}${toHexPart(rgb.g)}${toHexPart(rgb.b)}`;
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

const createShareCardDataUrl = async ({
  trackName,
  albumName,
  url,
  cover
}) => {
  if (typeof document === 'undefined' || !url) return '';
  const isDark = resolveIsDarkTheme();
  const useManualBlur = shouldUseManualCanvasBlur();
  const width = 1080;
  const height = 1720;
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

  const cardX = 72;
  const cardY = 80;
  const cardWidth = width - 144;
  const cardHeight = 1360;
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
  const prevX = cardX + cardWidth * 0.34;
  const pauseX = cardX + cardWidth * 0.5;
  const nextX = cardX + cardWidth * 0.66;
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
  const qrSize = 122;
  const qrX = cardX + cardWidth - qrSize;
  const qrY = height - qrSize - 92;
  ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

  const infoLeftX = cardX;
  const brandText = '1701701.xyz';
  const tipText = '长按识别播放歌曲';
  const qrBottomY = qrY + qrSize;
  const infoTitleY = qrBottomY;
  const infoBrandY = infoTitleY - 54;
  ctx.textAlign = 'left';
  ctx.fillStyle = palette.text;
  ctx.font = '600 35px "Lexend", "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillText(brandText, infoLeftX, infoBrandY);
  ctx.fillStyle = palette.footer;
  ctx.font = '600 35px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillText(tipText, infoLeftX, infoTitleY);

  return canvas.toDataURL('image/png');
};

const App = () => {
  const [view, setView] = useState('library'); // 'library' | 'video' | 'download' | 'about'
  const [musicAlbums, setMusicAlbums] = useState([]);
  const [isMusicLoading, setIsMusicLoading] = useState(true);
  const [musicLoadError, setMusicLoadError] = useState('');
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [tempPlaylistIds, setTempPlaylistIds] = useState(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(TEMP_PLAYLIST_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return sanitizeTempPlaylist(parsed);
    } catch {
      return [];
    }
  });
  const [isLyricsOpen, setIsLyricsOpen] = useState(false);
  const [isAlbumListOpen, setIsAlbumListOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasLyricsOverlayLoaded, setHasLyricsOverlayLoaded] = useState(false);
  const [hasAlbumListOverlayLoaded, setHasAlbumListOverlayLoaded] = useState(false);
  const [sharePanelData, setSharePanelData] = useState(null);
  const [shareCardDataUrl, setShareCardDataUrl] = useState('');
  const [isShareCardGenerating, setIsShareCardGenerating] = useState(false);
  const shareQueryAppliedRef = useRef(false);
  const shareCardRequestIdRef = useRef(0);

  const allSongSrcs = useMemo(() => buildSongSrcSet(musicAlbums), [musicAlbums]);
  const songIndex = useMemo(() => buildSongIndex(musicAlbums), [musicAlbums]);

  const tempPlaylistSet = useMemo(() => new Set(tempPlaylistIds), [tempPlaylistIds]);
  const tempPlaylistItems = useMemo(
    () => tempPlaylistIds.map((id) => songIndex.get(id)).filter(Boolean),
    [songIndex, tempPlaylistIds]
  );

  const {
    toastMessage,
    isToastVisible,
    toastTone,
    toastPlacement,
    showToast
  } = useToast();

  const {
    themePreference,
    showViewportDebug,
    viewportDebug,
    handleThemeToggle
  } = useTheme({ showToast });

  const {
    isVideoAccessOpen,
    videoPassword,
    setVideoPassword,
    videoPasswordError,
    setVideoPasswordError,
    closeVideoAccessModal,
    requestVideoView,
    submitVideoAccess
  } = useVideoAccess();

  const {
    currentTrack,
    setCurrentTrack,
    currentAlbum,
    setCurrentAlbum,
    isPlaying,
    setIsPlaying,
    progress,
    currentTime,
    duration,
    lyrics,
    currentLyricIndex,
    isTrackNameOverflowing,
    trackNameRef,
    audioRef,
    currentSongInfo,
    handlePlayPause,
    handleSeek,
    handlePrev,
    handleNext,
    playSongFromAlbum,
    pausePlayback,
    togglePlayMode,
    getPlayModeIcon
  } = useAudioPlayer({
    musicAlbums,
    songIndex
  });

  const listAlbum = currentAlbum?.id === 'favorites' && currentSongInfo?.album
    ? currentSongInfo.album
    : currentAlbum;

  const favoriteAlbum = useMemo(() => {
    if (tempPlaylistItems.length === 0) return null;
    const cover = tempPlaylistItems[0]?.album?.cover || currentAlbum?.cover;
    const songs = tempPlaylistItems.map((item) => ({
      ...item.song,
      cover: item.album?.cover
    }));
    return {
      id: 'favorites',
      name: '我的收藏',
      artist: '我的收藏',
      cover,
      songs
    };
  }, [tempPlaylistItems, currentAlbum?.cover]);

  useEffect(() => {
    let canceled = false;
    const loadMusicAlbums = async () => {
      try {
        const module = await import('./data/mp3list.js');
        if (canceled) return;
        setMusicAlbums(Array.isArray(module.musicAlbums) ? module.musicAlbums : []);
      } catch {
        if (canceled) return;
        setMusicLoadError('曲库加载失败，请刷新重试');
      } finally {
        if (!canceled) {
          setIsMusicLoading(false);
        }
      }
    };

    loadMusicAlbums();
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    if (allSongSrcs.size === 0) return;
    setTempPlaylistIds((prev) => {
      const next = sanitizeTempPlaylist(prev, allSongSrcs);
      if (
        next.length === prev.length &&
        next.every((id, index) => id === prev[index])
      ) {
        return prev;
      }
      return next;
    });
  }, [allSongSrcs]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(TEMP_PLAYLIST_KEY, JSON.stringify(tempPlaylistIds));
    } catch {
      // ignore storage errors
    }
  }, [tempPlaylistIds]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const researchedReleaseNames = RESEARCHED_KEY_RELEASES.map((item) => item.name);
    const releaseYearMap = new Map(
      RESEARCHED_KEY_RELEASES.map((item) => [item.name, item.year])
    );

    const seoMap = {
      library: {
        title: '李志音乐 | 1701701.xyz',
        description: '收录李志代表作与现场内容，包含《被禁忌的游戏》《梵高先生》《1701》及叁缺壹吉隆坡站等，支持歌词查看、播放列表与收藏管理。',
        pageType: 'CollectionPage',
        keywords: [
          '李志',
          '李志音乐',
          '李志专辑',
          '李志现场',
          '李志1701',
          '李志8',
          '334计划',
          '我们的叁叁肆',
          '叁缺壹吉隆坡站',
          '叁缺壹东京站',
          'Three Missing One',
          'IDEA LIVE ARENA',
          '被禁忌的游戏',
          '梵高先生',
          '这个世界会好吗',
          '我爱南京',
          '你好郑州',
          '在每一条伤心的应天大街上'
        ]
      },
      video: {
        title: '李志现场视频与纪录片 | 1701701.xyz',
        description: '整理李志相关现场视频、纪录片与演出影像，覆盖“我们的叁叁肆”、叁叁肆计划巡演、跨年与采访内容。',
        pageType: 'VideoGallery',
        keywords: [
          '李志视频',
          '李志纪录片',
          '我们的叁叁肆',
          '334计划',
          '334城巡演',
          '李志巡演',
          '李志跨年',
          '叁缺壹现场',
          '叁缺壹吉隆坡站'
        ]
      },
      download: {
        title: '李志音乐资源下载 | 1701701.xyz',
        description: '提供李志相关资源下载入口与内容汇总，覆盖叁缺壹吉隆坡站、东京站以及代表专辑相关资源。',
        pageType: 'CollectionPage',
        keywords: [
          '李志下载',
          '李志资源',
          '叁缺壹吉隆坡站下载',
          '叁缺壹东京站下载',
          '李志现场音频',
          '李志1701下载',
          '李志梵高先生'
        ]
      },
      about: {
        title: '关于本站 | 1701701.xyz',
        description: '了解本站的内容范围、资源说明与使用说明。',
        pageType: 'AboutPage',
        keywords: ['1701701.xyz', '李志音乐站', '李志资料整理']
      }
    };

    const currentSeo = seoMap[view] || seoMap.library;
    const canonicalUrl = `${SITE_URL}/`;
    const keywordsContent = Array.isArray(currentSeo.keywords)
      ? currentSeo.keywords.join(',')
      : '';
    const albumListForSeo = Array.isArray(musicAlbums)
      ? musicAlbums.filter((album) => album?.name).slice(0, 30)
      : [];

    document.title = currentSeo.title;
    upsertMetaTag({ name: 'description' }, currentSeo.description);
    upsertMetaTag({ property: 'og:type' }, 'website');
    upsertMetaTag({ property: 'og:site_name' }, SITE_NAME);
    upsertMetaTag({ property: 'og:title' }, currentSeo.title);
    upsertMetaTag({ property: 'og:description' }, currentSeo.description);
    upsertMetaTag({ property: 'og:url' }, canonicalUrl);
    upsertMetaTag({ property: 'og:image' }, DEFAULT_OG_IMAGE);
    upsertMetaTag({ name: 'twitter:card' }, 'summary_large_image');
    upsertMetaTag({ name: 'twitter:title' }, currentSeo.title);
    upsertMetaTag({ name: 'twitter:description' }, currentSeo.description);
    upsertMetaTag({ name: 'twitter:image' }, DEFAULT_OG_IMAGE);
    upsertMetaTag({ name: 'keywords' }, keywordsContent);
    upsertLinkTag('canonical', canonicalUrl);

    const jsonLdPayload = [
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: SITE_NAME,
        url: SITE_URL,
        inLanguage: 'zh-CN',
        description: '一个分享李志音乐与视频的网站',
        about: {
          '@type': 'Person',
          name: '李志'
        },
        keywords: [
          '李志音乐',
          '李志现场视频',
          '叁缺壹吉隆坡站',
          '1701701.xyz'
        ]
      },
      {
        '@context': 'https://schema.org',
        '@type': currentSeo.pageType,
        name: currentSeo.title,
        url: canonicalUrl,
        inLanguage: 'zh-CN',
        isPartOf: {
          '@type': 'WebSite',
          name: SITE_NAME,
          url: SITE_URL
        },
        about: {
          '@type': 'Person',
          name: '李志'
        },
        description: currentSeo.description,
        keywords: currentSeo.keywords,
        mentions: researchedReleaseNames.slice(0, 8).map((name) => ({
          '@type': 'MusicAlbum',
          name,
          byArtist: {
            '@type': 'MusicGroup',
            name: '李志'
          }
        }))
      },
      {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: '李志',
        birthDate: '1978-11-13',
        birthPlace: {
          '@type': 'Place',
          name: '江苏金坛'
        },
        jobTitle: 'Singer-Songwriter',
        genre: ['contemporary folk', 'singer-songwriter'],
        description: '民谣音乐人，代表作包括《梵高先生》《这个世界会好吗》《1701》等。',
        sameAs: LI_ZHI_ENTITY_LINKS,
        knowsAbout: ['李志音乐', 'contemporary folk', 'singer-songwriter', ...researchedReleaseNames.slice(0, 6)]
      },
      {
        '@context': 'https://schema.org',
        '@type': 'MusicEvent',
        name: '叁缺壹·吉隆坡站',
        startDate: KL_EVENT_DATES[0],
        endDate: KL_EVENT_DATES[2],
        eventStatus: 'https://schema.org/EventCompleted',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        location: {
          '@type': 'Place',
          name: 'IDEA LIVE ARENA',
          address: {
            '@type': 'PostalAddress',
            addressLocality: 'Petaling Jaya',
            addressCountry: 'MY'
          }
        },
        performer: {
          '@type': 'Person',
          name: '李志'
        },
        offers: {
          '@type': 'Offer',
          availabilityStarts: '2025-08-26T12:30:00+08:00',
          url: KL_EVENT_URL
        },
        description: '2025年11月11日至11月13日，叁缺壹吉隆坡站在 IDEA LIVE ARENA 演出（官方开售时间为 2025-08-26）。',
        subEvent: KL_EVENT_DATES.map((startDate, index) => ({
          '@type': 'MusicEvent',
          name: `叁缺壹·吉隆坡站 第${index + 1}场`,
          startDate,
          eventStatus: 'https://schema.org/EventCompleted',
          eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
          location: {
            '@type': 'Place',
            name: 'IDEA LIVE ARENA'
          },
          performer: {
            '@type': 'Person',
            name: '李志'
          }
        })),
        url: KL_EVENT_URL
      },
      {
        '@context': 'https://schema.org',
        '@type': 'CreativeWorkSeries',
        name: '我们的叁叁肆',
        description: '围绕叁叁肆计划巡演的影像记录内容。',
        keywords: ['我们的叁叁肆', '叁叁肆计划', '334城巡演'],
        about: {
          '@type': 'Person',
          name: '李志'
        }
      }
    ];

    if (albumListForSeo.length > 0) {
      jsonLdPayload.push({
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: '李志音乐专辑列表',
        itemListOrder: 'https://schema.org/ItemListOrderAscending',
        numberOfItems: albumListForSeo.length,
        itemListElement: albumListForSeo.map((album, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          item: {
            '@type': 'MusicAlbum',
            '@id': `${canonicalUrl}#album-${encodeURIComponent(String(album.id || index + 1))}`,
            name: album.name,
            byArtist: {
              '@type': 'MusicGroup',
              name: album.artist || '李志'
            },
            datePublished: releaseYearMap.get(album.name) || undefined,
            numTracks: Array.isArray(album.songs) ? album.songs.length : undefined,
            image: album.cover || undefined,
            url: canonicalUrl
          }
        }))
      });
    }
    upsertJsonLd('page-seo-jsonld', jsonLdPayload);
  }, [view, musicAlbums]);

  useEffect(() => {
    if (shareQueryAppliedRef.current) return;
    if (musicAlbums.length === 0 || typeof window === 'undefined') return;
    shareQueryAppliedRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const albumId = params.get('albumId');
    if (!albumId) return;
    const targetAlbum = musicAlbums.find((album) => String(album.id) === albumId);
    if (!targetAlbum?.songs?.length) return;
    let songIndex = Number.parseInt(params.get('song') || '1', 10);
    if (!Number.isInteger(songIndex) || songIndex < 1 || songIndex > targetAlbum.songs.length) {
      songIndex = 1;
    }
    const timerId = window.setTimeout(() => {
      setView('library');
      setSelectedAlbum(targetAlbum);
      setCurrentAlbum(targetAlbum);
      setCurrentTrack(targetAlbum.songs[songIndex - 1]);
      setIsPlaying(false);
    }, 0);
    return () => window.clearTimeout(timerId);
  }, [musicAlbums, setCurrentAlbum, setCurrentTrack, setIsPlaying, setSelectedAlbum, setView]);

  const setLyricsOverlayOpen = useCallback((open) => {
    if (open) {
      setHasLyricsOverlayLoaded(true);
      setIsLyricsOpen(true);
      return;
    }
    setIsLyricsOpen(false);
  }, []);

  const setAlbumListOverlayOpen = useCallback((open) => {
    if (open) {
      setHasAlbumListOverlayLoaded(true);
      setIsAlbumListOpen(true);
      return;
    }
    setIsAlbumListOpen(false);
  }, []);

  const stopPlaybackForVideo = useCallback(() => {
    pausePlayback();
    setLyricsOverlayOpen(false);
    setAlbumListOverlayOpen(false);
  }, [pausePlayback, setLyricsOverlayOpen, setAlbumListOverlayOpen]);

  const handleViewChange = useCallback((nextView) => {
    if (nextView === 'video') {
      stopPlaybackForVideo();
      setView('video');
      return;
    }
    setView(nextView);
  }, [stopPlaybackForVideo]);

  const handleVideoAccessSubmit = useCallback(() => {
    submitVideoAccess();
  }, [submitVideoAccess]);

  const buildCurrentSharePayload = useCallback(() => {
    if (!currentTrack?.src || typeof window === 'undefined') return null;
    const resolvedAlbum = currentAlbum?.id === 'favorites' && currentSongInfo?.album
      ? currentSongInfo.album
      : currentAlbum;
    if (!resolvedAlbum?.id || !Array.isArray(resolvedAlbum.songs) || resolvedAlbum.songs.length === 0) {
      return null;
    }
    let matchedIndex = resolvedAlbum.songs.findIndex((song) => song.src === currentTrack.src);
    if (matchedIndex === -1 && currentSongInfo?.song?.src) {
      matchedIndex = resolvedAlbum.songs.findIndex((song) => song.src === currentSongInfo.song.src);
    }
    if (matchedIndex === -1) matchedIndex = 0;
    const shareTrack = resolvedAlbum.songs[matchedIndex] || currentTrack;
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('albumId', String(resolvedAlbum.id));
    url.searchParams.set('song', String(matchedIndex + 1));
    return {
      title: `${shareTrack.name} - ${resolvedAlbum.artist || '李志'}`,
      text: shareTrack.name,
      url: url.toString(),
      trackName: shareTrack.name,
      albumName: resolvedAlbum.name,
      artistName: resolvedAlbum.artist || '李志',
      cover: shareTrack.cover || resolvedAlbum.cover || ''
    };
  }, [currentAlbum, currentSongInfo, currentTrack]);

  const startShareCardGeneration = useCallback((payload) => {
    if (!payload?.url) return;
    const requestId = ++shareCardRequestIdRef.current;
    setIsShareCardGenerating(true);
    setShareCardDataUrl('');
    void (async () => {
      try {
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

  const handleShareCurrentTrack = useCallback(async (anchorOrOptions) => {
    const payload = buildCurrentSharePayload();
    if (!payload) {
      showToast('当前歌曲暂不可分享', 'tone-remove', anchorOrOptions || { placement: 'bottom' });
      return;
    }

    setSharePanelData(payload);
    startShareCardGeneration(payload);
  }, [buildCurrentSharePayload, showToast, startShareCardGeneration]);

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

  const toggleTempSong = (song, event) => {
    const id = song?.src;
    if (!id) return;
    const isFavorited = tempPlaylistSet.has(id);
    setTempPlaylistIds((prev) => {
      if (isFavorited) return prev.filter((item) => item !== id);
      return [...prev, id];
    });
    showToast(
      isFavorited ? '已取消收藏' : '已收藏',
      isFavorited ? 'tone-remove' : 'tone-add',
      event
    );
  };

  const addTempSong = (song, anchorOrOptions = { placement: 'bottom' }) => {
    const id = song?.src;
    if (!id) return;
    const isFavorited = tempPlaylistSet.has(id);
    if (isFavorited) {
      showToast('已在收藏', 'tone-add', anchorOrOptions);
      return;
    }
    setTempPlaylistIds((prev) => [...prev, id]);
    showToast('已收藏', 'tone-add', anchorOrOptions);
  };

  const toggleAlbumFavorites = useCallback((songs, anchorOrOptions = { placement: 'bottom' }) => {
    const safeSongs = Array.isArray(songs) ? songs : [];
    const candidateIds = Array.from(new Set(safeSongs
      .map((song) => song?.src)
      .filter(Boolean)));
    if (candidateIds.length === 0) return;

    const allFavorited = candidateIds.every((id) => tempPlaylistSet.has(id));
    if (allFavorited) {
      const removeSet = new Set(candidateIds);
      setTempPlaylistIds((prev) => prev.filter((id) => !removeSet.has(id)));
      showToast(
        candidateIds.length === 1 ? '已取消收藏 1 首' : `已取消收藏 ${candidateIds.length} 首`,
        'tone-remove',
        anchorOrOptions
      );
      return;
    }

    const additions = candidateIds.filter((id) => !tempPlaylistSet.has(id));
    if (additions.length === 0) {
      showToast('已全部在收藏', 'tone-add', anchorOrOptions);
      return;
    }

    setTempPlaylistIds((prev) => [...prev, ...additions]);
    showToast(
      additions.length === 1 ? '已收藏 1 首' : `已收藏 ${additions.length} 首`,
      'tone-add',
      anchorOrOptions
    );
  }, [showToast, tempPlaylistSet]);

  const clearTempPlaylist = useCallback((anchorOrOptions = { placement: 'bottom' }) => {
    setTempPlaylistIds((prev) => (prev.length === 0 ? prev : []));
    showToast('已清空收藏', 'tone-remove', anchorOrOptions);
  }, [showToast]);

  const playFavorites = useCallback((song) => {
    if (!favoriteAlbum || favoriteAlbum.songs.length === 0) return;

    const target = song
      ? favoriteAlbum.songs.find((item) => item.src === song.src)
      : favoriteAlbum.songs[0];
    const nextTrack = target || favoriteAlbum.songs[0];

    const isSameTrack = Boolean(currentTrack?.src) && currentTrack.src === nextTrack.src;
    const isInFavoritesAlbum = currentAlbum?.id === favoriteAlbum.id;

    // Keep same click behavior as album list rows: second click toggles play/pause.
    if (song && isInFavoritesAlbum && isSameTrack) {
      setIsPlaying((prev) => !prev);
      return;
    }

    setCurrentAlbum(favoriteAlbum);
    setCurrentTrack(nextTrack);
    setIsPlaying(true);
  }, [
    favoriteAlbum,
    currentTrack?.src,
    currentAlbum?.id,
    setCurrentAlbum,
    setCurrentTrack,
    setIsPlaying
  ]);

  const navigateToAlbum = (album) => {
    setSelectedAlbum((prev) => (prev && prev.id === album.id ? null : album));
    setIsSidebarOpen(false);
  };

  const searchTerm = searchQuery.trim().toLowerCase();
  const filteredAlbums = useMemo(() => {
    if (!searchTerm) return musicAlbums;
    return musicAlbums.filter((album) => (
      album.name.toLowerCase().includes(searchTerm) ||
      album.artist.toLowerCase().includes(searchTerm) ||
      album.songs.some((song) => song.name.toLowerCase().includes(searchTerm))
    ));
  }, [musicAlbums, searchTerm]);

  const songSuggestions = useMemo(() => {
    if (!searchTerm) return [];
    const results = [];
    for (const album of musicAlbums) {
      const albumMatch = album.name.toLowerCase().includes(searchTerm) ||
        album.artist.toLowerCase().includes(searchTerm);
      for (const song of album.songs) {
        if (albumMatch || song.name.toLowerCase().includes(searchTerm)) {
          results.push({ album, song });
          if (results.length >= 8) return results;
        }
      }
    }
    return results;
  }, [musicAlbums, searchTerm]);
  const pageLoadingFallback = <div className="page-loading">加载中...</div>;
  const isLibraryReady = Boolean(currentTrack && currentAlbum && musicAlbums.length > 0);
  const showLibraryLoading = isMusicLoading || (!musicLoadError && musicAlbums.length > 0 && !isLibraryReady);

  return (
    <>
      <div className={`app-root ${view === 'video' ? 'no-player' : ''}`}>
        <div className={`app-container ${isSidebarOpen ? 'sidebar-open' : ''}`}>
          <div className="app-layout">
            <Sidebar
              view={view}
              setView={handleViewChange}
              isSidebarOpen={isSidebarOpen}
              setIsSidebarOpen={setIsSidebarOpen}
              themePreference={themePreference}
              onThemeToggle={handleThemeToggle}
            />

            <main className="main-view">
              {view === 'library' && (
                <div className="view-panel view-panel-library">
                  {showLibraryLoading && pageLoadingFallback}
                  {!showLibraryLoading && musicLoadError && (
                    <div className="page-loading">{musicLoadError}</div>
                  )}
                  {!showLibraryLoading && !musicLoadError && isLibraryReady && (
                    <>
                      <SearchHeader
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        title=""
                        subtitle=""
                        suggestions={songSuggestions}
                        onSelectSuggestion={(item) => {
                          playSongFromAlbum(item.album, item.song);
                          setSearchQuery(item.song.name);
                        }}
                      />
                      <AlbumGrid
                        musicAlbums={filteredAlbums}
                        navigateToAlbum={navigateToAlbum}
                        expandedAlbumId={selectedAlbum ? selectedAlbum.id : null}
                        currentTrack={currentTrack}
                        isPlaying={isPlaying}
                        playSongFromAlbum={playSongFromAlbum}
                        tempPlaylistSet={tempPlaylistSet}
                        onToggleTempSong={toggleTempSong}
                        onToggleAlbumFavorites={toggleAlbumFavorites}
                      />
                    </>
                  )}
                  {!showLibraryLoading && !musicLoadError && !isLibraryReady && (
                    <div className="page-loading">暂无曲库</div>
                  )}
                </div>
              )}
              {view === 'video' && (
                <div className="view-panel view-panel-video">
                  <Suspense fallback={pageLoadingFallback}>
                    <VideoPage requestVideoView={requestVideoView} />
                  </Suspense>
                </div>
              )}
              {view === 'download' && (
                <div className="view-panel view-panel-download">
                  <Suspense fallback={pageLoadingFallback}>
                    <DownloadPage />
                  </Suspense>
                </div>
              )}
              {view === 'about' && (
                <div className="view-panel view-panel-about">
                  <Suspense fallback={pageLoadingFallback}>
                    <AboutPage />
                  </Suspense>
                </div>
              )}
            </main>
          </div>
        </div>

        {view !== 'video' && isLibraryReady && (
          <>
            <PlayerBar
              currentTrack={currentTrack}
              currentAlbum={currentAlbum}
              isPlaying={isPlaying}
              handlePlayPause={handlePlayPause}
              progress={progress}
              handleSeek={handleSeek}
              togglePlayMode={togglePlayMode}
              getPlayModeIcon={getPlayModeIcon}
              handlePrev={handlePrev}
              handleNext={handleNext}
              setIsLyricsOpen={setLyricsOverlayOpen}
              setIsAlbumListOpen={setAlbumListOverlayOpen}
              onShare={handleShareCurrentTrack}
              isTrackNameOverflowing={isTrackNameOverflowing}
              trackNameRef={trackNameRef}
            />

            {hasLyricsOverlayLoaded && (
              <Suspense fallback={null}>
                <LyricsOverlay
                  isLyricsOpen={isLyricsOpen}
                  setIsLyricsOpen={setLyricsOverlayOpen}
                  setIsAlbumListOpen={setAlbumListOverlayOpen}
                  currentTrack={currentTrack}
                  currentAlbum={currentAlbum}
                  isPlaying={isPlaying}
                  handlePlayPause={handlePlayPause}
                  progress={progress}
                  currentTime={currentTime}
                  duration={duration}
                  lyrics={lyrics}
                  currentLyricIndex={currentLyricIndex}
                  handleSeek={handleSeek}
                  togglePlayMode={togglePlayMode}
                  getPlayModeIcon={getPlayModeIcon}
                  handlePrev={handlePrev}
                  handleNext={handleNext}
                  audioRef={audioRef}
                  onAddToFavorites={addTempSong}
                  onShare={handleShareCurrentTrack}
                />
              </Suspense>
            )}

            {hasAlbumListOverlayLoaded && (
              <Suspense fallback={null}>
                <AlbumListOverlay
                  isOpen={isAlbumListOpen}
                  onClose={() => setAlbumListOverlayOpen(false)}
                  album={listAlbum}
                  currentTrack={currentTrack}
                  isPlaying={isPlaying}
                  playSongFromAlbum={playSongFromAlbum}
                  tempPlaylistSet={tempPlaylistSet}
                  tempPlaylistCount={tempPlaylistIds.length}
                  tempPlaylistItems={tempPlaylistItems}
                  onToggleTempSong={toggleTempSong}
                  onToggleAlbumFavorites={toggleAlbumFavorites}
                  onClearTempPlaylist={clearTempPlaylist}
                  onPlayFavorites={playFavorites}
                />
              </Suspense>
            )}
          </>
        )}

        {isVideoAccessOpen && (
          <div className="video-access-modal" onClick={closeVideoAccessModal}>
            <div className="video-access-card" onClick={(e) => e.stopPropagation()}>
              <div className="video-access-title">视频访问</div>
              <p className="video-access-tip">
                关注公众号【民谣俱乐部】
                <br />
                发送“视频”获取密码。
              </p>
              <div className="video-access-qr">
                <img loading="lazy" src="https://r2.1701701.xyz/img/gzh.jpg" alt="公众号二维码" />
              </div>
              <input
                className="video-access-input"
                type="password"
                placeholder="请输入访问密码"
                value={videoPassword}
                onChange={(e) => {
                  setVideoPassword(e.target.value);
                  setVideoPasswordError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleVideoAccessSubmit();
                }}
              />
              {videoPasswordError && <div className="video-access-error">{videoPasswordError}</div>}
              <div className="video-access-actions">
                <button
                  type="button"
                  className="video-access-btn ghost"
                  onClick={closeVideoAccessModal}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="video-access-btn"
                  onClick={handleVideoAccessSubmit}
                >
                  确认
                </button>
              </div>
            </div>
          </div>
        )}

        {sharePanelData && (
          <div className="share-panel-backdrop" onClick={closeSharePanel}>
            <div className="share-panel-card" onClick={(event) => event.stopPropagation()}>
              <div className="share-panel-header">
                <div className="share-panel-title">分享歌曲</div>
                <button
                  type="button"
                  className="share-panel-close-btn"
                  onClick={closeSharePanel}
                  aria-label="关闭分享面板"
                >
                  ×
                </button>
              </div>
              <div className="share-panel-card-preview">
                {isShareCardGenerating && (
                  <div className="share-card-loading">正在生成分享卡片...</div>
                )}
                {!isShareCardGenerating && shareCardDataUrl && (
                  <img loading="lazy" src={shareCardDataUrl} alt="分享卡片预览" />
                )}
                {!isShareCardGenerating && !shareCardDataUrl && (
                  <div className="share-card-loading">暂未生成分享卡片</div>
                )}
              </div>
              <div className="share-panel-url" title={sharePanelData.url}>
                {sharePanelData.url}
              </div>
              <div className="share-panel-actions">
                <button
                  type="button"
                  className="share-panel-btn ghost"
                  onClick={(event) => {
                    handleCopyShareLink({
                      placement: 'side',
                      anchorEvent: { currentTarget: event.currentTarget }
                    });
                  }}
                >
                  复制链接
                </button>
                <button
                  type="button"
                  className="share-panel-btn primary"
                  onClick={handleShareCardImage}
                  disabled={!shareCardDataUrl || isShareCardGenerating}
                >
                  分享卡片
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div
        className={`app-toast ${isToastVisible ? 'show' : ''} ${toastTone} ${toastPlacement !== 'anchor' ? `placement-${toastPlacement}` : ''}`}
        role="status"
        aria-live="polite"
      >
        <span className="toast-text">{toastMessage}</span>
      </div>
      {showViewportDebug && viewportDebug && (
        <div className="viewport-debug-panel" aria-live="polite">
          <div className="viewport-debug-title">Viewport Debug</div>
          <div>time: {viewportDebug.time}</div>
          <div>mode: {viewportDebug.mode} / navigator.standalone: {viewportDebug.navStandalone}</div>
          <div>meta viewport: {viewportDebug.viewportMeta}</div>
          <div>inner: {viewportDebug.inner} | client: {viewportDebug.client}</div>
          <div>visualViewport: {viewportDebug.visualViewport}</div>
          <div>scroll: {viewportDebug.scroll}</div>
          <div>safe probe: {viewportDebug.safeProbe}</div>
          <div>safe vars: {viewportDebug.safeVars}</div>
          <div>root class: {viewportDebug.rootClass}</div>
        </div>
      )}
    </>
  );
};

export default App;

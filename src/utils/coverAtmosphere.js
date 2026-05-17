const coverAtmosphereCache = new Map();

const FALLBACK_COLOR = { r: 18, g: 18, b: 22 };

const clampChannel = (value) => Math.max(0, Math.min(255, Math.round(value)));

const mixColors = (a, b, ratio = 0.5) => ({
  r: clampChannel(a.r + (b.r - a.r) * ratio),
  g: clampChannel(a.g + (b.g - a.g) * ratio),
  b: clampChannel(a.b + (b.b - a.b) * ratio)
});

const scaleColor = (color, factor) => ({
  r: clampChannel(color.r * factor),
  g: clampChannel(color.g * factor),
  b: clampChannel(color.b * factor)
});

const saturateColor = (color, factor = 1) => {
  const average = (color.r + color.g + color.b) / 3;
  return {
    r: clampChannel(average + (color.r - average) * factor),
    g: clampChannel(average + (color.g - average) * factor),
    b: clampChannel(average + (color.b - average) * factor)
  };
};

const colorToRgbTuple = (color) => `${color.r}, ${color.g}, ${color.b}`;

const loadImage = (src) => new Promise((resolve, reject) => {
  if (!src || typeof Image === 'undefined') {
    reject(new Error('image unavailable'));
    return;
  }

  const image = new Image();
  image.decoding = 'async';
  image.crossOrigin = 'anonymous';
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error(`failed to load image: ${src}`));
  image.src = src;

  if (image.complete && image.naturalWidth > 0) {
    resolve(image);
  }
});

const createCanvas = (width, height) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

const drawCoverImage = (ctx, image, width, height, bleed = 0) => {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const scale = Math.max((width + bleed * 2) / sourceWidth, (height + bleed * 2) / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const x = (width - drawWidth) / 2;
  const y = (height - drawHeight) / 2;
  ctx.drawImage(image, x, y, drawWidth, drawHeight);
};

const getSampleImageData = (image, size = 24) => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return null;
  }

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
};

const sampleAverageColor = (imageData, predicate = null) => {
  if (!imageData) {
    return FALLBACK_COLOR;
  }

  const { data, width, height } = imageData;
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;

  for (let i = 0; i < data.length; i += 4) {
    const pixelIndex = i / 4;
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    if (predicate && !predicate(x, y, width, height)) continue;

    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    count += 1;
  }

  if (!count) {
    return FALLBACK_COLOR;
  }

  return {
    r: Math.round(r / count),
    g: Math.round(g / count),
    b: Math.round(b / count)
  };
};

const buildAtmospherePalette = (image) => {
  const sampleImageData = getSampleImageData(image, 24);
  const overall = sampleAverageColor(sampleImageData);
  const upper = sampleAverageColor(sampleImageData, (_x, y, _w, h) => y < h * 0.42);
  const lower = sampleAverageColor(sampleImageData, (_x, y, _w, h) => y > h * 0.58);
  const center = sampleAverageColor(
    sampleImageData,
    (x, y, w, h) => x > w * 0.24 && x < w * 0.76 && y > h * 0.22 && y < h * 0.78
  );

  const accent = saturateColor(scaleColor(mixColors(overall, center, 0.68), 0.98), 1.22);
  const glow = saturateColor(scaleColor(mixColors(upper, overall, 0.42), 1.08), 1.16);
  const shadow = saturateColor(scaleColor(mixColors(lower, overall, 0.48), 0.5), 1.08);

  return {
    accent: colorToRgbTuple(accent),
    glow: colorToRgbTuple(glow),
    shadow: colorToRgbTuple(shadow)
  };
};

const renderTopCoverLayer = (image) => {
  const canvas = createCanvas(720, 720);
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) throw new Error('canvas unavailable');

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.filter = 'saturate(1.04) contrast(1.04) brightness(0.88)';
  drawCoverImage(ctx, image, canvas.width, canvas.height);
  ctx.filter = 'none';

  ctx.globalCompositeOperation = 'destination-out';
  const fade = ctx.createLinearGradient(0, 0, 0, canvas.height);
  fade.addColorStop(0, 'rgba(0, 0, 0, 0)');
  fade.addColorStop(0.6, 'rgba(0, 0, 0, 0)');
  fade.addColorStop(0.72, 'rgba(0, 0, 0, 0.28)');
  fade.addColorStop(0.88, 'rgba(0, 0, 0, 0.78)');
  fade.addColorStop(1, 'rgba(0, 0, 0, 1)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  return canvas.toDataURL('image/png');
};

export const buildCoverAtmosphereAssets = async (coverSrc) => {
  if (!coverSrc || typeof document === 'undefined') {
    return null;
  }

  if (coverAtmosphereCache.has(coverSrc)) {
    return coverAtmosphereCache.get(coverSrc);
  }

  const task = (async () => {
    const image = await loadImage(coverSrc);
    return {
      palette: buildAtmospherePalette(image),
      topCover: renderTopCoverLayer(image)
    };
  })()
    .catch(() => null);

  coverAtmosphereCache.set(coverSrc, task);
  return task;
};

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildThemeWipeFrames,
  prefersReducedMotion,
  runThemeWipe,
  shouldAnimateThemeWipe,
  supportsViewTransition,
  THEME_WIPE_DURATION
} from './themeTransition.js';

const parsePolygon = (frame) =>
  frame
    .replace(/^polygon\(/, '')
    .replace(/\)$/, '')
    .split(',')
    .map((pair) => pair.trim().split(' ').map((value) => Number.parseFloat(value)));

const boundsOf = (points) => ({
  minX: Math.min(...points.map((p) => p[0])),
  maxX: Math.max(...points.map((p) => p[0])),
  minY: Math.min(...points.map((p) => p[1])),
  maxY: Math.max(...points.map((p) => p[1]))
});

// 鞋带公式：用来判断某一帧到底揭开了多少面积
const areaOf = (points) => {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
};

const installMatchMedia = (matches) => {
  window.matchMedia = vi.fn(() => ({
    matches,
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn()
  }));
};

afterEach(() => {
  delete document.startViewTransition;
  delete document.documentElement.animate;
  delete window.matchMedia;
  vi.restoreAllMocks();
});

describe('buildThemeWipeFrames', () => {
  it('produces a polygon keyframe per step', () => {
    const frames = buildThemeWipeFrames(1200, 30, 1280, 800);

    expect(frames).toHaveLength(17);
    frames.forEach((frame) => {
      expect(frame.startsWith('polygon(')).toBe(true);
      expect(frame.endsWith(')')).toBe(true);
    });
  });

  it('starts with nothing revealed and ends covering the whole viewport', () => {
    const width = 1280;
    const height = 800;
    const frames = buildThemeWipeFrames(1200, 30, width, height);

    // 第一帧只是一堆退化成线的多边形，面积应为 0（坐标取整会留下几平方像素的噪声）
    expect(areaOf(parsePolygon(frames[0]))).toBeLessThan(width * height * 0.001);

    const last = boundsOf(parsePolygon(frames[frames.length - 1]));
    expect(last.minX).toBeLessThanOrEqual(0);
    expect(last.minY).toBeLessThanOrEqual(0);
    expect(last.maxX).toBeGreaterThanOrEqual(width);
    expect(last.maxY).toBeGreaterThanOrEqual(height);
  });

  it('reveals more area as the wipe progresses', () => {
    const frames = buildThemeWipeFrames(1200, 30, 1280, 800);
    const areas = frames.map((frame) => areaOf(parsePolygon(frame)));

    areas.forEach((area, index) => {
      if (index === 0) return;
      expect(area).toBeGreaterThanOrEqual(areas[index - 1]);
    });
    expect(areas[areas.length - 1]).toBeGreaterThan(areas[0]);
  });
});

describe('environment checks', () => {
  it('reports no view transition support in a bare jsdom document', () => {
    expect(supportsViewTransition()).toBe(false);
    expect(shouldAnimateThemeWipe()).toBe(false);
  });

  it('treats a missing matchMedia as motion allowed', () => {
    expect(prefersReducedMotion()).toBe(false);
  });

  it('detects the reduced motion preference', () => {
    installMatchMedia(true);
    expect(prefersReducedMotion()).toBe(true);
    expect(shouldAnimateThemeWipe()).toBe(false);
  });
});

describe('runThemeWipe', () => {
  it('applies the theme directly when view transitions are unavailable', () => {
    const applyTheme = vi.fn();

    const transition = runThemeWipe({ originX: 10, originY: 10, applyTheme });

    expect(transition).toBeNull();
    expect(applyTheme).toHaveBeenCalledTimes(1);
  });

  it('applies the theme directly when the user prefers reduced motion', () => {
    installMatchMedia(true);
    document.startViewTransition = vi.fn();
    const applyTheme = vi.fn();

    const transition = runThemeWipe({ originX: 10, originY: 10, applyTheme });

    expect(transition).toBeNull();
    expect(document.startViewTransition).not.toHaveBeenCalled();
    expect(applyTheme).toHaveBeenCalledTimes(1);
  });

  it('drives the clip-path wipe on the incoming snapshot', async () => {
    const applyTheme = vi.fn();
    const animate = vi.fn();
    const transition = { ready: Promise.resolve(), finished: Promise.resolve() };

    document.documentElement.animate = animate;
    document.startViewTransition = vi.fn((callback) => {
      callback();
      return transition;
    });

    const result = runThemeWipe({ originX: 1200, originY: 30, applyTheme });

    expect(result).toBe(transition);
    expect(applyTheme).toHaveBeenCalledTimes(1);

    await Promise.resolve();
    await Promise.resolve();

    expect(animate).toHaveBeenCalledTimes(1);
    const [keyframes, options] = animate.mock.calls[0];
    expect(Array.isArray(keyframes.clipPath)).toBe(true);
    expect(keyframes.clipPath[0].startsWith('polygon(')).toBe(true);
    expect(options).toMatchObject({
      duration: THEME_WIPE_DURATION,
      easing: 'linear',
      pseudoElement: '::view-transition-new(root)'
    });
  });

  it('does not throw when the browser skips the transition', async () => {
    const applyTheme = vi.fn();
    const rejected = Promise.reject(new Error('skipped'));
    rejected.catch(() => {});

    document.startViewTransition = vi.fn((callback) => {
      callback();
      return { ready: rejected, finished: Promise.resolve() };
    });

    expect(() => runThemeWipe({ originX: 5, originY: 5, applyTheme })).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
  });
});

import { describe, expect, it } from 'vitest';

import {
  getAdaptiveMobileCoverSize,
  shouldUseCompactMobileFullscreenLayout
} from './mobileFullscreenLayout.js';

describe('mobile fullscreen layout sizing', () => {
  it('treats narrow browser-sized viewports as compact before controls get cramped', () => {
    expect(shouldUseCompactMobileFullscreenLayout({ width: 390, height: 724 })).toBe(true);
    expect(shouldUseCompactMobileFullscreenLayout({ width: 430, height: 812 })).toBe(false);
    expect(shouldUseCompactMobileFullscreenLayout({ width: 768, height: 820 })).toBe(false);
  });

  it('shrinks the cover against visual viewport height while preserving a usable minimum', () => {
    expect(getAdaptiveMobileCoverSize({ width: 390, height: 724 })).toBe(275);
    expect(getAdaptiveMobileCoverSize({ width: 430, height: 812 })).toBe(325);
    expect(getAdaptiveMobileCoverSize({ width: 390, height: 568 })).toBe(193);
  });
});

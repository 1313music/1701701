import { describe, expect, it } from 'vitest';

import {
  PUBLIC_SEO_VIEWS,
  getSeoRobotsContent,
  isPublicSeoView
} from './seoConfig.js';

describe('seoConfig', () => {
  it('excludes the download page from public SEO output while the switch is off', () => {
    expect(PUBLIC_SEO_VIEWS).not.toContain('download');
    expect(isPublicSeoView('download')).toBe(false);
    expect(getSeoRobotsContent('download')).toBe('noindex,follow');
  });
});

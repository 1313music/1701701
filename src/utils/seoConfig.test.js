import { describe, expect, it } from 'vitest';

import {
  PUBLIC_SEO_VIEWS,
  getSeoRobotsContent,
  isPublicSeoView
} from './seoConfig.js';

describe('seoConfig', () => {
  it('excludes the download page while keeping resources public by default', () => {
    expect(PUBLIC_SEO_VIEWS).not.toContain('download');
    expect(PUBLIC_SEO_VIEWS).toContain('resources');
    expect(isPublicSeoView('download')).toBe(false);
    expect(isPublicSeoView('resources')).toBe(true);
    expect(getSeoRobotsContent('download')).toBe('noindex,follow');
    expect(getSeoRobotsContent('resources')).toBe('index,follow,max-image-preview:large');
  });
});

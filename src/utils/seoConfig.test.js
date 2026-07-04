import { describe, expect, it } from 'vitest';

import {
  PUBLIC_SEO_VIEWS,
  getSeoRobotsContent,
  isPublicSeoView
} from './seoConfig.js';

describe('seoConfig', () => {
  it('excludes the download page while keeping public content pages indexable by default', () => {
    expect(PUBLIC_SEO_VIEWS).not.toContain('download');
    expect(PUBLIC_SEO_VIEWS).toContain('resources');
    expect(PUBLIC_SEO_VIEWS).toContain('archive');
    expect(PUBLIC_SEO_VIEWS).toContain('support');
    expect(isPublicSeoView('download')).toBe(false);
    expect(isPublicSeoView('resources')).toBe(true);
    expect(isPublicSeoView('archive')).toBe(true);
    expect(isPublicSeoView('support')).toBe(true);
    expect(getSeoRobotsContent('download')).toBe('noindex,follow');
    expect(getSeoRobotsContent('resources')).toBe('index,follow,max-image-preview:large');
    expect(getSeoRobotsContent('archive')).toBe('index,follow,max-image-preview:large');
    expect(getSeoRobotsContent('support')).toBe('index,follow,max-image-preview:large');
  });
});

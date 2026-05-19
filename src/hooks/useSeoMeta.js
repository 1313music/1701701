import { useEffect } from 'react';

import { upsertJsonLd, upsertLinkTag, upsertMetaTag } from '../utils/appDomUtils.js';
import {
  DEFAULT_OG_IMAGE,
  buildSeoJsonLdPayload,
  getCanonicalUrlForView,
  getSeoConfigForView,
  getSeoRobotsContent,
  isPublicSeoView,
  SITE_NAME
} from '../utils/seoConfig.js';

export const useSeoMeta = ({ view, musicAlbums }) => {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const currentSeo = getSeoConfigForView(view);
    const canonicalUrl = getCanonicalUrlForView(isPublicSeoView(view) ? view : 'library');
    const keywordsContent = Array.isArray(currentSeo.keywords)
      ? currentSeo.keywords.join(',')
      : '';

    document.title = currentSeo.title;
    upsertMetaTag({ name: 'description' }, currentSeo.description);
    upsertMetaTag({ name: 'robots' }, getSeoRobotsContent(view));
    upsertMetaTag({ name: 'keywords' }, keywordsContent);
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
    upsertLinkTag('canonical', canonicalUrl);
    upsertJsonLd('page-seo-jsonld', buildSeoJsonLdPayload({
      view,
      currentSeo,
      canonicalUrl,
      musicAlbums
    }));
  }, [view, musicAlbums]);
};

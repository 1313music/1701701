#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_OG_IMAGE,
  PUBLIC_SEO_VIEWS,
  SEO_VIEW_PATHS,
  SITE_NAME,
  SITE_URL,
  buildSeoJsonLdPayload,
  getCanonicalUrlForView,
  getSeoConfigForView
} from '../src/utils/seoConfig.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(projectRoot, 'dist');
const publicDir = path.join(projectRoot, 'public');

const HTML_ENTITIES = Object.freeze({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
});

const PAGE_META = Object.freeze({
  library: { changefreq: 'daily', priority: '1.0' },
  video: { changefreq: 'daily', priority: '0.9' },
  download: { changefreq: 'daily', priority: '0.9' },
  gallery: { changefreq: 'daily', priority: '0.9' },
  app: { changefreq: 'weekly', priority: '0.8' },
  about: { changefreq: 'weekly', priority: '0.7' }
});

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => HTML_ENTITIES[char]);

const escapeRegExp = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const escapeJsonForScript = (value) => JSON.stringify(value, null, 2).replace(/</g, '\\u003c');

const readJsonIfExists = async (filename, fallback) => {
  try {
    const raw = await readFile(path.join(publicDir, filename), 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`[seo] Unable to read ${filename}: ${error.message}`);
    return fallback;
  }
};

const enabledSorted = (items = []) => (
  Array.isArray(items)
    ? items
      .filter((item) => item && item.enabled !== false)
      .toSorted((a, b) => {
        const orderA = Number.isFinite(a.sortOrder) ? a.sortOrder : 999999;
        const orderB = Number.isFinite(b.sortOrder) ? b.sortOrder : 999999;
        if (orderA !== orderB) return orderA - orderB;
        return String(a.name || a.title || a.id || '').localeCompare(
          String(b.name || b.title || b.id || ''),
          'zh-CN'
        );
      })
    : []
);

const toIsoDate = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const latestIsoDate = (...values) => {
  const dates = values
    .map((value) => (value ? new Date(value) : null))
    .filter((date) => date && !Number.isNaN(date.getTime()));
  if (dates.length === 0) return new Date().toISOString().slice(0, 10);
  return new Date(Math.max(...dates.map((date) => date.getTime()))).toISOString().slice(0, 10);
};

const insertBeforeHeadClose = (html, markup) => {
  if (!/<\/head>/i.test(html)) {
    throw new Error('dist/index.html is missing </head>');
  }
  return html.replace(/\s*<\/head>/i, `\n${markup}\n</head>`);
};

const replaceOrInsertHeadTag = (html, pattern, tag) => (
  pattern.test(html) ? html.replace(pattern, tag) : insertBeforeHeadClose(html, tag)
);

const upsertMetaName = (html, name, content) => replaceOrInsertHeadTag(
  html,
  new RegExp(`<meta\\s+name=["']${escapeRegExp(name)}["'][^>]*>`, 'i'),
  `<meta name="${escapeHtml(name)}" content="${escapeHtml(content)}" />`
);

const upsertMetaProperty = (html, property, content) => replaceOrInsertHeadTag(
  html,
  new RegExp(`<meta\\s+property=["']${escapeRegExp(property)}["'][^>]*>`, 'i'),
  `<meta property="${escapeHtml(property)}" content="${escapeHtml(content)}" />`
);

const upsertCanonical = (html, href) => replaceOrInsertHeadTag(
  html,
  /<link\s+rel=["']canonical["'][^>]*>/i,
  `<link rel="canonical" href="${escapeHtml(href)}" />`
);

const upsertInitialJsonLd = (html, payload) => {
  const withoutExisting = html.replace(
    /\s*<script\s+type=["']application\/ld\+json["']\s+id=["']initial-page-seo-jsonld["'][\s\S]*?<\/script>/i,
    ''
  );
  return insertBeforeHeadClose(
    withoutExisting,
    `<script type="application/ld+json" id="initial-page-seo-jsonld">${escapeJsonForScript(payload)}</script>`
  );
};

const upsertRootContent = (html, content) => {
  const rootPattern = /<div\s+id=["']root["']>[\s\S]*?<\/div>/i;
  if (!rootPattern.test(html)) {
    throw new Error('dist/index.html is missing #root');
  }
  return html.replace(rootPattern, `<div id="root">\n${content}\n  </div>`);
};

const getRouteOutputFile = (view) => {
  if (view === 'library') return path.join(distDir, 'index.html');
  return path.join(distDir, SEO_VIEW_PATHS[view].replace(/^\//, ''), 'index.html');
};

const buildNavigation = () => {
  const labels = {
    library: '音乐',
    video: '视频',
    download: '下载',
    gallery: '图库',
    app: 'APP',
    about: '关于'
  };

  return `<nav class="seo-static-nav" aria-label="主要页面">
      ${PUBLIC_SEO_VIEWS.map((view) => (
    `<a href="${escapeHtml(SEO_VIEW_PATHS[view])}">${escapeHtml(labels[view] || getSeoConfigForView(view).heading)}</a>`
  )).join('\n      ')}
    </nav>`;
};

const isHttpUrl = (value = '') => /^https?:\/\//i.test(String(value || '').trim());

const buildImage = ({ src, alt, className = 'seo-static-thumb' }) => {
  if (!isHttpUrl(src)) return '';
  return `<img class="${escapeHtml(className)}" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" width="120" height="120" loading="lazy" decoding="async" />`;
};

const buildInlineList = (items, limit = 10) => {
  const visibleItems = items.filter(Boolean).slice(0, limit);
  if (visibleItems.length === 0) return '';
  return `<ol class="seo-static-items">
          ${visibleItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('\n          ')}
        </ol>`;
};

const buildListSection = (title, items) => {
  if (!items.length) return '';
  return `<section class="seo-static-section">
      <h2>${escapeHtml(title)}</h2>
      <ul>
        ${items.join('\n        ')}
      </ul>
    </section>`;
};

const buildCardSection = (title, cards) => {
  if (!cards.length) return '';
  return `<section class="seo-static-section">
      <h2>${escapeHtml(title)}</h2>
      <div class="seo-static-grid">
        ${cards.join('\n        ')}
      </div>
    </section>`;
};

const countEnabled = (items = []) => enabledSorted(items).length;

const countSongs = (album) => countEnabled(album?.songs);

const collectVideoItems = (items = [], limit = 12, parentTitle = '') => {
  const result = [];
  const visit = (entryItems, entryParentTitle) => {
    for (const item of enabledSorted(entryItems)) {
      if (result.length >= limit) return;
      const title = String(item?.title || '').trim();
      if (!title) continue;
      const nextParentTitle = entryParentTitle ? `${entryParentTitle} / ${title}` : title;
      if (Array.isArray(item.items) && item.items.length > 0) {
        visit(item.items, nextParentTitle);
        continue;
      }
      result.push({
        title: entryParentTitle ? `${entryParentTitle}：${title}` : title,
        thumb: item.thumb || ''
      });
    }
  };
  visit(items, parentTitle);
  return result;
};

const countVideoLeaves = (items = []) => enabledSorted(items).reduce((total, item) => {
  if (Array.isArray(item.items) && item.items.length > 0) {
    return total + countVideoLeaves(item.items);
  }
  return total + 1;
}, 0);

const countDownloadItems = (section) => enabledSorted(section?.groups).reduce(
  (total, group) => total + countEnabled(group.items),
  0
);

const buildAlbumSection = (musicAlbums) => {
  const cards = enabledSorted(musicAlbums).slice(0, 20).map((album) => {
    const songs = enabledSorted(album.songs);
    const songNames = songs.map((song) => song.name).filter(Boolean);
    const image = buildImage({
      src: album.cover,
      alt: `${album.name} 封面`
    });

    return `<article class="seo-static-card">
          ${image}
          <div>
            <h3>${escapeHtml(album.name)}</h3>
            <p class="seo-static-meta">${escapeHtml(album.artist || '李志')} · 共 ${songs.length} 首</p>
            ${buildInlineList(songNames, 10)}
          </div>
        </article>`;
  });

  return buildCardSection('可浏览专辑与现场', cards);
};

const buildVideoSection = (videoCategories) => {
  const cards = enabledSorted(videoCategories).slice(0, 10).map((category) => {
    const videos = collectVideoItems(category.items, 10);
    const image = buildImage({
      src: videos.find((item) => item.thumb)?.thumb,
      alt: `${category.name} 视频封面`
    });

    return `<article class="seo-static-card">
          ${image}
          <div>
            <h3>${escapeHtml(category.name)}</h3>
            <p class="seo-static-meta">共 ${countVideoLeaves(category.items)} 个视频条目</p>
            ${buildInlineList(videos.map((item) => item.title), 10)}
          </div>
        </article>`;
  });

  return buildCardSection('视频分类', cards);
};

const buildDownloadSection = (downloadSections) => {
  const cards = enabledSorted(downloadSections).slice(0, 10).map((section) => {
    const groupSummaries = enabledSorted(section.groups)
      .slice(0, 6)
      .map((group) => {
        const itemTitles = enabledSorted(group.items)
          .slice(0, 5)
          .map((item) => item.title)
          .filter(Boolean)
          .join('、');
        return itemTitles ? `${group.title}：${itemTitles}` : group.title;
      })
      .filter(Boolean);

    return `<article class="seo-static-card seo-static-card-text">
          <div>
            <h3>${escapeHtml(section.title)}</h3>
            <p class="seo-static-meta">共 ${countDownloadItems(section)} 个资源条目</p>
            ${buildInlineList(groupSummaries, 6)}
          </div>
        </article>`;
  });

  return buildCardSection('资源分类', cards);
};

const buildStatsSection = ({ musicAlbums, videoCategories, downloadSections }) => {
  const albumCount = countEnabled(musicAlbums);
  const songCount = enabledSorted(musicAlbums).reduce((total, album) => total + countSongs(album), 0);
  const videoCount = enabledSorted(videoCategories).reduce((total, category) => (
    total + countVideoLeaves(category.items)
  ), 0);
  const downloadCount = enabledSorted(downloadSections).reduce((total, section) => (
    total + countDownloadItems(section)
  ), 0);
  const stats = [
    `<li><strong>音乐曲库</strong><span>${albumCount} 个专辑/现场条目，约 ${songCount} 首曲目</span></li>`,
    `<li><strong>视频内容</strong><span>${countEnabled(videoCategories)} 个分类，约 ${videoCount} 个视频条目</span></li>`
  ];

  if (PUBLIC_SEO_VIEWS.includes('download')) {
    stats.push(`<li><strong>下载资源</strong><span>${countEnabled(downloadSections)} 个分区，约 ${downloadCount} 个资源条目</span></li>`);
  }

  return buildListSection('站内内容概览', stats);
};

const buildGenericSection = (view) => {
  const map = {
    gallery: [
      '图片索引按分类展示，适合浏览封面、演出相关图片与站点收录图集。',
      '页面会读取已发布图片索引并以瀑布流方式展示。'
    ],
    app: [
      '提供 macOS、Windows 与 Android 客户端下载入口。',
      'iPhone 和 iPad 用户可以通过浏览器添加到主屏幕，以 PWA 方式使用。'
    ],
    about: [
      '本站整理李志音乐、现场视频、下载资源与相关说明。',
      '内容以资料索引、播放列表和站内导航为主，方便集中检索。'
    ]
  };

  return buildListSection(
    view === 'app' ? '可用版本' : '页面内容',
    (map[view] || []).map((item) => `<li>${escapeHtml(item)}</li>`)
  );
};

const buildStaticContent = (view, manifestData) => {
  const currentSeo = getSeoConfigForView(view);
  const sections = [];

  sections.push(buildStatsSection(manifestData));
  if (view === 'library') sections.push(buildAlbumSection(manifestData.musicAlbums));
  if (view === 'video') sections.push(buildVideoSection(manifestData.videoCategories));
  if (view === 'download') sections.push(buildDownloadSection(manifestData.downloadSections));
  if (['gallery', 'app', 'about'].includes(view)) sections.push(buildGenericSection(view));

  return `    <main class="seo-static-shell" aria-label="${escapeHtml(currentSeo.heading)}">
      <h1>${escapeHtml(currentSeo.heading)}</h1>
      <p>${escapeHtml(currentSeo.description)}</p>
      ${buildNavigation()}
      ${sections.filter(Boolean).join('\n      ')}
    </main>`;
};

const buildPageHtml = (baseHtml, view, manifestData) => {
  const currentSeo = getSeoConfigForView(view);
  const canonicalUrl = getCanonicalUrlForView(view);
  const keywords = Array.isArray(currentSeo.keywords) ? currentSeo.keywords.join(',') : '';
  const jsonLd = buildSeoJsonLdPayload({
    view,
    currentSeo,
    canonicalUrl,
    musicAlbums: manifestData.musicAlbums
  });

  let html = baseHtml;
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(currentSeo.title)}</title>`);
  html = upsertMetaName(html, 'description', currentSeo.description);
  html = upsertMetaName(html, 'robots', 'index,follow,max-image-preview:large');
  html = upsertMetaName(html, 'keywords', keywords);
  html = upsertMetaName(html, 'author', SITE_NAME);
  html = upsertMetaName(html, 'applicable-device', 'pc,mobile');
  html = upsertMetaProperty(html, 'og:type', 'website');
  html = upsertMetaProperty(html, 'og:site_name', SITE_NAME);
  html = upsertMetaProperty(html, 'og:locale', 'zh_CN');
  html = upsertMetaProperty(html, 'og:title', currentSeo.title);
  html = upsertMetaProperty(html, 'og:description', currentSeo.description);
  html = upsertMetaProperty(html, 'og:url', canonicalUrl);
  html = upsertMetaProperty(html, 'og:image', DEFAULT_OG_IMAGE);
  html = upsertMetaName(html, 'twitter:card', 'summary_large_image');
  html = upsertMetaName(html, 'twitter:title', currentSeo.title);
  html = upsertMetaName(html, 'twitter:description', currentSeo.description);
  html = upsertMetaName(html, 'twitter:image', DEFAULT_OG_IMAGE);
  html = upsertCanonical(html, canonicalUrl);
  html = upsertInitialJsonLd(html, jsonLd);
  html = upsertRootContent(html, buildStaticContent(view, manifestData));
  return html;
};

const buildSitemapImageEntries = (images) => {
  const seen = new Set();
  const uniqueImages = [];
  for (const image of images) {
    const loc = String(image?.loc || '').trim();
    if (!isHttpUrl(loc) || seen.has(loc)) continue;
    seen.add(loc);
    uniqueImages.push({ ...image, loc });
    if (uniqueImages.length >= 12) break;
  }

  return uniqueImages.map((image) => `    <image:image>
      <image:loc>${escapeHtml(image.loc)}</image:loc>
      ${image.title ? `<image:title>${escapeHtml(image.title)}</image:title>` : ''}
    </image:image>`)
    .join('\n');
};

const getSitemapImagesForView = (view, manifestData) => {
  if (view === 'library') {
    return enabledSorted(manifestData.musicAlbums)
      .map((album) => ({ loc: album.cover, title: `${album.name} 封面` }));
  }

  if (view === 'video') {
    return enabledSorted(manifestData.videoCategories).flatMap((category) => (
      collectVideoItems(category.items, 12)
        .filter((item) => item.thumb)
        .map((item) => ({ loc: item.thumb, title: item.title }))
    ));
  }

  return [{ loc: DEFAULT_OG_IMAGE, title: getSeoConfigForView(view).heading }];
};

const buildSitemap = (lastmodByView, manifestData) => {
  const urls = PUBLIC_SEO_VIEWS.map((view) => {
    const meta = PAGE_META[view];
    const imageEntries = buildSitemapImageEntries(getSitemapImagesForView(view, manifestData));
    return `  <url>
    <loc>${escapeHtml(getCanonicalUrlForView(view))}</loc>
    <lastmod>${escapeHtml(lastmodByView[view])}</lastmod>
    <changefreq>${meta.changefreq}</changefreq>
    <priority>${meta.priority}</priority>
${imageEntries}
  </url>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls}
</urlset>
`;
};

const main = async () => {
  const baseHtml = await readFile(path.join(distDir, 'index.html'), 'utf8');
  const musicManifest = await readJsonIfExists('music-index.json', { albums: [] });
  const videoManifest = await readJsonIfExists('video-index.json', { categories: [] });
  const downloadManifest = await readJsonIfExists('download-index.json', { sections: [] });
  const buildDate = new Date().toISOString().slice(0, 10);
  const lastmodByView = {
    library: toIsoDate(musicManifest.updatedAt) || buildDate,
    video: toIsoDate(videoManifest.updatedAt) || buildDate,
    download: toIsoDate(downloadManifest.updatedAt) || buildDate,
    gallery: buildDate,
    app: buildDate,
    about: buildDate
  };
  lastmodByView.library = latestIsoDate(
    musicManifest.updatedAt,
    videoManifest.updatedAt,
    downloadManifest.updatedAt
  );

  const manifestData = {
    musicAlbums: enabledSorted(musicManifest.albums),
    videoCategories: enabledSorted(videoManifest.categories),
    downloadSections: enabledSorted(downloadManifest.sections)
  };

  for (const view of PUBLIC_SEO_VIEWS) {
    const outputFile = getRouteOutputFile(view);
    await mkdir(path.dirname(outputFile), { recursive: true });
    await writeFile(outputFile, buildPageHtml(baseHtml, view, manifestData));
  }

  await writeFile(path.join(distDir, 'sitemap.xml'), buildSitemap(lastmodByView, manifestData));
  console.log(`[seo] Generated static SEO pages for ${SITE_URL}`);
};

await main();

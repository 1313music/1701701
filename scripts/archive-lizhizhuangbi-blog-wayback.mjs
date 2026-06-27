import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const TARGET = 'lizhizhuangbi.com/blog';
const ARCHIVE_SLUG = 'lizhizhuangbi-blog';
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'archives', ARCHIVE_SLUG);
const PAGES_DIR = path.join(OUTPUT_DIR, 'pages');
const GENERATED_AT = new Date().toISOString();

const CDX_QUERIES = [
  {
    id: 'blog-home-www',
    url: 'https://web.archive.org/cdx?url=www.lizhizhuangbi.com/blog/&from=2010&to=2013&output=json&fl=timestamp,original,statuscode,mimetype,digest&filter=statuscode:200&filter=mimetype:text/html&collapse=digest'
  },
  {
    id: 'blog-home-root',
    url: 'https://web.archive.org/cdx?url=lizhizhuangbi.com/blog/&from=2010&to=2013&output=json&fl=timestamp,original,statuscode,mimetype,digest&filter=statuscode:200&filter=mimetype:text/html&collapse=digest'
  },
  {
    id: 'blog-posts-www',
    url: 'https://web.archive.org/cdx?url=www.lizhizhuangbi.com/blog/%3Fp=*&from=2010&to=2013&output=json&fl=timestamp,original,statuscode,mimetype,digest&filter=statuscode:200&filter=mimetype:text/html&collapse=digest'
  },
  {
    id: 'blog-posts-root',
    url: 'https://web.archive.org/cdx?url=lizhizhuangbi.com/blog/%3Fp=*&from=2010&to=2013&output=json&fl=timestamp,original,statuscode,mimetype,digest&filter=statuscode:200&filter=mimetype:text/html&collapse=digest'
  },
  {
    id: 'blog-months-www',
    url: 'https://web.archive.org/cdx?url=www.lizhizhuangbi.com/blog/%3Fm=*&from=2010&to=2013&output=json&fl=timestamp,original,statuscode,mimetype,digest&filter=statuscode:200&filter=mimetype:text/html&collapse=digest'
  },
  {
    id: 'blog-months-root',
    url: 'https://web.archive.org/cdx?url=lizhizhuangbi.com/blog/%3Fm=*&from=2010&to=2013&output=json&fl=timestamp,original,statuscode,mimetype,digest&filter=statuscode:200&filter=mimetype:text/html&collapse=digest'
  },
  {
    id: 'blog-category-www',
    url: 'https://web.archive.org/cdx?url=www.lizhizhuangbi.com/blog/%3Fcat=*&from=2010&to=2013&output=json&fl=timestamp,original,statuscode,mimetype,digest&filter=statuscode:200&filter=mimetype:text/html&collapse=digest'
  },
  {
    id: 'blog-category-root',
    url: 'https://web.archive.org/cdx?url=lizhizhuangbi.com/blog/%3Fcat=*&from=2010&to=2013&output=json&fl=timestamp,original,statuscode,mimetype,digest&filter=statuscode:200&filter=mimetype:text/html&collapse=digest'
  },
  {
    id: 'blog-paged-www',
    url: 'https://web.archive.org/cdx?url=www.lizhizhuangbi.com/blog/%3Fpaged=*&from=2010&to=2013&output=json&fl=timestamp,original,statuscode,mimetype,digest&filter=statuscode:200&filter=mimetype:text/html&collapse=digest'
  },
  {
    id: 'blog-paged-root',
    url: 'https://web.archive.org/cdx?url=lizhizhuangbi.com/blog/%3Fpaged=*&from=2010&to=2013&output=json&fl=timestamp,original,statuscode,mimetype,digest&filter=statuscode:200&filter=mimetype:text/html&collapse=digest'
  }
];

const REQUEST_HEADERS = {
  'User-Agent': '1701701-archive-import/1.0 (+https://1701701.xyz)'
};
const ASSET_CONCURRENCY = 3;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithRetry = async (url, options = {}, tries = 5) => {
  let lastError;
  for (let attempt = 1; attempt <= tries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 75000);
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...REQUEST_HEADERS,
          ...options.headers
        },
        signal: controller.signal
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < tries) {
        await sleep(1200 * attempt);
      }
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
};

const fetchTextWithRetry = async (url, options = {}, tries = 5) => {
  const response = await fetchWithRetry(url, options, tries);
  return response.text();
};

const fetchCdxRows = async (query) => {
  try {
    const text = await fetchTextWithRetry(query.url, {}, 4);
    if (!text.trim().startsWith('[')) {
      throw new Error(`CDX returned non-JSON: ${text.slice(0, 80).replace(/\s+/g, ' ')}`);
    }
    const rows = JSON.parse(text);
    console.log(`cdx ${query.id}: ${Math.max(0, rows.length - 1)} rows`);
    await sleep(650);
    return rows;
  } catch (error) {
    console.warn(`cdx failed ${query.id}: ${error?.message || String(error)}`);
    return [['timestamp', 'original', 'statuscode', 'mimetype', 'digest']];
  }
};

const cdxRowsToRecords = (rows) => {
  const [headers, ...records] = Array.isArray(rows) ? rows : [[]];
  return records.map((row) => Object.fromEntries(
    headers.map((header, index) => [header, row[index] ?? ''])
  ));
};

const timestampToIso = (timestamp) => {
  const [year, month, day, hour, minute, second] = [
    timestamp.slice(0, 4),
    timestamp.slice(4, 6),
    timestamp.slice(6, 8),
    timestamp.slice(8, 10),
    timestamp.slice(10, 12),
    timestamp.slice(12, 14)
  ];
  return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
};

const timestampToDateLabel = (timestamp) => timestampToIso(timestamp).slice(0, 10);

const timestampToDateTimeLabel = (timestamp) => {
  const iso = timestampToIso(timestamp);
  return `${iso.slice(0, 10)} ${iso.slice(11, 19)} UTC`;
};

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const decodeHtmlEntities = (value) => String(value || '')
  .replaceAll('&raquo;', '»')
  .replaceAll('&laquo;', '«')
  .replaceAll('&amp;', '&')
  .replaceAll('&quot;', '"')
  .replaceAll('&#039;', "'")
  .replaceAll('&#8212;', '—')
  .replaceAll('&#8211;', '–')
  .replaceAll('&#8230;', '…')
  .replaceAll('&lt;', '<')
  .replaceAll('&gt;', '>');

const stripTags = (html) => String(html || '').replace(/<[^>]*>/g, ' ');

const replayUrl = (timestamp, original, mode = 'id_') => (
  `https://web.archive.org/web/${timestamp}${mode}/${original}`
);

const isBlogHost = (url) => (
  ['lizhizhuangbi.com', 'www.lizhizhuangbi.com'].includes(url.hostname)
);

const isOfficialBlogPage = (html) => {
  const content = String(html || '');
  const normalized = content.toLowerCase();
  const hasOldTitle = content.includes('李志官方博客');
  const hasNewTitle = content.includes('李志的博客');
  return (hasOldTitle || hasNewTitle)
    && normalized.includes('wp-content')
    && (
      normalized.includes('wordpress')
      || normalized.includes('storycontent')
      || normalized.includes('entry-content')
      || normalized.includes('twentytwelve')
    );
};

const isAssetUrl = (value, base) => {
  const raw = String(value || '').trim();
  if (!raw || raw.startsWith('#')) return false;
  if (/^(?:mailto|tel|javascript):/i.test(raw)) return false;
  if (raw.startsWith('data:')) return false;

  let parsed;
  try {
    parsed = new URL(raw, base);
  } catch {
    return false;
  }

  if (!isBlogHost(parsed)) return false;
  return /(?:^|\/)favicon\.ico$/i.test(parsed.pathname)
    || /\.(?:png|jpe?g|gif|webp|ico|svg|css|js)$/i.test(parsed.pathname);
};

const normalizeAssetLocalPath = (rawUrl, base) => {
  const parsed = new URL(String(rawUrl || '').trim(), base);
  const pathname = parsed.pathname
    .replace(/^\/+/, '')
    .replaceAll('\\', '/');
  const parts = pathname
    .split('/')
    .filter(Boolean)
    .map((part) => part.replace(/[^a-zA-Z0-9._-]/g, '_'));
  return path.posix.join('assets', ...parts);
};

const addAssetReference = (references, raw, snapshot) => {
  const trimmed = String(raw || '').trim();
  if (!isAssetUrl(trimmed, snapshot.original) || references.has(trimmed)) return;
  const resolvedOriginal = new URL(trimmed, snapshot.original).toString();
  references.set(trimmed, {
    raw: trimmed,
    resolvedOriginal,
    localPath: normalizeAssetLocalPath(trimmed, snapshot.original),
    replayUrl: replayUrl(snapshot.timestamp, resolvedOriginal, 'id_')
  });
};

const extractAssetReferences = (html, snapshot) => {
  const references = new Map();

  const attrPattern = /\b(src|href|background)=(["'])([^"']+)\2/gi;
  let attrMatch = attrPattern.exec(html);
  while (attrMatch) {
    addAssetReference(references, attrMatch[3], snapshot);
    attrMatch = attrPattern.exec(html);
  }

  const cssUrlPattern = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
  let cssMatch = cssUrlPattern.exec(html);
  while (cssMatch) {
    addAssetReference(references, cssMatch[2], snapshot);
    cssMatch = cssUrlPattern.exec(html);
  }

  return [...references.values()];
};

const pageDir = (id) => path.join(PAGES_DIR, id);

const downloadAsset = async (snapshot, asset) => {
  const outputPath = path.join(pageDir(snapshot.id), asset.localPath);
  const response = await fetchWithRetry(asset.replayUrl, { timeoutMs: 45000 }, 2);
  const buffer = Buffer.from(await response.arrayBuffer());
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, buffer);
  return {
    ...asset,
    saved: true,
    byteLength: buffer.byteLength,
    contentType: response.headers.get('content-type') || ''
  };
};

const downloadSnapshotAssets = async (snapshot, html) => {
  const assets = extractAssetReferences(html, snapshot);
  const results = new Array(assets.length);
  let cursor = 0;

  const worker = async () => {
    while (cursor < assets.length) {
      const index = cursor;
      cursor += 1;
      const asset = assets[index];
      try {
        results[index] = await downloadAsset(snapshot, asset);
      } catch (error) {
        results[index] = {
          ...asset,
          saved: false,
          error: error?.message || String(error)
        };
        console.warn(`asset failed ${snapshot.id} ${asset.raw}: ${results[index].error}`);
      }
      await sleep(80);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(ASSET_CONCURRENCY, assets.length) }, () => worker())
  );

  return results;
};

const injectArchiveHead = (html, snapshot) => {
  const archiveComment = [
    '<!--',
    `Archived from: ${snapshot.original}`,
    `Captured at: ${timestampToDateTimeLabel(snapshot.timestamp)}`,
    `Archive source: ${replayUrl(snapshot.timestamp, snapshot.original, '')}`,
    `Downloaded at: ${GENERATED_AT}`,
    '-->'
  ].join('\n');
  const injectedHead = [
    archiveComment,
    '<base target="_blank">',
    '<meta name="robots" content="noindex">',
    '<meta http-equiv="Content-Security-Policy" content="script-src \'none\'; object-src \'none\'; base-uri \'self\'; img-src \'self\' data: https://web.archive.org https://web-static.archive.org;">'
  ].join('\n');

  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>\n${injectedHead}`);
  }

  return `${injectedHead}\n${html}`;
};

const rewriteHtmlForLocalAssets = (html, snapshot, assets) => {
  const assetMap = new Map(assets.map((asset) => [asset.raw, asset]));
  let rewritten = html.replace(/\b(src|href|background)=(["'])([^"']+)\2/gi, (full, attr, quote, value) => {
    const asset = assetMap.get(value.trim());
    if (!asset) return full;
    const nextValue = asset.saved ? asset.localPath : asset.replayUrl;
    return `${attr}=${quote}${nextValue}${quote}`;
  });

  rewritten = rewritten.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (full, quote, value) => {
    const asset = assetMap.get(value.trim());
    if (!asset) return full;
    const nextValue = asset.saved ? asset.localPath : asset.replayUrl;
    return `url(${quote}${nextValue}${quote})`;
  });

  return injectArchiveHead(rewritten, snapshot);
};

const safeSlug = (value) => String(value || '')
  .toLowerCase()
  .replace(/^https?:\/\//, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 80);

const pageTypeFromOriginal = (original) => {
  const parsed = new URL(original);
  if (parsed.searchParams.has('p')) return 'post';
  if (parsed.searchParams.has('m')) return 'month';
  if (parsed.searchParams.has('cat')) return 'category';
  if (parsed.searchParams.has('paged')) return 'page';
  return 'home';
};

const pageTypeLabel = (pageType) => ({
  home: '首页',
  post: '文章',
  month: '月份',
  category: '分类',
  page: '分页'
}[pageType] || '页面');

const extractTitle = (html) => {
  const title = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '';
  return decodeHtmlEntities(stripTags(title).replace(/\s+/g, ' ').trim());
};

const estimateFrameHeight = (html, pageType) => {
  const textLength = stripTags(html).replace(/\s+/g, '').length;
  const minimum = pageType === 'post' ? 1100 : 1800;
  const estimated = Math.ceil(textLength / 7) + 900;
  return Math.max(minimum, Math.min(16000, estimated));
};

const makeSnapshotRecord = (record, index) => {
  const pageType = pageTypeFromOriginal(record.original);
  const id = `${record.timestamp}-${safeSlug(record.original) || `page-${index + 1}`}`;
  return {
    id,
    index: index + 1,
    timestamp: record.timestamp,
    capturedAt: timestampToIso(record.timestamp),
    label: timestampToDateLabel(record.timestamp),
    original: record.original,
    pageType,
    pageTypeLabel: pageTypeLabel(pageType),
    digest: record.digest,
    statuscode: record.statuscode,
    mimetype: record.mimetype,
    localPath: `./pages/${id}/index.html`,
    sourcePath: `./pages/${id}/source.html`,
    sitePath: `/archives/${ARCHIVE_SLUG}/pages/${id}/index.html`,
    sourceSitePath: `/archives/${ARCHIVE_SLUG}/pages/${id}/source.html`,
    waybackUrl: replayUrl(record.timestamp, record.original, ''),
    replayUrl: replayUrl(record.timestamp, record.original, 'id_'),
    frameWidth: 1280,
    frameHeight: pageType === 'post' ? 1400 : 2600
  };
};

const mergeRecords = (records) => {
  const byKey = new Map();
  for (const record of records) {
    const key = `${record.timestamp}:${record.original}:${record.digest}`;
    if (!byKey.has(key)) byKey.set(key, record);
  }
  return [...byKey.values()]
    .sort((a, b) => (
      a.timestamp.localeCompare(b.timestamp)
      || a.original.localeCompare(b.original)
    ));
};

const repairFailedAssetsFromLocalCopies = async (snapshots) => {
  const reports = new Map();
  const availableAssets = new Map();

  for (const snapshot of snapshots) {
    const reportPath = path.join(pageDir(snapshot.id), 'assets.json');
    const assets = JSON.parse(await readFile(reportPath, 'utf8'));
    reports.set(snapshot.id, assets);

    for (const asset of assets) {
      if (asset.saved && !availableAssets.has(asset.localPath)) {
        availableAssets.set(asset.localPath, {
          ...asset,
          id: snapshot.id,
          filePath: path.join(pageDir(snapshot.id), asset.localPath)
        });
      }
    }
  }

  const repairedCounts = new Map();

  for (const snapshot of snapshots) {
    const assets = reports.get(snapshot.id) || [];
    const repairedAssets = [];

    for (const asset of assets) {
      if (asset.saved) continue;
      const fallback = availableAssets.get(asset.localPath);
      if (!fallback) continue;

      const outputPath = path.join(pageDir(snapshot.id), asset.localPath);
      await mkdir(path.dirname(outputPath), { recursive: true });
      await copyFile(fallback.filePath, outputPath);
      asset.saved = true;
      asset.repairedFrom = fallback.id;
      asset.byteLength = fallback.byteLength;
      asset.contentType = fallback.contentType || '';
      delete asset.error;
      repairedAssets.push(asset);
    }

    if (repairedAssets.length > 0) {
      const indexPath = path.join(pageDir(snapshot.id), 'index.html');
      let html = await readFile(indexPath, 'utf8');
      for (const asset of repairedAssets) {
        html = html.replaceAll(asset.replayUrl, asset.localPath);
      }
      await writeFile(indexPath, html);
      await writeFile(
        path.join(pageDir(snapshot.id), 'assets.json'),
        `${JSON.stringify(assets, null, 2)}\n`
      );
      console.log(`repaired ${snapshot.id} (${repairedAssets.length} assets copied from local archive)`);
    }

    repairedCounts.set(snapshot.id, {
      savedAssetCount: assets.filter((asset) => asset.saved).length,
      failedAssetCount: assets.filter((asset) => !asset.saved).length
    });
  }

  return repairedCounts;
};

const buildSnapshotIndex = (snapshots) => `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>李志官方博客 旧版存档</title>
  <style>
    :root {
      color-scheme: light;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #1f2937;
      background: #f4f1ec;
    }
    body { margin: 0; }
    main {
      max-width: 1080px;
      margin: 0 auto;
      padding: 32px 18px 48px;
    }
    h1 {
      margin: 0 0 8px;
      font-size: clamp(28px, 5vw, 44px);
      line-height: 1.05;
      letter-spacing: 0;
    }
    .lead {
      max-width: 760px;
      margin: 0 0 24px;
      color: #5f5a53;
      line-height: 1.7;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin: 0 0 22px;
    }
    .toolbar a,
    .snapshot a {
      color: #6f3f1f;
      text-decoration: none;
    }
    .toolbar a {
      display: inline-flex;
      min-height: 38px;
      align-items: center;
      border: 1px solid #d4c6b5;
      border-radius: 8px;
      padding: 0 12px;
      background: #fffaf4;
      font-weight: 600;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 12px;
    }
    .snapshot {
      border: 1px solid #d8cabb;
      border-radius: 8px;
      background: #fffaf4;
      padding: 14px;
    }
    .snapshot h2 {
      margin: 0 0 8px;
      font-size: 17px;
      line-height: 1.35;
      letter-spacing: 0;
    }
    .snapshot p {
      margin: 4px 0;
      color: #625b52;
      font-size: 13px;
      line-height: 1.5;
      overflow-wrap: anywhere;
    }
    .snapshot .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 12px;
      font-size: 14px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <main>
    <h1>李志官方博客 旧版存档</h1>
    <p class="lead">这里保存的是 公开网页存档 上 ${escapeHtml(TARGET)} 的旧 WordPress 页面。后期停放页、错误页和无关内容已过滤。</p>
    <div class="toolbar">
      <a href="./manifest.json">manifest.json</a>
      <a href="./cdx-queries.json">CDX 查询结果</a>
      <a href="https://web.archive.org/web/*/${escapeHtml(TARGET)}" target="_blank" rel="noreferrer">原始时间线</a>
    </div>
    <section class="grid" aria-label="存档页面">
      ${snapshots.map((snapshot) => `
      <article class="snapshot">
        <h2><a href="${escapeHtml(snapshot.localPath)}">${escapeHtml(snapshot.optionLabel || snapshot.title || snapshot.label)}</a></h2>
        <p>${escapeHtml(timestampToDateTimeLabel(snapshot.timestamp))}</p>
        <p>${escapeHtml(snapshot.pageTypeLabel)} · ${escapeHtml(snapshot.original)}</p>
        <div class="actions">
          <a href="${escapeHtml(snapshot.localPath)}">本地版</a>
          <a href="${escapeHtml(snapshot.sourcePath)}">原始 HTML</a>
          <a href="${escapeHtml(snapshot.waybackUrl)}" target="_blank" rel="noreferrer">原始快照</a>
        </div>
      </article>`).join('')}
    </section>
  </main>
</body>
</html>
`;

const main = async () => {
  await mkdir(PAGES_DIR, { recursive: true });

  const cdxResults = [];
  const records = [];
  for (const query of CDX_QUERIES) {
    const rows = await fetchCdxRows(query);
    cdxResults.push({ id: query.id, url: query.url, rows });
    records.push(...cdxRowsToRecords(rows));
  }

  const mergedRecords = mergeRecords(records);
  const snapshots = mergedRecords.map(makeSnapshotRecord);
  const savedSnapshots = [];

  await writeFile(
    path.join(OUTPUT_DIR, 'cdx-queries.json'),
    `${JSON.stringify(cdxResults, null, 2)}\n`
  );

  for (const snapshot of snapshots) {
    const dir = pageDir(snapshot.id);
    await mkdir(dir, { recursive: true });
    let sourceHtml;
    try {
      sourceHtml = await fetchTextWithRetry(snapshot.replayUrl, {}, 3);
    } catch (error) {
      console.warn(`page failed ${snapshot.id}: ${error?.message || String(error)}`);
      continue;
    }

    if (!isOfficialBlogPage(sourceHtml)) {
      console.log(`skipped ${snapshot.id} (not old official blog)`);
      continue;
    }

    const title = extractTitle(sourceHtml);
    const optionLabel = [
      timestampToDateLabel(snapshot.timestamp),
      snapshot.pageTypeLabel,
      title || snapshot.original
    ].filter(Boolean).join(' · ');
    const assets = await downloadSnapshotAssets(snapshot, sourceHtml);
    const renderableHtml = rewriteHtmlForLocalAssets(sourceHtml, snapshot, assets);
    await writeFile(path.join(dir, 'source.html'), sourceHtml);
    await writeFile(path.join(dir, 'index.html'), renderableHtml);
    await writeFile(path.join(dir, 'assets.json'), `${JSON.stringify(assets, null, 2)}\n`);

    snapshot.title = title;
    snapshot.optionLabel = optionLabel;
    snapshot.frameHeight = estimateFrameHeight(sourceHtml, snapshot.pageType);
    snapshot.assetCount = assets.length;
    snapshot.savedAssetCount = assets.filter((asset) => asset.saved).length;
    snapshot.failedAssetCount = assets.filter((asset) => !asset.saved).length;
    savedSnapshots.push(snapshot);
    console.log(`saved ${snapshot.id} ${snapshot.pageTypeLabel} (${snapshot.savedAssetCount}/${snapshot.assetCount} assets)`);
    await sleep(350);
  }

  const repairedCounts = await repairFailedAssetsFromLocalCopies(savedSnapshots);
  for (const snapshot of savedSnapshots) {
    const counts = repairedCounts.get(snapshot.id);
    if (!counts) continue;
    snapshot.savedAssetCount = counts.savedAssetCount;
    snapshot.failedAssetCount = counts.failedAssetCount;
  }

  const typeCounts = savedSnapshots.reduce((counts, snapshot) => {
    counts[snapshot.pageType] = (counts[snapshot.pageType] || 0) + 1;
    return counts;
  }, {});
  const manifest = {
    target: TARGET,
    unitLabel: '历史页面',
    displayMode: 'catalog',
    generatedAt: GENERATED_AT,
    source: {
      name: '公开网页存档 CDX API',
      queries: CDX_QUERIES,
      timelineUrl: `https://web.archive.org/web/*/${TARGET}`
    },
    notes: [
      'HTML pages are old WordPress blog pages discovered from archive CDX queries for /blog/, ?p=, ?m=, ?cat=, and ?paged= paths.',
      'Later parked, error, and unrelated captures are skipped by old-blog content markers.',
      'index.html rewrites same-site image, CSS, and JS assets to local files under each page assets directory where available.',
      'If an asset cannot be downloaded from its capture, the script tries to repair it from another saved blog page with the same local asset path.'
    ],
    typeCounts,
    snapshots: savedSnapshots
  };

  await writeFile(
    path.join(OUTPUT_DIR, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
  await writeFile(path.join(OUTPUT_DIR, 'index.html'), buildSnapshotIndex(savedSnapshots));
  await writeFile(
    path.join(OUTPUT_DIR, 'README.md'),
    [
      '# lizhizhuangbi.com/blog web archive',
      '',
      `Generated at: ${GENERATED_AT}`,
      '',
      'Files:',
      '',
      '- `manifest.json`: machine-readable saved page list for the React site.',
      '- `index.html`: static browser for saved blog pages.',
      '- `pages/<id>/source.html`: raw HTML from archive `id_` replay.',
      '- `pages/<id>/index.html`: renderable HTML with same-site asset links rewritten locally where available.',
      '- `pages/<id>/assets/`: locally saved same-site image/CSS/JS assets for that page.',
      '- `pages/<id>/assets.json`: per-page asset download report.',
      '- `cdx-queries.json`: CDX query rows used to discover blog pages.',
      '',
      'Source: 公开网页存档.',
      ''
    ].join('\n')
  );

  console.log(`wrote ${savedSnapshots.length} blog pages to ${OUTPUT_DIR}`);
  console.log(`type counts: ${JSON.stringify(typeCounts)}`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

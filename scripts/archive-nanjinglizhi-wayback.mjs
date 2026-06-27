import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const TARGET = 'nanjinglizhi.cn';
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'archives', 'nanjinglizhi');
const SNAPSHOTS_DIR = path.join(OUTPUT_DIR, 'snapshots');
const GENERATED_AT = new Date().toISOString();

const CDX_UNIQUE_HTML_URL = [
  'https://web.archive.org/cdx',
  '?url=*.nanjinglizhi.cn/*',
  '&output=json',
  '&fl=timestamp,original,statuscode,mimetype,digest',
  '&filter=statuscode:200',
  '&filter=mimetype:text/html',
  '&collapse=digest'
].join('');

const CDX_HOMEPAGE_CAPTURES_URL = [
  'https://web.archive.org/cdx',
  '?url=www.nanjinglizhi.cn/',
  '&output=json',
  '&fl=timestamp,original,statuscode,mimetype,digest',
  '&filter=statuscode:200',
  '&filter=mimetype:text/html'
].join('');

const REQUIRED_DUPLICATE_TIMESTAMPS = new Set([
  '20180421034504'
]);

const REQUEST_HEADERS = {
  'User-Agent': '1701701-archive-import/1.0 (+https://1701701.xyz)'
};
const ASSET_CONCURRENCY = 6;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithRetry = async (url, options = {}, tries = 3) => {
  let lastError;
  for (let attempt = 1; attempt <= tries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 60000);
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
        await sleep(1000 * attempt);
      }
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
};

const fetchJson = async (url) => {
  const response = await fetchWithRetry(url);
  return response.json();
};

const cdxRowsToRecords = (rows) => {
  const [headers, ...records] = rows;
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

const replayUrl = (timestamp, original, mode = 'id_') => (
  `https://web.archive.org/web/${timestamp}${mode}/${original}`
);

const isExpiredHostingRedirectPage = (html) => {
  const normalized = String(html || '').toLowerCase();
  return normalized.includes('wanwang.aliyun.com/hosting/expire')
    || (
      normalized.includes('window.location.href')
      && normalized.includes('/hosting/expire')
    );
};

const isRelativeAssetUrl = (value) => {
  const url = String(value || '').trim();
  if (!url || url.startsWith('#')) return false;
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(url)) return false;
  if (url.startsWith('data:')) return false;

  const pathname = url.split(/[?#]/, 1)[0];
  return /(?:^|\/)favicon\.ico$/i.test(pathname)
    || /\.(?:png|jpe?g|gif|webp|ico|svg|css|js)$/i.test(pathname);
};

const normalizeAssetLocalPath = (rawUrl) => {
  const pathname = String(rawUrl || '')
    .split(/[?#]/, 1)[0]
    .replace(/^\/+/, '')
    .replaceAll('\\', '/');
  const parts = pathname
    .split('/')
    .filter(Boolean)
    .map((part) => part.replace(/[^a-zA-Z0-9._-]/g, '_'));
  return path.posix.join('assets', ...parts);
};

const extractAssetReferences = (html, snapshot) => {
  const references = new Map();
  const pattern = /\b(src|href|background)=(["'])([^"']+)\2/gi;
  let match = pattern.exec(html);

  while (match) {
    const raw = match[3].trim();
    if (isRelativeAssetUrl(raw) && !references.has(raw)) {
      const resolvedOriginal = new URL(raw, snapshot.original).toString();
      references.set(raw, {
        raw,
        resolvedOriginal,
        localPath: normalizeAssetLocalPath(raw),
        replayUrl: replayUrl(snapshot.timestamp, resolvedOriginal, 'id_')
      });
    }
    match = pattern.exec(html);
  }

  return [...references.values()];
};

const downloadAsset = async (snapshot, asset) => {
  const outputPath = path.join(snapshotDir(snapshot.timestamp), asset.localPath);
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
        console.warn(`asset failed ${snapshot.timestamp} ${asset.raw}: ${results[index].error}`);
      }
      await sleep(40);
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
    `Wayback source: ${replayUrl(snapshot.timestamp, snapshot.original, '')}`,
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
  const rewritten = html.replace(/\b(src|href|background)=(["'])([^"']+)\2/gi, (full, attr, quote, value) => {
    const asset = assetMap.get(value.trim());
    if (!asset) return full;
    const nextValue = asset.saved ? asset.localPath : asset.replayUrl;
    return `${attr}=${quote}${nextValue}${quote}`;
  });

  return injectArchiveHead(rewritten, snapshot);
};

const snapshotDir = (timestamp) => path.join(SNAPSHOTS_DIR, timestamp);

const buildSnapshotIndex = (snapshots) => `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>李志官网 Wayback 存档</title>
  <style>
    :root {
      color-scheme: light;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #1f2937;
      background: #f4f1ec;
    }
    body {
      margin: 0;
    }
    main {
      max-width: 980px;
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
      grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
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
      font-size: 18px;
      line-height: 1.25;
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
    <h1>李志官网 Wayback 存档</h1>
    <p class="lead">这里保存的是 Internet Archive Wayback Machine 上 ${escapeHtml(TARGET)} 的 HTML 代表版本。每个版本按内容摘要去重，另保留了用户指定的 2018-04-21 快照。</p>
    <div class="toolbar">
      <a href="./manifest.json">manifest.json</a>
      <a href="./cdx-unique-html.json">CDX 去重列表</a>
      <a href="./cdx-homepage-captures.json">首页全部捕获</a>
      <a href="https://web.archive.org/web/*/${escapeHtml(TARGET)}" target="_blank" rel="noreferrer">Wayback 原始时间线</a>
    </div>
    <section class="grid" aria-label="存档快照">
      ${snapshots.map((snapshot) => `
      <article class="snapshot">
        <h2><a href="${escapeHtml(snapshot.localPath)}">${escapeHtml(snapshot.label)}</a></h2>
        <p>${escapeHtml(timestampToDateTimeLabel(snapshot.timestamp))}</p>
        <p>${escapeHtml(snapshot.original)}</p>
        <p>digest: ${escapeHtml(snapshot.digest)}</p>
        <div class="actions">
          <a href="${escapeHtml(snapshot.localPath)}">本地版</a>
          <a href="${escapeHtml(snapshot.sourcePath)}">原始 HTML</a>
          <a href="${escapeHtml(snapshot.waybackUrl)}" target="_blank" rel="noreferrer">Wayback</a>
        </div>
      </article>`).join('')}
    </section>
  </main>
</body>
</html>
`;

const makeSnapshotRecord = (record, index) => {
  const duplicateSuffix = REQUIRED_DUPLICATE_TIMESTAMPS.has(record.timestamp)
    ? ' - requested snapshot'
    : '';
  return {
    index: index + 1,
    timestamp: record.timestamp,
    capturedAt: timestampToIso(record.timestamp),
    label: `${timestampToDateLabel(record.timestamp)}${duplicateSuffix}`,
    original: record.original,
    digest: record.digest,
    statuscode: record.statuscode,
    mimetype: record.mimetype,
    localPath: `./snapshots/${record.timestamp}/index.html`,
    sourcePath: `./snapshots/${record.timestamp}/source.html`,
    sitePath: `/archives/nanjinglizhi/snapshots/${record.timestamp}/index.html`,
    sourceSitePath: `/archives/nanjinglizhi/snapshots/${record.timestamp}/source.html`,
    waybackUrl: replayUrl(record.timestamp, record.original, ''),
    replayUrl: replayUrl(record.timestamp, record.original, 'id_')
  };
};

const mergeRequiredDuplicates = (uniqueRecords, homepageRecords) => {
  const byTimestamp = new Map(uniqueRecords.map((record) => [record.timestamp, record]));
  const required = homepageRecords.filter((record) => (
    REQUIRED_DUPLICATE_TIMESTAMPS.has(record.timestamp)
    && !byTimestamp.has(record.timestamp)
  ));
  return [...uniqueRecords, ...required]
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
};

const main = async () => {
  await mkdir(SNAPSHOTS_DIR, { recursive: true });

  const [uniqueRows, homepageRows] = await Promise.all([
    fetchJson(CDX_UNIQUE_HTML_URL),
    fetchJson(CDX_HOMEPAGE_CAPTURES_URL)
  ]);
  const uniqueRecords = cdxRowsToRecords(uniqueRows);
  const homepageRecords = cdxRowsToRecords(homepageRows);
  const records = mergeRequiredDuplicates(uniqueRecords, homepageRecords);
  const snapshots = records.map(makeSnapshotRecord);
  const savedSnapshots = [];

  await writeFile(
    path.join(OUTPUT_DIR, 'cdx-unique-html.json'),
    `${JSON.stringify(uniqueRows, null, 2)}\n`
  );
  await writeFile(
    path.join(OUTPUT_DIR, 'cdx-homepage-captures.json'),
    `${JSON.stringify(homepageRows, null, 2)}\n`
  );

  for (const snapshot of snapshots) {
    const dir = snapshotDir(snapshot.timestamp);
    await mkdir(dir, { recursive: true });
    const response = await fetchWithRetry(snapshot.replayUrl);
    const sourceHtml = await response.text();
    if (isExpiredHostingRedirectPage(sourceHtml)) {
      console.log(`skipped ${snapshot.timestamp} ${snapshot.original} (expired hosting redirect)`);
      continue;
    }
    const assets = await downloadSnapshotAssets(snapshot, sourceHtml);
    const renderableHtml = rewriteHtmlForLocalAssets(sourceHtml, snapshot, assets);
    await writeFile(path.join(dir, 'source.html'), sourceHtml);
    await writeFile(path.join(dir, 'index.html'), renderableHtml);
    await writeFile(path.join(dir, 'assets.json'), `${JSON.stringify(assets, null, 2)}\n`);
    snapshot.assetCount = assets.length;
    snapshot.savedAssetCount = assets.filter((asset) => asset.saved).length;
    snapshot.failedAssetCount = assets.filter((asset) => !asset.saved).length;
    savedSnapshots.push(snapshot);
    console.log(`saved ${snapshot.timestamp} ${snapshot.original} (${snapshot.savedAssetCount}/${snapshot.assetCount} assets)`);
    await sleep(300);
  }

  const manifest = {
    target: TARGET,
    generatedAt: GENERATED_AT,
    source: {
      name: 'Internet Archive Wayback Machine CDX API',
      uniqueHtmlUrl: CDX_UNIQUE_HTML_URL,
      homepageCapturesUrl: CDX_HOMEPAGE_CAPTURES_URL,
      timelineUrl: `https://web.archive.org/web/*/${TARGET}`
    },
    notes: [
      'HTML snapshots are representative versions collapsed by Wayback digest.',
      'The 2018-04-21 capture is included separately because it was the URL requested by the user, although its digest matches the 2017-11-09 version.',
      'index.html rewrites relative page assets to local files under each snapshot assets directory; source.html keeps the raw fetched HTML.',
      'If an asset cannot be downloaded, index.html keeps a Wayback replay URL for that asset.',
      'Expired hosting redirect captures are skipped because they are not meaningful old-site content.'
    ],
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
      '# nanjinglizhi.cn Wayback archive',
      '',
      `Generated at: ${GENERATED_AT}`,
      '',
      'Files:',
      '',
      '- `manifest.json`: machine-readable snapshot list for the React site.',
      '- `index.html`: static browser for the saved snapshots.',
      '- `snapshots/<timestamp>/source.html`: raw HTML from Wayback `id_` replay.',
      '- `snapshots/<timestamp>/index.html`: renderable HTML with local asset links where available.',
      '- `snapshots/<timestamp>/assets/`: locally saved relative image/icon assets for that snapshot.',
      '- `snapshots/<timestamp>/assets.json`: per-snapshot asset download report.',
      '- `cdx-unique-html.json`: unique HTML captures returned by the CDX API.',
      '- `cdx-homepage-captures.json`: all 200 OK homepage captures returned by the CDX API.',
      '',
      'Source: Internet Archive Wayback Machine.',
      ''
    ].join('\n')
  );

  console.log(`wrote ${savedSnapshots.length} snapshots to ${OUTPUT_DIR}`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

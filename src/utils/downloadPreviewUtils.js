import { getDownloadPreviewPath } from './appShellConfig.js';

export const PDF_PREVIEW_VIEWER_BASE = 'https://mozilla.github.io/pdf.js/web/viewer.html';
const PDF_PREVIEW_VIEWER = `${PDF_PREVIEW_VIEWER_BASE}?file=`;
const OBJECT_URL_REVOKE_DELAY_MS = 30000;

export const getPreviewIdentifier = (item) => {
  const filename = String(item?.filename || '').trim().replace(/\.pdf$/i, '');
  if (filename) return filename;
  return String(item?.title || '').trim();
};

const isPdfResource = (item) => {
  const filename = String(item?.filename || '').toLowerCase();
  const title = String(item?.title || '').toLowerCase();
  const rawUrl = String(item?.url || '').toLowerCase();
  const urlWithoutQuery = rawUrl.split('?')[0];
  return (
    filename.endsWith('.pdf')
    || title.endsWith('.pdf')
    || urlWithoutQuery.endsWith('.pdf')
  );
};

export const resolvePreviewSource = (item, forcePreview = false) => {
  if (item?.previewUrl) return item.previewUrl;
  if (item?.sourceUrl) return '';
  if (!forcePreview || !item?.url) return '';
  if (isPdfResource(item)) {
    return `${PDF_PREVIEW_VIEWER}${encodeURIComponent(item.url)}`;
  }
  return item.url;
};

export const resolvePreviewHref = (item, forcePreview = false, getPreviewPath = getDownloadPreviewPath) => {
  const previewSource = resolvePreviewSource(item, forcePreview);
  if (!previewSource) return '';
  const previewIdentifier = getPreviewIdentifier(item);
  if (!previewIdentifier) return previewSource;
  return typeof getPreviewPath === 'function'
    ? getPreviewPath(previewIdentifier)
    : getDownloadPreviewPath(previewIdentifier);
};

export const findPreviewItemBySlug = (sections, previewSlug) => {
  if (!previewSlug) return null;
  for (const section of sections) {
    for (const group of section.groups) {
      for (const item of group.items) {
        if (getPreviewIdentifier(item) !== previewSlug) continue;
        const previewSrc = resolvePreviewSource(item, true);
        if (!previewSrc) continue;
        return {
          item,
          previewSrc
        };
      }
    }
  }
  return null;
};

const triggerDownload = (url, filename) => {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener noreferrer';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
};

export const fetchAndTriggerDownload = async (url, filename) => {
  const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
  if (!response.ok) {
    throw new Error(`download request failed with ${response.status}`);
  }
  const blob = await response.blob();
  if (!blob.size) {
    throw new Error('downloaded blob is empty');
  }
  const objectUrl = window.URL.createObjectURL(blob);
  triggerDownload(objectUrl, filename);
  window.setTimeout(() => {
    window.URL.revokeObjectURL(objectUrl);
  }, OBJECT_URL_REVOKE_DELAY_MS);
};

export const triggerDownloadWithFallback = (url, filename) => {
  triggerDownload(url, filename);
};

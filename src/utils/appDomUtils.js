export const upsertMetaTag = ({ name, property }, content) => {
  if (typeof document === 'undefined' || !content) return;
  const selector = name
    ? `meta[name="${name}"]`
    : `meta[property="${property}"]`;
  let tag = document.head.querySelector(selector);
  if (!tag) {
    tag = document.createElement('meta');
    if (name) tag.setAttribute('name', name);
    if (property) tag.setAttribute('property', property);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
};

export const upsertLinkTag = (rel, href) => {
  if (typeof document === 'undefined' || !rel || !href) return;
  let tag = document.head.querySelector(`link[rel="${rel}"]`);
  if (!tag) {
    tag = document.createElement('link');
    tag.setAttribute('rel', rel);
    document.head.appendChild(tag);
  }
  tag.setAttribute('href', href);
};

export const upsertJsonLd = (id, payload) => {
  if (typeof document === 'undefined' || !id || !payload) return;
  let script = document.getElementById(id);
  if (!script) {
    script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = id;
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(payload);
};

export const copyTextToClipboard = async (text) => {
  if (!text) return false;
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fallback below
    }
  }
  if (typeof document === 'undefined') return false;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  document.body.appendChild(textarea);
  textarea.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  document.body.removeChild(textarea);
  return copied;
};

export const dataUrlToFile = (dataUrl, filename) => {
  const [meta, content] = dataUrl.split(',');
  const mime = meta.match(/data:(.*?);base64/)?.[1] || 'image/png';
  const binary = atob(content || '');
  const length = binary.length;
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], filename, { type: mime });
};

export const downloadDataUrl = (dataUrl, filename) => {
  if (!dataUrl || typeof document === 'undefined') return;
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const saveImageToAlbum = async (imageUrl, filename) => {
  if (!imageUrl || typeof window === 'undefined' || typeof document === 'undefined') {
    return 'failed';
  }

  try {
    const response = await fetch(imageUrl, { mode: 'cors' });
    if (!response.ok) throw new Error('image request failed');

    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 0);
    return 'downloaded';
  } catch {
    const previewWindow = window.open(imageUrl, '_blank');
    return previewWindow ? 'previewed' : 'failed';
  }
};

export const isIOSDevice = () => {
  if (typeof navigator === 'undefined') return false;
  return /iP(hone|ad|od)/i.test(navigator.userAgent || '');
};

export const isWeChatBrowser = () => {
  if (typeof navigator === 'undefined') return false;
  return /MicroMessenger/i.test(navigator.userAgent || '');
};

export const openImagePreviewWindow = (dataUrl) => {
  if (!dataUrl || typeof window === 'undefined') return false;
  const previewWindow = window.open('', '_blank');
  if (!previewWindow || !previewWindow.document) return false;
  const doc = previewWindow.document;
  doc.title = '分享卡片';
  const html = doc.documentElement;
  html.style.height = '100%';
  doc.body.style.margin = '0';
  doc.body.style.background = '#05070b';
  doc.body.style.minHeight = '100%';
  doc.body.style.display = 'flex';
  doc.body.style.flexDirection = 'column';
  doc.body.style.alignItems = 'center';
  doc.body.style.justifyContent = 'flex-start';
  doc.body.style.gap = '16px';
  doc.body.style.padding = '16px 10px 24px';
  doc.body.style.boxSizing = 'border-box';

  const img = doc.createElement('img');
  img.src = dataUrl;
  img.alt = '分享卡片';
  img.style.width = '100%';
  img.style.maxWidth = '700px';
  img.style.maxHeight = 'calc(100vh - 140px)';
  img.style.height = 'auto';
  img.style.borderRadius = '14px';
  img.style.boxShadow = '0 14px 42px rgba(0, 0, 0, 0.45)';
  img.style.objectFit = 'contain';
  doc.body.appendChild(img);

  const tip = doc.createElement('div');
  tip.textContent = '长按图片 -> 存储到“照片”';
  tip.style.color = '#ffffff';
  tip.style.background = 'rgba(255, 255, 255, 0.14)';
  tip.style.border = '1px solid rgba(255, 255, 255, 0.24)';
  tip.style.borderRadius = '12px';
  tip.style.padding = '10px 14px';
  tip.style.font = '700 19px -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
  tip.style.lineHeight = '1.3';
  tip.style.backdropFilter = 'blur(8px)';
  tip.style.webkitBackdropFilter = 'blur(8px)';
  tip.style.textAlign = 'center';
  tip.style.position = 'sticky';
  tip.style.bottom = '10px';
  doc.body.appendChild(tip);
  return true;
};

import { buildAdminApiUrl } from './adminApiConfig.js';

const readErrorMessage = async (response, fallback) => {
  try {
    const payload = await response.json();
    return payload?.error || payload?.message || fallback;
  } catch {
    return fallback;
  }
};

export const isGalleryAdminApiConfigured = () => Boolean(
  buildAdminApiUrl('/api/admin/gallery')
);

export const publishGalleryImages = async ({
  files,
  category,
  name,
  message,
  token,
  signal
} = {}) => {
  const endpoint = buildAdminApiUrl('/api/admin/gallery');
  if (!endpoint) {
    throw new Error('图库后台接口未配置');
  }

  const normalizedToken = String(token || '').trim();
  if (!normalizedToken) {
    throw new Error('请输入管理员口令');
  }

  const selectedFiles = Array.from(files || []).filter(Boolean);
  if (selectedFiles.length === 0) {
    throw new Error('请选择要发布的图片');
  }

  const formData = new FormData();
  formData.set('category', String(category || '').trim() || '未分类');
  if (String(name || '').trim()) {
    formData.set('name', String(name).trim());
  }
  if (String(message || '').trim()) {
    formData.set('message', String(message).trim());
  }
  for (const file of selectedFiles) {
    formData.append('images', file);
    formData.append('imageNames', file.name || '');
  }

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      cache: 'no-store',
      signal,
      headers: {
        Authorization: `Bearer ${normalizedToken}`
      },
      body: formData
    });
  } catch (error) {
    const reason = error?.message ? `：${error.message}` : '';
    throw new Error(`无法连接图库后台${reason}。请确认当前网址已加入后台允许列表，或稍后重试。`);
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `图库发布失败（HTTP ${response.status}）`));
  }

  return await response.json();
};

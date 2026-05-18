import { buildAdminApiUrl } from './adminApiConfig.js';

const readErrorMessage = async (response, fallback) => {
  try {
    const payload = await response.json();
    return payload?.error || payload?.message || fallback;
  } catch {
    return fallback;
  }
};

export const isDownloadAdminApiConfigured = () => Boolean(
  buildAdminApiUrl('/api/admin/download')
);

export const publishDownloadLinks = async ({
  sectionTitle,
  sectionSortOrder,
  groupTitle,
  groupSortOrder,
  startSortOrder,
  itemTitles,
  itemUrls,
  filenames,
  previewUrls,
  token,
  signal
} = {}) => {
  const endpoint = buildAdminApiUrl('/api/admin/download');
  if (!endpoint) {
    throw new Error('下载后台接口未配置');
  }

  const normalizedToken = String(token || '').trim();
  if (!normalizedToken) {
    throw new Error('请输入管理员口令');
  }

  const normalizedItemUrls = String(itemUrls || '').trim();
  if (!normalizedItemUrls) {
    throw new Error('请填写下载链接');
  }

  const formData = new FormData();
  formData.set('sectionTitle', String(sectionTitle || '').trim());
  formData.set('groupTitle', String(groupTitle || '').trim());
  formData.set('itemTitles', String(itemTitles || '').trim());
  formData.set('itemUrls', normalizedItemUrls);
  formData.set('filenames', String(filenames || '').trim());
  formData.set('previewUrls', String(previewUrls || '').trim());

  if (String(sectionSortOrder || '').trim()) {
    formData.set('sectionSortOrder', String(sectionSortOrder).trim());
  }
  if (String(groupSortOrder || '').trim()) {
    formData.set('groupSortOrder', String(groupSortOrder).trim());
  }
  if (String(startSortOrder || '').trim()) {
    formData.set('startSortOrder', String(startSortOrder).trim());
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
    throw new Error(`无法连接下载后台${reason}。请确认当前网址已加入后台允许列表，或稍后重试。`);
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `下载发布失败（HTTP ${response.status}）`));
  }

  return await response.json();
};

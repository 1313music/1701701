import { buildAdminApiUrl } from './adminApiConfig.js';

const readErrorMessage = async (response, fallback) => {
  try {
    const payload = await response.json();
    return payload?.error || payload?.message || fallback;
  } catch {
    return fallback;
  }
};

export const isVideoAdminApiConfigured = () => Boolean(
  buildAdminApiUrl('/api/admin/video')
);

export const publishVideoLinks = async ({
  categoryId,
  categoryName,
  categoryIcon,
  categorySortOrder,
  folderId,
  folderTitle,
  folderThumb,
  folderSortOrder,
  startSortOrder,
  videoIds,
  videoTitles,
  videoUrls,
  backupUrls,
  thumbUrls,
  token,
  signal
} = {}) => {
  const endpoint = buildAdminApiUrl('/api/admin/video');
  if (!endpoint) {
    throw new Error('视频后台接口未配置');
  }

  const normalizedToken = String(token || '').trim();
  if (!normalizedToken) {
    throw new Error('请输入管理员口令');
  }

  const normalizedVideoUrls = String(videoUrls || '').trim();
  if (!normalizedVideoUrls) {
    throw new Error('请填写视频链接');
  }

  const formData = new FormData();
  formData.set('categoryId', String(categoryId || '').trim());
  formData.set('categoryName', String(categoryName || '').trim());
  formData.set('categoryIcon', String(categoryIcon || '').trim());
  formData.set('folderId', String(folderId || '').trim());
  formData.set('folderTitle', String(folderTitle || '').trim());
  formData.set('folderThumb', String(folderThumb || '').trim());
  formData.set('videoIds', String(videoIds || '').trim());
  formData.set('videoTitles', String(videoTitles || '').trim());
  formData.set('videoUrls', normalizedVideoUrls);
  formData.set('backupUrls', String(backupUrls || '').trim());
  formData.set('thumbUrls', String(thumbUrls || '').trim());

  if (String(categorySortOrder || '').trim()) {
    formData.set('categorySortOrder', String(categorySortOrder).trim());
  }
  if (String(folderSortOrder || '').trim()) {
    formData.set('folderSortOrder', String(folderSortOrder).trim());
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
    throw new Error(`无法连接视频后台${reason}。请确认当前网址已加入后台允许列表，或稍后重试。`);
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `视频发布失败（HTTP ${response.status}）`));
  }

  return await response.json();
};

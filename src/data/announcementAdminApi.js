import { buildAnnouncementApiUrl } from './announcementApiConfig.js';

const readErrorMessage = async (response, fallback) => {
  try {
    const payload = await response.json();
    return payload?.error || payload?.message || fallback;
  } catch {
    return fallback;
  }
};

export const isAnnouncementAdminApiConfigured = () => Boolean(
  buildAnnouncementApiUrl('/api/admin/announcement')
);

export const publishAnnouncement = async ({ announcement, token, signal } = {}) => {
  const endpoint = buildAnnouncementApiUrl('/api/admin/announcement');
  if (!endpoint) {
    throw new Error('公告后台接口未配置');
  }

  const normalizedToken = String(token || '').trim();
  if (!normalizedToken) {
    throw new Error('请输入管理员口令');
  }

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'PUT',
      cache: 'no-store',
      signal,
      headers: {
        Authorization: `Bearer ${normalizedToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ announcement })
    });
  } catch (error) {
    const reason = error?.message ? `：${error.message}` : '';
    throw new Error(`无法连接公告后台${reason}。请确认当前网址已加入后台允许列表，或稍后重试。`);
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `公告保存失败（HTTP ${response.status}）`));
  }

  const payload = await response.json();
  return payload?.announcement || payload;
};

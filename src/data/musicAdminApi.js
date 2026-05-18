import { buildAdminApiUrl } from './adminApiConfig.js';

const readErrorMessage = async (response, fallback) => {
  try {
    const payload = await response.json();
    return payload?.error || payload?.message || fallback;
  } catch {
    return fallback;
  }
};

export const isMusicAdminApiConfigured = () => Boolean(
  buildAdminApiUrl('/api/admin/music')
);

export const publishMusicAlbum = async ({
  albumId,
  albumName,
  artist,
  coverUrl,
  year,
  type,
  sortOrder,
  startTrackNumber,
  songNames,
  audioUrls,
  lyricUrls,
  songCoverUrls,
  audioFiles,
  lyricFiles,
  coverFile,
  songCoverFiles,
  token,
  signal
} = {}) => {
  const endpoint = buildAdminApiUrl('/api/admin/music');
  if (!endpoint) {
    throw new Error('音乐后台接口未配置');
  }

  const normalizedToken = String(token || '').trim();
  if (!normalizedToken) {
    throw new Error('请输入管理员口令');
  }

  const selectedAudioFiles = Array.from(audioFiles || []).filter(Boolean);
  const normalizedAudioUrls = String(audioUrls || '').trim();
  if (selectedAudioFiles.length === 0 && !normalizedAudioUrls) {
    throw new Error('请选择要发布的音频文件或填写音频链接');
  }

  const formData = new FormData();
  formData.set('albumId', String(albumId || '').trim());
  formData.set('albumName', String(albumName || '').trim());
  formData.set('artist', String(artist || '').trim());
  formData.set('coverUrl', String(coverUrl || '').trim());
  formData.set('type', String(type || '').trim());
  formData.set('songNames', String(songNames || '').trim());
  formData.set('audioUrls', normalizedAudioUrls);
  formData.set('lyricUrls', String(lyricUrls || '').trim());
  formData.set('songCoverUrls', String(songCoverUrls || ''));

  if (String(year || '').trim()) {
    formData.set('year', String(year).trim());
  }
  if (String(sortOrder || '').trim()) {
    formData.set('sortOrder', String(sortOrder).trim());
  }
  if (String(startTrackNumber || '').trim()) {
    formData.set('startTrackNumber', String(startTrackNumber).trim());
  }
  if (coverFile) {
    formData.set('coverImage', coverFile);
  }

  for (const file of selectedAudioFiles) {
    formData.append('audios', file);
    formData.append('audioNames', file.name || '');
  }
  for (const file of Array.from(lyricFiles || []).filter(Boolean)) {
    formData.append('lyrics', file);
    formData.append('lyricNames', file.name || '');
  }
  for (const file of Array.from(songCoverFiles || []).filter(Boolean)) {
    formData.append('songCovers', file);
    formData.append('songCoverNames', file.name || '');
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
    throw new Error(`无法连接音乐后台${reason}。请确认当前网址已加入后台允许列表，或稍后重试。`);
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `音乐发布失败（HTTP ${response.status}）`));
  }

  return await response.json();
};

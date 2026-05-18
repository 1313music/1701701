import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import AdminPage from './AdminPage.jsx';

vi.mock('../data/announcementAdminApi.js', () => ({
  isAnnouncementAdminApiConfigured: () => true,
  publishAnnouncement: vi.fn(async ({ announcement }) => ({
    ...announcement,
    updatedAt: '2026-05-18T00:00:00.000Z'
  }))
}));

vi.mock('../data/galleryAdminApi.js', () => ({
  isGalleryAdminApiConfigured: () => true,
  publishGalleryImages: vi.fn(async () => ({
    items: [{ id: 'images/XKK/example.jpg' }],
    commit: {
      sha: 'abc123456789',
      url: 'https://github.com/example/gallery/commit/abc123456789'
    }
  }))
}));

vi.mock('../data/musicAdminApi.js', () => ({
  isMusicAdminApiConfigured: () => true,
  publishMusicAlbum: vi.fn(async () => ({
    songs: [
      {
        id: 'demo-live-01',
        name: '第一首',
        src: '/mp3/Demo/01.mp3'
      }
    ],
    manifestTarget: {
      key: 'json/music-index.json',
      url: 'https://r2.example.com/json/music-index.json'
    }
  }))
}));

vi.mock('../data/videoAdminApi.js', () => ({
  isVideoAdminApiConfigured: () => true,
  isVideoAccessAdminApiConfigured: () => true,
  loadVideoAccessSettings: vi.fn(async () => ({
    password: 'SongSharing',
    passwordVersion: 'v1',
    updatedAt: '2026-05-18T00:00:00.000Z'
  })),
  publishVideoAccessSettings: vi.fn(async ({ password }) => ({
    config: {
      password,
      passwordVersion: 'v2',
      updatedAt: '2026-05-18T01:00:00.000Z'
    },
    publicTarget: {
      key: 'json/video-access.json',
      url: 'https://r2.example.com/json/video-access.json'
    }
  })),
  publishVideoLinks: vi.fn(async () => ({
    items: [
      {
        id: 'demo-video-01',
        title: 'Demo Video',
        url: 'https://video.example.com/demo/playlist.m3u8'
      }
    ],
    manifestTarget: {
      key: 'json/video-index.json',
      url: 'https://r2.example.com/json/video-index.json'
    }
  }))
}));

vi.mock('../data/downloadAdminApi.js', () => ({
  isDownloadAdminApiConfigured: () => true,
  publishDownloadLinks: vi.fn(async () => ({
    items: [
      {
        title: 'Demo Download',
        url: 'https://cdn.example.com/demo.zip',
        filename: 'demo.zip'
      }
    ],
    manifestTarget: {
      key: 'json/download-index.json',
      url: 'https://r2.example.com/json/download-index.json'
    }
  }))
}));

vi.mock('../data/galleryManifest.js', () => ({
  loadGalleryItems: vi.fn(async () => [
    { id: 'images/BB/a.jpg', category: 'BB', name: 'a.jpg' },
    { id: 'images/XKK/b.jpg', category: 'XKK', name: 'b.jpg' },
    { id: 'images/封面/c.jpg', category: '封面', name: 'c.jpg' }
  ])
}));

vi.mock('../data/musicManifest.js', () => ({
  loadMusicManifestAlbums: vi.fn(async () => [
    {
      id: 'demo-live',
      name: 'Demo Live',
      artist: '李志',
      cover: 'https://r2.example.com/img/demo.jpg',
      year: 2026,
      type: 'live',
      songs: [
        { id: 'demo-live-01', name: '第一首', src: '/mp3/Demo/01.mp3' }
      ]
    },
    {
      id: 'remote-live',
      name: 'Remote Live',
      artist: '李志',
      cover: '',
      type: 'live',
      songs: []
    }
  ])
}));

vi.mock('../data/videoManifest.js', () => ({
  loadVideoCatalog: vi.fn(async () => ({
    videoCategories: [
      { id: 'live', name: '现场视频', icon: '#icon-film' },
      { id: 'talk', name: '访谈', icon: '#icon-video' }
    ],
    videoData: {
      live: [
        {
          id: 'demo-folder',
          folderId: 'demo-folder',
          title: 'Demo Folder',
          thumb: 'https://r2.example.com/img/demo.jpg',
          isFolder: true
        }
      ]
    }
  }))
}));

vi.mock('../data/downloadManifest.js', () => ({
  loadDownloadSections: vi.fn(async () => [
    {
      title: '叁缺壹吉隆坡站',
      groups: [
        {
          title: 'Demo Group',
          items: [
            { title: 'Old Download', url: 'https://cdn.example.com/old.zip', filename: 'old.zip' }
          ]
        }
      ]
    }
  ])
}));

vi.mock('../data/announcementSource.js', () => ({
  loadAnnouncement: vi.fn(async () => ({
    announcement: {
      id: 'current-notice',
      enabled: true,
      title: '当前公告',
      content: '当前正文',
      type: 'info',
      force: false,
      confirmText: '我知道了',
      linkText: '',
      linkUrl: '',
      startAt: '',
      endAt: '',
      updatedAt: ''
    }
  }))
}));

describe('AdminPage', () => {
  afterEach(() => {
    window.sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('loads the current announcement and publishes edits', async () => {
    const { publishAnnouncement } = await import('../data/announcementAdminApi.js');

    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('当前公告')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('管理员口令'), {
      target: { value: 'secret-token' }
    });
    fireEvent.change(screen.getByLabelText('标题'), {
      target: { value: '新的公告' }
    });
    fireEvent.change(screen.getByLabelText('正文'), {
      target: { value: '新的正文' }
    });
    fireEvent.click(screen.getByRole('button', { name: '发布公告' }));

    await waitFor(() => {
      expect(publishAnnouncement).toHaveBeenCalledWith(expect.objectContaining({
        token: 'secret-token',
        announcement: expect.objectContaining({
          id: 'current-notice',
          title: '新的公告',
          content: '新的正文'
        })
      }));
    });

    expect(await screen.findByText('公告已发布')).toBeInTheDocument();
  });

  it('publishes gallery images with the shared admin token', async () => {
    const { publishGalleryImages } = await import('../data/galleryAdminApi.js');
    const file = new File(['image-bytes'], 'example.jpg', { type: 'image/jpeg' });

    render(<AdminPage />);

    await screen.findByDisplayValue('当前公告');
    fireEvent.change(screen.getByLabelText('管理员口令'), {
      target: { value: 'secret-token' }
    });
    fireEvent.click(screen.getByRole('tab', { name: '图库' }));
    fireEvent.click(await screen.findByRole('button', { name: 'XKK' }));
    fireEvent.change(screen.getByLabelText('图片文件'), {
      target: { files: [file] }
    });
    fireEvent.click(screen.getByRole('button', { name: '发布图片' }));

    await waitFor(() => {
      expect(publishGalleryImages).toHaveBeenCalledWith(expect.objectContaining({
        token: 'secret-token',
        category: 'XKK',
        files: [file]
      }));
    });

    expect(await screen.findByText('已发布 1 张图片，等待 Cloudflare Pages 更新')).toBeInTheDocument();
  });

  it('keeps gallery categories editable while offering existing category shortcuts', async () => {
    render(<AdminPage />);

    await screen.findByDisplayValue('当前公告');
    fireEvent.click(screen.getByRole('tab', { name: '图库' }));

    expect(await screen.findByRole('button', { name: 'BB' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '封面' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('分类'), {
      target: { value: '新分类' }
    });
    expect(screen.getByLabelText('分类')).toHaveValue('新分类');
  });

  it('publishes music albums with audio files', async () => {
    const { publishMusicAlbum } = await import('../data/musicAdminApi.js');
    const file = new File(['audio-bytes'], '01.第一首.mp3', { type: 'audio/mpeg' });

    render(<AdminPage />);

    await screen.findByDisplayValue('当前公告');
    fireEvent.change(screen.getByLabelText('管理员口令'), {
      target: { value: 'secret-token' }
    });
    fireEvent.click(screen.getByRole('tab', { name: '音乐' }));
    await screen.findByRole('option', { name: 'Demo Live' });
    fireEvent.change(screen.getByLabelText('选择专辑'), {
      target: { value: 'demo-live' }
    });
    fireEvent.change(screen.getByLabelText('上传音频'), {
      target: { files: [file] }
    });
    fireEvent.change(screen.getByLabelText('歌曲名称'), {
      target: { value: '第一首' }
    });
    fireEvent.click(screen.getByRole('button', { name: '发布音乐' }));

    await waitFor(() => {
      expect(publishMusicAlbum).toHaveBeenCalledWith(expect.objectContaining({
        token: 'secret-token',
        albumId: 'demo-live',
        albumName: 'Demo Live',
        coverUrl: 'https://r2.example.com/img/demo.jpg',
        startTrackNumber: '2',
        audioFiles: [file],
        songNames: '第一首'
      }));
    });

    expect(await screen.findByText('已发布 1 首歌曲到 R2')).toBeInTheDocument();
  });

  it('publishes music albums with external audio and lyric links', async () => {
    const { publishMusicAlbum } = await import('../data/musicAdminApi.js');

    render(<AdminPage />);

    await screen.findByDisplayValue('当前公告');
    fireEvent.change(screen.getByLabelText('管理员口令'), {
      target: { value: 'secret-token' }
    });
    fireEvent.click(screen.getByRole('tab', { name: '音乐' }));
    await screen.findByRole('option', { name: 'Remote Live' });
    fireEvent.change(screen.getByLabelText('选择专辑'), {
      target: { value: 'remote-live' }
    });
    fireEvent.change(screen.getByLabelText('音频链接'), {
      target: { value: 'https://cdn.example.com/audio/01.remote.mp3' }
    });
    fireEvent.change(screen.getByLabelText('歌词链接'), {
      target: { value: 'https://cdn.example.com/lrc/01.remote.lrc' }
    });
    fireEvent.change(screen.getByLabelText('专辑封面 URL'), {
      target: { value: 'https://cdn.example.com/cover.jpg' }
    });
    fireEvent.change(screen.getByLabelText('单曲封面链接'), {
      target: { value: 'https://cdn.example.com/track-cover.jpg' }
    });
    fireEvent.click(screen.getByRole('button', { name: '发布音乐' }));

    await waitFor(() => {
      expect(publishMusicAlbum).toHaveBeenCalledWith(expect.objectContaining({
        token: 'secret-token',
        albumId: 'remote-live',
        albumName: 'Remote Live',
        audioUrls: 'https://cdn.example.com/audio/01.remote.mp3',
        lyricUrls: 'https://cdn.example.com/lrc/01.remote.lrc',
        coverUrl: 'https://cdn.example.com/cover.jpg',
        songCoverUrls: 'https://cdn.example.com/track-cover.jpg'
      }));
    });
  });

  it('publishes video links with the shared admin token', async () => {
    const { publishVideoLinks } = await import('../data/videoAdminApi.js');

    render(<AdminPage />);

    await screen.findByDisplayValue('当前公告');
    fireEvent.change(screen.getByLabelText('管理员口令'), {
      target: { value: 'secret-token' }
    });
    fireEvent.click(screen.getByRole('tab', { name: '视频' }));
    await screen.findByRole('option', { name: '现场视频' });
    fireEvent.change(screen.getByLabelText('选择分类'), {
      target: { value: 'live' }
    });
    await screen.findByRole('option', { name: 'Demo Folder' });
    fireEvent.change(screen.getByLabelText('选择文件夹'), {
      target: { value: 'demo-folder' }
    });
    fireEvent.change(screen.getByLabelText('视频 URL'), {
      target: { value: 'https://video.example.com/demo/playlist.m3u8' }
    });
    fireEvent.change(screen.getByLabelText('视频标题'), {
      target: { value: 'Demo Video' }
    });
    fireEvent.change(screen.getByLabelText('封面 URL'), {
      target: { value: 'https://r2.example.com/img/demo.jpg' }
    });
    fireEvent.click(screen.getByRole('button', { name: '发布视频' }));

    await waitFor(() => {
      expect(publishVideoLinks).toHaveBeenCalledWith(expect.objectContaining({
        token: 'secret-token',
        categoryId: 'live',
        categoryName: '现场视频',
        categoryIcon: 'film',
        folderId: 'demo-folder',
        folderTitle: 'Demo Folder',
        folderThumb: 'https://r2.example.com/img/demo.jpg',
        videoUrls: 'https://video.example.com/demo/playlist.m3u8',
        videoTitles: 'Demo Video',
        thumbUrls: 'https://r2.example.com/img/demo.jpg'
      }));
    });

    expect(await screen.findByText('已发布 1 个视频链接')).toBeInTheDocument();
  });

  it('loads and saves the video access password from the video admin panel', async () => {
    const {
      loadVideoAccessSettings,
      publishVideoAccessSettings
    } = await import('../data/videoAdminApi.js');

    render(<AdminPage />);

    await screen.findByDisplayValue('当前公告');
    fireEvent.change(screen.getByLabelText('管理员口令'), {
      target: { value: 'secret-token' }
    });
    fireEvent.click(screen.getByRole('tab', { name: '视频' }));
    fireEvent.click(screen.getByRole('button', { name: '读取口令' }));

    await waitFor(() => {
      expect(loadVideoAccessSettings).toHaveBeenCalledWith(expect.objectContaining({
        token: 'secret-token'
      }));
    });
    expect(await screen.findByDisplayValue('SongSharing')).toBeInTheDocument();
    expect(screen.getByDisplayValue('v1')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('访问口令'), {
      target: { value: 'SongSharing2026' }
    });
    fireEvent.click(screen.getByRole('button', { name: '保存口令' }));

    await waitFor(() => {
      expect(publishVideoAccessSettings).toHaveBeenCalledWith(expect.objectContaining({
        token: 'secret-token',
        password: 'SongSharing2026'
      }));
    });

    expect(await screen.findByText('视频访问口令已保存，旧授权已失效')).toBeInTheDocument();
    expect(screen.getByDisplayValue('v2')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'json/video-access.json' })).toHaveAttribute(
      'href',
      'https://r2.example.com/json/video-access.json'
    );
  });

  it('keeps the new video folder option selected so the title can be filled', async () => {
    render(<AdminPage />);

    await screen.findByDisplayValue('当前公告');
    fireEvent.click(screen.getByRole('tab', { name: '视频' }));
    await screen.findByRole('option', { name: '现场视频' });
    fireEvent.change(screen.getByLabelText('选择分类'), {
      target: { value: 'live' }
    });
    fireEvent.change(screen.getByLabelText('选择文件夹'), {
      target: { value: '__new_video_folder__' }
    });

    expect(screen.getByLabelText('选择文件夹')).toHaveValue('__new_video_folder__');
    expect(screen.getByLabelText('文件夹标题')).toBeInTheDocument();
  });

  it('publishes download links with the shared admin token', async () => {
    const { publishDownloadLinks } = await import('../data/downloadAdminApi.js');

    render(<AdminPage />);

    await screen.findByDisplayValue('当前公告');
    fireEvent.change(screen.getByLabelText('管理员口令'), {
      target: { value: 'secret-token' }
    });
    fireEvent.click(screen.getByRole('tab', { name: '下载' }));
    await screen.findByRole('option', { name: '叁缺壹吉隆坡站' });
    fireEvent.change(screen.getByLabelText('选择栏目'), {
      target: { value: '叁缺壹吉隆坡站' }
    });
    fireEvent.change(screen.getByLabelText('下载 URL'), {
      target: { value: 'https://cdn.example.com/demo.zip' }
    });
    fireEvent.change(screen.getByLabelText('显示标题'), {
      target: { value: 'Demo Download' }
    });
    fireEvent.change(screen.getByLabelText('下载文件名'), {
      target: { value: 'demo.zip' }
    });
    fireEvent.click(screen.getByRole('button', { name: '发布下载' }));

    await waitFor(() => {
      expect(publishDownloadLinks).toHaveBeenCalledWith(expect.objectContaining({
        token: 'secret-token',
        sectionTitle: '叁缺壹吉隆坡站',
        groupTitle: 'Demo Group',
        itemUrls: 'https://cdn.example.com/demo.zip',
        itemTitles: 'Demo Download',
        filenames: 'demo.zip'
      }));
    });

    expect(await screen.findByText('已发布 1 个下载链接')).toBeInTheDocument();
  });
});

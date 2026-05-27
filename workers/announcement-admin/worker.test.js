import { afterEach, describe, expect, it, vi } from 'vitest';

import worker from './worker.js';

const createKv = () => {
  const store = new Map();
  return {
    get: async (key) => store.get(key) || null,
    put: async (key, value) => {
      store.set(key, value);
    }
  };
};

const createR2Bucket = () => {
  const store = new Map();
  return {
    store,
    get: async (key) => {
      const entry = store.get(key);
      if (!entry) return null;
      return {
        text: async () => {
          if (typeof entry.value === 'string') return entry.value;
          return new TextDecoder().decode(entry.value);
        }
      };
    },
    put: async (key, value, options) => {
      store.set(key, { value, options });
    }
  };
};

const createEnv = () => ({
  ADMIN_TOKEN: 'secret-token',
  ALLOWED_ORIGIN: '*',
  PUBLIC_ANNOUNCEMENT_BASE_URL: 'https://notice.example.com',
  GITHUB_TOKEN: 'github-token',
  GALLERY_GITHUB_OWNER: 'demo',
  GALLERY_GITHUB_REPO: 'gallery',
  GALLERY_GITHUB_BRANCH: 'main',
  GALLERY_REPO_INDEX_PATH: 'public/data/images.json',
    GALLERY_REPO_IMAGE_ROOT: 'public/images',
    GALLERY_PUBLIC_IMAGE_ROOT: 'images',
    GALLERY_PUBLIC_BASE_URL: 'https://imgs.example.com',
    MUSIC_PUBLIC_BASE_URL: 'https://r2.example.com',
    VIDEO_PUBLIC_BASE_URL: 'https://r2.example.com',
    DOWNLOAD_PUBLIC_BASE_URL: 'https://r2.example.com',
    ANNOUNCEMENT_KV: createKv(),
    ANNOUNCEMENT_PUBLIC_BUCKET: createR2Bucket(),
    MUSIC_PUBLIC_BUCKET: createR2Bucket(),
    VIDEO_PUBLIC_BUCKET: createR2Bucket(),
    DOWNLOAD_PUBLIC_BUCKET: createR2Bucket()
  });

describe('announcement admin worker', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('requires the admin token before publishing', async () => {
    const response = await worker.fetch(new Request('https://worker.test/api/admin/announcement', {
      method: 'PUT',
      body: JSON.stringify({
        id: 'notice-1',
        content: 'hello'
      })
    }), createEnv());

    expect(response.status).toBe(401);
  });

  it('publishes and exposes the current announcement', async () => {
    const env = createEnv();
    const publishResponse = await worker.fetch(new Request('https://worker.test/api/admin/announcement', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer secret-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        announcement: {
          id: 'notice-1',
          enabled: true,
          title: '更新',
          content: '公告正文',
          contentAlign: 'center',
          deliveryMode: 'silent',
          imageUrl: 'https://cdn.example.com/notice.jpg',
          imageAlt: '公告配图',
          imageMaxWidth: 360,
          imageMaxHeight: 280
        }
      })
    }), env);

    expect(publishResponse.status).toBe(200);

    const publicResponse = await worker.fetch(
      new Request('https://worker.test/api/announcement'),
      env
    );
    const payload = await publicResponse.json();

    expect(payload).toMatchObject({
      id: 'notice-1',
      enabled: true,
      title: '更新',
      content: '公告正文',
      contentAlign: 'center',
      deliveryMode: 'silent',
      imageUrl: 'https://cdn.example.com/notice.jpg',
      imageAlt: '公告配图',
      imageMaxWidth: 360,
      imageMaxHeight: 280
    });
    expect(env.ANNOUNCEMENT_PUBLIC_BUCKET.store.get('announcement.json')).toMatchObject({
      options: {
        httpMetadata: expect.objectContaining({
          contentType: 'application/json; charset=utf-8'
        })
      }
    });
  });

  it('archives the previous announcement when publishing a new id', async () => {
    const env = createEnv();

    for (const announcement of [
      {
        id: 'notice-1',
        enabled: true,
        title: '第一次公告',
        content: '第一条正文',
        updatedAt: '2026-05-18T00:00:00+08:00'
      },
      {
        id: 'notice-2',
        enabled: true,
        title: '第二次公告',
        content: '第二条正文',
        updatedAt: '2026-05-19T00:00:00+08:00'
      }
    ]) {
      const response = await worker.fetch(new Request('https://worker.test/api/admin/announcement', {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer secret-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ announcement })
      }), env);
      expect(response.status).toBe(200);
    }

    const publicResponse = await worker.fetch(
      new Request('https://worker.test/api/announcement'),
      env
    );
    const payload = await publicResponse.json();

    expect(payload.announcement).toMatchObject({
      id: 'notice-2',
      title: '第二次公告'
    });
    expect(payload.history).toHaveLength(1);
    expect(payload.history[0]).toMatchObject({
      id: 'notice-1',
      title: '第一次公告',
      content: '第一条正文'
    });

    const publicObject = env.ANNOUNCEMENT_PUBLIC_BUCKET.store.get('announcement.json');
    expect(JSON.parse(publicObject.value).history[0]).toMatchObject({
      id: 'notice-1'
    });
  });

  it('deletes a history announcement and republishes the public payload', async () => {
    const env = createEnv();

    for (const announcement of [
      {
        id: 'notice-1',
        enabled: true,
        title: '第一次公告',
        content: '第一条正文'
      },
      {
        id: 'notice-2',
        enabled: true,
        title: '第二次公告',
        content: '第二条正文'
      }
    ]) {
      const response = await worker.fetch(new Request('https://worker.test/api/admin/announcement', {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer secret-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ announcement })
      }), env);
      expect(response.status).toBe(200);
    }

    const deleteResponse = await worker.fetch(new Request('https://worker.test/api/admin/announcement/history/notice-1', {
      method: 'DELETE',
      headers: {
        Authorization: 'Bearer secret-token'
      }
    }), env);
    expect(deleteResponse.status).toBe(200);

    const payload = await deleteResponse.json();
    expect(payload.history).toHaveLength(0);
    expect(payload.announcement).toMatchObject({
      id: 'notice-2'
    });

    const publicObject = env.ANNOUNCEMENT_PUBLIC_BUCKET.store.get('announcement.json');
    expect(JSON.parse(publicObject.value)).toMatchObject({
      announcement: {
        id: 'notice-2'
      },
      history: []
    });
  });

  it('publishes gallery images to GitHub in one commit', async () => {
    const treeRequests = [];
    const githubFetch = vi.fn(async (url, init = {}) => {
      const requestUrl = new URL(url);
      const method = init.method || 'GET';
      const path = requestUrl.pathname;

      if (method === 'GET' && path === '/repos/demo/gallery/contents/public/data/images.json') {
        return Response.json({
          content: btoa(JSON.stringify({
            items: [
              {
                id: 'images/Old/old.jpg',
                category: 'Old',
                name: 'old.jpg',
                path: 'images/Old/old.jpg',
                url: '/images/Old/old.jpg'
              }
            ]
          }))
        });
      }

      if (method === 'GET' && path === '/repos/demo/gallery/git/ref/heads/main') {
        return Response.json({ object: { sha: 'parent-sha' } });
      }

      if (method === 'GET' && path === '/repos/demo/gallery/git/commits/parent-sha') {
        return Response.json({ tree: { sha: 'base-tree-sha' } });
      }

      if (method === 'POST' && path === '/repos/demo/gallery/git/blobs') {
        const body = JSON.parse(init.body);
        expect(body.encoding).toBe('base64');
        expect(body.content).toBeTruthy();
        return Response.json({ sha: 'image-blob-sha' });
      }

      if (method === 'POST' && path === '/repos/demo/gallery/git/trees') {
        const body = JSON.parse(init.body);
        treeRequests.push(body);
        return Response.json({ sha: 'next-tree-sha' });
      }

      if (method === 'POST' && path === '/repos/demo/gallery/git/commits') {
        const body = JSON.parse(init.body);
        expect(body.parents).toEqual(['parent-sha']);
        expect(body.tree).toBe('next-tree-sha');
        return Response.json({
          sha: 'commit-sha',
          html_url: 'https://github.com/demo/gallery/commit/commit-sha'
        });
      }

      if (method === 'PATCH' && path === '/repos/demo/gallery/git/refs/heads/main') {
        const body = JSON.parse(init.body);
        expect(body).toEqual({ sha: 'commit-sha', force: false });
        return Response.json({});
      }

      return Response.json({ message: `unexpected ${method} ${path}` }, { status: 500 });
    });
    vi.stubGlobal('fetch', githubFetch);

    const formData = new FormData();
    formData.set('category', 'XKK');
    formData.set('name', '显示名');
    formData.append('imageNames', 'example.jpg');
    formData.append('images', new File(['image-bytes'], 'example.jpg', { type: 'image/jpeg' }), 'example.jpg');

    const response = await worker.fetch(new Request('https://worker.test/api/admin/gallery', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer secret-token'
      },
      body: formData
    }), createEnv());

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({
      ok: true,
      commit: {
        sha: 'commit-sha',
        url: 'https://github.com/demo/gallery/commit/commit-sha'
      },
      items: [
        {
          category: 'XKK',
          name: '显示名',
          path: 'images/XKK/example.jpg',
          url: 'https://imgs.example.com/images/XKK/example.jpg'
        }
      ]
    });

    expect(treeRequests).toHaveLength(1);
    const tree = treeRequests[0].tree;
    expect(tree).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: 'public/images/XKK/example.jpg',
        sha: 'image-blob-sha'
      }),
      expect.objectContaining({
        path: 'public/data/images.json'
      })
    ]));

    const indexEntry = tree.find((entry) => entry.path === 'public/data/images.json');
    const nextIndex = JSON.parse(indexEntry.content);
    expect(nextIndex.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'images/Old/old.jpg' }),
      expect.objectContaining({
        category: 'XKK',
        name: '显示名',
        path: 'images/XKK/example.jpg'
      })
    ]));
  });

  it('publishes music audio files to R2 and updates the music index', async () => {
    const env = createEnv();
    const formData = new FormData();
    formData.set('albumId', 'demo-live');
    formData.set('albumName', 'Demo Live');
    formData.set('artist', '李志');
    formData.set('type', 'live');
    formData.set('songNames', '第一首');
    formData.append('audioNames', '01.第一首.mp3');
    formData.append('audios', new File(['audio-bytes'], '01.第一首.mp3', { type: 'audio/mpeg' }), '01.第一首.mp3');
    formData.append('songCoverNames', '01.第一首.jpg');
    formData.append('songCovers', new File(['cover-bytes'], '01.第一首.jpg', { type: 'image/jpeg' }), '01.第一首.jpg');

    const response = await worker.fetch(new Request('https://worker.test/api/admin/music', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer secret-token'
      },
      body: formData
    }), env);

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({
      ok: true,
      album: {
        id: 'demo-live',
        name: 'Demo Live',
        artist: '李志'
      },
      songs: [
        {
          id: 'demo-live-01',
          trackNumber: 1,
          name: '第一首'
        }
      ],
      manifestTarget: {
        key: 'json/music-index.json',
        url: 'https://r2.example.com/json/music-index.json'
      }
    });

    expect(env.MUSIC_PUBLIC_BUCKET.store.get('mp3/Demo Live/01.第一首.mp3')).toMatchObject({
      options: {
        httpMetadata: expect.objectContaining({
          contentType: 'audio/mpeg'
        })
      }
    });
    expect(env.MUSIC_PUBLIC_BUCKET.store.get('img/music/Demo Live/01.第一首.jpg')).toMatchObject({
      options: {
        httpMetadata: expect.objectContaining({
          contentType: 'image/jpeg'
        })
      }
    });

    const indexEntry = env.MUSIC_PUBLIC_BUCKET.store.get('json/music-index.json');
    const nextIndex = JSON.parse(indexEntry.value);
    expect(nextIndex.albums).toEqual([
      expect.objectContaining({
        id: 'demo-live',
        songs: [
          expect.objectContaining({
            src: 'https://r2.example.com/mp3/Demo Live/01.第一首.mp3',
            cover: 'https://r2.example.com/img/music/Demo Live/01.第一首.jpg'
          })
        ]
      })
    ]);
  });

  it('adds external music and lyric urls without uploading audio', async () => {
    const env = createEnv();
    const formData = new FormData();
    formData.set('albumId', 'remote-live');
    formData.set('albumName', 'Remote Live');
    formData.set('artist', '李志');
    formData.set('coverUrl', 'https://cdn.example.com/covers/remote.jpg');
    formData.set('songNames', '外链歌曲');
    formData.set('audioUrls', 'https://cdn.example.com/audio/01.remote.mp3');
    formData.set('lyricUrls', 'https://cdn.example.com/lrc/01.remote.lrc');
    formData.set('songCoverUrls', 'https://cdn.example.com/covers/01.remote.jpg');

    const response = await worker.fetch(new Request('https://worker.test/api/admin/music', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer secret-token'
      },
      body: formData
    }), env);

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.songs).toEqual([
      expect.objectContaining({
        name: '外链歌曲',
        src: 'https://cdn.example.com/audio/01.remote.mp3',
        lrc: 'https://cdn.example.com/lrc/01.remote.lrc',
        cover: 'https://cdn.example.com/covers/01.remote.jpg'
      })
    ]);
    expect(env.MUSIC_PUBLIC_BUCKET.store.has('mp3/Remote Live/01.remote.mp3')).toBe(false);

    const nextIndex = JSON.parse(env.MUSIC_PUBLIC_BUCKET.store.get('json/music-index.json').value);
    expect(nextIndex.albums[0]).toEqual(expect.objectContaining({
      id: 'remote-live',
      cover: 'https://cdn.example.com/covers/remote.jpg',
      songs: [
        expect.objectContaining({
          src: 'https://cdn.example.com/audio/01.remote.mp3',
          lrc: 'https://cdn.example.com/lrc/01.remote.lrc',
          cover: 'https://cdn.example.com/covers/01.remote.jpg'
        })
      ]
    }));
  });

  it('keeps per-song covers optional so blank slots fall back to the album cover', async () => {
    const env = createEnv();
    const formData = new FormData();
    formData.set('albumId', 'cover-slots');
    formData.set('albumName', 'Cover Slots');
    formData.set('artist', '李志');
    formData.set('coverUrl', 'https://cdn.example.com/covers/album.jpg');
    formData.set('songNames', '第一首\n第二首');
    formData.set('audioUrls', [
      'https://cdn.example.com/audio/01.first.mp3',
      'https://cdn.example.com/audio/02.second.mp3'
    ].join('\n'));
    formData.set('songCoverUrls', '-\nhttps://cdn.example.com/covers/02.second.jpg');

    const response = await worker.fetch(new Request('https://worker.test/api/admin/music', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer secret-token'
      },
      body: formData
    }), env);

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.songs).toEqual([
      expect.objectContaining({
        name: '第一首',
        cover: ''
      }),
      expect.objectContaining({
        name: '第二首',
        cover: 'https://cdn.example.com/covers/02.second.jpg'
      })
    ]);
  });

  it('publishes video links to the video index without uploading media', async () => {
    const env = createEnv();
    const formData = new FormData();
    formData.set('categoryId', 'live');
    formData.set('categoryName', '现场视频');
    formData.set('categoryIcon', 'film');
    formData.set('folderId', 'demo-folder');
    formData.set('folderTitle', 'Demo Folder');
    formData.set('folderThumb', 'https://r2.example.com/img/demo.jpg');
    formData.set('videoIds', 'demo-video-01');
    formData.set('videoTitles', 'Demo Video');
    formData.set('videoUrls', 'https://video.example.com/demo/playlist.m3u8');
    formData.set('backupUrls', 'https://video.example.com/demo.mp4');
    formData.set('thumbUrls', 'https://r2.example.com/img/demo.jpg');

    const response = await worker.fetch(new Request('https://worker.test/api/admin/video', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer secret-token'
      },
      body: formData
    }), env);

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({
      ok: true,
      manifestTarget: {
        key: 'json/video-index.json',
        url: 'https://r2.example.com/json/video-index.json'
      },
      items: [
        {
          type: 'video',
          id: 'demo-video-01',
          title: 'Demo Video',
          url: 'https://video.example.com/demo/playlist.m3u8',
          backupUrl: 'https://video.example.com/demo.mp4',
          thumb: 'https://r2.example.com/img/demo.jpg'
        }
      ]
    });

    const nextIndex = JSON.parse(env.VIDEO_PUBLIC_BUCKET.store.get('json/video-index.json').value);
    expect(nextIndex.categories).toEqual([
      expect.objectContaining({
        id: 'live',
        name: '现场视频',
        icon: 'film',
        items: [
          expect.objectContaining({
            type: 'folder',
            id: 'demo-folder',
            title: 'Demo Folder',
            items: [
              expect.objectContaining({
                id: 'demo-video-01',
                url: 'https://video.example.com/demo/playlist.m3u8'
              })
            ]
          })
        ]
      })
    ]);
  });

  it('stores the video access password in R2 with a new version', async () => {
    const env = createEnv();
    const initialResponse = await worker.fetch(new Request('https://worker.test/api/admin/video-access', {
      headers: {
        Authorization: 'Bearer secret-token'
      }
    }), env);

    expect(initialResponse.status).toBe(200);
    await expect(initialResponse.json()).resolves.toMatchObject({
      config: {
        enabled: true,
        password: '1701701xyz',
        passwordVersion: 'default'
      },
      indexKey: 'json/video-access.json'
    });

    const saveResponse = await worker.fetch(new Request('https://worker.test/api/admin/video-access', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer secret-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        password: 'SongSharing2026'
      })
    }), env);

    expect(saveResponse.status).toBe(200);
    const payload = await saveResponse.json();
    expect(payload).toMatchObject({
      ok: true,
      config: {
        enabled: true,
        password: 'SongSharing2026'
      },
      publicTarget: {
        key: 'json/video-access.json',
        url: 'https://r2.example.com/json/video-access.json'
      }
    });
    expect(payload.config.passwordVersion).toBeTruthy();
    expect(payload.config.passwordVersion).not.toBe('default');

    const storedEntry = env.VIDEO_PUBLIC_BUCKET.store.get('json/video-access.json');
    expect(storedEntry).toMatchObject({
      options: {
        httpMetadata: expect.objectContaining({
          contentType: 'application/json; charset=utf-8',
          cacheControl: 'no-store'
        })
      }
    });
    const storedConfig = JSON.parse(storedEntry.value);
    expect(storedConfig).toMatchObject({
      enabled: true,
      password: 'SongSharing2026',
      passwordVersion: payload.config.passwordVersion
    });
  });

  it('can disable video access password checks while preserving the password', async () => {
    const env = createEnv();
    await env.VIDEO_PUBLIC_BUCKET.put('json/video-access.json', JSON.stringify({
      schemaVersion: 1,
      enabled: true,
      password: 'SongSharing2026',
      passwordVersion: 'v1',
      updatedAt: '2026-05-18T00:00:00.000Z'
    }));

    const response = await worker.fetch(new Request('https://worker.test/api/admin/video-access', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer secret-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        enabled: false
      })
    }), env);

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.config).toMatchObject({
      enabled: false,
      password: 'SongSharing2026'
    });
    expect(payload.config.passwordVersion).not.toBe('v1');

    const storedConfig = JSON.parse(env.VIDEO_PUBLIC_BUCKET.store.get('json/video-access.json').value);
    expect(storedConfig).toMatchObject({
      enabled: false,
      password: 'SongSharing2026',
      passwordVersion: payload.config.passwordVersion
    });
  });

  it('publishes download links to the download index without uploading files', async () => {
    const env = createEnv();
    await env.DOWNLOAD_PUBLIC_BUCKET.put('json/download-index.json', JSON.stringify({
      schemaVersion: 1,
      updatedAt: '2026-05-18T00:00:00.000Z',
      sections: [
        {
          title: '旧栏目',
          sortOrder: 10,
          enabled: true,
          groups: [
            {
              title: '旧分组',
              sortOrder: 10,
              enabled: true,
              items: [
                {
                  title: '旧文件',
                  url: 'https://cdn.example.com/old.zip',
                  filename: 'old.zip',
                  sortOrder: 10,
                  enabled: true
                }
              ]
            }
          ]
        }
      ]
    }));

    const formData = new FormData();
    formData.set('sectionTitle', '旧栏目');
    formData.set('groupTitle', '旧分组');
    formData.set('itemTitles', '新文件');
    formData.set('itemUrls', 'https://cdn.example.com/new.zip');
    formData.set('filenames', 'new-file.zip');
    formData.set('previewUrls', 'https://viewer.example.com/new');

    const response = await worker.fetch(new Request('https://worker.test/api/admin/download', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer secret-token'
      },
      body: formData
    }), env);

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({
      ok: true,
      manifestTarget: {
        key: 'json/download-index.json',
        url: 'https://r2.example.com/json/download-index.json'
      },
      items: [
        {
          title: '新文件',
          url: 'https://cdn.example.com/new.zip',
          filename: 'new-file.zip',
          previewUrl: 'https://viewer.example.com/new',
          sortOrder: 20,
          enabled: true
        }
      ]
    });

    const nextIndex = JSON.parse(env.DOWNLOAD_PUBLIC_BUCKET.store.get('json/download-index.json').value);
    expect(nextIndex.sections[0].groups[0].items).toEqual([
      expect.objectContaining({ title: '旧文件' }),
      expect.objectContaining({
        title: '新文件',
        url: 'https://cdn.example.com/new.zip',
        filename: 'new-file.zip'
      })
    ]);
  });
});

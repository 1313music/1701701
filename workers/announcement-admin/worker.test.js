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
  ANNOUNCEMENT_KV: createKv(),
  ANNOUNCEMENT_PUBLIC_BUCKET: createR2Bucket()
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
          content: '公告正文'
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
      content: '公告正文'
    });
    expect(env.ANNOUNCEMENT_PUBLIC_BUCKET.store.get('announcement.json')).toMatchObject({
      options: {
        httpMetadata: expect.objectContaining({
          contentType: 'application/json; charset=utf-8'
        })
      }
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
});

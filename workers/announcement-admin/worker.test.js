import { describe, expect, it } from 'vitest';

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
  ANNOUNCEMENT_KV: createKv(),
  ANNOUNCEMENT_PUBLIC_BUCKET: createR2Bucket()
});

describe('announcement admin worker', () => {
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
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

import worker from './worker.js';

const createD1 = () => {
  const rows = [];
  const filterRows = (sql, params) => {
    let paramIndex = 0;
    let filteredRows = rows.slice();

    if (sql.includes('status = ?')) {
      const status = params[paramIndex];
      paramIndex += 1;
      filteredRows = filteredRows.filter((row) => row.status === status);
    }
    if (sql.includes('video_key = ?')) {
      const videoKey = params[paramIndex];
      paramIndex += 1;
      filteredRows = filteredRows.filter((row) => row.video_key === videoKey);
    }
    if (sql.includes('text LIKE')) {
      const needle = String(params[paramIndex] || '').replace(/%/g, '').toLowerCase();
      paramIndex += 3;
      filteredRows = filteredRows.filter((row) => (
        row.text.toLowerCase().includes(needle)
        || row.author.toLowerCase().includes(needle)
        || row.video_key.toLowerCase().includes(needle)
      ));
    }

    return {
      filteredRows,
      paramIndex
    };
  };

  return {
    rows,
    prepare(sql) {
      return {
        bind(...params) {
          return {
            async all() {
              if (sql.includes('SELECT id, video_key, time, type, color, author, text, status, created_at')) {
                const { filteredRows, paramIndex } = filterRows(sql, params);
                const limit = Number(params[paramIndex] || 50);
                const offset = Number(params[paramIndex + 1] || 0);
                const results = filteredRows
                  .sort((left, right) => right.created_at - left.created_at)
                  .slice(offset, offset + limit)
                  .map((row) => ({ ...row }));

                return { results };
              }

              if (sql.includes('SELECT time, type, color, author, text')) {
                const [videoKey, limit] = params;
                const results = rows
                  .filter((row) => row.video_key === videoKey && row.status === 'visible')
                  .sort((left, right) => left.time - right.time || left.created_at - right.created_at)
                  .slice(0, limit)
                  .map(({ time, type, color, author, text }) => ({
                    time,
                    type,
                    color,
                    author,
                    text
                  }));

                return { results };
              }

              if (sql.includes('GROUP BY status')) {
                const counts = rows.reduce((bucket, row) => {
                  bucket[row.status] = (bucket[row.status] || 0) + 1;
                  return bucket;
                }, {});
                return {
                  results: Object.entries(counts).map(([status, count]) => ({
                    status,
                    count
                  }))
                };
              }

              return { results: [] };
            },
            async first() {
              if (sql.includes('WHERE ip_hash')) {
                const [ipHash] = params;
                return rows
                  .filter((row) => row.ip_hash === ipHash)
                  .sort((left, right) => right.created_at - left.created_at)[0] || null;
              }

              if (sql.includes('COUNT(*) AS total')) {
                const { filteredRows } = filterRows(sql, params);
                return { total: filteredRows.length };
              }

              if (sql.includes('WHERE id = ?')) {
                const [id] = params;
                return rows.find((row) => row.id === id) || null;
              }

              return null;
            },
            async run() {
              if (sql.includes('INSERT INTO danmaku')) {
                const [
                  id,
                  videoKey,
                  time,
                  type,
                  color,
                  author,
                  text,
                  ipHash,
                  status,
                  createdAt
                ] = params;

                rows.push({
                  id,
                  video_key: videoKey,
                  time,
                  type,
                  color,
                  author,
                  text,
                  ip_hash: ipHash,
                  status,
                  created_at: createdAt
                });
              }

              if (sql.includes('UPDATE danmaku SET status')) {
                const [status, id] = params;
                const row = rows.find((item) => item.id === id);
                if (row) row.status = status;
              }

              if (sql.includes('DELETE FROM danmaku')) {
                const [id] = params;
                const index = rows.findIndex((item) => item.id === id);
                if (index >= 0) rows.splice(index, 1);
              }

              return { success: true };
            }
          };
        }
      };
    }
  };
};

const createEnv = (overrides = {}) => ({
  ALLOWED_ORIGIN: 'https://1701701.xyz,http://localhost:8080',
  ADMIN_TOKEN: 'secret-token',
  DANMAKU_RATE_LIMIT_SECONDS: '10',
  DANMAKU_DB: createD1(),
  ...overrides
});

const readJson = async (response) => ({
  status: response.status,
  body: await response.json()
});

describe('video danmaku worker', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('responds to CORS preflight requests', async () => {
    const response = await worker.fetch(new Request('https://worker.test/api/danmaku/v3/', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://1701701.xyz'
      }
    }), createEnv());

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://1701701.xyz');
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });

  it('returns empty DPlayer data for a video with no danmaku', async () => {
    const response = await worker.fetch(
      new Request('https://worker.test/api/danmaku/v3/?id=video-cat-1-video-1-demo'),
      createEnv()
    );
    const payload = await response.json();

    expect(payload).toEqual({ code: 0, data: [] });
  });

  it('stores and reads DPlayer-compatible danmaku rows', async () => {
    const env = createEnv({ DANMAKU_RATE_LIMIT_SECONDS: '0' });
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(2000);

    for (const item of [
      { time: 18.5, text: '后面的弹幕', type: 0, color: 16777215 },
      { time: 3, text: '前面的弹幕', type: 1, color: '#39ccff' }
    ]) {
      const response = await worker.fetch(new Request('https://worker.test/api/danmaku/v3/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CF-Connecting-IP': '203.0.113.8'
        },
        body: JSON.stringify({
          id: 'video-cat-1-video-1-demo',
          author: 'visitor',
          ...item
        })
      }), env);

      expect(response.status).toBe(200);
      expect((await response.json()).code).toBe(0);
    }

    const response = await worker.fetch(
      new Request('https://worker.test/api/danmaku/v3/?id=video-cat-1-video-1-demo'),
      env
    );
    const payload = await response.json();

    expect(payload).toEqual({
      code: 0,
      data: [
        [3, 1, 0x39ccff, 'visitor', '前面的弹幕'],
        [18.5, 0, 16777215, 'visitor', '后面的弹幕']
      ]
    });
  });

  it('rejects invalid danmaku payloads with DPlayer error payloads', async () => {
    const { status, body } = await readJson(await worker.fetch(new Request('https://worker.test/api/danmaku/v3/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'video-cat-1-video-1-demo',
        time: 1,
        text: '    '
      })
    }), createEnv()));

    expect(status).toBe(200);
    expect(body).toMatchObject({
      code: 1,
      msg: '请输入弹幕内容'
    });
  });

  it('rate limits repeated sends from the same IP', async () => {
    const env = createEnv();
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(3000);

    const firstResponse = await worker.fetch(new Request('https://worker.test/api/danmaku/v3/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '203.0.113.9'
      },
      body: JSON.stringify({
        id: 'video-cat-1-video-1-demo',
        time: 1,
        text: '第一条'
      })
    }), env);
    expect((await firstResponse.json()).code).toBe(0);

    const secondResponse = await worker.fetch(new Request('https://worker.test/api/danmaku/v3/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '203.0.113.9'
      },
      body: JSON.stringify({
        id: 'video-cat-1-video-1-demo',
        time: 2,
        text: '第二条'
      })
    }), env);
    const payload = await secondResponse.json();

    expect(payload).toMatchObject({
      code: 1,
      msg: '发送太频繁，请 10 秒后再试'
    });
    expect(env.DANMAKU_DB.rows).toHaveLength(1);
  });

  it('lists and deletes visible danmaku from the admin endpoint', async () => {
    const env = createEnv({
      DANMAKU_RATE_LIMIT_SECONDS: '0'
    });
    vi.spyOn(Date, 'now').mockReturnValue(1000);

    const createResponse = await worker.fetch(new Request('https://worker.test/api/danmaku/v3/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '203.0.113.10'
      },
      body: JSON.stringify({
        id: 'video-cat-1-video-1-demo',
        time: 8,
        text: '直接显示'
      })
    }), env);
    const created = await createResponse.json();

    expect(created).toMatchObject({
      code: 0,
      data: expect.objectContaining({
        status: 'visible'
      })
    });

    const publicBeforeDelete = await worker.fetch(
      new Request('https://worker.test/api/danmaku/v3/?id=video-cat-1-video-1-demo'),
      env
    );
    expect(await publicBeforeDelete.json()).toEqual({
      code: 0,
      data: [
        [8, 0, 16777215, 'guest', '直接显示']
      ]
    });

    const listResponse = await worker.fetch(new Request(
      'https://worker.test/api/danmaku/admin/items?status=all',
      {
        headers: {
          Authorization: 'Bearer secret-token'
        }
      }
    ), env);
    const listed = await listResponse.json();
    expect(listed).toMatchObject({
      total: 1,
      counts: {
        pending: 0,
        visible: 1,
        hidden: 0
      },
      items: [
        expect.objectContaining({
          id: created.data.id,
          status: 'visible',
          text: '直接显示'
        })
      ]
    });

    const deleteResponse = await worker.fetch(new Request(
      `https://worker.test/api/danmaku/admin/items/${created.data.id}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer secret-token'
        }
      }
    ), env);
    expect(await deleteResponse.json()).toMatchObject({
      ok: true,
      id: created.data.id
    });

    const publicAfterDelete = await worker.fetch(
      new Request('https://worker.test/api/danmaku/v3/?id=video-cat-1-video-1-demo'),
      env
    );
    expect(await publicAfterDelete.json()).toEqual({ code: 0, data: [] });
  });

  it('requires the admin token for danmaku moderation endpoints', async () => {
    const response = await worker.fetch(
      new Request('https://worker.test/api/danmaku/admin/items?status=all'),
      createEnv()
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ error: 'Unauthorized' });
  });
});

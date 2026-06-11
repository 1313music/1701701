import { beforeEach, describe, expect, it, vi } from 'vitest';

import worker from './worker.js';

const createD1 = () => {
  const rows = [];

  return {
    rows,
    prepare(sql) {
      return {
        bind(...params) {
          return {
            async all() {
              if (sql.includes('FROM danmaku') && sql.includes('WHERE video_key')) {
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

              return { results: [] };
            },
            async first() {
              if (sql.includes('WHERE ip_hash')) {
                const [ipHash] = params;
                return rows
                  .filter((row) => row.ip_hash === ipHash)
                  .sort((left, right) => right.created_at - left.created_at)[0] || null;
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
                  status: 'visible',
                  created_at: createdAt
                });
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
});

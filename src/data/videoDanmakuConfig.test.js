import { describe, expect, it } from 'vitest';

import {
  buildVideoDanmakuId,
  buildVideoDanmakuOptions
} from './videoDanmakuConfig.js';

describe('videoDanmakuConfig', () => {
  const activeVideo = {
    id: 'video-1',
    title: '测试视频',
    url: 'https://example.com/video.m3u8',
    _categoryId: 'cat-1'
  };

  it('uses the public danmaku endpoint in development by default', () => {
    expect(buildVideoDanmakuOptions({ activeVideo, env: {} })).toMatchObject({
      api: 'http://localhost:3000/api/danmaku/'
    });
  });

  it('uses the same-origin danmaku endpoint in production by default', () => {
    expect(buildVideoDanmakuOptions({
      activeVideo,
      env: { PROD: true }
    })).toMatchObject({
      api: 'http://localhost:3000/api/danmaku/'
    });
  });

  it('can explicitly disable danmaku', () => {
    expect(buildVideoDanmakuOptions({
      activeVideo,
      env: {
        VITE_VIDEO_DANMAKU_API_URL: 'false'
      }
    })).toBeNull();
  });

  it('builds DPlayer danmaku options from environment config', () => {
    expect(buildVideoDanmakuOptions({
      activeVideo,
      env: {
        VITE_VIDEO_DANMAKU_API_URL: 'https://danmaku.example.com/api/danmaku',
        VITE_VIDEO_DANMAKU_AUTHOR: 'visitor',
        VITE_VIDEO_DANMAKU_MAXIMUM: '300',
        VITE_VIDEO_DANMAKU_BOTTOM: '18%',
        VITE_VIDEO_DANMAKU_SPEED_RATE: '1.2'
      }
    })).toMatchObject({
      id: buildVideoDanmakuId(activeVideo, ''),
      api: 'https://danmaku.example.com/api/danmaku/',
      user: 'visitor',
      maximum: 300,
      bottom: '18%',
      speedRate: 1.2
    });
  });

  it('keeps danmaku pool ids URL-safe and stable', () => {
    const firstId = buildVideoDanmakuId(activeVideo, '');
    const secondId = buildVideoDanmakuId({ ...activeVideo }, '');

    expect(firstId).toBe(secondId);
    expect(firstId).toMatch(/^video-cat-1-video-1-[a-z0-9]+$/);
  });
});

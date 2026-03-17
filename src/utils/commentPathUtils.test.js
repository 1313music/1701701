import { describe, expect, it } from 'vitest';

import { buildSongCommentPaths } from './commentPathUtils.js';

describe('buildSongCommentPaths', () => {
  it('prefers a stable song id path and keeps both legacy URL variants as aliases', () => {
    const result = buildSongCommentPaths({
      albumId: 'van-gogh',
      songId: 'van-gogh-04',
      trackSrc: 'https://r2.1701701.xyz/mp3/%E6%A2%B5%E9%AB%98%E5%85%88%E7%94%9F/04.%E5%B9%BF%E5%9C%BA.mp3'
    });

    expect(result.primaryPath).toBe('song:van-gogh:van-gogh-04');
    expect(result.legacyPaths).toEqual([
      'song:van-gogh:https%3A%2F%2Fr2.1701701.xyz%2Fmp3%2F%E6%A2%B5%E9%AB%98%E5%85%88%E7%94%9F%2F04.%E5%B9%BF%E5%9C%BA.mp3',
      'song:van-gogh:https%3A%2F%2Fr2.1701701.xyz%2Fmp3%2F梵高先生%2F04.广场.mp3'
    ]);
  });

  it('falls back to the encoded track url when song id is unavailable', () => {
    const result = buildSongCommentPaths({
      albumId: 'album-1',
      songId: '',
      trackSrc: 'https://example.com/song.mp3'
    });

    expect(result.primaryPath).toBe('song:album-1:https%3A%2F%2Fexample.com%2Fsong.mp3');
    expect(result.legacyPaths).toEqual([]);
  });
});

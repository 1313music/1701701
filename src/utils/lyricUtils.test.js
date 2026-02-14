import { describe, expect, it } from 'vitest';
import { parseLyrics } from './lyricUtils';

describe('parseLyrics', () => {
  it('parses fractional seconds with different precision', () => {
    const input = [
      '[00:01.5]a',
      '[00:02.50]b',
      '[00:03.500]c'
    ].join('\n');

    const parsed = parseLyrics(input);

    expect(parsed).toHaveLength(3);
    expect(parsed[0]).toMatchObject({ time: 1.5, text: 'a' });
    expect(parsed[1]).toMatchObject({ time: 2.5, text: 'b' });
    expect(parsed[2]).toMatchObject({ time: 3.5, text: 'c' });
  });

  it('removes inline tags and sorts by time', () => {
    const input = [
      '[00:03.00]line-3',
      '[00:01.00]<00:01.20>line-1',
      '[00:02.00]line-2'
    ].join('\n');

    const parsed = parseLyrics(input);

    expect(parsed.map((item) => item.text)).toEqual(['line-1', 'line-2', 'line-3']);
    expect(parsed.map((item) => item.time)).toEqual([1, 2, 3]);
  });
});

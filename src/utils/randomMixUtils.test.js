import { describe, expect, it } from 'vitest';
import {
  ALL_SITE_SEQUENTIAL_ALBUM_ID,
  ALL_SITE_SHUFFLE_ALBUM_ID,
  RANDOM_MIX_ALBUM_ID,
  buildAllSiteSequentialAlbum,
  buildAllSiteShuffleAlbum,
  buildRandomMixAlbum,
  flattenLibrarySongs,
  pickRandomMixEntries
} from './randomMixUtils.js';

const createSeededRandom = (seedValue = 1) => {
  let seed = seedValue;
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
};

const createAlbums = () => [
  {
    id: 'album-a',
    name: '专辑 A',
    artist: '李志',
    cover: '/a.jpg',
    songs: [
      { src: 'a-1.mp3', name: 'A1' },
      { src: 'a-2.mp3', name: 'A2' }
    ]
  },
  {
    id: 'album-b',
    name: '专辑 B',
    artist: '李志',
    cover: '/b.jpg',
    songs: [
      { src: 'b-1.mp3', name: 'B1' },
      { src: 'a-1.mp3', name: '重复 A1' }
    ]
  },
  {
    id: 'album-c',
    name: '专辑 C',
    artist: '另一个歌手',
    cover: '/c.jpg',
    songs: [
      { src: 'c-1.mp3', name: 'C1', cover: '/c-1.jpg' }
    ]
  },
  {
    id: 'album-d',
    name: '专辑 D',
    artist: '第三个歌手',
    cover: '/d.jpg',
    songs: [
      { src: 'd-1.mp3', name: 'D1' }
    ]
  }
];

describe('randomMixUtils', () => {
  it('flattens library songs and removes duplicate sources', () => {
    const entries = flattenLibrarySongs(createAlbums());
    expect(entries.map((entry) => entry.song.src)).toEqual([
      'a-1.mp3',
      'a-2.mp3',
      'b-1.mp3',
      'c-1.mp3',
      'd-1.mp3'
    ]);
  });

  it('builds a random virtual album with source album metadata', () => {
    const album = buildRandomMixAlbum(createAlbums(), {
      random: createSeededRandom(3),
      size: 5
    });

    expect(album).toMatchObject({
      id: RANDOM_MIX_ALBUM_ID,
      name: '随便听',
      artist: '随机歌单',
      isVirtual: true,
      sourceAlbumCount: 4,
      virtualType: 'random-mix'
    });
    expect(album.songs).toHaveLength(5);
    expect(new Set(album.songs.map((song) => song.src)).size).toBe(5);
    expect(new Set(album.coverGrid)).toEqual(new Set(['/a.jpg', '/b.jpg', '/c-1.jpg', '/d.jpg']));
    expect(album.songs.every((song) => song.sourceAlbumId && song.sourceAlbumName)).toBe(true);
  });

  it('builds an all-site shuffled virtual album from every unique song', () => {
    const album = buildAllSiteShuffleAlbum(createAlbums(), {
      random: createSeededRandom(5)
    });

    expect(album).toMatchObject({
      id: ALL_SITE_SHUFFLE_ALBUM_ID,
      name: '随机全站',
      artist: '全站随机',
      isVirtual: true,
      sourceAlbumCount: 4,
      virtualType: 'all-site-shuffle'
    });
    expect(new Set(album.songs.map((song) => song.src))).toEqual(new Set([
      'a-1.mp3',
      'a-2.mp3',
      'b-1.mp3',
      'c-1.mp3',
      'd-1.mp3'
    ]));
  });

  it('builds an all-site sequential virtual album in library order', () => {
    const album = buildAllSiteSequentialAlbum(createAlbums());

    expect(album).toMatchObject({
      id: ALL_SITE_SEQUENTIAL_ALBUM_ID,
      name: '顺序全站',
      artist: '全站顺序',
      isVirtual: true,
      sourceAlbumCount: 4,
      virtualType: 'all-site-sequential'
    });
    expect(album.songs.map((song) => song.src)).toEqual([
      'a-1.mp3',
      'a-2.mp3',
      'b-1.mp3',
      'c-1.mp3',
      'd-1.mp3'
    ]);
  });

  it('keeps adjacent picks from the same album apart when possible', () => {
    const entries = flattenLibrarySongs(createAlbums());
    const picked = pickRandomMixEntries(entries, {
      random: createSeededRandom(8),
      size: entries.length
    });

    for (let index = 1; index < picked.length; index += 1) {
      expect(picked[index].album.id).not.toBe(picked[index - 1].album.id);
    }
  });

});

import { SHOW_MINI_PROGRAM_QR } from '../utils/featureFlags.js';

const MINI_PROGRAM_HINT = '扫码保存到网易云盘';
const MINI_PROGRAM_TITLE = '微信扫一扫打开小程序';

const MINI_PROGRAM_ALBUM_IDS = [
  'hello-zhengzhou',
  '1701',
  'electric-orchestra',
  'van-gogh',
  'movement',
  '108-keywords',
  'will-the-world',
  'beijing-unplugged',
  'gongti-east-road',
  'see',
  '8',
  'io',
  'f',
  'gousanda',
  'yingti-dajie',
  'forbidden-games',
  'jazz-unplugged',
  'electric-orchestra-2',
  'i-love-nanjing'
];

const createMiniProgramAlbum = (albumId) => Object.freeze({
  codeUrl: `/img/mini-program/${albumId}.webp`,
  title: MINI_PROGRAM_TITLE,
  hint: MINI_PROGRAM_HINT
});

const MINI_PROGRAM_ALBUMS = Object.freeze(
  MINI_PROGRAM_ALBUM_IDS.reduce((albums, albumId) => ({
    ...albums,
    [albumId]: createMiniProgramAlbum(albumId)
  }), {})
);

export const getAlbumMiniProgram = (albumId) => {
  if (!SHOW_MINI_PROGRAM_QR) return null;
  if (!albumId) return null;
  return MINI_PROGRAM_ALBUMS[albumId] || null;
};

export const hasAlbumMiniProgram = (albumId) => Boolean(getAlbumMiniProgram(albumId));

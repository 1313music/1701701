import { describe, expect, it } from 'vitest';

import {
  __albumProfilesForTests,
  formatAlbumReleaseDate,
  getAlbumProfile
} from './albumProfiles.js';

describe('albumProfiles', () => {
  it('keeps external profiles linked and identifies the local collection metadata', () => {
    const profiles = Object.entries(__albumProfilesForTests);

    expect(profiles).toHaveLength(33);
    expect(profiles.every(([id, profile]) => (
      (id === 'other' && profile.sourceName === '曲目文件信息' && !profile.sourceUrl)
      || (profile.sourceName && profile.sourceUrl)
    ))).toBe(true);
    expect(getAlbumProfile({ id: 'other' })).toMatchObject({
      description: '收录不同场合留下的现场与弹唱录音，包括“1701”演出、巡演和音乐节现场，作为嘉宾参与的演唱、微博弹唱、小酒馆演出，以及部分翻唱与即兴片段。',
      sourceName: '曲目文件信息',
      sourceUrl: ''
    });
  });

  it('returns the 1701 release date and introduction', () => {
    expect(getAlbumProfile({ id: '1701' })).toMatchObject({
      releaseDate: '2014-05-22',
      description: '专辑名取自好友的排练房房号\n李志第七张录音室创作专辑',
      sourceName: '维基百科'
    });
  });

  it('uses archived official-site text when the Wikipedia remarks cell is empty', () => {
    expect(getAlbumProfile({ id: 'van-gogh' })).toMatchObject({
      releaseDate: '2005-12-25',
      description: expect.stringContaining('前两张由口袋唱片'),
      sourceName: '李志官网'
    });
    expect(getAlbumProfile({ id: 'hello-zhengzhou' })).toMatchObject({
      releaseDate: '2010-09-01',
      description: expect.stringContaining('完成第五张专辑'),
      sourceName: '李志官网'
    });
  });

  it('keeps the Wikipedia wording instead of adding editorial connectors', () => {
    expect(getAlbumProfile({ id: 'gousanda' })).toMatchObject({
      description: '来自 2013-2014 “勾三搭四” 跨年音乐会\n双CD'
    });
    expect(Object.values(__albumProfilesForTests).every(
      (profile) => !profile.description.includes('原版')
    )).toBe(true);
  });

  it('fills terse studio-album remarks with verified source facts', () => {
    expect(getAlbumProfile({ id: 'i-love-nanjing' })).toMatchObject({
      description: '2009年9月完成；第四张专辑；10月16日在南京举行首发演出；随后进行“动物凶猛”巡演34场，历时70天。',
      sourceName: '李志官网'
    });
    expect(getAlbumProfile({ id: 'yingti-dajie' })).toMatchObject({
      description: '录音室专辑，2016年11月20日发行，共8首歌曲。\n少量发行实体版',
      sourceName: '维基百科'
    });
  });

  it('prefers manifest profile fields when supplied', () => {
    expect(getAlbumProfile({
      id: '1701',
      releaseDate: '2026-01-02',
      description: '自定义简介'
    })).toMatchObject({
      releaseDate: '2026-01-02',
      description: '自定义简介'
    });
  });

  it('formats full dates without changing year-only dates', () => {
    expect(formatAlbumReleaseDate('2014-05-22')).toBe('2014.05.22');
    expect(formatAlbumReleaseDate('2012')).toBe('2012');
  });

  it('does not add profiles to virtual albums', () => {
    expect(getAlbumProfile({ id: '1701', isVirtual: true })).toBeNull();
  });

  it('omits archive entries that do not have a verified source', () => {
    expect(getAlbumProfile({ id: 'ting-unplugged-zhengzhou' })).toBeNull();
    expect(getAlbumProfile({ id: 'unknown-album' })).toBeNull();
  });
});

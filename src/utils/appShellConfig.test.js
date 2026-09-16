import { describe, expect, it } from 'vitest';

import {
  AVAILABLE_VIEWS,
  getCanonicalSearchForView,
  getDownloadPreviewPath,
  getPathForView,
  getResourcePreviewPath,
  resolveViewFromLocation,
  shouldRedirectDisabledDownloadResourcePath,
  shouldRedirectDisabledDownloadPath
} from './appShellConfig.js';

describe('appShellConfig', () => {
  it('keeps the download view disabled by default while resources remain public', () => {
    expect(AVAILABLE_VIEWS.has('download')).toBe(false);
    expect(AVAILABLE_VIEWS.has('resources')).toBe(true);
    expect(resolveViewFromLocation({
      pathname: '/download',
      search: ''
    })).toBe('library');
    expect(resolveViewFromLocation({
      pathname: '/download/preview/%E6%9D%8E%E5%BF%97%E8%87%AA%E4%BC%A0',
      search: ''
    })).toBe('library');
    expect(resolveViewFromLocation({
      pathname: '/resources',
      search: ''
    })).toBe('resources');
    expect(resolveViewFromLocation({
      pathname: '/resources/preview/%E6%9D%8E%E5%BF%97%E8%87%AA%E4%BC%A0',
      search: ''
    })).toBe('resources');
    expect(resolveViewFromLocation({
      pathname: '/archive',
      search: ''
    })).toBe('archive');
    expect(getPathForView('archive')).toBe('/archive');
    expect(resolveViewFromLocation({
      pathname: '/support',
      search: ''
    })).toBe('support');
    expect(getPathForView('support')).toBe('/support');
    expect(shouldRedirectDisabledDownloadPath({
      pathname: '/download/'
    })).toBe(true);
    expect(shouldRedirectDisabledDownloadResourcePath({
      pathname: '/resources/preview/%E6%9D%8E%E5%BF%97%E8%87%AA%E4%BC%A0'
    })).toBe(false);
  });

  it('builds encoded preview paths for standalone preview pages', () => {
    expect(getDownloadPreviewPath('李志自传')).toBe('/download/preview/%E6%9D%8E%E5%BF%97%E8%87%AA%E4%BC%A0');
    expect(getResourcePreviewPath('李志自传')).toBe('/resources/preview/%E6%9D%8E%E5%BF%97%E8%87%AA%E4%BC%A0');
  });

  it('resolves the hidden admin route from pathname', () => {
    expect(resolveViewFromLocation({
      pathname: '/myadmin',
      search: ''
    })).toBe('admin');
  });

  // canonical 重写只保留白名单里的键。分享短链用的是 a/s，
  // 一旦漏了它俩，分享链接打开后会被改写成裸链接、歌曲丢失。
  it('keeps both the short and the legacy share params when canonicalising', () => {
    expect(getCanonicalSearchForView('library', '?a=album-1&s=2')).toBe('?a=album-1&s=2');
    expect(getCanonicalSearchForView('library', '?a=album-1&s=2&junk=1')).toBe('?a=album-1&s=2');
    expect(getCanonicalSearchForView('library', '?albumId=album-1&songId=song-1&song=2')).toBe(
      '?albumId=album-1&songId=song-1&song=2'
    );
    expect(getCanonicalSearchForView('library', '?albumId=album-1&a=album-1&song=2&s=2')).toBe(
      '?albumId=album-1&song=2&a=album-1&s=2'
    );
  });
});

import { describe, expect, it } from 'vitest';

import {
  AVAILABLE_VIEWS,
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
});

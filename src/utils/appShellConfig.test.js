import { describe, expect, it } from 'vitest';

import {
  AVAILABLE_VIEWS,
  getDownloadPreviewPath,
  resolveViewFromLocation,
  shouldRedirectDisabledDownloadPath
} from './appShellConfig.js';

describe('appShellConfig', () => {
  it('keeps the download view disabled by default', () => {
    expect(AVAILABLE_VIEWS.has('download')).toBe(false);
    expect(resolveViewFromLocation({
      pathname: '/download',
      search: ''
    })).toBe('library');
    expect(resolveViewFromLocation({
      pathname: '/download/preview/%E6%9D%8E%E5%BF%97%E8%87%AA%E4%BC%A0',
      search: ''
    })).toBe('library');
    expect(shouldRedirectDisabledDownloadPath({
      pathname: '/download/'
    })).toBe(true);
  });

  it('builds encoded preview paths for standalone preview pages', () => {
    expect(getDownloadPreviewPath('李志自传')).toBe('/download/preview/%E6%9D%8E%E5%BF%97%E8%87%AA%E4%BC%A0');
  });

  it('resolves the hidden admin route from pathname', () => {
    expect(resolveViewFromLocation({
      pathname: '/myadmin',
      search: ''
    })).toBe('admin');
  });
});

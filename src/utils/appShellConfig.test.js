import { describe, expect, it } from 'vitest';

import {
  getDownloadPreviewPath,
  resolveViewFromLocation
} from './appShellConfig.js';

describe('appShellConfig', () => {
  it('treats nested download preview paths as the download view', () => {
    expect(resolveViewFromLocation({
      pathname: '/download/preview/%E6%9D%8E%E5%BF%97%E8%87%AA%E4%BC%A0',
      search: ''
    })).toBe('download');
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

import { describe, expect, it } from 'vitest';

import { buildDefaultAvatarUrl } from './defaultAvatar.js';

describe('buildDefaultAvatarUrl', () => {
  // 这三个 URL 是**线上服务端真实返回过的**（从 Waline 接口抓到），
  // 所以这个测试等于在验证「我们算出来的地址 = 服务端会返回的地址」。
  it('rebuilds the exact URLs the server returns', () => {
    expect(buildDefaultAvatarUrl('3245957308@qq.com'))
      .toBe('https://cravatar.cn/avatar/93d45a7fbba8098adc8c79c0ebfb531d?s=150&d=wavatar');
    expect(buildDefaultAvatarUrl('qi0551686@gmail.com'))
      .toBe('https://cravatar.cn/avatar/9538bd58edaad84b7e6f45d10addb9c6?s=150&d=wavatar');
    expect(buildDefaultAvatarUrl('bclz1701@outlook.com'))
      .toBe('https://cravatar.cn/avatar/bbc60c4923a4c0d8ca92c32c318974f4?s=150&d=wavatar');
  });

  it('returns an empty string when there is no email', () => {
    expect(buildDefaultAvatarUrl('')).toBe('');
    expect(buildDefaultAvatarUrl(undefined)).toBe('');
    expect(buildDefaultAvatarUrl(null)).toBe('');
  });

  // 服务端模板是 `{{ mail | md5 }}`，用的就是原始字符串，不做小写、不做 trim。
  it('hashes the raw email without normalising it', () => {
    expect(buildDefaultAvatarUrl('ABC@QQ.COM'))
      .not.toBe(buildDefaultAvatarUrl('abc@qq.com'));
  });
});

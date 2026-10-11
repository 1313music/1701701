import { describe, expect, it } from 'vitest';

import { md5 } from './md5.js';

// 期望值全部由 Python hashlib 生成后逐条核对过（不是凭记忆写的）。
describe('md5', () => {
  it('matches the RFC 1321 test vectors', () => {
    expect(md5('')).toBe('d41d8cd98f00b204e9800998ecf8427e');
    expect(md5('a')).toBe('0cc175b9c0f1b6a831c399e269772661');
    expect(md5('abc')).toBe('900150983cd24fb0d6963f7d28e17f72');
    expect(md5('message digest')).toBe('f96b697d7cb7938d525a2f31aaf161d0');
    expect(md5('abcdefghijklmnopqrstuvwxyz')).toBe('c3fcd3d76192e4007dfb496cca67e13b');
    expect(md5('The quick brown fox jumps over the lazy dog')).toBe('9e107d9d372bb6826bd81d3542a419d6');
  });

  // 55 / 56 是补位（padding）的边界：56 会多出一整个 64 字节块，最容易写错。
  it('handles the padding boundary lengths', () => {
    expect(md5('a'.repeat(55))).toBe('ef1772b6dff9a122358552954ad0df65');
    expect(md5('a'.repeat(56))).toBe('3b0c8ac703f828b04c6c197006d17218');
    expect(md5('a'.repeat(64))).toBe('014842d480b571495a4a0363793f7367');
    expect(md5('a'.repeat(1000))).toBe('cabe45dcc9ae5b66ba86600cca6b8ba8');
  });

  // 关键：这三个值必须和 Waline 服务端返回的头像 hash 完全一致，否则「恢复默认头像」会算错地址。
  it('produces the same hashes the Waline server returns for real emails', () => {
    expect(md5('3245957308@qq.com')).toBe('93d45a7fbba8098adc8c79c0ebfb531d');
    expect(md5('2573909968@qq.com')).toBe('0e04fe3a207393d710251b347fd9d3ca');
    expect(md5('qi0551686@gmail.com')).toBe('9538bd58edaad84b7e6f45d10addb9c6');
    expect(md5('bclz1701@outlook.com')).toBe('bbc60c4923a4c0d8ca92c32c318974f4');
  });

  it('encodes multi-byte input as UTF-8', () => {
    expect(md5('中文测试')).toBe('089b4943ea034acfa445d050c7913e55');
  });

  it('does not normalise case or whitespace', () => {
    expect(md5('ABC@QQ.COM')).toBe('097c2746a0a6617dfb754a6f214e9a88');
    expect(md5('  padded@x.com  ')).toBe('533508abe7016f89e5ecaf524a4aa7ea');
  });
});

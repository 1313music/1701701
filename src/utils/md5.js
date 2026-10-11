/**
 * 极简 MD5 —— **只**用来算 Gravatar/Cravatar 的头像地址，不是安全用途。
 *
 * 为什么自己写：留言板要按邮箱还原默认头像（`cravatar.cn/avatar/<md5(邮箱)>`），
 * 但项目里没有 md5 依赖，而 WebCrypto 不支持 md5。
 *
 * 为什么常数表写死：网上常见的写法是 `Math.floor(abs(sin(i+1)) * 2**32)` 现场生成，
 * 但 ECMAScript **不要求** `Math.sin` 正确舍入，不同引擎最后一位可能不同，
 * 再乘 2^32 放大后常数就会差 1，导致算出来的头像地址对不上。所以照 RFC 1321 硬编码。
 */

const SHIFT = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
];

// K[i] = floor(2^32 * abs(sin(i + 1)))，RFC 1321 标准表
const TABLE = [
  0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee,
  0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
  0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be,
  0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
  0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa,
  0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
  0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed,
  0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
  0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c,
  0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
  0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05,
  0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
  0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039,
  0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
  0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1,
  0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391
];

// 自己编码 UTF-8，避免依赖 TextEncoder（jsdom 里不一定有）。
// 服务端用的是 Node 的 crypto.update(str)，默认就是 UTF-8，所以这里必须一致。
const toUtf8Bytes = (value) => {
  const text = String(value ?? '');
  const bytes = [];

  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);

    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        const point = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        bytes.push(
          0xf0 | (point >> 18),
          0x80 | ((point >> 12) & 0x3f),
          0x80 | ((point >> 6) & 0x3f),
          0x80 | (point & 0x3f)
        );
        index += 1;
      } else {
        bytes.push(0xef, 0xbf, 0xbd);
      }
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      bytes.push(0xef, 0xbf, 0xbd);
    } else {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }

  return Uint8Array.from(bytes);
};

const leftRotate = (value, shift) => (value << shift) | (value >>> (32 - shift));

export const md5 = (input) => {
  const bytes = toUtf8Bytes(input);
  const byteLength = bytes.length;

  // 补 0x80 + 补零到 56 (mod 64) + 8 字节小端比特长度
  const padded = new Uint8Array((((byteLength + 8) >> 6) + 1) << 6);
  padded.set(bytes);
  padded[byteLength] = 0x80;

  const view = new DataView(padded.buffer);
  const bitLength = byteLength * 8;
  view.setUint32(padded.length - 8, bitLength >>> 0, true);
  view.setUint32(padded.length - 4, Math.floor(bitLength / 4294967296), true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  const words = new Uint32Array(16);

  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + index * 4, true);
    }

    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;

    for (let index = 0; index < 64; index += 1) {
      let mix;
      let wordIndex;

      if (index < 16) {
        mix = (b & c) | (~b & d);
        wordIndex = index;
      } else if (index < 32) {
        mix = (d & b) | (~d & c);
        wordIndex = (5 * index + 1) % 16;
      } else if (index < 48) {
        mix = b ^ c ^ d;
        wordIndex = (3 * index + 5) % 16;
      } else {
        mix = c ^ (b | ~d);
        wordIndex = (7 * index) % 16;
      }

      const previousD = d;
      d = c;
      c = b;
      b = (b + leftRotate((a + mix + TABLE[index] + words[wordIndex]) | 0, SHIFT[index])) | 0;
      a = previousD;
    }

    a0 = (a0 + a) | 0;
    b0 = (b0 + b) | 0;
    c0 = (c0 + c) | 0;
    d0 = (d0 + d) | 0;
  }

  const digest = new Uint8Array(16);
  const digestView = new DataView(digest.buffer);
  digestView.setUint32(0, a0 >>> 0, true);
  digestView.setUint32(4, b0 >>> 0, true);
  digestView.setUint32(8, c0 >>> 0, true);
  digestView.setUint32(12, d0 >>> 0, true);

  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

export default md5;

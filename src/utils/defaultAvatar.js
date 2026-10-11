import { md5 } from './md5.js';

/**
 * 算出「默认头像」的地址，用于留言板里的「恢复默认头像」。
 *
 * 默认头像是 **Waline 服务端**渲染出来的，本站配的模板（`GRAVATAR_STR` 环境变量）等价于：
 *
 *   https://cravatar.cn/avatar/{{ mail | md5 }}?s=150&d=wavatar
 *
 * 这里照抄一份。注意 cravatar 对 `数字@qq.com` 这类邮箱**会直接返回该 QQ 号的真实头像**，
 * 其他邮箱才回退到 `d=wavatar` 的卡通脸 —— 所以 QQ 邮箱用户"恢复默认"能拿回自己的真实头像。
 *
 * ⚠️ 如果以后改了服务器上的 `GRAVATAR_STR`，这里必须同步改，否则算出来的地址会挂。
 *    所以调用方拿到地址后**必须先试着加载一次**再决定要不要给用户用
 *    （见 `src/vendors/waline-api.js` 里的 `probeAvatarUrl`）。
 */
const DEFAULT_AVATAR_BASE_URL = 'https://cravatar.cn/avatar/';
const DEFAULT_AVATAR_QUERY = '?s=150&d=wavatar';

export const buildDefaultAvatarUrl = (email) => {
  // 服务端模板用的是**原始**邮箱字符串（`{{ mail | md5 }}`），不做小写、不做 trim，
  // 所以这里也原样取用，不能自作主张规范化，否则算出来的 hash 会对不上。
  const value = email === undefined || email === null ? '' : String(email);
  if (!value) return '';

  return `${DEFAULT_AVATAR_BASE_URL}${md5(value)}${DEFAULT_AVATAR_QUERY}`;
};

export default buildDefaultAvatarUrl;

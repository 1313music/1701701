/**
 * 留言板「个人设置」里可选的一排预设头像。
 *
 * 图片来源：图库（`imgs.1701701.xyz`）的 XKK 分组 —— 李志专辑插画，原本是 1400~1536 的方图。
 * 已经统一压成 160x160 的 jpg 放在 `public/avatars/`，单张 4~10KB、全部加起来约 128KB，
 * 所以可以在弹窗里一次性铺开显示，不会拖慢留言区。
 *
 * 想换图：
 *  - 只换其中几张 → 直接替换 `public/avatars/` 下的同名文件（保持文件名不变，代码不用动）。
 *  - 增删数量 → 改下面这个数组即可，顺序就是显示顺序。
 */
const AVATAR_PUBLIC_BASE_URL = 'https://1701701.xyz';

const PRESET_AVATAR_FILES = [
  'xkk-01.jpg',
  'xkk-02.jpg',
  'xkk-03.jpg',
  'xkk-04.jpg',
  'xkk-05.jpg',
  'xkk-06.jpg',
  'xkk-07.jpg',
  'xkk-08.jpg',
  'xkk-09.jpg',
  'xkk-10.jpg',
  'xkk-11.jpg',
  'xkk-12.jpg',
  'xkk-13.jpg',
  'xkk-14.jpg',
  'xkk-15.jpg',
  'xkk-16.jpg',
  'xkk-17.jpg',
  'xkk-18.jpg',
  'xkk-19.jpg',
  'xkk-20.jpg',
  'xkk-21.jpg'
];

export const PRESET_AVATARS = Object.freeze(
  PRESET_AVATAR_FILES.map((file, index) => {
    const label = `预设头像 ${index + 1}`;
    return Object.freeze({
      id: file.replace(/\.jpg$/u, ''),
      label,
      // 存进 Waline 的必须是绝对地址：它会出现在别人页面的 <img src> 里，
      // 也会出现在 Waline 后台（域名不同），相对路径会挂掉。
      url: `${AVATAR_PUBLIC_BASE_URL}/avatars/${file}`
    });
  })
);

export const isPresetAvatarUrl = (value) => {
  const url = String(value || '').trim();
  return Boolean(url) && PRESET_AVATARS.some((preset) => preset.url === url);
};

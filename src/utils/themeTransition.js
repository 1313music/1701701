/**
 * 主题切换的「斜向扫掠」过渡。
 *
 * 做法分两层：
 *  1. 页面 —— 用 View Transitions API 把切换前后的页面各拍一张快照，然后用 clip-path
 *     在新快照上按 30° 斜条纹一格格揭开，形成从点击处向外扫开的效果。
 *  2. 图标 —— 纯 CSS 过渡（见 styles/base.css 的 .theme-icon-stack），不在这里管。
 *
 * 浏览器不支持 View Transitions、或用户开了「减少动态效果」时，直接瞬间切换，
 * 行为跟改造之前完全一致。
 */

/** 扫掠总时长（毫秒）。与图标旋转时长（0.72s）大致对齐。 */
export const THEME_WIPE_DURATION = 820;

/** 扫掠分成多少帧关键帧。帧越多越顺滑，16 帧实测已经看不出台阶。 */
const WIPE_STEPS = 16;

/** 每条斜条纹的宽度（像素）。越小条纹越密。 */
const BAND_WIDTH = 110;

/** 扫掠方向与水平线的夹角：30°。 */
const COS30 = Math.cos(Math.PI / 6);

const isBrowser = () => typeof window !== 'undefined' && typeof document !== 'undefined';

/** 用户是否开启了「减少动态效果」。 */
export const prefersReducedMotion = () => {
  if (!isBrowser() || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/** 当前浏览器是否支持 View Transitions API。 */
export const supportsViewTransition = () =>
  isBrowser() && typeof document.startViewTransition === 'function';

/** 是否该走扫掠动画。 */
export const shouldAnimateThemeWipe = () => supportsViewTransition() && !prefersReducedMotion();

/**
 * 生成一串 clip-path 关键帧，模拟「斜向车道」逐条扫过。
 *
 * 原理：把屏幕沿 30° 方向切成若干条平行条纹，离点击点越近的条纹越早开始揭开。
 * 每条条纹揭开时两端先探出、再撑满，所以看起来像一道道斜光扫过去。
 *
 * @param {number} originX 扫掠起点 X（通常是主题按钮的中心）
 * @param {number} originY 扫掠起点 Y
 * @param {number} width   视口宽度
 * @param {number} height  视口高度
 * @returns {string[]} clip-path 关键帧数组，可直接交给 Element.animate()
 */
export const buildThemeWipeFrames = (originX, originY, width, height) => {
  const span = width * 0.5 + height * COS30;
  const bands = Math.max(6, Math.round(span / BAND_WIDTH));
  const pitch = span / bands;
  const from = -height * 0.5 - 2;
  const to = width * COS30 + 2;

  // 起点落在哪一条条纹上：后面的条纹依次延后揭开，形成"扫"的感觉
  const origin = Math.floor((originX * 0.5 + originY * COS30) / pitch);
  const lag = 0.5 / Math.max(origin, bands - 1 - origin, 1);

  // 把「沿 30° 轴的位置」换算回屏幕坐标
  const at = (across, along) =>
    `${(across * 0.5 + along * COS30).toFixed(1)}px ${(across * COS30 - along * 0.5).toFixed(1)}px`;

  const frames = [];
  for (let frame = 0; frame <= WIPE_STEPS; frame += 1) {
    const points = [];
    for (let band = 0; band < bands; band += 1) {
      const local = Math.min(
        Math.max((frame / WIPE_STEPS - Math.abs(band - origin) * lag) * 2, 0),
        1
      );
      const half = (pitch / 2 + 1) * (1 - (1 - local) ** 3);
      const middle = (band + 0.5) * pitch;
      points.push(
        at(middle - half, from),
        at(middle - half, to),
        at(middle + half, to),
        at(middle + half, from)
      );
    }
    frames.push(`polygon(${points.join(', ')})`);
  }
  return frames;
};

/**
 * 执行一次带扫掠的主题切换。
 *
 * @param {object}   options
 * @param {number}   [options.originX] 扫掠起点 X，缺省用视口水平中点
 * @param {number}   [options.originY] 扫掠起点 Y，缺省用视口顶部
 * @param {Function} options.applyTheme 真正把新主题写到 DOM 上的函数。
 *        必须在里面同步完成改动，否则快照会拍不到新主题。
 * @returns {ViewTransition|null} 走动画时返回 transition 对象，否则返回 null
 */
export const runThemeWipe = ({ originX, originY, applyTheme }) => {
  if (!shouldAnimateThemeWipe()) {
    applyTheme();
    return null;
  }

  const frames = buildThemeWipeFrames(
    Number.isFinite(originX) ? originX : window.innerWidth / 2,
    Number.isFinite(originY) ? originY : 0,
    window.innerWidth,
    window.innerHeight
  );

  const transition = document.startViewTransition(applyTheme);

  transition.ready
    .then(() => {
      try {
        document.documentElement.animate(
          { clipPath: frames },
          {
            duration: THEME_WIPE_DURATION,
            easing: 'linear',
            pseudoElement: '::view-transition-new(root)'
          }
        );
      } catch {
        // 万一浏览器不认 pseudoElement，宁可不动画，也不要让 clip-path 落到根元素上
      }
    })
    .catch(() => {
      // 过渡被浏览器跳过时 ready 会 reject，属于正常情况，不需要处理
    });

  return transition;
};

/**
 * 「斜向扫掠」过渡 —— 主题切换和页面切换共用同一套。
 *
 * 做法分两层：
 *  1. 页面 —— 用 View Transitions API 把切换前后各拍一张快照，再用 clip-path
 *     在新快照上按 30° 斜条纹、从指定位置逐条揭开。
 *  2. 图标 —— 纯 CSS 过渡（见 styles/base.css 的 .theme-icon-stack），不在这里管。
 *
 * 浏览器不支持 View Transitions、或用户开了「减少动态效果」时，直接瞬间切换，
 * 行为跟没做这个效果时完全一致。
 */

/**
 * 扫掠总时长（毫秒）。主题切换和页面切换共用同一个值，观感才一致。
 * 820 是照抄原站 FlClash 的数值。
 *
 * ⚠️ 扫掠期间整页被快照盖住、点不动（见 styles/base.css 的说明），
 * 所以这个值同时也是「输入锁死时长」，调大之前先想清楚。
 */
export const LANE_WIPE_DURATION = 820;

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
export const shouldAnimateWipe = () => supportsViewTransition() && !prefersReducedMotion();

/**
 * 生成一串 clip-path 关键帧，模拟「斜向车道」逐条扫过。
 *
 * 原理：把屏幕沿 30° 方向切成若干条平行条纹，离起点越近的条纹越早开始揭开。
 * 每条条纹揭开时两端先探出、再撑满，所以看起来像一道道斜光扫过去。
 *
 * @param {number} originX 扫掠起点 X（通常是按钮中心）
 * @param {number} originY 扫掠起点 Y
 * @param {number} width   视口宽度
 * @param {number} height  视口高度
 * @returns {string[]} clip-path 关键帧数组，可直接交给 Element.animate()
 */
export const buildLaneWipeFrames = (originX, originY, width, height) => {
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
 * 执行一次带扫掠的切换。
 *
 * @param {object}   options
 * @param {number}   [options.originX] 扫掠起点 X，缺省用视口水平中点
 * @param {number}   [options.originY] 扫掠起点 Y，缺省用视口顶部
 * @param {number}   [options.duration] 扫掠时长，缺省用 LANE_WIPE_DURATION
 * @param {Function} options.applyChange 真正把新状态写到 DOM 上的函数。
 *        必须在里面同步完成改动，否则快照会拍不到新状态。
 * @returns {ViewTransition|null} 走动画时返回 transition 对象，否则返回 null
 */
export const runLaneWipe = ({
  originX,
  originY,
  duration = LANE_WIPE_DURATION,
  applyChange
}) => {
  if (!shouldAnimateWipe()) {
    applyChange();
    return null;
  }

  const frames = buildLaneWipeFrames(
    Number.isFinite(originX) ? originX : window.innerWidth / 2,
    Number.isFinite(originY) ? originY : 0,
    window.innerWidth,
    window.innerHeight
  );

  const transition = document.startViewTransition(applyChange);

  transition.ready
    .then(() => {
      try {
        document.documentElement.animate(
          { clipPath: frames },
          {
            duration,
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

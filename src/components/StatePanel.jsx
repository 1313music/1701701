import React from 'react';
import { AlertCircle, Inbox } from 'lucide-react';
import '../styles/state-panel.css';

/**
 * 全站统一的状态面板：加载中 / 空 / 出错，三种状态共用一套长相。
 *
 * 为什么要有它：以前「这里没内容」「加载失败」是每个页面各写一套
 * （video-empty / archive-empty / gallery-empty-state / comment-section-empty /
 * admin-empty …），圆角、边框、底色、字号全不一样。统一到这里之后，
 * 页面只负责传文案，不再自己写状态样式。
 *
 * variant:
 *   loading —— 转圈 + 文案（用于没有内容骨架的页面）
 *   empty   —— 默认图标 + 文案
 *   error   —— 警示图标 + 文案 + 可选重试按钮
 *
 * 注意：站点是黑白灰调性，error 态**刻意不用红色**，靠图标和文案区分，
 * 避免在统一的过程中又引入一个新的颜色语言。
 */
const DEFAULT_ICONS = {
  empty: Inbox,
  error: AlertCircle
};

const StatePanel = ({
  variant = 'empty',
  icon,
  title,
  description,
  action,
  compact = false,
  className = '',
  ...rest
}) => {
  const isLoading = variant === 'loading';
  const Icon = icon || DEFAULT_ICONS[variant] || Inbox;

  const classes = ['state-panel', `is-${variant}`];
  if (compact) classes.push('is-compact');
  if (className) classes.push(className);

  return (
    <div
      className={classes.join(' ')}
      role={isLoading ? 'status' : undefined}
      aria-live={isLoading ? 'polite' : undefined}
      {...rest}
    >
      {isLoading ? (
        <span className="state-panel-ring" aria-hidden="true" />
      ) : (
        <Icon
          size={24}
          strokeWidth={2.2}
          absoluteStrokeWidth
          className="state-panel-icon"
          aria-hidden="true"
        />
      )}
      {title ? <p className="state-panel-title">{title}</p> : null}
      {description ? <p className="state-panel-desc">{description}</p> : null}
      {action ? <div className="state-panel-action">{action}</div> : null}
    </div>
  );
};

export default StatePanel;

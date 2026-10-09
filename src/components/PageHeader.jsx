import React from 'react';
import { Share2 } from 'lucide-react';
import '../styles/page-hero.css';

/**
 * 全站统一的页面标题区。
 *
 * 结构固定为「kicker → 标题 → 副标题」+ 右侧动作，
 * 所有尺寸来自 base.css 的 --page-* token，页面不应再自己写标题字号。
 *
 * variant:
 *   card  —— 带边框与背景的卡片（默认，内容型页面用）
 *   plain —— 无边框无背景（sticky 工具栏、媒体型页面用）
 *
 * onShare: 传入即渲染一个"复制本页链接"的分享按钮（统一图标、统一交互），
 *          与 actions 并存时排在 actions 之后（页头最右侧）。
 */
const PageHeader = ({
    title,
    subtitle,
    kicker,
    actions,
    onShare,
    shareLabel = '分享本页',
    titleId,
    tint = false,
    variant = 'card',
    className = ''
}) => {
    const classes = ['page-hero', `page-hero-${variant}`];
    if (tint) classes.push('is-tinted');
    if (className) classes.push(className);

    const hasShare = typeof onShare === 'function';
    const hasActions = Boolean(actions) || hasShare;

    return (
        <header className={classes.join(' ')}>
            <div className="page-hero-copy">
                {kicker ? <p className="page-hero-kicker">{kicker}</p> : null}
                {title ? <h1 className="page-hero-title" id={titleId}>{title}</h1> : null}
                {subtitle ? <p className="page-hero-subtitle">{subtitle}</p> : null}
            </div>
            {hasActions ? (
                <div className="page-hero-actions">
                    {actions}
                    {hasShare ? (
                        <button
                            type="button"
                            className="page-hero-share"
                            onClick={(event) => onShare({ anchorEvent: { currentTarget: event.currentTarget } })}
                            aria-label={shareLabel}
                            title={shareLabel}
                        >
                            <Share2 size={18} strokeWidth={2.2} absoluteStrokeWidth />
                        </button>
                    ) : null}
                </div>
            ) : null}
        </header>
    );
};

export default PageHeader;

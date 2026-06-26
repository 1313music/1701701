import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download as DownloadIcon, ExternalLink, Share2 } from 'lucide-react';

import { getDownloadPreviewPath } from '../utils/appShellConfig.js';
import { copyTextToClipboard } from '../utils/appDomUtils.js';
import { SITE_URL } from '../utils/seoConfig.js';
import {
    fetchAndTriggerDownload,
    resolvePreviewHref,
    triggerDownloadWithFallback
} from '../utils/downloadPreviewUtils.js';

const PREVIEW_LOADING_HINT = '预览加载较慢时，可直接打开原件。';
const SHARE_STATUS_RESET_MS = 1600;

const formatDisplayTitle = (title) => {
    const rawTitle = String(title || '').trim();
    const titleMatch = rawTitle.match(/^《([^》]+)》(.*)$/);
    if (!titleMatch) return rawTitle;

    const suffix = titleMatch[2].trim();
    return suffix ? `${titleMatch[1]} ${suffix}` : titleMatch[1];
};

const useDownloadAction = (item) => {
    const [status, setStatus] = useState('idle');
    const timerRef = useRef(null);

    useEffect(() => () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
    }, []);

    const resetLater = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            setStatus('idle');
        }, 2000);
    };

    const handleDownload = async () => {
        if (status === 'loading') return;
        if (!item?.url) return;
        setStatus('loading');
        const fileName = item.filename || item.title || 'download';
        try {
            await fetchAndTriggerDownload(item.url, fileName);
            setStatus('done');
            resetLater();
        } catch {
            try {
                triggerDownloadWithFallback(item.url, fileName);
                setStatus('done');
                resetLater();
            } catch {
                setStatus('error');
                resetLater();
            }
        }
    };

    const label = useMemo(() => {
        if (status === 'loading') return '下载中...';
        if (status === 'done') return '下载完成';
        if (status === 'error') return '下载失败';
        return '下载';
    }, [status]);

    return {
        status,
        label,
        handleDownload
    };
};

const getOriginalAction = (item) => {
    const href = String(item?.sourceUrl || '').trim();
    if (!href) return null;
    return {
        href,
        label: String(item?.actionLabel || '').trim() || '原文'
    };
};

export const DownloadItem = ({ item, forcePreview = false, getPreviewPath = getDownloadPreviewPath }) => {
    const previewHref = resolvePreviewHref(item, forcePreview, getPreviewPath);
    const originalAction = getOriginalAction(item);
    const { status, label, handleDownload } = useDownloadAction(item);
    const displayTitle = formatDisplayTitle(item.title);

    return (
        <div className="download-item-row">
            <div className="download-item-title">{displayTitle}</div>
            <div className="download-item-actions">
                {previewHref && (
                    <a
                        className="download-action"
                        href={previewHref}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        预览
                    </a>
                )}
                {originalAction ? (
                    <a
                        className="download-action"
                        href={originalAction.href}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {originalAction.label}
                    </a>
                ) : (
                    <button
                        type="button"
                        className={`download-action ${status}`}
                        onClick={handleDownload}
                        disabled={status === 'loading'}
                    >
                        {label}
                    </button>
                )}
            </div>
        </div>
    );
};

export const DownloadPreviewPage = ({
    item,
    previewSrc
}) => {
    const originalAction = getOriginalAction(item);
    const { status, label, handleDownload } = useDownloadAction(item);
    const [isFrameLoading, setIsFrameLoading] = useState(true);
    const [shareStatus, setShareStatus] = useState('idle');
    const shareStatusTimerRef = useRef(null);
    const displayTitle = formatDisplayTitle(item.title);

    useEffect(() => () => {
        if (shareStatusTimerRef.current) {
            clearTimeout(shareStatusTimerRef.current);
        }
    }, []);

    const resetShareStatusLater = () => {
        if (shareStatusTimerRef.current) clearTimeout(shareStatusTimerRef.current);
        shareStatusTimerRef.current = setTimeout(() => {
            shareStatusTimerRef.current = null;
            setShareStatus('idle');
        }, SHARE_STATUS_RESET_MS);
    };

    const getPreviewShareUrl = () => {
        if (typeof window === 'undefined') return '';
        return new URL(
            `${window.location.pathname}${window.location.search}${window.location.hash}`,
            SITE_URL
        ).toString();
    };

    const handleCopyPreviewLink = async () => {
        if (shareStatus === 'loading') return;
        const shareUrl = getPreviewShareUrl();
        if (!shareUrl) return;
        setShareStatus('loading');
        const copied = await copyTextToClipboard(shareUrl);
        setShareStatus(copied ? 'copied' : 'error');
        resetShareStatusLater();
    };

    const shareLabel = useMemo(() => {
        if (shareStatus === 'loading') return '复制中...';
        if (shareStatus === 'copied') return '已复制';
        if (shareStatus === 'error') return '复制失败';
        return '分享';
    }, [shareStatus]);

    return (
        <section className="download-preview-page-shell" aria-label="文档预览页">
            <div className="download-preview-header">
                <div className="download-preview-heading">
                    <span className="download-preview-eyebrow">Preview</span>
                    <h1>{displayTitle}</h1>
                </div>

                <div className="download-preview-toolbar">
                    <div className="download-preview-toolbar-actions">
                        <a
                            className="download-preview-link"
                            href={previewSrc}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <ExternalLink size={15} strokeWidth={2.2} absoluteStrokeWidth />
                            打开原件
                        </a>
                        {originalAction ? (
                            <a
                                className="download-action"
                                href={originalAction.href}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <ExternalLink size={15} strokeWidth={2.2} absoluteStrokeWidth />
                                {originalAction.label}
                            </a>
                        ) : (
                            <button
                                type="button"
                                className={`download-action ${status}`}
                                onClick={handleDownload}
                                disabled={status === 'loading'}
                            >
                                <DownloadIcon size={15} strokeWidth={2.2} absoluteStrokeWidth />
                                {label}
                            </button>
                        )}
                        <button
                            type="button"
                            className={`download-preview-link download-preview-share ${shareStatus}`}
                            onClick={handleCopyPreviewLink}
                            disabled={shareStatus === 'loading'}
                            aria-label="复制预览链接"
                            title="复制预览链接"
                        >
                            <Share2 size={15} strokeWidth={2.2} absoluteStrokeWidth />
                            {shareLabel}
                        </button>
                    </div>
                </div>
            </div>

            {isFrameLoading && (
                <div className="download-preview-notice" role="status" aria-live="polite">
                    <span className="page-loading-ring" aria-hidden="true" />
                    <p>{PREVIEW_LOADING_HINT}</p>
                </div>
            )}

            <div className="download-preview-frame-shell">
                {isFrameLoading && (
                    <div className="download-preview-frame-loading" aria-hidden="true">
                        <span className="page-loading-ring" />
                        <span>预览加载中，请稍等…</span>
                    </div>
                )}
                <iframe
                    className="download-preview-frame"
                    src={previewSrc}
                    title={`${displayTitle} 文档预览`}
                    loading="lazy"
                    onLoad={() => setIsFrameLoading(false)}
                />
            </div>
        </section>
    );
};

export const DownloadGroup = ({
    group,
    defaultOpen = false,
    forcePreview = false,
    getPreviewPath = getDownloadPreviewPath
}) => {
    const [open, setOpen] = useState(Boolean(defaultOpen));

    return (
        <div className={`download-group ${open ? 'open' : ''}`}>
            <button
                type="button"
                className="download-group-header"
                onClick={() => setOpen((prev) => !prev)}
                aria-expanded={open}
            >
                <span>{group.title}</span>
                <span className="download-group-arrow">›</span>
            </button>
            <div className="download-group-panel" aria-hidden={!open}>
                <div className="download-group-body">
                    {group.items.map((item) => (
                        <DownloadItem
                            key={`${item.title}-${item.url}`}
                            item={item}
                            forcePreview={forcePreview}
                            getPreviewPath={getPreviewPath}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

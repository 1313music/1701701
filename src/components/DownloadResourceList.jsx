import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ExternalLink } from 'lucide-react';

import { getDownloadPreviewPath, getPathForView } from '../utils/appShellConfig.js';
import {
    fetchAndTriggerDownload,
    resolvePreviewHref,
    triggerDownloadWithFallback
} from '../utils/downloadPreviewUtils.js';

const PREVIEW_LOADING_HINT = '文档较大，首次加载可能需要 5 到 20 秒。若长时间空白，可尝试右上角“新窗口打开”。';

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

export const DownloadItem = ({ item, forcePreview = false, getPreviewPath = getDownloadPreviewPath }) => {
    const previewHref = resolvePreviewHref(item, forcePreview, getPreviewPath);
    const { status, label, handleDownload } = useDownloadAction(item);

    return (
        <div className="download-item-row">
            <div className="download-item-title">{item.title}</div>
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
                <button
                    type="button"
                    className={`download-action ${status}`}
                    onClick={handleDownload}
                    disabled={status === 'loading'}
                >
                    {label}
                </button>
            </div>
        </div>
    );
};

export const DownloadPreviewPage = ({
    item,
    previewSrc,
    backHref = getPathForView('download'),
    backLabel = '返回下载页'
}) => {
    const { status, label, handleDownload } = useDownloadAction(item);
    const [isFrameLoading, setIsFrameLoading] = useState(true);

    return (
        <section className="download-preview-page-shell" aria-label="文档预览页">
            <div className="download-preview-toolbar">
                <a className="download-preview-back" href={backHref}>
                    <ArrowLeft size={16} strokeWidth={2.2} absoluteStrokeWidth />
                    {backLabel}
                </a>
                <div className="download-preview-toolbar-actions">
                    <a
                        className="download-preview-link"
                        href={previewSrc}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <ExternalLink size={15} strokeWidth={2.2} absoluteStrokeWidth />
                        新窗口打开
                    </a>
                    <button
                        type="button"
                        className={`download-action ${status}`}
                        onClick={handleDownload}
                        disabled={status === 'loading'}
                    >
                        {label}
                    </button>
                </div>
            </div>

            <div className="download-preview-heading">
                <span className="download-preview-eyebrow">Preview</span>
                <h1>{item.title}</h1>
                <p>{item.filename || 'PDF 文档'}</p>
            </div>

            <div
                className={`download-preview-notice ${isFrameLoading ? 'is-loading' : ''}`}
                role="status"
                aria-live="polite"
            >
                {isFrameLoading && <span className="page-loading-ring" aria-hidden="true" />}
                <p>{PREVIEW_LOADING_HINT}</p>
            </div>

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
                    title={`${item.title} 文档预览`}
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

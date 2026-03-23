import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Share2, BookOpen, ArrowLeft, ExternalLink } from 'lucide-react';
import '../styles/download.css';
import { loadDownloadSections } from '../data/downloadManifest';
import {
    getDownloadPreviewPath,
    getDownloadPreviewSlugFromPathname,
    getPathForView
} from '../utils/appShellConfig.js';

const PDF_PREVIEW_VIEWER_BASE = 'https://mozilla.github.io/pdf.js/web/viewer.html';
const PDF_PREVIEW_VIEWER = `${PDF_PREVIEW_VIEWER_BASE}?file=`;
const OBJECT_URL_REVOKE_DELAY_MS = 30000;
const PREVIEW_LOADING_HINT = '文档较大，首次加载可能需要 5 到 20 秒。若长时间空白，可尝试右上角“新窗口打开”。';

const getPreviewIdentifier = (item) => {
    const filename = String(item?.filename || '').trim().replace(/\.pdf$/i, '');
    if (filename) return filename;
    return String(item?.title || '').trim();
};

const isPdfResource = (item) => {
    const filename = String(item?.filename || '').toLowerCase();
    const title = String(item?.title || '').toLowerCase();
    const rawUrl = String(item?.url || '').toLowerCase();
    const urlWithoutQuery = rawUrl.split('?')[0];
    return (
        filename.endsWith('.pdf') ||
        title.endsWith('.pdf') ||
        urlWithoutQuery.endsWith('.pdf')
    );
};

const resolvePreviewSource = (item, forcePreview = false) => {
    if (item?.previewUrl) return item.previewUrl;
    if (!forcePreview || !item?.url) return '';
    if (isPdfResource(item)) {
        return `${PDF_PREVIEW_VIEWER}${encodeURIComponent(item.url)}`;
    }
    return item.url;
};

const resolvePreviewHref = (item, forcePreview = false) => {
    const previewSource = resolvePreviewSource(item, forcePreview);
    if (!previewSource) return '';
    const previewIdentifier = getPreviewIdentifier(item);
    if (!previewIdentifier) return previewSource;
    return getDownloadPreviewPath(previewIdentifier);
};

const triggerDownload = (url, filename) => {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener noreferrer';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
};

const fetchAndTriggerDownload = async (url, filename) => {
    const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!response.ok) {
        throw new Error(`download request failed with ${response.status}`);
    }
    const blob = await response.blob();
    if (!blob.size) {
        throw new Error('downloaded blob is empty');
    }
    const objectUrl = window.URL.createObjectURL(blob);
    triggerDownload(objectUrl, filename);
    window.setTimeout(() => {
        window.URL.revokeObjectURL(objectUrl);
    }, OBJECT_URL_REVOKE_DELAY_MS);
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
                triggerDownload(item.url, fileName);
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

const DownloadItem = ({ item, forcePreview = false }) => {
    const previewHref = resolvePreviewHref(item, forcePreview);
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

const findPreviewItemBySlug = (sections, previewSlug) => {
    if (!previewSlug) return null;
    for (const section of sections) {
        for (const group of section.groups) {
            for (const item of group.items) {
                if (getPreviewIdentifier(item) !== previewSlug) continue;
                const previewSrc = resolvePreviewSource(item, true);
                if (!previewSrc) continue;
                return {
                    item,
                    previewSrc
                };
            }
        }
    }
    return null;
};

const DownloadPreviewPage = ({ item, previewSrc }) => {
    const { status, label, handleDownload } = useDownloadAction(item);
    const [isFrameLoading, setIsFrameLoading] = useState(true);

    return (
        <section className="download-preview-page-shell" aria-label="文档预览页">
            <div className="download-preview-toolbar">
                <a className="download-preview-back" href={getPathForView('download')}>
                    <ArrowLeft size={16} strokeWidth={2.2} absoluteStrokeWidth />
                    返回下载页
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

const DownloadGroup = ({ group, defaultOpen = false, forcePreview = false }) => {
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
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

const DownloadPage = ({ onCopyPageLink, onInitialReady }) => {
    const [downloadSections, setDownloadSections] = useState([]);
    const [isSectionsLoading, setIsSectionsLoading] = useState(true);
    const [sectionsLoadError, setSectionsLoadError] = useState('');
    const [sectionsRetryKey, setSectionsRetryKey] = useState(0);
    const previewSlug = typeof window === 'undefined'
        ? ''
        : getDownloadPreviewSlugFromPathname(window.location.pathname);

    useEffect(() => {
        let canceled = false;
        const loadSections = async () => {
            setIsSectionsLoading(true);
            setSectionsLoadError('');
            try {
                const sections = await loadDownloadSections();
                if (canceled) return;
                setDownloadSections(Array.isArray(sections) ? sections : []);
            } catch (error) {
                if (canceled) return;
                setDownloadSections([]);
                setSectionsLoadError(error?.message || '下载清单加载失败');
            } finally {
                if (!canceled) {
                    setIsSectionsLoading(false);
                }
            }
        };
        void loadSections();
        return () => {
            canceled = true;
        };
    }, [sectionsRetryKey]);
    useEffect(() => {
        if (!isSectionsLoading && typeof onInitialReady === 'function') {
            onInitialReady();
        }
    }, [isSectionsLoading, onInitialReady]);
    useEffect(() => {
        if (typeof window === 'undefined' || typeof fetch !== 'function') return;
        const warmupTimer = window.setTimeout(() => {
            fetch(PDF_PREVIEW_VIEWER_BASE, { cache: 'force-cache' }).catch(() => {
                // no-op
            });
        }, 80);
        return () => {
            window.clearTimeout(warmupTimer);
        };
    }, []);

    const sectionStats = useMemo(() => {
        const map = new Map();
        downloadSections.forEach((section) => {
            const count = section.groups.reduce(
                (sum, group) => sum + group.items.length,
                0
            );
            map.set(section.title, count);
        });
        return map;
    }, [downloadSections]);

    const handleRetrySections = () => {
        setSectionsRetryKey((value) => value + 1);
    };
    const handleCopyPageLink = (event) => {
        if (typeof onCopyPageLink !== 'function') return;
        onCopyPageLink({
            placement: 'bottom',
            anchorEvent: { currentTarget: event.currentTarget }
        });
    };
    const shouldDefaultOpenGroup = (sectionTitle, groupTitle) => (
        sectionTitle === '其他资源' && groupTitle === '资源下载'
    );
    const shouldForcePreviewGroup = (sectionTitle, groupTitle) => (
        sectionTitle === '其他资源' && groupTitle === '资源下载'
    );
    const previewEntry = useMemo(
        () => findPreviewItemBySlug(downloadSections, previewSlug),
        [downloadSections, previewSlug]
    );

    if (previewSlug) {
        return (
            <div className="download-page download-v2 download-preview-route">
                {isSectionsLoading && (
                    <div className="page-loading page-loading-spinner" role="status" aria-live="polite">
                        <span className="page-loading-ring" aria-hidden="true" />
                        <span>加载中...</span>
                    </div>
                )}

                {!isSectionsLoading && sectionsLoadError && (
                    <section className="download-section-block">
                        <div className="download-section-header">
                            <h3>加载失败</h3>
                        </div>
                        <div className="download-groups">
                            <div className="download-group open">
                                <div className="download-group-body">
                                    <p>{sectionsLoadError}</p>
                                    <div className="download-preview-error-actions">
                                        <a className="download-preview-back" href={getPathForView('download')}>
                                            <ArrowLeft size={16} strokeWidth={2.2} absoluteStrokeWidth />
                                            返回下载页
                                        </a>
                                        <button
                                            type="button"
                                            className="download-action"
                                            onClick={handleRetrySections}
                                        >
                                            重试加载
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {!isSectionsLoading && !sectionsLoadError && previewEntry && (
                    <DownloadPreviewPage
                        key={previewEntry.previewSrc}
                        item={previewEntry.item}
                        previewSrc={previewEntry.previewSrc}
                    />
                )}

                {!isSectionsLoading && !sectionsLoadError && !previewEntry && (
                    <section className="download-section-block">
                        <div className="download-section-header">
                            <h3>未找到该预览</h3>
                        </div>
                        <div className="download-groups">
                            <div className="download-group open">
                                <div className="download-group-body">
                                    <p>当前链接对应的资源不存在，或暂不支持站内预览。</p>
                                    <div className="download-preview-error-actions">
                                        <a className="download-preview-back" href={getPathForView('download')}>
                                            <ArrowLeft size={16} strokeWidth={2.2} absoluteStrokeWidth />
                                            返回下载页
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                )}
            </div>
        );
    }

    return (
        <div className="download-page download-v2">
            <section className="download-priority-note" aria-label="下载说明">
                <p>本页只提供小程序暂未收录歌曲的下载，更多专辑与歌曲，请在下方小程序内搜索获取。</p>
            </section>

            <section className="download-intro">
                <div className="download-intro-top">
                    <div className="download-intro-media">
                        <img loading="lazy" src="https://p1.music.126.net/h1WFXzKQ6qpjB1STRsD5Qg==/109951172851448634.jpg" alt="SongSharing 小程序二维码" />
                    </div>
                </div>
                <div className="download-intro-body">
                    <div className="download-intro-brand">
                        <h2>SongSharing</h2>
                        <p>小程序</p>
                    </div>
                    <div className="download-intro-title">海量曲库 · 智能搜索 · 一键上传</div>
                    <p className="download-intro-tip">一个帮你一键上传歌曲到网易云音乐云盘的小工具。</p>
                    <div className="download-intro-actions">
                        <a
                            className="download-intro-link"
                            href="https://mp.weixin.qq.com/s/pHsFSPTn3Cd7MXV81J4NHg"
                            target="_blank"
                            rel="noreferrer"
                        >
                            <BookOpen size={15} strokeWidth={2.2} absoluteStrokeWidth />
                            使用指南
                        </a>
                        {typeof onCopyPageLink === 'function' && (
                            <button
                                type="button"
                                className="download-intro-link download-intro-page-share"
                                onClick={handleCopyPageLink}
                                aria-label="分享下载页"
                            >
                                <Share2 size={15} strokeWidth={2.2} absoluteStrokeWidth />
                                分享本页
                            </button>
                        )}
                    </div>
                </div>
            </section>

            {isSectionsLoading && (
                <div className="page-loading page-loading-spinner" role="status" aria-live="polite">
                    <span className="page-loading-ring" aria-hidden="true" />
                    <span>加载中...</span>
                </div>
            )}

            {!isSectionsLoading && sectionsLoadError && (
                <section className="download-section-block">
                    <div className="download-section-header">
                        <h3>加载失败</h3>
                    </div>
                    <div className="download-groups">
                        <div className="download-group">
                            <div className="download-group-body">
                                <p>{sectionsLoadError}</p>
                                <button
                                    type="button"
                                    className="download-action"
                                    onClick={handleRetrySections}
                                >
                                    重试加载
                                </button>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {!isSectionsLoading && !sectionsLoadError && downloadSections.map((section) => {
                const isCenteredHeader = [
                    "叁缺壹吉隆坡站",
                    "叁缺壹东京站",
                    "其他歌曲",
                    "其他资源",
                ].includes(section.title);
                const countUnit = section.title === '其他资源' ? '个' : '首';
                return (
                <section key={section.title} className="download-section-block">
                    <div
                        className={
                            isCenteredHeader
                                ? "download-section-header download-section-header--centered"
                                : "download-section-header"
                        }
                    >
                        <h3>{section.title}</h3>
                        <span className="download-section-count">
                            {sectionStats.get(section.title)} {countUnit}
                        </span>
                    </div>
                    <div className="download-groups">
                        {section.groups.map((group) => (
                            <DownloadGroup
                                key={group.title}
                                group={group}
                                defaultOpen={shouldDefaultOpenGroup(section.title, group.title)}
                                forcePreview={shouldForcePreviewGroup(section.title, group.title)}
                            />
                        ))}
                    </div>
                </section>
                );
            })}
        </div>
    );
};

export default DownloadPage;

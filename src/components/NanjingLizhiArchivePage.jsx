import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Archive,
    RefreshCcw
} from 'lucide-react';
import {
    DEFAULT_ARCHIVE_FEATURE_CONFIG,
    loadArchiveFeatureConfig
} from '../data/archiveFeatureConfig.js';
import '../styles/archive.css';

const ALL_ARCHIVE_SOURCES = [
    {
        id: 'nanjinglizhi',
        label: 'nanjinglizhi.cn',
        manifestUrl: '/archives/nanjinglizhi/manifest.json'
    },
    {
        id: 'lizhizhuangbi',
        label: 'lizhizhuangbi.com',
        manifestUrl: '/archives/lizhizhuangbi/manifest.json'
    },
    {
        id: 'lizhizhuangbi-blog',
        label: 'lizhizhuangbi.com/blog',
        manifestUrl: '/archives/lizhizhuangbi-blog/manifest.json',
        requiresBlogArchiveFlag: true
    }
];
const getArchiveSources = (showBlogArchive) => ALL_ARCHIVE_SOURCES.filter((source) => (
    !source.requiresBlogArchiveFlag || showBlogArchive
));
const DEFAULT_ARCHIVE_SOURCE = ALL_ARCHIVE_SOURCES[0];
const DEFAULT_FRAME_WIDTH = 980;
const DEFAULT_FRAME_HEIGHT = 720;

const formatDateLabel = (snapshot) => (
    snapshot?.capturedAt ? snapshot.capturedAt.slice(0, 10) : snapshot?.label || ''
);

const formatTimelineLabel = (snapshot, snapshotCount) => {
    const dateLabel = formatDateLabel(snapshot);
    if (snapshotCount > 20) {
        const [year = '', month = '', day = ''] = dateLabel.split('-');
        return `${year.slice(2)}.${Number(month)}.${Number(day)}`;
    }
    return dateLabel.replaceAll('-', '.');
};

const getFrameDefaults = (manifest, snapshot) => {
    if (snapshot?.frameWidth && snapshot?.frameHeight) {
        return {
            width: snapshot.frameWidth,
            height: snapshot.frameHeight
        };
    }

    if (manifest?.target === 'lizhizhuangbi.com') {
        return {
            width: 1004,
            height: 980
        };
    }

    if (manifest?.target === 'lizhizhuangbi.com/blog') {
        return {
            width: 1280,
            height: snapshot?.pageType === 'post' ? 1400 : 2600
        };
    }

    return {
        width: DEFAULT_FRAME_WIDTH,
        height: DEFAULT_FRAME_HEIGHT
    };
};

const getSnapshotKey = (snapshot) => snapshot?.id || snapshot?.timestamp || '';

const formatSnapshotOption = (snapshot) => (
    snapshot?.optionLabel
    || [
        formatDateLabel(snapshot),
        snapshot?.pageTypeLabel,
        snapshot?.title || snapshot?.label
    ].filter(Boolean).join(' · ')
);

const NanjingLizhiArchivePage = () => {
    const frameShellRef = useRef(null);
    const iframeRef = useRef(null);
    const [archiveConfig, setArchiveConfig] = useState(DEFAULT_ARCHIVE_FEATURE_CONFIG);
    const [activeArchiveId, setActiveArchiveId] = useState(DEFAULT_ARCHIVE_SOURCE.id);
    const [manifest, setManifest] = useState(null);
    const [selectedSnapshotKey, setSelectedSnapshotKey] = useState('');
    const [isManifestLoading, setIsManifestLoading] = useState(true);
    const [manifestError, setManifestError] = useState('');
    const [retryKey, setRetryKey] = useState(0);
    const [isFrameLoading, setIsFrameLoading] = useState(true);
    const [frameMetrics, setFrameMetrics] = useState({
        contentWidth: DEFAULT_FRAME_WIDTH,
        contentHeight: DEFAULT_FRAME_HEIGHT,
        containerWidth: DEFAULT_FRAME_WIDTH
    });

    const archiveSources = useMemo(() => (
        getArchiveSources(archiveConfig.showBlogArchive)
    ), [archiveConfig.showBlogArchive]);
    const defaultArchiveSource = archiveSources[0] || DEFAULT_ARCHIVE_SOURCE;

    const activeArchive = useMemo(() => (
        archiveSources.find((source) => source.id === activeArchiveId) || defaultArchiveSource
    ), [activeArchiveId, archiveSources, defaultArchiveSource]);

    useEffect(() => {
        let canceled = false;
        const controller = new AbortController();

        const loadConfig = async () => {
            const nextConfig = await loadArchiveFeatureConfig({ signal: controller.signal });
            if (!canceled) {
                setArchiveConfig(nextConfig);
            }
        };

        void loadConfig();

        return () => {
            canceled = true;
            controller.abort();
        };
    }, []);

    useEffect(() => {
        if (!archiveSources.some((source) => source.id === activeArchiveId)) {
            setActiveArchiveId(defaultArchiveSource.id);
        }
    }, [activeArchiveId, archiveSources, defaultArchiveSource.id]);

    useEffect(() => {
        let canceled = false;

        const loadManifest = async () => {
            setIsManifestLoading(true);
            setManifestError('');
            setManifest(null);

            try {
                const response = await fetch(activeArchive.manifestUrl, { cache: 'no-cache' });
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                const nextManifest = await response.json();
                if (canceled) return;

                const snapshots = Array.isArray(nextManifest.snapshots)
                    ? nextManifest.snapshots
                    : [];
                setManifest(nextManifest);
                setSelectedSnapshotKey((current) => (
                    snapshots.some((snapshot) => getSnapshotKey(snapshot) === current)
                        ? current
                        : getSnapshotKey(snapshots[0]) || ''
                ));
            } catch (error) {
                if (canceled) return;
                setManifest(null);
                setSelectedSnapshotKey('');
                setManifestError(error?.message || '档案清单加载失败');
            } finally {
                if (!canceled) {
                    setIsManifestLoading(false);
                }
            }
        };

        void loadManifest();

        return () => {
            canceled = true;
        };
    }, [activeArchive.manifestUrl, retryKey]);

    const snapshots = useMemo(() => (
        Array.isArray(manifest?.snapshots) ? manifest.snapshots : []
    ), [manifest]);

    const selectedSnapshot = useMemo(() => (
        snapshots.find((snapshot) => getSnapshotKey(snapshot) === selectedSnapshotKey)
        || snapshots[0]
        || null
    ), [selectedSnapshotKey, snapshots]);
    const selectedKey = getSnapshotKey(selectedSnapshot);
    const frameDefaults = useMemo(() => (
        getFrameDefaults(manifest, selectedSnapshot)
    ), [manifest, selectedSnapshot]);
    const measureFrame = useCallback(() => {
        const shell = frameShellRef.current;
        const iframe = iframeRef.current;
        const containerWidth = Math.floor(
            shell?.clientWidth
            || shell?.getBoundingClientRect?.().width
            || frameDefaults.width
        );

        let contentWidth = frameDefaults.width;
        let contentHeight = frameDefaults.height;

        try {
            const doc = iframe?.contentDocument;
            const body = doc?.body;
            const root = doc?.documentElement;
            if (root) root.style.overflow = 'hidden';
            if (body) body.style.overflow = 'hidden';

            contentWidth = Math.ceil(Math.max(
                root?.scrollWidth || 0,
                body?.scrollWidth || 0,
                root?.offsetWidth || 0,
                body?.offsetWidth || 0,
                frameDefaults.width
            ));
            contentHeight = Math.ceil(Math.max(
                root?.scrollHeight || 0,
                body?.scrollHeight || 0,
                root?.offsetHeight || 0,
                body?.offsetHeight || 0,
                frameDefaults.height
            ));
        } catch {
            contentWidth = frameDefaults.width;
            contentHeight = frameDefaults.height;
        }

        setFrameMetrics((current) => (
            current.contentWidth === contentWidth
            && current.contentHeight === contentHeight
            && current.containerWidth === containerWidth
                ? current
                : { contentWidth, contentHeight, containerWidth }
        ));
    }, [frameDefaults.height, frameDefaults.width]);

    useEffect(() => {
        if (selectedKey) {
            setIsFrameLoading(true);
            setFrameMetrics((current) => ({
                ...current,
                contentWidth: frameDefaults.width,
                contentHeight: frameDefaults.height
            }));
        }
    }, [frameDefaults.height, frameDefaults.width, selectedKey]);

    useEffect(() => {
        const shell = frameShellRef.current;
        if (!shell) return undefined;

        let observer;
        const handleResize = () => measureFrame();

        if (typeof ResizeObserver !== 'undefined') {
            observer = new ResizeObserver(handleResize);
            observer.observe(shell);
        }

        window.addEventListener('resize', handleResize);
        handleResize();

        return () => {
            observer?.disconnect();
            window.removeEventListener('resize', handleResize);
        };
    }, [measureFrame]);

    const frameScale = Math.min(
        1,
        frameMetrics.containerWidth > 0 && frameMetrics.contentWidth > 0
            ? frameMetrics.containerWidth / frameMetrics.contentWidth
            : 1
    );
    const scaledFrameWidth = Math.ceil(frameMetrics.contentWidth * frameScale);
    const scaledFrameHeight = Math.ceil(frameMetrics.contentHeight * frameScale);
    const frameViewportStyle = {
        width: `${scaledFrameWidth}px`,
        height: `${scaledFrameHeight}px`
    };
    const frameStyle = {
        width: `${frameMetrics.contentWidth}px`,
        height: `${frameMetrics.contentHeight}px`,
        transform: `scale(${frameScale})`
    };
    const handleFrameLoad = () => {
        setIsFrameLoading(false);
        window.requestAnimationFrame(measureFrame);
        window.setTimeout(measureFrame, 120);
    };
    const activeArchiveLabel = manifest?.target || activeArchive.label;
    const unitLabel = manifest?.unitLabel || '历史快照';
    const usesSnapshotPicker = manifest?.displayMode === 'catalog' || snapshots.length > 60;

    return (
        <div className="archive-page">
            <section className="archive-header" aria-labelledby="archive-title">
                <div className="archive-header-copy">
                    <h1 id="archive-title">旧官网档案馆</h1>
                    <p>{activeArchiveLabel} · {snapshots.length || '-'} 个{unitLabel}</p>
                </div>
                <div className="archive-source-switch" role="tablist" aria-label="档案域名">
                    {archiveSources.map((source) => {
                        const isActive = source.id === activeArchive.id;
                        return (
                            <button
                                type="button"
                                key={source.id}
                                role="tab"
                                aria-selected={isActive}
                                className={`archive-source-button ${isActive ? 'is-active' : ''}`}
                                onClick={() => setActiveArchiveId(source.id)}
                            >
                                {source.label}
                            </button>
                        );
                    })}
                </div>
            </section>

            {isManifestLoading && (
                <div className="page-loading page-loading-spinner" role="status" aria-live="polite">
                    <span className="page-loading-ring" aria-hidden="true" />
                    <span>加载中...</span>
                </div>
            )}

            {!isManifestLoading && manifestError && (
                <section className="archive-empty" aria-label="加载失败">
                    <Archive size={34} strokeWidth={2.1} absoluteStrokeWidth />
                    <h2>档案清单加载失败</h2>
                    <p>{manifestError}</p>
                    <button
                        type="button"
                        className="archive-retry"
                        onClick={() => setRetryKey((value) => value + 1)}
                    >
                        <RefreshCcw size={16} strokeWidth={2.2} absoluteStrokeWidth />
                        <span>重新加载</span>
                    </button>
                </section>
            )}

            {!isManifestLoading && !manifestError && selectedSnapshot && (
                <section className="archive-shell">
                    {usesSnapshotPicker ? (
                        <label className="archive-snapshot-picker-row">
                            <span>页面</span>
                            <select
                                className="archive-snapshot-picker"
                                value={selectedKey}
                                aria-label="选择档案页面"
                                onChange={(event) => setSelectedSnapshotKey(event.target.value)}
                            >
                                {snapshots.map((snapshot) => (
                                    <option key={getSnapshotKey(snapshot)} value={getSnapshotKey(snapshot)}>
                                        {formatSnapshotOption(snapshot)}
                                    </option>
                                ))}
                            </select>
                        </label>
                    ) : (
                        <aside className="archive-timeline" aria-label="快照时间线">
                            <div
                                className={`archive-timeline-list ${snapshots.length > 20 ? 'is-dense' : ''}`}
                                style={{
                                    gridTemplateColumns: `repeat(${snapshots.length}, minmax(0, 1fr))`
                                }}
                            >
                                {snapshots.map((snapshot) => {
                                    const snapshotKey = getSnapshotKey(snapshot);
                                    const isActive = snapshotKey === selectedKey;
                                    return (
                                        <button
                                            type="button"
                                            key={snapshotKey}
                                            className={`archive-timeline-item ${isActive ? 'is-active' : ''}`}
                                            aria-pressed={isActive}
                                            aria-label={`查看 ${formatDateLabel(snapshot)} 快照`}
                                            onClick={() => setSelectedSnapshotKey(snapshotKey)}
                                            title={formatDateLabel(snapshot)}
                                        >
                                            <time dateTime={snapshot.capturedAt}>
                                                {formatTimelineLabel(snapshot, snapshots.length)}
                                            </time>
                                        </button>
                                    );
                                })}
                            </div>
                        </aside>
                    )}

                    <div className="archive-preview">
                        <div className="archive-frame-shell" ref={frameShellRef}>
                            {isFrameLoading && (
                                <div className="archive-frame-loading" role="status" aria-live="polite">
                                    <span className="page-loading-ring" aria-hidden="true" />
                                    <span>快照加载中...</span>
                                </div>
                            )}
                            <div className="archive-frame-viewport" style={frameViewportStyle}>
                                <iframe
                                    ref={iframeRef}
                                    key={selectedKey}
                                    className="archive-frame"
                                    src={selectedSnapshot.sitePath}
                                    title={`${activeArchiveLabel} ${formatDateLabel(selectedSnapshot)} 存档`}
                                    loading="lazy"
                                    sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                                    scrolling="no"
                                    style={frameStyle}
                                    onLoad={handleFrameLoad}
                                />
                            </div>
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
};

export default NanjingLizhiArchivePage;

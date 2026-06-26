import React, { useEffect, useMemo, useState } from 'react';
import { Share2 } from 'lucide-react';
import '../styles/download.css';
import {
    loadDownloadSections,
    subscribeToDownloadSections
} from '../data/downloadManifest';
import {
    getPathForView,
    getResourcePreviewPath,
    getResourcePreviewSlugFromPathname
} from '../utils/appShellConfig.js';
import {
    countSectionItems,
    splitDownloadResourceSections
} from '../utils/downloadResourceUtils.js';
import {
    DownloadItem,
    DownloadPreviewPage
} from './DownloadResourceList.jsx';
import {
    findPreviewItemBySlug
} from '../utils/downloadPreviewUtils.js';

const getResourceSectionTitle = (section) => (
    section.title === '其他资源' ? '文档' : section.title
);

const getResourceGroup = (group) => (
    group.title === '资源下载'
        ? { ...group, title: '全部文档' }
        : group
);

const ResourceCard = ({ group }) => (
    <article className="resources-card">
        <div className="resources-card-head">
            <h2>{group.title}</h2>
            <span>{group.items.length} 份</span>
        </div>
        <div className="resources-card-list">
            {group.items.map((item) => (
                <DownloadItem
                    key={`${item.title}-${item.url}`}
                    item={item}
                    forcePreview
                    getPreviewPath={getResourcePreviewPath}
                />
            ))}
        </div>
    </article>
);

const ResourcesPage = ({ onCopyPageLink, onInitialReady }) => {
    const [allSections, setAllSections] = useState([]);
    const [isSectionsLoading, setIsSectionsLoading] = useState(true);
    const [sectionsLoadError, setSectionsLoadError] = useState('');
    const [sectionsRetryKey, setSectionsRetryKey] = useState(0);
    const previewSlug = typeof window === 'undefined'
        ? ''
        : getResourcePreviewSlugFromPathname(window.location.pathname);

    useEffect(() => {
        let canceled = false;
        const unsubscribe = subscribeToDownloadSections((sections) => {
            if (canceled) return;
            setAllSections(Array.isArray(sections) ? sections : []);
            setSectionsLoadError('');
            setIsSectionsLoading(false);
        });
        const loadSections = async () => {
            setIsSectionsLoading(true);
            setSectionsLoadError('');
            try {
                const sections = await loadDownloadSections();
                if (canceled) return;
                setAllSections(Array.isArray(sections) ? sections : []);
            } catch (error) {
                if (canceled) return;
                setAllSections([]);
                setSectionsLoadError(error?.message || '文档清单加载失败');
            } finally {
                if (!canceled) {
                    setIsSectionsLoading(false);
                }
            }
        };
        void loadSections();
        return () => {
            canceled = true;
            unsubscribe();
        };
    }, [sectionsRetryKey]);

    useEffect(() => {
        if (!isSectionsLoading && typeof onInitialReady === 'function') {
            onInitialReady();
        }
    }, [isSectionsLoading, onInitialReady]);

    const resourceSections = useMemo(
        () => splitDownloadResourceSections(allSections).resourceSections,
        [allSections]
    );
    const sectionStats = useMemo(() => {
        const map = new Map();
        resourceSections.forEach((section) => {
            map.set(section.title, countSectionItems(section));
        });
        return map;
    }, [resourceSections]);
    const previewEntry = useMemo(
        () => findPreviewItemBySlug(resourceSections, previewSlug),
        [resourceSections, previewSlug]
    );

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

    if (previewSlug) {
        return (
            <div className="download-page download-v2 resources-page download-preview-route">
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
                                        <a className="download-preview-back" href={getPathForView('resources')}>
                                            返回文档页
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
                                    <p>当前链接对应的文档不存在，或暂不支持站内预览。</p>
                                    <div className="download-preview-error-actions">
                                        <a className="download-preview-back" href={getPathForView('resources')}>
                                            返回文档页
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
        <div className="download-page download-v2 resources-page">
            <section className="resources-hero" aria-label="文档">
                <div className="resources-hero-header">
                    <div className="resources-hero-copy">
                        <h1>文档</h1>
                        <p>文字、乐谱与 PDF 文档集中整理。</p>
                    </div>
                    <div className="resources-header-actions">
                        {typeof onCopyPageLink === 'function' && (
                            <button
                                type="button"
                                className="resources-share"
                                onClick={handleCopyPageLink}
                                aria-label="分享文档页"
                            >
                                <Share2 size={18} strokeWidth={2.2} absoluteStrokeWidth />
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

            {!isSectionsLoading && !sectionsLoadError && resourceSections.length === 0 && (
                <section className="download-section-block">
                    <div className="download-section-header">
                        <h3>暂无文档</h3>
                    </div>
                </section>
            )}

            {!isSectionsLoading && !sectionsLoadError && resourceSections.map((section) => (
                <section key={section.title} className="download-section-block resources-section-block">
                    {resourceSections.length > 1 && (
                        <div className="download-section-header">
                            <h3>{getResourceSectionTitle(section)}</h3>
                            <span className="download-section-count">
                                {sectionStats.get(section.title)} 份
                            </span>
                        </div>
                    )}
                    <div className="resources-grid">
                        {section.groups.map((group) => (
                            <ResourceCard
                                key={group.title}
                                group={getResourceGroup(group)}
                            />
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
};

export default ResourcesPage;

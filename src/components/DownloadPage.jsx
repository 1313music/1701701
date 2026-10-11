import React, { useMemo, useState, useEffect } from 'react';
import { BookOpen } from 'lucide-react';
import '../styles/download.css';
import {
    loadDownloadSections,
    subscribeToDownloadSections
} from '../data/downloadManifest';
import {
    getDownloadPreviewSlugFromPathname,
    getPathForView
} from '../utils/appShellConfig.js';
import {
    DownloadGroup,
    DownloadPreviewPage
} from './DownloadResourceList.jsx';
import {
    findPreviewItemBySlug,
    PDF_PREVIEW_VIEWER_BASE
} from '../utils/downloadPreviewUtils.js';
import {
    countSectionItems,
    splitDownloadResourceSections
} from '../utils/downloadResourceUtils.js';
import StatePanel from './StatePanel.jsx';

const DownloadPage = ({ onInitialReady }) => {
    const [downloadSections, setDownloadSections] = useState([]);
    const [isSectionsLoading, setIsSectionsLoading] = useState(true);
    const [sectionsLoadError, setSectionsLoadError] = useState('');
    const [sectionsRetryKey, setSectionsRetryKey] = useState(0);
    const previewSlug = typeof window === 'undefined'
        ? ''
        : getDownloadPreviewSlugFromPathname(window.location.pathname);

    useEffect(() => {
        let canceled = false;
        const unsubscribe = subscribeToDownloadSections((sections) => {
            if (canceled) return;
            setDownloadSections(Array.isArray(sections) ? sections : []);
            setSectionsLoadError('');
            setIsSectionsLoading(false);
        });
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
            unsubscribe();
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
        splitDownloadResourceSections(downloadSections).downloadSections.forEach((section) => {
            map.set(section.title, countSectionItems(section));
        });
        return map;
    }, [downloadSections]);
    const visibleDownloadSections = useMemo(
        () => splitDownloadResourceSections(downloadSections).downloadSections,
        [downloadSections]
    );

    const handleRetrySections = () => {
        setSectionsRetryKey((value) => value + 1);
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
                    <StatePanel variant="loading" title="加载中…" />
                )}

                {!isSectionsLoading && sectionsLoadError && (
                    <StatePanel
                        variant="error"
                        title="下载清单加载失败"
                        description={sectionsLoadError}
                        action={(
                            <>
                                <a className="state-panel-btn" href={getPathForView('download')}>
                                    返回下载页
                                </a>
                                <button
                                    type="button"
                                    className="state-panel-btn"
                                    onClick={handleRetrySections}
                                >
                                    重试
                                </button>
                            </>
                        )}
                    />
                )}

                {!isSectionsLoading && !sectionsLoadError && previewEntry && (
                    <DownloadPreviewPage
                        key={previewEntry.previewSrc}
                        item={previewEntry.item}
                        previewSrc={previewEntry.previewSrc}
                    />
                )}

                {!isSectionsLoading && !sectionsLoadError && !previewEntry && (
                    <StatePanel
                        variant="empty"
                        title="未找到该预览"
                        description="当前链接对应的资源不存在，或暂不支持站内预览。"
                        action={(
                            <a className="state-panel-btn" href={getPathForView('download')}>
                                返回下载页
                            </a>
                        )}
                    />
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
                    </div>
                </div>
            </section>

            {isSectionsLoading && (
                <StatePanel variant="loading" title="加载中…" />
            )}

            {!isSectionsLoading && sectionsLoadError && (
                <StatePanel
                    variant="error"
                    title="下载清单加载失败"
                    description={sectionsLoadError}
                    action={(
                        <button
                            type="button"
                            className="state-panel-btn"
                            onClick={handleRetrySections}
                        >
                            重试
                        </button>
                    )}
                />
            )}

            {!isSectionsLoading && !sectionsLoadError && visibleDownloadSections.map((section) => {
                const isCenteredHeader = [
                    "叁缺壹吉隆坡站",
                    "叁缺壹东京站",
                    "其他歌曲",
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

import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Share2, BookOpen } from 'lucide-react';
import { downloadSections } from '../data/downloadData';

const DownloadItem = ({ item }) => {
    const [status, setStatus] = useState('idle');
    const timerRef = useRef(null);

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

    const handleDownload = () => {
        if (status === 'loading') return;
        if (!item?.url) return;
        setStatus('loading');
        try {
            triggerDownload(item.url, item.filename || item.title);
            setStatus('done');
            resetLater();
        } catch {
            setStatus('error');
            resetLater();
            try {
                triggerDownload(item.url, item.filename || item.title);
            } catch {
                // noop
            }
        }
    };

    const label = useMemo(() => {
        if (status === 'loading') return '下载中...';
        if (status === 'done') return '下载完成';
        if (status === 'error') return '下载失败';
        return '下载';
    }, [status]);

    return (
        <div className="download-item-row">
            <div className="download-item-title">{item.title}</div>
            <div className="download-item-actions">
                {item.previewUrl && (
                    <a
                        className="download-action"
                        href={item.previewUrl}
                        target="_blank"
                        rel="noreferrer"
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

const DownloadGroup = ({ group }) => {
    const [open, setOpen] = useState(false);

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
                        <DownloadItem key={`${item.title}-${item.url}`} item={item} />
                    ))}
                </div>
            </div>
        </div>
    );
};

const DownloadPage = ({ onCopyPageLink }) => {
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
    }, []);
    const handleCopyPageLink = (event) => {
        if (typeof onCopyPageLink !== 'function') return;
        onCopyPageLink({
            placement: 'bottom',
            anchorEvent: { currentTarget: event.currentTarget }
        });
    };

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

            {downloadSections.map((section) => {
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
                            <DownloadGroup key={group.title} group={group} />
                        ))}
                    </div>
                </section>
                );
            })}
        </div>
    );
};

export default DownloadPage;

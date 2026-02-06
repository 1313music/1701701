import React, { useMemo, useRef, useState, useEffect } from 'react';
import { downloadSections } from '../data/downloadData';

const DownloadItem = ({ item }) => {
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
        try {
            const response = await fetch(item.url, {
                mode: 'cors',
                cache: 'no-cache'
            });
            if (!response.ok) throw new Error('download failed');
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = blobUrl;
            anchor.download = item.filename || item.title;
            anchor.rel = 'noopener noreferrer';
            anchor.style.display = 'none';
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
            setStatus('done');
            resetLater();
        } catch (error) {
            setStatus('error');
            resetLater();
            const anchor = document.createElement('a');
            anchor.href = item.url;
            anchor.download = item.filename || item.title;
            anchor.rel = 'noopener noreferrer';
            anchor.style.display = 'none';
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
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
            {open && (
                <div className="download-group-body">
                    {group.items.map((item) => (
                        <DownloadItem key={`${item.title}-${item.url}`} item={item} />
                    ))}
                </div>
            )}
        </div>
    );
};

const DownloadPage = () => {
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

    return (
        <div className="download-page download-v2">
            <section className="download-intro">
                <div className="download-intro-media">
                    <img loading="lazy" src="https://1701701.xyz/img/xcx.jpg" alt="SongSharing 小程序二维码" />
                </div>
                <div className="download-intro-body">
                    <div className="download-intro-brand">
                        <h2>SongSharing</h2>
                        <p>小程序</p>
                    </div>
                    <div className="download-intro-title">海量曲库 · 智能搜索 · 一键上传</div>
                    <ul className="download-intro-list">
                        <li>本页只提供小程序暂未收录歌曲的下载服务。</li>
                        <li>更多专辑与歌曲，请在小程序内搜索获取。</li>
                    </ul>
                    <div className="download-intro-actions">
                        <a
                            className="download-intro-link"
                            href="https://mp.weixin.qq.com/s/pHsFSPTn3Cd7MXV81J4NHg"
                            target="_blank"
                            rel="noreferrer"
                        >
                            使用指南
                        </a>
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

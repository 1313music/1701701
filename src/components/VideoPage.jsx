import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Folder, Play, X, CornerUpLeft } from 'lucide-react';
import { videoCategories, videoData } from '../data/videoData';
import SearchHeader from './SearchHeader';

const fallbackThumb = `data:image/svg+xml;utf8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">' +
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0%" stop-color="#1f2937"/><stop offset="100%" stop-color="#111827"/>' +
    '</linearGradient></defs>' +
    '<rect width="640" height="360" fill="url(#g)"/>' +
    '<rect x="40" y="40" width="560" height="280" rx="28" ry="28" fill="rgba(255,255,255,0.08)"/>' +
    '<text x="50%" y="50%" font-family="Arial, sans-serif" font-size="44" fill="rgba(255,255,255,0.78)" text-anchor="middle">民谣俱乐部</text>' +
    '<text x="50%" y="64%" font-family="Arial, sans-serif" font-size="24" fill="rgba(255,255,255,0.6)" text-anchor="middle">1701701.xyz</text>' +
    '</svg>'
)}`;

const VideoCard = ({ item, onClick, meta }) => {
    const [thumbError, setThumbError] = useState(false);
    const [thumbLoaded, setThumbLoaded] = useState(false);
    const thumbSrc = !thumbError && item.thumb ? item.thumb : fallbackThumb;

    useEffect(() => {
        setThumbLoaded(false);
    }, [thumbSrc]);

    return (
        <Motion.div
            className={`video-card ${item.isFolder || item.folderId ? 'is-folder' : ''}`}
            onClick={onClick}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
        >
            <div className="video-thumb">
                <div
                    className={`video-thumb-placeholder ${thumbLoaded ? 'is-hidden' : ''}`}
                    aria-hidden="true"
                >
                    <span className="video-thumb-placeholder-title">民谣俱乐部</span>
                    <span className="video-thumb-placeholder-site">1701701.xyz</span>
                </div>
                <img
                    className={`video-thumb-image ${thumbLoaded ? 'is-loaded' : ''}`}
                    src={thumbSrc}
                    alt={item.title}
                    loading="lazy"
                    onLoad={() => setThumbLoaded(true)}
                    onError={() => {
                        setThumbError(true);
                        setThumbLoaded(false);
                    }}
                />
                <div className="video-thumb-overlay">
                    {item.isFolder || item.folderId ? (
                        <Folder size={26} />
                    ) : (
                        <Play size={28} fill="currentColor" />
                    )}
                </div>
            </div>
            <div className="video-title">{item.title}</div>
            {meta ? <div className="video-meta">{meta}</div> : null}
        </Motion.div>
    );
};

const BackCard = ({ onClick }) => (
    <Motion.div
        className="video-card video-back-card"
        onClick={onClick}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
    >
        <div className="video-thumb video-thumb-back">
            <CornerUpLeft size={28} />
        </div>
        <div className="video-title">返回上级</div>
    </Motion.div>
);

const VideoPage = ({ requestVideoView }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState(videoCategories[0]?.id || '');
    const [folderStack, setFolderStack] = useState([]);
    const [activeVideo, setActiveVideo] = useState(null);
    const [resolvedUrl, setResolvedUrl] = useState('');
    const [isResolving, setIsResolving] = useState(false);
    const [resolveError, setResolveError] = useState('');
    const [resolvedType, setResolvedType] = useState('auto');
    const playerRef = useRef(null);
    const dpRef = useRef(null);
    const hideTimerRef = useRef(null);
    const hasPlayedRef = useRef(false);

    const currentItems = useMemo(() => {
        if (folderStack.length > 0) {
            return folderStack[folderStack.length - 1].items;
        }
        return videoData[activeCategory] || [];
    }, [activeCategory, folderStack]);

    const isSearching = searchQuery.trim().length > 0;
    const showBackCard = !isSearching && folderStack.length > 0;

    const allVideos = useMemo(() => {
        const results = [];
        const walk = (items, path, categoryId, categoryName) => {
            items.forEach((item) => {
                const isFolder = item.isFolder || item.folderId;
                if (isFolder && item.folderId) {
                    const nextPath = [...path, item.title];
                    const folderItems = videoData[item.folderId] || [];
                    walk(folderItems, nextPath, categoryId, categoryName);
                } else if (!isFolder) {
                    const pathLabel = path.join(' / ');
                    results.push({
                        ...item,
                        _categoryId: categoryId,
                        _categoryName: categoryName,
                        _pathLabel: pathLabel,
                        _searchText: `${item.title || ''} ${pathLabel}`.toLowerCase()
                    });
                }
            });
        };

        videoCategories.forEach((cat) => {
            const items = videoData[cat.id] || [];
            walk(items, [cat.name], cat.id, cat.name);
        });

        return results;
    }, []);

    const searchResults = useMemo(() => {
        if (!isSearching) return [];
        const term = searchQuery.trim().toLowerCase();
        return allVideos.filter((item) => item._searchText.includes(term));
    }, [allVideos, isSearching, searchQuery]);

    const displayedItems = isSearching ? searchResults : currentItems;

    const activeCategoryMeta = useMemo(
        () => videoCategories.find((cat) => cat.id === activeCategory),
        [activeCategory]
    );

    const canPlayInline = useCallback(
        (url = '', type = 'auto') => type === 'hls' || /\.(mp4|m3u8|webm|ogg)(\?|$)/i.test(url),
        []
    );

    useEffect(() => {
        if (!activeVideo) return undefined;
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') setActiveVideo(null);
        };
        document.addEventListener('keydown', handleKeyDown);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = prevOverflow;
        };
    }, [activeVideo]);

    useEffect(() => {
        if (!activeVideo) {
            setResolvedUrl('');
            setResolveError('');
            setIsResolving(false);
            setResolvedType('auto');
            return;
        }

        let canceled = false;
        const resolveUrl = async () => {
            setResolveError('');
            setIsResolving(false);
            let url = activeVideo.url || '';
            let type = 'auto';
            if (!url) {
                setResolveError('视频地址为空');
                setResolvedUrl('');
                setResolvedType('auto');
                return;
            }

            if (/\.m3u8(\?|$)/i.test(url)) {
                type = 'hls';
            }

            if (/\.js(\?|$)/i.test(url)) {
                setIsResolving(true);
                try {
                    const res = await fetch(url);
                    const text = await res.text();
                    const trimmed = text.trimStart();
                    if (trimmed.startsWith('#EXTM3U')) {
                        type = 'hls';
                    }
                    const directMatch = text.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/i);
                    const quotedMatch = text.match(/['"]([^'"]+\.m3u8[^'"]*)['"]/i);
                    const candidate = directMatch?.[0] || quotedMatch?.[1];
                    if (candidate) {
                        url = /^https?:\/\//i.test(candidate)
                            ? candidate
                            : new URL(candidate, url).href;
                        type = 'hls';
                    } else if (!trimmed.startsWith('#EXTM3U')) {
                        url = '';
                        setResolveError('未找到可播放的 m3u8 地址');
                    } else {
                        type = 'hls';
                    }
                } catch {
                    url = '';
                    setResolveError('解析播放地址失败');
                } finally {
                    if (!canceled) setIsResolving(false);
                }
            }

            if (!canceled) {
                setResolvedUrl(url);
                setResolvedType(type);
            }
        };

        resolveUrl();
        return () => {
            canceled = true;
        };
    }, [activeVideo]);

    useEffect(() => {
        if (!activeVideo || isResolving || resolveError || !resolvedUrl || !canPlayInline(resolvedUrl, resolvedType)) {
            return undefined;
        }
        const container = playerRef.current;
        if (!container) return undefined;
        let canceled = false;
        let player = null;
        let isTouchDevice = false;
        const blockContextMenu = (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (typeof event.stopImmediatePropagation === 'function') {
                event.stopImmediatePropagation();
            }
        };

        const showControls = () => {
            container.classList.add('dplayer-controls-visible');
        };

        const scheduleHide = () => {
            if (!isTouchDevice) return;
            if (hideTimerRef.current) {
                clearTimeout(hideTimerRef.current);
            }
            hideTimerRef.current = setTimeout(() => {
                if (!player.video || player.video.paused) return;
                container.classList.remove('dplayer-controls-visible');
            }, 1800);
        };

        const handleInteract = () => {
            showControls();
            if (player.video && player.video.paused && !hasPlayedRef.current) {
                player.play();
            } else if (player.video && !player.video.paused) {
                scheduleHide();
            }
        };

        const setupPlayer = async () => {
            try {
                const [{ default: DPlayer }, { default: Hls }] = await Promise.all([
                    import('dplayer'),
                    import('hls.js/dist/hls.light.mjs')
                ]);
                if (canceled) return;

                if (typeof window !== 'undefined' && !window.Hls) {
                    window.Hls = Hls;
                }

                if (dpRef.current) {
                    dpRef.current.destroy();
                    dpRef.current = null;
                }

                container.innerHTML = '';
                player = new DPlayer({
                    container,
                    autoplay: true,
                    preload: 'metadata',
                    theme: '#1d1d1f',
                    video: {
                        url: resolvedUrl,
                        pic: activeVideo.thumb || fallbackThumb,
                        type: resolvedType
                    },
                    pluginOptions: {
                        hls: {
                            enableWorker: true,
                            lowLatencyMode: true
                        }
                    }
                });

                if (canceled) {
                    player.destroy();
                    player = null;
                    return;
                }

                dpRef.current = player;

                // DPlayer 内置了自己的右键菜单，这里销毁它并在捕获阶段统一拦截右键事件
                if (player.contextmenu && typeof player.contextmenu.destroy === 'function') {
                    player.contextmenu.destroy();
                }
                container.addEventListener('contextmenu', blockContextMenu, true);
                if (player.video) {
                    player.video.addEventListener('contextmenu', blockContextMenu, true);
                }

                isTouchDevice = typeof window !== 'undefined' && (
                    'ontouchstart' in window || navigator.maxTouchPoints > 0
                );

                if (isTouchDevice) {
                    container.classList.add('dplayer-auto-hide');
                    showControls();
                    hasPlayedRef.current = false;
                    player.on('play', () => {
                        hasPlayedRef.current = true;
                        scheduleHide();
                    });
                    player.on('pause', showControls);
                    player.on('ended', showControls);
                    container.addEventListener('touchstart', handleInteract, { passive: true });
                    container.addEventListener('click', handleInteract);
                }
            } catch {
                if (!canceled) {
                    setResolveError('播放器加载失败');
                }
            }
        };

        setupPlayer();

        return () => {
            canceled = true;
            if (hideTimerRef.current) {
                clearTimeout(hideTimerRef.current);
            }
            container.removeEventListener('contextmenu', blockContextMenu, true);
            if (player?.video) {
                player.video.removeEventListener('contextmenu', blockContextMenu, true);
            }
            if (isTouchDevice) {
                container.removeEventListener('touchstart', handleInteract);
                container.removeEventListener('click', handleInteract);
                container.classList.remove('dplayer-auto-hide');
                container.classList.remove('dplayer-controls-visible');
            }
            if (player) {
                player.destroy();
            }
            if (dpRef.current === player) {
                dpRef.current = null;
            }
        };
    }, [activeVideo, resolvedUrl, resolvedType, isResolving, resolveError, canPlayInline]);

    useEffect(() => {
        if (activeVideo) return;
        if (dpRef.current) {
            dpRef.current.destroy();
            dpRef.current = null;
        }
    }, [activeVideo]);

    const handleSelectCategory = (categoryId) => {
        setActiveCategory(categoryId);
        setFolderStack([]);
    };

    const handleOpenFolder = (item) => {
        const folderItems = videoData[item.folderId] || [];
        setFolderStack((prev) => [...prev, { id: item.folderId, title: item.title, items: folderItems }]);
    };

    const handleBackFolder = () => {
        setFolderStack((prev) => prev.slice(0, -1));
    };

    const handleCardClick = (item) => {
        if (item.isFolder || item.folderId) {
            handleOpenFolder(item);
            return;
        }
        if (typeof requestVideoView === 'function') {
            requestVideoView(() => setActiveVideo(item));
            return;
        }
        setActiveVideo(item);
    };

    const activeMetaLabel = activeVideo?._pathLabel || activeCategoryMeta?.name || '视频';

    return (
        <div className="video-page">
            <SearchHeader
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                title=""
                subtitle=""
                placeholder="搜索视频、分类..."
            />

            <div className="video-toolbar">
                <div className="video-tabs" role="tablist" aria-label="视频分类">
                    {videoCategories.map((cat) => (
                        <button
                            key={cat.id}
                            type="button"
                            className={`video-tab ${activeCategory === cat.id ? 'active' : ''}`}
                            onClick={() => handleSelectCategory(cat.id)}
                            aria-pressed={activeCategory === cat.id}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>
            </div>

            {showBackCard || displayedItems.length > 0 ? (
                <div className="video-grid">
                    {showBackCard && <BackCard onClick={handleBackFolder} />}
                    {displayedItems.map((item) => (
                        <VideoCard
                            key={item.id}
                            item={item}
                            onClick={() => handleCardClick(item)}
                            meta={isSearching ? item._pathLabel : ''}
                        />
                    ))}
                </div>
            ) : (
                <div className="video-empty">暂无视频内容</div>
            )}

            <AnimatePresence>
                {activeVideo && (
                    <Motion.div
                        className="video-modal"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setActiveVideo(null)}
                    >
                        <Motion.div
                            className="video-modal-card"
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 20, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="video-modal-header">
                                <div>
                                    <div className="video-modal-title">{activeVideo.title}</div>
                                    <div className="video-modal-meta">{activeMetaLabel}</div>
                                </div>
                                <button
                                    type="button"
                                    className="video-modal-close"
                                    onClick={() => setActiveVideo(null)}
                                    aria-label="关闭"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {isResolving && (
                                <div className="video-unsupported">解析播放地址中…</div>
                            )}
                            {!isResolving && resolveError && (
                                <div className="video-unsupported">{resolveError}</div>
                            )}
                            {!isResolving && !resolveError && !resolvedUrl && (
                                <div className="video-unsupported">加载中…</div>
                            )}
                            {!isResolving && !resolveError && resolvedUrl && canPlayInline(resolvedUrl, resolvedType) && (
                                <div
                                    ref={playerRef}
                                    className="video-player"
                                    onContextMenu={(event) => event.preventDefault()}
                                />
                            )}
                            {!isResolving && !resolveError && resolvedUrl && !canPlayInline(resolvedUrl, resolvedType) && (
                                <div className="video-unsupported">当前视频链接暂不支持播放。</div>
                            )}
                        </Motion.div>
                    </Motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default VideoPage;

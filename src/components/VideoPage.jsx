import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { Folder, Play, X, CornerUpLeft, ChevronDown, ChevronLeft, ChevronRight, Share2 } from 'lucide-react';
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

const buildVideoKey = (item = {}) => `${item.id ?? ''}::${item.title ?? ''}::${item.url ?? ''}`;

const VideoCard = ({ item, onClick, meta }) => {
    const [thumbError, setThumbError] = useState(false);
    const [loadedThumbSrc, setLoadedThumbSrc] = useState('');
    const hasThumb = Boolean(item.thumb) && !thumbError;
    const thumbSrc = hasThumb ? item.thumb : '';
    const thumbLoaded = hasThumb && loadedThumbSrc === thumbSrc;

    return (
        <Motion.div
            className={`video-card ${item.isFolder || item.folderId ? 'is-folder' : ''}`}
            onClick={onClick}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
        >
            <div className={`video-thumb ${!hasThumb ? 'no-thumb' : ''}`}>
                {hasThumb ? (
                    <>
                        <div
                            className={`video-thumb-placeholder ${thumbLoaded ? 'is-hidden' : ''}`}
                            aria-hidden="true"
                        >
                            <span className="video-thumb-placeholder-title">加载中</span>
                        </div>
                        <img
                            className={`video-thumb-image ${thumbLoaded ? 'is-loaded' : ''}`}
                            src={thumbSrc}
                            alt={item.title}
                            loading="lazy"
                            onLoad={() => setLoadedThumbSrc(thumbSrc)}
                            onError={() => {
                                setThumbError(true);
                                setLoadedThumbSrc('');
                            }}
                        />
                        <div className="video-thumb-overlay">
                            {item.isFolder || item.folderId ? (
                                <Folder size={26} />
                            ) : (
                                <Play size={28} fill="currentColor" />
                            )}
                        </div>
                    </>
                ) : (
                    <div className="video-thumb-text-only">
                        <span className="video-thumb-text-main">民谣俱乐部</span>
                        <span className="video-thumb-text-site">1701701.xyz</span>
                    </div>
                )}
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

const VideoPage = ({ requestVideoView, onShareVideo }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState(videoCategories[0]?.id || '');
    const [watchCategory, setWatchCategory] = useState(videoCategories[0]?.id || '');
    const [folderStack, setFolderStack] = useState([]);
    const [activeVideo, setActiveVideo] = useState(null);
    const [resolvedUrl, setResolvedUrl] = useState('');
    const [fallbackUrl, setFallbackUrl] = useState('');
    const [fallbackType, setFallbackType] = useState('auto');
    const [sourceAttempt, setSourceAttempt] = useState(0);
    const [resolveAttempt, setResolveAttempt] = useState(0);
    const [isResolving, setIsResolving] = useState(false);
    const [resolveError, setResolveError] = useState('');
    const [resolvedType, setResolvedType] = useState('auto');
    const [resolvedVideoKey, setResolvedVideoKey] = useState('');
    const playerRef = useRef(null);
    const stageMainRef = useRef(null);
    const dpRef = useRef(null);
    const activeVideoKeyRef = useRef('');
    const activeEpisodeRef = useRef(null);
    const stageCategoriesRef = useRef(null);
    const fallbackTriedRef = useRef(false);
    const shareQueryAppliedRef = useRef(false);
    const [stageMainHeight, setStageMainHeight] = useState(0);
    const [stageCategoriesScrollState, setStageCategoriesScrollState] = useState({
        canLeft: false,
        canRight: false
    });

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

    const allVideoMap = useMemo(() => {
        const map = new Map();
        allVideos.forEach((item) => {
            map.set(buildVideoKey(item), item);
        });
        return map;
    }, [allVideos]);

    const categoryVideoCounts = useMemo(() => {
        const counts = {};
        videoCategories.forEach((cat) => {
            counts[cat.id] = 0;
        });
        allVideos.forEach((item) => {
            counts[item._categoryId] = (counts[item._categoryId] || 0) + 1;
        });
        return counts;
    }, [allVideos]);

    const searchResults = useMemo(() => {
        if (!isSearching) return [];
        const term = searchQuery.trim().toLowerCase();
        return allVideos.filter((item) => item._searchText.includes(term));
    }, [allVideos, isSearching, searchQuery]);

    const displayedItems = isSearching ? searchResults : currentItems;

    const normalizeVideoItem = useCallback((item) => {
        if (!item) return item;
        return allVideoMap.get(buildVideoKey(item)) || item;
    }, [allVideoMap]);

    const activeVideoKey = activeVideo ? buildVideoKey(activeVideo) : '';

    useLayoutEffect(() => {
        activeVideoKeyRef.current = activeVideoKey;
    }, [activeVideoKey]);

    const watchEpisodes = useMemo(() => {
        if (!watchCategory) return [];
        return allVideos.filter((item) => item._categoryId === watchCategory);
    }, [allVideos, watchCategory]);

    const watchEpisodeGroups = useMemo(() => {
        const groups = [];
        const groupMap = new Map();

        watchEpisodes.forEach((item) => {
            const segments = String(item._pathLabel || '')
                .split(' / ')
                .map((segment) => segment.trim())
                .filter(Boolean);
            const relativePath = segments.slice(1).join(' / ');
            const groupKey = relativePath || '__direct__';

            if (!groupMap.has(groupKey)) {
                const group = {
                    key: groupKey,
                    label: relativePath || '直出',
                    isDirect: !relativePath,
                    items: []
                };
                groupMap.set(groupKey, group);
                groups.push(group);
            }

            groupMap.get(groupKey).items.push(item);
        });

        return groups;
    }, [watchEpisodes]);

    const watchEpisodeGroupByKey = useMemo(() => {
        const map = new Map();
        watchEpisodeGroups.forEach((group) => {
            group.items.forEach((item) => {
                map.set(buildVideoKey(item), group.key);
            });
        });
        return map;
    }, [watchEpisodeGroups]);

    const activeWatchIndex = useMemo(() => {
        if (!activeVideoKey) return -1;
        return watchEpisodes.findIndex((item) => buildVideoKey(item) === activeVideoKey);
    }, [activeVideoKey, watchEpisodes]);

    const activeWatchGroupKey = watchEpisodeGroupByKey.get(activeVideoKey) || '';

    const [expandedWatchGroups, setExpandedWatchGroups] = useState(() => new Set(['__direct__']));

    const prevWatchEpisode = activeWatchIndex > 0 ? watchEpisodes[activeWatchIndex - 1] : null;
    const nextWatchEpisode = activeWatchIndex >= 0 && activeWatchIndex < watchEpisodes.length - 1
        ? watchEpisodes[activeWatchIndex + 1]
        : null;

    const activeCategoryMeta = useMemo(
        () => videoCategories.find((cat) => cat.id === activeCategory),
        [activeCategory]
    );

    const watchCategoryMeta = useMemo(
        () => videoCategories.find((cat) => cat.id === watchCategory),
        [watchCategory]
    );

    const canPlayInline = useCallback(
        (url = '', type = 'auto') => type === 'hls' || /\.(mp4|m3u8|webm|ogg)(\?|$)/i.test(url),
        []
    );

    const resolvePlayableSource = useCallback(async (rawUrl = '') => {
        let url = rawUrl || '';
        let type = 'auto';

        if (!url) {
            return { url: '', type: 'auto', error: '视频地址为空' };
        }

        if (/\.m3u8(\?|$)/i.test(url)) {
            type = 'hls';
        }

        if (/\.js(\?|$)/i.test(url)) {
            const res = await fetch(url);
            if (!res.ok) {
                throw new Error(`bad-status-${res.status}`);
            }
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
                return { url: '', type: 'auto', error: '未找到可播放的 m3u8 地址' };
            }
        }

        return { url, type, error: '' };
    }, []);

    useEffect(() => {
        if (!activeVideo) return undefined;
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') setActiveVideo(null);
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [activeVideo]);

    useEffect(() => {
        if (!activeVideo) return;
        const nextCategoryId = activeVideo._categoryId || activeCategory;
        if (nextCategoryId) {
            setWatchCategory((prev) => (prev === nextCategoryId ? prev : nextCategoryId));
        }
    }, [activeVideo, activeCategory]);

    useEffect(() => {
        if (shareQueryAppliedRef.current || typeof window === 'undefined') return;
        if (allVideos.length === 0) return;
        shareQueryAppliedRef.current = true;

        const params = new URLSearchParams(window.location.search);
        const viewParam = params.get('view');
        if (viewParam && viewParam !== 'video') return;
        const videoId = params.get('videoId');
        if (!videoId) return;

        const matched = allVideos.find((item) => String(item.id) === videoId);
        const nextVideo = normalizeVideoItem(matched);
        if (!nextVideo) return;

        const nextCategoryId = nextVideo._categoryId;
        if (nextCategoryId) {
            setActiveCategory(nextCategoryId);
            setWatchCategory(nextCategoryId);
        }
        setFolderStack([]);
        setActiveVideo(nextVideo);
    }, [allVideos, normalizeVideoItem]);

    useEffect(() => {
        const availableGroupKeys = new Set(watchEpisodeGroups.map((group) => group.key));

        setExpandedWatchGroups((prev) => {
            const next = new Set();
            prev.forEach((key) => {
                if (availableGroupKeys.has(key)) {
                    next.add(key);
                }
            });
            if (availableGroupKeys.has('__direct__')) {
                next.add('__direct__');
            }
            if (activeWatchGroupKey && availableGroupKeys.has(activeWatchGroupKey)) {
                next.add(activeWatchGroupKey);
            }

            const isSameSize = next.size === prev.size;
            if (isSameSize) {
                let same = true;
                for (const key of prev) {
                    if (!next.has(key)) {
                        same = false;
                        break;
                    }
                }
                if (same) {
                    return prev;
                }
            }

            return next;
        });
    }, [watchEpisodeGroups, activeWatchGroupKey]);

    useEffect(() => {
        if (!activeVideo) return undefined;
        const isEditableTarget = (target) => (
            target instanceof HTMLElement &&
            Boolean(target.closest('input, textarea, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]'))
        );

        const handlePlaybackHotkey = (event) => {
            if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
            if (isEditableTarget(event.target)) return;
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

            const video = dpRef.current?.video;
            if (!video) return;

            const currentTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
            const duration = Number.isFinite(video.duration) ? video.duration : Number.POSITIVE_INFINITY;
            const delta = event.key === 'ArrowLeft' ? -10 : 10;
            const nextTime = Math.min(Math.max(currentTime + delta, 0), duration);

            if (nextTime === currentTime) return;
            video.currentTime = nextTime;
            if (video.paused && typeof video.play === 'function') {
                void video.play().catch(() => {});
            }
            event.preventDefault();
        };

        document.addEventListener('keydown', handlePlaybackHotkey);
        return () => {
            document.removeEventListener('keydown', handlePlaybackHotkey);
        };
    }, [activeVideo]);

    useEffect(() => {
        if (!activeVideo) return undefined;
        const handleEpisodeHotkey = (event) => {
            if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
            if (event.key === '[' && prevWatchEpisode) {
                event.preventDefault();
                setActiveVideo(prevWatchEpisode);
            }
            if (event.key === ']' && nextWatchEpisode) {
                event.preventDefault();
                setActiveVideo(nextWatchEpisode);
            }
        };
        document.addEventListener('keydown', handleEpisodeHotkey);
        return () => {
            document.removeEventListener('keydown', handleEpisodeHotkey);
        };
    }, [activeVideo, prevWatchEpisode, nextWatchEpisode]);

    useEffect(() => {
        if (!activeVideo || !activeEpisodeRef.current) return;
        activeEpisodeRef.current.scrollIntoView({ block: 'nearest' });
    }, [activeVideo, activeVideoKey, watchCategory, activeWatchGroupKey, expandedWatchGroups]);

    useEffect(() => {
        if (!activeVideo) {
            setStageMainHeight(0);
            return undefined;
        }
        const mainNode = stageMainRef.current;
        if (!mainNode) return undefined;

        const updateHeight = () => {
            const nextHeight = Math.round(mainNode.getBoundingClientRect().height);
            setStageMainHeight((prev) => (Math.abs(prev - nextHeight) < 2 ? prev : nextHeight));
        };

        updateHeight();

        let observer;
        if (typeof ResizeObserver !== 'undefined') {
            observer = new ResizeObserver(() => updateHeight());
            observer.observe(mainNode);
        }

        window.addEventListener('resize', updateHeight);
        return () => {
            observer?.disconnect();
            window.removeEventListener('resize', updateHeight);
        };
    }, [activeVideo, resolvedUrl, resolveError, isResolving]);

    useEffect(() => {
        if (!activeVideo) {
            setResolvedUrl('');
            setFallbackUrl('');
            setFallbackType('auto');
            setSourceAttempt(0);
            setResolveAttempt(0);
            setResolveError('');
            setIsResolving(false);
            setResolvedType('auto');
            setResolvedVideoKey('');
            fallbackTriedRef.current = false;
            return;
        }

        let canceled = false;
        const targetVideoKey = buildVideoKey(activeVideo);
        const resolveUrl = async () => {
            setResolvedUrl('');
            setResolvedType('auto');
            setFallbackUrl('');
            setFallbackType('auto');
            setResolvedVideoKey('');
            setResolveError('');
            setIsResolving(true);
            fallbackTriedRef.current = false;

            try {
                const primary = await resolvePlayableSource(activeVideo.url || '');
                const backup = activeVideo.backupUrl
                    ? await resolvePlayableSource(activeVideo.backupUrl)
                    : { url: '', type: 'auto', error: '' };

                if (canceled) return;

                setFallbackUrl(backup.url || '');
                setFallbackType(backup.type || 'auto');

                if (primary.url) {
                    setResolvedUrl(primary.url);
                    setResolvedType(primary.type);
                    setResolvedVideoKey(targetVideoKey);
                    return;
                }

                if (backup.url) {
                    fallbackTriedRef.current = true;
                    setResolvedUrl(backup.url);
                    setResolvedType(backup.type);
                    setResolvedVideoKey(targetVideoKey);
                    return;
                }

                setResolvedUrl('');
                setResolvedType('auto');
                setResolvedVideoKey('');
                setResolveError(primary.error || backup.error || '解析播放地址失败');
            } catch {
                if (canceled) return;
                setResolvedUrl('');
                setResolvedType('auto');
                setFallbackUrl('');
                setFallbackType('auto');
                setResolvedVideoKey('');
                setResolveError('解析播放地址失败');
            } finally {
                if (!canceled) {
                    setIsResolving(false);
                }
            }
        };

        resolveUrl();
        return () => {
            canceled = true;
        };
    }, [activeVideo, resolvePlayableSource, resolveAttempt]);

    useEffect(() => {
        if (
            !activeVideo ||
            resolvedVideoKey !== activeVideoKey ||
            isResolving ||
            resolveError ||
            !resolvedUrl ||
            !canPlayInline(resolvedUrl, resolvedType)
        ) {
            return undefined;
        }
        const container = playerRef.current;
        if (!container) return undefined;
        let canceled = false;
        let player = null;
        let handlePlaybackError = null;
        let removeTouchToggleGuard = null;
        const effectVideoKey = activeVideoKey;
        const isStalePlayerEvent = () => canceled || activeVideoKeyRef.current !== effectVideoKey;
        const blockContextMenu = (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (typeof event.stopImmediatePropagation === 'function') {
                event.stopImmediatePropagation();
            }
        };

        const trySwitchToFallback = () => {
            if (isStalePlayerEvent()) {
                return false;
            }
            if (!fallbackUrl || resolvedUrl === fallbackUrl || fallbackTriedRef.current) {
                return false;
            }
            fallbackTriedRef.current = true;
            setResolveError('');
            setResolvedUrl(fallbackUrl);
            setResolvedType(fallbackType || 'auto');
            setSourceAttempt((value) => value + 1);
            return true;
        };

        const setupPlayer = async () => {
            try {
                const [{ default: DPlayer }, { default: Hls }] = await Promise.all([
                    import('dplayer'),
                    import('hls.js/dist/hls.light.mjs')
                ]);
                if (isStalePlayerEvent()) return;

                if (typeof window !== 'undefined' && !window.Hls) {
                    window.Hls = Hls;
                }

                if (dpRef.current) {
                    dpRef.current.destroy();
                    dpRef.current = null;
                }

                container.innerHTML = '';
                container.classList.remove('dplayer-auto-hide');
                container.classList.remove('dplayer-controls-visible');
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

                if (isStalePlayerEvent()) {
                    player.destroy();
                    player = null;
                    return;
                }

                dpRef.current = player;
                const isTouchDevice = typeof window !== 'undefined' && (
                    'ontouchstart' in window ||
                    navigator.maxTouchPoints > 0 ||
                    window.matchMedia?.('(pointer: coarse)')?.matches
                );
                if (isTouchDevice && player.controller) {
                    const videoWrap = container.querySelector('.dplayer-video-wrap');
                    const controllerMask = container.querySelector('.dplayer-controller-mask');
                    const controllerRoot = container.querySelector('.dplayer-controller');
                    const webFullButton = container.querySelector('.dplayer-full-in-icon');
                    let lastToggleAt = 0;
                    let hideTimer = null;

                    const clearAutoHide = () => {
                        if (hideTimer) {
                            clearTimeout(hideTimer);
                            hideTimer = null;
                        }
                    };

                    const scheduleAutoHide = () => {
                        clearAutoHide();
                        if (!player?.controller || !player?.video || player.video.paused) return;
                        hideTimer = setTimeout(() => {
                            if (canceled || !player?.controller || !player?.video || player.video.paused) return;
                            if (typeof player.controller.hide === 'function') {
                                player.controller.hide();
                            }
                        }, 2200);
                    };

                    const showControls = () => {
                        if (typeof player.controller.show === 'function') {
                            player.controller.show();
                        }
                        scheduleAutoHide();
                    };

                    const onPlay = () => scheduleAutoHide();
                    const onPauseOrEnded = () => {
                        clearAutoHide();
                        if (typeof player.controller.show === 'function') {
                            player.controller.show();
                        }
                    };
                    const onControllerTouchStart = () => clearAutoHide();
                    const onControllerTouchEnd = () => scheduleAutoHide();
                    const blockWebFullscreen = (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        if (typeof event.stopImmediatePropagation === 'function') {
                            event.stopImmediatePropagation();
                        }
                        if (player?.fullScreen?.isFullScreen?.('web')) {
                            player.fullScreen.cancel('web');
                        }
                    };

                    const toggleGuard = (event) => {
                        if (!player?.controller) return;
                        const now = Date.now();
                        const delta = now - lastToggleAt;
                        event.preventDefault();
                        event.stopPropagation();
                        if (typeof event.stopImmediatePropagation === 'function') {
                            event.stopImmediatePropagation();
                        }
                        if (delta < 260) return;
                        lastToggleAt = now;
                        if (typeof player.controller.isShow === 'function' && player.controller.isShow()) {
                            clearAutoHide();
                            if (typeof player.controller.hide === 'function') {
                                player.controller.hide();
                            }
                            return;
                        }
                        showControls();
                    };

                    videoWrap?.addEventListener('click', toggleGuard, true);
                    controllerMask?.addEventListener('click', toggleGuard, true);
                    controllerRoot?.addEventListener('touchstart', onControllerTouchStart, { passive: true });
                    controllerRoot?.addEventListener('touchend', onControllerTouchEnd, { passive: true });
                    webFullButton?.addEventListener('click', blockWebFullscreen, true);
                    if (webFullButton) {
                        webFullButton.style.display = 'none';
                        webFullButton.setAttribute('aria-hidden', 'true');
                    }
                    if (typeof player.on === 'function') {
                        player.on('play', onPlay);
                        player.on('pause', onPauseOrEnded);
                        player.on('ended', onPauseOrEnded);
                    }

                    removeTouchToggleGuard = () => {
                        clearAutoHide();
                        videoWrap?.removeEventListener('click', toggleGuard, true);
                        controllerMask?.removeEventListener('click', toggleGuard, true);
                        controllerRoot?.removeEventListener('touchstart', onControllerTouchStart);
                        controllerRoot?.removeEventListener('touchend', onControllerTouchEnd);
                        webFullButton?.removeEventListener('click', blockWebFullscreen, true);
                        if (typeof player?.off === 'function') {
                            player.off('play', onPlay);
                            player.off('pause', onPauseOrEnded);
                            player.off('ended', onPauseOrEnded);
                        }
                    };
                }

                handlePlaybackError = () => {
                    if (isStalePlayerEvent()) {
                        return;
                    }
                    if (trySwitchToFallback()) {
                        return;
                    }
                    setResolveError('视频播放失败，请稍后重试');
                };
                player.on('error', handlePlaybackError);
                if (player.video) {
                    player.video.addEventListener('error', handlePlaybackError);
                }

                // DPlayer 内置了自己的右键菜单，这里销毁它并在捕获阶段统一拦截右键事件
                if (player.contextmenu && typeof player.contextmenu.destroy === 'function') {
                    player.contextmenu.destroy();
                }
                container.addEventListener('contextmenu', blockContextMenu, true);
                if (player.video) {
                    player.video.addEventListener('contextmenu', blockContextMenu, true);
                }
            } catch {
                if (!isStalePlayerEvent()) {
                    setResolveError('播放器加载失败');
                }
            }
        };

        setupPlayer();

        return () => {
            canceled = true;
            if (removeTouchToggleGuard) {
                removeTouchToggleGuard();
                removeTouchToggleGuard = null;
            }
            container.removeEventListener('contextmenu', blockContextMenu, true);
            if (player && typeof player.off === 'function' && handlePlaybackError) {
                player.off('error', handlePlaybackError);
            }
            if (player?.video) {
                player.video.removeEventListener('contextmenu', blockContextMenu, true);
                if (handlePlaybackError) {
                    player.video.removeEventListener('error', handlePlaybackError);
                }
            }
            if (player) {
                player.destroy();
            }
            if (dpRef.current === player) {
                dpRef.current = null;
            }
        };
    }, [
        activeVideo,
        activeVideoKey,
        resolvedVideoKey,
        resolvedUrl,
        resolvedType,
        fallbackUrl,
        fallbackType,
        sourceAttempt,
        isResolving,
        resolveError,
        canPlayInline
    ]);

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

    const handleOpenVideo = useCallback((item) => {
        const nextVideo = normalizeVideoItem(item);
        if (!nextVideo) return;
        if (typeof requestVideoView === 'function') {
            requestVideoView(() => setActiveVideo(nextVideo));
            return;
        }
        setActiveVideo(nextVideo);
    }, [normalizeVideoItem, requestVideoView]);

    const handleCardClick = (item) => {
        if (item.isFolder || item.folderId) {
            handleOpenFolder(item);
            return;
        }
        handleOpenVideo(item);
    };

    const canSwitchToBackup = Boolean(fallbackUrl);
    const backupActionLabel = resolvedUrl === fallbackUrl ? '重试备用链接' : '切换备用链接';

    const handleSwitchToBackup = () => {
        if (!fallbackUrl) return;
        fallbackTriedRef.current = true;
        setResolveError('');
        setResolvedUrl(fallbackUrl);
        setResolvedType(fallbackType || 'auto');
        setResolvedVideoKey(activeVideoKey);
        setSourceAttempt((value) => value + 1);
    };

    const handleReloadVideo = () => {
        if (!activeVideo) return;
        fallbackTriedRef.current = false;
        setResolvedUrl('');
        setResolvedType('auto');
        setResolvedVideoKey('');
        setResolveError('');
        setSourceAttempt((value) => value + 1);
        setResolveAttempt((value) => value + 1);
    };

    const handleSelectWatchCategory = (categoryId) => {
        setWatchCategory(categoryId);
    };

    const updateStageCategoriesScrollState = useCallback(() => {
        const node = stageCategoriesRef.current;
        if (!node) {
            setStageCategoriesScrollState((prev) => (
                prev.canLeft || prev.canRight ? { canLeft: false, canRight: false } : prev
            ));
            return;
        }

        const maxScrollLeft = Math.max(0, node.scrollWidth - node.clientWidth);
        const next = {
            canLeft: node.scrollLeft > 2,
            canRight: maxScrollLeft - node.scrollLeft > 2
        };

        setStageCategoriesScrollState((prev) => (
            prev.canLeft === next.canLeft && prev.canRight === next.canRight ? prev : next
        ));
    }, []);

    const handleStageCategoriesWheel = (event) => {
        const node = stageCategoriesRef.current;
        if (!node || node.scrollWidth <= node.clientWidth) return;

        const absX = Math.abs(event.deltaX);
        const absY = Math.abs(event.deltaY);
        const delta = absX > absY ? event.deltaX : event.deltaY;
        if (!delta) return;

        const prevScrollLeft = node.scrollLeft;
        node.scrollLeft += delta;
        if (node.scrollLeft !== prevScrollLeft) {
            event.preventDefault();
        }
    };

    const handleScrollStageCategories = (direction) => {
        const node = stageCategoriesRef.current;
        if (!node) return;

        const step = Math.max(220, Math.round(node.clientWidth * 0.58));
        node.scrollBy({ left: direction * step, behavior: 'smooth' });
    };

    const handleToggleWatchGroup = (groupKey) => {
        setExpandedWatchGroups((prev) => {
            const next = new Set(prev);
            if (next.has(groupKey)) {
                next.delete(groupKey);
            } else {
                next.add(groupKey);
            }
            return next;
        });
    };

    const handleSelectWatchEpisode = (item) => {
        const nextVideo = normalizeVideoItem(item);
        if (!nextVideo) return;
        setActiveVideo(nextVideo);
    };

    const handleShareCurrentVideo = (event) => {
        if (typeof onShareVideo !== 'function' || !activeVideo || typeof window === 'undefined') return;

        const shareUrl = new URL(window.location.origin + window.location.pathname);
        shareUrl.searchParams.set('view', 'video');
        shareUrl.searchParams.set('videoId', String(activeVideo.id || ''));
        if (activeVideo._categoryId) {
            shareUrl.searchParams.set('videoCategory', String(activeVideo._categoryId));
        }

        const categoryLabel = watchCategoryMeta?.name || activeVideo._categoryName || '视频';
        onShareVideo({
            type: 'video',
            panelTitle: '分享视频',
            title: `${activeVideo.title} - ${categoryLabel}`,
            text: activeVideo.title,
            url: shareUrl.toString(),
            trackName: activeVideo.title,
            albumName: categoryLabel,
            artistName: '1701701.xyz',
            cover: activeVideo.thumb || ''
        }, event?.currentTarget ? {
            placement: 'bottom',
            anchorEvent: { currentTarget: event.currentTarget }
        } : undefined);
    };

    const activeMetaLabel = activeVideo?._pathLabel || activeCategoryMeta?.name || '视频';
    const activeEpisodeProgress = activeWatchIndex >= 0 ? `第 ${activeWatchIndex + 1} / ${watchEpisodes.length} 集` : '';
    const playerContainerKey = `${resolvedVideoKey || activeVideoKey || 'video'}:${sourceAttempt}:${resolveAttempt}`;
    const isWatching = Boolean(activeVideo);

    useEffect(() => {
        if (!isWatching) {
            setStageCategoriesScrollState((prev) => (
                prev.canLeft || prev.canRight ? { canLeft: false, canRight: false } : prev
            ));
            return undefined;
        }

        const node = stageCategoriesRef.current;
        if (!node) return undefined;

        updateStageCategoriesScrollState();
        node.addEventListener('scroll', updateStageCategoriesScrollState, { passive: true });
        window.addEventListener('resize', updateStageCategoriesScrollState);

        let observer;
        if (typeof ResizeObserver !== 'undefined') {
            observer = new ResizeObserver(() => updateStageCategoriesScrollState());
            observer.observe(node);
        }

        return () => {
            node.removeEventListener('scroll', updateStageCategoriesScrollState);
            window.removeEventListener('resize', updateStageCategoriesScrollState);
            observer?.disconnect();
        };
    }, [isWatching, watchCategory, updateStageCategoriesScrollState]);

    const renderVideoGrid = () => (
        showBackCard || displayedItems.length > 0 ? (
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
        )
    );

    return (
        <div className={`video-page ${isWatching ? 'is-watching' : ''}`}>
            <SearchHeader
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                title=""
                subtitle=""
                placeholder="搜索视频、分类..."
            />

            {isSearching && renderVideoGrid()}

            {!isSearching && !isWatching && (
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
            )}

            {isWatching && (
                <div className="video-inline-stage is-active">
                    <Motion.section
                        className="video-stage-card video-stage-theme-minimal"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <div className="video-stage-header">
                            <div className="video-stage-header-top">
                                <div className="video-stage-title">{activeVideo.title}</div>
                                <div className="video-stage-actions">
                                    <button
                                        type="button"
                                        className="video-stage-share-btn"
                                        onClick={handleShareCurrentVideo}
                                        aria-label="分享当前视频"
                                    >
                                        <Share2 size={18} />
                                    </button>
                                    <button
                                        type="button"
                                        className="video-stage-close"
                                        onClick={() => setActiveVideo(null)}
                                        aria-label="收起播放器"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>
                            <div className="video-stage-meta">
                                <span>{activeMetaLabel}</span>
                                {activeEpisodeProgress ? (
                                    <span className="video-stage-progress-chip">{activeEpisodeProgress}</span>
                                ) : null}
                            </div>
                        </div>

                        <div className="video-stage-layout">
                            <div className="video-stage-main" ref={stageMainRef}>
                                <div className="video-stage-media-shell">
                                    {isResolving && (
                                        <div className="video-unsupported video-unsupported-inline">解析播放地址中…</div>
                                    )}
                                    {!isResolving && resolveError && (
                                        <div className="video-unsupported video-unsupported-inline">
                                            <div>{resolveError}</div>
                                            <div className="video-unsupported-actions">
                                                {canSwitchToBackup && (
                                                    <button
                                                        type="button"
                                                        className="video-unsupported-action"
                                                        onClick={handleSwitchToBackup}
                                                    >
                                                        {backupActionLabel}
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    className="video-unsupported-action"
                                                    onClick={handleReloadVideo}
                                                    disabled={isResolving}
                                                >
                                                    重新加载
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    {!isResolving && !resolveError && !resolvedUrl && (
                                        <div className="video-unsupported video-unsupported-inline">加载中…</div>
                                    )}
                                    {!isResolving && !resolveError && resolvedUrl && canPlayInline(resolvedUrl, resolvedType) && (
                                        <div
                                            key={playerContainerKey}
                                            ref={playerRef}
                                            className="video-stage-player"
                                            onContextMenu={(event) => event.preventDefault()}
                                        />
                                    )}
                                    {!isResolving && !resolveError && resolvedUrl && !canPlayInline(resolvedUrl, resolvedType) && (
                                        <div className="video-unsupported video-unsupported-inline">当前视频链接暂不支持播放。</div>
                                    )}
                                </div>
                                <div className="video-stage-main-controls">
                                    <button
                                        type="button"
                                        className="video-stage-nav-btn"
                                        onClick={() => handleSelectWatchEpisode(prevWatchEpisode)}
                                        disabled={!prevWatchEpisode}
                                    >
                                        上一集
                                    </button>
                                    <button
                                        type="button"
                                        className="video-stage-nav-btn"
                                        onClick={() => handleSelectWatchEpisode(nextWatchEpisode)}
                                        disabled={!nextWatchEpisode}
                                    >
                                        下一集
                                    </button>
                                </div>
                            </div>

                            <aside
                                className={`video-watch-sidebar ${stageMainHeight > 0 ? 'is-measured' : ''}`}
                                style={stageMainHeight > 0 ? { height: `${stageMainHeight}px` } : undefined}
                            >
                                <div className="video-watch-episodes">
                                    {watchEpisodes.length === 0 ? (
                                        <div className="video-watch-empty">当前分类暂无可播放视频</div>
                                    ) : (
                                        watchEpisodeGroups.map((group) => {
                                            const isExpanded = group.isDirect || expandedWatchGroups.has(group.key);

                                            return (
                                                <section key={`watch-group-${group.key}`} className="video-watch-group">
                                                    {!group.isDirect && (
                                                        <button
                                                            type="button"
                                                            className={`video-watch-group-toggle ${isExpanded ? 'is-expanded' : ''}`}
                                                            onClick={() => handleToggleWatchGroup(group.key)}
                                                            aria-expanded={isExpanded}
                                                        >
                                                            <span className="video-watch-group-label">{group.label}</span>
                                                            <span className="video-watch-group-count">{group.items.length} 集</span>
                                                            <ChevronDown size={14} className="video-watch-group-icon" />
                                                        </button>
                                                    )}

                                                    {isExpanded && (
                                                        <div className={`video-watch-group-items ${group.isDirect ? 'is-direct' : ''}`}>
                                                            {group.items.map((item, index) => {
                                                                const itemKey = buildVideoKey(item);
                                                                const isActiveEpisode = itemKey === activeVideoKey;

                                                                return (
                                                                    <button
                                                                        key={`watch-episode-${item.id}-${index}`}
                                                                        type="button"
                                                                        className={`video-watch-episode ${isActiveEpisode ? 'active' : ''}`}
                                                                        onClick={() => handleSelectWatchEpisode(item)}
                                                                        ref={isActiveEpisode ? activeEpisodeRef : null}
                                                                    >
                                                                        <span className="video-watch-episode-index">
                                                                            {String(index + 1).padStart(2, '0')}
                                                                        </span>
                                                                        <span className="video-watch-episode-texts">
                                                                            <span className="video-watch-episode-title">{item.title}</span>
                                                                        </span>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </section>
                                            );
                                        })
                                    )}
                                </div>
                            </aside>
                            <div className="video-stage-categories-wrap">
                                <button
                                    type="button"
                                    className="video-stage-categories-nav"
                                    onClick={() => handleScrollStageCategories(-1)}
                                    disabled={!stageCategoriesScrollState.canLeft}
                                    aria-label="向左查看分类"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <div
                                    className="video-stage-categories"
                                    role="tablist"
                                    aria-label="看片分类"
                                    ref={stageCategoriesRef}
                                    onWheel={handleStageCategoriesWheel}
                                >
                                    {videoCategories.map((cat) => (
                                        <button
                                            key={`watch-${cat.id}`}
                                            type="button"
                                            className={`video-stage-category ${watchCategory === cat.id ? 'active' : ''}`}
                                            onClick={() => handleSelectWatchCategory(cat.id)}
                                            aria-pressed={watchCategory === cat.id}
                                        >
                                            <span>{cat.name}</span>
                                            <span className="video-stage-category-count">{categoryVideoCounts[cat.id] || 0}</span>
                                        </button>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    className="video-stage-categories-nav"
                                    onClick={() => handleScrollStageCategories(1)}
                                    disabled={!stageCategoriesScrollState.canRight}
                                    aria-label="向右查看分类"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    </Motion.section>
                </div>
            )}

            {!isSearching && !isWatching && renderVideoGrid()}
        </div>
    );
};

export default VideoPage;

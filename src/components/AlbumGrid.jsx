import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Heart, Play, QrCode, X } from 'lucide-react';
import { ChevronUpIcon } from './icons/AppIcons';
import { getAlbumMiniProgram } from '../data/miniProgramAlbums.js';

const PANEL_EXIT_MS = 280;
const PANEL_MAX_WIDTH = 1180;
const PANEL_OPEN_TICK_MS = 24;
const LIBRARY_INTRO_DURATION_MS = 1400;
const SONG_MARQUEE_GAP = 24;
const SONG_MARQUEE_MIN_DURATION = 9;
const SONG_MARQUEE_SPEED = 36;

const getNodeWidth = (node) => {
    if (!node) return 0;
    const scrollWidth = Number(node.scrollWidth) || 0;
    const rectWidth = Number(node.getBoundingClientRect?.().width) || 0;
    return Math.max(scrollWidth, rectWidth);
};

const SongNameMarquee = ({ text, allowMarquee }) => {
    const containerRef = useRef(null);
    const measureRef = useRef(null);
    const [layout, setLayout] = useState({
        overflow: false,
        shift: 0,
        duration: 0
    });

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        let frameId = 0;

        const recalculate = () => {
            const container = containerRef.current;
            const measure = measureRef.current;
            if (!container || !measure) return;

            const containerWidth = container.clientWidth;
            const textWidth = getNodeWidth(measure);
            const overflow = textWidth > containerWidth + 2;
            const shift = overflow ? Math.ceil(textWidth + SONG_MARQUEE_GAP) : 0;
            const duration = Math.max(
                SONG_MARQUEE_MIN_DURATION,
                Number((shift / SONG_MARQUEE_SPEED).toFixed(2))
            );

            setLayout((previous) => {
                if (
                    previous.overflow === overflow
                    && previous.shift === shift
                    && Math.abs(previous.duration - duration) < 0.01
                ) {
                    return previous;
                }
                return { overflow, shift, duration };
            });
        };

        const scheduleRecalculate = () => {
            if (frameId) window.cancelAnimationFrame(frameId);
            frameId = window.requestAnimationFrame(recalculate);
        };

        scheduleRecalculate();

        let resizeObserver;
        if (typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(scheduleRecalculate);
            if (containerRef.current) resizeObserver.observe(containerRef.current);
            if (measureRef.current) resizeObserver.observe(measureRef.current);
        } else {
            window.addEventListener('resize', scheduleRecalculate);
        }

        return () => {
            if (frameId) window.cancelAnimationFrame(frameId);
            if (resizeObserver) {
                resizeObserver.disconnect();
            } else {
                window.removeEventListener('resize', scheduleRecalculate);
            }
        };
    }, [text]);

    const shouldRun = allowMarquee && layout.overflow;
    const marqueeStyle = shouldRun
        ? {
            '--song-name-marquee-shift': `${layout.shift}px`,
            '--song-name-marquee-duration': `${layout.duration}s`
        }
        : undefined;

    return (
        <span
            ref={containerRef}
            className={`song-name song-name-marquee ${shouldRun ? 'is-running' : ''}`}
            style={marqueeStyle}
        >
            {shouldRun ? (
                <span className="song-name-marquee-track">
                    <span className="song-name-marquee-item">{text}</span>
                    <span className="song-name-marquee-gap" aria-hidden="true" />
                    <span className="song-name-marquee-item" aria-hidden="true">{text}</span>
                </span>
            ) : (
                <span className="song-name-static">{text}</span>
            )}
            <span className="song-name-measure" aria-hidden="true" ref={measureRef}>{text}</span>
        </span>
    );
};

const AlbumGrid = ({
    musicAlbums,
    navigateToAlbum,
    expandedAlbumId,
    currentTrack,
    isPlaying,
    playSongFromAlbum,
    tempPlaylistSet,
    onToggleTempSong,
    onToggleAlbumFavorites
}) => {
    const gridRef = useRef(null);
    const [columns, setColumns] = useState(() => {
        if (typeof window === 'undefined') return 4;
        return window.matchMedia('(max-width: 768px)').matches ? 4 : 6;
    });
    const [gridMetrics, setGridMetrics] = useState({ width: 0, gap: 24 });
    const [isMobileLayout, setIsMobileLayout] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia('(max-width: 768px)').matches;
    });
    const [renderedPanelAlbumId, setRenderedPanelAlbumId] = useState(expandedAlbumId || null);
    const [panelPhase, setPanelPhase] = useState(() => (expandedAlbumId ? 'open' : 'closed'));
    const [panelHeight, setPanelHeight] = useState(0);
    const [hoveredPanelSongSrc, setHoveredPanelSongSrc] = useState('');
    const [isIntroActive, setIsIntroActive] = useState(true);
    const [mobileQrPanel, setMobileQrPanel] = useState(null);
    const panelExitTimerRef = useRef(null);
    const panelStateTimerRef = useRef(null);
    const panelOpenTimerRef = useRef(null);
    const renderedPanelAlbumIdRef = useRef(renderedPanelAlbumId);
    const panelContentRef = useRef(null);

    const measurePanelHeight = useCallback(() => {
        const node = panelContentRef.current;
        if (!node) return;
        // Add a tiny buffer to avoid fractional-pixel clipping at the bottom.
        const nextHeight = Math.ceil(node.scrollHeight) + 2;
        setPanelHeight((prev) => (Math.abs(prev - nextHeight) <= 1 ? prev : nextHeight));
    }, []);

    const clearPanelTimers = useCallback(() => {
        if (panelStateTimerRef.current) {
            window.clearTimeout(panelStateTimerRef.current);
            panelStateTimerRef.current = null;
        }
        if (panelExitTimerRef.current) {
            window.clearTimeout(panelExitTimerRef.current);
            panelExitTimerRef.current = null;
        }
        if (panelOpenTimerRef.current) {
            window.clearTimeout(panelOpenTimerRef.current);
            panelOpenTimerRef.current = null;
        }
    }, []);

    useLayoutEffect(() => {
        const node = gridRef.current;
        if (!node) return;

        const updateColumns = () => {
            const gridWidth = node.getBoundingClientRect().width || 0;
            if (!gridWidth) return;
            const style = window.getComputedStyle(node);
            const gapValue = style.columnGap || style.gap || '0';
            const gap = parseFloat(gapValue) || 0;
            const isMobile = window.matchMedia('(max-width: 768px)').matches;
            setGridMetrics((prev) => (
                Math.abs(prev.width - gridWidth) <= 1 && Math.abs(prev.gap - gap) <= 0.5
                    ? prev
                    : { width: gridWidth, gap }
            ));
            setIsMobileLayout((prev) => (prev === isMobile ? prev : isMobile));
            if (isMobile) {
                setColumns((prev) => (prev === 4 ? prev : 4));
                return;
            }
            const minCard = 140;
            const maxCols = 9;
            const cols = Math.max(1, Math.min(maxCols, Math.floor((gridWidth + gap) / (minCard + gap))));
            setColumns((prev) => (prev === cols ? prev : cols));
        };

        updateColumns();
        const ro = new ResizeObserver(updateColumns);
        ro.observe(node);
        return () => ro.disconnect();
    }, [musicAlbums.length]);

    useEffect(() => {
        renderedPanelAlbumIdRef.current = renderedPanelAlbumId;
    }, [renderedPanelAlbumId]);

    useEffect(() => {
        clearPanelTimers();
        if (!expandedAlbumId) {
            if (!renderedPanelAlbumIdRef.current) {
                panelStateTimerRef.current = window.setTimeout(() => {
                    setHoveredPanelSongSrc('');
                    setPanelPhase('closed');
                    panelStateTimerRef.current = null;
                }, 0);
                return;
            }
            panelStateTimerRef.current = window.setTimeout(() => {
                setPanelPhase('closing');
                setHoveredPanelSongSrc('');
                panelExitTimerRef.current = window.setTimeout(() => {
                    setRenderedPanelAlbumId(null);
                    renderedPanelAlbumIdRef.current = null;
                    setPanelPhase('closed');
                    setPanelHeight(0);
                    panelExitTimerRef.current = null;
                }, PANEL_EXIT_MS);
                panelStateTimerRef.current = null;
            }, 0);
            return;
        }

        panelStateTimerRef.current = window.setTimeout(() => {
            const prevRenderedId = renderedPanelAlbumIdRef.current;
            const isSwitchingAlbum = Boolean(prevRenderedId && prevRenderedId !== expandedAlbumId);
            setHoveredPanelSongSrc('');
            setRenderedPanelAlbumId(expandedAlbumId);
            renderedPanelAlbumIdRef.current = expandedAlbumId;
            if (isSwitchingAlbum) {
                // Keep panel expanded when switching albums to avoid replaying expand animation.
                setPanelPhase('open');
            } else {
                setPanelPhase('opening');
                panelOpenTimerRef.current = window.setTimeout(() => {
                    setPanelPhase('open');
                    panelOpenTimerRef.current = null;
                }, PANEL_OPEN_TICK_MS);
            }
            panelStateTimerRef.current = null;
        }, 0);
    }, [clearPanelTimers, expandedAlbumId]);

    useEffect(() => () => {
        clearPanelTimers();
    }, [clearPanelTimers]);

    useEffect(() => {
        const timerId = window.setTimeout(() => {
            setIsIntroActive(false);
        }, LIBRARY_INTRO_DURATION_MS);

        return () => {
            window.clearTimeout(timerId);
        };
    }, []);

    const renderedPanelIndex = useMemo(
        () => (renderedPanelAlbumId ? musicAlbums.findIndex((album) => album.id === renderedPanelAlbumId) : -1),
        [renderedPanelAlbumId, musicAlbums]
    );
    const expandedAlbum = renderedPanelIndex >= 0 ? musicAlbums[renderedPanelIndex] : null;
    const panelAlbum = expandedAlbum;
    const insertAfterIndex = renderedPanelIndex >= 0
        ? Math.min(musicAlbums.length - 1, Math.floor(renderedPanelIndex / columns) * columns + (columns - 1))
        : -1;
    const panelHostIndex = insertAfterIndex;
    const panelLayout = useMemo(() => {
        if (
            renderedPanelIndex < 0
            || columns <= 0
            || isMobileLayout
            || gridMetrics.width <= 0
        ) {
            return {
                width: '100%',
                offsetLeft: '0px',
                anchorX: '50%'
            };
        }

        const safeGap = Math.max(0, gridMetrics.gap || 0);
        const panelWidth = Math.min(gridMetrics.width, PANEL_MAX_WIDTH);
        const columnIndex = renderedPanelIndex % columns;
        const cardWidth = Math.max(0, (gridMetrics.width - safeGap * (columns - 1)) / columns);
        const selectedCenter = columnIndex * (cardWidth + safeGap) + cardWidth / 2;
        const maxOffset = Math.max(0, gridMetrics.width - panelWidth);
        const offsetLeft = Math.min(Math.max(selectedCenter - panelWidth / 2, 0), maxOffset);
        const anchorPadding = Math.min(56, panelWidth / 2);
        const anchorPx = Math.min(
            Math.max(selectedCenter - offsetLeft, anchorPadding),
            Math.max(anchorPadding, panelWidth - anchorPadding)
        );
        const anchorX = panelWidth > 0 ? (anchorPx / panelWidth) * 100 : 50;

        return {
            width: `${Math.round(panelWidth)}px`,
            offsetLeft: `${Math.round(offsetLeft)}px`,
            anchorX: `${Number(anchorX.toFixed(2))}%`
        };
    }, [columns, gridMetrics, isMobileLayout, renderedPanelIndex]);
    const isPanelOpen = Boolean(panelAlbum) && panelPhase === 'open';
    const isPanelClosing = Boolean(panelAlbum) && panelPhase === 'closing';
    const isPanelOpening = Boolean(panelAlbum) && panelPhase === 'opening';
    const isPanelAlbumFullyFavorited = Boolean(panelAlbum?.songs?.length) && panelAlbum.songs.every(
        (song) => song?.src && tempPlaylistSet?.has(song.src)
    );
    const panelAlbumMiniProgram = getAlbumMiniProgram(panelAlbum?.id);
    const expandedMarginTop = isMobileLayout ? 8 : 12;
    const expandedMarginBottom = isMobileLayout ? 20 : 30;

    useLayoutEffect(() => {
        if (!panelAlbum) return;
        measurePanelHeight();
    }, [panelAlbum, measurePanelHeight, columns]);

    useEffect(() => {
        const node = panelContentRef.current;
        if (!panelAlbum || !node || typeof ResizeObserver === 'undefined') return;
        const ro = new ResizeObserver(() => {
            measurePanelHeight();
        });
        ro.observe(node);
        return () => ro.disconnect();
    }, [panelAlbum, measurePanelHeight]);

    const gridItems = musicAlbums.flatMap((album, index) => {
        const isCurrentAlbum = album.songs.some((song) => song.src === currentTrack.src);
        const isAlbumPlaying = isCurrentAlbum && isPlaying;
        const items = [];
        const isExpandedAlbum = renderedPanelAlbumId === album.id;

        items.push(
            <div
                key={`card-${album.id}`}
                className={`track-card ${isAlbumPlaying ? 'is-playing' : ''} ${isExpandedAlbum ? 'is-expanded' : ''} ${isIntroActive ? 'intro-active' : ''}`}
                style={{
                    '--card-enter-delay': `${120 + Math.min(index, 11) * 42}ms`
                }}
                onClick={() => navigateToAlbum(album)}
            >
                <div className="card-cover-container">
                    <img loading="lazy" src={album.cover} alt={album.name} />
                    <div className="play-overlay">
                        <div className="play-btn-circle">
                            <Play size={24} fill="currentColor" style={{ marginLeft: '4px' }} />
                        </div>
                    </div>
                    {isAlbumPlaying && (
                        <div className="album-playing-badge" aria-label="正在播放">
                            <span className="playing-bars" aria-hidden="true">
                                <i></i><i></i><i></i><i></i>
                            </span>
                        </div>
                    )}
                </div>
                <div className="track-title">{album.name}</div>
                <div className="track-artist">{album.artist}</div>
            </div>
        );

        if (index !== panelHostIndex || !panelAlbum) return items;

        items.push(
            <div
                key="inline-shell"
                className={`album-inline-shell ${isPanelOpen ? 'is-open' : ''} ${isPanelOpening ? 'is-opening' : ''} ${isPanelClosing ? 'is-closing' : ''}`}
                style={{
                    '--panel-height': `${panelHeight}px`,
                    '--panel-margin-top': `${expandedMarginTop}px`,
                    '--panel-margin-bottom': `${expandedMarginBottom}px`,
                    '--panel-width': panelLayout.width,
                    '--panel-offset-left': panelLayout.offsetLeft,
                    '--panel-anchor-x': panelLayout.anchorX,
                    willChange: 'height, opacity, margin-top, margin-bottom'
                }}
            >
                <div className={`album-inline-panel ${panelAlbumMiniProgram ? 'has-mini-program' : ''}`} ref={panelContentRef}>
                    <button className="album-inline-close" onClick={() => navigateToAlbum(panelAlbum)} aria-label="收起">
                        <ChevronUpIcon size={18} />
                    </button>
                    <div className="album-inline-header">
                        <div className="album-inline-cover-wrap">
                            <img
                                className="album-inline-cover"
                                loading="lazy"
                                src={panelAlbum.cover}
                                alt={panelAlbum.name}
                            />
                        </div>
                        <div className="album-info-text">
                            <h1 className="album-title">{panelAlbum.name}</h1>
                            <p className="album-metadata">{panelAlbum.artist} • {panelAlbum.songs.length} 首歌</p>
                            <div className={`album-inline-hero-actions ${panelAlbumMiniProgram ? 'has-qr' : 'no-qr'}`}>
                                <button
                                    type="button"
                                    onClick={() => playSongFromAlbum(panelAlbum, panelAlbum.songs[0])}
                                    className="play-all-btn"
                                    disabled={!panelAlbum.songs.length}
                                >
                                    <Play size={17} fill="currentColor" strokeWidth={2.2} aria-hidden="true" />
                                    播放全部
                                </button>
                                <button
                                    type="button"
                                    className={`album-inline-fav-all-btn ${isPanelAlbumFullyFavorited ? 'active' : ''}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onToggleAlbumFavorites?.(panelAlbum.songs, e);
                                    }}
                                >
                                    <Heart
                                        size={17}
                                        strokeWidth={2.2}
                                        fill={isPanelAlbumFullyFavorited ? 'currentColor' : 'none'}
                                        aria-hidden="true"
                                    />
                                    {isPanelAlbumFullyFavorited ? '取消收藏' : '收藏全部'}
                                </button>
                                {panelAlbumMiniProgram && (
                                    <div className="album-inline-qr-action">
                                        <button
                                            type="button"
                                            className="album-inline-qr-btn"
                                            aria-label={panelAlbumMiniProgram.hint}
                                            title={panelAlbumMiniProgram.hint}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (!isMobileLayout) return;
                                                setMobileQrPanel({
                                                    albumName: panelAlbum.name,
                                                    title: panelAlbumMiniProgram.title,
                                                    hint: panelAlbumMiniProgram.hint,
                                                    codeUrl: panelAlbumMiniProgram.codeUrl
                                                });
                                            }}
                                        >
                                            <QrCode size={16} strokeWidth={2.2} aria-hidden="true" />
                                            扫码保存
                                        </button>
                                        <div className="album-inline-qr-popover" role="tooltip" aria-label={panelAlbumMiniProgram.title}>
                                            <img
                                                loading="lazy"
                                                src={panelAlbumMiniProgram.codeUrl}
                                                alt={`${panelAlbum.name} 小程序码`}
                                            />
                                            <p>{panelAlbumMiniProgram.hint}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="song-list">
                        {panelAlbum.songs.map((song, i) => {
                            const isCurrentSong = currentTrack.src === song.src;
                            const isPlayingSong = isCurrentSong && isPlaying;
                            return (
                                <div
                                    key={song.src}
                                    className={`song-item ${isCurrentSong ? 'active' : ''} ${isPlayingSong ? 'is-playing-song' : ''}`}
                                    onClick={() => playSongFromAlbum(panelAlbum, song)}
                                    onPointerEnter={() => setHoveredPanelSongSrc(song.src)}
                                    onPointerLeave={() => {
                                        setHoveredPanelSongSrc((previous) => (
                                            previous === song.src ? '' : previous
                                        ));
                                    }}
                                >
                                    <span className="song-num">{i + 1}</span>
                                    <SongNameMarquee
                                        text={song.name}
                                        allowMarquee={
                                            isCurrentSong
                                            || hoveredPanelSongSrc === song.src
                                        }
                                    />
                                    <span className="song-actions">
                                        <span className="song-status">
                                            {isPlayingSong ? (
                                                <span className="playing-bars" aria-label="正在播放">
                                                    <i></i><i></i><i></i><i></i>
                                                </span>
                                            ) : ''}
                                        </span>
                                        <button
                                            type="button"
                                            className={`song-temp-btn ${tempPlaylistSet?.has(song.src) ? 'active' : ''}`}
                                            aria-pressed={tempPlaylistSet?.has(song.src)}
                                            aria-label={tempPlaylistSet?.has(song.src) ? '取消收藏' : '收藏'}
                                            title={tempPlaylistSet?.has(song.src) ? '取消收藏' : '收藏'}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onToggleTempSong(song, e);
                                            }}
                                        >
                                            <Heart
                                                size={16}
                                                strokeWidth={2}
                                                fill={tempPlaylistSet?.has(song.src) ? 'currentColor' : 'none'}
                                            />
                                        </button>
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
        return items;
    });

    const mobileQrDialog = isMobileLayout && mobileQrPanel && typeof document !== 'undefined'
        ? createPortal(
            <div className="album-mobile-qr-overlay" role="presentation" onClick={() => setMobileQrPanel(null)}>
                <div
                    className="album-mobile-qr-card"
                    role="dialog"
                    aria-modal="true"
                    aria-label={mobileQrPanel.title}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        type="button"
                        className="album-mobile-qr-close"
                        aria-label="关闭二维码"
                        onClick={() => setMobileQrPanel(null)}
                    >
                        <X size={18} />
                    </button>
                    <img
                        loading="lazy"
                        src={mobileQrPanel.codeUrl}
                        alt={`${mobileQrPanel.albumName} 小程序码`}
                    />
                    <p>{mobileQrPanel.hint}</p>
                </div>
            </div>,
            document.body
        )
        : null;

    return (
        <>
            <div className="music-grid" ref={gridRef} style={{ '--grid-columns': columns }}>
                {gridItems}
            </div>
            {mobileQrDialog}
        </>
    );
};

export default React.memo(AlbumGrid);

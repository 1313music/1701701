import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Heart, Play } from 'lucide-react';
import { ChevronUpIcon } from './icons/AppIcons';

const PANEL_EXIT_MS = 280;
const PANEL_OPEN_TICK_MS = 24;
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
    const [isMobileLayout, setIsMobileLayout] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia('(max-width: 768px)').matches;
    });
    const [renderedPanelAlbumId, setRenderedPanelAlbumId] = useState(expandedAlbumId || null);
    const [panelPhase, setPanelPhase] = useState(() => (expandedAlbumId ? 'open' : 'closed'));
    const [panelHeight, setPanelHeight] = useState(0);
    const [hoveredPanelSongSrc, setHoveredPanelSongSrc] = useState('');
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
            setHoveredPanelSongSrc('');
            if (!renderedPanelAlbumIdRef.current) {
                panelStateTimerRef.current = window.setTimeout(() => {
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
    const isPanelOpen = Boolean(panelAlbum) && panelPhase === 'open';
    const isPanelClosing = Boolean(panelAlbum) && panelPhase === 'closing';
    const isPanelOpening = Boolean(panelAlbum) && panelPhase === 'opening';
    const isPanelAlbumFullyFavorited = Boolean(panelAlbum?.songs?.length) && panelAlbum.songs.every(
        (song) => song?.src && tempPlaylistSet?.has(song.src)
    );
    const expandedMarginTop = isMobileLayout ? 8 : 12;
    const expandedMarginBottom = isMobileLayout ? 20 : 30;

    useEffect(() => {
        if (!panelAlbum) {
            setHoveredPanelSongSrc('');
        }
    }, [panelAlbum]);

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

        items.push(
            <div
                key={`card-${album.id}`}
                className={`track-card ${isAlbumPlaying ? 'is-playing' : ''}`}
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
                    willChange: 'height, opacity, margin-top, margin-bottom'
                }}
            >
                <div className="album-inline-panel" ref={panelContentRef}>
                    <div className="album-inline-header">
                        <div className="album-info-text">
                            <h1 className="album-title">{panelAlbum.name}</h1>
                            <p className="album-metadata">{panelAlbum.artist} • {panelAlbum.songs.length} 首歌</p>
                            <div className="album-inline-hero-actions">
                                <button onClick={() => playSongFromAlbum(panelAlbum, panelAlbum.songs[0])} className="play-all-btn">
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
                                    {isPanelAlbumFullyFavorited ? '取消收藏' : '收藏全部'}
                                </button>
                            </div>
                        </div>
                        <button className="album-inline-close" onClick={() => navigateToAlbum(panelAlbum)} aria-label="收起">
                            <ChevronUpIcon size={18} />
                        </button>
                    </div>

                    <div className="song-list">
                        {panelAlbum.songs.map((song, i) => (
                            <div
                                key={song.src}
                                className={`song-item ${currentTrack.src === song.src ? 'active' : ''}`}
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
                                        currentTrack.src === song.src
                                        || hoveredPanelSongSrc === song.src
                                    }
                                />
                                <span className="song-actions">
                                    <span className="song-status">
                                        {currentTrack.src === song.src && isPlaying ? (
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
                        ))}
                    </div>
                    <div className="album-inline-bottom-actions">
                        <button
                            type="button"
                            className="album-inline-bottom-close"
                            onClick={() => navigateToAlbum(panelAlbum)}
                            aria-label="收起"
                            title="收起"
                        >
                            <ChevronUpIcon size={18} />
                        </button>
                    </div>
                </div>
            </div>
        );
        return items;
    });

    return (
        <div className="music-grid" ref={gridRef} style={{ '--grid-columns': columns }}>
            {gridItems}
        </div>
    );
};

export default AlbumGrid;

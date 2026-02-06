import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Play, ChevronUp, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const AlbumGrid = ({
    musicAlbums,
    navigateToAlbum,
    expandedAlbumId,
    currentTrack,
    isPlaying,
    playSongFromAlbum,
    tempPlaylistSet,
    onToggleTempSong
}) => {
    const gridRef = useRef(null);
    const wasPanelOpenRef = useRef(false);
    const [cachedPanelHostIndex, setCachedPanelHostIndex] = useState(-1);
    const [cachedPanelAlbum, setCachedPanelAlbum] = useState(null);
    const [columns, setColumns] = useState(() => {
        if (typeof window === 'undefined') return 4;
        return window.matchMedia('(max-width: 768px)').matches ? 4 : 6;
    });
    const [isMobileLayout, setIsMobileLayout] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia('(max-width: 768px)').matches;
    });

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

    const expandedIndex = useMemo(
        () => (expandedAlbumId ? musicAlbums.findIndex((album) => album.id === expandedAlbumId) : -1),
        [expandedAlbumId, musicAlbums]
    );
    const expandedAlbum = expandedIndex >= 0 ? musicAlbums[expandedIndex] : null;
    const panelAlbum = expandedAlbum || cachedPanelAlbum;
    const isPanelOpen = Boolean(expandedAlbum);
    const insertAfterIndex = expandedIndex >= 0
        ? Math.min(musicAlbums.length - 1, Math.floor(expandedIndex / columns) * columns + (columns - 1))
        : -1;
    const panelHostIndex = insertAfterIndex >= 0 ? insertAfterIndex : cachedPanelHostIndex;
    const expandedMarginTop = isMobileLayout ? 8 : 12;
    const expandedMarginBottom = isMobileLayout ? 20 : 30;
    const collapsedMarginTop = 0;
    const collapsedMarginBottom = 0;
    const shellTransition = {
        height: { duration: 0.46, ease: [0.22, 1, 0.36, 1] },
        marginTop: { duration: 0.46, ease: [0.22, 1, 0.36, 1] },
        marginBottom: { duration: 0.46, ease: [0.22, 1, 0.36, 1] }
    };
    const shouldAnimateShellOpen = isPanelOpen && !wasPanelOpenRef.current;
    const panelSwapTransition = {
        opacity: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
        y: { duration: 0.24, ease: [0.22, 1, 0.36, 1] }
    };
    const panelFlipVariants = {
        enter: { opacity: 0, y: 8 },
        center: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -8 }
    };

    useEffect(() => {
        if (insertAfterIndex < 0) return;
        setCachedPanelHostIndex((prev) => (prev === insertAfterIndex ? prev : insertAfterIndex));
    }, [insertAfterIndex]);

    useEffect(() => {
        if (!expandedAlbum || cachedPanelAlbum) return;
        setCachedPanelAlbum(expandedAlbum);
    }, [expandedAlbum, cachedPanelAlbum]);

    useEffect(() => {
        wasPanelOpenRef.current = isPanelOpen;
    }, [isPanelOpen]);

    const gridItems = [];

    musicAlbums.forEach((album, index) => {
        const isCurrentAlbum = album.songs.some((song) => song.src === currentTrack.src);
        const isAlbumPlaying = isCurrentAlbum && isPlaying;

        gridItems.push(
            <motion.div
                key={`card-${album.id}`}
                className={`track-card ${isAlbumPlaying ? 'is-playing' : ''}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
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
            </motion.div>
        );

        if (index !== panelHostIndex || !panelAlbum) return;

        gridItems.push(
            <motion.div
                key="inline-shell"
                className="album-inline-shell"
                style={{
                    overflow: 'hidden',
                    willChange: 'height, margin-top, margin-bottom'
                }}
                initial={
                    shouldAnimateShellOpen
                        ? { height: 0, marginTop: 0, marginBottom: 0 }
                        : false
                }
                animate={{
                    height: isPanelOpen ? 'auto' : 0,
                    marginTop: isPanelOpen ? expandedMarginTop : collapsedMarginTop,
                    marginBottom: isPanelOpen ? expandedMarginBottom : collapsedMarginBottom
                }}
                transition={shellTransition}
            >
                <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                        key={panelAlbum.id}
                        className="album-inline-panel"
                        style={{
                            willChange: 'opacity, transform'
                        }}
                        variants={panelFlipVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={panelSwapTransition}
                        onAnimationComplete={(definition) => {
                            if (definition !== 'center' || !expandedAlbum) return;
                            setCachedPanelAlbum((prev) => (
                                prev?.id === expandedAlbum.id ? prev : expandedAlbum
                            ));
                        }}
                    >
                        <div className="album-inline-header">
                            <div className="album-info-text">
                                <h1 className="album-title">{panelAlbum.name}</h1>
                                <p className="album-metadata">{panelAlbum.artist} • {panelAlbum.songs.length} 首歌</p>
                                <button onClick={() => playSongFromAlbum(panelAlbum, panelAlbum.songs[0])} className="play-all-btn">
                                    播放全部
                                </button>
                            </div>
                            <button className="album-inline-close" onClick={() => navigateToAlbum(panelAlbum)} aria-label="收起">
                                <ChevronUp size={18} />
                            </button>
                        </div>

                        <div className="song-list">
                            {panelAlbum.songs.map((song, i) => (
                                <div
                                    key={song.src}
                                    className={`song-item ${currentTrack.src === song.src ? 'active' : ''}`}
                                    onClick={() => playSongFromAlbum(panelAlbum, song)}
                                >
                                    <span className="song-num">{i + 1}</span>
                                    <span className="song-name">{song.name}</span>
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
                    </motion.div>
                </AnimatePresence>
            </motion.div>
        );
    });

    return (
        <div className="music-grid" ref={gridRef} style={{ '--grid-columns': columns }}>
            {gridItems}
        </div>
    );
};

export default AlbumGrid;

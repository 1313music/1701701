import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
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
    const lastInsertAfterIndexRef = useRef(-1);
    const [columns, setColumns] = useState(() => {
        if (typeof window === 'undefined') return 4;
        return window.matchMedia('(max-width: 768px)').matches ? 4 : 6;
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
    const insertAfterIndex = expandedIndex >= 0
        ? Math.min(musicAlbums.length - 1, Math.floor(expandedIndex / columns) * columns + (columns - 1))
        : -1;
    if (insertAfterIndex >= 0) lastInsertAfterIndexRef.current = insertAfterIndex;
    const panelHostIndex = insertAfterIndex >= 0 ? insertAfterIndex : lastInsertAfterIndexRef.current;

    return (
        <div className="music-grid" ref={gridRef} style={{ '--grid-columns': columns }}>
            {musicAlbums.map((album, index) => {
                const isCurrentAlbum = album.songs.some((song) => song.src === currentTrack.src);
                const isAlbumPlaying = isCurrentAlbum && isPlaying;

                return (
                    <React.Fragment key={album.id}>
                        <motion.div
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

                        {index === panelHostIndex && (
                            <AnimatePresence
                                initial={false}
                                onExitComplete={() => {
                                    if (!expandedAlbum) lastInsertAfterIndexRef.current = -1;
                                }}
                            >
                                {expandedAlbum && (
                                    <motion.div
                                        key={`inline-shell-${expandedAlbum.id}`}
                                        className="album-inline-shell"
                                        style={{ overflow: 'hidden' }}
                                        initial={{ height: 0, opacity: 0, marginTop: 0, marginBottom: 0 }}
                                        animate={{ height: 'auto', opacity: 1, marginTop: 12, marginBottom: 30 }}
                                        exit={{ height: 0, opacity: 0, marginTop: 0, marginBottom: 0 }}
                                        transition={{
                                            height: { duration: 0.56, ease: [0.22, 1, 0.36, 1] },
                                            marginTop: { duration: 0.52, ease: [0.22, 1, 0.36, 1] },
                                            marginBottom: { duration: 0.52, ease: [0.22, 1, 0.36, 1] },
                                            opacity: { duration: 0.28, ease: [0.22, 1, 0.36, 1] }
                                        }}
                                    >
                                        <motion.div
                                            className="album-inline-panel"
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 4 }}
                                            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                                        >
                                            <div className="album-inline-header">
                                                <div className="album-info-text">
                                                    <h1 className="album-title">{expandedAlbum.name}</h1>
                                                    <p className="album-metadata">{expandedAlbum.artist} • {expandedAlbum.songs.length} 首歌</p>
                                                    <button onClick={() => playSongFromAlbum(expandedAlbum, expandedAlbum.songs[0])} className="play-all-btn">
                                                        播放全部
                                                    </button>
                                                </div>
                                                <button className="album-inline-close" onClick={() => navigateToAlbum(expandedAlbum)} aria-label="收起">
                                                    <ChevronUp size={18} />
                                                </button>
                                            </div>

                                            <motion.div
                                                className="song-list"
                                                initial="hidden"
                                                animate="show"
                                                exit="hidden"
                                                variants={{
                                                    hidden: { opacity: 0 },
                                                    show: {
                                                        opacity: 1,
                                                        transition: {
                                                            staggerChildren: 0.022,
                                                            delayChildren: 0.06
                                                        }
                                                    }
                                                }}
                                            >
                                                {expandedAlbum.songs.map((song, i) => (
                                                    <motion.div
                                                        key={song.src}
                                                        className={`song-item ${currentTrack.src === song.src ? 'active' : ''}`}
                                                        onClick={() => playSongFromAlbum(expandedAlbum, song)}
                                                        variants={{
                                                            hidden: { opacity: 0, y: 8 },
                                                            show: { opacity: 1, y: 0 }
                                                        }}
                                                        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
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
                                                    </motion.div>
                                                ))}
                                            </motion.div>
                                        </motion.div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
};

export default AlbumGrid;

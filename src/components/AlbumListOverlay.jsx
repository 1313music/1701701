import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Heart, X } from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';

const FAVORITE_MARQUEE_GAP = 28;
const FAVORITE_MARQUEE_TEXT_GAP = 8;
const FAVORITE_MARQUEE_MIN_DURATION = 10;
const FAVORITE_MARQUEE_SPEED = 34;
const FAVORITE_META_MIN_VISIBLE = 44;

const getMeasuredWidth = (element) => {
    if (!element) return 0;
    const scrollWidth = Number(element.scrollWidth) || 0;
    const rectWidth = Number(element.getBoundingClientRect?.().width) || 0;
    return Math.max(scrollWidth, rectWidth);
};

const FavoriteRowMarquee = ({ songName, albumName, allowMarquee }) => {
    const containerRef = useRef(null);
    const songMeasureRef = useRef(null);
    const albumMeasureRef = useRef(null);
    const [layout, setLayout] = useState({
        showAlbumStatic: Boolean(albumName),
        showAlbumRunning: Boolean(albumName),
        overflow: false,
        shift: 0,
        duration: 0
    });

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        let frameId = 0;

        const recalculate = () => {
            const container = containerRef.current;
            const songMeasure = songMeasureRef.current;
            if (!container || !songMeasure) return;

            const containerWidth = container.clientWidth;
            const songWidth = getMeasuredWidth(songMeasure);
            const hasAlbum = Boolean(albumName);
            const albumWidth = hasAlbum && albumMeasureRef.current
                ? getMeasuredWidth(albumMeasureRef.current)
                : 0;
            const remainForAlbum = containerWidth - songWidth - FAVORITE_MARQUEE_TEXT_GAP;
            const showAlbumStatic = hasAlbum && remainForAlbum >= FAVORITE_META_MIN_VISIBLE;
            const showAlbumRunning = hasAlbum && (allowMarquee || showAlbumStatic);
            const visibleWidth = showAlbumRunning
                ? songWidth + FAVORITE_MARQUEE_TEXT_GAP + albumWidth
                : songWidth;
            const overflow = visibleWidth > containerWidth + 2;
            const shift = overflow ? Math.ceil(visibleWidth + FAVORITE_MARQUEE_GAP) : 0;
            const duration = Math.max(
                FAVORITE_MARQUEE_MIN_DURATION,
                Number((shift / FAVORITE_MARQUEE_SPEED).toFixed(2))
            );

            setLayout((previous) => {
                if (
                    previous.showAlbumStatic === showAlbumStatic
                    && previous.showAlbumRunning === showAlbumRunning
                    && previous.overflow === overflow
                    && previous.shift === shift
                    && Math.abs(previous.duration - duration) < 0.01
                ) {
                    return previous;
                }
                return {
                    showAlbumStatic,
                    showAlbumRunning,
                    overflow,
                    shift,
                    duration
                };
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
            if (songMeasureRef.current) resizeObserver.observe(songMeasureRef.current);
            if (albumMeasureRef.current) resizeObserver.observe(albumMeasureRef.current);
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
    }, [songName, albumName, allowMarquee]);

    const shouldRun = allowMarquee && layout.overflow;
    const marqueeStyle = shouldRun
        ? {
            '--favorite-row-marquee-shift': `${layout.shift}px`,
            '--favorite-row-marquee-duration': `${layout.duration}s`
        }
        : undefined;

    const renderText = (withAlbum) => (
        <>
            <span className="album-list-row-name">{songName}</span>
            {withAlbum ? <span className="album-list-row-meta">{albumName}</span> : null}
        </>
    );

    return (
        <span
            ref={containerRef}
            className={`favorite-row-marquee ${shouldRun ? 'is-running' : ''}`}
            style={marqueeStyle}
        >
            {shouldRun ? (
                <span className="favorite-row-marquee-track">
                    <span className="favorite-row-marquee-item">
                        {renderText(layout.showAlbumRunning)}
                    </span>
                    <span className="favorite-row-marquee-gap" aria-hidden="true" />
                    <span className="favorite-row-marquee-item" aria-hidden="true">
                        {renderText(layout.showAlbumRunning)}
                    </span>
                </span>
            ) : (
                <span className="favorite-row-static">
                    {renderText(layout.showAlbumStatic)}
                </span>
            )}
            <span className="favorite-row-measure" aria-hidden="true">
                <span ref={songMeasureRef} className="favorite-row-measure-name">{songName}</span>
                {albumName ? (
                    <>
                        <span className="favorite-row-measure-gap"> </span>
                        <span ref={albumMeasureRef} className="favorite-row-measure-meta">{albumName}</span>
                    </>
                ) : null}
            </span>
        </span>
    );
};

const AlbumListOverlay = ({
    isOpen,
    onClose,
    album,
    currentTrack,
    isPlaying,
    playSongFromAlbum,
    tempPlaylistSet,
    tempPlaylistCount,
    tempPlaylistItems,
    onToggleTempSong,
    onToggleAlbumFavorites,
    onClearTempPlaylist,
    onPlayFavorites
}) => {
    const [activeTab, setActiveTab] = useState('album');
    const [hoveredAlbumSrc, setHoveredAlbumSrc] = useState('');
    const [hoveredFavoriteSrc, setHoveredFavoriteSrc] = useState('');
    const touchStartX = useRef(null);
    const safeTempCount = typeof tempPlaylistCount === 'number' ? tempPlaylistCount : 0;
    const safeTempItems = Array.isArray(tempPlaylistItems) ? tempPlaylistItems : [];
    const currentTrackSrc = currentTrack?.src || '';
    const albumId = album?.id || '';
    const albumSongIds = Array.isArray(album?.songs)
        ? album.songs.map((song) => song?.src).filter(Boolean)
        : [];
    const isAlbumFullyFavorited = albumSongIds.length > 0
        && albumSongIds.every((id) => tempPlaylistSet?.has(id));

    useEffect(() => {
        if (!isOpen || !albumId) return;
        setActiveTab('album');
    }, [isOpen, albumId]);

    useEffect(() => {
        if (!isOpen) {
            setHoveredAlbumSrc('');
            setHoveredFavoriteSrc('');
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || typeof document === 'undefined') return undefined;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || typeof window === 'undefined') return undefined;
        const handleKeydown = (event) => {
            if (event.key === 'Escape') onClose?.();
        };
        window.addEventListener('keydown', handleKeydown);
        return () => {
            window.removeEventListener('keydown', handleKeydown);
        };
    }, [isOpen, onClose]);

    if (!album) return null;

    const handleTouchStart = (event) => {
        touchStartX.current = event.touches[0]?.clientX ?? null;
    };

    const handleTouchEnd = (event) => {
        if (touchStartX.current == null) return;
        const endX = event.changedTouches[0]?.clientX ?? touchStartX.current;
        const delta = endX - touchStartX.current;
        if (Math.abs(delta) > 50) {
            setActiveTab(delta < 0 ? 'favorites' : 'album');
        }
        touchStartX.current = null;
    };

    const getRowClassName = (song) => {
        const isCurrentTrack = currentTrackSrc === song.src;
        const isPlayingTrack = isCurrentTrack && isPlaying;
        return [
            'album-list-row',
            isCurrentTrack ? 'is-current-track' : '',
            isPlayingTrack ? 'is-playing-track' : ''
        ].filter(Boolean).join(' ');
    };

    const renderPlayingStatus = (song) => (
        currentTrackSrc === song.src && isPlaying ? (
            <span className="playing-bars" aria-label="正在播放">
                <i></i><i></i><i></i><i></i>
            </span>
        ) : null
    );

    const renderAlbumList = ({ mobile = false } = {}) => (
        <>
            <div className={`album-list-subheader ${mobile ? 'is-mobile' : ''}`}>
                <div className="album-list-info">
                    {!mobile ? (
                        <>
                            <h4>当前专辑</h4>
                            <p>{`${album.name} · ${album.songs.length} 首`}</p>
                        </>
                    ) : (
                        <p className="album-list-mobile-main">{`${album.name} · ${album.songs.length} 首`}</p>
                    )}
                </div>
                <div className="album-list-actions">
                    <button
                        type="button"
                        className="album-play-btn"
                        onClick={(event) => {
                            event.stopPropagation();
                            if (!album.songs?.length) return;
                            playSongFromAlbum(album, album.songs[0]);
                        }}
                        disabled={!album.songs?.length}
                    >
                        播放全部
                    </button>
                    <button
                        type="button"
                        className={`album-fav-all-btn ${isAlbumFullyFavorited ? 'active' : ''}`}
                        onClick={(event) => {
                            event.stopPropagation();
                            onToggleAlbumFavorites?.(album.songs, event);
                        }}
                        disabled={!album.songs?.length}
                    >
                        {isAlbumFullyFavorited ? '取消收藏' : '收藏全部'}
                    </button>
                </div>
            </div>
            <div className="album-list-body">
                {album.songs.map((song, index) => (
                    <div
                        key={song.src}
                        className={getRowClassName(song)}
                        onClick={() => playSongFromAlbum(album, song)}
                        onPointerEnter={() => setHoveredAlbumSrc(song.src)}
                        onPointerLeave={() => {
                            setHoveredAlbumSrc((previous) => (
                                previous === song.src ? '' : previous
                            ));
                        }}
                    >
                        <span className="album-list-row-num">{index + 1}</span>
                        <span className="album-list-row-main is-marquee">
                            <FavoriteRowMarquee
                                songName={song.name}
                                albumName=""
                                allowMarquee={
                                    currentTrackSrc === song.src
                                    || hoveredAlbumSrc === song.src
                                }
                            />
                        </span>
                        <span className="album-list-row-actions">
                            <span className="album-list-row-status">{renderPlayingStatus(song)}</span>
                            <button
                                type="button"
                                className={`album-list-fav-btn ${tempPlaylistSet?.has(song.src) ? 'active' : ''}`}
                                aria-pressed={tempPlaylistSet?.has(song.src)}
                                aria-label={tempPlaylistSet?.has(song.src) ? '取消收藏' : '收藏'}
                                title={tempPlaylistSet?.has(song.src) ? '取消收藏' : '收藏'}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onToggleTempSong(song, event);
                                }}
                            >
                                <Heart
                                    size={18}
                                    strokeWidth={2}
                                    fill={tempPlaylistSet?.has(song.src) ? 'currentColor' : 'none'}
                                />
                            </button>
                        </span>
                    </div>
                ))}
            </div>
        </>
    );

    const renderFavoritesList = ({ mobile = false } = {}) => (
        <>
            <div className={`album-list-subheader ${mobile ? 'is-mobile' : ''}`}>
                <div className="album-list-info">
                    {!mobile ? (
                        <>
                            <h4>我的收藏</h4>
                            <p>{safeTempCount} 首</p>
                        </>
                    ) : (
                        <p className="album-list-mobile-tip">{`双击歌曲封面可加入收藏 · ${safeTempCount} 首`}</p>
                    )}
                </div>
                <div className="album-list-actions">
                    <button
                        type="button"
                        className="fav-play-btn"
                        onClick={(event) => {
                            event.stopPropagation();
                            onPlayFavorites?.();
                        }}
                        disabled={safeTempCount === 0}
                    >
                        播放收藏
                    </button>
                    {safeTempCount > 0 && (
                        <button
                            type="button"
                            className="temp-clear-btn"
                            onClick={(event) => {
                                event.stopPropagation();
                                if (typeof window !== 'undefined') {
                                    const shouldClear = window.confirm('确定要清空收藏吗？');
                                    if (!shouldClear) return;
                                }
                                onClearTempPlaylist?.(event);
                            }}
                        >
                            清空列表
                        </button>
                    )}
                </div>
            </div>
            <div className="album-list-body">
                {safeTempItems.length === 0 && (
                    <div className="song-empty">还没有添加歌曲</div>
                )}
                {safeTempItems.map((item, index) => (
                    <div
                        key={item.song.src}
                        className={getRowClassName(item.song)}
                        onClick={() => onPlayFavorites?.(item.song)}
                        onPointerEnter={() => setHoveredFavoriteSrc(item.song.src)}
                        onPointerLeave={() => {
                            setHoveredFavoriteSrc((previous) => (
                                previous === item.song.src ? '' : previous
                            ));
                        }}
                    >
                        <span className="album-list-row-num">{index + 1}</span>
                        <span className="album-list-row-main is-favorites">
                            <FavoriteRowMarquee
                                songName={item.song.name}
                                albumName={item.album?.name || ''}
                                allowMarquee={
                                    currentTrackSrc === item.song.src
                                    || hoveredFavoriteSrc === item.song.src
                                }
                            />
                        </span>
                        <span className="album-list-row-actions">
                            <span className="album-list-row-status">{renderPlayingStatus(item.song)}</span>
                            <button
                                type="button"
                                className="album-list-fav-btn active"
                                aria-pressed="true"
                                aria-label="取消收藏"
                                title="取消收藏"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onToggleTempSong(item.song, event);
                                }}
                            >
                                <Heart size={18} strokeWidth={2} fill="currentColor" />
                            </button>
                        </span>
                    </div>
                ))}
            </div>
        </>
    );

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <Motion.div
                    className="album-list-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                >
                    <Motion.div
                        className="album-list-panel"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="album-list-header">
                            <div className="album-list-header-label">播放列表</div>
                            <button className="album-list-close" onClick={onClose} aria-label="关闭">
                                <X size={18} />
                            </button>
                        </div>

                        <div
                            className="album-list-tabs"
                            role="tablist"
                            aria-label="歌曲列表视图切换"
                            data-active-tab={activeTab}
                        >
                            <span className="album-list-tab-slider" aria-hidden="true" />
                            <button
                                type="button"
                                className={`album-list-tab ${activeTab === 'album' ? 'active' : ''}`}
                                onClick={() => setActiveTab('album')}
                                role="tab"
                                aria-selected={activeTab === 'album'}
                                aria-controls="album-list-mobile-album"
                            >
                                当前专辑
                            </button>
                            <button
                                type="button"
                                className={`album-list-tab ${activeTab === 'favorites' ? 'active' : ''}`}
                                onClick={() => setActiveTab('favorites')}
                                role="tab"
                                aria-selected={activeTab === 'favorites'}
                                aria-controls="album-list-mobile-favorites"
                            >
                                我的收藏
                            </button>
                        </div>

                        <div className="album-list-desktop-layout">
                            <section className="album-list-main-column">
                                {renderAlbumList()}
                            </section>
                            <section className="album-list-favorites-column">
                                {renderFavoritesList()}
                            </section>
                        </div>

                        <div
                            className="album-list-mobile-layout"
                            data-active-tab={activeTab}
                            onTouchStart={handleTouchStart}
                            onTouchEnd={handleTouchEnd}
                        >
                            <section
                                id="album-list-mobile-album"
                                role="tabpanel"
                                className={`album-list-mobile-pane ${activeTab === 'album' ? 'active' : ''}`}
                                hidden={activeTab !== 'album'}
                            >
                                <div className="album-list-mobile-column">
                                    {renderAlbumList({ mobile: true })}
                                </div>
                            </section>
                            <section
                                id="album-list-mobile-favorites"
                                role="tabpanel"
                                className={`album-list-mobile-pane ${activeTab === 'favorites' ? 'active' : ''}`}
                                hidden={activeTab !== 'favorites'}
                            >
                                <div className="album-list-mobile-column">
                                    {renderFavoritesList({ mobile: true })}
                                </div>
                            </section>
                        </div>
                    </Motion.div>
                </Motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
};

export default AlbumListOverlay;

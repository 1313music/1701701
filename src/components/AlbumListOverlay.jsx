import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Heart, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
    onClearTempPlaylist,
    onPlayFavorites
}) => {
    if (!album) return null;
    const safeTempCount = typeof tempPlaylistCount === 'number' ? tempPlaylistCount : 0;
    const safeTempItems = Array.isArray(tempPlaylistItems) ? tempPlaylistItems : [];
    const [activeTab, setActiveTab] = useState('album');
    const touchStartX = useRef(null);

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

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="album-list-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                >
                    <motion.div
                        className="album-list-panel"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="album-list-header">
                            <div className="album-list-title">
                                <h3>{album.name}</h3>
                                <p>{album.artist} · {album.songs.length} 首歌</p>
                            </div>
                            <button className="album-list-close" onClick={onClose} aria-label="关闭">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="album-list-tabs">
                            <button
                                type="button"
                                className={`album-list-tab ${activeTab === 'album' ? 'active' : ''}`}
                                onClick={() => setActiveTab('album')}
                            >
                                当前专辑
                            </button>
                            <button
                                type="button"
                                className={`album-list-tab ${activeTab === 'favorites' ? 'active' : ''}`}
                                onClick={() => setActiveTab('favorites')}
                            >
                                我的收藏
                            </button>
                        </div>

                        <div
                            className="album-list-columns"
                            data-active-tab={activeTab}
                            onTouchStart={handleTouchStart}
                            onTouchEnd={handleTouchEnd}
                        >
                            <section className="album-list-column album-list-album">
                                <div className="album-list-subheader">
                                    <div>
                                        <h4>当前专辑</h4>
                                        <p>{album.name} · {album.songs.length} 首</p>
                                    </div>
                                    <div className="album-list-actions">
                                        <button
                                            type="button"
                                            className="album-play-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (!album.songs?.length) return;
                                                playSongFromAlbum(album, album.songs[0]);
                                            }}
                                            disabled={!album.songs?.length}
                                        >
                                            播放全部
                                        </button>
                                    </div>
                                </div>
                                <div className="album-list-body song-list">
                                    {album.songs.map((song, i) => (
                                        <div
                                            key={song.src}
                                            className={`song-item ${currentTrack.src === song.src ? 'active' : ''}`}
                                            onClick={() => playSongFromAlbum(album, song)}
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
                            </section>

                            <section className="album-list-column album-list-favorites">
                                <div className="album-list-subheader">
                                    <div>
                                        <h4>我的收藏</h4>
                                        <p>{safeTempCount} 首</p>
                                    </div>
                                    <div className="album-list-actions">
                                        <button
                                            type="button"
                                            className="fav-play-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
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
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onClearTempPlaylist();
                                                }}
                                            >
                                                清空
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="album-list-body song-list">
                                    {safeTempItems.length === 0 && (
                                        <div className="song-empty">还没有添加歌曲</div>
                                    )}
                                    {safeTempItems.map((item, i) => (
                                        <div
                                            key={item.song.src}
                                            className={`song-item ${currentTrack.src === item.song.src ? 'active' : ''}`}
                                            onClick={() => onPlayFavorites?.(item.song)}
                                        >
                                            <span className="song-num">{i + 1}</span>
                                            <span className="song-name">
                                                {item.song.name}
                                                <span className="song-meta">· {item.album.name}</span>
                                            </span>
                                            <span className="song-actions">
                                                <span className="song-status">
                                                    {currentTrack.src === item.song.src && isPlaying ? (
                                                        <span className="playing-bars" aria-label="正在播放">
                                                            <i></i><i></i><i></i><i></i>
                                                        </span>
                                                    ) : ''}
                                                </span>
                                                <button
                                                    type="button"
                                                    className="song-temp-btn active"
                                                    aria-pressed="true"
                                                    aria-label="取消收藏"
                                                    title="取消收藏"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onToggleTempSong(item.song, e);
                                                    }}
                                                >
                                                    <Heart size={16} strokeWidth={2} fill="currentColor" />
                                                </button>
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
};

export default AlbumListOverlay;

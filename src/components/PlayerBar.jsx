import React, { useState } from 'react';
import { Play, Pause, ListMusic, Share2, Heart, MessageCircle } from 'lucide-react';
import { Maximize2Icon } from './icons/AppIcons';
import { formatTime } from '../utils/formatUtils';

const PlayerBar = ({
    currentTrack,
    currentAlbum,
    isPlaying,
    handlePlayPause,
    progress,
    currentTime,
    duration,
    handleSeek,
    togglePlayMode,
    getPlayModeIcon,
    handlePrev,
    handleNext,
    setIsLyricsOpen,
    setIsAlbumListOpen,
    onToggleFavorite,
    isCurrentTrackFavorited,
    onOpenComments,
    onShare,
    isTrackNameOverflowing,
    trackNameRef
}) => {
    const ringProgress = Number.isFinite(progress) ? Math.min(Math.max(progress, 0), 100) : 0;
    const coverRingPath = 'M 10.736 10.736 A 23 23 0 0 1 27 4 H 73 A 23 23 0 0 1 96 27 V 73 A 23 23 0 0 1 73 96 H 27 A 23 23 0 0 1 4 73 V 27 A 23 23 0 0 1 10.736 10.736';
    const [isProgressHovered, setIsProgressHovered] = useState(false);
    const canShowTimeBadge = Number.isFinite(duration) && duration > 0;
    const formatPlayerBarTime = (time) => {
        const formatted = formatTime(time);
        return formatted.length < 5 ? `0${formatted}` : formatted;
    };

    return (
        <>
            <div className="progress-bar-wrapper">
                <div
                    className="progress-container"
                    onClick={handleSeek}
                    onMouseEnter={() => setIsProgressHovered(true)}
                    onMouseLeave={() => setIsProgressHovered(false)}
                >
                    <div className="progress-fill" style={{ width: `${progress}%` }}>
                        <div className="progress-dot" />
                    </div>
                    {canShowTimeBadge && (
                        <div
                            className={`progress-hover-time ${isProgressHovered ? 'is-visible' : ''}`}
                            style={{ left: `clamp(64px, ${ringProgress}%, calc(100% - 64px))` }}
                            aria-hidden="true"
                        >
                            {formatPlayerBarTime(currentTime)} / {formatPlayerBarTime(duration)}
                        </div>
                    )}
                </div>
            </div>

            <footer className="player-bar" onClick={() => setIsLyricsOpen(true)}>
                <div className="player-info">
                    <div
                        className="mini-cover"
                        onClick={() => setIsLyricsOpen(true)}
                    >
                        <svg className="mini-cover-ring" viewBox="0 0 100 100" aria-hidden="true">
                            <path className="mini-cover-ring-track" d={coverRingPath} pathLength="100" />
                            <path
                                className="mini-cover-ring-progress"
                                d={coverRingPath}
                                pathLength="100"
                                style={{ strokeDasharray: `${ringProgress} 100` }}
                            />
                        </svg>
                        <div className="mini-cover-media">
                            <img loading="lazy" src={currentTrack.cover || currentAlbum.cover} alt="cover" />
                        </div>
                        <button
                            type="button"
                            className="mini-cover-expand-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsLyricsOpen(true);
                            }}
                            aria-label="展开全屏播放器"
                        >
                            <Maximize2Icon size={18} />
                        </button>
                    </div>
                    <div className="track-details">
                        <span className="track-name" ref={trackNameRef}>
                            {isTrackNameOverflowing && isPlaying ? (
                                <span className="scrolling-text">
                                    {currentTrack.name} {' | '} {currentTrack.name}
                                </span>
                            ) : (
                                currentTrack.name
                            )}
                        </span>
                        <span className="artist-name">{currentAlbum.artist}</span>
                    </div>
                </div>

                <div className="player-controls" onClick={(e) => e.stopPropagation()}>
                    <div className="control-buttons">
                        <div className="icon-btn mode-btn" onClick={(e) => { e.stopPropagation(); togglePlayMode(); }}>
                            {getPlayModeIcon(24)}
                        </div>
                        <div className="icon-btn skip-back-btn" onClick={(e) => { e.stopPropagation(); handlePrev(); }}>
                            <Play size={20} fill="currentColor" style={{ transform: 'rotate(180deg)', marginRight: '-8px' }} />
                            <Play size={20} fill="currentColor" style={{ transform: 'rotate(180deg)' }} />
                        </div>
                        <div className="main-play-btn" onClick={(e) => { e.stopPropagation(); handlePlayPause(); }}>
                            {isPlaying
                                ? <Pause size={32} fill="currentColor" />
                                : <Play size={32} fill="currentColor" style={{ marginLeft: '4px' }} />}
                        </div>
                        <div className="icon-btn skip-forward-btn" onClick={(e) => { e.stopPropagation(); handleNext(); }}>
                            <Play size={20} fill="currentColor" style={{ marginRight: '-8px' }} />
                            <Play size={20} fill="currentColor" />
                        </div>
                        <div className="icon-btn playlist-btn" onClick={(e) => { e.stopPropagation(); setIsAlbumListOpen(true); }}>
                            <ListMusic size={22} strokeWidth={2.4} absoluteStrokeWidth />
                        </div>
                    </div>
                </div>

                <div className="player-actions">
                    <button
                        type="button"
                        className={`icon-btn favorite-btn ${isCurrentTrackFavorited ? 'active' : ''}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavorite?.(currentTrack, e);
                        }}
                        aria-label={isCurrentTrackFavorited ? '取消收藏当前歌曲' : '收藏当前歌曲'}
                    >
                        <Heart size={20} strokeWidth={2.2} absoluteStrokeWidth fill={isCurrentTrackFavorited ? 'currentColor' : 'none'} />
                    </button>
                    <button
                        type="button"
                        className="icon-btn comment-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            onOpenComments?.();
                        }}
                        aria-label="查看当前歌曲评论"
                    >
                        <MessageCircle size={20} strokeWidth={2.2} absoluteStrokeWidth />
                    </button>
                    <button
                        type="button"
                        className="icon-btn share-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            onShare?.(e);
                        }}
                        aria-label="分享当前歌曲"
                    >
                        <Share2 size={20} strokeWidth={2.2} absoluteStrokeWidth />
                    </button>
                </div>
            </footer>
        </>
    );
};

export default PlayerBar;

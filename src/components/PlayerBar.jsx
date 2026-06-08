import React, { useState } from 'react';
import { Play, Pause, ListMusic, Share2, Heart, MessageCircle } from 'lucide-react';
import { Maximize2Icon } from './icons/AppIcons';
import { formatTime } from '../utils/formatUtils';
import SleepTimerControl from './SleepTimerControl.jsx';

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
    trackNameRef,
    currentLyricText = '',
    sleepTimerRemainingMs = 0,
    onStartSleepTimer,
    onCancelSleepTimer
}) => {
    const ringProgress = Number.isFinite(progress) ? Math.min(Math.max(progress, 0), 100) : 0;
    const [isProgressHovered, setIsProgressHovered] = useState(false);
    const [hoverProgress, setHoverProgress] = useState(null);
    const canShowTimeBadge = Number.isFinite(duration) && duration > 0;
    const formatPlayerBarTime = (time) => {
        const formatted = formatTime(time);
        return formatted.length < 5 ? `0${formatted}` : formatted;
    };
    const getProgressFromPointer = (event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        if (!rect.width) return null;
        return Math.min(Math.max(((event.clientX - rect.left) / rect.width) * 100, 0), 100);
    };
    const handleProgressMouseMove = (event) => {
        const nextProgress = getProgressFromPointer(event);
        if (nextProgress == null) return;
        setIsProgressHovered(true);
        setHoverProgress(nextProgress);
    };
    const handleProgressMouseEnter = (event) => {
        setIsProgressHovered(true);
        handleProgressMouseMove(event);
    };
    const handleProgressMouseLeave = () => {
        setIsProgressHovered(false);
        setHoverProgress(null);
    };
    const previewProgress = hoverProgress ?? ringProgress;
    const previewTime = canShowTimeBadge
        ? (hoverProgress == null ? currentTime : (duration * previewProgress) / 100)
        : currentTime;

    return (
        <>
            <div className="progress-bar-wrapper">
                <div
                    className="progress-container"
                    onClick={handleSeek}
                    onMouseEnter={handleProgressMouseEnter}
                    onMouseMove={handleProgressMouseMove}
                    onMouseLeave={handleProgressMouseLeave}
                >
                    <div className="progress-fill" style={{ width: `${ringProgress}%` }}>
                        <div className="progress-dot" />
                    </div>
                    {canShowTimeBadge && (
                        <div
                            className={`progress-hover-time ${isProgressHovered ? 'is-visible' : ''}`}
                            style={{ left: `clamp(64px, ${previewProgress}%, calc(100% - 64px))` }}
                            aria-hidden="true"
                        >
                            {formatPlayerBarTime(previewTime)} / {formatPlayerBarTime(duration)}
                        </div>
                    )}
                </div>
            </div>

            <footer className={`player-bar ${isPlaying ? 'is-playing' : ''}`} onClick={() => setIsLyricsOpen(true)}>
                <div className="player-info">
                    <div
                        className={`mini-cover ${isPlaying ? 'is-playing' : ''}`}
                        onClick={() => setIsLyricsOpen(true)}
                    >
                        <svg className="mini-cover-ring" viewBox="0 0 100 100" aria-hidden="true">
                            <circle className="mini-cover-ring-track" cx="50" cy="50" r="46" pathLength="100" />
                            <circle
                                className="mini-cover-ring-progress"
                                cx="50"
                                cy="50"
                                r="46"
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
                        <span className="mobile-current-lyric">{currentLyricText || currentAlbum.artist}</span>
                    </div>
                </div>

                <div className="player-controls" onClick={(e) => e.stopPropagation()}>
                    <div className="control-buttons">
                        <button
                            type="button"
                            className="icon-btn mode-btn"
                            onClick={togglePlayMode}
                            aria-label="切换播放模式"
                        >
                            {getPlayModeIcon(24)}
                        </button>
                        <button
                            type="button"
                            className="icon-btn skip-back-btn"
                            onClick={handlePrev}
                            aria-label="上一首"
                        >
                            <Play size={20} fill="currentColor" style={{ transform: 'rotate(180deg)', marginRight: '-8px' }} />
                            <Play size={20} fill="currentColor" style={{ transform: 'rotate(180deg)' }} />
                        </button>
                        <button
                            type="button"
                            className="main-play-btn"
                            onClick={handlePlayPause}
                            aria-label={isPlaying ? '暂停播放' : '播放'}
                        >
                            {isPlaying
                                ? <Pause size={32} fill="currentColor" />
                                : <Play size={32} fill="currentColor" style={{ marginLeft: '4px' }} />}
                        </button>
                        <button
                            type="button"
                            className="icon-btn skip-forward-btn"
                            onClick={handleNext}
                            aria-label="下一首"
                        >
                            <Play size={20} fill="currentColor" style={{ marginRight: '-8px' }} />
                            <Play size={20} fill="currentColor" />
                        </button>
                        <button
                            type="button"
                            className="icon-btn playlist-btn"
                            onClick={() => setIsAlbumListOpen(true)}
                            aria-label="打开收藏歌单"
                        >
                            <ListMusic size={22} strokeWidth={2.4} absoluteStrokeWidth />
                        </button>
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
                    <SleepTimerControl
                        remainingMs={sleepTimerRemainingMs}
                        onStartSleepTimer={onStartSleepTimer}
                        onCancelSleepTimer={onCancelSleepTimer}
                    />
                </div>
            </footer>
        </>
    );
};

export default PlayerBar;

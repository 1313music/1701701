import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ListMusic, Share2, Heart, MessageSquareMore, Volume1, Volume2, VolumeX } from 'lucide-react';
import { ApplePauseIcon, ApplePlayIcon, AppleSkipIcon, Maximize2Icon } from './icons/AppIcons';
import { formatTime } from '../utils/formatUtils';
import SleepTimerControl from './SleepTimerControl.jsx';

const normalizeVolume = (value) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return 1;
    return Math.min(Math.max(numericValue, 0), 1);
};

const VolumeControl = ({
    volume = 1,
    isMuted = false,
    onVolumeChange,
    onToggleMuted
}) => {
    const rootRef = useRef(null);
    const sliderRef = useRef(null);
    const closeTimerRef = useRef(null);
    const sliderId = useId();
    const [isOpen, setIsOpen] = useState(false);
    const [isDraggingVolume, setIsDraggingVolume] = useState(false);
    const safeVolume = normalizeVolume(volume);
    const effectiveVolume = isMuted ? 0 : safeVolume;
    const volumePercent = Math.round(effectiveVolume * 100);
    const VolumeIcon = volumePercent === 0 ? VolumeX : volumePercent < 50 ? Volume1 : Volume2;

    const clearCloseTimer = useCallback(() => {
        if (closeTimerRef.current == null || typeof window === 'undefined') return;
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
    }, []);
    const openVolumeControl = useCallback(() => {
        clearCloseTimer();
        setIsOpen(true);
    }, [clearCloseTimer]);
    const scheduleCloseVolumeControl = useCallback(() => {
        if (typeof window === 'undefined') {
            setIsOpen(false);
            return;
        }
        clearCloseTimer();
        closeTimerRef.current = window.setTimeout(() => {
            setIsOpen(false);
            closeTimerRef.current = null;
        }, 500);
    }, [clearCloseTimer]);
    const updateVolumeFromPointer = useCallback((event) => {
        const rect = sliderRef.current?.getBoundingClientRect();
        if (!rect?.height) return;
        const nextVolume = normalizeVolume(1 - ((event.clientY - rect.top) / rect.height));
        onVolumeChange?.(nextVolume);
    }, [onVolumeChange]);
    const updateVolumeFromKeyboard = useCallback((event) => {
        const keyStepMap = {
            ArrowUp: 0.05,
            ArrowRight: 0.05,
            ArrowDown: -0.05,
            ArrowLeft: -0.05,
            PageUp: 0.1,
            PageDown: -0.1
        };
        if (event.key === 'Home') {
            event.preventDefault();
            onVolumeChange?.(0);
            return;
        }
        if (event.key === 'End') {
            event.preventDefault();
            onVolumeChange?.(1);
            return;
        }
        const step = keyStepMap[event.key];
        if (!step) return;
        event.preventDefault();
        onVolumeChange?.(normalizeVolume(effectiveVolume + step));
    }, [effectiveVolume, onVolumeChange]);

    useEffect(() => {
        if (!isOpen || typeof document === 'undefined') return undefined;
        const handlePointerDown = (event) => {
            if (rootRef.current?.contains(event.target)) return;
            setIsOpen(false);
        };
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    useEffect(() => () => {
        clearCloseTimer();
    }, [clearCloseTimer]);

    return (
        <div
            className={`volume-control ${isOpen ? 'is-open' : ''}`}
            ref={rootRef}
            onMouseEnter={openVolumeControl}
            onMouseLeave={scheduleCloseVolumeControl}
            onFocus={openVolumeControl}
        >
            <button
                type="button"
                className={`icon-btn volume-btn ${isMuted || volumePercent === 0 ? 'is-muted' : ''}`}
                onClick={(event) => {
                    event.stopPropagation();
                    openVolumeControl();
                    onToggleMuted?.();
                }}
                aria-label={isMuted || volumePercent === 0 ? `取消静音，当前音量 ${volumePercent}%` : `静音，当前音量 ${volumePercent}%`}
                aria-expanded={isOpen}
                aria-controls={sliderId}
                title="音量"
            >
                <VolumeIcon size={20} strokeWidth={2.2} absoluteStrokeWidth />
            </button>
            <div
                className="volume-popover"
                role="group"
                aria-label="音量调节"
                onClick={(event) => event.stopPropagation()}
                style={{ '--volume-level': `${volumePercent}%` }}
            >
                <div
                    id={sliderId}
                    ref={sliderRef}
                    className="volume-slider"
                    role="slider"
                    tabIndex={0}
                    aria-label="音量"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={volumePercent}
                    aria-orientation="vertical"
                    onPointerDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        openVolumeControl();
                        setIsDraggingVolume(true);
                        event.currentTarget.setPointerCapture?.(event.pointerId);
                        updateVolumeFromPointer(event);
                    }}
                    onPointerMove={(event) => {
                        if (!isDraggingVolume) return;
                        event.preventDefault();
                        updateVolumeFromPointer(event);
                    }}
                    onPointerUp={(event) => {
                        setIsDraggingVolume(false);
                        event.currentTarget.releasePointerCapture?.(event.pointerId);
                    }}
                    onPointerCancel={(event) => {
                        setIsDraggingVolume(false);
                        event.currentTarget.releasePointerCapture?.(event.pointerId);
                    }}
                    onKeyDown={updateVolumeFromKeyboard}
                >
                    <span className="volume-slider-track" aria-hidden="true" />
                    <span className="volume-slider-fill" aria-hidden="true" />
                    <span className="volume-slider-thumb" aria-hidden="true" />
                </div>
                <span className="volume-value" aria-hidden="true">
                    {volumePercent}
                </span>
            </div>
        </div>
    );
};

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
    onCancelSleepTimer,
    volume = 1,
    isMuted = false,
    onVolumeChange,
    onToggleMuted
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
                    <button
                        type="button"
                        className={`icon-btn favorite-btn track-favorite-btn ${isCurrentTrackFavorited ? 'active' : ''}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavorite?.(currentTrack, e);
                        }}
                        aria-label={isCurrentTrackFavorited ? '取消收藏当前歌曲' : '收藏当前歌曲'}
                    >
                        <Heart size={20} strokeWidth={2.2} absoluteStrokeWidth fill={isCurrentTrackFavorited ? 'currentColor' : 'none'} />
                    </button>
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
                            <AppleSkipIcon direction="prev" />
                        </button>
                        <button
                            type="button"
                            className="main-play-btn"
                            onClick={handlePlayPause}
                            aria-label={isPlaying ? '暂停播放' : '播放'}
                        >
                            {isPlaying
                                ? <ApplePauseIcon />
                                : <ApplePlayIcon />}
                        </button>
                        <button
                            type="button"
                            className="icon-btn skip-forward-btn"
                            onClick={handleNext}
                            aria-label="下一首"
                        >
                            <AppleSkipIcon />
                        </button>
                        <button
                            type="button"
                            className="icon-btn playlist-btn"
                            onClick={() => setIsAlbumListOpen(true)}
                            aria-label="打开播放列表"
                        >
                            <ListMusic size={22} strokeWidth={2.4} absoluteStrokeWidth />
                        </button>
                    </div>
                </div>

                <div className="player-actions">
                    <SleepTimerControl
                        remainingMs={sleepTimerRemainingMs}
                        onStartSleepTimer={onStartSleepTimer}
                        onCancelSleepTimer={onCancelSleepTimer}
                    />
                    <VolumeControl
                        volume={volume}
                        isMuted={isMuted}
                        onVolumeChange={onVolumeChange}
                        onToggleMuted={onToggleMuted}
                    />
                    <button
                        type="button"
                        className="icon-btn comment-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            onOpenComments?.();
                        }}
                        aria-label="查看当前歌曲评论"
                    >
                        <MessageSquareMore size={20} strokeWidth={2.2} absoluteStrokeWidth />
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

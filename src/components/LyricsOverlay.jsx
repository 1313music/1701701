import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Play, Pause, ListMusic } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatTime } from '../utils/formatUtils';

const LyricsOverlay = ({
    isLyricsOpen,
    setIsLyricsOpen,
    currentTrack,
    currentAlbum,
    isPlaying,
    handlePlayPause,
    progress,
    currentTime,
    duration,
    lyrics,
    currentLyricIndex,
    handleSeek,
    togglePlayMode,
    getPlayModeIcon,
    handlePrev,
    handleNext,
    audioRef,
    setIsAlbumListOpen
}) => {
    const isDraggingRef = useRef(false);
    const lastTouchRef = useRef(0);
    const [isDragActive, setIsDragActive] = useState(false);
    const mobileTitleRef = useRef(null);
    const [isMobileTitleMarquee, setIsMobileTitleMarquee] = useState(false);
    const lyricsWrapRef = useRef(null);
    const lyricsScrollerRef = useRef(null);
    const [centerOffset, setCenterOffset] = useState(0);

    const seekByClientX = (clientX, target) => {
        if (!target || !audioRef.current) return;
        const rect = target.getBoundingClientRect();
        const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
        audioRef.current.currentTime = ratio * duration;
    };

    const startDrag = (clientX, target, moveEvent, upEvent, getClientX, options) => {
        if (isDraggingRef.current) return;
        isDraggingRef.current = true;
        seekByClientX(clientX, target);
        setIsDragActive(true);

        const onMove = (moveEventObj) => {
            if (!isDraggingRef.current) return;
            if (moveEventObj.cancelable) moveEventObj.preventDefault();
            const nextX = getClientX(moveEventObj);
            if (typeof nextX === 'number') seekByClientX(nextX, target);
        };
        const onUp = (upEventObj) => {
            const endX = getClientX(upEventObj);
            if (typeof endX === 'number') seekByClientX(endX, target);
            isDraggingRef.current = false;
            setIsDragActive(false);
            window.removeEventListener(moveEvent, onMove, options);
            window.removeEventListener(upEvent, onUp, options);
        };

        window.addEventListener(moveEvent, onMove, options);
        window.addEventListener(upEvent, onUp, options);
    };

    const handlePointerDown = (e) => {
        if (isDraggingRef.current) return;
        e.preventDefault();
        startDrag(
            e.clientX,
            e.currentTarget,
            'pointermove',
            'pointerup',
            (ev) => ev.clientX
        );
    };

    const handleMouseDown = (e) => {
        if (Date.now() - lastTouchRef.current < 500) return;
        if (isDraggingRef.current) return;
        e.preventDefault();
        startDrag(
            e.clientX,
            e.currentTarget,
            'mousemove',
            'mouseup',
            (ev) => ev.clientX
        );
    };

    const handleTouchStart = (e) => {
        if (isDraggingRef.current) return;
        const touch = e.touches[0];
        if (!touch) return;
        lastTouchRef.current = Date.now();
        const options = { passive: false };
        startDrag(
            touch.clientX,
            e.currentTarget,
            'touchmove',
            'touchend',
            (ev) => {
                const t = ev.touches && ev.touches[0] ? ev.touches[0] : ev.changedTouches && ev.changedTouches[0];
                return t ? t.clientX : undefined;
            },
            options
        );
    };

    useLayoutEffect(() => {
        if (!isLyricsOpen) return;
        const updateOffset = () => {
            const scroller = lyricsScrollerRef.current;
            const wrap = lyricsWrapRef.current;
            if (!scroller || !wrap) return;
            const active = wrap.querySelector('.lyric-line.active');
            if (!active) return;
            const scrollerHeight = scroller.clientHeight || 0;
            const activeCenter = active.offsetTop + active.offsetHeight / 2;
            const offset = scrollerHeight / 2 - activeCenter;
            setCenterOffset(offset);
        };
        updateOffset();
        window.addEventListener('resize', updateOffset);
        return () => window.removeEventListener('resize', updateOffset);
    }, [isLyricsOpen, lyrics.length, currentLyricIndex]);

    useLayoutEffect(() => {
        if (!isLyricsOpen) return;
        const node = mobileTitleRef.current;
        if (!node) return;
        const update = () => {
            const isOverflow = node.scrollWidth > node.clientWidth + 2;
            setIsMobileTitleMarquee(isOverflow);
        };
        update();
        const ro = new ResizeObserver(update);
        ro.observe(node);
        return () => ro.disconnect();
    }, [isLyricsOpen, currentTrack.name]);
    // 使用 Portal 渲染到 body，确保不受父级样式限制（如 overflow, transform 等），实现真正的全屏
    return createPortal(
        <AnimatePresence>
            {isLyricsOpen && (
                <motion.div
                    className="lyrics-overlay mobile-fullscreen-player"
                    initial={{ opacity: 0, y: '100%' }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: '100%' }}
                    transition={{ type: 'tween', duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    style={{
                        '--cover-image': `url(${currentTrack.cover || currentAlbum.cover})`
                    }}
                >
                    <div className="noise-overlay"></div>

                    <div className="overlay-header">
                        <button
                            className="close-btn"
                            onClick={() => setIsLyricsOpen(false)}
                            aria-label="收起"
                        >
                            <svg
                                className="collapse-icon"
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 90.64 30.831"
                                width="24"
                                height="8"
                                aria-hidden="true"
                            >
                                <path d="m4.486 14.456 32.352 13.938c3.156 1.387 5.552 2.437 8.48 2.437 2.932 0 5.357-1.05 8.484-2.437l32.353-13.938c2.612-1.192 4.485-3.514 4.485-6.42C90.64 3.184 87.085 0 83 0c-2.279 0-5.172 1.325-7.569 2.42L42.845 16.358h4.95L15.21 2.42C12.812 1.325 9.948 0 7.636 0 3.55 0 0 3.184 0 8.036c0 2.906 1.873 5.228 4.486 6.42z"></path>
                            </svg>
                        </button>
                        <div style={{ flex: 1 }}></div>
                    </div>

                    <div className="mobile-player-content">
                        <div className="mobile-cover-section">
                            <motion.div
                                className="mobile-xl-cover"
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ duration: 0.4 }}
                            >
                                <img loading="lazy" src={currentTrack.cover || currentAlbum.cover} alt="cover" />
                            </motion.div>
                        </div>

                        <div className="mobile-track-info">
                            <h1
                                className={`mobile-track-name ${isMobileTitleMarquee ? 'is-marquee' : ''}`}
                                ref={mobileTitleRef}
                            >
                                <span data-text={currentTrack.name}>{currentTrack.name}</span>
                            </h1>
                        </div>

                        <div className="mobile-lyrics-section">
                            {lyrics.length > 0 ? (
                                <div className="mobile-lyrics-display">
                                    {lyrics.slice(Math.max(0, currentLyricIndex - 1), currentLyricIndex + 2).map((l, i) => {
                                        const actualIndex = Math.max(0, currentLyricIndex - 1) + i;
                                        return (
                                            <div
                                                key={i}
                                                className={`mobile-lyric-line ${actualIndex === currentLyricIndex ? 'active' : ''}`}
                                                onClick={(e) => { e.stopPropagation(); audioRef.current.currentTime = l.time; }}
                                            >
                                                {l.text}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="mobile-no-lyrics">暂无歌词</div>
                            )}
                        </div>

                        <div className="mobile-player-controls">
                            <div className="mobile-progress-section">
                                <div
                                    className={`mobile-progress-bar ${isDragActive ? 'is-dragging' : ''}`}
                                    onClick={handleSeek}
                                    onPointerDown={handlePointerDown}
                                    onMouseDown={handleMouseDown}
                                    onTouchStart={handleTouchStart}
                                >
                                    <div className="mobile-progress-fill" style={{ width: `${progress}%` }} />
                                    <div className={`mobile-progress-thumb ${isDragActive ? 'is-visible' : ''}`} style={{ left: `${progress}%` }} />
                                </div>
                                <div className="mobile-time-display">
                                    <span>{formatTime(currentTime)}</span>
                                    <span>{formatTime(duration)}</span>
                                </div>
                            </div>

                            <div className="mobile-control-buttons">
                                <button className="mobile-mode-btn" onClick={togglePlayMode}>
                                    {getPlayModeIcon(24)}
                                </button>
                                <button className="mobile-control-btn" onClick={handlePrev}>
                                    <Play size={24} fill="currentColor" style={{ transform: 'rotate(180deg)', marginRight: '-8px' }} />
                                    <Play size={24} fill="currentColor" style={{ transform: 'rotate(180deg)' }} />
                                </button>
                                <button className="mobile-play-btn" onClick={handlePlayPause}>
                                    {isPlaying ? <Pause size={36} fill="currentColor" /> : <Play size={36} fill="currentColor" style={{ marginLeft: '4px' }} />}
                                </button>
                                <button className="mobile-control-btn" onClick={handleNext}>
                                    <Play size={24} fill="currentColor" style={{ marginRight: '-8px' }} />
                                    <Play size={24} fill="currentColor" />
                                </button>
                                <button className="mobile-playlist-btn" onClick={() => setIsAlbumListOpen(true)}>
                                    <ListMusic size={24} strokeWidth={2.4} absoluteStrokeWidth />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* 桌面端内容 */}
                    <div className="desktop-player-content">
                        <div className="album-view">
                            <div className="xl-cover">
                                <img loading="lazy" src={currentTrack.cover || currentAlbum.cover} alt="cover" />
                            </div>

                            <div className="track-meta" style={{ textAlign: 'center', marginTop: 20 }}>
                                <h2>{currentTrack.name}</h2>
                                <p>{currentAlbum.artist} - {currentAlbum.name}</p>
                            </div>

                            <div className="overlay-controls">
                            <div
                                className={`overlay-progress-container ${isDragActive ? 'is-dragging' : ''}`}
                                onClick={handleSeek}
                                onPointerDown={handlePointerDown}
                                onMouseDown={handleMouseDown}
                                onTouchStart={handleTouchStart}
                            >
                                <div className="overlay-progress-fill" style={{ width: `${progress}%` }} />
                                <div className={`overlay-progress-thumb ${isDragActive ? 'is-visible' : ''}`} style={{ left: `${progress}%` }} />
                                <div className="overlay-time-info">
                                    <span>{formatTime(currentTime)}</span>
                                    <span>{formatTime(duration)}</span>
                                </div>
                            </div>
                                <div className="overlay-buttons">
                                    <div className="icon-btn" onClick={togglePlayMode}>
                                        {getPlayModeIcon(24)}
                                    </div>
                                    <div className="icon-btn" onClick={handlePrev}>
                                        <Play size={24} fill="currentColor" style={{ transform: 'rotate(180deg)', marginRight: '-8px' }} />
                                        <Play size={24} fill="currentColor" style={{ transform: 'rotate(180deg)' }} />
                                    </div>
                                    <div className="overlay-play-btn" onClick={handlePlayPause}>
                                        {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" style={{ marginLeft: '6px' }} />}
                                    </div>
                                    <div className="icon-btn" onClick={handleNext}>
                                        <Play size={24} fill="currentColor" style={{ marginRight: '-8px' }} />
                                        <Play size={24} fill="currentColor" />
                                    </div>
                                    <div className="icon-btn" onClick={() => setIsAlbumListOpen(true)}>
                                        <ListMusic size={24} strokeWidth={2.4} absoluteStrokeWidth />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="lyrics-view desktop-lyrics">
                            <div
                                className={`lyrics-scroller ${lyrics.length > 0 ? '' : 'is-empty'}`}
                                ref={lyricsScrollerRef}
                            >
                                {lyrics.length > 0 ? (
                                    <div
                                        ref={lyricsWrapRef}
                                        style={{
                                            transform: `translateY(${centerOffset}px)`,
                                            transition: 'transform 0.1s linear',
                                            willChange: 'transform'
                                        }}
                                    >
                                        {lyrics.map((l, i) => (
                                            <div
                                                key={i}
                                                className={`lyric-line ${i === currentLyricIndex ? 'active' : ''}`}
                                                onClick={() => { audioRef.current.currentTime = l.time; }}
                                            >
                                                {l.text}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="no-lyrics">暂无歌词</div>
                                )}
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
};

export default LyricsOverlay;

import React from 'react';
import { Play, Pause, ListMusic, Maximize2 } from 'lucide-react';

const PlayerBar = ({
    currentTrack,
    currentAlbum,
    isPlaying,
    handlePlayPause,
    progress,
    handleSeek,
    togglePlayMode,
    getPlayModeIcon,
    handlePrev,
    handleNext,
    setIsLyricsOpen,
    setIsAlbumListOpen,
    isTrackNameOverflowing,
    trackNameRef
}) => {
    return (
        <>
            <div className="progress-bar-wrapper">
                <div className="progress-container" onClick={handleSeek}>
                    <div className="progress-fill" style={{ width: `${progress}%` }}>
                        <div className="progress-dot" />
                    </div>
                </div>
            </div>

            <footer className="player-bar" onClick={() => setIsLyricsOpen(true)}>
                <div className="player-info">
                    <div
                        className="mini-cover"
                        onClick={() => setIsLyricsOpen(true)}
                    >
                        <img loading="lazy" src={currentTrack.cover || currentAlbum.cover} alt="cover" />
                    </div>
                    <div className="track-details">
                        <span className="track-name" ref={trackNameRef}>
                            {isTrackNameOverflowing && isPlaying ? (
                                <span className="scrolling-text">
                                    {currentTrack.name}　　　　{currentTrack.name}
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
                            {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" style={{ marginLeft: '4px' }} />}
                        </div>
                        <div className="icon-btn skip-forward-btn" onClick={(e) => { e.stopPropagation(); handleNext(); }}>
                            <Play size={20} fill="currentColor" style={{ marginRight: '-8px' }} />
                            <Play size={20} fill="currentColor" />
                        </div>
                        <div className="icon-btn playlist-btn" onClick={(e) => { e.stopPropagation(); setIsAlbumListOpen(true); }}>
                            <ListMusic size={24} color="currentColor" strokeWidth={2.4} absoluteStrokeWidth />
                        </div>
                    </div>
                </div>

                <div className="player-actions">
                    <Maximize2 size={20} className="icon-btn" onClick={(e) => { e.stopPropagation(); setIsLyricsOpen(true); }} />
                </div>
            </footer>
        </>
    );
};

export default PlayerBar;

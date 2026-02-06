import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { motion } from 'framer-motion';

const AlbumDetail = ({ selectedAlbum, currentTrack, isPlaying, playSongFromAlbum, setView }) => {
    return (
        <motion.div key="album" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div onClick={() => setView('home')} className="back-btn">
                <ChevronLeft size={20} /> 返回首页
            </div>

            <div className="album-detail-header">
                <img loading="lazy" src={selectedAlbum.cover} className="album-cover-img" alt={selectedAlbum.name} />
                <div className="album-info-text">
                    <h1 className="album-title">{selectedAlbum.name}</h1>
                    <p className="album-metadata">{selectedAlbum.artist} • {selectedAlbum.songs.length} 首歌</p>
                    <button onClick={() => playSongFromAlbum(selectedAlbum, selectedAlbum.songs[0])} className="play-all-btn">播放全部</button>
                </div>
            </div>

            <div className="song-list">
                {selectedAlbum.songs.map((song, i) => (
                    <div
                        key={song.src}
                        className={`song-item ${currentTrack.src === song.src ? 'active' : ''}`}
                        onClick={() => playSongFromAlbum(selectedAlbum, song)}
                    >
                        <span className="song-num">{i + 1}</span>
                        <span className="song-name">{song.name}</span>
                        <span className="song-status">
                            {currentTrack.src === song.src && isPlaying ? '正在播放' : ''}
                        </span>
                    </div>
                ))}
            </div>
        </motion.div>
    );
};

export default AlbumDetail;

import { useEffect, useMemo, useRef, useState } from 'react';

import { parseLyrics } from '../utils/lyricUtils';

export const useAudioLyricsState = ({ currentLyricsUrl, currentTime, currentTrackSrc }) => {
  const [lyrics, setLyrics] = useState([]);
  const lyricsRequestIdRef = useRef(0);

  const currentLyricIndex = useMemo(() => {
    const index = lyrics.findIndex((line, i) => (
      currentTime >= line.time && (!lyrics[i + 1] || currentTime < lyrics[i + 1].time)
    ));
    return index === -1 ? 0 : index;
  }, [currentTime, lyrics]);

  useEffect(() => {
    if (!currentTrackSrc) return;
    let canceled = false;
    const requestId = ++lyricsRequestIdRef.current;
    const loadLyrics = async () => {
      if (!currentLyricsUrl) {
        await Promise.resolve();
        if (canceled || lyricsRequestIdRef.current !== requestId) return;
        setLyrics([]);
        return;
      }

      try {
        const response = await fetch(currentLyricsUrl);
        const text = await response.text();
        if (canceled || lyricsRequestIdRef.current !== requestId) return;
        setLyrics(parseLyrics(text));
      } catch {
        if (canceled || lyricsRequestIdRef.current !== requestId) return;
        setLyrics([]);
      }
    };

    void loadLyrics();
    return () => {
      canceled = true;
    };
  }, [currentLyricsUrl, currentTrackSrc]);

  return {
    lyrics,
    currentLyricIndex
  };
};

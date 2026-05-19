import { useEffect, useState } from 'react';

import { isAnnouncementActive, loadAnnouncement } from '../data/announcementSource.js';

const ANNOUNCEMENT_READ_KEY = 'announcement:last-read-id:v1';
const DEFAULT_POLL_INTERVAL_MS = 5 * 60 * 1000;

const shouldAutoOpenAnnouncement = (announcement) => (
  isAnnouncementActive(announcement)
  && announcement?.deliveryMode !== 'silent'
);

const readDismissedAnnouncementId = () => {
  if (typeof window === 'undefined') return '';

  try {
    return String(window.localStorage.getItem(ANNOUNCEMENT_READ_KEY) || '');
  } catch {
    return '';
  }
};

const persistDismissedAnnouncementId = (announcementId) => {
  if (typeof window === 'undefined' || !announcementId) return;

  try {
    window.localStorage.setItem(ANNOUNCEMENT_READ_KEY, announcementId);
  } catch {
    // ignore storage failures
  }
};

export const useAnnouncement = ({ pollIntervalMs = DEFAULT_POLL_INTERVAL_MS } = {}) => {
  const [announcement, setAnnouncement] = useState(null);
  const [announcementHistory, setAnnouncementHistory] = useState([]);
  const [isAnnouncementOpen, setIsAnnouncementOpen] = useState(false);
  const [isLoadingAnnouncement, setIsLoadingAnnouncement] = useState(true);
  const [dismissedAnnouncementId, setDismissedAnnouncementId] = useState(readDismissedAnnouncementId);

  useEffect(() => {
    let cancelled = false;

    const refreshAnnouncement = async (signal) => {
      try {
        const result = await loadAnnouncement({ signal });
        if (cancelled) return;

        const nextAnnouncement = result.announcement;
        setAnnouncement(nextAnnouncement);
        setAnnouncementHistory(Array.isArray(result.history) ? result.history : []);

        if (!isAnnouncementActive(nextAnnouncement)) {
          setIsAnnouncementOpen(false);
          return;
        }

        const lastReadId = readDismissedAnnouncementId();
        setDismissedAnnouncementId(lastReadId);
        if (lastReadId === nextAnnouncement.id) {
          setIsAnnouncementOpen(false);
          return;
        }

        setIsAnnouncementOpen((wasOpen) => wasOpen || shouldAutoOpenAnnouncement(nextAnnouncement));
      } catch {
        if (cancelled) return;
      } finally {
        if (!cancelled) {
          setIsLoadingAnnouncement(false);
        }
      }
    };

    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    void refreshAnnouncement(controller?.signal);

    if (!(pollIntervalMs > 0)) {
      return () => {
        cancelled = true;
        controller?.abort();
      };
    }

    const timerId = window.setInterval(() => {
      void refreshAnnouncement();
    }, pollIntervalMs);

    return () => {
      cancelled = true;
      controller?.abort();
      window.clearInterval(timerId);
    };
  }, [pollIntervalMs]);

  const dismissAnnouncement = () => {
    if (announcement?.id) {
      persistDismissedAnnouncementId(announcement.id);
      setDismissedAnnouncementId(announcement.id);
    }
    setIsAnnouncementOpen(false);
  };

  const openAnnouncement = () => {
    if (isAnnouncementActive(announcement)) {
      setIsAnnouncementOpen(true);
    }
  };

  const hasActiveAnnouncement = isAnnouncementActive(announcement);
  const isAnnouncementUnread = Boolean(
    hasActiveAnnouncement
    && announcement?.id
    && dismissedAnnouncementId !== announcement.id
  );

  return {
    announcement,
    announcementHistory,
    hasActiveAnnouncement,
    isAnnouncementOpen,
    isAnnouncementUnread,
    isLoadingAnnouncement,
    dismissAnnouncement,
    openAnnouncement
  };
};

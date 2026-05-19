import React, { useCallback, useEffect, useState } from 'react';

const isExternalUrl = (value) => /^https?:\/\//i.test(String(value || '').trim());

const renderAnnouncementParagraphs = (content) => (
  String(content || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
);

const getAnnouncementDate = (announcement) => (
  announcement?.archivedAt
  || announcement?.updatedAt
  || announcement?.startAt
  || announcement?.endAt
  || ''
);

const formatAnnouncementDate = (announcement) => {
  const date = new Date(getAnnouncementDate(announcement));
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
};

const getAnnouncementPreview = (content) => {
  const preview = renderAnnouncementParagraphs(content).join(' ');
  if (preview.length <= 56) return preview;
  return `${preview.slice(0, 56)}...`;
};

const AnnouncementModal = ({ announcement, history = [], open = false, onConfirm }) => {
  const [selectedHistoryId, setSelectedHistoryId] = useState('');
  const handleClose = useCallback(() => {
    setSelectedHistoryId('');
    onConfirm?.();
  }, [onConfirm, setSelectedHistoryId]);

  useEffect(() => {
    if (!open || announcement?.force) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [announcement?.force, handleClose, open]);

  if (!open || !announcement) return null;

  const historyItems = Array.isArray(history) ? history : [];
  const selectedHistory = historyItems.find((item) => item.id === selectedHistoryId);
  const displayedAnnouncement = selectedHistory || announcement;
  const paragraphs = renderAnnouncementParagraphs(displayedAnnouncement.content);
  const hasLink = Boolean(displayedAnnouncement.linkText && displayedAnnouncement.linkUrl);
  const isViewingHistory = Boolean(selectedHistory);
  const displayDate = formatAnnouncementDate(displayedAnnouncement);

  return (
    <div
      className="announcement-modal"
      onClick={displayedAnnouncement.force ? undefined : handleClose}
    >
      <div
        className={`announcement-card type-${displayedAnnouncement.type || 'info'} ${displayedAnnouncement.force ? 'is-force' : ''}`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="announcement-title"
      >
        <div className="announcement-title-row">
          <div>
            <h3 className="announcement-title" id="announcement-title">
              {displayedAnnouncement.title || '站点公告'}
            </h3>
            {displayDate && (
              <div className="announcement-meta">{displayDate}</div>
            )}
          </div>
        </div>
        <div className="announcement-body">
          {paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        <div className="announcement-history" aria-label="历史公告">
          <div className="announcement-history-title">历史公告</div>
          {historyItems.length > 0 ? (
            <div className="announcement-history-list">
              {historyItems.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`announcement-history-item ${selectedHistoryId === item.id ? 'is-active' : ''}`}
                  onClick={() => setSelectedHistoryId(item.id)}
                  aria-pressed={selectedHistoryId === item.id}
                  aria-label={`查看历史公告：${item.title || '站点公告'}`}
                >
                  <span className="announcement-history-item-head">
                    <span>{item.title || '站点公告'}</span>
                    {formatAnnouncementDate(item) && (
                      <time dateTime={getAnnouncementDate(item)}>
                        {formatAnnouncementDate(item)}
                      </time>
                    )}
                  </span>
                  <span className="announcement-history-preview">
                    {getAnnouncementPreview(item.content)}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="announcement-history-empty">暂无历史公告</div>
          )}
        </div>
        <div className="announcement-actions">
          {isViewingHistory && (
            <button
              type="button"
              className="announcement-btn ghost"
              onClick={() => setSelectedHistoryId('')}
            >
              返回最新
            </button>
          )}
          {hasLink && (
            <a
              className="announcement-btn ghost"
              href={displayedAnnouncement.linkUrl}
              onClick={handleClose}
              target={isExternalUrl(displayedAnnouncement.linkUrl) ? '_blank' : undefined}
              rel={isExternalUrl(displayedAnnouncement.linkUrl) ? 'noreferrer' : undefined}
            >
              {displayedAnnouncement.linkText}
            </a>
          )}
          <button
            type="button"
            className="announcement-btn primary"
            onClick={handleClose}
          >
            {displayedAnnouncement.confirmText || '我知道了'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnnouncementModal;

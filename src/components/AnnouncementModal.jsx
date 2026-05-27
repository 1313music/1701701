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

const getImageSizeStyle = (announcement) => {
  const style = {};
  const maxWidth = Number.parseInt(announcement?.imageMaxWidth, 10);
  const maxHeight = Number.parseInt(announcement?.imageMaxHeight, 10);

  if (Number.isFinite(maxWidth) && maxWidth > 0) {
    style['--announcement-image-max-width'] = `${maxWidth}px`;
  }
  if (Number.isFinite(maxHeight) && maxHeight > 0) {
    style['--announcement-image-max-height'] = `${maxHeight}px`;
  }

  return style;
};

const getContentAlign = (announcement) => (
  announcement?.contentAlign === 'center' ? 'center' : 'left'
);

const AnnouncementModal = ({ announcement, history = [], open = false, onConfirm }) => {
  const [selectedHistoryId, setSelectedHistoryId] = useState('');
  const [isHistoryListOpen, setIsHistoryListOpen] = useState(false);
  const handleClose = useCallback(() => {
    setSelectedHistoryId('');
    setIsHistoryListOpen(false);
    onConfirm?.();
  }, [onConfirm, setIsHistoryListOpen, setSelectedHistoryId]);

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
  const isHistoryListView = isHistoryListOpen && !selectedHistory;
  const displayedAnnouncement = selectedHistory || announcement;
  const paragraphs = renderAnnouncementParagraphs(displayedAnnouncement.content);
  const hasLink = !isHistoryListView && Boolean(displayedAnnouncement.linkText && displayedAnnouncement.linkUrl);
  const hasImage = Boolean(displayedAnnouncement.imageUrl);
  const isViewingHistory = Boolean(selectedHistory);
  const displayTitle = isHistoryListView ? '历史公告' : displayedAnnouncement.title || '站点公告';
  const displayDate = isHistoryListView ? '' : formatAnnouncementDate(displayedAnnouncement);
  const showHistoryList = historyItems.length > 0 && isHistoryListView;

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
              {displayTitle}
            </h3>
            {displayDate && (
              <div className="announcement-meta">{displayDate}</div>
            )}
          </div>
        </div>
        {!isHistoryListView && (
          <div className={`announcement-body align-${getContentAlign(displayedAnnouncement)}`}>
            {hasImage && (
              <figure className="announcement-media" style={getImageSizeStyle(displayedAnnouncement)}>
                <img
                  src={displayedAnnouncement.imageUrl}
                  alt={displayedAnnouncement.imageAlt || displayedAnnouncement.title || '公告图片'}
                  loading="lazy"
                />
                {displayedAnnouncement.imageCaption && (
                  <figcaption>{displayedAnnouncement.imageCaption}</figcaption>
                )}
              </figure>
            )}
            {paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        )}
        {showHistoryList && (
          <div className="announcement-history" aria-label="历史公告">
            <div className="announcement-history-list">
              {historyItems.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`announcement-history-item ${selectedHistoryId === item.id ? 'is-active' : ''}`}
                  onClick={() => {
                    setSelectedHistoryId(item.id);
                    setIsHistoryListOpen(false);
                  }}
                  aria-pressed={selectedHistoryId === item.id}
                  aria-label={`查看历史公告：${item.title || '站点公告'}`}
                >
                  <span className="announcement-history-item-title">
                    {item.title || '站点公告'}
                  </span>
                  {formatAnnouncementDate(item) && (
                    <time dateTime={getAnnouncementDate(item)}>
                      {formatAnnouncementDate(item)}
                    </time>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="announcement-actions">
          {(isViewingHistory || isHistoryListView) && (
            <button
              type="button"
              className="announcement-btn ghost"
              onClick={() => {
                setSelectedHistoryId('');
                setIsHistoryListOpen(false);
              }}
            >
              返回最新
            </button>
          )}
          {!isViewingHistory && !isHistoryListView && historyItems.length > 0 && (
            <button
              type="button"
              className="announcement-btn ghost"
              onClick={() => setIsHistoryListOpen((value) => !value)}
              aria-expanded={isHistoryListOpen}
            >
              {isHistoryListOpen ? '收起历史' : '历史公告'}
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

import { useEffect } from 'react';

const isExternalUrl = (value) => /^https?:\/\//i.test(String(value || '').trim());

const renderAnnouncementParagraphs = (content) => (
  String(content || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
);

const AnnouncementModal = ({ announcement, open = false, onConfirm }) => {
  useEffect(() => {
    if (!open || announcement?.force) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onConfirm?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [announcement?.force, onConfirm, open]);

  if (!open || !announcement) return null;

  const paragraphs = renderAnnouncementParagraphs(announcement.content);
  const hasLink = Boolean(announcement.linkText && announcement.linkUrl);

  return (
    <div
      className="announcement-modal"
      onClick={announcement.force ? undefined : onConfirm}
    >
      <div
        className={`announcement-card type-${announcement.type || 'info'} ${announcement.force ? 'is-force' : ''}`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="announcement-title"
      >
        <div className="announcement-title-row">
          <h3 className="announcement-title" id="announcement-title">
            {announcement.title || '站点公告'}
          </h3>
        </div>
        <div className="announcement-body">
          {paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        <div className="announcement-actions">
          {hasLink && (
            <a
              className="announcement-btn ghost"
              href={announcement.linkUrl}
              onClick={onConfirm}
              target={isExternalUrl(announcement.linkUrl) ? '_blank' : undefined}
              rel={isExternalUrl(announcement.linkUrl) ? 'noreferrer' : undefined}
            >
              {announcement.linkText}
            </a>
          )}
          <button
            type="button"
            className="announcement-btn primary"
            onClick={onConfirm}
          >
            {announcement.confirmText || '我知道了'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnnouncementModal;

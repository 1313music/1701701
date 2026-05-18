import React from 'react';
import { Megaphone } from 'lucide-react';

const AnnouncementEntry = ({
  announcement,
  unread = false,
  visible = false,
  onOpen
}) => {
  if (!visible || !announcement) return null;

  const title = announcement.title || '站点公告';

  return (
    <button
      type="button"
      className={`announcement-entry ${unread ? 'is-unread' : ''}`}
      onClick={onOpen}
      aria-label={`查看公告：${title}`}
      title={`查看公告：${title}`}
    >
      <span className="announcement-entry-icon" aria-hidden="true">
        <Megaphone size={18} />
      </span>
      <span className="announcement-entry-copy">
        <span className="announcement-entry-label">{unread ? '新公告' : '公告'}</span>
        <span className="announcement-entry-title">{title}</span>
      </span>
      {unread && <span className="announcement-entry-dot" aria-hidden="true" />}
    </button>
  );
};

export default AnnouncementEntry;

import React from 'react';
import { Bell } from 'lucide-react';

const AnnouncementTrigger = ({
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
      className={`announcement-trigger ${unread ? 'is-unread' : ''}`}
      onClick={onOpen}
      aria-label={`查看公告：${title}`}
      title={`查看公告：${title}`}
    >
      <Bell size={19} strokeWidth={2.25} absoluteStrokeWidth />
    </button>
  );
};

export default AnnouncementTrigger;

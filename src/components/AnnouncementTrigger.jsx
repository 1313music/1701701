import React from 'react';
import { Bell } from 'lucide-react';

const AnnouncementTrigger = ({
  announcement,
  unread = false,
  visible = false,
  className = '',
  onOpen
}) => {
  if (!visible) return null;

  const title = announcement?.title || '站点公告';
  const triggerClassName = [
    'announcement-trigger',
    className,
    unread ? 'is-unread' : ''
  ].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      className={triggerClassName}
      onClick={onOpen}
      aria-label={`查看公告：${title}`}
      title={`查看公告：${title}`}
    >
      <Bell size={19} strokeWidth={2.25} absoluteStrokeWidth />
    </button>
  );
};

export default AnnouncementTrigger;

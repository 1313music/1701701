import React from 'react';
import {
    SunIcon,
    MoonIcon
} from './icons/AppIcons';
import {
    Library,
    Video,
    Download,
    Images,
    ChevronLeft,
    ChevronRight,
    Smartphone,
    Info,
    MessageSquareMore,
    Megaphone
} from 'lucide-react';

const SHOW_COMMENT_NAV = ['1', 'true', 'yes', 'on'].includes(
    String(import.meta.env.VITE_SHOW_COMMENT_NAV || '').trim().toLowerCase()
);

const NavItem = ({
    icon,
    label,
    active = false,
    onClick,
    className = '',
    badge = false,
    ariaLabel
}) => (
    <button
        type="button"
        className={`nav-item ${active ? 'active' : ''} ${className}`}
        onClick={onClick}
        aria-pressed={active}
        aria-label={ariaLabel || label}
    >
        <span className="nav-item-icon">
            {icon}
            {badge && <span className="nav-item-badge" aria-hidden="true" />}
        </span>
        <span>{label}</span>
    </button>
);

const Sidebar = ({
    view,
    setView,
    isSidebarOpen,
    setIsSidebarOpen,
    isSidebarCollapsed = false,
    setIsSidebarCollapsed,
    themePreference = 'light',
    onThemeToggle,
    announcement,
    hasActiveAnnouncement = false,
    isAnnouncementUnread = false,
    onOpenAnnouncement
}) => {
    const handleNavClick = (newView) => {
        setIsSidebarOpen(false);
        setView(newView);
    };
    const isGalleryActive = view === 'gallery';
    const currentLabel = themePreference === 'dark' ? '深色' : '浅色';
    const nextLabel = themePreference === 'dark' ? '浅色' : '深色';
    const ThemeIcon = themePreference === 'dark' ? MoonIcon : SunIcon;
    const themeToggleLabel = `主题：${currentLabel}，点击切换为${nextLabel}`;
    const sidebarToggleLabel = isSidebarCollapsed ? '展开侧边栏' : '收起侧边栏';
    const announcementTitle = announcement?.title || '站点公告';
    const announcementLabel = isAnnouncementUnread ? '新公告' : '公告';
    const announcementAriaLabel = `查看公告：${announcementTitle}`;
    const handleAnnouncementClick = () => {
        setIsSidebarOpen(false);
        onOpenAnnouncement?.();
    };
    const handleLogoKeyDown = (event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        handleNavClick('library');
    };

    return (
        <>
            <div className="mobile-topbar">
                <button
                    className={`mobile-menu-btn ${isSidebarOpen ? 'is-open' : ''}`}
                    onClick={() => setIsSidebarOpen((prev) => !prev)}
                    aria-label={isSidebarOpen ? '关闭菜单' : '打开菜单'}
                >
                    <svg
                        className="hamburger-icon"
                        viewBox="0 0 20 16"
                        width="20"
                        height="16"
                        aria-hidden="true"
                    >
                        <path className="hamburger-stroke top" d="M1 1.5H19" />
                        <path className="hamburger-stroke middle" d="M1 8H19" />
                        <path className="hamburger-stroke bottom" d="M1 14.5H19" />
                    </svg>
                </button>
                <button
                    type="button"
                    className="mobile-brand"
                    onClick={() => handleNavClick('library')}
                >
                    1701701.xyz
                </button>
                <div className="mobile-topbar-actions">
                    {hasActiveAnnouncement && (
                        <button
                            type="button"
                            className={`mobile-announcement-toggle ${isAnnouncementUnread ? 'is-unread' : ''}`}
                            onClick={handleAnnouncementClick}
                            aria-label={announcementAriaLabel}
                            title={announcementAriaLabel}
                        >
                            <Megaphone size={21} strokeWidth={2.4} absoluteStrokeWidth />
                            {isAnnouncementUnread && <span className="mobile-announcement-badge" aria-hidden="true" />}
                        </button>
                    )}
                    {onThemeToggle && (
                        <button
                            type="button"
                            className="mobile-theme-toggle"
                            onClick={onThemeToggle}
                            aria-label={themeToggleLabel}
                            title={themeToggleLabel}
                        >
                            <ThemeIcon size={22} strokeWidth={2.4} absoluteStrokeWidth />
                        </button>
                    )}
                </div>
            </div>

            <div
                className={`mobile-menu-scrim ${isSidebarOpen ? 'show' : ''}`}
                onClick={() => setIsSidebarOpen(false)}
            />
            <div className={`mobile-menu-panel ${isSidebarOpen ? 'show' : ''}`}>
                <div className="mobile-menu-content">
                    <NavItem
                        icon={<Library size={20} strokeWidth={2.4} absoluteStrokeWidth />}
                        label="音乐"
                        active={view === 'library'}
                        onClick={() => handleNavClick('library')}
                    />
                    <NavItem
                        icon={<Video size={20} strokeWidth={2.4} absoluteStrokeWidth />}
                        label="视频"
                        active={view === 'video'}
                        onClick={() => handleNavClick('video')}
                    />
                    <NavItem
                        icon={<Images size={20} strokeWidth={2.4} absoluteStrokeWidth />}
                        label="图库"
                        active={isGalleryActive}
                        onClick={() => handleNavClick('gallery')}
                    />
                    <NavItem
                        icon={<Download size={20} strokeWidth={2.4} absoluteStrokeWidth />}
                        label="下载"
                        active={view === 'download'}
                        onClick={() => handleNavClick('download')}
                    />
                    <NavItem
                        icon={<Smartphone size={20} strokeWidth={2.4} absoluteStrokeWidth />}
                        label="APP"
                        active={view === 'app'}
                        onClick={() => handleNavClick('app')}
                    />
                    {SHOW_COMMENT_NAV && (
                        <NavItem
                            icon={<MessageSquareMore size={20} strokeWidth={2.4} absoluteStrokeWidth />}
                            label="留言"
                            active={view === 'comment'}
                            onClick={() => handleNavClick('comment')}
                        />
                    )}
                    {hasActiveAnnouncement && (
                        <NavItem
                            icon={<Megaphone size={20} strokeWidth={2.4} absoluteStrokeWidth />}
                            label={announcementLabel}
                            onClick={handleAnnouncementClick}
                            className="nav-item-announcement"
                            badge={isAnnouncementUnread}
                            ariaLabel={announcementAriaLabel}
                        />
                    )}
                    <NavItem
                        icon={<Info size={20} strokeWidth={2.4} absoluteStrokeWidth />}
                        label="关于"
                        active={view === 'about'}
                        onClick={() => handleNavClick('about')}
                    />
                </div>
            </div>

            <aside className={`sidebar ${isSidebarCollapsed ? 'is-collapsed' : ''}`}>
                <div
                    className="logo"
                    onClick={() => handleNavClick('library')}
                    onKeyDown={handleLogoKeyDown}
                    role="button"
                    tabIndex={0}
                >
                    <div className="logo-box" />
                    <span className="logo-text">1701701.xyz</span>
                    <div className="sidebar-logo-actions">
                        {onThemeToggle && (
                            <button
                                type="button"
                                className="sidebar-theme-toggle"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onThemeToggle(event);
                                }}
                                aria-label={themeToggleLabel}
                                title={themeToggleLabel}
                            >
                                <ThemeIcon size={22} strokeWidth={2.4} absoluteStrokeWidth />
                            </button>
                        )}
                    </div>
                </div>

                <div className="nav-group">
                    <NavItem
                        icon={<Library size={22} strokeWidth={2.4} absoluteStrokeWidth />}
                        label="音乐"
                        active={view === 'library'}
                        onClick={() => handleNavClick('library')}
                    />
                    <NavItem
                        icon={<Video size={22} strokeWidth={2.4} absoluteStrokeWidth />}
                        label="视频"
                        active={view === 'video'}
                        onClick={() => handleNavClick('video')}
                    />
                    <NavItem
                        icon={<Images size={22} strokeWidth={2.4} absoluteStrokeWidth />}
                        label="图库"
                        active={isGalleryActive}
                        onClick={() => handleNavClick('gallery')}
                    />
                    <NavItem
                        icon={<Download size={22} strokeWidth={2.4} absoluteStrokeWidth />}
                        label="下载"
                        active={view === 'download'}
                        onClick={() => handleNavClick('download')}
                    />
                    <NavItem
                        icon={<Smartphone size={22} strokeWidth={2.4} absoluteStrokeWidth />}
                        label="APP"
                        active={view === 'app'}
                        onClick={() => handleNavClick('app')}
                    />
                    {SHOW_COMMENT_NAV && (
                        <NavItem
                            icon={<MessageSquareMore size={22} strokeWidth={2.4} absoluteStrokeWidth />}
                            label="留言"
                            active={view === 'comment'}
                            onClick={() => handleNavClick('comment')}
                        />
                    )}
                    {hasActiveAnnouncement && (
                        <NavItem
                            icon={<Megaphone size={22} strokeWidth={2.4} absoluteStrokeWidth />}
                            label={announcementLabel}
                            onClick={handleAnnouncementClick}
                            className="nav-item-announcement"
                            badge={isAnnouncementUnread}
                            ariaLabel={announcementAriaLabel}
                        />
                    )}
                    <NavItem
                        icon={<Info size={22} strokeWidth={2.4} absoluteStrokeWidth />}
                        label="关于"
                        active={view === 'about'}
                        onClick={() => handleNavClick('about')}
                    />
                </div>
                <button
                    type="button"
                    className="sidebar-edge-toggle"
                    onClick={() => {
                        if (setIsSidebarCollapsed) {
                            setIsSidebarCollapsed((prev) => !prev);
                        }
                    }}
                    aria-label={sidebarToggleLabel}
                    title={sidebarToggleLabel}
                >
                    {isSidebarCollapsed ? (
                        <ChevronRight size={16} />
                    ) : (
                        <ChevronLeft size={16} />
                    )}
                </button>
            </aside>
        </>
    );
};

export default Sidebar;

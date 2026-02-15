import React from 'react';
import {
    SunIcon,
    MoonIcon
} from './icons/AppIcons';
import {
    Library,
    Video,
    Download,
    Info
} from 'lucide-react';

const NavItem = ({ icon, label, active = false, onClick }) => (
    <div className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>
        {icon}
        <span>{label}</span>
    </div>
);

const Sidebar = ({ view, setView, isSidebarOpen, setIsSidebarOpen, themePreference = 'light', onThemeToggle }) => {
    const handleNavClick = (newView) => {
        setIsSidebarOpen(false);
        setView(newView);
    };
    const currentLabel = themePreference === 'dark' ? '深色' : '浅色';
    const nextLabel = themePreference === 'dark' ? '浅色' : '深色';
    const ThemeIcon = themePreference === 'dark' ? MoonIcon : SunIcon;
    const themeToggleLabel = `主题：${currentLabel}，点击切换为${nextLabel}`;

    return (
        <>
            <div className="mobile-topbar">
                <button
                    className={`mobile-menu-btn ${isSidebarOpen ? 'is-open' : ''}`}
                    onClick={() => setIsSidebarOpen((prev) => !prev)}
                    aria-label={isSidebarOpen ? '关闭菜单' : '打开菜单'}
                >
                    <span className="hamburger" aria-hidden="true">
                        <span className="hamburger-line top" />
                        <span className="hamburger-line middle" />
                        <span className="hamburger-line bottom" />
                    </span>
                </button>
                <div
                    className="mobile-brand"
                    onClick={() => handleNavClick('library')}
                >
                    1701701.xyz
                </div>
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
                        icon={<Download size={20} strokeWidth={2.4} absoluteStrokeWidth />}
                        label="下载"
                        active={view === 'download'}
                        onClick={() => handleNavClick('download')}
                    />
                    <NavItem
                        icon={<Info size={20} strokeWidth={2.4} absoluteStrokeWidth />}
                        label="关于"
                        active={view === 'about'}
                        onClick={() => handleNavClick('about')}
                    />
                </div>
            </div>

            <aside className="sidebar">
                <div
                    className="logo"
                    onClick={() => handleNavClick('library')}
                >
                    <div className="logo-box" />
                    <span>1701701.xyz</span>
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
                            <ThemeIcon size={16} />
                        </button>
                    )}
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
                        icon={<Download size={22} strokeWidth={2.4} absoluteStrokeWidth />}
                        label="下载"
                        active={view === 'download'}
                        onClick={() => handleNavClick('download')}
                    />
                    <NavItem
                        icon={<Info size={22} strokeWidth={2.4} absoluteStrokeWidth />}
                        label="关于"
                        active={view === 'about'}
                        onClick={() => handleNavClick('about')}
                    />
                </div>
            </aside>
        </>
    );
};

export default Sidebar;

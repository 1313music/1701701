import React, { useEffect, useRef, useState } from 'react';
import { SearchIcon, CloseIcon } from './icons/AppIcons';

const SearchHeader = ({
    searchQuery,
    setSearchQuery,
    title,
    subtitle,
    suggestions = [],
    onSelectSuggestion,
    placeholder = "搜索音乐、专辑..."
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const searchRef = useRef(null);
    const inputRef = useRef(null);
    const hasSearchText = searchQuery.length > 0;
    const isSearchActive = isExpanded || hasSearchText;

    useEffect(() => {
        const handleOutsidePointerDown = (event) => {
            if (!searchRef.current || searchRef.current.contains(event.target)) {
                return;
            }

            setIsOpen(false);
            if (!hasSearchText) {
                setIsExpanded(false);
            }
        };

        document.addEventListener('pointerdown', handleOutsidePointerDown);
        return () => document.removeEventListener('pointerdown', handleOutsidePointerDown);
    }, [hasSearchText]);

    const focusInput = () => {
        const focusSearch = () => inputRef.current?.focus();

        setIsExpanded(true);
        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(focusSearch);
            return;
        }
        focusSearch();
    };

    const handleInputBlur = (event) => {
        setIsOpen(false);
        if (!event.currentTarget.value) {
            setIsExpanded(false);
        }
    };

    const handleSelect = (item) => {
        if (onSelectSuggestion) onSelectSuggestion(item);
        setIsOpen(false);
    };

    return (
        <header className="page-header">
            <div className="header-top">
                {title && <h1>{title}</h1>}
                <div
                    ref={searchRef}
                    className={`search-box ${isSearchActive ? 'is-expanded' : ''} ${hasSearchText ? 'has-value' : ''}`}
                >
                    <button
                        type="button"
                        className="search-toggle"
                        aria-label={isSearchActive ? '聚焦搜索' : '展开搜索'}
                        aria-expanded={isSearchActive}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={focusInput}
                    >
                        <SearchIcon size={20} className="search-icon" />
                    </button>
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder={placeholder}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onFocus={() => {
                            setIsExpanded(true);
                            setIsOpen(true);
                        }}
                        onBlur={handleInputBlur}
                    />
                    {hasSearchText && (
                        <button
                            type="button"
                            className="search-clear"
                            aria-label="清除搜索内容"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                                setSearchQuery('');
                                setIsOpen(false);
                                inputRef.current?.focus();
                            }}
                        >
                            <CloseIcon size={16} />
                        </button>
                    )}
                    {isOpen && searchQuery.trim() && suggestions.length > 0 && (
                        <div
                            className="search-suggest"
                            onMouseDown={(e) => e.preventDefault()}
                        >
                            {suggestions.map((item) => (
                                <button
                                    type="button"
                                    key={item.song.src}
                                    className="search-suggest-item"
                                    onClick={() => handleSelect(item)}
                                >
                                    <span className="suggest-title">{item.song.name}</span>
                                    <span className="suggest-meta">{item.album.artist} · {item.album.name}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            {subtitle && <p>{subtitle}</p>}
        </header>
    );
};

export default SearchHeader;

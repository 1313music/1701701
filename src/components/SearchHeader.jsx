import React, { useState } from 'react';
import { Search, X } from 'lucide-react';

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

    const handleSelect = (item) => {
        if (onSelectSuggestion) onSelectSuggestion(item);
        setIsOpen(false);
    };

    return (
        <header className="page-header">
            <div className="header-top">
                {title && <h1>{title}</h1>}
                <div className="search-box">
                    <Search size={20} className="search-icon" />
                    <input
                        type="text"
                        placeholder={placeholder}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onFocus={() => setIsOpen(true)}
                        onBlur={() => setIsOpen(false)}
                    />
                    {searchQuery.length > 0 && (
                        <button
                            type="button"
                            className="search-clear"
                            aria-label="清除搜索内容"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => setSearchQuery('')}
                        >
                            <X size={16} />
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

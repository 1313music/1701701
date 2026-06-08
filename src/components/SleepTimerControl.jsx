import React, { useEffect, useId, useRef, useState } from 'react';
import { Timer } from 'lucide-react';

const SLEEP_TIMER_PRESETS = [15, 30, 45, 60];

const formatSleepTimerRemaining = (remainingMs) => {
    const totalSeconds = Math.max(Math.ceil((Number(remainingMs) || 0) / 1000), 0);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const paddedMinutes = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes);
    const paddedSeconds = String(seconds).padStart(2, '0');
    return hours > 0
        ? `${hours}:${paddedMinutes}:${paddedSeconds}`
        : `${paddedMinutes}:${paddedSeconds}`;
};

const SleepTimerControl = ({
    className = '',
    buttonClassName = 'icon-btn',
    remainingMs = 0,
    onStartSleepTimer,
    onCancelSleepTimer,
    showCountdown = true,
    showIdleLabel = false,
    idleText = '定时',
    iconSize = 20
}) => {
    const rootRef = useRef(null);
    const customInputId = useId();
    const [isOpen, setIsOpen] = useState(false);
    const [customMinutes, setCustomMinutes] = useState('');
    const isActive = Number.isFinite(remainingMs) && remainingMs > 0;
    const timerLabel = isActive ? formatSleepTimerRemaining(remainingMs) : '';
    const customMinutesValue = Number(customMinutes);
    const canSubmitCustom = Number.isFinite(customMinutesValue) && customMinutesValue > 0;

    useEffect(() => {
        if (!isOpen || typeof document === 'undefined') return undefined;
        const handlePointerDown = (event) => {
            if (rootRef.current?.contains(event.target)) return;
            setIsOpen(false);
        };
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    const startTimer = (minutes) => {
        onStartSleepTimer?.(minutes);
        setIsOpen(false);
    };

    const handleCustomSubmit = (event) => {
        event.preventDefault();
        if (!canSubmitCustom) return;
        startTimer(customMinutesValue);
        setCustomMinutes('');
    };

    return (
        <div className={`sleep-timer-control ${className}`.trim()} ref={rootRef}>
            <button
                type="button"
                className={`${buttonClassName} sleep-timer-btn ${isActive ? 'active' : ''}`.trim()}
                onClick={(event) => {
                    event.stopPropagation();
                    setIsOpen((prev) => !prev);
                }}
                aria-label={isActive ? `定时关闭剩余 ${timerLabel}` : '设置定时关闭'}
                aria-expanded={isOpen}
                aria-haspopup="menu"
            >
                <Timer size={iconSize} strokeWidth={2.2} absoluteStrokeWidth />
                {showIdleLabel && !isActive && (
                    <span className="sleep-timer-idle-label">{idleText}</span>
                )}
                {showCountdown && isActive && (
                    <span className="sleep-timer-countdown">{timerLabel}</span>
                )}
            </button>
            {isOpen && (
                <div
                    className="sleep-timer-menu"
                    role="menu"
                    onClick={(event) => event.stopPropagation()}
                >
                    <div className="sleep-timer-menu-title">
                        {isActive ? `剩余 ${timerLabel}` : '定时关闭'}
                    </div>
                    <div className="sleep-timer-options">
                        {SLEEP_TIMER_PRESETS.map((minutes) => (
                            <button
                                type="button"
                                role="menuitem"
                                className="sleep-timer-option"
                                key={minutes}
                                onClick={() => startTimer(minutes)}
                            >
                                {minutes} 分钟
                            </button>
                        ))}
                    </div>
                    <form className="sleep-timer-custom" onSubmit={handleCustomSubmit}>
                        <label className="sleep-timer-custom-label" htmlFor={customInputId}>
                            自定义
                        </label>
                        <div className="sleep-timer-custom-row">
                            <input
                                id={customInputId}
                                className="sleep-timer-custom-input"
                                type="number"
                                min="1"
                                max="999"
                                step="1"
                                inputMode="numeric"
                                value={customMinutes}
                                onChange={(event) => setCustomMinutes(event.target.value)}
                                placeholder="分钟"
                                aria-label="自定义定时分钟"
                            />
                            <button
                                type="submit"
                                className="sleep-timer-custom-submit"
                                disabled={!canSubmitCustom}
                            >
                                开始
                            </button>
                        </div>
                    </form>
                    {isActive && (
                        <button
                            type="button"
                            role="menuitem"
                            className="sleep-timer-cancel"
                            onClick={() => {
                                onCancelSleepTimer?.();
                                setIsOpen(false);
                            }}
                        >
                            取消定时
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default SleepTimerControl;

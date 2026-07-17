import React, { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import '../styles/external-jump.css';

const EXTERNAL_SITE_WARNING = '该站点在国内网络可能无法正常访问，建议使用科学上网。是否继续？';

const ExternalJumpDialog = ({ isOpen, href, host = 'tower.jp', onClose }) => {
    const titleId = useId();
    const descriptionId = useId();

    useEffect(() => {
        if (!isOpen || typeof document === 'undefined') return undefined;

        const previousOverflow = document.body.style.overflow;
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') onClose?.();
        };

        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    if (!isOpen || typeof document === 'undefined') return null;

    const handleConfirm = () => {
        window.open(href, '_blank', 'noopener,noreferrer');
        onClose?.();
    };

    return createPortal(
        <div className="external-jump-modal" role="presentation" onClick={onClose}>
            <div
                className="external-jump-card"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                onClick={(event) => event.stopPropagation()}
            >
                <h3 id={titleId}>即将前往 {host}</h3>
                <p id={descriptionId}>{EXTERNAL_SITE_WARNING}</p>
                <div className="external-jump-actions">
                    <button
                        type="button"
                        className="external-jump-btn ghost"
                        onClick={onClose}
                    >
                        取消
                    </button>
                    <button
                        type="button"
                        className="external-jump-btn"
                        onClick={handleConfirm}
                    >
                        确认跳转
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ExternalJumpDialog;

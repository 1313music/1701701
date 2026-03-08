import { describe, expect, it } from 'vitest';
import {
    getDocumentFullscreenElement,
    isPlayerInBrowserFullscreen,
    isPlayerInWebFullscreen,
    isVideoNativeFullscreen
} from './videoFullscreenUtils';

describe('videoFullscreenUtils', () => {
    it('reads vendor-prefixed fullscreen document state', () => {
        const fullscreenElement = { id: 'player' };
        const doc = {
            fullscreenElement: null,
            webkitFullscreenElement: fullscreenElement,
            mozFullScreenElement: null,
            msFullscreenElement: null
        };

        expect(getDocumentFullscreenElement(doc)).toBe(fullscreenElement);
    });

    it('detects WebKit native video fullscreen', () => {
        expect(isVideoNativeFullscreen({ webkitDisplayingFullscreen: true })).toBe(true);
        expect(isVideoNativeFullscreen({ webkitPresentationMode: 'fullscreen' })).toBe(true);
        expect(isVideoNativeFullscreen({ webkitPresentationMode: 'inline' })).toBe(false);
    });

    it('detects DPlayer web fullscreen separately from browser fullscreen', () => {
        const player = {
            fullScreen: {
                isFullScreen: (mode) => mode === 'web'
            },
            video: null
        };

        expect(isPlayerInWebFullscreen(player)).toBe(true);
        expect(isPlayerInBrowserFullscreen(player, {})).toBe(false);
    });

    it('treats native video fullscreen as browser fullscreen fallback', () => {
        const player = {
            fullScreen: {
                isFullScreen: () => false
            },
            video: {
                webkitPresentationMode: 'fullscreen'
            }
        };

        expect(isPlayerInBrowserFullscreen(player, {})).toBe(true);
    });
});

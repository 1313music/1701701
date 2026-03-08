const getDefaultDocument = () => (typeof document === 'undefined' ? null : document);

const getDocumentFullscreenElement = (doc = getDefaultDocument()) => {
    if (!doc) return null;
    return doc.fullscreenElement
        || doc.webkitFullscreenElement
        || doc.mozFullScreenElement
        || doc.msFullscreenElement
        || null;
};

const isVideoNativeFullscreen = (video) => Boolean(
    video && (
        video.webkitDisplayingFullscreen === true ||
        video.webkitPresentationMode === 'fullscreen'
    )
);

const isPlayerInWebFullscreen = (player) => Boolean(player?.fullScreen?.isFullScreen?.('web'));

const isPlayerInBrowserFullscreen = (player, doc = getDefaultDocument()) => Boolean(
    player?.fullScreen?.isFullScreen?.('browser')
    || getDocumentFullscreenElement(doc)
    || isVideoNativeFullscreen(player?.video)
);

export {
    getDocumentFullscreenElement,
    isVideoNativeFullscreen,
    isPlayerInWebFullscreen,
    isPlayerInBrowserFullscreen
};

export const buildVideoKey = (item = {}) => `${item.id ?? ''}::${item.title ?? ''}::${item.url ?? ''}`;

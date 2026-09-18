// 虚拟专辑（随机精选 / 我的收藏 / 最近播放）的搜索关键词配置。
// 原本这些中文关键词硬编码在 App.jsx 的 displayedAlbums 里，加新虚拟歌单就得改那里；
// 现在抽到这张表，新增虚拟专辑只改这里。
export const VIRTUAL_ALBUM_CONFIG = {
  randomMix: {
    id: 'random-mix',
    // 保留旧名「随便听」，用户按老习惯搜索仍能命中。
    keywords: ['随机精选', '随便听', '随机歌单', '随机', 'random', '歌单', '推荐']
  },
  favorites: {
    id: 'favorites',
    keywords: ['我的收藏', '收藏歌单', '收藏', '喜欢', 'favorite', '红心', '心']
  },
  recentlyPlayed: {
    id: 'recently-played',
    keywords: ['最近播放', '最近', '重听', '最近听的', 'recent', 'history', '历史', '播放记录']
  }
};

const keywordMatches = (keyword, query) =>
  keyword === query || keyword.includes(query) || query.includes(keyword);

// 判断某个虚拟专辑在给定搜索词下是否应显示。
// query 为空（未搜索）时返回 true —— 是否真正展示再由调用方结合“是否有歌”决定。
// songNameMatch 为 true 时表示该虚拟专辑内有歌名/专辑名命中，也应显示。
export const isVirtualAlbumQueryMatch = (key, query, { songNameMatch = false } = {}) => {
  const config = VIRTUAL_ALBUM_CONFIG[key];
  if (!config) return false;
  if (!query) return true;
  if (config.keywords.some((kw) => keywordMatches(kw, query))) return true;
  return songNameMatch;
};

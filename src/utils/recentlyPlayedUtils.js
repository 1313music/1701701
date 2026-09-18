const RECENTLY_PLAYED_KEY = 'recentlyPlayedIds';
const DEFAULT_CAP = 100;

export const loadRecentlyPlayedIds = () => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENTLY_PLAYED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((id) => typeof id === 'string' && id)
      : [];
  } catch {
    return [];
  }
};

export const saveRecentlyPlayedIds = (ids) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(RECENTLY_PLAYED_KEY, JSON.stringify(ids));
  } catch {
    // ignore storage errors (private mode / quota)
  }
};

// 把某个 src 记到最前面；已存在则移到最前；超出上限丢弃最旧的。
export const addRecentlyPlayedId = (prevIds, id, cap = DEFAULT_CAP) => {
  if (!id) {
    return { nextIds: Array.isArray(prevIds) ? prevIds : [], action: 'noop' };
  }
  const safePrev = Array.isArray(prevIds) ? prevIds : [];
  const filtered = safePrev.filter((item) => item !== id);
  const next = [id, ...filtered].slice(0, Math.max(1, cap));
  return { nextIds: next, action: 'added' };
};

export const clearRecentlyPlayedIds = (prevIds) => {
  const safePrev = Array.isArray(prevIds) ? prevIds : [];
  if (safePrev.length === 0) return { nextIds: safePrev, changed: false };
  return { nextIds: [], changed: true };
};

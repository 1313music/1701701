const readStorage = () => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export const readPersistentManifestCache = (cacheKey) => {
  if (!cacheKey) return null;
  const storage = readStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(cacheKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const savedAt = Number(parsed?.savedAt);
    if (!Number.isFinite(savedAt) || !('data' in (parsed || {}))) {
      storage.removeItem(cacheKey);
      return null;
    }

    return {
      savedAt,
      data: parsed.data
    };
  } catch {
    storage.removeItem(cacheKey);
    return null;
  }
};

export const writePersistentManifestCache = (cacheKey, data) => {
  if (!cacheKey) return;
  const storage = readStorage();
  if (!storage) return;

  try {
    storage.setItem(cacheKey, JSON.stringify({
      savedAt: Date.now(),
      data
    }));
  } catch {
    // Ignore quota and storage availability failures.
  }
};

export const clearPersistentManifestCache = (cacheKey) => {
  if (!cacheKey) return;
  const storage = readStorage();
  if (!storage) return;

  try {
    storage.removeItem(cacheKey);
  } catch {
    // Ignore storage failures.
  }
};

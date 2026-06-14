export const createManifestRefreshNotifier = () => {
  const listeners = new Set();

  const subscribe = (listener) => {
    if (typeof listener !== 'function') return () => {};
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const notify = (data) => {
    listeners.forEach((listener) => {
      try {
        listener(data);
      } catch {
        // Keep one bad subscriber from breaking the shared refresh pipeline.
      }
    });
  };

  const refreshInBackground = (refreshPromise) => {
    void refreshPromise
      .then((data) => {
        notify(data);
      })
      .catch(() => {
        // Stale cache is still usable; foreground retries surface errors.
      });
  };

  const clear = () => {
    listeners.clear();
  };

  return {
    clear,
    refreshInBackground,
    subscribe
  };
};

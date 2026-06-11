CREATE TABLE IF NOT EXISTS danmaku (
  id TEXT PRIMARY KEY,
  video_key TEXT NOT NULL,
  time REAL NOT NULL,
  type INTEGER NOT NULL DEFAULT 0,
  color INTEGER NOT NULL DEFAULT 16777215,
  author TEXT NOT NULL DEFAULT 'guest',
  text TEXT NOT NULL,
  ip_hash TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'visible',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_danmaku_video_time
ON danmaku (video_key, status, time, created_at);

CREATE INDEX IF NOT EXISTS idx_danmaku_ip_created
ON danmaku (ip_hash, created_at DESC);

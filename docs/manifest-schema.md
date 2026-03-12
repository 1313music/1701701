# Manifest Schema v1

本文档定义第一版 `video-index.json` 与 `music-index.json` 的正式结构，目标是:

- 保持与当前前端消费字段一致，迁移成本最低
- 允许后续平滑演进（`schemaVersion` + `updatedAt`）
- 便于手工维护与后台生成

对应 JSON Schema:

- `docs/schemas/video-index.schema.json`
- `docs/schemas/music-index.schema.json`
- `docs/schemas/download-index.schema.json`

## 1. 通用约定

两份 manifest 均包含以下顶层字段:

- `schemaVersion`: 固定为 `1`
- `updatedAt`: ISO 8601 时间字符串（建议带时区，如 `2026-03-12T16:00:00+08:00`）

通用规则:

- `id` 必须稳定，不要随意改动
- `enabled` 建议保留，优先做软下线而非删除
- `sortOrder` 建议保留，前端排序和后台管理都更稳定

## 2. 视频 Manifest (`video-index.json`)

### 顶层

- `categories`: 分类数组

### `category` 字段

- `id` (必填): 分类 ID，建议沿用 `knxy` / `yjj` / `qt` 等
- `name` (必填): 分类名
- `icon` (可选): 图标标识（如 `film`、`music`）
- `sortOrder` (可选): 分类排序，整数
- `enabled` (可选): 是否启用
- `items` (必填): 分类下条目列表

### `item` 字段

`item.type` 仅支持:

- `folder`: 文件夹
- `video`: 视频

#### `folder` 条目

- `type` = `folder`
- `id` (必填): 文件夹唯一 ID
- `title` (必填): 文件夹标题
- `thumb` (可选): 封面图
- `sortOrder` (可选)
- `enabled` (可选)
- `items` (必填): 子条目数组（支持嵌套 `folder` / `video`）

#### `video` 条目

- `type` = `video`
- `id` (必填): 视频唯一 ID
- `title` (必填): 视频标题
- `url` (必填): 主播放地址
- `backupUrl` (可选): 备用播放地址，可空字符串
- `thumb` (可选): 封面图，可空字符串
- `sortOrder` (可选)
- `enabled` (可选)

## 3. 音乐 Manifest (`music-index.json`)

### 顶层

- `albums`: 专辑数组

### `album` 字段

- `id` (必填): 专辑唯一 ID
- `name` (必填): 专辑名
- `artist` (必填): 艺术家
- `cover` (必填): 专辑封面（可为空字符串）
- `year` (可选): 年份，整数
- `type` (可选): 推荐值 `studio` / `live` / `compilation` / `single`
- `sortOrder` (可选): 排序，整数
- `enabled` (可选): 是否启用
- `songs` (必填): 歌曲数组

### `song` 字段

- `id` (必填): 歌曲唯一 ID
- `trackNumber` (必填): 曲序，>= 1
- `name` (必填): 歌名
- `src` (必填): 音频地址
- `lrc` (可选): 歌词地址，可空字符串
- `cover` (可选): 单曲封面，可空字符串（空时可回退专辑封面）
- `enabled` (可选): 是否启用

## 4. Loader 兼容行为（已实现）

当前前端已实现:

- 严格远程 manifest:
  - `VITE_VIDEO_INDEX_URL`（默认 `https://r2.1701701.xyz/json/video-index.json`）
  - `VITE_MUSIC_INDEX_URL`（默认 `https://r2.1701701.xyz/json/music-index.json`）
- 远程失败或格式不合法时，不再回退本地清单，页面显示加载错误并允许重试

## 5. v1 升级边界建议

如后续需要新增字段，建议:

- 保持现有字段语义不变
- 新字段默认可选
- 发生不兼容变更时再提升 `schemaVersion`

## 6. 下载 Manifest (`download-index.json`)

### 顶层

- `sections`: 下载分区数组

### `section` 字段

- `title` (必填): 分区标题
- `sortOrder` (可选): 排序，整数
- `enabled` (可选): 是否启用
- `groups` (必填): 分组数组
- `note` (可选): 附加链接信息
  - `label`: 文案
  - `href`: URL

### `group` 字段

- `title` (必填): 分组标题
- `sortOrder` (可选)
- `enabled` (可选)
- `items` (必填): 下载条目数组

### `item` 字段

- `title` (必填)
- `url` (必填)
- `filename` (可选): 下载文件名
- `previewUrl` (可选): 预览地址
- `sortOrder` (可选)
- `enabled` (可选)

### 下载 loader 约定

- `VITE_DOWNLOAD_INDEX_URL`（默认 `https://r2.1701701.xyz/json/download-index.json`）
- 严格远程模式: 清单失败或格式无效时不回退本地数据，页面展示错误并允许重试

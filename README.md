# 1701701

李志音乐与视频站点（React + Vite）。

## 本地开发

```bash
npm install
npm run dev
```

默认开发地址：`http://localhost:8080`

## 常用命令

```bash
npm run lint
npm run test
npm run build
npm run check
```

## 页面直达路径

线上站点支持以下直达地址：

- `https://1701701.xyz/`
- `https://1701701.xyz/video`
- `https://1701701.xyz/gallery`
- `https://1701701.xyz/app`
- `https://1701701.xyz/about`

说明：项目使用单页应用路由，Cloudflare Pages 通过 `public/_redirects` 将这些路径统一回退到首页入口。
资源下载页 `/download` 默认隐藏；需要重新展示时，在构建环境设置 `VITE_SHOW_DOWNLOAD_PAGE=true`。
专辑详情里的“扫码保存到网易云盘”小程序码默认展示；需要隐藏时，在构建环境设置 `VITE_SHOW_MINI_PROGRAM_QR=false`。

## 访问统计（Umami）

主站通过 Umami Cloud 统计访问，不再依赖 Netlify 上的自建 `tongji.1701701.xyz` 服务。

前端入口会默认加载 Umami Cloud tracker，当前 Website ID 是 `51ff5826-49f4-459e-b5b3-2557bc898922`。如果以后更换 Umami 站点，可用 `VITE_UMAMI_WEBSITE_ID` 覆盖。

Umami Cloud 设置：

1. 登录或注册 `https://cloud.umami.is/signup`。
2. 新建 Website，域名填 `1701701.xyz`。
3. 在 Website 的 Tracking code 中复制 `data-website-id`。
4. 如需替换当前默认站点，在 Cloudflare Pages 或本地 `.env.local` 中设置：

```bash
VITE_UMAMI_WEBSITE_ID=<website-id-from-umami-cloud>
VITE_UMAMI_SCRIPT_URL=https://cloud.umami.is/script.js
VITE_UMAMI_DOMAINS=1701701.xyz
VITE_UMAMI_HOST_URL=
```

说明：

- `VITE_UMAMI_SCRIPT_URL` 默认回退到 `https://cloud.umami.is/script.js`。
- `VITE_UMAMI_DOMAINS` 默认回退到 `1701701.xyz`，用于避免本地开发和预览域名误记入线上统计。
- `VITE_UMAMI_HOST_URL` 仅在自建或代理 tracker 时需要；Umami Cloud 保持为空。
- 现有 `data-umami-event` 下载事件属性会继续生效。

## 视频访问口令（后台可轮换）

视频访问口令优先读取 R2 JSON：

- 默认地址：`https://r2.1701701.xyz/json/video-access.json`
- 可选变量：`VITE_VIDEO_ACCESS_CONFIG_URL`
- 可选缓存变量：`VITE_VIDEO_ACCESS_CONFIG_CACHE_TTL_MS`，默认 `43200000`（12 小时），用于减少每次点视频都读取 R2
- JSON 内含 `password` 和 `passwordVersion`
- `/myadmin` 保存口令后会写入 R2，并自动生成新的 `passwordVersion`；旧的本地 365 天授权会在口令配置缓存过期后失效（默认最多 12 小时）

`VITE_VIDEO_PASSWORD` 仍保留为兜底口令：当 R2 JSON 不存在或读取失败时使用，兼容现有行为。

本地开发可在 `.env.local` 中设置：

```bash
VITE_VIDEO_PASSWORD=SongSharing
VITE_VIDEO_ACCESS_CONFIG_URL=https://r2.1701701.xyz/json/video-access.json
VITE_VIDEO_ACCESS_CONFIG_CACHE_TTL_MS=43200000
```

说明：这属于前端体验门禁，不作为安全认证使用。

## 视频弹幕（可选）

视频页可接入 DPlayer 内置弹幕。默认不启用；部署弹幕 Worker 后，在构建环境设置：

```bash
VITE_VIDEO_DANMAKU_API_URL=https://1701701.xyz/api/danmaku
VITE_VIDEO_DANMAKU_AUTHOR=1701701
VITE_VIDEO_DANMAKU_MAXIMUM=1000
VITE_VIDEO_DANMAKU_BOTTOM=12%
VITE_VIDEO_DANMAKU_SPEED_RATE=0.9
```

后端实现位于 `workers/video-danmaku`，使用 Cloudflare Worker + D1，接口兼容 DPlayer 默认的 `/v3/` 弹幕协议。部署步骤见 `workers/video-danmaku/README.md`。

## 图库展示

图库页默认读取静态索引 `images.json`：

- `https://1701701.xyz/gallery`
- 默认索引地址：`https://imgs.1701701.xyz/data/images.json`

可选环境变量（构建时注入）：

```bash
VITE_GALLERY_INDEX_URL=
```

说明：

- `VITE_GALLERY_INDEX_URL` 为空时，会回退到默认索引地址。
- `/myadmin` 支持通过 Worker 发布图片到图床 GitHub 仓库；普通用户仍只读取静态 `images.json`。

### 图库后台

图库后台发布链路：

1. `/myadmin` 选择“图库”，上传图片并填写分类。
2. 前端把图片发给 Worker，不接触 GitHub Token。
3. Worker 校验 `ADMIN_TOKEN` 后，用 GitHub API 把图片和 `data/images.json` 写成同一个 commit。
4. 图床仓库更新后，Cloudflare Pages 自动部署，主站图库继续读取 `https://imgs.1701701.xyz/data/images.json`。

Worker 需要额外配置：

```bash
# 这两个二选一，建议用 secret，不写进 toml
wrangler secret put GITHUB_TOKEN
# 或
wrangler secret put GALLERY_GITHUB_TOKEN
```

`workers/announcement-admin/wrangler.toml` 或 Cloudflare Worker 变量：

```toml
GALLERY_GITHUB_OWNER = "your-github-owner"
GALLERY_GITHUB_REPO = "your-gallery-repo"
GALLERY_GITHUB_BRANCH = "main"
GALLERY_REPO_INDEX_PATH = "public/data/images.json"
GALLERY_REPO_IMAGE_ROOT = "public/images"
GALLERY_PUBLIC_IMAGE_ROOT = "images"
GALLERY_PUBLIC_BASE_URL = "https://imgs.1701701.xyz"
```

GitHub token 只需要能写目标图床仓库内容。图片不会长期存放在 Worker；Worker 只在请求期间临时读取文件并提交到 GitHub。

### 音乐后台

音乐后台发布链路：

1. `/myadmin` 选择“音乐”，填写专辑信息，可上传音频、歌词、专辑封面和单曲封面，也可直接粘贴外链。
2. 前端把上传文件和外链发给 Worker，不接触 R2 凭据。
3. Worker 校验 `ADMIN_TOKEN` 后，把上传的歌曲写入 `mp3/专辑名/文件名.mp3`，歌词写入 `lrc/专辑名/文件名.lrc`，封面写入 `img/music/专辑名/文件名.jpg`，并同步更新 `json/music-index.json`。单曲封面不填时，播放器会使用专辑封面。
4. 主站曲库继续读取 `https://r2.1701701.xyz/json/music-index.json`。

Worker 需要绑定音乐 R2 bucket：

```toml
[[r2_buckets]]
binding = "MUSIC_PUBLIC_BUCKET"
bucket_name = "minyaoclub"
preview_bucket_name = "minyaoclub"
```

`workers/announcement-admin/wrangler.toml` 或 Cloudflare Worker 变量：

```toml
MUSIC_INDEX_KEY = "json/music-index.json"
MUSIC_AUDIO_ROOT = "mp3"
MUSIC_LRC_ROOT = "lrc"
MUSIC_COVER_ROOT = "img/music"
MUSIC_PUBLIC_BASE_URL = "https://r2.1701701.xyz"
```

### 视频后台

视频后台支持发布链接和维护访问口令：

1. `/myadmin` 选择“视频”，可先读取或保存“视频访问口令”。
2. 保存口令时，Worker 校验 `ADMIN_TOKEN` 后写入 R2 的 `json/video-access.json`，并生成新的 `passwordVersion`。
3. 发布视频时，填写分类、可选文件夹、视频链接、封面和备用链接。
4. Worker 校验 `ADMIN_TOKEN` 后，更新 R2 里的 `json/video-index.json`。
5. 主站视频页读取 `https://r2.1701701.xyz/json/video-index.json` 和 `https://r2.1701701.xyz/json/video-access.json`。

Worker 需要绑定视频 JSON 所在的 R2 bucket，可与音乐使用同一个 `minyaoclub` bucket：

```toml
[[r2_buckets]]
binding = "VIDEO_PUBLIC_BUCKET"
bucket_name = "minyaoclub"
preview_bucket_name = "minyaoclub"

VIDEO_INDEX_KEY = "json/video-index.json"
VIDEO_ACCESS_KEY = "json/video-access.json"
VIDEO_ACCESS_DEFAULT_PASSWORD = "SongSharing"
VIDEO_PUBLIC_BASE_URL = "https://r2.1701701.xyz"
```

### 下载后台

下载后台只发布链接，不上传文件：

1. `/myadmin` 选择“下载”，选择或新建栏目、分组。
2. 每行粘贴一个下载链接，可选填写显示标题、下载文件名和预览链接。
3. Worker 校验 `ADMIN_TOKEN` 后，更新 R2 里的 `json/download-index.json`。
4. 主站下载页继续读取 `https://r2.1701701.xyz/json/download-index.json`。

Worker 需要绑定下载 JSON 所在的 R2 bucket，可与音乐、视频使用同一个 `minyaoclub` bucket：

```toml
[[r2_buckets]]
binding = "DOWNLOAD_PUBLIC_BUCKET"
bucket_name = "minyaoclub"
preview_bucket_name = "minyaoclub"

DOWNLOAD_INDEX_KEY = "json/download-index.json"
DOWNLOAD_PUBLIC_BASE_URL = "https://r2.1701701.xyz"
```

## 公告弹窗

站点已支持“远程公告 JSON + 全局弹窗 + 本地已读”模式。

默认公告文件：

- `public/announcement.json`

可选环境变量（构建时注入）：

```bash
VITE_ANNOUNCEMENT_URL=
VITE_ANNOUNCEMENT_API_BASE_URL=
VITE_ADMIN_API_BASE_URL=
VITE_VIDEO_ACCESS_QR_URL=https://r2.1701701.xyz/QR/v.jpg
```

说明：

- `VITE_ANNOUNCEMENT_URL` 是普通用户读取的公告 JSON 地址，建议指向 R2 自定义域名下的静态文件，例如 `https://notice.1701701.xyz/announcement.json`。
- `VITE_ANNOUNCEMENT_API_BASE_URL` 只给 `/myadmin` 后台发布时使用，普通用户打开网站不会请求这个 Worker。
- `VITE_ADMIN_API_BASE_URL` 是新的通用后台 API 地址；如果设置了它，会优先于 `VITE_ANNOUNCEMENT_API_BASE_URL` 使用。
- `VITE_VIDEO_ACCESS_QR_URL` 是视频验证弹窗在远程配置未提供二维码时使用的默认小程序码地址。
- `VITE_ANNOUNCEMENT_URL` 为空时，会回退到站点内置的 `/announcement.json`。
- 用户关闭某条公告后，会按 `id` 写入本地已读记录；如果你希望重新弹出，需要更新公告 `id`。
- 前端默认只在页面打开时读取一次 `VITE_ANNOUNCEMENT_URL`；发布新公告后，用户刷新或重新打开页面即可看到。
- 公告 JSON 支持 `{ "announcement": 当前公告, "history": [历史公告] }` 格式；旧的单条公告对象格式仍可读取。
- 公告支持可选通知方式字段：`deliveryMode`，`modal` 会自动弹窗，`silent` 只显示公告入口小圆点。
- 公告支持可选正文对齐字段：`contentAlign`，可填 `left` 或 `center`。
- 公告支持可选图片字段：`imageUrl`、`imageAlt`、`imageCaption`、`imageMaxWidth`、`imageMaxHeight`。
- 后台发布新 `id` 公告时，会自动把上一条公告归档到 `history`，前台公告入口可回看历史公告；后台也可单条删除历史公告。

### 公告后台

仓库内置了一个极简公告后台：

- 前端管理页：`/myadmin`
- Worker 接口：`workers/announcement-admin/worker.js`
- Worker 配置示例：`workers/announcement-admin/wrangler.example.toml`

当前线上配置：

- 公告静态 JSON：`https://notice.1701701.xyz/announcement.json`
- 公告后台 API：`https://1701701-announcement-admin.lzbb.workers.dev`
- 本地管理员口令文件：`workers/announcement-admin/admin-token.local`（已被 git 忽略）

部署思路：

1. 在 Cloudflare 创建 KV namespace。
2. 在 Cloudflare 创建 R2 bucket，并给它绑定自定义域名，例如 `notice.1701701.xyz`。
3. 复制 `workers/announcement-admin/wrangler.example.toml` 为 `wrangler.toml`，填入 KV namespace id、R2 bucket 名称和 `PUBLIC_ANNOUNCEMENT_BASE_URL`。
4. 通过 Wrangler 设置 Worker secret：`ADMIN_TOKEN`。
5. 部署 Worker 后，把前端环境变量 `VITE_ANNOUNCEMENT_API_BASE_URL` 设置为 Worker 地址，把 `VITE_ANNOUNCEMENT_URL` 设置为 R2 静态公告地址。
6. 重新构建前端，访问 `/myadmin`，输入 `ADMIN_TOKEN` 后即可发布公告。发布时 Worker 会写入 KV，并同步写出 R2 的 `announcement.json` 给普通用户读取。

## 桌面版（Win/Mac）

桌面壳使用 Pake，默认加载线上站点 `https://1701701.xyz`，不会影响网页站点运行。
前置依赖：Node 22、Rust `>=1.85`。
默认产物为安装器：macOS 为 `.dmg`（可拖到 Applications），Windows 为 `.msi`（安装向导）。

```bash
# 在 macOS 机器打 mac 版
npm run desktop:build:mac

# 在 Windows 机器打 win 版
npm run desktop:build:win

# 构建当前机器可支持的平台
npm run desktop:build:all
```

输出目录：`artifacts/desktop`

可通过环境变量覆盖默认值：

```bash
APP_URL=https://your-site.example APP_NAME=YourApp npm run desktop:build:mac
```

如需在 macOS 生成便携 `.app`（非 DMG 安装器）：

```bash
MAC_PACKAGE_FORMAT=app npm run desktop:build:mac
```

## 安卓版（APK）

安卓版壳使用 Capacitor（远程 URL 模式），同样不影响现有网页工程。
前置依赖：Java（JDK）、Android SDK/Android Studio。

```bash
npm run android:init
npm run android:signing:init
npm run android:sync
npm run android:open
npm run android:apk:debug
npm run android:apk:release
```

APK 输出路径：

- `apps/android-shell/android/app/build/outputs/apk/debug/app-debug.apk`
- `apps/android-shell/android/app/build/outputs/apk/release/app-release.apk`

说明：已内置签名脚本。首次执行 `npm run android:signing:init` 会自动创建 keystore 与 `signing.properties`，
后续直接执行 `npm run android:apk:release` 即可产出可分发 APK。

## iOS PWA 引导

已内置 iOS Safari 的“添加到主屏幕”引导浮层（仅浏览器模式显示，可关闭或不再提示）。

## GitHub Actions 打包

已提供两条手动触发工作流：

- `.github/workflows/windows-package.yml`：构建 Windows 包并上传 artifact `windows-package`
- `.github/workflows/android-apk.yml`：构建 Android release APK 并上传 artifact `android-release-apk`

触发方式：GitHub 仓库页面 `Actions` -> 选择工作流 -> `Run workflow`。

两个工作流都支持可选输入 `release_tag`：

- 为空：只上传 Actions artifact
- 填写 tag（例如 `v1.0.0`）：会把产物同时上传到对应 GitHub Release

Release 资产文件名约定：

- `1701701-win-x64.zip`
- `1701701-android-release.apk`
- `1701701-mac-universal.zip`（可由本地打包产物手动上传，或后续接入 mac workflow；建议压缩 DMG）

## 项目结构

- `src/components`：页面与 UI 组件
- `src/hooks`：播放器、主题、toast 等逻辑
- `src/data`：曲库、视频、下载数据
- `src/styles`：样式文件
- `public`：静态资源（favicon、logo、sitemap 等）
- `apps/android-shell`：安卓壳工程（Capacitor）
- `scripts/build-desktop.sh`：桌面壳打包脚本
- `scripts/android-shell.sh`：安卓壳脚本

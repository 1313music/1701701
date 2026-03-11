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
- `https://1701701.xyz/download`
- `https://1701701.xyz/gallery`
- `https://1701701.xyz/app`
- `https://1701701.xyz/about`

说明：项目使用单页应用路由，Cloudflare Pages 通过 `public/_redirects` 将这些路径统一回退到首页入口。

## 视频访问口令（可轮换）

视频访问口令支持通过 Vite 环境变量配置：

- 变量名：`VITE_VIDEO_PASSWORD`
- 未配置时会回退到默认口令（兼容现有行为）

本地开发可在 `.env.local` 中设置：

```bash
VITE_VIDEO_PASSWORD=your-video-password
```

Cloudflare Pages（如果在 Cloudflare 上构建）可在项目设置里添加同名环境变量后重新部署。
说明：这属于前端体验门禁，变量会进入前端构建产物。

## B2 图库展示

当前图库页只做只读展示，数据源为静态索引 `gallery-index.json`：

- `https://1701701.xyz/gallery`
- 默认索引地址：`https://images.1701701.xyz/gallery-index.json`

可选环境变量（构建时注入）：

```bash
VITE_GALLERY_INDEX_URL=
```

说明：

- `VITE_GALLERY_INDEX_URL` 为空时，会回退到默认索引地址。
- 前端不提供公开上传接口；图片上传和索引更新在你自己的 B2 项目中完成。

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

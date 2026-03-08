#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:-}"
if [[ -z "$TARGET" ]]; then
  echo "Usage: ./scripts/build-desktop.sh <mac|win|all>"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="$ROOT_DIR/artifacts/desktop"
mkdir -p "$OUTPUT_DIR"

if [[ -d "/opt/homebrew/opt/rustup/bin" ]]; then
  export PATH="/opt/homebrew/opt/rustup/bin:$PATH"
fi

if [[ -d "$HOME/.cargo/bin" ]]; then
  export PATH="$HOME/.cargo/bin:$PATH"
fi

APP_URL="${APP_URL:-https://1701701.xyz}"
APP_NAME="${APP_NAME:-1701701}"
APP_ICON="${APP_ICON:-$ROOT_DIR/public/logo.png}"
APP_VERSION="${APP_VERSION:-1.0.0}"
APP_WIDTH="${APP_WIDTH:-1280}"
APP_HEIGHT="${APP_HEIGHT:-860}"
MAC_PACKAGE_FORMAT="${MAC_PACKAGE_FORMAT:-dmg}"

COMMON_ARGS=(
  "$APP_URL"
  --name "$APP_NAME"
  --width "$APP_WIDTH"
  --height "$APP_HEIGHT"
  --app-version "$APP_VERSION"
)

if [[ -f "$APP_ICON" ]]; then
  COMMON_ARGS+=(--icon "$APP_ICON")
fi

is_macos_host() {
  [[ "$(uname -s)" == "Darwin" ]]
}

is_windows_host() {
  case "$(uname -s)" in
    CYGWIN*|MINGW*|MSYS*) return 0 ;;
    *) return 1 ;;
  esac
}

ensure_rust() {
  if ! command -v rustc >/dev/null 2>&1; then
    echo "未检测到 Rust（需要 >= 1.85）。"
    echo "请先安装后再执行桌面打包：https://www.rust-lang.org/tools/install"
    exit 1
  fi
}

build_mac() {
  if ! is_macos_host; then
    echo "macOS 打包需要在 macOS 环境执行。"
    return 1
  fi

  ensure_rust
  case "$MAC_PACKAGE_FORMAT" in
    dmg)
      echo "Building macOS desktop app installer (DMG) with Pake..."
      (cd "$OUTPUT_DIR" && npx --yes pake-cli@3.9.1 "${COMMON_ARGS[@]}" --targets universal --hide-title-bar)
      ;;
    app)
      echo "Building macOS desktop app bundle (.app) with Pake..."
      (cd "$OUTPUT_DIR" && PAKE_CREATE_APP=1 npx --yes pake-cli@3.9.1 "${COMMON_ARGS[@]}" --targets universal --hide-title-bar)
      ;;
    *)
      echo "MAC_PACKAGE_FORMAT 仅支持 'dmg' 或 'app'，当前值：$MAC_PACKAGE_FORMAT"
      return 1
      ;;
  esac
}

build_win() {
  if ! is_windows_host; then
    echo "Windows 打包需要在 Windows 环境执行（或使用 Windows CI）。"
    return 1
  fi

  ensure_rust
  echo "Building Windows desktop app installer (MSI) with Pake..."
  (cd "$OUTPUT_DIR" && npx --yes pake-cli@3.9.1 "${COMMON_ARGS[@]}" --targets x64 --installer-language en-US)
}

case "$TARGET" in
  mac)
    build_mac
    ;;
  win)
    build_win
    ;;
  all)
    mac_status=0
    win_status=0

    if ! build_mac; then
      mac_status=1
      echo "Skip mac build."
    fi

    if ! build_win; then
      win_status=1
      echo "Skip win build."
    fi

    if [[ "$mac_status" -ne 0 && "$win_status" -ne 0 ]]; then
      echo "all 模式失败：当前机器无法构建任一目标。"
      exit 1
    fi
    echo "all 模式已结束：已完成当前机器可支持的平台构建。"
    ;;
  *)
    echo "Unknown target: $TARGET"
    echo "Usage: ./scripts/build-desktop.sh <mac|win|all>"
    exit 1
    ;;
esac

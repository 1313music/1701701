#!/usr/bin/env bash
set -euo pipefail

ACTION="${1:-}"
if [[ -z "$ACTION" ]]; then
  echo "Usage: ./scripts/ios-shell.sh <init|sync|open|build>"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# iOS reuses the same Capacitor project as Android; platform dir is <app>/ios.
APP_DIR="$ROOT_DIR/apps/android-shell"

ensure_app_dir() {
  if [[ ! -d "$APP_DIR" ]]; then
    echo "Missing directory: $APP_DIR"
    exit 1
  fi
}

ensure_node_modules() {
  if [[ ! -d "$APP_DIR/node_modules" ]]; then
    echo "Installing shell dependencies..."
    npm --prefix "$APP_DIR" install
  fi
}

# Build the web app at repo root. Output lands in <root>/dist.
build_web() {
  echo "Building web app (npm run build)..."
  (cd "$ROOT_DIR" && npm run build)
}

ensure_ios_platform() {
  if [[ ! -d "$APP_DIR/ios" ]]; then
    echo "Creating iOS project via Capacitor (requires Xcode + CocoaPods)..."
    (cd "$APP_DIR" && npx cap add ios)
  fi
}

# Build web, then copy the built assets into the iOS shell.
cap_copy() {
  build_web
  (cd "$APP_DIR" && npx cap copy ios)
}

ensure_app_dir

case "$ACTION" in
  init)
    ensure_node_modules
    ensure_ios_platform
    cap_copy
    echo "iOS shell initialized at: $APP_DIR/ios"
    ;;
  sync)
    ensure_node_modules
    ensure_ios_platform
    cap_copy
    echo "iOS shell synced with local web bundle."
    ;;
  open)
    ensure_node_modules
    ensure_ios_platform
    cap_copy
    (cd "$APP_DIR" && npx cap open ios)
    ;;
  build)
    ensure_node_modules
    ensure_ios_platform
    cap_copy
    TEAM_ID="${IOS_TEAM_ID:-}"
    if [[ -z "$TEAM_ID" ]]; then
      echo "未设置 IOS_TEAM_ID，无法自动归档。"
      echo "请在 Xcode 中打开 $APP_DIR/ios/App/App.xcworkspace，选择 Team 并 Archive 导出 IPA。"
      exit 0
    fi
    mkdir -p "$ROOT_DIR/artifacts/ios"
    (cd "$APP_DIR/ios" && xcodebuild \
      -workspace App/App.xcworkspace \
      -scheme App \
      -configuration Release \
      -archivePath "$ROOT_DIR/artifacts/ios/App.xcarchive" \
      archive DEVELOPMENT_TEAM="$TEAM_ID")
    echo "Archive: $ROOT_DIR/artifacts/ios/App.xcarchive"
    ;;
  *)
    echo "Unknown action: $ACTION"
    echo "Usage: ./scripts/ios-shell.sh <init|sync|open|build>"
    exit 1
    ;;
esac

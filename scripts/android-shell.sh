#!/usr/bin/env bash
set -euo pipefail

ACTION="${1:-}"
if [[ -z "$ACTION" ]]; then
  echo "Usage: ./scripts/android-shell.sh <init|sync|open|debug|release>"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT_DIR/apps/android-shell"

if [[ -d "/opt/homebrew/opt/openjdk@21/bin" ]]; then
  export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"
fi

if [[ -z "${JAVA_HOME:-}" && -d "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home" ]]; then
  export JAVA_HOME="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
fi

ensure_app_dir() {
  if [[ ! -d "$APP_DIR" ]]; then
    echo "Missing directory: $APP_DIR"
    exit 1
  fi
}

ensure_node_modules() {
  if [[ ! -d "$APP_DIR/node_modules" ]]; then
    echo "Installing Android shell dependencies..."
    npm --prefix "$APP_DIR" install
  fi
}

ensure_android_platform() {
  if [[ ! -d "$APP_DIR/android" ]]; then
    echo "Creating Android project via Capacitor..."
    (cd "$APP_DIR" && npx cap add android)
  fi
}

cap_sync() {
  (cd "$APP_DIR" && npx cap sync android)
}

run_gradle() {
  local gradle_task="$1"

  if [[ "${OS:-}" == "Windows_NT" ]]; then
    (cd "$APP_DIR/android" && ./gradlew.bat "$gradle_task")
  else
    (cd "$APP_DIR/android" && ./gradlew "$gradle_task")
  fi
}

ensure_java() {
  if ! command -v java >/dev/null 2>&1; then
    echo "Missing Java runtime. Please install JDK first."
    exit 1
  fi

  if ! java -version >/dev/null 2>&1; then
    echo "Java is not properly configured. Please install/configure JDK first."
    exit 1
  fi
}

ensure_release_signing() {
  local signing_file="$APP_DIR/android/signing.properties"

  if [[ ! -f "$signing_file" ]]; then
    echo "Missing signing file: $signing_file"
    echo "Please run: npm run android:signing:init"
    exit 1
  fi

  local store_file
  store_file="$(grep '^storeFile=' "$signing_file" | head -n1 | cut -d'=' -f2- || true)"
  local store_password
  store_password="$(grep '^storePassword=' "$signing_file" | head -n1 | cut -d'=' -f2- || true)"
  local key_alias
  key_alias="$(grep '^keyAlias=' "$signing_file" | head -n1 | cut -d'=' -f2- || true)"
  local key_password
  key_password="$(grep '^keyPassword=' "$signing_file" | head -n1 | cut -d'=' -f2- || true)"

  if [[ -z "$store_file" || -z "$store_password" || -z "$key_alias" || -z "$key_password" ]]; then
    echo "Invalid signing.properties content."
    echo "Please run: npm run android:signing:init"
    exit 1
  fi

  if [[ ! -f "$APP_DIR/android/$store_file" && ! -f "$store_file" ]]; then
    echo "Keystore not found. Expected: $APP_DIR/android/$store_file"
    echo "Please run: npm run android:signing:init"
    exit 1
  fi
}

ensure_app_dir

case "$ACTION" in
  init)
    ensure_node_modules
    ensure_android_platform
    echo "Android shell initialized at: $APP_DIR"
    ;;
  sync)
    ensure_node_modules
    ensure_android_platform
    cap_sync
    echo "Android shell synced."
    ;;
  open)
    ensure_node_modules
    ensure_android_platform
    cap_sync
    (cd "$APP_DIR" && npx cap open android)
    ;;
  debug)
    ensure_node_modules
    ensure_android_platform
    ensure_java
    cap_sync
    run_gradle assembleDebug
    echo "Debug APK: $APP_DIR/android/app/build/outputs/apk/debug/app-debug.apk"
    ;;
  release)
    ensure_node_modules
    ensure_android_platform
    ensure_java
    ensure_release_signing
    cap_sync
    run_gradle assembleRelease
    echo "Release APK: $APP_DIR/android/app/build/outputs/apk/release/app-release.apk"
    echo "Release APK build completed with signing."
    ;;
  *)
    echo "Unknown action: $ACTION"
    echo "Usage: ./scripts/android-shell.sh <init|sync|open|debug|release>"
    exit 1
    ;;
esac

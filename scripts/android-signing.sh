#!/usr/bin/env bash
set -euo pipefail

ACTION="${1:-}"
if [[ -z "$ACTION" ]]; then
  echo "Usage: ./scripts/android-signing.sh <init>"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="$ROOT_DIR/apps/android-shell/android"
SIGNING_FILE="$ANDROID_DIR/signing.properties"
KEYSTORE_DIR="$ANDROID_DIR/keystore"

if [[ -d "/opt/homebrew/opt/openjdk@21/bin" ]]; then
  export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"
fi

if [[ -z "${JAVA_HOME:-}" && -d "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home" ]]; then
  export JAVA_HOME="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
fi

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing command: $cmd"
    exit 1
  fi
}

random_secret() {
  od -An -N20 -tx1 /dev/urandom | tr -d ' \n'
}

init_signing() {
  if [[ ! -d "$ANDROID_DIR" ]]; then
    echo "Android project not found: $ANDROID_DIR"
    echo "Please run: npm run android:init"
    exit 1
  fi

  require_cmd keytool

  local key_alias="${ANDROID_KEY_ALIAS:-release}"
  local keystore_name="${ANDROID_KEYSTORE_FILE:-release.keystore}"
  local key_dname="${ANDROID_KEY_DNAME:-CN=1701701, OU=Mobile, O=1701701, L=Nanjing, ST=Jiangsu, C=CN}"
  local validity_days="${ANDROID_KEY_VALIDITY_DAYS:-36500}"

  local store_password="${ANDROID_STORE_PASSWORD:-}"
  local key_password="${ANDROID_KEY_PASSWORD:-}"

  if [[ -z "$store_password" ]]; then
    store_password="$(random_secret)"
  fi

  if [[ -z "$key_password" ]]; then
    key_password="$store_password"
  fi

  mkdir -p "$KEYSTORE_DIR"

  local keystore_path="$KEYSTORE_DIR/$keystore_name"
  local keystore_rel="keystore/$keystore_name"

  if [[ ! -f "$keystore_path" ]]; then
    if ! keytool -genkeypair \
      -v \
      -keystore "$keystore_path" \
      -alias "$key_alias" \
      -keyalg RSA \
      -keysize 2048 \
      -validity "$validity_days" \
      -storepass "$store_password" \
      -keypass "$key_password" \
      -dname "$key_dname"; then
      echo "Failed to run keytool. Please install/configure JDK first."
      exit 1
    fi
  fi

  cat >"$SIGNING_FILE" <<PROPS
storeFile=$keystore_rel
storePassword=$store_password
keyAlias=$key_alias
keyPassword=$key_password
PROPS

  chmod 600 "$SIGNING_FILE"

  echo "Signing config created."
  echo "- Keystore: $keystore_path"
  echo "- Signing file: $SIGNING_FILE"
  echo "Now run: npm run android:apk:release"
}

case "$ACTION" in
  init)
    init_signing
    ;;
  *)
    echo "Unknown action: $ACTION"
    echo "Usage: ./scripts/android-signing.sh <init>"
    exit 1
    ;;
esac

#!/usr/bin/env bash
set -euo pipefail

NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  unset npm_config_prefix
  # shellcheck disable=SC1090
  . "$NVM_DIR/nvm.sh"
  nvm use --silent 22 >/dev/null || true
fi

exec "$@"

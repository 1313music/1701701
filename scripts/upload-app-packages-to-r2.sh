#!/usr/bin/env bash
#
# 把客户端安装包与包清单上传到 R2（bucket: minyaoclub）
#
# 用途：/app 下载页的 4 个文件全部托管在 R2 自定义域名 r2.1701701.xyz 上，
#       目录约定与既有 json/ mp3/ lrc/ img/ QR/ 一致，安装包统一放 app/ 前缀。
#
# 用法：
#   CLOUDFLARE_API_TOKEN=xxx ./scripts/upload-app-packages-to-r2.sh
#   # 或先把 token 写进文件（推荐，避免 token 出现在 shell 历史里）
#   CLOUDFLARE_API_TOKEN="$(cat ~/.cf-r2-token)" ./scripts/upload-app-packages-to-r2.sh
#
# token 需要的最小权限：Account → Workers R2 Storage → Edit
#
set -euo pipefail

BUCKET="minyaoclub"
PUBLIC_BASE="https://r2.1701701.xyz"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# ---- 前置检查 ----------------------------------------------------------
if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  cat >&2 <<'EOF'
错误：缺少 CLOUDFLARE_API_TOKEN

  CLOUDFLARE_API_TOKEN=你的token ./scripts/upload-app-packages-to-r2.sh

token 创建入口（权限已预填：Workers R2 Storage / Edit）：
  https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=%5B%7B%22key%22%3A%22workers_r2%22%2C%22type%22%3A%22edit%22%7D%5D&accountId=%2A&zoneId=all&name=1701701-R2-Upload
EOF
  exit 1
fi

if ! command -v wrangler >/dev/null 2>&1; then
  echo "错误：找不到 wrangler，请先安装：npm i -g wrangler" >&2
  exit 1
fi

# 上传清单：本地路径 | R2 key | Content-Type | Content-Disposition | Cache-Control
#
# 关于 Cache-Control：安装包文件名固定（1701701.dmg 等），换包时是覆盖同名对象，
# 所以不能用 immutable —— 否则 CF 边缘会长期返回旧包。这里取 1 小时。
# 清单 json 沿用项目既有惯例 60 秒，保证改完能较快生效。
ENTRIES=(
  "artifacts/desktop/1701701.dmg|app/1701701.dmg|application/x-apple-diskimage|attachment; filename=\"1701701.dmg\"|public, max-age=3600"
  "artifacts/upload-ready/1701701-win-x64.exe|app/1701701-win-x64.exe|application/octet-stream|attachment; filename=\"1701701-win-x64.exe\"|public, max-age=3600"
  "artifacts/upload-ready/1701701-android-twa.apk|app/1701701-android-twa.apk|application/vnd.android.package-archive|attachment; filename=\"1701701-android-twa.apk\"|public, max-age=3600"
  "public/app-packages.json|json/app-packages.json|application/json; charset=utf-8||public, max-age=60"
)

# ---- 上传前先校验本地文件齐全 ------------------------------------------
echo "==> 检查本地文件"
for entry in "${ENTRIES[@]}"; do
  IFS='|' read -r local_file _key _ct _cd _cc <<< "$entry"
  if [ ! -f "$local_file" ]; then
    echo "  缺失：$local_file" >&2
    exit 1
  fi
  printf '  OK  %-52s %10s bytes\n' "$local_file" "$(stat -f%z "$local_file")"
done

# ---- 上传 --------------------------------------------------------------
echo ""
echo "==> 上传到 R2 bucket: $BUCKET"
for entry in "${ENTRIES[@]}"; do
  IFS='|' read -r local_file key ct cd cc <<< "$entry"

  args=(r2 object put "$BUCKET/$key" --file="$local_file" --content-type="$ct" --cache-control="$cc" --remote)
  if [ -n "$cd" ]; then
    args+=(--content-disposition="$cd")
  fi

  printf '  → %-40s ' "$key"
  if out="$(wrangler "${args[@]}" 2>&1)"; then
    echo "✓"
  else
    echo "✗"
    echo "$out" | sed 's/^/      /' >&2
    exit 1
  fi
done

# ---- 上传后线上验证 ----------------------------------------------------
echo ""
echo "==> 线上验证（等待边缘生效，最多重试 5 次）"
expected_type() {
  case "$1" in
    app/1701701.dmg)                 echo "application/x-apple-diskimage" ;;
    app/1701701-win-x64.exe)         echo "application/octet-stream" ;;
    app/1701701-android-twa.apk)     echo "application/vnd.android.package-archive" ;;
    json/app-packages.json)          echo "application/json" ;;
  esac
}

fail=0
for entry in "${ENTRIES[@]}"; do
  IFS='|' read -r _local_file key _ct _cd _cc <<< "$entry"
  want="$(expected_type "$key")"

  code=""; type=""; size=""
  for attempt in 1 2 3 4 5; do
    read -r code type size <<< "$(curl -s -o /dev/null -w '%{http_code} %{content_type} %{size_download}' -L "$PUBLIC_BASE/$key")"
    [ "$code" = "200" ] && break
    sleep 2
  done

  if [ "$code" != "200" ]; then
    printf '  ✗ %-36s HTTP %s\n' "$key" "$code"
    fail=1
  elif [ "${type%%;*}" != "$want" ]; then
    printf '  ⚠ %-36s HTTP 200  但 Content-Type 是 %s（期望 %s）\n' "$key" "$type" "$want"
    fail=1
  else
    printf '  ✓ %-36s HTTP 200  %-38s %s bytes\n' "$key" "$type" "$size"
  fi
done

echo ""
if [ "$fail" = "0" ]; then
  echo "全部就绪。/app 下载页刷新后应显示三张「立即下载」卡片。"
else
  echo "有项目未通过验证，请看上面输出。" >&2
  exit 1
fi

# 清单的最终内容（便于确认线上与本地一致）
echo ""
echo "==> 线上清单内容"
curl -s -L "$PUBLIC_BASE/json/app-packages.json" | head -30

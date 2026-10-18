#!/usr/bin/env bash
#
# 把本地目录里的音频/歌词按扩展名推断 Content-Type 上传到 R2（bucket: minyaoclub）
#
# 用途：新增或替换专辑音源时，避免手写一长串 wrangler 命令。
#       目录约定与站点既有结构一致：mp3/ 放音频、lrc/ 放歌词、json/ 放清单。
#
# 用法：
#   CLOUDFLARE_API_TOKEN="$(cat ~/.cf-r2-token)" ./scripts/upload-dir-to-r2.sh <本地目录> <R2路径前缀>
#
# 例：
#   ./scripts/upload-dir-to-r2.sh /tmp/stage-mp3 "mp3/叁缺壹吉隆坡站2025精选"
#
# token 需要的最小权限：Account → Workers R2 Storage → Edit
#
# 关于 Cache-Control：音频是固定文件名、后续可能覆盖同名对象，不能用 immutable。
# 音频取 1 小时，歌词 5 分钟（歌词改得勤），清单 JSON 60 秒（沿用项目惯例）。
#
set -euo pipefail

BUCKET="${R2_BUCKET:-minyaoclub}"

if [ $# -lt 2 ]; then
  echo "用法：$0 <本地目录> <R2路径前缀>" >&2
  exit 1
fi

SRC="${1%/}"
PREFIX="${2%/}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "错误：缺少 CLOUDFLARE_API_TOKEN（CLOUDFLARE_API_TOKEN=\"\$(cat ~/.cf-r2-token)\" $0 ...）" >&2
  exit 1
fi

if [ ! -d "$SRC" ]; then
  echo "错误：目录不存在：$SRC" >&2
  exit 1
fi

uploaded=0
skipped=0

for f in "$SRC"/*; do
  [ -f "$f" ] || continue
  name="$(basename "$f")"
  ext="${name##*.}"

  case "$ext" in
    mp3)  ct="audio/mpeg";                 cc="public, max-age=3600" ;;
    flac) ct="audio/flac";                 cc="public, max-age=3600" ;;
    lrc)  ct="text/plain; charset=utf-8";  cc="public, max-age=300" ;;
    json) ct="application/json; charset=utf-8"; cc="public, max-age=60" ;;
    *)
      echo "跳过（未知类型）：$name"
      skipped=$((skipped + 1))
      continue
      ;;
  esac

  echo "==> $BUCKET/$PREFIX/$name"
  wrangler r2 object put "$BUCKET/$PREFIX/$name" \
    --file="$f" \
    --content-type="$ct" \
    --cache-control="$cc" \
    --remote >/dev/null
  uploaded=$((uploaded + 1))
done

echo "完成：上传 $uploaded 个，跳过 $skipped 个"

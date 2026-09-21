#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT="beian_miniapp"
SERVER="ubuntu@ruiheqi.cn"
REMOTE_DIR="/home/ubuntu/${PROJECT}"
VERSION_FILE="${SCRIPT_DIR}/VERSION"

# 版本号：如果传了就用手动指定，否则从 VERSION 文件自动递增补丁号
if [ -n "$1" ]; then
  VERSION="$1"
else
  CURRENT=$(cat "$VERSION_FILE" 2>/dev/null | tr -d '[:space:]')
  if [ -z "$CURRENT" ]; then
    echo "VERSION 文件为空，请手动指定版本号"
    exit 1
  fi
  # 递增补丁号: 1.8.0 → 1.8.1
  MAJOR="${CURRENT%%.*}"
  REST="${CURRENT#*.}"
  MINOR="${REST%%.*}"
  PATCH="${REST#*.}"
  PATCH=$((PATCH + 1))
  VERSION="${MAJOR}.${MINOR}.${PATCH}"
  echo "auto-bump: ${CURRENT} → ${VERSION}"
fi

DESC="${2:-更新}"

echo "==> rsync ${PROJECT} → ${SERVER}"
rsync -avz --delete --exclude 'node_modules' --exclude '.git' --exclude 'sync/*.db' \
  --exclude '__pycache__' "${SCRIPT_DIR}/" "${SERVER}:${REMOTE_DIR}/"

echo "==> upload to WeChat (version=${VERSION})"
ssh "${SERVER}" "cd ${REMOTE_DIR} && node scripts/upload.js '${VERSION}' '${DESC}'"

# 上传成功后写回 VERSION
echo "${VERSION}" > "$VERSION_FILE"
echo "==> VERSION → ${VERSION}"

echo "==> done. next: mp.weixin.qq.com → 版本管理 → 提交审核 → 发布"
echo ""
echo "💡 记得提交 VERSION 更新: git add VERSION && git commit -m 'chore: bump to ${VERSION}'"

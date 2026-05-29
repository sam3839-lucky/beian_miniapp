#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT="beian_miniapp"
SERVER="ubuntu@ruiheqi.cn"
REMOTE_DIR="/home/ubuntu/${PROJECT}"

VERSION="${1:-1.0.$(date +%m%d)}"
DESC="${2:-更新}"

echo "==> rsync ${PROJECT} → ${SERVER}"
rsync -avz --delete --exclude 'node_modules' --exclude '.git' --exclude 'sync/*.db' \
  --exclude '__pycache__' "${SCRIPT_DIR}/" "${SERVER}:${REMOTE_DIR}/"

echo "==> upload to WeChat (version=${VERSION})"
ssh "${SERVER}" "cd ${REMOTE_DIR} && node scripts/upload.js '${VERSION}' '${DESC}'"

echo "==> done. next: mp.weixin.qq.com → 版本管理 → 提交审核 → 发布"

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

# 服务器专属文件：本地没有，靠 --delete 会被整批删掉
# private.key 删了上传必失败；.env / *.db 是服务器上的运行数据
PROTECTED=(private.key .env property.db .review-state.json .deploy-backups .gstack)

# 只对 rsync 之前确实存在的文件做校验：.review-state.json 之类是运行时才生成的
echo "==> 记录 rsync 前服务器上已存在的专属文件"
EXISTED=$(ssh "${SERVER}" "cd '${REMOTE_DIR}' && for f in ${PROTECTED[*]}; do test -e \"\$f\" && echo \"\$f\"; done" | tr '\n' ' ')
echo "    ${EXISTED:-（无）}"

echo "==> rsync ${PROJECT} → ${SERVER}"
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '__pycache__' \
  --exclude 'private.key' \
  --exclude '.env' \
  --exclude '.env.*' \
  --exclude '*.db' \
  --exclude '*.db-shm' \
  --exclude '*.db-wal' \
  --exclude '.deploy-backups' \
  --exclude '.review-state.json' \
  --exclude '.gstack' \
  "${SCRIPT_DIR}/" "${SERVER}:${REMOTE_DIR}/"

echo "==> 校验服务器专属文件未被误删"
STILL=$(ssh "${SERVER}" "cd '${REMOTE_DIR}' && for f in ${PROTECTED[*]}; do test -e \"\$f\" && echo \"\$f\"; done" | tr '\n' ' ')
MISSING=""
for f in ${EXISTED}; do
  case " ${STILL} " in
    *" ${f} "*) ;;
    *) MISSING="${MISSING} ${f}" ;;
  esac
done
if [ -n "$MISSING" ]; then
  echo "❌ rsync 后缺少服务器专属文件:${MISSING}"
  echo "   已中止，未执行上传。请先恢复这些文件再重试。"
  exit 1
fi
echo "    OK: ${EXISTED:-（本次无可校验项）}"

echo "==> upload to WeChat (version=${VERSION})"
ssh "${SERVER}" "cd ${REMOTE_DIR} && node scripts/upload.js '${VERSION}' '${DESC}'"

# 上传成功后写回 VERSION
echo "${VERSION}" > "$VERSION_FILE"
echo "==> VERSION → ${VERSION}"

echo "==> done. next: mp.weixin.qq.com → 版本管理 → 提交审核 → 发布"
echo ""
echo "💡 记得提交 VERSION 更新: git add VERSION && git commit -m 'chore: bump to ${VERSION}'"

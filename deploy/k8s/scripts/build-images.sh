#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
cd "$REPO_ROOT"

die() { echo "[error] $*" >&2; exit 1; }

# ---------- 输出语言 ----------
# 刻意用 APP_LANG 而不是 LANG：LANG 是 POSIX 标准变量，多数系统已被占用
# （en_US.UTF-8 之类），复用它会让部署输出语言取决于宿主机 locale，不可预期。
APP_LANG="${APP_LANG:-zh-CN}"
if [ "$APP_LANG" = "en-US" ]; then
  t() { printf '%s\n' "$2"; }
  t_err() { printf '%s\n' "$2" >&2; }
else
  t() { printf '%s\n' "$1"; }
  t_err() { printf '%s\n' "$1" >&2; }
fi

BACKEND_TAG="${BACKEND_TAG:-1.0.0}"
FRONTEND_TAG="${FRONTEND_TAG:-1.0.0-k8s}"
BACKEND_IMAGE="kanray-backend:${BACKEND_TAG}"
FRONTEND_IMAGE="kanray-frontend:${FRONTEND_TAG}"

[[ -f deploy/k8s/backend/Dockerfile ]] || die "deploy/k8s/backend/Dockerfile 不存在"
[[ -f deploy/k8s/frontend/Dockerfile ]] || die "deploy/k8s/frontend/Dockerfile 不存在"

t "[images] 构建 ${BACKEND_IMAGE} ..." "[images] Building ${BACKEND_IMAGE} ..."
docker build -t "${BACKEND_IMAGE}" -f deploy/k8s/backend/Dockerfile .

t "[images] 构建 ${FRONTEND_IMAGE} ..." "[images] Building ${FRONTEND_IMAGE} ..."
docker build -t "${FRONTEND_IMAGE}" -f deploy/k8s/frontend/Dockerfile .

if [[ -n "${PUSH_REGISTRY:-}" ]]; then
  t "[images] 推送至 ${PUSH_REGISTRY} ..." "[images] Pushing to ${PUSH_REGISTRY} ..."
  docker tag "${BACKEND_IMAGE}" "${PUSH_REGISTRY%/}/${BACKEND_IMAGE}"
  docker tag "${FRONTEND_IMAGE}" "${PUSH_REGISTRY%/}/${FRONTEND_IMAGE}"
  docker push "${PUSH_REGISTRY%/}/${BACKEND_IMAGE}"
  docker push "${PUSH_REGISTRY%/}/${FRONTEND_IMAGE}"
  t "[images] 推送完成。请将 deploy/k8s 下清单中的 image: 改为 ${PUSH_REGISTRY%/}/<镜像>:<tag>" \
    "[images] Push complete. Update the image: field in the manifests under deploy/k8s to ${PUSH_REGISTRY%/}/<image>:<tag>"
else
  t "[images] 未设置 PUSH_REGISTRY，仅构建本地镜像（配合 ImagePullPolicy=IfNotPresent 使用）。" \
    "[images] PUSH_REGISTRY not set, built local images only (use with ImagePullPolicy=IfNotPresent)."
  t "[images] 生产环境：设置 PUSH_REGISTRY 推送后，更新 deploy/k8s 各清单中的 image 字段。" \
    "[images] For production: set PUSH_REGISTRY, push, then update the image field in each deploy/k8s manifest."
fi
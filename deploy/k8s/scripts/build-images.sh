#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
cd "$REPO_ROOT"

die() { echo "[error] $*" >&2; exit 1; }

BACKEND_TAG="${BACKEND_TAG:-1.0.0}"
FRONTEND_TAG="${FRONTEND_TAG:-1.0.0-k8s}"
BACKEND_IMAGE="kanray-backend:${BACKEND_TAG}"
FRONTEND_IMAGE="kanray-frontend:${FRONTEND_TAG}"

[[ -f deploy/k8s/backend/Dockerfile ]] || die "deploy/k8s/backend/Dockerfile 不存在"
[[ -f deploy/k8s/frontend/Dockerfile ]] || die "deploy/k8s/frontend/Dockerfile 不存在"

echo "[images] 构建 ${BACKEND_IMAGE} ..."
docker build -t "${BACKEND_IMAGE}" -f deploy/k8s/backend/Dockerfile .

echo "[images] 构建 ${FRONTEND_IMAGE} ..."
docker build -t "${FRONTEND_IMAGE}" -f deploy/k8s/frontend/Dockerfile .

if [[ -n "${PUSH_REGISTRY:-}" ]]; then
  echo "[images] 推送至 ${PUSH_REGISTRY} ..."
  docker tag "${BACKEND_IMAGE}" "${PUSH_REGISTRY%/}/${BACKEND_IMAGE}"
  docker tag "${FRONTEND_IMAGE}" "${PUSH_REGISTRY%/}/${FRONTEND_IMAGE}"
  docker push "${PUSH_REGISTRY%/}/${BACKEND_IMAGE}"
  docker push "${PUSH_REGISTRY%/}/${FRONTEND_IMAGE}"
  echo "[images] 推送完成。请将 deploy/k8s 下清单中的 image: 改为 ${PUSH_REGISTRY%/}/<镜像>:<tag>"
else
  echo "[images] 未设置 PUSH_REGISTRY，仅构建本地镜像（配合 ImagePullPolicy=IfNotPresent 使用）。"
  echo "[images] 生产环境：设置 PUSH_REGISTRY 推送后，更新 deploy/k8s 各清单中的 image 字段。"
fi
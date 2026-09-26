#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$K8S_DIR"

KUBECTL="${KUBECTL:-kubectl}"
NAMESPACE="${NAMESPACE:-kanray}"
SECRET_NAME="kanray-secrets"
KEEP_DATA=0
LOG_TARGET="deployment/backend"

die() { echo "[error] $*" >&2; exit 1; }
info() { echo "[deploy] $*"; }

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

usage() {
  if [ "$APP_LANG" = "en-US" ]; then
    cat <<'EOF'
Usage: deploy.sh {up|down|status|logs} [--keep-data] [logs target]
  up                apply all manifests and wait until ready (Secret generated on first run)
  down              delete resources; also removes PVC/PV and wipes data, --keep-data stops the app but keeps data
  status            show resources and persistent volume state in the Namespace
  logs [target]      follow logs (default deployment/backend)
EOF
  else
    cat <<'EOF'
用法：deploy.sh {up|down|status|logs} [--keep-data] [logs 目标]
  up                应用全部清单并等待就绪（首次自动生成 Secret）
  down              删除资源；默认连带 PVC/PV 清空数据，--keep-data 仅停应用保留数据
  status            查看 Namespace 内资源与持久卷状态
  logs [目标]        跟随日志（默认 deployment/backend）
EOF
  fi
}

rand_b64() { openssl rand -base64 32 2>/dev/null | tr -d '\n'; }
rand_hex() { openssl rand -hex 24 2>/dev/null; }

check_cluster() {
  "$KUBECTL" cluster-info >/dev/null 2>&1 \
    || die "$(t '无法访问 Kubernetes 集群（kubectl cluster-info 失败）。请检查 kubeconfig 与集群状态。' \
        'Cannot reach the Kubernetes cluster (kubectl cluster-info failed). Check kubeconfig and cluster status.')"
}

ensure_secret() {
  if "$KUBECTL" get secret "$SECRET_NAME" -n "$NAMESPACE" >/dev/null 2>&1; then
    info "$(t "Secret ${SECRET_NAME} 已存在，复用（如需轮换请先手动删除）" \
        "Secret ${SECRET_NAME} already exists, reusing it (delete it manually first to rotate)")"
    return
  fi
  # 密钥仅随机生成，并可用同名环境变量覆盖；不读取其他部署目录（docker 与 k8s 完全隔离）
  local pgu pgp pgd url jwt ds admin
  pgu="${POSTGRES_USER:-kanray}"
  pgd="${POSTGRES_DB:-kanray}"
  pgp="${POSTGRES_PASSWORD:-$(rand_hex)}"
  url="${DB_URL:-postgresql://${pgu}:${pgp}@postgres:5432/${pgd}}"
  jwt="${JWT_SECRET:-$(rand_b64)}"
  ds="${DATASOURCE_SECRET:-$(rand_b64)}"
  admin="${ADMIN_INITIAL_PASSWORD:-admin123}"
  "$KUBECTL" create secret generic "$SECRET_NAME" -n "$NAMESPACE" \
    --from-literal=JWT_SECRET="$jwt" \
    --from-literal=DATASOURCE_SECRET="$ds" \
    --from-literal=POSTGRES_USER="$pgu" \
    --from-literal=POSTGRES_PASSWORD="$pgp" \
    --from-literal=POSTGRES_DB="$pgd" \
    --from-literal=DB_URL="$url" \
    --from-literal=REDIS_URL="${REDIS_URL:-redis://redis:6379/0}" \
    --from-literal=ADMIN_INITIAL_PASSWORD="$admin"
  info "$(t "Secret ${SECRET_NAME} 已生成" "Secret ${SECRET_NAME} generated")"
  info "$(t "初始管理员：admin@kanray.local / ${admin}（请尽快改密）" \
      "Initial admin: admin@kanray.local / ${admin} (change it soon)")"
}

cmd_up() {
  check_cluster
  "$KUBECTL" apply -f base/namespace.yaml
  ensure_secret
  "$KUBECTL" apply -f base/configmap.yaml
  "$KUBECTL" apply -f pv/hostpath-pv.yaml -f pv/pvc.yaml
  "$KUBECTL" apply -f postgres/service.yaml -f postgres/statefulset.yaml
  "$KUBECTL" apply -f redis/service.yaml -f redis/statefulset.yaml
  "$KUBECTL" apply -f backend/service.yaml -f backend/deployment.yaml
  "$KUBECTL" apply -f worker/deployment.yaml
  "$KUBECTL" apply -f frontend/deployment.yaml -f frontend/service.yaml
  info "$(t '等待就绪…' 'Waiting for readiness…')"
  "$KUBECTL" -n "$NAMESPACE" rollout status statefulset/postgres --timeout=240s
  "$KUBECTL" -n "$NAMESPACE" rollout status statefulset/redis --timeout=120s
  "$KUBECTL" -n "$NAMESPACE" rollout status deployment/worker --timeout=180s
  "$KUBECTL" -n "$NAMESPACE" rollout status deployment/backend --timeout=180s
  "$KUBECTL" -n "$NAMESPACE" rollout status deployment/frontend --timeout=120s
  info "$(t '完成。访问方式：' 'Done. Access it via:')"
  info "$(t "  端口转发：kubectl -n ${NAMESPACE} port-forward svc/frontend 8080:80  → http://localhost:8080" \
      "  Port forward: kubectl -n ${NAMESPACE} port-forward svc/frontend 8080:80  → http://localhost:8080")"
  info "$(t "  NodePort ：http://<节点IP>:30080" "  NodePort : http://<node-ip>:30080")"
  info "$(t "  Swagger  ：端口转发后 http://localhost:8080/api/open/docs" \
      "  Swagger  : http://localhost:8080/api/open/docs after port forwarding")"
}

cmd_down() {
  if [[ "$KEEP_DATA" == "1" ]]; then
    info "$(t '保留数据模式：仅删除应用资源（PVC/PV/数据保留）' \
        'Keep-data mode: removing app resources only (PVC/PV and data are preserved)')"
    "$KUBECTL" delete -f frontend/deployment.yaml -f frontend/service.yaml --ignore-not-found
    "$KUBECTL" delete -f worker/deployment.yaml --ignore-not-found
    "$KUBECTL" delete -f backend/deployment.yaml -f backend/service.yaml --ignore-not-found
    "$KUBECTL" delete -f redis/statefulset.yaml -f redis/service.yaml --ignore-not-found
    "$KUBECTL" delete -f postgres/statefulset.yaml -f postgres/service.yaml --ignore-not-found
    info "$(t "已停用。数据保留；如需恢复执行：$0 up" "Deactivated. Data preserved; to restore run: $0 up")"
    return
  fi
  info "$(t '删除全部资源（连同 PVC/PV 清空数据，不可恢复！）' \
      'Deleting all resources (PVC/PV included, data wiped, cannot be undone!)')"
  "$KUBECTL" delete -f base/namespace.yaml --ignore-not-found --wait=true
  "$KUBECTL" delete -f pv/hostpath-pv.yaml --ignore-not-found
  info "$(t '已全部删除。' 'All resources deleted.')"
}

cmd_status() {
  "$KUBECTL" -n "$NAMESPACE" get deploy,sts,svc,pods,pvc -o wide
  "$KUBECTL" get pv 2>/dev/null | grep kanray || true
}

cmd_logs() {
  "$KUBECTL" -n "$NAMESPACE" logs -f --tail=200 "$LOG_TARGET"
}

ACTION="${1:-up}"
shift || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --keep-data) KEEP_DATA=1; shift ;;
    *) LOG_TARGET="$1"; shift ;;
  esac
done

case "$ACTION" in
  up) cmd_up ;;
  down) cmd_down ;;
  status) cmd_status ;;
  logs) cmd_logs ;;
  *) usage; exit 1 ;;
esac
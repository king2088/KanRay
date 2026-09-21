#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$K8S_DIR/../.." && pwd)"
cd "$K8S_DIR"

KUBECTL="${KUBECTL:-kubectl}"
NAMESPACE="${NAMESPACE:-kanban}"
SECRET_NAME="kanban-secrets"
KEEP_DATA=0
LOG_TARGET="deployment/backend"

die() { echo "[error] $*" >&2; exit 1; }
info() { echo "[deploy] $*"; }

usage() {
  cat <<'EOF'
用法：deploy.sh {up|down|status|logs} [--keep-data] [logs 目标]
  up                应用全部清单并等待就绪（首次自动生成 Secret）
  down              删除资源；默认连带 PVC/PV 清空数据，--keep-data 仅停应用保留数据
  status            查看 Namespace 内资源与持久卷状态
  logs [目标]        跟随日志（默认 deployment/backend）
EOF
}

rand_b64() { openssl rand -base64 32 2>/dev/null | tr -d '\n'; }
rand_hex() { openssl rand -hex 24 2>/dev/null; }

source_dotenv() {
  local f="$REPO_ROOT/deploy/.env"
  [[ -f "$f" ]] || return 0
  set -a; . "$f"; set +a
}

check_cluster() {
  "$KUBECTL" cluster-info >/dev/null 2>&1 \
    || die "无法访问 Kubernetes 集群（kubectl cluster-info 失败）。请检查 kubeconfig 与集群状态。"
}

ensure_secret() {
  if "$KUBECTL" get secret "$SECRET_NAME" -n "$NAMESPACE" >/dev/null 2>&1; then
    info "Secret ${SECRET_NAME} 已存在，复用（如需轮换请先手动删除）"
    return
  fi
  source_dotenv
  local pgu pgp pgd url jwt ds admin
  pgu="${POSTGRES_USER:-kanban}"
  pgd="${POSTGRES_DB:-kanban}"
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
  info "Secret ${SECRET_NAME} 已生成"
  info "初始管理员：admin@kanban.local / ${admin}（请尽快改密）"
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
  info "等待就绪…"
  "$KUBECTL" -n "$NAMESPACE" rollout status statefulset/postgres --timeout=240s
  "$KUBECTL" -n "$NAMESPACE" rollout status statefulset/redis --timeout=120s
  "$KUBECTL" -n "$NAMESPACE" rollout status deployment/worker --timeout=180s
  "$KUBECTL" -n "$NAMESPACE" rollout status deployment/backend --timeout=180s
  "$KUBECTL" -n "$NAMESPACE" rollout status deployment/frontend --timeout=120s
  info "完成。访问方式："
  info "  端口转发：kubectl -n ${NAMESPACE} port-forward svc/frontend 8080:80  → http://localhost:8080"
  info "  NodePort ：http://<节点IP>:30080"
  info "  Swagger  ：端口转发后 http://localhost:8080/api/open/docs"
}

cmd_down() {
  if [[ "$KEEP_DATA" == "1" ]]; then
    info "保留数据模式：仅删除应用资源（PVC/PV/数据保留）"
    "$KUBECTL" delete -f frontend/deployment.yaml -f frontend/service.yaml --ignore-not-found
    "$KUBECTL" delete -f worker/deployment.yaml --ignore-not-found
    "$KUBECTL" delete -f backend/deployment.yaml -f backend/service.yaml --ignore-not-found
    "$KUBECTL" delete -f redis/statefulset.yaml -f redis/service.yaml --ignore-not-found
    "$KUBECTL" delete -f postgres/statefulset.yaml -f postgres/service.yaml --ignore-not-found
    info "已停用。数据保留；如需恢复执行：$0 up"
    return
  fi
  info "删除全部资源（连同 PVC/PV 清空数据，不可恢复！）"
  "$KUBECTL" delete -f base/namespace.yaml --ignore-not-found --wait=true
  "$KUBECTL" delete -f pv/hostpath-pv.yaml --ignore-not-found
  info "已全部删除。"
}

cmd_status() {
  "$KUBECTL" -n "$NAMESPACE" get deploy,sts,svc,pods,pvc -o wide
  "$KUBECTL" get pv 2>/dev/null | grep kanban || true
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
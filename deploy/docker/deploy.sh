#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# ---------- helpers ----------

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
rand_hex() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 24
  else
    head -c 24 /dev/urandom | xxd -p | tr -d '\n'
  fi
}

rand_b64() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 32 | tr -d '\n'
  else
    head -c 32 /dev/urandom | base64 | tr -d '\n/+=' | head -c 32
  fi
}

die() { echo "[error] $*" >&2; exit 1; }

# ---------- 参数解析 ----------
# 用法：deploy.sh {up|down|restart|logs|ps} [--stack pg|sqlite|mysql|mariadb] [docker compose 参数]
ACTION=""
STACK="${STACK:-pg}"
PASSTHROUGH=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --stack|-s)
      [[ $# -ge 2 ]] || die "--stack 需要参数：pg|sqlite|mysql|mariadb"
      STACK="$2"; shift 2 ;;
    --stack=*)
      STACK="${1#*=}"; shift ;;
    *)
      if [[ -z "$ACTION" ]]; then ACTION="$1"; else PASSTHROUGH+=("$1"); fi
      shift ;;
  esac
done
ACTION="${ACTION:-up}"

case "$STACK" in
  pg|postgres)  STACK=pg;      COMPOSE_FILE="docker-compose.yml" ;;
  sqlite)       COMPOSE_FILE="docker-compose.sqlite.yml" ;;
  mysql)        COMPOSE_FILE="docker-compose.mysql.yml" ;;
  mariadb)      COMPOSE_FILE="docker-compose.mariadb.yml" ;;
  *)            die "未知 stack：${STACK}（可选 pg|sqlite|mysql|mariadb）" ;;
esac
[[ -f "$COMPOSE_FILE" ]] || die "未找到编排文件 $COMPOSE_FILE"
COMPOSE=(docker compose -f "$COMPOSE_FILE")

# ---------- 前置检查 ----------
command -v docker >/dev/null 2>&1 || die "需要安装 docker"
docker compose version >/dev/null 2>&1 || die "需要 docker compose v2+"

# ---------- .env 生成 ----------
if [[ ! -f .env ]]; then
  t '[deploy] 未检测到 .env，从 .env.example 生成并注入随机密钥' \
      '[deploy] No .env found; generated one from .env.example with random secrets'
  [[ -f .env.example ]] || die ".env.example 不存在"
  cp .env.example .env
  rand_jwt="$(rand_b64)"
  rand_ds="$(rand_b64)"
  rand_pg="$(rand_hex)"
  rand_mysql="$(rand_hex)"
  rand_maria="$(rand_hex)"
  sed -i.bak -E \
    -e "s#^(JWT_SECRET=).*#JWT_SECRET=${rand_jwt}#" \
    -e "s#^(DATASOURCE_SECRET=).*#DATASOURCE_SECRET=${rand_ds}#" \
    -e "s#^(POSTGRES_PASSWORD=).*#POSTGRES_PASSWORD=${rand_pg}#" \
    -e "s#^(MYSQL_ROOT_PASSWORD=).*#MYSQL_ROOT_PASSWORD=${rand_mysql}#" \
    -e "s#^(MARIADB_ROOT_PASSWORD=).*#MARIADB_ROOT_PASSWORD=${rand_maria}#" \
    .env
  # 兼容 macOS / GNU sed 产生的 .bak
  rm -f .env.bak
  t '[deploy] .env 已生成（JWT_SECRET / DATASOURCE_SECRET / POSTGRES_PASSWORD / MYSQL_ROOT_PASSWORD / MARIADB_ROOT_PASSWORD 已自动填充）' \
      '[deploy] .env generated (JWT_SECRET / DATASOURCE_SECRET / POSTGRES_PASSWORD / MYSQL_ROOT_PASSWORD / MARIADB_ROOT_PASSWORD auto-filled)'
  t '[deploy] 管理员初始密码：admin123（生产环境请修改 ADMIN_INITIAL_PASSWORD）' \
      '[deploy] Initial admin password: admin123 (set ADMIN_INITIAL_PASSWORD for production)'
fi

# ---------- 子命令 ----------
case "$ACTION" in
  up)
    t "[deploy] stack=${STACK} 编排文件=${COMPOSE_FILE}" \
        "[deploy] stack=${STACK} compose file=${COMPOSE_FILE}"
    "${COMPOSE[@]}" up -d --build ${PASSTHROUGH[@]+"${PASSTHROUGH[@]}"}
    "${COMPOSE[@]}" ps
    PORT="$(grep -E '^KANRAY_PORT=' .env 2>/dev/null | cut -d= -f2)"
    PORT="${PORT:-8080}"
    echo
    t "[deploy] stack=${STACK} 访问地址：http://localhost:${PORT}" \
        "[deploy] stack=${STACK} URL: http://localhost:${PORT}"
    t "[deploy] Swagger 文档：http://localhost:${PORT}/api/open/docs" \
        "[deploy] Swagger docs: http://localhost:${PORT}/api/open/docs"
    t "[deploy] 初始管理员：admin@kanray.local / admin123（请尽快改密）" \
        "[deploy] Initial admin: admin@kanray.local / admin123 (change it soon)"
    ;;
  down)
    "${COMPOSE[@]}" down ${PASSTHROUGH[@]+"${PASSTHROUGH[@]}"}
    ;;
  restart)
    "${COMPOSE[@]}" restart ${PASSTHROUGH[@]+"${PASSTHROUGH[@]}"}
    ;;
  logs)
    "${COMPOSE[@]}" logs -f ${PASSTHROUGH[@]+"${PASSTHROUGH[@]}"}
    ;;
  ps)
    "${COMPOSE[@]}" ps ${PASSTHROUGH[@]+"${PASSTHROUGH[@]}"}
    ;;
  *)
    t "用法：$0 {up|down|restart|logs|ps} [--stack pg|sqlite|mysql|mariadb] [docker compose 参数]" \
        "Usage: $0 {up|down|restart|logs|ps} [--stack pg|sqlite|mysql|mariadb] [docker compose args]"
    t "也可用环境变量 STACK=mysql $0 up" "Or pass the stack via env var: STACK=mysql $0 up"
    exit 1
    ;;
esac

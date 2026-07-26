#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-${ROOT_DIR}/.env.production}"
BACKUP_DIR="${1:-}"

if [[ -z "${BACKUP_DIR}" || ! -d "${BACKUP_DIR}" ]]; then
  echo "[restore] informe o diretório de backup: bash scripts/backup/restore-platform-state.sh backups/platform_YYYYMMDD_HHMMSS"
  exit 1
fi

echo "[restore] restaurando mysql"
MYSQL_BACKUP_FILE="$(find "${BACKUP_DIR}" -maxdepth 1 -name 'mysql-backup-*.sql.gz' | sort | tail -n 1)"
[[ -n "${MYSQL_BACKUP_FILE}" ]] || { echo "[restore] backup mysql não encontrado em ${BACKUP_DIR}"; exit 1; }
bash "${ROOT_DIR}/scripts/backup/restore-mysql.sh" "${MYSQL_BACKUP_FILE}"

if [[ -f "${BACKUP_DIR}/redis_dump.rdb" ]]; then
  echo "[restore] restaurando redis"
  docker compose --env-file "${ENV_FILE}" -f "${ROOT_DIR}/docker-compose.prod.yml" stop redis
  docker compose --env-file "${ENV_FILE}" -f "${ROOT_DIR}/docker-compose.prod.yml" cp "${BACKUP_DIR}/redis_dump.rdb" redis:/data/dump.rdb
  docker compose --env-file "${ENV_FILE}" -f "${ROOT_DIR}/docker-compose.prod.yml" up -d redis
fi

echo "[restore] concluído"

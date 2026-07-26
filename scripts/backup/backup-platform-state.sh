#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-${ROOT_DIR}/.env.production}"
BACKUP_ROOT="${BACKUP_ROOT:-${ROOT_DIR}/backups}"
STAMP="$(date +%Y%m%d_%H%M%S)"
TARGET_DIR="${BACKUP_ROOT}/platform_${STAMP}"

mkdir -p "${TARGET_DIR}"

echo "[backup] exportando mysql"
bash "${ROOT_DIR}/scripts/backup/backup-mysql.sh" "${TARGET_DIR}"

echo "[backup] exportando redis"
docker compose --env-file "${ENV_FILE}" -f "${ROOT_DIR}/docker-compose.prod.yml" exec -T redis redis-cli BGSAVE >/dev/null
sleep 3
docker compose --env-file "${ENV_FILE}" -f "${ROOT_DIR}/docker-compose.prod.yml" cp redis:/data/dump.rdb "${TARGET_DIR}/redis_dump.rdb" >/dev/null

echo "[backup] salvando artefatos operacionais"
cp "${ENV_FILE}" "${TARGET_DIR}/env.snapshot"
cp "${ROOT_DIR}/docker-compose.prod.yml" "${TARGET_DIR}/docker-compose.prod.yml"

echo "[backup] concluído em ${TARGET_DIR}"

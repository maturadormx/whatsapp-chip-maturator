#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-${ROOT_DIR}/.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-${ROOT_DIR}/docker-compose.prod.yml}"
APP_URL="${APP_URL:-http://127.0.0.1:3000}"
ENABLE_OPS_PROFILE="${ENABLE_OPS_PROFILE:-false}"

echo "[deploy] preflight"
bash "${ROOT_DIR}/scripts/release/preflight-production.sh"

echo "[deploy] backup pré-publicação"
bash "${ROOT_DIR}/scripts/backup/backup-platform-state.sh"

echo "[deploy] subindo banco e redis"
(cd "${ROOT_DIR}" && docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d mysql redis)

echo "[deploy] subindo aplicação e proxy"
(cd "${ROOT_DIR}" && docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d --build app caddy)

if [[ "${ENABLE_OPS_PROFILE}" == "true" ]]; then
  echo "[deploy] subindo monitoramento"
  (cd "${ROOT_DIR}" && docker compose --profile ops --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d prometheus alertmanager grafana)
fi

echo "[deploy] aplicando migrações"
(cd "${ROOT_DIR}" && docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" exec -T app npm run db:push)

echo "[deploy] smoke"
bash "${ROOT_DIR}/scripts/release/smoke-production.sh" "${APP_URL}"

echo "[deploy] concluído"

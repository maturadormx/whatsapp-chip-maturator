#!/usr/bin/env bash
set -euo pipefail

echo "[rollback] restarting production stack from compose baseline"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-${ROOT_DIR}/.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-${ROOT_DIR}/docker-compose.prod.yml}"

(cd "${ROOT_DIR}" && docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" down)
(cd "${ROOT_DIR}" && docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d --build)

echo "[rollback] validating"
bash "${ROOT_DIR}/scripts/release/smoke-production.sh" http://127.0.0.1:3000

echo "[rollback] ok"

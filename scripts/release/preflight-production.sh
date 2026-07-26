#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-${ROOT_DIR}/.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-${ROOT_DIR}/docker-compose.prod.yml}"

required_vars=(
  DATABASE_URL
  REDIS_URL
  JWT_SECRET
  COOKIE_SECRET
  OAUTH_SERVER_URL
  VITE_OAUTH_PORTAL_URL
  VITE_APP_ID
  APP_DOMAIN
)

echo "[preflight] verificando arquivos"
[[ -f "${ENV_FILE}" ]] || { echo "[preflight] env file ausente: ${ENV_FILE}"; exit 1; }
[[ -f "${COMPOSE_FILE}" ]] || { echo "[preflight] compose ausente: ${COMPOSE_FILE}"; exit 1; }

echo "[preflight] verificando comandos"
command -v docker >/dev/null
command -v npm >/dev/null
command -v curl >/dev/null

echo "[preflight] validando variáveis obrigatórias"
set -a
source "${ENV_FILE}"
set +a
for key in "${required_vars[@]}"; do
  [[ -n "${!key:-}" ]] || { echo "[preflight] variável obrigatória vazia: ${key}"; exit 1; }
done

echo "[preflight] validando typecheck"
(cd "${ROOT_DIR}" && npm run check)

echo "[preflight] validando build"
(cd "${ROOT_DIR}" && npm run build)

echo "[preflight] validando compose"
(cd "${ROOT_DIR}" && docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" config >/dev/null)

echo "[preflight] ok"

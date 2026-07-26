#!/usr/bin/env bash
set -euo pipefail

APP_URL="${APP_URL:-http://127.0.0.1:3000}"
METRICS_PATH="${METRICS_PATH:-/internal/metrics}"
OUTPUT_FILE="${OUTPUT_FILE:-./sprint0-evidencias.log}"
APP_LOG_PATH="${APP_LOG_PATH:-./sprint0-app.log}"

write_section() {
  local title="$1"
  local content="$2"
  {
    printf '\n=== %s ===\n' "$title"
    printf '%s\n' "$content"
  } >> "$OUTPUT_FILE"
}

printf 'Sprint 0 - coleta de evidências\n' > "$OUTPUT_FILE"

write_section "REDIS PING" "$(redis-cli ping 2>&1 || true)"
write_section "METRICS BEFORE" "$(curl -fsS "$APP_URL$METRICS_PATH" 2>&1 || true)"

if [[ -f "$APP_LOG_PATH" ]]; then
  write_section "APP LOGS" "$(cat "$APP_LOG_PATH")"
else
  write_section "APP LOGS" "Arquivo de logs da aplicação não encontrado em $APP_LOG_PATH"
fi

write_section "NPM TEST" "$(npm test 2>&1 || true)"
write_section "NPM BUILD" "$(npm run build 2>&1 || true)"

sleep 2
write_section "METRICS AFTER" "$(curl -fsS "$APP_URL$METRICS_PATH" 2>&1 || true)"

printf 'Evidências salvas em %s\n' "$OUTPUT_FILE"


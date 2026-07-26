#!/usr/bin/env bash
set -euo pipefail

APP_URL="${1:-http://127.0.0.1:3000}"

echo "=== E2.2 — MATRIZ DE FLUXOS ==="

echo "[1] Evento válido"
before_published="$(curl -fsS "${APP_URL}/internal/metrics" | awk '/^queue_jobs_published_total / {print $2}')"
before_pipeline="$(curl -fsS "${APP_URL}/internal/metrics" | awk '/^pipeline_started_total / {print $2}')"

curl -fsS -X POST "${APP_URL}/api/inbound/events" \
  -H "Content-Type: application/json" \
  --data '{"source":"e2-test","eventType":"test.event","payload":{"chip":"5511999999999","origin":"validate-fluxos"}}' >/dev/null

sleep 12

after_published="$(curl -fsS "${APP_URL}/internal/metrics" | awk '/^queue_jobs_published_total / {print $2}')"
after_pipeline="$(curl -fsS "${APP_URL}/internal/metrics" | awk '/^pipeline_started_total / {print $2}')"

test "${after_published}" != "${before_published}"
test "${after_pipeline}" != "${before_pipeline}"
echo "✅ Fluxo válido processado"

echo "[2] Worker reinicia"
docker restart whatsapp-chip-maturator-app >/dev/null
sleep 20
curl -fsS "${APP_URL}/health" >/dev/null
echo "✅ App/worker recuperado"

echo "[3] Redis reinicia"
docker restart whatsapp-chip-maturator-redis >/dev/null
sleep 15
docker exec whatsapp-chip-maturator-redis redis-cli ping | grep -q PONG
echo "✅ Redis recuperado"

echo "[4] MySQL reinicia"
docker restart whatsapp-chip-maturator-mysql >/dev/null
sleep 25
curl -fsS "${APP_URL}/health" >/dev/null
echo "✅ MySQL recuperado"

echo "=== E2.2 OK ==="

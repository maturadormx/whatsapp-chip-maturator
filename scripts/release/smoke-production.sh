#!/usr/bin/env bash
set -euo pipefail

APP_URL="${1:-http://127.0.0.1:3000}"

echo "[smoke] live"
curl -fsS "${APP_URL}/live" >/dev/null

echo "[smoke] ready"
curl -fsS "${APP_URL}/ready" >/dev/null

echo "[smoke] health"
curl -fsS "${APP_URL}/health" >/dev/null

echo "[smoke] metrics"
curl -fsS "${APP_URL}/internal/metrics" >/dev/null

echo "[smoke] inbound event"
curl -fsS -X POST "${APP_URL}/api/inbound/events" \
  -H "Content-Type: application/json" \
  --data '{"source":"smoke-production","eventType":"test.event","payload":{"run":"smoke"}}' >/dev/null

sleep 10

METRICS="$(curl -fsS "${APP_URL}/internal/metrics")"
echo "${METRICS}" | grep -q "queue_jobs_published_total"
echo "${METRICS}" | grep -q "pipeline_started_total"

echo "[smoke] ok"

#!/usr/bin/env bash
set -euo pipefail

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="${1:-backups}"
FILE_PATH="${OUT_DIR}/mysql-backup-${TIMESTAMP}.sql.gz"

mkdir -p "${OUT_DIR}"

docker exec whatsapp-chip-maturator-mysql-prod sh -lc \
  'exec mysqldump -uroot -p"${MYSQL_ROOT_PASSWORD:-root_pass_prod}" "${MYSQL_DATABASE:-whatsapp_chip_maturator}"' \
  | gzip > "${FILE_PATH}"

sha256sum "${FILE_PATH}" > "${FILE_PATH}.sha256"

echo "Backup salvo em ${FILE_PATH}"

#!/usr/bin/env bash
set -euo pipefail

BACKUP_FILE="${1:?Informe o arquivo .sql.gz de backup}"

gunzip -c "${BACKUP_FILE}" | docker exec -i whatsapp-chip-maturator-mysql-prod sh -lc \
  'exec mysql -uroot -p"${MYSQL_ROOT_PASSWORD:-root_pass_prod}" "${MYSQL_DATABASE:-whatsapp_chip_maturator}"'

echo "Restore concluído a partir de ${BACKUP_FILE}"

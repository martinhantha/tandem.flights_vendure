#!/bin/bash
# tandem.flights: local-only nightly backup (no S3). DB dump + assets/voucher PDFs into /backups (host: /root/backups/tandem-flights).
set -euo pipefail

DATE=$(date +%F_%H-%M)
RETENTION_DAYS=${RETENTION_DAYS:-14}

echo "=== [$(date)] tandem.flights backup ==="

PGPASSWORD="${DB_PASSWORD}" pg_dump -h "${DB_HOST}" -p "${DB_PORT:-5432}" -U "${DB_USERNAME}" -d "${DB_NAME}" \
  | gzip > "/backups/vendure_db_${DATE}.sql.gz"
echo "→ DB dump: /backups/vendure_db_${DATE}.sql.gz"

if [ -d /assets ]; then
  tar -czf "/backups/vendure_assets_${DATE}.tar.gz" -C /assets --exclude=./cache .
  echo "→ Assets: /backups/vendure_assets_${DATE}.tar.gz"
fi

find /backups -type f \( -name "vendure_db_*.sql.gz" -o -name "vendure_assets_*.tar.gz" \) -mtime +"${RETENTION_DAYS}" -delete
echo "✅ Backup complete ($(date))"

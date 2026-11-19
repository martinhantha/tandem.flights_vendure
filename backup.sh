#!/bin/bash
set -e

DATE=$(date +%F_%H-%M)
DB_BACKUP_FILE="/backups/vendure_db_${DATE}.sql.gz"
RETENTION_DAYS=14

echo "=== [$(date)] Starting Vendure backup ==="

# --- Database Backup ---
echo "→ Dumping PostgreSQL database..."
PGPASSWORD="${DB_PASSWORD}" pg_dump \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USERNAME}" \
  -d "${DB_NAME}" \
  | gzip > "${DB_BACKUP_FILE}"

echo "✅ Database dump created: ${DB_BACKUP_FILE}"

# --- Upload DB backup ---
echo "→ Uploading DB backup..."
aws s3 cp "${DB_BACKUP_FILE}" "s3://${AWS_BACKUP_BUCKET}/db/${DATE}/" \
  --endpoint-url="${AWS_ENDPOINT}" \
  --region "${AWS_REGION}"

# --- Sync Vendure asset bucket to backup bucket ---
echo "→ Syncing object storage..."
aws s3 sync \
  "s3://${AWS_BUCKET}/" \
  "s3://${AWS_BACKUP_BUCKET}/files/${DATE}/" \
  --endpoint-url="${AWS_ENDPOINT}" \
  --region "${AWS_REGION}" \
  --exclude "cache/*"

# --- Cleanup local backups ---
find /backups -type f -name "vendure_db_*.sql.gz" -mtime +${RETENTION_DAYS} -delete
echo "→ Cleaned up local DB backups older than ${RETENTION_DAYS} days."

# --- Cleanup old S3 backups ---
# BusyBox date doesn't support "date -d", so compute cutoff in seconds:
CUTOFF_EPOCH=$(($(date +%s) - (RETENTION_DAYS * 86400)))
# If the above ever fails, default to now to avoid deleting too much:
[ -n "$CUTOFF_EPOCH" ] || CUTOFF_EPOCH=$(date +%s)

clean_s3_prefix() {
  local PREFIX="$1" LABEL="$2"
  echo "→ Checking ${LABEL} (${PREFIX}/)"

  # List all subfolders (dates) in the backup prefix
  aws s3api list-objects-v2 \
    --bucket "${AWS_BACKUP_BUCKET}" \
    --prefix "${PREFIX}/" \
    --delimiter '/' \
    --endpoint-url "${AWS_ENDPOINT}" \
    --query "CommonPrefixes[].Prefix" \
    --output text 2>/dev/null | tr '\t' '\n' | while read -r PREFIX; do
        [[ -z "$PREFIX" ]] && continue
        # Expect: files/2025-10-24_20-24/
        FOLDER_DATE=$(echo "$PREFIX" | sed -E 's#^files/([0-9]{4}-[0-9]{2}-[0-9]{2})_.*#\1#')
        [[ "$FOLDER_DATE" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || continue
        [[ "$FOLDER_DATE" == "$TODAY" ]] && continue
        if EPOCH=$(date -d "$FOLDER_DATE" +%s 2>/dev/null); then
        if [[ $EPOCH -lt $CUTOFF_EPOCH ]]; then
            echo "  → Delete $PREFIX"
            aws s3 rm "s3://${AWS_BACKUP_BUCKET}/${PREFIX}" \
            --endpoint-url "${AWS_ENDPOINT}" --region "${AWS_REGION}" \
            --recursive >/dev/null || echo "    Delete warn"
        fi
        fi
    done
}


clean_s3_prefix "db" "DB backups"
clean_s3_prefix "files" "File backups"

echo "✅ Backup complete! Finished at $(date)"
echo "========================================="

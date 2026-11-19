#!/bin/bash
set -euo pipefail

usage() {
	cat <<'USAGE'
Usage: backup_to_live_db.sh [backup-folder]

Examples:
  ./backup_to_live_db.sh 2025-12-04_08-00

If no folder is passed the script lists the most recent remote backups and
prompts for one.
USAGE
}

[ -f .env ] && set -a && . .env && set +a

AWS_BACKUP_BUCKET="${AWS_BACKUP_BUCKET:-${DO_SPACE_BACKUP_BUCKET:-}}"
AWS_ENDPOINT="${AWS_ENDPOINT:-${DO_SPACE_ENDPOINT:-}}"
AWS_REGION="${AWS_REGION:-${DO_SPACE_REGION:-}}"
AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-$DO_SPACE_ACCESS_KEY}"
AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-$DO_SPACE_SECRET_KEY}"

export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY

DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_USER=${DB_USER:-postgres}
DB_PASSWORD=${DB_PASSWORD:-}
LIVE_DB_NAME=${LIVE_DB_NAME:-${DB_NAME:-vendure}}

if [[ -z "$AWS_BACKUP_BUCKET" || -z "$AWS_ENDPOINT" || -z "$AWS_REGION" ]]; then
	echo "Missing AWS/Spaces configuration" >&2
	exit 1
fi

if [[ -z "$DB_PASSWORD" ]]; then
	echo "DB_PASSWORD must be set" >&2
	exit 1
fi

BACKUP_FOLDER=${1:-}

if [[ -z "$BACKUP_FOLDER" ]]; then
	echo "Available backups:"
	aws s3 ls "s3://${AWS_BACKUP_BUCKET}/db/" \
		--endpoint-url "$AWS_ENDPOINT" --region "$AWS_REGION" | tail -n 20
	read -rp "Enter backup folder (e.g. 2025-12-04_08-00): " BACKUP_FOLDER
fi

if [[ -z "$BACKUP_FOLDER" ]]; then
	usage
	exit 1
fi

BACKUP_KEY="db/${BACKUP_FOLDER}/vendure_db_${BACKUP_FOLDER}.sql.gz"
TMP_DIR=$(mktemp -d)
BACKUP_ARCHIVE="${TMP_DIR}/dump.sql.gz"
BACKUP_SQL="${TMP_DIR}/dump.sql"

echo "→ Downloading backup ${BACKUP_KEY}"
aws s3 cp "s3://${AWS_BACKUP_BUCKET}/${BACKUP_KEY}" "$BACKUP_ARCHIVE" \
	--endpoint-url "$AWS_ENDPOINT" --region "$AWS_REGION"

if [[ ! -s "$BACKUP_ARCHIVE" ]]; then
	echo "Backup archive missing or empty" >&2
	rm -rf "$TMP_DIR"
	exit 1
fi

gunzip -c "$BACKUP_ARCHIVE" > "$BACKUP_SQL"

if [[ ! -s "$BACKUP_SQL" ]]; then
	echo "Backup SQL missing" >&2
	rm -rf "$TMP_DIR"
	exit 1
fi

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OLD_DB="${LIVE_DB_NAME}_before_${TIMESTAMP}"

export PGPASSWORD="$DB_PASSWORD"
export PSQLRC=/dev/null
PSQL_BASE=(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -v ON_ERROR_STOP=1 -w --no-psqlrc)
PSQL_ADMIN=("${PSQL_BASE[@]}" -d postgres)
PG_DUMP_BASE=(pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -w --no-owner --no-privileges)

terminate_connections() {
	local db="$1"
	"${PSQL_ADMIN[@]}" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${db}' AND pid <> pg_backend_pid();" >/dev/null
}

echo "→ Creating snapshot database ${OLD_DB}"
terminate_connections "$OLD_DB"
"${PSQL_ADMIN[@]}" -c "DROP DATABASE IF EXISTS \"${OLD_DB}\";"
"${PSQL_ADMIN[@]}" -c "CREATE DATABASE \"${OLD_DB}\" WITH ENCODING 'UTF8' TEMPLATE template0;"

echo "→ Copying current ${LIVE_DB_NAME} into ${OLD_DB}"
"${PG_DUMP_BASE[@]}" "$LIVE_DB_NAME" | sed '/SET transaction_timeout =/d' | "${PSQL_BASE[@]}" -d "$OLD_DB" >/dev/null

echo "→ Dropping live database ${LIVE_DB_NAME}"
terminate_connections "$LIVE_DB_NAME"
"${PSQL_ADMIN[@]}" -c "DROP DATABASE IF EXISTS \"${LIVE_DB_NAME}\";"

echo "→ Recreating live database ${LIVE_DB_NAME}"
"${PSQL_ADMIN[@]}" -c "CREATE DATABASE \"${LIVE_DB_NAME}\" WITH ENCODING 'UTF8' TEMPLATE template0;"

echo "→ Importing backup into ${LIVE_DB_NAME}"
sed '/SET transaction_timeout =/d' "$BACKUP_SQL" | "${PSQL_BASE[@]}" -d "$LIVE_DB_NAME"

echo "✅ Restore complete. Previous data preserved in database ${OLD_DB}."

rm -rf "$TMP_DIR"


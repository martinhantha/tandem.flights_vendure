FROM postgres:18-alpine

RUN apk add --no-cache bash aws-cli curl gzip

# Copy backup script
COPY backup.sh /usr/local/bin/backup.sh
COPY backup_to_live_db.sh /usr/local/bin/backup_to_live_db.sh
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/backup_to_live_db.sh

# Create cron log file
RUN touch /var/log/cron.log

# Default command is set by docker-compose (with crontab)
CMD ["crond", "-f"]

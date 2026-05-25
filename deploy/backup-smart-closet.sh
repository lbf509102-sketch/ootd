#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/smart-closet}"
BACKUP_DIR="${BACKUP_DIR:-/opt/backups/smart-closet}"
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"

if [ -f "$APP_DIR/server/data/app.db" ]; then
  cp "$APP_DIR/server/data/app.db" "$BACKUP_DIR/app-$STAMP.db"
fi

if [ -d "$APP_DIR/server/uploads" ]; then
  tar -czf "$BACKUP_DIR/uploads-$STAMP.tar.gz" -C "$APP_DIR/server" uploads
fi

find "$BACKUP_DIR" -type f -mtime +7 -delete

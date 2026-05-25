#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${1:-}"

echo "== Local health =="
curl -fsS http://127.0.0.1:3001/api/health
echo

echo "== PM2 status =="
pm2 status

echo "== Nginx status =="
sudo systemctl --no-pager --full status nginx | sed -n '1,15p'

if [ -n "${DOMAIN}" ]; then
  echo "== Remote health (${DOMAIN}) =="
  curl -fsS "https://${DOMAIN}/api/health"
  echo
fi

echo "Checks finished."

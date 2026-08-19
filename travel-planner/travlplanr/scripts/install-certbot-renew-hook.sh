#!/usr/bin/env bash
# Print a user crontab line to renew the dev Let's Encrypt cert (no sudo).
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LE_CONFIG="${PROJECT_DIR}/infra/letsencrypt/config"
LE_WORK="${PROJECT_DIR}/infra/letsencrypt/work"
LE_LOGS="${PROJECT_DIR}/infra/letsencrypt/logs"

CRON_LINE="0 3 * * * cd ${PROJECT_DIR} && certbot renew --config-dir ${LE_CONFIG} --work-dir ${LE_WORK} --logs-dir ${LE_LOGS} --quiet && docker compose restart edge"

echo "Add this line to your user crontab (crontab -e):"
echo ""
echo "${CRON_LINE}"
echo ""
echo "Dry-run now:"
echo "  certbot renew --dry-run --config-dir ${LE_CONFIG} --work-dir ${LE_WORK} --logs-dir ${LE_LOGS}"

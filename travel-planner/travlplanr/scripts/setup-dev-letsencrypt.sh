#!/usr/bin/env bash
# Issue / renew a Let's Encrypt cert for dev.travlplanr.com and reload the edge proxy.
#
# No sudo required — certs are stored under infra/letsencrypt/ in this repo.
#
# Prerequisites:
#   - DNS A record: dev.travlplanr.com → your server's public IP
#   - NAT: public :80 → this host (edge container serves ACME challenges)
#
# Usage:
#   bash scripts/setup-dev-letsencrypt.sh          # HTTP-01 (needs port 80 open)
#   bash scripts/setup-dev-letsencrypt.sh --dns    # DNS-01 if port 80 is blocked
set -euo pipefail

DOMAIN="dev.travlplanr.com"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEBROOT="${PROJECT_DIR}/infra/certbot-webroot"
LE_DIR="${PROJECT_DIR}/infra/letsencrypt"
LE_CONFIG="${LE_DIR}/config"
LE_WORK="${LE_DIR}/work"
LE_LOGS="${LE_DIR}/logs"
EMAIL="${CERTBOT_EMAIL:-admin@travlplanr.com}"

CERTBOT_COMMON=(
  --config-dir "${LE_CONFIG}"
  --work-dir "${LE_WORK}"
  --logs-dir "${LE_LOGS}"
)

cd "${PROJECT_DIR}"
mkdir -p "${WEBROOT}/.well-known/acme-challenge" "${LE_CONFIG}" "${LE_WORK}" "${LE_LOGS}"

if ! command -v certbot >/dev/null 2>&1; then
  echo "certbot not found. Install: sudo apt install certbot"
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker not available for ${USER}. Run: newgrp docker"
  exit 1
fi

echo "==> Ensuring edge proxy is up (port 80 for ACME)..."
docker compose up -d edge
docker compose exec edge nginx -s reload 2>/dev/null || docker compose restart edge

if [[ "${1:-}" == "--dns" ]]; then
  echo ""
  echo "DNS validation — add the TXT record certbot prints in Route 53, then press Enter."
  echo "Record name: _acme-challenge.dev.travlplanr.com"
  echo ""
  certbot certonly --manual --preferred-challenges dns \
    "${CERTBOT_COMMON[@]}" \
    -d "${DOMAIN}" \
    --agree-tos -m "${EMAIL}" \
    --no-eff-email
else
  echo "==> Requesting certificate (HTTP-01 via webroot, no sudo)..."
  if ! certbot certonly --webroot \
    "${CERTBOT_COMMON[@]}" \
    -w "${WEBROOT}" \
    -d "${DOMAIN}" \
    --agree-tos -m "${EMAIL}" \
    --no-eff-email \
    --non-interactive \
    --keep-until-expiring; then
    echo ""
    echo "Certificate request failed. Common causes:"
    echo "  - Public port 80 not forwarded to this host (NAT/firewall)"
    echo "  - DNS for ${DOMAIN} does not point at this server's public IP"
    echo ""
    echo "Retry with DNS validation (no inbound port needed):"
    echo "  bash scripts/setup-dev-letsencrypt.sh --dns"
    exit 1
  fi
fi

if [[ ! -f "${LE_CONFIG}/live/${DOMAIN}/fullchain.pem" ]]; then
  echo "Expected cert not found at ${LE_CONFIG}/live/${DOMAIN}/"
  exit 1
fi

echo "==> Switching edge nginx to Let's Encrypt config..."
if grep -q '^EDGE_NGINX_CONF=' "${PROJECT_DIR}/.env" 2>/dev/null; then
  sed -i 's|^EDGE_NGINX_CONF=.*|EDGE_NGINX_CONF=./infra/edge/nginx.conf|' "${PROJECT_DIR}/.env"
else
  echo 'EDGE_NGINX_CONF=./infra/edge/nginx.conf' >> "${PROJECT_DIR}/.env"
fi
docker compose up -d edge

echo ""
echo "Done. Open: https://${DOMAIN}/"
echo ""
echo "Renew (add to crontab — no sudo):"
echo "  0 3 * * * cd ${PROJECT_DIR} && certbot renew --config-dir ${LE_CONFIG} --work-dir ${LE_WORK} --logs-dir ${LE_LOGS} && docker compose restart edge"

#!/usr/bin/env bash
# Generate a self-signed TLS cert for the local dev edge proxy (:443).
# Re-run after the server's LAN IP changes.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TLS_DIR="${ROOT}/infra/tls/dev"
IP="$(hostname -I | awk '{print $1}')"

mkdir -p "${TLS_DIR}"

openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
  -keyout "${TLS_DIR}/privkey.pem" \
  -out "${TLS_DIR}/fullchain.pem" \
  -subj "/CN=travlplanr-dev" \
  -addext "subjectAltName=IP:${IP},IP:127.0.0.1,DNS:localhost"

chmod 600 "${TLS_DIR}/privkey.pem"
echo "Wrote dev TLS cert for IP ${IP} → ${TLS_DIR}/"

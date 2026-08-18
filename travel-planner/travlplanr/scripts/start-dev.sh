#!/usr/bin/env bash
# Start Travlplanr local dev: Docker backend + customer frontend + admin panel.
# User-facing ports only: 8080 (API), 4200 (web), 4320 (admin), 9000 (uploads).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB="${ROOT}/apps/web"

cd "${ROOT}"
cp -f .env.server .env

if ! docker info >/dev/null 2>&1; then
  echo "Docker not available. Run: newgrp docker   (or log out/in after usermod -aG docker)"
  exit 1
fi

echo "==> Starting backend (Docker)..."
docker compose up -d

echo "==> Seeding admin user (dev)..."
curl -sf "http://127.0.0.1:8080/api/v1/auth/seed?secret=dev-seed-secret&reset=true" >/dev/null || true

echo "==> Starting customer frontend on :4200..."
(cd "${WEB}" && npm run start) &
WEB_PID=$!

echo "==> Starting admin panel on :4320..."
(cd "${WEB}" && npm run start:admin) &
ADMIN_PID=$!

trap 'kill ${WEB_PID} ${ADMIN_PID} 2>/dev/null || true' EXIT

echo ""
# localhost, not the LAN IP: mic/camera (getUserMedia, SpeechRecognition) only
# work in a secure context, and a plain-http LAN address doesn't qualify —
# Chrome silently hard-blocks those permissions with no way to override them.
echo "Customer app:  http://localhost:4200"
echo "Admin panel:   http://localhost:4320/login"
echo "API gateway:   http://localhost:8080"
echo "Admin login:   admin@travlplanr.com / password"
echo ""
echo "Press Ctrl+C to stop frontends (Docker keeps running)."

wait

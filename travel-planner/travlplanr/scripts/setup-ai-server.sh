#!/usr/bin/env bash
# One-time Travlplanr stack setup on ai-server. Run on the server:
#   bash ~/projects/travel-planner/travlplanr/scripts/setup-ai-server.sh
set -euo pipefail

PROJECT_DIR="${HOME}/projects/travel-planner/travlplanr"
cd "${PROJECT_DIR}"

echo "==> Checking Ollama on host..."
if ! curl -sf http://127.0.0.1:11434/api/tags >/dev/null; then
  echo "Ollama is not running on localhost:11434. Start it first, then re-run."
  exit 1
fi
echo "Ollama OK"

echo "==> Checking Ollama is reachable from Docker (planner uses host.docker.internal)..."
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  if ! docker run --rm --add-host=host.docker.internal:host-gateway curlimages/curl:8.5.0 \
      -sf --max-time 3 "http://host.docker.internal:11434/api/tags" >/dev/null 2>&1; then
    echo ""
    echo "WARNING: Ollama responds on localhost but NOT from Docker."
    echo "  Planner/ai-worker will get 'connection refused' until Ollama listens beyond 127.0.0.1."
    echo "  Fix (run once with sudo):"
    echo "    sudo bash ${PROJECT_DIR}/scripts/configure-ollama-gpu.sh"
    echo ""
  else
    echo "Ollama reachable from Docker"
  fi
fi

echo "==> Ensuring qwen3.6-128k model (128k context)..."
ollama create qwen3.6-128k -f "${PROJECT_DIR}/infra/ollama/Modelfile.qwen3.6-128k" 2>/dev/null \
  || ollama create qwen3.6-128k -f "${PROJECT_DIR}/infra/ollama/Modelfile.qwen3.6-128k"

echo "==> Applying server .env..."
cp -f .env.server .env

if ! command -v docker >/dev/null 2>&1; then
  echo "==> Installing Docker (needs sudo password)..."
  sudo apt-get update
  sudo apt-get install -y docker.io docker-compose-v2
  sudo usermod -aG docker "${USER}"
  echo ""
  echo "Docker installed. Log out and back in (or run: newgrp docker), then:"
  echo "  cd ${PROJECT_DIR} && docker compose up -d --build"
  exit 0
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker is installed but not usable for ${USER}."
  echo "Run: sudo usermod -aG docker ${USER}"
  echo "Then log out/in and re-run this script."
  exit 1
fi

echo "==> Generating dev TLS cert (for :443 edge)..."
bash "${PROJECT_DIR}/scripts/generate-dev-tls.sh"

echo "==> Starting Travlplanr stack..."
docker compose up -d --build

echo ""
echo "==> Stack status"
docker compose ps

echo ""
echo "Gateway:  http://$(hostname -I | awk '{print $1}'):8080"
echo "Frontend: cd ${PROJECT_DIR}/apps/web && npm install && npm run start:edge"
echo "Then open: https://$(hostname -I | awk '{print $1}')/"

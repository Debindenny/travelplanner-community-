#!/usr/bin/env bash
# Apply GPU-safe Ollama limits on ai-server. Run once with sudo:
#   sudo bash scripts/configure-ollama-gpu.sh
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DROPIN_DIR="/etc/systemd/system/ollama.service.d"
DROPIN_FILE="${DROPIN_DIR}/gpu-limits.conf"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run with sudo: sudo bash ${BASH_SOURCE[0]}"
  exit 1
fi

mkdir -p "${DROPIN_DIR}"
cat > "${DROPIN_FILE}" <<'EOF'
[Service]
# One GPU job at a time — avoids concurrent VRAM spikes.
Environment="OLLAMA_NUM_PARALLEL=1"
Environment="OLLAMA_MAX_LOADED_MODELS=1"
# Unload model after idle to free VRAM.
Environment="OLLAMA_KEEP_ALIVE=2m"
Environment="OLLAMA_FLASH_ATTENTION=1"
# Listen on all interfaces so Docker containers can reach host Ollama via
# host.docker.internal (default binds to 127.0.0.1 only → connection refused).
Environment="OLLAMA_HOST=0.0.0.0:11434"
EOF

systemctl daemon-reload
systemctl restart ollama
sleep 2

echo "==> Ollama GPU limits applied"
systemctl show ollama --property=Environment

echo ""
echo "==> Ensuring qwen3.6-128k model..."
if command -v ollama >/dev/null 2>&1; then
  sudo -u ollama ollama create qwen3.6-128k -f "${PROJECT_DIR}/infra/ollama/Modelfile.qwen3.6-128k" 2>/dev/null \
    || ollama create qwen3.6-128k -f "${PROJECT_DIR}/infra/ollama/Modelfile.qwen3.6-128k"
  sudo -u ollama ollama create travlplanr -f "${PROJECT_DIR}/infra/ollama/Modelfile.travlplanr" 2>/dev/null \
    || ollama create travlplanr -f "${PROJECT_DIR}/infra/ollama/Modelfile.travlplanr"
fi

echo ""
nvidia-smi --query-gpu=name,temperature.gpu,memory.used,memory.total --format=csv 2>/dev/null || true
curl -sf http://127.0.0.1:11434/api/tags >/dev/null && echo "Ollama: OK" || echo "Ollama: not responding"

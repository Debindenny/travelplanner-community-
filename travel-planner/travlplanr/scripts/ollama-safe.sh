#!/usr/bin/env bash
# GPU-safe Ollama helpers — no sudo required.
set -euo pipefail

OLLAMA_URL="${OLLAMA_URL:-http://127.0.0.1:11434}"
MODEL="${OLLAMA_MODEL:-travlplanr}"

unload_all() {
  echo "==> Unloading all models from VRAM/RAM..."
  curl -sf "${OLLAMA_URL}/api/ps" | python3 -c "
import json, sys, urllib.request
for m in json.load(sys.stdin).get('models', []):
    name = m['name']
    req = urllib.request.Request(
        '${OLLAMA_URL}/api/generate',
        data=json.dumps({'model': name, 'keep_alive': 0}).encode(),
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    urllib.request.urlopen(req, timeout=30)
    print(f'  unloaded {name}')
" 2>/dev/null || echo "  (no models loaded)"
}

status() {
  echo "==> GPU"
  nvidia-smi --query-gpu=name,temperature.gpu,memory.used,memory.total,utilization.gpu \
    --format=csv 2>/dev/null || echo "  GPU not responding — ask admin for: sudo nvidia-smi --gpu-reset -i 0"
  echo ""
  echo "==> Ollama loaded models"
  curl -sf "${OLLAMA_URL}/api/ps" | python3 -m json.tool 2>/dev/null \
    || echo "  Ollama not responding"
}

smoke_test() {
  echo "==> Smoke test: ${MODEL}"
  curl -sf -X POST "${OLLAMA_URL}/api/generate" \
    -d "{\"model\":\"${MODEL}\",\"prompt\":\"Say OK\",\"stream\":false,\"think\":false,\"keep_alive\":\"2m\",\"options\":{\"num_predict\":20}}" \
    | python3 -c "import json,sys; r=json.load(sys.stdin); print('  response:', r.get('response','').strip() or '(empty)')"
  echo ""
  nvidia-smi --query-gpu=temperature.gpu,memory.used --format=csv 2>/dev/null || true
}

case "${1:-status}" in
  unload) unload_all ;;
  test)   smoke_test ;;
  status|*) status ;;
esac

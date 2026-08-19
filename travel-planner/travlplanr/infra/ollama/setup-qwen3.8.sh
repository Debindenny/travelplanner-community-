#!/usr/bin/env bash
# After upgrading Ollama (>= 0.32.7), pull Qwen3.8 and build max-context aliases.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "==> Pulling qwen3.8"
ollama pull qwen3.8

echo "==> Creating qwen3.8-max (num_ctx 131072)"
ollama create qwen3.8-max -f "$ROOT/Modelfile.qwen3.8-max"

echo "==> Creating travlplanr (travel system prompt on qwen3.8, max ctx)"
ollama create travlplanr -f "$ROOT/Modelfile.travlplanr"

echo "==> Warming qwen3.8-max into VRAM"
curl -s http://127.0.0.1:11434/api/generate -d '{"model":"qwen3.8-max","prompt":"hi","keep_alive":"30m","stream":false,"options":{"num_predict":1}}' >/dev/null || true

echo "==> Done"
ollama list | rg 'qwen3\.8|travlplanr' || ollama list
ollama ps

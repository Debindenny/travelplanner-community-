#!/usr/bin/env bash
set -euo pipefail

REMOTE_HOST="${REMOTE_HOST:-}"
if [ -z "$REMOTE_HOST" ]; then
  # Try to ping ai-server first, fallback to the network IP if unreachable
  if ping -c 1 -W 1 ai-server >/dev/null 2>&1; then
    REMOTE_HOST="ai-server"
  else
    REMOTE_HOST="debin@10.10.0.168"
  fi
fi
REMOTE_DIR="${REMOTE_DIR:-~/projects/travel-planner}"
LOCAL_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Syncing ${LOCAL_DIR} -> ${REMOTE_HOST}:${REMOTE_DIR}"

ssh "${REMOTE_HOST}" "mkdir -p ${REMOTE_DIR}"

rsync -avz --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '__pycache__' \
  --exclude '.venv' \
  --exclude 'venv' \
  --exclude '.next' \
  --exclude 'dist' \
  --exclude 'build' \
  --exclude '.DS_Store' \
  --exclude 'ollama_data' \
  "${LOCAL_DIR}/" "${REMOTE_HOST}:${REMOTE_DIR}/"

echo "Done. Open in Cursor: Remote SSH -> ai-server -> ${REMOTE_DIR}"

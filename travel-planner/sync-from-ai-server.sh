#!/usr/bin/env bash
set -euo pipefail

# Pull travel-planner from ai-server onto this Mac.
# Server is the source of truth. Run this script on the Mac (not on the server).

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
LOCAL_DIR="${LOCAL_DIR:-$HOME/Desktop/travel-planner}"

echo "Syncing ${REMOTE_HOST}:${REMOTE_DIR} -> ${LOCAL_DIR}"

mkdir -p "${LOCAL_DIR}"

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
  "${REMOTE_HOST}:${REMOTE_DIR}/" "${LOCAL_DIR}/"

echo "Done. Desktop folder is now a mirror of the server: ${LOCAL_DIR}"

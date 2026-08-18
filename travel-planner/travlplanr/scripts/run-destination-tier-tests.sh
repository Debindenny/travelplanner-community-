#!/usr/bin/env bash
# Run all destination-tier unit + integration tests.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== Backend pytest (planner) ==="
if docker ps --format '{{.Names}}' | grep -q '^travlplanr-planner-1$'; then
  docker cp services/planner/tests/. travlplanr-planner-1:/app/tests/
  docker cp services/planner/app/services/chat_intent.py travlplanr-planner-1:/app/app/services/chat_intent.py
  docker cp services/planner/app/services/destination_resolver.py travlplanr-planner-1:/app/app/services/destination_resolver.py
  docker exec travlplanr-planner-1 pip install -q pytest 2>/dev/null || true
  docker exec travlplanr-planner-1 python -m pytest \
    /app/tests/test_destination_resolver.py \
    /app/tests/test_destination_tiers.py \
    /app/tests/test_chat_intent.py \
    /app/tests/test_input_validation.py \
    --noconftest -q
else
  echo "Planner container not running — start with: docker compose up -d planner"
  exit 1
fi

echo ""
echo "=== Frontend feature tests ==="
(cd apps/web && npm run test:features)

echo ""
echo "=== API integration (destination tiers) ==="
(cd apps/web && bash scripts/test-destination-tiers-integration.sh)

echo ""
echo "All destination-tier tests passed."

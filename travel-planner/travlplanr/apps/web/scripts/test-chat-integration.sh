#!/usr/bin/env bash
# Integration smoke tests for chat + packages API (requires docker compose up).
set -euo pipefail

BASE="${BASE_URL:-http://localhost:8080}"
PASS=0
FAIL=0

check() {
  local name="$1"
  local code="$2"
  local expect="$3"
  if [[ "$code" == "$expect" ]]; then
    echo "  ✓ $name (HTTP $code)"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $name — expected HTTP $expect, got $code"
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "Integration tests against $BASE"
echo ""

# Health
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/health")
check "GET /health" "$code" "200"

# Packages by region
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/v1/packages?region=Dubai")
check "GET /packages?region=Dubai" "$code" "200"

dubai_count=$(curl -s "$BASE/api/v1/packages?region=Dubai" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
if [[ "$dubai_count" -gt 0 ]]; then
  echo "  ✓ Dubai packages returned ($dubai_count items)"
  PASS=$((PASS + 1))
else
  echo "  ✗ Dubai packages empty"
  FAIL=$((FAIL + 1))
fi

code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/v1/packages?region=Europe")
check "GET /packages?region=Europe" "$code" "200"

# Chat requires auth
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/v1/chat" \
  -H "Content-Type: application/json" -d '{"message":"show dubai packages"}')
check "POST /chat without token → 401" "$code" "401"

# OTP login + chat
OTP_RESP=$(curl -s -X POST "$BASE/api/v1/auth/otp/request" \
  -H "Content-Type: application/json" -d '{"email":"testuser@example.com"}')
OTP=$(echo "$OTP_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('dev_otp',''))")
TOKEN=$(curl -s -X POST "$BASE/api/v1/auth/otp/verify" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"testuser@example.com\",\"code\":\"$OTP\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))")

if [[ -z "$TOKEN" ]]; then
  echo "  ✗ OTP login failed — cannot test authenticated chat"
  FAIL=$((FAIL + 1))
else
  echo "  ✓ OTP login succeeded"
  PASS=$((PASS + 1))

  CHAT=$(curl -s -X POST "$BASE/api/v1/chat" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"message":"show me dubai packages","context":{"path":"/","region":null}}')

  dest=$(echo "$CHAT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('destination',''))")
  intent=$(echo "$CHAT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('intent',''))")
  has_nav=$(echo "$CHAT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(any(a.get('type')=='navigate_packages' for a in d.get('actions',[])))")

  if [[ "$dest" == "Dubai" ]]; then
    echo "  ✓ Chat destination=Dubai"
    PASS=$((PASS + 1))
  else
    echo "  ✗ Chat destination expected Dubai, got '$dest'"
    FAIL=$((FAIL + 1))
  fi

  if [[ "$intent" == "browse_packages" ]]; then
    echo "  ✓ Chat intent=browse_packages"
    PASS=$((PASS + 1))
  else
    echo "  ✗ Chat intent expected browse_packages, got '$intent'"
    FAIL=$((FAIL + 1))
  fi

  if [[ "$has_nav" == "True" ]]; then
    echo "  ✓ Chat navigate_packages action present"
    PASS=$((PASS + 1))
  else
    echo "  ✗ Chat missing navigate_packages action"
    FAIL=$((FAIL + 1))
  fi
fi

# Proxy test (optional — skip if dev server not running)
PROXY="${PROXY_URL:-http://localhost:4201}"
if curl -s -o /dev/null -w "%{http_code}" "$PROXY/" 2>/dev/null | grep -q 200; then
  code=$(curl -s -o /dev/null -w "%{http_code}" "$PROXY/api/v1/packages?region=Dubai")
  check "Dev proxy GET /packages?region=Dubai" "$code" "200"
else
  echo "  ⊘ Skipping dev proxy tests (no server on $PROXY)"
fi

echo ""
echo "$PASS passed, $FAIL failed"
echo ""

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi

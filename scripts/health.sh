#!/usr/bin/env bash
#
# Health checks for the backend, frontend and OCR inference service.
#
set -euo pipefail

backend="${APP_HOST:-127.0.0.1}:${APP_PORT:-8000}"
frontend="127.0.0.1:4200"
ocr="127.0.0.1:18499"

check() {
  local name="$1" url="$2"
  if curl -sS --max-time 5 -o /dev/null "$url"; then
    printf '  ✅ %-28s %s\n' "$name" "$url"
  else
    printf '  ❌ %-28s %s\n' "$name" "$url"
  fi
}

echo "Backend:";  check "API health" "http://$backend/api/health"
echo "Frontend:"; check "UI"          "http://$frontend/"
echo "OCR:";      check "llama.cpp"   "http://$ocr/health"

echo ""
echo "Backend details:"
curl -sS --max-time 5 "http://$backend/api/health" || true
echo ""

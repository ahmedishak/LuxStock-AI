#!/usr/bin/env bash
set -euo pipefail

fe="$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 http://127.0.0.1:3004/ || echo down)"
api="$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 http://127.0.0.1:8000/docs || echo down)"
health="$(curl -s --max-time 2 http://127.0.0.1:8000/api/health || echo '{}')"

echo "frontend :3004 -> $fe"
echo "backend  :8000 -> $api"
echo "health   -> $health"

if [[ "$fe" != "200" || "$api" != "200" ]]; then
  echo "Not healthy. Run: make up"
  exit 1
fi

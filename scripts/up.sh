#!/usr/bin/env bash
# Bring whole stack up: docker → backend → frontend → sanity test.
# Skips any layer already healthy, so re-run is cheap.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FAIL=0

up() { curl -sf -m3 -o /dev/null "$1"; }

echo "== 1/4 infra (docker compose) =="
docker compose -f "$ROOT/infrastructure/docker-compose.yml" up -d
bash "$ROOT/scripts/infra.sh" || FAIL=1

echo "== 2/4 backend (3 jars) =="
if up http://localhost:8080/api/public/health && \
   up http://localhost:8082/api/public/health && \
   up http://localhost:8083/api/public/health; then
  echo "SKIP backend already healthy"
else
  bash "$ROOT/scripts/restart.sh" || FAIL=1
fi

echo "== 3/4 frontend (vite :5173) =="
if up http://localhost:5173; then
  echo "SKIP frontend already up"
else
  [ -d "$ROOT/frontend/employee-portal/node_modules" ] || ( cd "$ROOT/frontend/employee-portal" && npm install )
  ( cd "$ROOT/frontend/employee-portal" && setsid nohup npm run dev > /tmp/employee-portal.log 2>&1 < /dev/null & disown )
  for i in $(seq 1 20); do up http://localhost:5173 && break; sleep 2; done
  if up http://localhost:5173; then echo "PASS frontend (after $((i*2))s)"; else echo "FAIL frontend log=/tmp/employee-portal.log"; FAIL=1; fi
fi

echo "== 4/4 sanity (smoke) =="
bash "$ROOT/scripts/smoke.sh" || FAIL=1

echo "RESULT FAIL=$FAIL"
exit "$FAIL"

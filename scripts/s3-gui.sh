#!/usr/bin/env bash
# S3 GUI: localstack-explorer (4200) + display-only decrypt proxy (4567).
# Explorer endpoint = http://localhost:4567 so object previews show plaintext;
# S3 stored bytes stay encrypted (see scripts/s3-decrypt-proxy.js).
# Re-run safe: skips layers already up.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FAIL=0
PORT_PROXY=4567
PORT_GUI=4200

listening() { [ "$(curl -s -m3 -o /dev/null -w '%{http_code}' "http://localhost:$1" 2>/dev/null)" != "000" ]; }

echo "== 1/2 decrypt proxy (:$PORT_PROXY) =="
if listening $PORT_PROXY; then
  echo "SKIP proxy already up"
else
  ( cd "$ROOT" && setsid nohup node scripts/s3-decrypt-proxy.js > /tmp/s3-gui-proxy.log 2>&1 < /dev/null & disown )
  for i in $(seq 1 10); do listening $PORT_PROXY && break; sleep 1; done
  if listening $PORT_PROXY; then echo "PASS proxy (after ${i}s)"; else echo "FAIL proxy log=/tmp/s3-gui-proxy.log"; FAIL=1; fi
fi

echo "== 2/2 localstack-explorer (:$PORT_GUI) =="
if listening $PORT_GUI; then
  echo "SKIP explorer already up"
else
  ( cd "$ROOT" && setsid nohup npx --yes localstack-explorer@latest --port=$PORT_GUI > /tmp/s3-gui-explorer.log 2>&1 < /dev/null & disown )
  for i in $(seq 1 30); do listening $PORT_GUI && break; sleep 2; done
  if listening $PORT_GUI; then echo "PASS explorer (after $((i*2))s)"; else echo "FAIL explorer log=/tmp/s3-gui-explorer.log"; FAIL=1; fi
fi

if [ "$FAIL" -eq 0 ]; then
  cat <<'EOF'

S3 GUI ready:
  open        http://localhost:4200
  endpoint    http://localhost:4567   <- set this in the explorer Setup Wizard
  region      us-east-1   credentials test/test   bucket employees
  (direct 4566 endpoint still works but preview shows ciphertext)
EOF
fi

echo "RESULT FAIL=$FAIL"
exit "$FAIL"

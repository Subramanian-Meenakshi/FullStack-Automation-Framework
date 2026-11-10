#!/usr/bin/env bash
# Rebuild backend, restart all services detached, wait for health.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# WSL restart rewrites /etc/localtime to legacy Asia/Calcutta; postgres tzdata
# (2026e) dropped that name -> PG rejects the JDBC TimeZone param with
# "FATAL: invalid value for parameter TimeZone". Force JVM to canonical
# Asia/Kolkata (same +05:30 offset) so services survive any host TZ name.
export JAVA_TOOL_OPTIONS="${JAVA_TOOL_OPTIONS:-} -Duser.timezone=Asia/Kolkata"

echo "BUILD"
( cd "$ROOT/backend" && mvn -q -DskipTests install ) || { echo "FAIL build"; exit 1; }
echo "PASS build"

ps aux | grep -E '(auth-service|employee-service|employee-consumer)-0.0.1' | grep -v grep | awk '{print $2}' | xargs -r kill 2>/dev/null
sleep 3

setsid nohup java -jar "$ROOT/backend/auth-service/target/auth-service-0.0.1-SNAPSHOT.jar" > /tmp/auth-service.log 2>&1 < /dev/null &
disown
setsid nohup java -jar "$ROOT/backend/employee-service/target/employee-service-0.0.1-SNAPSHOT.jar" > /tmp/employee-service.log 2>&1 < /dev/null &
disown
setsid nohup java -jar "$ROOT/backend/employee-consumer/target/employee-consumer-0.0.1-SNAPSHOT.jar" > /tmp/employee-consumer.log 2>&1 < /dev/null &
disown
echo "STARTED"

FAIL=0
for i in $(seq 1 40); do
  A=$(curl -s -m3 -o /dev/null -w '%{http_code}' http://localhost:8080/api/public/health || true)
  E=$(curl -s -m3 -o /dev/null -w '%{http_code}' http://localhost:8082/api/public/health || true)
  C=$(curl -s -m3 -o /dev/null -w '%{http_code}' http://localhost:8083/api/public/health || true)
  if [ "$A" = 200 ] && [ "$E" = 200 ] && [ "$C" = 200 ]; then break; fi
  sleep 2
done

if [ "$A" = 200 ]; then echo "PASS health.auth (after $((i*2))s)"; else echo "FAIL health.auth got=[$A] log=/tmp/auth-service.log"; FAIL=1; fi
if [ "$E" = 200 ]; then echo "PASS health.employee (after $((i*2))s)"; else echo "FAIL health.employee got=[$E] log=/tmp/employee-service.log"; FAIL=1; fi
if [ "$C" = 200 ]; then echo "PASS health.consumer (after $((i*2))s)"; else echo "FAIL health.consumer got=[$C] log=/tmp/employee-consumer.log"; FAIL=1; fi
echo "RESULT FAIL=$FAIL"
exit "$FAIL"

#!/usr/bin/env bash
# Infra health: containers, service endpoints, S3 bucket, kafka, redis, postgres.
set -u
FAIL=0
chk() { if [ "$2" = "$3" ]; then echo "PASS $1"; else echo "FAIL $1 want=[$2] got=[$3]"; FAIL=$((FAIL+1)); fi; }

echo "--- containers ---"
docker ps --format '{{.Names}}\t{{.Status}}' | sort

for c in postgres redis kafka kafka-ui localstack; do
  ST=$(docker ps --filter "name=^${c}$" --format '{{.Status}}')
  case "$ST" in Up*) chk "container.$c" "Up" "Up";; *) chk "container.$c" "Up" "${ST:-MISSING}";; esac
done

echo "--- endpoints ---"
chk "endpoint.auth_health" 200 "$(curl -s -m5 -o /dev/null -w '%{http_code}' http://localhost:8080/api/public/health)"
chk "endpoint.employee_health" 200 "$(curl -s -m5 -o /dev/null -w '%{http_code}' http://localhost:8082/api/public/health)"
chk "endpoint.kafka_ui" 200 "$(curl -s -m5 -o /dev/null -w '%{http_code}' http://localhost:8081)"

echo "--- datastores ---"
chk "postgres.ready" "accepting connections" "$(docker exec postgres pg_isready -U employee_user -d employee_db 2>&1 | grep -o 'accepting connections' || true)"
chk "redis.ping" "PONG" "$(docker exec redis redis-cli ping 2>&1 | tr -d '\r')"
chk "localstack.s3" "running" "$(docker exec localstack curl -s http://localhost:4566/_localstack/health 2>/dev/null | grep -o '"s3": "running"' | cut -d'"' -f4 || true)"
chk "s3.bucket" "employees" "$(docker exec localstack awslocal s3 ls 2>/dev/null | awk '{print $NF}' | grep -x employees || echo MISSING)"
chk "kafka.list" "ok" "$(docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list >/dev/null 2>&1 && echo ok || echo unreachable)"

echo "RESULT FAIL=$FAIL"
[ "$FAIL" -eq 0 ]

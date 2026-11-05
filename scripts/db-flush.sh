#!/usr/bin/env bash
# Flush accumulated test data, keep a small baseline so UI tests still have rows.
# Keeps: 10 employees (largest ids ~ newest), last 1000 audit rows, all users/roles.
# Clears: redis cache db. Idempotent, safe to run anytime (pretest hook runs it every 5th run).
set -u

PSQL="docker exec postgres psql -U employee_user -d employee_db -t -A -c"

before_emp=$($PSQL "select count(*) from employees;")
before_audit=$($PSQL "select count(*) from audit_logs;")

$PSQL "DELETE FROM employees WHERE employee_id NOT IN (SELECT employee_id FROM employees ORDER BY employee_id DESC LIMIT 10);" >/dev/null
$PSQL "DELETE FROM audit_logs WHERE id NOT IN (SELECT id FROM audit_logs ORDER BY id DESC LIMIT 1000);" >/dev/null
docker exec redis redis-cli FLUSHDB >/dev/null

after_emp=$($PSQL "select count(*) from employees;")
after_audit=$($PSQL "select count(*) from audit_logs;")
users=$($PSQL "select count(*) from users;")

echo "db-flush: employees ${before_emp} -> ${after_emp} (kept 10 baseline)"
echo "db-flush: audit_logs ${before_audit} -> ${after_audit} (kept last 1000)"
echo "db-flush: users ${users} (untouched), redis cache cleared"

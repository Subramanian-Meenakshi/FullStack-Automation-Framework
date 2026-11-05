#!/usr/bin/env bash
# Sandhata Employee Portal smoke matrix. One line per check, exit 1 on any FAIL.
set -u
AUTH=http://localhost:8080
EMP=http://localhost:8082
TS=$(date +%s)
CID="smoke-$TS"
EID="EMP$TS"
EML="smoke.$TS@corp.com"
PASS=0; FAIL=0

chk() { if [ "$2" = "$3" ]; then echo "PASS $1"; PASS=$((PASS+1)); else echo "FAIL $1 want=[$2] got=[$3]"; FAIL=$((FAIL+1)); fi; }
code() { curl -s -m5 -o /dev/null -w '%{http_code}' "$@"; }
tok() { curl -s -m5 -X POST "$AUTH/api/auth/login" -H 'Content-Type: application/json' -d "{\"username\":\"$1\",\"password\":\"$2\"}" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4; }

chk "health.auth" 200 "$(code "$AUTH/api/public/health")"
chk "health.employee" 200 "$(code "$EMP/api/public/health")"

HAT=$(tok hradmin hradmin123); EAT=$(tok employee1 employee123); MAT=$(tok manager1 manager123)
if [ -z "$HAT" ] || [ -z "$EAT" ] || [ -z "$MAT" ]; then echo "FAIL token.fetch"; exit 1; fi
echo "PASS token.fetch"

# --- auth ---
chk "login.ok" 200 "$(code -X POST "$AUTH/api/auth/login" -H 'Content-Type: application/json' -d '{"username":"hradmin","password":"hradmin123"}')"
chk "login.badpass" 401 "$(code -X POST "$AUTH/api/auth/login" -H 'Content-Type: application/json' -d '{"username":"hradmin","password":"wrong"}')"
chk "login.baduser" 401 "$(code -X POST "$AUTH/api/auth/login" -H 'Content-Type: application/json' -d '{"username":"nobody","password":"x"}')"
chk "logout" 200 "$(code -H "X-Correlation-ID: $CID-logout" -X POST "$AUTH/api/auth/logout" -H "Authorization: Bearer $HAT")"
RT=$(curl -s -m5 -X POST "$AUTH/api/auth/login" -H 'Content-Type: application/json' -d '{"username":"hradmin","password":"hradmin123"}' | grep -o '"refreshToken":"[^"]*' | cut -d'"' -f4)
chk "refresh.ok" 200 "$(code -X POST "$AUTH/api/auth/refresh" -H 'Content-Type: application/json' -d "{\"refreshToken\":\"$RT\"}")"
chk "refresh.with_access_token" 401 "$(code -X POST "$AUTH/api/auth/refresh" -H 'Content-Type: application/json' -d "{\"refreshToken\":\"$HAT\"}")"
chk "jwt.tampered_append" 403 "$(code -X POST "$EMP/employees" -H "Authorization: Bearer ${HAT}x" -H 'Content-Type: application/json' -d "{\"employeeId\":\"$EID\",\"firstName\":\"a\",\"lastName\":\"b\",\"email\":\"$EML\"}")"
chk "login.failed_audit_corr" 401 "$(code -H "X-Correlation-ID: $CID-loginfail" -X POST "$AUTH/api/auth/login" -H 'Content-Type: application/json' -d '{"username":"hradmin","password":"wrong"}')"
chk "login.ok_audit_corr" 200 "$(code -H "X-Correlation-ID: $CID-login" -X POST "$AUTH/api/auth/login" -H 'Content-Type: application/json' -d '{"username":"hradmin","password":"hradmin123"}')"

# --- rbac ---
chk "rbac.no_token" 403 "$(code "$EMP/employees")"
chk "rbac.employee_create" 403 "$(code -X POST "$EMP/employees" -H "Authorization: Bearer $EAT" -H 'Content-Type: application/json' -d "{\"employeeId\":\"$EID-x\",\"firstName\":\"a\",\"lastName\":\"b\",\"email\":\"x$EML\"}")"
chk "rbac.employee_update" 403 "$(code -X PUT "$EMP/employees/$EID" -H "Authorization: Bearer $EAT" -H 'Content-Type: application/json' -d "{\"employeeId\":\"$EID\",\"firstName\":\"a\",\"lastName\":\"b\",\"email\":\"$EML\"}")"
chk "rbac.manager_delete" 403 "$(code -X DELETE "$EMP/employees/$EID" -H "Authorization: Bearer $MAT")"
chk "rbac.audit_no_token" 403 "$(code "$EMP/audit")"
chk "rbac.audit_employee" 403 "$(code "$EMP/audit" -H "Authorization: Bearer $EAT")"
chk "rbac.audit_manager" 200 "$(code "$EMP/audit" -H "Authorization: Bearer $MAT")"
chk "rbac.audit_hradmin" 200 "$(code "$EMP/audit" -H "Authorization: Bearer $HAT")"

# --- crud ---
body() { curl -s -m5 "$@"; }
CREATE=( -H "X-Correlation-ID: $CID-create" -X POST "$EMP/employees" -H "Authorization: Bearer $HAT" -H 'Content-Type: application/json' -d "{\"employeeId\":\"$EID\",\"firstName\":\"Meera\",\"lastName\":\"Nair\",\"email\":\"$EML\",\"contactNumber\":\"+91-9876543210\",\"designation\":\"Analyst\",\"department\":\"HR\",\"jobLevel\":\"L2\",\"skills\":\"Java\",\"manager\":\"Ravi\",\"location\":\"Chennai\",\"status\":\"ACTIVE\"}" )
chk "crud.create" 201 "$(code "${CREATE[@]}")"
chk "crud.create_dup_id" 409 "$(code "${CREATE[@]}")"
chk "crud.create_dup_email" 409 "$(code -X POST "$EMP/employees" -H "Authorization: Bearer $HAT" -H 'Content-Type: application/json' -d "{\"employeeId\":\"${EID}2\",\"firstName\":\"A\",\"lastName\":\"B\",\"email\":\"$EML\"}")"
chk "crud.create_bad_email" 400 "$(code -X POST "$EMP/employees" -H "Authorization: Bearer $HAT" -H 'Content-Type: application/json' -d "{\"employeeId\":\"${EID}3\",\"firstName\":\"A\",\"lastName\":\"B\",\"email\":\"nope\"}")"
chk "crud.create_empty" 400 "$(code -X POST "$EMP/employees" -H "Authorization: Bearer $HAT" -H 'Content-Type: application/json' -d '{"employeeId":"","firstName":"","lastName":"","email":""}')"
chk "crud.create_bad_phone" 400 "$(code -X POST "$EMP/employees" -H "Authorization: Bearer $HAT" -H 'Content-Type: application/json' -d "{\"employeeId\":\"${EID}4\",\"firstName\":\"A\",\"lastName\":\"B\",\"email\":\"p$EML\",\"contactNumber\":\"abc!!!\"}")"
chk "crud.list" 200 "$(code "$EMP/employees" -H "Authorization: Bearer $EAT")"
chk "crud.get" 200 "$(code -H "X-Correlation-ID: $CID-view" "$EMP/employees/$EID" -H "Authorization: Bearer $MAT")"
chk "crud.get_missing" 404 "$(code "$EMP/employees/NOPE$TS" -H "Authorization: Bearer $EAT")"
chk "crud.update" 200 "$(code -H "X-Correlation-ID: $CID-update" -X PUT "$EMP/employees/$EID" -H "Authorization: Bearer $HAT" -H 'Content-Type: application/json' -d "{\"employeeId\":\"$EID\",\"firstName\":\"Meera\",\"lastName\":\"Nair\",\"email\":\"$EML\",\"designation\":\"Sr Analyst\",\"status\":\"ACTIVE\"}")"
chk "crud.update_missing" 404 "$(code -X PUT "$EMP/employees/NOPE$TS" -H "Authorization: Bearer $HAT" -H 'Content-Type: application/json' -d "{\"employeeId\":\"NOPE$TS\",\"firstName\":\"A\",\"lastName\":\"B\",\"email\":\"n$EML\"}")"
chk "crud.delete" 200 "$(code -H "X-Correlation-ID: $CID-delete" -X DELETE "$EMP/employees/$EID" -H "Authorization: Bearer $HAT")"
chk "crud.status_after_delete" TERMINATED "$(body "$EMP/employees/$EID" -H "Authorization: Bearer $EAT" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)"
chk "crud.restore" 200 "$(code -H "X-Correlation-ID: $CID-restore" -X POST "$EMP/employees/$EID/restore" -H "Authorization: Bearer $HAT")"
chk "crud.status_after_restore" ACTIVE "$(body "$EMP/employees/$EID" -H "Authorization: Bearer $EAT" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)"

# --- audit events carry this run's correlation ids ---
if AUDIT_OUT=$(python3 - "$EMP/audit" "$HAT" "$CID" 2>&1 <<'PY'
import json, sys, urllib.request
url, tok, prefix = sys.argv[1], sys.argv[2], sys.argv[3]
req = urllib.request.Request(url, headers={"Authorization": "Bearer " + tok})
rows = json.load(urllib.request.urlopen(req, timeout=10))
want = {"LOGIN": prefix + "-login", "LOGIN_FAILED": prefix + "-loginfail",
        "LOGOUT": prefix + "-logout", "CREATE_EMPLOYEE": prefix + "-create",
        "VIEW_EMPLOYEE": prefix + "-view", "UPDATE_EMPLOYEE": prefix + "-update",
        "DELETE_EMPLOYEE": prefix + "-delete", "RESTORE_EMPLOYEE": prefix + "-restore"}
have = {(r["action"], r.get("correlationId")) for r in rows}
missing = [a for a, c in want.items() if (a, c) not in have]
print("missing=" + ",".join(missing) if missing else "8/8")
sys.exit(1 if missing else 0)
PY
); then
  echo "PASS audit.events corr=$CID ($AUDIT_OUT)"
  PASS=$((PASS+1))
else
  echo "FAIL audit.events $AUDIT_OUT"
  FAIL=$((FAIL+1))
fi

echo "RESULT PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]

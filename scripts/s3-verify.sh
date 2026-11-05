#!/usr/bin/env bash
# LocalStack S3 checks: bucket, upload, download+decrypt, missing object, corrupted object.
# Usage: bash scripts/s3-verify.sh   (needs services + consumer running)
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FAIL=0
PASSN=0
chk() { if [ "$2" = "$3" ]; then echo "PASS $1"; PASSN=$((PASSN+1)); else echo "FAIL $1 want=[$2] got=[$3]"; FAIL=$((FAIL+1)); fi; }

KEY="${S3_DEC_KEY_B64:-GghACJLOTOVwBDBAcYc7fvrfB9XPcB9nuNuMBWTgsQo=}"
export S3_DEC_KEY_B64="$KEY"

echo "--- bucket ---"
BUCKET=$(docker exec localstack awslocal s3 ls 2>/dev/null | awk '{print $NF}' | grep -x employees || true)
chk "s3.bucket" "employees" "${BUCKET:-MISSING}"

echo "--- upload (via API -> consumer -> S3) ---"
TOK=$(curl -s -m5 -X POST http://localhost:8080/api/auth/login -H 'Content-Type: application/json' -d '{"username":"hradmin","password":"hradmin123"}' | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
if [ -z "$TOK" ]; then echo "FAIL s3verify.token"; exit 1; fi
CID="s3v-$(date +%s | tail -c 7)"
ID="ES$CID"
CREATE=$(curl -s -m5 -o /dev/null -w '%{http_code}' -H "X-Correlation-ID: $CID-create" -X POST http://localhost:8082/employees -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -d "{\"employeeId\":\"$ID\",\"firstName\":\"S3\",\"lastName\":\"Verify\",\"email\":\"$ID@corp.com\",\"contactNumber\":\"9999999999\",\"designation\":\"Dev\",\"department\":\"IT\",\"jobLevel\":\"L1\",\"skills\":\"Java\",\"manager\":\"M1\",\"location\":\"CHN\"}")
chk "s3.upload.create" 201 "$CREATE"
for i in $(seq 1 15); do
  docker exec localstack awslocal s3 ls "s3://employees/$ID.json" >/dev/null 2>&1 && break
  sleep 1
done
chk "s3.object.exists" "yes" "$(docker exec localstack awslocal s3 ls "s3://employees/$ID.json" >/dev/null 2>&1 && echo yes || echo no)"

echo "--- download + decrypt ---"
DEC=$(node -e "
const crypto=require('crypto');const {execSync}=require('child_process');
try{
  const buf=execSync('docker exec localstack awslocal s3 cp s3://employees/$ID.json -',{maxBuffer:10e6});
  const key=Buffer.from(process.env.S3_DEC_KEY_B64,'base64');
  const d=crypto.createDecipheriv('aes-256-gcm',key,buf.slice(0,12));d.setAuthTag(buf.slice(12,28));
  const obj=JSON.parse(Buffer.concat([d.update(buf.slice(28)),d.final()]).toString('utf8'));
  console.log(obj.employeeId==='$ID'&&obj.firstName==='S3'?'OK':'MISMATCH');
}catch(e){console.log('ERR '+e.message)}
")
chk "s3.decrypt" "OK" "$DEC"

echo "--- missing object ---"
MISS=$(node -e "
const {execSync}=require('child_process');
try{execSync('docker exec localstack awslocal s3 cp s3://employees/NOPE-$ID.json -',{maxBuffer:1e6,stdio:['ignore','pipe','pipe']});console.log('FOUND')}
catch(e){console.log((e.stderr||e.stdout||'').toString().includes('NoSuchKey')||String(e.status)!=='0'?'NOT_FOUND':'ERR')}
")
chk "s3.missing_object" "NOT_FOUND" "$MISS"

echo "--- corrupted object ---"
docker exec localstack sh -c "head -c 64 /dev/urandom > /tmp/c.bin && awslocal s3 cp /tmp/c.bin s3://employees/CORRUPT-$ID.json" >/dev/null 2>&1
chk "s3.corrupt_upload" "yes" "$(docker exec localstack awslocal s3 ls "s3://employees/CORRUPT-$ID.json" >/dev/null 2>&1 && echo yes || echo no)"
CORR=$(node -e "
const crypto=require('crypto');const {execSync}=require('child_process');
try{
  const buf=execSync('docker exec localstack awslocal s3 cp s3://employees/CORRUPT-$ID.json -',{maxBuffer:10e6});
  const key=Buffer.from(process.env.S3_DEC_KEY_B64,'base64');
  const d=crypto.createDecipheriv('aes-256-gcm',key,buf.slice(0,12));d.setAuthTag(buf.slice(12,28));
  Buffer.concat([d.update(buf.slice(28)),d.final()]);console.log('DECRYPTED');
}catch(e){console.log('DECRYPT_FAIL')}
")
chk "s3.corrupted_object" "DECRYPT_FAIL" "$CORR"

echo "RESULT PASS=$PASSN FAIL=$FAIL"
[ "$FAIL" -eq 0 ]

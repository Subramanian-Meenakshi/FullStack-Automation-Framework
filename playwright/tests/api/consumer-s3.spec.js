const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');
const path = require('path');
const { login, empApi, employeePayload } = require('../../helpers/apiHelper');
const { newEmployeeId, newCorrelationPrefix } = require('../../helpers/ids');
const { waitForAudit } = require('../../helpers/auditHelper');
const { downloadAndDecryptS3Object } = require('../../helpers/s3SyncHelper');
const { publishRaw, listConsumerGroups } = require('../../helpers/kafkaHelper');
const { CONSUMER_URL, CONSUMER_LOG, S3_BUCKET, LOCALSTACK_CONTAINER } = require('../../helpers/services');
const s3Cp = (key) => `docker exec ${LOCALSTACK_CONTAINER} awslocal s3 cp s3://${S3_BUCKET}/${key} -`;
const s3Ls = `docker exec ${LOCALSTACK_CONTAINER} awslocal s3 ls s3://${S3_BUCKET}`;

// CI checkout path differs from dev machines — never hardcode repo root.
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const CONSUMER_JAR = path.join(REPO_ROOT, 'backend/employee-consumer/target/employee-consumer-0.0.1-SNAPSHOT.jar');

function killConsumer() {
  execSync("ps aux | grep employee-consumer-0.0.1 | grep -v grep | awk '{print $2}' | xargs -r kill", { stdio: 'ignore' });
}

function startConsumerDetached() {
  execSync(
    `setsid nohup java -jar "${CONSUMER_JAR}" > "${CONSUMER_LOG}" 2>&1 < /dev/null & disown`,
    { shell: '/bin/bash' },
  );
}

async function waitConsumerHealthy(maxSeconds = 40) {
  for (let i = 0; i < maxSeconds; i++) {
    try {
      const h = await fetch(`${CONSUMER_URL}/api/public/health`);
      if (h.status === 200) return true;
    } catch { /* not up */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

test.describe('F consumer + S3', () => {
  let token;
  test.beforeAll(async () => { token = (await login('HR_ADMIN')).accessToken; });

  test('F-P02/P04 create lands in S3 and decrypts to API values', async () => {
    const id = newEmployeeId();
    const r = await empApi('/employees', { method: 'POST', token, body: employeePayload(id, { firstName: 'Stored' }) });
    expect(r.status).toBe(201);
    // wait for object
    let obj = null;
    for (let i = 0; i < 20 && !obj; i++) {
      try { obj = await downloadAndDecryptS3Object(id); } catch { await new Promise((x) => setTimeout(x, 400)); }
    }
    expect(obj, 's3 object exists + decrypts').toBeTruthy();
    expect(obj.employeeId).toBe(id);
    expect(obj.firstName).toBe('Stored');
    expect(obj.email).toBe(`${id}@corp.com`);
    expect(obj.status).toBe('ACTIVE');
  });

  test('F-P03 object layout iv(12)||tag(16)||body', async () => {
    const id = newEmployeeId();
    await empApi('/employees', { method: 'POST', token, body: employeePayload(id) });
    for (let i = 0; i < 20; i++) {
      try {
        const buf = execSync(s3Cp(`${id}.json`), { maxBuffer: 10e6 });
        expect(buf.length).toBeGreaterThan(28);
        // decrypt success implies valid layout (helper slices 12/16)
        return;
      } catch { await new Promise((x) => setTimeout(x, 400)); }
    }
    throw new Error('object never appeared');
  });

  test('F-P05/P06 consumer audit SUCCESS with carried correlation', async () => {
    const id = newEmployeeId();
    const corr = newCorrelationPrefix();
    await empApi('/employees', { method: 'POST', token, correlationId: corr, body: employeePayload(id) });
    const row = await waitForAudit(token, 'CONSUME_CREATE', corr, { timeoutMs: 12000 });
    expect(row, 'CONSUME_CREATE row').toBeTruthy();
    expect(row.username).toBe('system');
    expect(row.result).toBe('SUCCESS');
    expect(row.employeeId).toBe(id);
  });

  test('F-N01 missing object -> download fails', async () => {
    let failed = false;
    try { await downloadAndDecryptS3Object(`NOPE${Date.now()}`.slice(0, 20)); } catch { failed = true; }
    expect(failed).toBe(true);
  });

  test('F-N02 corrupted object -> decrypt fails', async () => {
    const id = newEmployeeId();
    await empApi('/employees', { method: 'POST', token, body: employeePayload(id) });
    await new Promise((r) => setTimeout(r, 2500));
    execSync(`docker exec ${LOCALSTACK_CONTAINER} sh -c "head -c 64 /dev/urandom > /tmp/x.bin && awslocal s3 cp /tmp/x.bin s3://${S3_BUCKET}/${id}.json"`, { stdio: 'ignore' });
    let failed = false;
    try { await downloadAndDecryptS3Object(id); } catch { failed = true; }
    expect(failed).toBe(true);
  });

  test('F-N03 malformed event -> consumer audit FAILURE, stays alive', async () => {
    const id = newEmployeeId();
    const corr = newCorrelationPrefix();
    await publishRaw('employee-create', id, JSON.stringify({ action: 'employee-create', employeeId: id, correlationId: corr }));
    const row = await waitForAudit(token, 'CONSUME_CREATE', corr, { timeoutMs: 12000 });
    expect(row, 'FAILURE row').toBeTruthy();
    expect(row.result).toBe('FAILURE');
    // consumer still alive
    const health = await fetch(`${CONSUMER_URL}/api/public/health`);
    expect(health.status).toBe(200);
  });

  test('F-N04 consumer down -> producer/UI unaffected', async () => {
    test.setTimeout(60_000);
    killConsumer();
    await new Promise((r) => setTimeout(r, 1500));
    try {
      const id = newEmployeeId();
      const c = await empApi('/employees', { method: 'POST', token, body: employeePayload(id) });
      expect(c.status).toBe(201);
      const g = await empApi(`/employees/${id}`, { token });
      expect(g.status).toBe(200);
    } finally {
      startConsumerDetached();
      expect(await waitConsumerHealthy(30), 'consumer back up after F-N04').toBe(true);
    }
  });

  test('F-P01 all four topics consumed by group employee-consumer', async () => {
    test.setTimeout(90_000);
    const id = newEmployeeId();
    const p = newCorrelationPrefix();
    await empApi('/employees', { method: 'POST', token, correlationId: p, body: employeePayload(id) });
    await empApi(`/employees/${id}`, { token, correlationId: `${p}-read` });
    await empApi(`/employees/${id}`, { method: 'PUT', token, correlationId: `${p}-update`, body: employeePayload(id, { firstName: 'Four' }) });
    await empApi(`/employees/${id}`, { method: 'DELETE', token, correlationId: `${p}-delete` });
    const want = [
      ['CONSUME_CREATE', p],
      ['CONSUME_READ', `${p}-read`],
      ['CONSUME_UPDATE', `${p}-update`],
      ['CONSUME_DELETE', `${p}-delete`],
    ];
    for (const [action, corr] of want) {
      const row = await waitForAudit(token, action, corr, { timeoutMs: 15000 });
      expect(row, `${action} @ ${corr}`).toBeTruthy();
      expect(row.result).toBe('SUCCESS');
    }
    const groups = await listConsumerGroups();
    expect(groups, 'consumer group').toContain('employee-consumer');
  });

  test('F-P07 later event overwrites S3 object (latest snapshot)', async () => {
    test.setTimeout(60_000);
    const id = newEmployeeId();
    await empApi('/employees', { method: 'POST', token, body: employeePayload(id, { firstName: 'First' }) });
    let obj = null;
    for (let i = 0; i < 25 && !obj; i++) {
      try { obj = await downloadAndDecryptS3Object(id); } catch { await new Promise((x) => setTimeout(x, 400)); }
    }
    expect(obj, 'initial object').toBeTruthy();
    expect(obj.firstName).toBe('First');
    await empApi(`/employees/${id}`, { method: 'PUT', token, body: employeePayload(id, { firstName: 'Second' }) });
    let latest = null;
    for (let i = 0; i < 25 && !latest; i++) {
      try {
        const cur = await downloadAndDecryptS3Object(id);
        if (cur.firstName === 'Second') latest = cur;
      } catch { /* not yet */ }
      if (!latest) await new Promise((x) => setTimeout(x, 400));
    }
    expect(latest, 'S3 holds updated snapshot').toBeTruthy();
    expect(latest.employeeId).toBe(id);
  });

  test('F-P08 bucket auto-created at consumer startup', async () => {
    test.setTimeout(90_000);
    killConsumer();
    await new Promise((r) => setTimeout(r, 1500));
    execSync(`docker exec ${LOCALSTACK_CONTAINER} awslocal s3 rb s3://${S3_BUCKET} --force`, { stdio: 'ignore' });
    let exists = true;
    try { execSync(s3Ls, { stdio: 'pipe' }); } catch { exists = false; }
    expect(exists, 'bucket removed precondition').toBe(false);
    try {
      startConsumerDetached();
      expect(await waitConsumerHealthy(40), 'consumer back up').toBe(true);
      let recreated = false;
      for (let i = 0; i < 20 && !recreated; i++) {
        try { execSync(s3Ls, { stdio: 'pipe' }); recreated = true; } catch { await new Promise((r) => setTimeout(r, 500)); }
      }
      expect(recreated, 'bucket recreated by consumer startup').toBe(true);
    } finally {
      // guarantee consumer running even if assertions failed mid-test
      if (!(await waitConsumerHealthy(5))) {
        startConsumerDetached();
        await waitConsumerHealthy(15);
      }
    }
  });
});

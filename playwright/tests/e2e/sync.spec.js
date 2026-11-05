const { test, expect } = require('@playwright/test');
const { login, empApi, employeePayload } = require('../../helpers/apiHelper');
const { newEmployeeId, newCorrelationPrefix } = require('../../helpers/ids');
const { waitForAudit } = require('../../helpers/auditHelper');
const {
  fetchKafkaMessage, downloadAndDecryptS3Object, validateApiVsKafkaVsS3,
} = require('../../helpers/s3SyncHelper');
const { LOCALSTACK_CONTAINER, S3_BUCKET } = require('../../helpers/services');

async function attach(name, body, contentType = 'application/json') {
  await test.info().attach(name, { body: typeof body === 'string' ? body : JSON.stringify(body, null, 2), contentType });
}

async function waitS3(id, { timeoutMs = 12000 } = {}) {
  const start = Date.now();
  let lastErr;
  while (Date.now() - start < timeoutMs) {
    try {
      return await downloadAndDecryptS3Object(id);
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  throw lastErr || new Error(`s3 object never appeared for ${id}`);
}

test.describe('K end-to-end sync', () => {
  let token;
  test.beforeAll(async () => { token = (await login('HR_ADMIN')).accessToken; });

  test('K-P01 create -> API vs Kafka vs S3 match field-by-field', async () => {
    const id = newEmployeeId();
    const corr = newCorrelationPrefix();
    const api = await empApi('/employees', {
      method: 'POST', token, correlationId: corr, body: employeePayload(id, { firstName: 'SyncCreate' }),
    });
    expect(api.status).toBe(201);

    const kafka = await fetchKafkaMessage('employee-create', id, { correlationId: corr, timeoutMs: 15000 });
    expect(kafka, 'create event').toBeTruthy();
    const s3 = await waitS3(id);

    const result = validateApiVsKafkaVsS3(api.json, kafka, s3);
    await attach('api-response.json', api.json);
    await attach('kafka-message.json', kafka);
    await attach('s3-decrypted-object.json', s3);
    await attach('sync-comparison.json', result);

    expect(result.mismatches, JSON.stringify(result.mismatches)).toEqual([]);
    expect(result.inSync).toBe(true);
    expect(api.json.employeeId).toBe(id);
    expect(kafka.employeeId).toBe(id);
    expect(s3.employeeId).toBe(id);
  });

  test('K-P02 update -> API, Kafka, S3 all reflect updated values', async () => {
    const id = newEmployeeId();
    const corrCreate = newCorrelationPrefix();
    await empApi('/employees', {
      method: 'POST', token, correlationId: corrCreate, body: employeePayload(id, { firstName: 'PreUpdate' }),
    });
    await waitS3(id);

    const corrUpdate = newCorrelationPrefix();
    const updatedPayload = employeePayload(id, {
      firstName: 'PostUpdate', designation: 'Sr Analyst', department: 'Platform',
    });
    const api = await empApi(`/employees/${id}`, {
      method: 'PUT', token, correlationId: corrUpdate, body: updatedPayload,
    });
    expect(api.status).toBe(200);
    expect(api.json.firstName).toBe('PostUpdate');

    const kafka = await fetchKafkaMessage('employee-update', id, { correlationId: corrUpdate, timeoutMs: 15000 });
    expect(kafka, 'update event').toBeTruthy();
    const s3 = await waitS3(id);

    // S3 is latest snapshot — poll until consumer applies the update if create landed first
    const start = Date.now();
    let result = validateApiVsKafkaVsS3(api.json, kafka, s3);
    while (!result.inSync && Date.now() - start < 12000) {
      await new Promise((r) => setTimeout(r, 400));
      const fresh = await waitS3(id, { timeoutMs: 3000 });
      result = validateApiVsKafkaVsS3(api.json, kafka, fresh);
    }

    await attach('api-update.json', api.json);
    await attach('kafka-update.json', kafka);
    await attach('sync-update-comparison.json', result);
    expect(result.mismatches, JSON.stringify(result.mismatches)).toEqual([]);
    expect(result.inSync).toBe(true);
    expect(result.api.firstName).toBe('PostUpdate');
    expect(result.kafka.firstName).toBe('PostUpdate');
    expect(result.s3.firstName).toBe('PostUpdate');
  });

  test('K-P03 correlation identical across API header, Kafka payload, consumer audit', async () => {
    const id = newEmployeeId();
    const corr = newCorrelationPrefix();
    const api = await empApi('/employees', {
      method: 'POST', token, correlationId: corr, body: employeePayload(id),
    });
    expect(api.headers['x-correlation-id']).toBe(corr);

    const kafka = await fetchKafkaMessage('employee-create', id, { correlationId: corr, timeoutMs: 15000 });
    expect(kafka).toBeTruthy();
    expect(kafka.correlationId).toBe(corr);

    const row = await waitForAudit(token, 'CONSUME_CREATE', corr, { timeoutMs: 15000 });
    expect(row, 'consumer audit row').toBeTruthy();
    expect(row.correlationId).toBe(corr);
    expect(row.username).toBe('system');

    await attach('correlation-trail.json', {
      apiHeader: api.headers['x-correlation-id'],
      kafkaPayload: kafka.correlationId,
      consumerAudit: row.correlationId,
    });
  });

  test('K-P04 decrypt-before-compare: wrong AES key fails auth tag check', async () => {
    const id = newEmployeeId();
    await empApi('/employees', { method: 'POST', token, body: employeePayload(id) });
    const good = await waitS3(id);
    expect(good.employeeId).toBe(id);

    const { execSync } = require('child_process');
    const crypto = require('crypto');
    const buf = execSync(`docker exec ${LOCALSTACK_CONTAINER} awslocal s3 cp s3://${S3_BUCKET}/${id}.json -`, { maxBuffer: 10e6 });
    const wrongKey = Buffer.alloc(32, 7);
    let failed = false;
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', wrongKey, buf.slice(0, 12));
      decipher.setAuthTag(buf.slice(12, 28));
      Buffer.concat([decipher.update(buf.slice(28)), decipher.final()]);
    } catch {
      failed = true;
    }
    expect(failed, 'wrong key must fail decrypt').toBe(true);
  });

  test('K-N01 tampered API value -> validator reports mismatch', async () => {
    const id = newEmployeeId();
    const corr = newCorrelationPrefix();
    const api = await empApi('/employees', {
      method: 'POST', token, correlationId: corr, body: employeePayload(id, { firstName: 'Honest' }),
    });
    const kafka = await fetchKafkaMessage('employee-create', id, { correlationId: corr, timeoutMs: 15000 });
    const s3 = await waitS3(id);

    const tampered = { ...api.json, firstName: 'Liar' };
    const result = validateApiVsKafkaVsS3(tampered, kafka, s3);
    await attach('tampered-comparison.json', result);
    expect(result.inSync).toBe(false);
    expect(result.mismatches.some((m) => m.field === 'firstName')).toBe(true);
  });
});

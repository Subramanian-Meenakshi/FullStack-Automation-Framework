const { test, expect } = require('@playwright/test');
const { login, empApi, employeePayload } = require('../../helpers/apiHelper');
const { newEmployeeId, newCorrelationPrefix } = require('../../helpers/ids');
const { fetchAudit, waitForAudit } = require('../../helpers/auditHelper');
const { fetchKafkaMessage } = require('../../helpers/kafkaHelper');
const { execSync } = require('child_process');
const { AUTH_URL, EMPLOYEE_LOG, CONSUMER_LOG } = require('../../helpers/services');
const { users } = require('../../data/users');

test.describe('H correlation id', () => {
  let token;
  test.beforeAll(async () => { token = (await login('HR_ADMIN')).accessToken; });

  test('H-01 provided header echoed on success', async () => {
    const c = newCorrelationPrefix();
    const r = await empApi('/employees', { token, correlationId: c });
    expect(r.headers['x-correlation-id']).toBe(c);
  });

  test('H-02 absent header -> generated and echoed', async () => {
    const r = await empApi('/employees', { token });
    expect(r.headers['x-correlation-id']).toBeTruthy();
    expect(r.headers['x-correlation-id']).not.toBe('N/A');
  });

  test('H-03 header survives 400/401/403', async () => {
    const c1 = newCorrelationPrefix();
    const bad = await empApi('/employees', { method: 'POST', token, correlationId: c1, body: employeePayload('', { email: 'x' }) });
    expect(bad.status).toBe(400);
    expect(bad.headers['x-correlation-id']).toBe(c1);

    const c2 = newCorrelationPrefix();
    const unauth = await empApi('/employees', { correlationId: c2 });
    expect([401, 403]).toContain(unauth.status);
    expect(unauth.headers['x-correlation-id']).toBe(c2);

    const c3 = newCorrelationPrefix();
    const forbidden = await empApi('/employees', { method: 'POST', token: (await login('EMPLOYEE')).accessToken, correlationId: c3, body: employeePayload(newEmployeeId()) });
    expect(forbidden.status).toBe(403);
    expect(forbidden.headers['x-correlation-id']).toBe(c3);
  });

  test('H-04 same id accepted by auth-service too', async () => {
    const c = newCorrelationPrefix();
    const r = await fetch(`${AUTH_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Correlation-ID': c },
      body: JSON.stringify({ username: users.HR_ADMIN.username, password: users.HR_ADMIN.password }),
    });
    expect(r.headers.get('x-correlation-id')).toBe(c);
  });

  test('H-05 id appears in service logs', async () => {
    // GET list emits no log line; force a synchronous warn on the request thread via corrupt cache.
    const id = newEmployeeId();
    await empApi('/employees', { method: 'POST', token, body: employeePayload(id) });
    const { redisCmd, keyFor } = require('../../helpers/cacheHelper');
    redisCmd('SET', keyFor(id), 'NOT-JSON{');
    const c = newCorrelationPrefix();
    const r = await empApi(`/employees/${id}`, { token, correlationId: c });
    expect(r.status).toBe(200);
    await new Promise((res) => setTimeout(res, 400));
    const count = execSync(`grep -c "${c}" ${EMPLOYEE_LOG} || true`, { encoding: 'utf8' }).trim();
    expect(Number(count)).toBeGreaterThan(0);
  });

  test('H-06 id appears in Kafka payload', async () => {
    const id = newEmployeeId();
    const c = newCorrelationPrefix();
    await empApi('/employees', { method: 'POST', token, correlationId: c, body: employeePayload(id) });
    const msg = await fetchKafkaMessage('employee-create', id);
    expect(msg).toBeTruthy();
    expect(msg.correlationId).toBe(c);
  });

  test('H-07 id appears in audit row', async () => {
    const c = newCorrelationPrefix();
    const id = newEmployeeId();
    await empApi('/employees', { method: 'POST', token, correlationId: c, body: employeePayload(id) });
    const row = await waitForAudit(token, 'CREATE_EMPLOYEE', c, { timeoutMs: 8000 });
    expect(row, 'audit row with corr').toBeTruthy();
    expect(row.correlationId).toBe(c);
  });

  test('H-08 id appears in consumer log', async () => {
    const id = newEmployeeId();
    const c = newCorrelationPrefix();
    await empApi('/employees', { method: 'POST', token, correlationId: c, body: employeePayload(id) });
    let count = 0;
    for (let i = 0; i < 25 && count === 0; i++) {
      await new Promise((r) => setTimeout(r, 300));
      count = Number(execSync(`grep -c "${c}" ${CONSUMER_LOG} || true`, { encoding: 'utf8' }).trim());
    }
    expect(count).toBeGreaterThan(0);
  });
});

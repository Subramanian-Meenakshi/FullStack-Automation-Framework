const { test, expect } = require('@playwright/test');
const { login, empApi, authApi, employeePayload, loginRaw } = require('../../helpers/apiHelper');
const { newEmployeeId } = require('../../helpers/ids');
const { users } = require('../../data/users');
const { AUTH_URL, EMP_URL, CONSUMER_URL, REDIS_CONTAINER } = require('../../helpers/services');

test.describe('smoke', () => {
  test('health: auth, employee, consumer', async () => {
    for (const url of [AUTH_URL, EMP_URL, CONSUMER_URL]) {
      const r = await fetch(`${url}/api/public/health`);
      expect(r.status, url).toBe(200);
    }
  });

  test('login all three roles', async () => {
    for (const role of ['HR_ADMIN', 'MANAGER', 'EMPLOYEE']) {
      const t = await login(role);
      expect(t.accessToken).toBeTruthy();
      expect(t.role).toBe(users[role].role);
    }
  });

  test('login rejects bad password', async () => {
    const r = await loginRaw('hradmin', 'wrong');
    expect(r.status).toBe(401);
    expect(r.json.error).toBeTruthy();
  });

  test('crud happy path: create -> get -> update -> delete -> restore', async () => {
    const t = await login('HR_ADMIN');
    const id = newEmployeeId();
    const body = employeePayload(id);
    const created = await empApi('/employees', { method: 'POST', token: t.accessToken, body });
    expect(created.status).toBe(201);

    const got = await empApi(`/employees/${id}`, { token: t.accessToken });
    expect(got.status).toBe(200);
    expect(got.json.firstName).toBe(body.firstName);

    const upd = await empApi(`/employees/${id}`, {
      method: 'PUT', token: t.accessToken,
      body: employeePayload(id, { firstName: 'Updated' }),
    });
    expect(upd.status).toBe(200);
    expect(upd.json.firstName).toBe('Updated');

    const del = await empApi(`/employees/${id}`, { method: 'DELETE', token: t.accessToken });
    expect(del.status).toBe(200);
    expect(del.json.status).toBe('TERMINATED');

    const res = await empApi(`/employees/${id}/restore`, { method: 'POST', token: t.accessToken });
    expect(res.status).toBe(200);
    expect(res.json.status).toBe('ACTIVE');
  });

  test('rbac: employee cannot create, cannot read audit', async () => {
    const t = await login('EMPLOYEE');
    const c = await empApi('/employees', { method: 'POST', token: t.accessToken, body: employeePayload(newEmployeeId()) });
    expect(c.status).toBe(403);
    const a = await empApi('/audit', { token: t.accessToken });
    expect(a.status).toBe(403);
  });

  test('audit: HR_ADMIN can list, correlated rows exist', async () => {
    const t = await login('HR_ADMIN');
    const a = await empApi('/audit', { token: t.accessToken });
    expect(a.status).toBe(200);
    expect(Array.isArray(a.json)).toBe(true);
    expect(a.json.length).toBeGreaterThan(0);
  });

  test('correlation header echoed', async () => {
    const t = await login('HR_ADMIN');
    const corr = `smoke-${Date.now()}`;
    const r = await empApi('/employees', { token: t.accessToken, correlationId: corr });
    expect(r.headers['x-correlation-id']).toBe(corr);
  });

  test('cache key exists after get', async () => {
    const t = await login('HR_ADMIN');
    const id = newEmployeeId();
    await empApi('/employees', { method: 'POST', token: t.accessToken, body: employeePayload(id) });
    await empApi(`/employees/${id}`, { token: t.accessToken });
    const { execSync } = require('child_process');
    const exists = execSync(`docker exec ${REDIS_CONTAINER} redis-cli EXISTS emp:${id}`, { encoding: 'utf8' }).trim();
    expect(exists).toBe('1');
  });
});

const { test, expect } = require('@playwright/test');
const { login, empApi, authApi, employeePayload } = require('../../helpers/apiHelper');
const { newEmployeeId, newCorrelationPrefix } = require('../../helpers/ids');
const { fetchAudit, waitForAudit } = require('../../helpers/auditHelper');

test.describe('G audit', () => {
  let token;
  test.beforeAll(async () => { token = (await login('HR_ADMIN')).accessToken; });

  test('G-P01 8/8 events for one correlated run', async () => {
    const p = newCorrelationPrefix();
    const id = newEmployeeId();
    await authApi('/api/auth/login', { method: 'POST', token, correlationId: `${p}-login`, body: { username: 'hradmin', password: 'hradmin123' } });
    await authApi('/api/auth/login', { method: 'POST', correlationId: `${p}-loginfail`, body: { username: 'hradmin', password: 'wrong' } });
    await authApi('/api/auth/logout', { method: 'POST', token, correlationId: `${p}-logout` });
    await empApi('/employees', { method: 'POST', token, correlationId: `${p}-create`, body: employeePayload(id) });
    await empApi(`/employees/${id}`, { token, correlationId: `${p}-view` });
    await empApi(`/employees/${id}`, { method: 'PUT', token, correlationId: `${p}-update`, body: employeePayload(id, { firstName: 'Audited' }) });
    await empApi(`/employees/${id}`, { method: 'DELETE', token, correlationId: `${p}-delete` });
    await empApi(`/employees/${id}/restore`, { method: 'POST', token, correlationId: `${p}-restore` });

    const want = {
      LOGIN: `${p}-login`, LOGIN_FAILED: `${p}-loginfail`, LOGOUT: `${p}-logout`,
      CREATE_EMPLOYEE: `${p}-create`, VIEW_EMPLOYEE: `${p}-view`, UPDATE_EMPLOYEE: `${p}-update`,
      DELETE_EMPLOYEE: `${p}-delete`, RESTORE_EMPLOYEE: `${p}-restore`,
    };
    const rows = await fetchAudit(token);
    for (const [action, corr] of Object.entries(want)) {
      const hit = rows.find((r) => r.action === action && r.correlationId === corr);
      expect(hit, `${action} @ ${corr}`).toBeTruthy();
    }
  });

  test('G-P03 CONSUME_* rows with username=system', async () => {
    const p = newCorrelationPrefix();
    const id = newEmployeeId();
    await empApi('/employees', { method: 'POST', token, correlationId: p, body: employeePayload(id) });
    const row = await waitForAudit(token, 'CONSUME_CREATE', p, { timeoutMs: 12000 });
    expect(row).toBeTruthy();
    expect(row.username).toBe('system');
  });

  test('G-P02 every audit row carries the request correlation id', async () => {
    const id = newEmployeeId();
    const corr = `${newCorrelationPrefix()}-exact`;
    await empApi('/employees', { method: 'POST', token, correlationId: corr, body: employeePayload(id) });
    await empApi(`/employees/${id}`, { token, correlationId: corr });
    await empApi(`/employees/${id}`, { method: 'PUT', token, correlationId: corr, body: employeePayload(id, { firstName: 'Corr' }) });
    const rows = await fetchAudit(token);
    const mine = rows.filter((r) => r.employeeId === id);
    expect(mine.length).toBeGreaterThanOrEqual(3);
    for (const r of mine) {
      expect(r.correlationId, `${r.action} row correlation`).toBe(corr);
      expect(r.result).toBeTruthy();
    }
  });

  test('G-P04 audit newest first, capped structure', async () => {
    const rows = await fetchAudit(token);
    expect(rows.length).toBeLessThanOrEqual(200);
    if (rows.length >= 2) expect(rows[0].id).toBeGreaterThanOrEqual(rows[1].id);
  });

  test('G-P05 audit allowed for MANAGER', async () => {
    const m = await login('MANAGER');
    const r = await empApi('/audit', { token: m.accessToken });
    expect(r.status).toBe(200);
  });

  test('G-N01 failed login audited with FAILURE', async () => {
    const p = newCorrelationPrefix();
    await authApi('/api/auth/login', { method: 'POST', correlationId: p, body: { username: 'hradmin', password: 'wrong' } });
    const row = await waitForAudit(token, 'LOGIN_FAILED', p, { timeoutMs: 8000 });
    expect(row, 'LOGIN_FAILED row').toBeTruthy();
    expect(row.result).toBe('FAILURE');
    expect(row.username).toBe('hradmin');
  });

  test('G-N03 EMPLOYEE denied on audit', async () => {
    const e = await login('EMPLOYEE');
    const r = await empApi('/audit', { token: e.accessToken });
    expect(r.status).toBe(403);
  });

  test('G-N02 unauthorized 403 audited and attributable', async () => {
    const m = await login('MANAGER');
    const p = newCorrelationPrefix();
    const r = await empApi('/employees', {
      method: 'POST', token: m.accessToken, correlationId: p,
      body: employeePayload(newEmployeeId()),
    });
    expect(r.status).toBe(403);
    const row = await waitForAudit(token, 'ACCESS_DENIED', p, { timeoutMs: 8000 });
    expect(row, 'ACCESS_DENIED row').toBeTruthy();
    expect(row.username).toBe('manager1');
    expect(row.result).toBe('FAILURE');
  });

  test('G-N04 missing correlation -> audit still written', async () => {
    const id = newEmployeeId();
    await empApi('/employees', { method: 'POST', token, body: employeePayload(id) });
    let found = false;
    for (let i = 0; i < 20 && !found; i++) {
      const rows = await fetchAudit(token);
      found = rows.some((r) => r.action === 'CREATE_EMPLOYEE' && r.employeeId === id && r.correlationId);
      if (!found) await new Promise((r) => setTimeout(r, 300));
    }
    expect(found).toBe(true);
  });
});

const { test, expect } = require('@playwright/test');
const { login, empApi, employeePayload } = require('../../helpers/apiHelper');
const { newEmployeeId } = require('../../helpers/ids');

test.describe('B RBAC matrix', () => {
  let tokens = {};
  test.beforeAll(async () => {
    tokens = {
      HR_ADMIN: (await login('HR_ADMIN')).accessToken,
      MANAGER: (await login('MANAGER')).accessToken,
      EMPLOYEE: (await login('EMPLOYEE')).accessToken,
    };
  });

  test('B-01 GET list allowed for all roles', async () => {
    for (const role of ['HR_ADMIN', 'MANAGER', 'EMPLOYEE']) {
      const r = await empApi('/employees', { token: tokens[role] });
      expect(r.status, role).toBe(200);
    }
  });

  test('B-02 POST only HR_ADMIN', async () => {
    const id = newEmployeeId();
    expect((await empApi('/employees', { method: 'POST', token: tokens.HR_ADMIN, body: employeePayload(id) })).status).toBe(201);
    expect((await empApi('/employees', { method: 'POST', token: tokens.MANAGER, body: employeePayload(newEmployeeId()) })).status).toBe(403);
    expect((await empApi('/employees', { method: 'POST', token: tokens.EMPLOYEE, body: employeePayload(newEmployeeId()) })).status).toBe(403);
  });

  test('B-03 PUT HR_ADMIN+MANAGER allowed, EMPLOYEE denied', async () => {
    const id = newEmployeeId();
    await empApi('/employees', { method: 'POST', token: tokens.HR_ADMIN, body: employeePayload(id) });
    expect((await empApi(`/employees/${id}`, { method: 'PUT', token: tokens.MANAGER, body: employeePayload(id, { designation: 'Sr Analyst' }) })).status).toBe(200);
    expect((await empApi(`/employees/${id}`, { method: 'PUT', token: tokens.EMPLOYEE, body: employeePayload(id) })).status).toBe(403);
    await empApi(`/employees/${id}`, { method: 'DELETE', token: tokens.HR_ADMIN });
  });

  test('B-04 DELETE only HR_ADMIN', async () => {
    const id = newEmployeeId();
    await empApi('/employees', { method: 'POST', token: tokens.HR_ADMIN, body: employeePayload(id) });
    expect((await empApi(`/employees/${id}`, { method: 'DELETE', token: tokens.MANAGER })).status).toBe(403);
    expect((await empApi(`/employees/${id}`, { method: 'DELETE', token: tokens.EMPLOYEE })).status).toBe(403);
    expect((await empApi(`/employees/${id}`, { method: 'DELETE', token: tokens.HR_ADMIN })).status).toBe(200);
  });

  test('B-05 restore only HR_ADMIN', async () => {
    const id = newEmployeeId();
    await empApi('/employees', { method: 'POST', token: tokens.HR_ADMIN, body: employeePayload(id) });
    await empApi(`/employees/${id}`, { method: 'DELETE', token: tokens.HR_ADMIN });
    expect((await empApi(`/employees/${id}/restore`, { method: 'POST', token: tokens.MANAGER })).status).toBe(403);
    expect((await empApi(`/employees/${id}/restore`, { method: 'POST', token: tokens.HR_ADMIN })).status).toBe(200);
  });

  test('B-06 audit HR_ADMIN+MANAGER only', async () => {
    expect((await empApi('/audit', { token: tokens.HR_ADMIN })).status).toBe(200);
    expect((await empApi('/audit', { token: tokens.MANAGER })).status).toBe(200);
    expect((await empApi('/audit', { token: tokens.EMPLOYEE })).status).toBe(403);
  });

  test('B-07 no token -> 403 everywhere', async () => {
    expect((await empApi('/employees')).status).toBe(403);
    expect((await empApi('/audit')).status).toBe(403);
    expect((await empApi('/employees/X', { method: 'DELETE' })).status).toBe(403);
  });

  test('B-09 refresh token as access -> 403', async () => {
    const t = await login('HR_ADMIN');
    const r = await empApi('/employees', { token: t.refreshToken });
    expect(r.status).toBe(403);
  });
});

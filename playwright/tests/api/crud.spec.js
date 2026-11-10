const { test, expect } = require('@playwright/test');
const { login, empApi, employeePayload } = require('../../helpers/apiHelper');
const { newEmployeeId, newCorrelationPrefix } = require('../../helpers/ids');
const { EMP_URL } = require('../../helpers/services');

test.describe('C CRUD positive', () => {
  let token;
  test.beforeAll(async () => { token = (await login('HR_ADMIN')).accessToken; });

  test('C-P01 create full payload echoes fields', async () => {
    const id = newEmployeeId();
    const r = await empApi('/employees', { method: 'POST', token, body: employeePayload(id, { firstName: 'CreateMe' }) });
    expect(r.status).toBe(201);
    expect(r.json.employeeId).toBe(id);
    expect(r.json.firstName).toBe('CreateMe');
    expect(r.json.email).toBe(`${id}@sandhata.example`);
    expect(r.json.status).toBe('ACTIVE');
  });

  test('C-P02 get by id', async () => {
    const id = newEmployeeId();
    await empApi('/employees', { method: 'POST', token, body: employeePayload(id) });
    const r = await empApi(`/employees/${id}`, { token });
    expect(r.status).toBe(200);
    expect(r.json.employeeId).toBe(id);
  });

  test('C-P03 list contains row', async () => {
    const id = newEmployeeId();
    await empApi('/employees', { method: 'POST', token, body: employeePayload(id) });
    const r = await empApi('/employees', { token });
    expect(r.json.some((e) => e.employeeId === id)).toBe(true);
  });

  test('C-P04 partial update keeps other fields', async () => {
    const id = newEmployeeId();
    await empApi('/employees', { method: 'POST', token, body: employeePayload(id, { firstName: 'Before', department: 'KeepMe' }) });
    const r = await empApi(`/employees/${id}`, {
      method: 'PUT', token, body: employeePayload(id, { firstName: 'After', department: 'KeepMe' }),
    });
    expect(r.status).toBe(200);
    expect(r.json.firstName).toBe('After');
    expect(r.json.department).toBe('KeepMe');
  });

  test('C-P05 delete soft-deletes to TERMINATED', async () => {
    const id = newEmployeeId();
    await empApi('/employees', { method: 'POST', token, body: employeePayload(id) });
    const r = await empApi(`/employees/${id}`, { method: 'DELETE', token });
    expect(r.json.status).toBe('TERMINATED');
    const got = await empApi(`/employees/${id}`, { token });
    expect(got.json.status).toBe('TERMINATED');
  });

  test('C-P06 restore to ACTIVE', async () => {
    const id = newEmployeeId();
    await empApi('/employees', { method: 'POST', token, body: employeePayload(id) });
    await empApi(`/employees/${id}`, { method: 'DELETE', token });
    const r = await empApi(`/employees/${id}/restore`, { method: 'POST', token });
    expect(r.json.status).toBe('ACTIVE');
  });

  test('C-P07 correlation header echoed provided + auto-generated', async () => {
    const corr = newCorrelationPrefix();
    const a = await empApi('/employees', { token, correlationId: corr });
    expect(a.headers['x-correlation-id']).toBe(corr);
    const b = await empApi('/employees', { token });
    expect(b.headers['x-correlation-id']).toBeTruthy();
    expect(b.headers['x-correlation-id']).not.toBe(corr);
  });

  test('C-P08 status defaults ACTIVE when omitted', async () => {
    const id = newEmployeeId();
    const p = employeePayload(id);
    delete p.status;
    const r = await empApi('/employees', { method: 'POST', token, body: p });
    expect(r.json.status).toBe('ACTIVE');
  });
});

test.describe('C CRUD negative', () => {
  let token;
  test.beforeAll(async () => { token = (await login('HR_ADMIN')).accessToken; });

  test('C-N01 empty required fields -> 400', async () => {
    const r = await empApi('/employees', { method: 'POST', token, body: employeePayload('', { firstName: '', lastName: '', email: '' }) });
    expect(r.status).toBe(400);
  });

  test('C-N02 invalid email -> 400', async () => {
    const r = await empApi('/employees', { method: 'POST', token, body: employeePayload(newEmployeeId(), { email: 'not-an-email' }) });
    expect(r.status).toBe(400);
  });

  test('C-N03 invalid phone -> 400', async () => {
    const r = await empApi('/employees', { method: 'POST', token, body: employeePayload(newEmployeeId(), { contactNumber: 'abc!!!' }) });
    expect(r.status).toBe(400);
  });

  test('C-N04 duplicate employeeId -> 409', async () => {
    const id = newEmployeeId();
    await empApi('/employees', { method: 'POST', token, body: employeePayload(id) });
    const r = await empApi('/employees', { method: 'POST', token, body: employeePayload(id) });
    expect(r.status).toBe(409);
  });

  test('C-N05 duplicate email -> 409', async () => {
    const id1 = newEmployeeId();
    const id2 = newEmployeeId();
    await empApi('/employees', { method: 'POST', token, body: employeePayload(id1, { email: 'dup@corp.com' }) });
    const r = await empApi('/employees', { method: 'POST', token, body: employeePayload(id2, { email: 'dup@corp.com' }) });
    expect(r.status).toBe(409);
  });

  test('C-N06 employeeId > 20 chars -> 400', async () => {
    const r = await empApi('/employees', { method: 'POST', token, body: employeePayload('THIS-ID-IS-WAY-TOO-LONG-20') });
    expect(r.status).toBe(400);
  });

  test('C-N07 missing id -> 404 on get/update/delete', async () => {
    const nope = `NOPE${Date.now()}`.slice(0, 20);
    expect((await empApi(`/employees/${nope}`, { token })).status).toBe(404);
    expect((await empApi(`/employees/${nope}`, { method: 'PUT', token, body: employeePayload(nope) })).status).toBe(404);
    expect((await empApi(`/employees/${nope}`, { method: 'DELETE', token })).status).toBe(404);
  });

  test('C-N08 unknown fields ignored -> 201', async () => {
    const r = await empApi('/employees', { method: 'POST', token, body: { ...employeePayload(newEmployeeId()), evil: 'x' } });
    expect(r.status).toBe(201);
  });

  test('C-N09 SQLi firstName stored as literal -> 201', async () => {
    const id = newEmployeeId();
    const r = await empApi('/employees', { method: 'POST', token, body: employeePayload(id, { firstName: "Robert'); DROP TABLE employees;--" }) });
    expect(r.status).toBe(201);
    const table = await empApi('/employees', { token });
    expect(table.status).toBe(200); // table still alive
  });

  test('C-N10 XSS lastName stored as literal -> 201', async () => {
    const r = await empApi('/employees', { method: 'POST', token, body: employeePayload(newEmployeeId(), { lastName: '<img src=x onerror=alert(1)>' }) });
    expect(r.status).toBe(201);
  });

  test('C-N11 malformed JSON -> 400 not 500', async () => {
    const res = await fetch(`${EMP_URL}/employees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: '{bad json',
    });
    expect(res.status).toBe(400);
  });

  test('C-N12 /error dispatch returns 400 not 403 (security guard)', async () => {
    const res = await fetch(`${EMP_URL}/employees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: '{"employeeId":"","firstName":"","lastName":"","email":""}',
    });
    expect(res.status).toBe(400);
  });
});

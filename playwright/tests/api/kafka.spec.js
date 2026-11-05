const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');
const fs = require('fs');
const { login, empApi, employeePayload } = require('../../helpers/apiHelper');
const { newEmployeeId, newCorrelationPrefix } = require('../../helpers/ids');
const { fetchAudit } = require('../../helpers/auditHelper');
const { fetchKafkaMessage, fetchKafkaEntry, listTopics } = require('../../helpers/kafkaHelper');
const { KAFKA_CONTAINER, EMPLOYEE_LOG } = require('../../helpers/services');

test.describe('E Kafka producer', () => {
  let token;
  test.beforeAll(async () => { token = (await login('HR_ADMIN')).accessToken; });

  test('E-P01 create publishes to employee-create with correlation', async () => {
    const id = newEmployeeId();
    const corr = newCorrelationPrefix();
    await empApi('/employees', { method: 'POST', token, correlationId: corr, body: employeePayload(id) });
    const msg = await fetchKafkaMessage('employee-create', id);
    expect(msg, 'message found').toBeTruthy();
    expect(msg.action).toBe('employee-create');
    expect(msg.correlationId).toBe(corr);
    expect(msg.employee.firstName).toBe('Play');
  });

  test('E-P02 read publishes to employee-read (cache hit too)', async () => {
    const id = newEmployeeId();
    await empApi('/employees', { method: 'POST', token, body: employeePayload(id) });
    await empApi(`/employees/${id}`, { token }); // miss
    const corr = newCorrelationPrefix();
    const second = await empApi(`/employees/${id}`, { token, correlationId: corr }); // hit
    expect(second.status).toBe(200);
    const msg = await fetchKafkaMessage('employee-read', id, { correlationId: corr });
    expect(msg, 'read event with matching corr').toBeTruthy();
    expect(msg.correlationId).toBe(corr);
  });

  test('E-P03 update publishes to employee-update', async () => {
    const id = newEmployeeId();
    await empApi('/employees', { method: 'POST', token, body: employeePayload(id) });
    const corr = newCorrelationPrefix();
    await empApi(`/employees/${id}`, { method: 'PUT', token, correlationId: corr, body: employeePayload(id, { firstName: 'Updated' }) });
    const msg = await fetchKafkaMessage('employee-update', id);
    expect(msg, 'update event').toBeTruthy();
    expect(msg.correlationId).toBe(corr);
    expect(msg.employee.firstName).toBe('Updated');
  });

  test('E-P04 delete publishes to employee-delete', async () => {
    const id = newEmployeeId();
    await empApi('/employees', { method: 'POST', token, body: employeePayload(id) });
    await empApi(`/employees/${id}`, { method: 'DELETE', token });
    const msg = await fetchKafkaMessage('employee-delete', id);
    expect(msg, 'delete event').toBeTruthy();
    expect(msg.employee.status).toBe('TERMINATED');
  });

  test('E-P06 payload correlation equals request header (update)', async () => {
    const id = newEmployeeId();
    await empApi('/employees', { method: 'POST', token, body: employeePayload(id) });
    const corr = newCorrelationPrefix();
    await empApi(`/employees/${id}`, { method: 'PUT', token, correlationId: corr, body: employeePayload(id, { designation: 'Lead' }) });
    const msg = await fetchKafkaMessage('employee-update', id);
    expect(msg.correlationId).toBe(corr);
  });

  test('E-P05 message key equals employeeId', async () => {
    const id = newEmployeeId();
    await empApi('/employees', { method: 'POST', token, body: employeePayload(id) });
    const entry = await fetchKafkaEntry('employee-create', id);
    expect(entry, 'create entry found').toBeTruthy();
    expect(entry.key).toBe(id);
  });

  test('E-P07 payload employee equals API response', async () => {
    const id = newEmployeeId();
    const created = await empApi('/employees', { method: 'POST', token, body: employeePayload(id, { firstName: 'Mirror' }) });
    expect(created.status).toBe(201);
    const msg = await fetchKafkaMessage('employee-create', id);
    expect(msg, 'create event').toBeTruthy();
    expect(msg.employee).toEqual(created.json);
  });

  test('E-P08 all four topics exist after publish (auto-created)', async () => {
    const topics = await listTopics();
    for (const t of ['employee-create', 'employee-update', 'employee-delete', 'employee-read']) {
      expect(topics, `topic ${t}`).toContain(t);
    }
  });

  test('E-N01 kafka paused -> CRUD survives', async () => {
    execSync(`docker pause ${KAFKA_CONTAINER}`, { stdio: 'ignore' });
    try {
      const id = newEmployeeId();
      const c = await empApi('/employees', { method: 'POST', token, body: employeePayload(id) });
      expect(c.status).toBe(201);
      const g = await empApi(`/employees/${id}`, { token });
      expect(g.status).toBe(200);
    } finally {
      execSync(`docker unpause ${KAFKA_CONTAINER}`, { stdio: 'ignore' });
    }
  });

  test('E-N02 kafka down -> publish WARN logged, audit/CRUD unaffected', async () => {
    test.setTimeout(180_000);
    const logPath = EMPLOYEE_LOG;
    const offset = fs.statSync(logPath).size;
    execSync(`docker stop ${KAFKA_CONTAINER}`, { stdio: 'ignore' });
    try {
      const id = newEmployeeId();
      const c = await empApi('/employees', { method: 'POST', token, body: employeePayload(id) });
      expect(c.status).toBe(201);
      const g = await empApi(`/employees/${id}`, { token });
      expect(g.status).toBe(200);

      let audited = false;
      for (let i = 0; i < 30 && !audited; i++) {
        const rows = await fetchAudit(token);
        audited = rows.some((r) => r.action === 'CREATE_EMPLOYEE' && r.employeeId === id);
        if (!audited) await new Promise((r) => setTimeout(r, 400));
      }
      expect(audited, 'audit row written while kafka down').toBe(true);

      let warn = false;
      for (let i = 0; i < 150 && !warn; i++) {
        const size = fs.statSync(logPath).size;
        if (size > offset) {
          const fd = fs.openSync(logPath, 'r');
          const buf = Buffer.alloc(size - offset);
          fs.readSync(fd, buf, 0, buf.length, offset);
          fs.closeSync(fd);
          warn = /kafka publish (failed|skipped)/.test(buf.toString('utf8'));
        }
        if (!warn) await new Promise((r) => setTimeout(r, 1000));
      }
      expect(warn, 'WARN publish failure in service log').toBe(true);
    } finally {
      execSync(`docker start ${KAFKA_CONTAINER}`, { stdio: 'ignore' });
      let up = false;
      for (let i = 0; i < 30 && !up; i++) {
        try { await listTopics(); up = true; } catch { await new Promise((r) => setTimeout(r, 1000)); }
      }
      expect(up, 'kafka broker back up').toBe(true);
    }
  });

  test('E-N03 events isolated by key per employee', async () => {
    const id1 = newEmployeeId();
    const id2 = newEmployeeId();
    await empApi('/employees', { method: 'POST', token, body: employeePayload(id1) });
    await empApi('/employees', { method: 'POST', token, body: employeePayload(id2) });
    const e1 = await fetchKafkaEntry('employee-create', id1, { timeoutMs: 15_000 });
    const e2 = await fetchKafkaEntry('employee-create', id2, { timeoutMs: 15_000 });
    expect(e1, `event for ${id1}`).toBeTruthy();
    expect(e2, `event for ${id2}`).toBeTruthy();
    expect(e1.key).toBe(id1);
    expect(e2.key).toBe(id2);
    expect(e1.payload.employeeId).toBe(id1);
    expect(e2.payload.employeeId).toBe(id2);
  });
});

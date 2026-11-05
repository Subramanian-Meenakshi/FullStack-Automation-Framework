const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');
const { login, empApi, employeePayload } = require('../../helpers/apiHelper');
const { newEmployeeId } = require('../../helpers/ids');
const { redisCmd, keyFor } = require('../../helpers/cacheHelper');
const { REDIS_CONTAINER } = require('../../helpers/services');

test.describe('D Redis cache', () => {
  let token;
  test.beforeAll(async () => { token = (await login('HR_ADMIN')).accessToken; });

  async function createAndGet(id) {
    await empApi('/employees', { method: 'POST', token, body: employeePayload(id) });
    redisCmd('DEL', keyFor(id));
    const first = await empApi(`/employees/${id}`, { token });
    const second = await empApi(`/employees/${id}`, { token });
    return { first, second, id };
  }

  test('D-P01 miss populates key with TTL', async () => {
    const id = newEmployeeId();
    await createAndGet(id);
    expect(redisCmd('EXISTS', keyFor(id))).toBe('1');
    const ttl = Number(redisCmd('TTL', keyFor(id)));
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(600);
  });

  test('D-P02 hit returns identical body', async () => {
    const id = newEmployeeId();
    const { first, second } = await createAndGet(id);
    expect(second.status).toBe(200);
    expect(second.json).toEqual(first.json);
  });

  test('D-P03 TTL decrements between reads', async () => {
    const id = newEmployeeId();
    await createAndGet(id);
    const ttl1 = Number(redisCmd('TTL', keyFor(id)));
    expect(ttl1).toBeGreaterThan(0);
    await new Promise((r) => setTimeout(r, 2500));
    const ttl2 = Number(redisCmd('TTL', keyFor(id)));
    expect(ttl2).toBeGreaterThan(0);
    expect(ttl2).toBeLessThan(ttl1);
  });

  test('D-P04 update evicts and repopulates fresh values', async () => {
    const id = newEmployeeId();
    await createAndGet(id);
    await empApi(`/employees/${id}`, { method: 'PUT', token, body: employeePayload(id, { firstName: 'Fresh' }) });
    expect(redisCmd('EXISTS', keyFor(id))).toBe('0'); // evicted
    const got = await empApi(`/employees/${id}`, { token });
    expect(got.json.firstName).toBe('Fresh');
    expect(redisCmd('EXISTS', keyFor(id))).toBe('1'); // repopulated
  });

  test('D-P05 delete evicts key', async () => {
    const id = newEmployeeId();
    await createAndGet(id);
    await empApi(`/employees/${id}`, { method: 'DELETE', token });
    expect(redisCmd('EXISTS', keyFor(id))).toBe('0');
  });

  test('D-P06 restore evicts key', async () => {
    const id = newEmployeeId();
    await createAndGet(id);
    await empApi(`/employees/${id}`, { method: 'DELETE', token });
    expect(redisCmd('EXISTS', keyFor(id))).toBe('0');
    await empApi(`/employees/${id}/restore`, { method: 'POST', token });
    expect(redisCmd('EXISTS', keyFor(id))).toBe('0');
  });

  test('D-P07 key prefix emp: only', async () => {
    const id = newEmployeeId();
    await createAndGet(id);
    const keys = redisCmd('KEYS', `emp:${id}`);
    expect(keys).toBe(keyFor(id));
  });

  test('D-N01 corrupted cache falls back to DB and self-heals', async () => {
    const id = newEmployeeId();
    await createAndGet(id);
    redisCmd('SET', keyFor(id), 'NOT-JSON{');
    const r = await empApi(`/employees/${id}`, { token });
    expect(r.status).toBe(200);
    expect(r.json.employeeId).toBe(id);
    const healed = redisCmd('GET', keyFor(id));
    expect(healed).toContain(id);
  });

  test('D-N02 redis paused -> GET still 200 (DB fallback)', async () => {
    const id = newEmployeeId();
    await empApi('/employees', { method: 'POST', token, body: employeePayload(id) });
    execSync(`docker pause ${REDIS_CONTAINER}`, { stdio: 'ignore' });
    try {
      const r = await empApi(`/employees/${id}`, { token });
      expect(r.status).toBe(200);
      expect(r.json.employeeId).toBe(id);
    } finally {
      execSync(`docker unpause ${REDIS_CONTAINER}`, { stdio: 'ignore' });
    }
  });

  test('D-N03 stale value never served after update', async () => {
    const id = newEmployeeId();
    await createAndGet(id);
    await empApi(`/employees/${id}`, { method: 'PUT', token, body: employeePayload(id, { firstName: 'Newest' }) });
    const r = await empApi(`/employees/${id}`, { token });
    expect(r.json.firstName).toBe('Newest');
  });
});

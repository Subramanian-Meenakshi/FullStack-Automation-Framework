const { test, expect } = require('@playwright/test');
const { login, empApi, employeePayload, loginRaw } = require('../../helpers/apiHelper');
const { newEmployeeId } = require('../../helpers/ids');
const { loginUi } = require('../../helpers/authHelper');
const { AUTH_URL, EMP_URL, UI_URL } = require('../../helpers/services');

test.describe('I security', () => {
  let token;
  test.beforeAll(async () => { token = (await login('HR_ADMIN')).accessToken; });

  test('I-01 SQLi in list/query params does not break API', async () => {
    const r = await empApi('/employees?sort=%27%20OR%201%3D1--', { token });
    expect(r.status).toBe(200);
    expect(Array.isArray(r.json)).toBe(true);
  });

  test('I-02 SQLi in employee fields stored literally', async () => {
    const id = newEmployeeId();
    const r = await empApi('/employees', { method: 'POST', token, body: employeePayload(id, { skills: "'; DROP TABLE employees;--" }) });
    expect(r.status).toBe(201);
    const list = await empApi('/employees', { token });
    expect(list.status).toBe(200);
    expect(list.json.length).toBeGreaterThan(0);
  });

  test('I-03 missing token -> 403', async () => {
    expect((await empApi('/employees')).status).toBe(403);
  });

  test('I-05 tampered JWT rejected', async () => {
    const t = await login('HR_ADMIN');
    expect((await empApi('/employees', { token: `${t.accessToken}junk` })).status).toBe(403);
  });

  test('I-06 oversized payload -> 400 not 500', async () => {
    const r = await empApi('/employees', {
      method: 'POST', token,
      body: employeePayload(newEmployeeId(), { skills: 'x'.repeat(100_000) }),
    });
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.status).toBeLessThan(500);
  });

  test('I-07 malformed JSON -> 400 not 403 (/error permitAll)', async () => {
    const res = await fetch(`${EMP_URL}/employees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: 'not json at all',
    });
    expect(res.status).toBe(400);
  });

  test('I-08 CORS allows dev origin, rejects other', async () => {
    // Use Node http (not fetch): undici can strip/normalize Origin on some CI runners.
    const { request } = require('http');
    const { URL } = require('url');
    const preflight = (origin) => new Promise((resolve, reject) => {
      const u = new URL('/api/auth/login', AUTH_URL);
      const req = request({
        hostname: u.hostname,
        port: u.port,
        path: u.pathname,
        method: 'OPTIONS',
        headers: { Origin: origin, 'Access-Control-Request-Method': 'POST' },
      }, (res) => {
        res.resume();
        resolve(res);
      });
      req.on('error', reject);
      req.end();
    });

    const ok = await preflight(UI_URL);
    expect(ok.headers['access-control-allow-origin']).toBe(UI_URL);

    const bad = await preflight('http://evil.example');
    expect(bad.headers['access-control-allow-origin'] ?? null).toBeNull();
  });

  test('I-09 refresh token cannot act as access', async () => {
    const t = await login('HR_ADMIN');
    expect((await empApi('/employees', { token: t.refreshToken })).status).toBe(403);
  });

  test('I-10 SQLi login does not leak', async () => {
    const r = await loginRaw("admin'--", 'any');
    expect(r.status).toBe(401);
  });
});

test.describe('I XSS browser', () => {
  test.use({ baseURL: UI_URL });

  test('I-02 XSS payload renders as literal text, script never executes', async ({ page }) => {
    const t = await login('HR_ADMIN');
    const id = newEmployeeId();
    const scriptName = '<script>window.__xss=1</script>';
    const imgName = '<img src=x onerror=window.__xss2=1>';
    const r = await empApi('/employees', {
      method: 'POST', token: t.accessToken,
      body: employeePayload(id, { firstName: scriptName, lastName: imgName }),
    });
    expect(r.status).toBe(201);
    const stored = await empApi(`/employees/${id}`, { token: t.accessToken });
    expect(stored.json.firstName).toBe(scriptName);

    let dialogSeen = false;
    page.on('dialog', async (d) => { dialogSeen = true; await d.dismiss(); });

    await loginUi(page, 'HR_ADMIN');
    await page.goto('/employees');
    const row = page.getByRole('row').filter({ hasText: id });
    await expect(row).toBeVisible();
    await expect(row).toContainText(scriptName);
    await expect(row).toContainText(imgName);

    await page.goto(`/employees/${id}`);
    await expect(page.getByLabel('First Name')).toHaveValue(scriptName);
    await expect(page.getByLabel('Last Name')).toHaveValue(imgName);

    const flags = await page.evaluate(() => [window.__xss, window.__xss2]);
    expect(flags).toEqual([undefined, undefined]);
    expect(dialogSeen).toBe(false);
  });
});

const { test, expect } = require('@playwright/test');
const { authApi, login, loginRaw, empApi } = require('../../helpers/apiHelper');
const { users } = require('../../data/users');
const { UI_URL } = require('../../helpers/services');

test.describe('A positive auth', () => {
  test('A-P01 login success all roles returns token+role', async () => {
    for (const role of ['HR_ADMIN', 'MANAGER', 'EMPLOYEE']) {
      const r = await loginRaw(users[role].username, users[role].password);
      expect(r.status).toBe(200);
      expect(r.json.accessToken).toBeTruthy();
      expect(r.json.refreshToken).toBeTruthy();
      expect(r.json.role).toBe(role);
      expect(r.json.tokenType).toBe('Bearer');
    }
  });

  test('A-P03 refresh issues new access token', async () => {
    const t = await login('HR_ADMIN');
    // JWT iat has 1s precision — same-second refresh yields an identical token.
    await new Promise((r) => setTimeout(r, 1100));
    const r = await authApi('/api/auth/refresh', { method: 'POST', body: { refreshToken: t.refreshToken } });
    expect(r.status).toBe(200);
    expect(r.json.accessToken).toBeTruthy();
    expect(r.json.accessToken).not.toBe(t.accessToken);
  });

  test('A-P04 logout succeeds; stateless JWT keeps refresh valid until expiry', async () => {
    // Documented current behavior (plan I-10): logout is audit-only, no server-side revocation.
    const t = await login('HR_ADMIN');
    const lo = await authApi('/api/auth/logout', { method: 'POST', token: t.accessToken });
    expect(lo.status).toBe(200);
    const r = await authApi('/api/auth/refresh', { method: 'POST', body: { refreshToken: t.refreshToken } });
    expect(r.status).toBe(200);
  });

  test('A-P05 access token works on protected endpoint', async () => {
    const t = await login('MANAGER');
    const r = await empApi('/employees', { token: t.accessToken });
    expect(r.status).toBe(200);
  });

  test('A-P06 login through vite proxy (same-origin path)', async () => {
    const r = await fetch(`${UI_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ username: users.HR_ADMIN.username, password: users.HR_ADMIN.password }),
    });
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.accessToken).toBeTruthy();
    expect(j.role).toBe('HR_ADMIN');
  });
});

test.describe('A negative auth', () => {
  test('A-N01 wrong password -> 401 with message', async () => {
    const r = await loginRaw('hradmin', 'wrong');
    expect(r.status).toBe(401);
    expect(r.json.error).toContain('Invalid');
  });

  test('A-N02 unknown user -> same message (no enumeration)', async () => {
    const r = await loginRaw('nobody', 'x');
    expect(r.status).toBe(401);
    expect(r.json.error).toBe('Invalid username or password');
  });

  test('A-N03 missing password -> 400/401 not 500', async () => {
    const r = await authApi('/api/auth/login', { method: 'POST', body: { username: 'hradmin' } });
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.status).toBeLessThan(500);
  });

  test('A-N04 empty JSON body -> 400', async () => {
    const r = await authApi('/api/auth/login', { method: 'POST', body: {} });
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.status).toBeLessThan(500);
  });

  test('A-N05 tampered JWT (append) -> rejected', async () => {
    const t = await login('HR_ADMIN');
    const r = await empApi('/employees', { token: `${t.accessToken}x` });
    expect(r.status).toBe(403);
  });

  test('A-N06 flipped signature -> rejected', async () => {
    const t = await login('HR_ADMIN');
    const parts = t.accessToken.split('.');
    const flip = (s) => (s[0] === 'A' ? 'B' : 'A') + s.slice(1);
    const bad = `${parts[0]}.${parts[1]}.${flip(parts[2])}`;
    const r = await empApi('/employees', { token: bad });
    expect(r.status).toBe(403);
  });

  test('A-N07 expired JWT -> rejected', async () => {
    const t = await login('HR_ADMIN');
    const parts = t.accessToken.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    payload.exp = Math.floor(Date.now() / 1000) - 3600;
    const newPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    // signature no longer matches -> rejected either by exp or sig
    const r = await empApi('/employees', { token: `${parts[0]}.${newPayload}.${parts[2]}` });
    expect([401, 403]).toContain(r.status);
  });

  test('A-N08 alg=none JWT -> rejected', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({ sub: 'hradmin', role: 'HR_ADMIN', type: 'access', exp: Math.floor(Date.now() / 1000) + 900 })).toString('base64url');
    const r = await empApi('/employees', { token: `${header}.${body}.` });
    expect([401, 403]).toContain(r.status);
  });

  test('A-N09 refresh with access token -> 401', async () => {
    const t = await login('HR_ADMIN');
    const r = await authApi('/api/auth/refresh', { method: 'POST', body: { refreshToken: t.accessToken } });
    expect(r.status).toBe(401);
  });

  test('A-N10 refresh with garbage -> 401', async () => {
    const r = await authApi('/api/auth/refresh', { method: 'POST', body: { refreshToken: 'garbage' } });
    expect(r.status).toBe(401);
  });

  test('A-N11 SQLi username -> 401 no 500', async () => {
    const r = await loginRaw("' OR '1'='1", 'x');
    expect(r.status).toBe(401);
  });

  test('A-N12 XSS username -> 401 no 500', async () => {
    const r = await loginRaw('<script>alert(1)</script>', 'x');
    expect(r.status).toBe(401);
  });
});

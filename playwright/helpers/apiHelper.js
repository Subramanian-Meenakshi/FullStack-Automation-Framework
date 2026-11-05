const { users } = require('../data/users');
const { AUTH_URL, EMP_URL } = require('./services');

async function api(base, path, { method = 'GET', token, body, correlationId, headers = {} } = {}) {
  const h = { ...headers };
  if (body !== undefined) h['Content-Type'] = 'application/json';
  if (token) h['Authorization'] = `Bearer ${token}`;
  if (correlationId) h['X-Correlation-ID'] = correlationId;
  const res = await fetch(`${base}${path}`, {
    method,
    headers: h,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-json */ }
  return { status: res.status, json, text, headers: Object.fromEntries(res.headers.entries()) };
}

const authApi = (path, opts) => api(AUTH_URL, path, opts);
const empApi = (path, opts) => api(EMP_URL, path, opts);

async function login(role) {
  const u = users[role];
  const r = await authApi('/api/auth/login', { method: 'POST', body: { username: u.username, password: u.password } });
  if (r.status !== 200 || !r.json?.accessToken) {
    throw new Error(`login failed for ${role}: ${r.status} ${r.text}`);
  }
  return { ...r.json, role: u.role, username: u.username };
}

async function loginRaw(username, password) {
  return authApi('/api/auth/login', { method: 'POST', body: { username, password } });
}

function employeePayload(id, overrides = {}) {
  return {
    employeeId: id,
    firstName: 'Play',
    lastName: 'Wright',
    email: `${id}@corp.com`,
    contactNumber: '+91-9876543210',
    designation: 'Analyst',
    department: 'QA',
    jobLevel: 'L2',
    skills: 'Java,Playwright',
    manager: 'Ravi',
    location: 'Chennai',
    status: 'ACTIVE',
    ...overrides,
  };
}

module.exports = { AUTH_URL, EMP_URL, api, authApi, empApi, login, loginRaw, employeePayload };

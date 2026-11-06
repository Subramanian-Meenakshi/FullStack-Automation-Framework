// Same-origin paths; vite dev proxy routes /api -> 8080, /employees|/audit -> 8082.
// Works from localhost, 127.0.0.1, or LAN IP — no CORS needed.
const AUTH_URL = '';
const EMP_URL = '';

export function getToken() { return localStorage.getItem('accessToken'); }
export function getRefreshToken() { return localStorage.getItem('refreshToken'); }
export function getUsername() { return localStorage.getItem('username'); }
export function getRole() { return localStorage.getItem('role'); }

export function saveSession(r) {
  localStorage.setItem('accessToken', r.accessToken);
  localStorage.setItem('refreshToken', r.refreshToken);
  localStorage.setItem('username', r.username);
  localStorage.setItem('role', r.role);
}

export function clearSession() {
  ['accessToken', 'refreshToken', 'username', 'role'].forEach((k) => localStorage.removeItem(k));
}

async function tryRefresh() {
  const rt = getRefreshToken();
  if (!rt) return false;
  const res = await fetch(`${AUTH_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: rt }),
  });
  if (!res.ok) return false;
  const data = await res.json();
  if (!data.accessToken) return false;
  localStorage.setItem('accessToken', data.accessToken);
  if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
  return true;
}

export async function api(base, path, options = {}) {
  const url = `${base}${path}`;
  const doFetch = (token) => {
    const headers = { ...(options.headers || {}) };
    if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetch(url, { ...options, headers });
  };

  let res = await doFetch(getToken());
  if (res.status === 401 && (await tryRefresh())) {
    res = await doFetch(getToken());
  }
  if (res.status === 401) {
    clearSession();
    const loginPath = `${import.meta.env.BASE_URL}login`;
    if (window.location.pathname !== loginPath) window.location.href = loginPath;
  }
  return res;
}

export const authApi = (path, options) => api(AUTH_URL, path, options);
export const empApi = (path, options) => api(EMP_URL, path, options);

export async function jsonOrError(res) {
  let data = null;
  let raw = '';
  try {
    raw = await res.text();
    if (raw) data = JSON.parse(raw);
  } catch { /* non-JSON body */ }
  if (!res.ok) {
    const msg = data?.message || data?.error
      || (data?.path ? `${res.status} on ${data.path}` : `Request failed (${res.status})`);
    console.error('API error', res.status, res.url, raw);
    throw new Error(msg);
  }
  return data;
}

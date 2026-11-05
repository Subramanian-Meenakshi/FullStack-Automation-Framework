const { empApi } = require('./apiHelper');

async function fetchAudit(token) {
  const r = await empApi('/audit', { token });
  if (r.status !== 200) throw new Error(`audit fetch failed: ${r.status}`);
  return r.json;
}

async function waitForAudit(token, action, correlationId, { timeoutMs = 8000 } = {}) {
  const start = Date.now();
  let rows = [];
  while (Date.now() - start < timeoutMs) {
    rows = await fetchAudit(token);
    const hit = rows.find((r) => r.action === action && r.correlationId === correlationId);
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 300));
  }
  return null;
}

module.exports = { fetchAudit, waitForAudit };

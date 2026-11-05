const { expect } = require('@playwright/test');

async function gotoAudit(page) {
  await page.goto('/audit');
}

async function expectDenied(page, role) {
  await expect(page.getByRole('alert')).toContainText(`Role ${role} cannot view audit logs.`);
}

async function expectTable(page) {
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Correlation ID' })).toBeVisible();
}

async function filterByAction(page, action) {
  await page.getByLabel('Filter by action').click();
  await page.getByRole('option', { name: action, exact: true }).click();
}

async function expectOnlyAction(page, action) {
  const rows = page.getByRole('row').filter({ hasNotText: 'When' }).filter({ hasNotText: 'No audit entries' });
  const count = await rows.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    await expect(rows.nth(i)).toContainText(action);
  }
}

module.exports = { gotoAudit, expectDenied, expectTable, filterByAction, expectOnlyAction };

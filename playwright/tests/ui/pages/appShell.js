const { expect } = require('@playwright/test');

async function expectHeader(page, username, role) {
  await expect(page.getByText('Sandhata Employee Portal').first()).toBeVisible();
  await expect(page.getByText(`${username} (${role})`)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
}

async function navTo(page, name) {
  await page.getByRole('link', { name, exact: true }).click();
}

async function expectNavHidden(page, name) {
  await expect(page.getByRole('link', { name, exact: true })).toHaveCount(0);
}

module.exports = { expectHeader, navTo, expectNavHidden };

const { expect } = require('@playwright/test');

async function gotoDetails(page, id) {
  await page.goto(`/employees/${id}`);
}

async function expectFormLoaded(page, id) {
  await expect(page.getByLabel('Employee ID')).toHaveValue(id);
}

async function expectSaveVisible(page, visible) {
  const btn = page.getByRole('button', { name: 'Save' });
  if (visible) await expect(btn).toBeVisible();
  else await expect(btn).toHaveCount(0);
}

async function expectReadOnlyNotice(page, role) {
  await expect(page.getByText(`Read-only: role ${role} cannot edit employees.`)).toBeVisible();
}

async function editField(page, label, value) {
  await page.getByLabel(label).fill(value);
}

async function save(page) {
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('alert')).toContainText('Saved.');
}

async function expectRestoreVisible(page, visible) {
  const btn = page.getByRole('button', { name: 'Restore' });
  if (visible) await expect(btn).toBeVisible();
  else await expect(btn).toHaveCount(0);
}

async function restore(page) {
  await page.getByRole('button', { name: 'Restore' }).click();
  await expect(page.getByRole('alert')).toContainText('Restored to ACTIVE.');
}

module.exports = {
  gotoDetails, expectFormLoaded, expectSaveVisible, expectReadOnlyNotice,
  editField, save, expectRestoreVisible, restore,
};

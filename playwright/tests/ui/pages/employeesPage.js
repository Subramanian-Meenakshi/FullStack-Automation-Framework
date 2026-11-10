const { expect } = require('@playwright/test');
const { newEmployeeId } = require('../../../helpers/ids');
const { nameFor, emailFor } = require('../../../data/employeeData');

async function gotoEmployees(page) {
  await page.goto('/employees');
}

async function expectCreateVisible(page, visible) {
  const btn = page.getByRole('button', { name: 'Create Employee' });
  if (visible) await expect(btn).toBeVisible();
  else await expect(btn).toHaveCount(0);
}

async function openCreateDialog(page) {
  await page.getByRole('button', { name: 'Create Employee' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

async function fillCreateForm(page, id, overrides = {}) {
  const { firstName, lastName } = nameFor(id);
  const data = {
    employeeId: id,
    firstName,
    lastName,
    email: emailFor(id),
    contactNumber: '+91-9876543210',
    designation: 'Software Engineer',
    department: 'Engineering',
    jobLevel: 'L2',
    skills: 'Playwright',
    manager: 'Ravi',
    location: 'Chennai',
    ...overrides,
  };
  await page.getByLabel('Employee ID').fill(data.employeeId);
  await page.getByLabel('First Name').fill(data.firstName);
  await page.getByLabel('Last Name').fill(data.lastName);
  await page.getByLabel('Email').fill(data.email);
  await page.getByLabel('Contact Number').fill(data.contactNumber);
  await page.getByLabel('Designation').fill(data.designation);
  await page.getByLabel('Department').fill(data.department);
  await page.getByLabel('Job Level').fill(data.jobLevel);
  await page.getByLabel('Skills').fill(data.skills);
  await page.getByLabel('Manager').fill(data.manager);
  await page.getByLabel('Location').fill(data.location);
  return data;
}

async function submitCreate(page) {
  await page.getByRole('button', { name: 'Create', exact: true }).click();
}

async function expectRow(page, id, { status } = {}) {
  const row = page.getByRole('row').filter({ hasText: id });
  await expect(row).toBeVisible();
  if (status) await expect(row.getByText(status)).toBeVisible();
  return row;
}

async function deleteRow(page, id) {
  page.once('dialog', (d) => d.accept());
  const row = page.getByRole('row').filter({ hasText: id });
  await row.getByRole('button', { name: 'Delete' }).click();
}

async function createEmployeeViaUi(page, overrides = {}) {
  const id = overrides.employeeId || newEmployeeId();
  await gotoEmployees(page);
  await openCreateDialog(page);
  const data = await fillCreateForm(page, id, overrides);
  await submitCreate(page);
  await expect(page.getByRole('alert')).toContainText(`Created ${id}`);
  return { id, data };
}

module.exports = {
  gotoEmployees, expectCreateVisible, openCreateDialog, fillCreateForm,
  submitCreate, expectRow, deleteRow, createEmployeeViaUi,
};

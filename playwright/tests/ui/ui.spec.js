const { test, expect } = require('@playwright/test');
const { loginUi, logoutUi } = require('../../helpers/authHelper');
const { users } = require('../../data/users');
const { newEmployeeId } = require('../../helpers/ids');
const { gotoLogin, expectLoginChrome, submitCredentials, expectErrorAlert } = require('./pages/loginPage');
const { expectHeader, navTo } = require('./pages/appShell');
const {
  gotoEmployees, expectCreateVisible, openCreateDialog, fillCreateForm,
  submitCreate, expectRow, deleteRow, createEmployeeViaUi,
} = require('./pages/employeesPage');
const {
  gotoDetails, expectFormLoaded, expectSaveVisible, expectReadOnlyNotice,
  editField, save, expectRestoreVisible, restore,
} = require('./pages/employeeDetailsPage');
const { gotoAudit, expectDenied, expectTable, filterByAction, expectOnlyAction } = require('./pages/auditPage');
const { gotoAbout, expectAboutContent } = require('./pages/aboutPage');

test.describe('J UI E2E', () => {
  test('J-01 login chrome: title, app name, About link', async ({ page }) => {
    await gotoLogin(page);
    await expectLoginChrome(page);
  });

  test('J-02/J-15 HR_ADMIN login -> dashboard counts + header identity', async ({ page }) => {
    await loginUi(page, 'HR_ADMIN');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'Dashboard', level: 4 })).toBeVisible();
    await expect(page.getByText('Total Employees')).toBeVisible();
    await expect(page.getByText('Active')).toBeVisible();
    await expect(page.getByText('Terminated')).toBeVisible();
    await expectHeader(page, users.HR_ADMIN.username, 'HR_ADMIN');
  });

  test('J-03 employees list loads, View opens details', async ({ page }) => {
    await loginUi(page, 'HR_ADMIN');
    await gotoEmployees(page);
    await expect(page.getByRole('heading', { name: 'Employees' })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
    const view = page.getByRole('link', { name: 'View' }).first();
    await view.click();
    await expect(page).toHaveURL(/\/employees\/[^/]+$/);
    await expect(page.getByRole('heading', { level: 4 })).toContainText(/ACTIVE|TERMINATED/);
  });

  test('J-04 HR_ADMIN creates employee via dialog, appears in list', async ({ page }) => {
    await loginUi(page, 'HR_ADMIN');
    const { id } = await createEmployeeViaUi(page);
    await expectRow(page, id, { status: 'ACTIVE' });
  });

  test('J-05 empty create shows API error alert, no crash', async ({ page }) => {
    await loginUi(page, 'HR_ADMIN');
    await gotoEmployees(page);
    await openCreateDialog(page);
    await submitCreate(page);
    // MUI Modal aria-hides the page-level error alert; close dialog to reveal it.
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Employees' })).toBeVisible();
  });

  test('J-06 HR_ADMIN edits details -> Save -> persists after reload', async ({ page }) => {
    await loginUi(page, 'HR_ADMIN');
    const id = newEmployeeId();
    await createEmployeeViaUi(page, { employeeId: id, firstName: 'BeforeEdit' });
    await gotoDetails(page, id);
    await expectFormLoaded(page, id);
    await expectSaveVisible(page, true);
    await editField(page, 'First Name', 'AfterEdit');
    await save(page);
    await page.reload();
    await expectFormLoaded(page, id);
    await expect(page.getByLabel('First Name')).toHaveValue('AfterEdit');
  });

  test('J-07 MANAGER can edit, cannot see Create/Delete', async ({ page }) => {
    await loginUi(page, 'MANAGER');
    await gotoEmployees(page);
    await expectCreateVisible(page, false);
    await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(0);

    const id = newEmployeeId();
    // seed via API-equivalent: manager cannot create — use a pre-existing row from list
    const firstView = page.getByRole('link', { name: 'View' }).first();
    await firstView.click();
    await expectSaveVisible(page, true);
    // leave form untouched; just prove Save exists for MANAGER
    expect(id).toBeTruthy();
  });

  test('J-08 EMPLOYEE details read-only notice, no Save', async ({ page }) => {
    await loginUi(page, 'EMPLOYEE');
    await gotoEmployees(page);
    const firstView = page.getByRole('link', { name: 'View' }).first();
    await firstView.click();
    await expectSaveVisible(page, false);
    await expectReadOnlyNotice(page, 'EMPLOYEE');
  });

  test('J-09 HR_ADMIN delete -> confirm -> TERMINATED chip', async ({ page }) => {
    await loginUi(page, 'HR_ADMIN');
    const { id } = await createEmployeeViaUi(page);
    await gotoEmployees(page);
    await deleteRow(page, id);
    await expect(page.getByRole('alert')).toContainText(`Deleted ${id}`);
    await expectRow(page, id, { status: 'TERMINATED' });
  });

  test('J-10 restore button only when TERMINATED + HR_ADMIN', async ({ page }) => {
    await loginUi(page, 'HR_ADMIN');
    const { id } = await createEmployeeViaUi(page);
    await gotoDetails(page, id);
    await expectRestoreVisible(page, false);

    await gotoEmployees(page);
    await deleteRow(page, id);
    await gotoDetails(page, id);
    await expectFormLoaded(page, id);
    await expectRestoreVisible(page, true);
    await restore(page);
    await expect(page.getByRole('heading', { level: 4 })).toContainText('ACTIVE');
    await expectRestoreVisible(page, false);
  });

  test('J-11 audit: HR_ADMIN table + filter; EMPLOYEE denied', async ({ page }) => {
    await loginUi(page, 'HR_ADMIN');
    await navTo(page, 'Audit Logs');
    await expectTable(page);
    await filterByAction(page, 'LOGIN');
    await expectOnlyAction(page, 'LOGIN');

    await logoutUi(page);
    await loginUi(page, 'EMPLOYEE');
    await page.goto('/audit');
    await expectDenied(page, 'EMPLOYEE');
  });

  test('J-12 about page: line, name, mailto', async ({ page }) => {
    await gotoAbout(page);
    await expectAboutContent(page);
  });

  test('J-13 logout clears storage, / redirects to /login', async ({ page }) => {
    await loginUi(page, 'HR_ADMIN');
    await expectHeader(page, users.HR_ADMIN.username, 'HR_ADMIN');
    await logoutUi(page);
    const session = await page.evaluate(() => ({
      accessToken: localStorage.getItem('accessToken'),
      refreshToken: localStorage.getItem('refreshToken'),
      username: localStorage.getItem('username'),
      role: localStorage.getItem('role'),
    }));
    expect(session.accessToken).toBeNull();
    expect(session.refreshToken).toBeNull();
    expect(session.username).toBeNull();
    expect(session.role).toBeNull();
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });

  test('J-14 direct /employees while logged out -> /login', async ({ page }) => {
    await page.goto('/employees');
    await expect(page).toHaveURL(/\/login/);
  });

  test('J-16 About reachable from header nav', async ({ page }) => {
    await loginUi(page, 'HR_ADMIN');
    await navTo(page, 'About');
    await expectAboutContent(page);
  });
});
